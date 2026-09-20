/**
 * Phase 2 accounting foundation: Purchase orders
 * - Receiving a PO restocks matching SKUs and locks lastPrice
 * - Paying a received PO writes a supplier payment and marks the PO Paid
 * In-memory Mongo only.
 */

import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { assertInMemoryMongoUri } from '../../server/lib/mongoTestSafety.js';

jest.setTimeout(30000);

process.env.JWT_SECRET = 'test-secret-key';
process.env.VERCEL = '1';

const originalMongoUri = process.env.MONGO_URI;
const originalMongoDatabase = process.env.MONGO_DATABASE;
const originalMongoDbName = process.env.MONGO_DB_NAME;

let mongoServer;
let app;
let authToken;
let testUserId;

const auth = () => ({ Authorization: `Bearer ${authToken}` });

async function seedSupplierAndItem() {
  const Supplier = mongoose.model('Supplier');
  const InventoryItem = mongoose.model('InventoryItem');
  const supplier = await Supplier.create({ name: 'ADI', isActive: true });
  const item = await InventoryItem.create({
    name: 'Motion Sensor',
    sku: 'MOT-100',
    currentStock: 2,
    lastPrice: 10,
    unit: 'each',
  });
  return { supplier, item };
}

async function createDraftPo(supplierId) {
  return request(app)
    .post('/api/purchase-orders')
    .set(auth())
    .send({
      supplier: supplierId,
      status: 'Sent',
      items: [
        {
          sku: 'MOT-100',
          description: 'Motion Sensor',
          quantity: 4,
          unit: 'each',
          unitPrice: 12.5,
          total: 50,
        },
      ],
      subtotal: 50,
      tax: 0,
      shipping: 0,
      total: 50,
    });
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  delete process.env.MONGO_DATABASE;
  delete process.env.MONGO_DB_NAME;

  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  assertInMemoryMongoUri(mongoUri);
  process.env.MONGO_URI = mongoUri;

  await mongoose.disconnect();
  await mongoose.connect(mongoUri);

  const appModule = await import('../../server/app.js');
  app = appModule.default;

  const User = mongoose.model('User');
  testUserId = new mongoose.Types.ObjectId();
  await User.create({
    _id: testUserId,
    username: 'pouser',
    email: 'po@example.com',
    password: 'hashedpassword',
    role: 'admin',
    status: 'approved',
  });
  authToken = jwt.sign({ id: testUserId.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  if (originalMongoUri) process.env.MONGO_URI = originalMongoUri;
  else delete process.env.MONGO_URI;
  if (originalMongoDatabase) process.env.MONGO_DATABASE = originalMongoDatabase;
  else delete process.env.MONGO_DATABASE;
  if (originalMongoDbName) process.env.MONGO_DB_NAME = originalMongoDbName;
  else delete process.env.MONGO_DB_NAME;
});

beforeEach(async () => {
  const User = mongoose.model('User');
  const existing = await User.findById(testUserId);
  if (!existing) {
    await User.create({
      _id: testUserId,
      username: 'pouser',
      email: 'po@example.com',
      password: 'hashedpassword',
      role: 'admin',
      status: 'approved',
    });
  }
});

afterEach(async () => {
  const currentUri = mongoose.connection.client?.s?.url || process.env.MONGO_URI || '';
  assertInMemoryMongoUri(currentUri);
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    if (key !== 'users') await collections[key].deleteMany({});
  }
});

describe('POST /api/purchase-orders/:id/receive', () => {
  test('requires authentication', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).post(`/api/purchase-orders/${fakeId}/receive`);
    expect(res.status).toBe(401);
  });

  test('restocks inventory by SKU, updates lastPrice, and marks Received', async () => {
    const { supplier, item } = await seedSupplierAndItem();
    const created = await createDraftPo(supplier._id);
    expect(created.status).toBe(201);

    const res = await request(app)
      .post(`/api/purchase-orders/${created.body._id}/receive`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Received');
    expect(res.body.receivedDate).toBeTruthy();

    const InventoryItem = mongoose.model('InventoryItem');
    const updated = await InventoryItem.findById(item._id);
    expect(updated.currentStock).toBe(6);
    expect(updated.lastPrice).toBe(12.5);

    const InventoryMovement = mongoose.model('InventoryMovement');
    const movements = await InventoryMovement.find({ itemId: item._id });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      type: 'receive',
      quantity: 4,
      source: { kind: 'purchase-order', id: created.body._id },
    });
  });

  test('rejects a second receive', async () => {
    const { supplier } = await seedSupplierAndItem();
    const created = await createDraftPo(supplier._id);
    await request(app).post(`/api/purchase-orders/${created.body._id}/receive`).set(auth());

    const res = await request(app)
      .post(`/api/purchase-orders/${created.body._id}/receive`)
      .set(auth());
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/already received|paid/i);
  });
});

describe('POST /api/purchase-orders/:id/pay', () => {
  test('records a supplier payment and marks the PO Paid', async () => {
    const { supplier } = await seedSupplierAndItem();
    const created = await createDraftPo(supplier._id);
    await request(app).post(`/api/purchase-orders/${created.body._id}/receive`).set(auth());

    const res = await request(app)
      .post(`/api/purchase-orders/${created.body._id}/pay`)
      .set(auth())
      .send({ note: 'Check 1001' });

    expect(res.status).toBe(200);
    expect(res.body.po.status).toBe('Paid');
    expect(res.body.po.paidDate).toBeTruthy();
    expect(res.body.payment).toMatchObject({
      amount: 50,
      note: 'Check 1001',
    });
    expect(res.body.payment.supplierId).toBe(supplier._id.toString());

    const SupplierPayment = mongoose.model('SupplierPayment');
    const saved = await SupplierPayment.findOne({ purchaseOrderId: created.body._id });
    expect(saved.amount).toBe(50);
  });

  test('rejects pay before receive', async () => {
    const { supplier } = await seedSupplierAndItem();
    const created = await createDraftPo(supplier._id);
    const res = await request(app)
      .post(`/api/purchase-orders/${created.body._id}/pay`)
      .set(auth());
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/receive/i);
  });
});
