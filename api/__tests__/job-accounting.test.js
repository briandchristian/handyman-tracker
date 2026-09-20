/**
 * Phase 3–4 accounting foundation: job materials consume inventory SKUs;
 * job payments replace a single paidToDate overwrite.
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

async function seedJobAndSku() {
  const Customer = mongoose.model('Customer');
  const InventoryItem = mongoose.model('InventoryItem');
  const customer = await Customer.create({
    name: 'Job Co',
    email: 'job@test.com',
    phone: '555',
    projects: [{ name: 'Alarm', description: 'Install', status: 'Scheduled', billAmount: 500, materials: [] }],
  });
  const item = await InventoryItem.create({
    name: 'Motion Sensor',
    sku: 'MOT-100',
    currentStock: 5,
    lastPrice: 20,
    unit: 'each',
  });
  return {
    customerId: customer._id.toString(),
    projectId: customer.projects[0]._id.toString(),
    item,
  };
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
  await request(app).get('/api/inventory');

  const User = mongoose.model('User');
  testUserId = new mongoose.Types.ObjectId();
  await User.create({
    _id: testUserId,
    username: 'jobacct',
    email: 'jobacct@example.com',
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
      username: 'jobacct',
      email: 'jobacct@example.com',
      password: 'hashedpassword',
      role: 'admin',
      status: 'approved',
    });
  }
});

afterEach(async () => {
  assertInMemoryMongoUri(mongoose.connection.client?.s?.url || process.env.MONGO_URI || '');
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    if (key !== 'users') await collections[key].deleteMany({});
  }
});

describe('POST materials with SKU', () => {
  test('decrements inventory and stores sku/cost from lastPrice', async () => {
    const { customerId, projectId, item } = await seedJobAndSku();
    const res = await request(app)
      .post(`/api/customers/${customerId}/projects/${projectId}/materials`)
      .set(auth())
      .send({ item: 'Motion Sensor', sku: 'MOT-100', quantity: 2, markup: 10 });

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      item: 'Motion Sensor',
      sku: 'MOT-100',
      quantity: 2,
      cost: 20,
    });

    const InventoryItem = mongoose.model('InventoryItem');
    const updated = await InventoryItem.findById(item._id);
    expect(updated.currentStock).toBe(3);

    const InventoryMovement = mongoose.model('InventoryMovement');
    const moves = await InventoryMovement.find({ itemId: item._id, type: 'use' });
    expect(moves).toHaveLength(1);
    expect(moves[0].quantity).toBe(2);
  });

  test('rejects usage that would go negative', async () => {
    const { customerId, projectId, item } = await seedJobAndSku();
    const res = await request(app)
      .post(`/api/customers/${customerId}/projects/${projectId}/materials`)
      .set(auth())
      .send({ item: 'Motion Sensor', sku: 'MOT-100', quantity: 9 });

    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/negative/i);
    const InventoryItem = mongoose.model('InventoryItem');
    expect((await InventoryItem.findById(item._id)).currentStock).toBe(5);
  });

  test('still allows a material with no SKU', async () => {
    const { customerId, projectId } = await seedJobAndSku();
    const res = await request(app)
      .post(`/api/customers/${customerId}/projects/${projectId}/materials`)
      .set(auth())
      .send({ item: 'Misc wire', quantity: 1, cost: 5, markup: 0 });
    expect(res.status).toBe(200);
    expect(res.body[0].item).toBe('Misc wire');
    expect(res.body[0].sku == null || res.body[0].sku === '').toBe(true);
  });
});

describe('DELETE material with SKU', () => {
  test('restores inventory stock', async () => {
    const { customerId, projectId, item } = await seedJobAndSku();
    const added = await request(app)
      .post(`/api/customers/${customerId}/projects/${projectId}/materials`)
      .set(auth())
      .send({ item: 'Motion Sensor', sku: 'MOT-100', quantity: 2 });
    const materialId = added.body[0]._id;

    const res = await request(app)
      .delete(`/api/customers/${customerId}/projects/${projectId}/materials/${materialId}`)
      .set(auth());
    expect(res.status).toBe(200);

    const InventoryItem = mongoose.model('InventoryItem');
    expect((await InventoryItem.findById(item._id)).currentStock).toBe(5);
  });
});

describe('POST /api/customers/:customerId/projects/:projectId/payments', () => {
  test('appends a payment and sets paidToDate to the sum', async () => {
    const { customerId, projectId } = await seedJobAndSku();
    const first = await request(app)
      .post(`/api/customers/${customerId}/projects/${projectId}/payments`)
      .set(auth())
      .send({ amount: 200, note: 'Deposit' });
    expect(first.status).toBe(201);
    expect(first.body.paidToDate).toBe(200);
    expect(first.body.payments).toHaveLength(1);

    const second = await request(app)
      .post(`/api/customers/${customerId}/projects/${projectId}/payments`)
      .set(auth())
      .send({ amount: 50, note: 'Progress' });
    expect(second.status).toBe(201);
    expect(second.body.paidToDate).toBe(250);
    expect(second.body.payments).toHaveLength(2);
  });

  test('rejects a non-positive amount', async () => {
    const { customerId, projectId } = await seedJobAndSku();
    const res = await request(app)
      .post(`/api/customers/${customerId}/projects/${projectId}/payments`)
      .set(auth())
      .send({ amount: 0 });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/accounting/summary', () => {
  test('returns AR from billed jobs and AP from received POs', async () => {
    const { customerId } = await seedJobAndSku();
    const Customer = mongoose.model('Customer');
    await Customer.findByIdAndUpdate(customerId, {
      $set: {
        'projects.0.status': 'Billed',
        'projects.0.billAmount': 500,
        'projects.0.taxRate': 0,
      },
    });

    const res = await request(app).get('/api/accounting/summary').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.ar.billed).toBe(500);
    expect(res.body.ap).toMatchObject({ receivedUnpaid: 0, paid: 0, balance: 0 });
    expect(Array.isArray(res.body.jobs)).toBe(true);
  });
});
