/**
 * Phase 1 accounting foundation: Inventory API
 * - Unique SKU (blank SKUs allowed more than once)
 * - lastPrice persisted
 * - Stock movements with a ledger
 * - Never allow negative on-hand stock
 * Uses in-memory Mongo only; collections are wiped after each test.
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
  assertInMemoryMongoUri(mongoose.connection.client?.s?.url || '');

  const appModule = await import('../../server/app.js');
  app = appModule.default;

  const User = mongoose.model('User');
  testUserId = new mongoose.Types.ObjectId();
  await User.create({
    _id: testUserId,
    username: 'invuser',
    email: 'inv@example.com',
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
      username: 'invuser',
      email: 'inv@example.com',
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
    if (key !== 'users') {
      await collections[key].deleteMany({});
    }
  }
});

describe('GET /api/inventory', () => {
  test('requires authentication', async () => {
    const res = await request(app).get('/api/inventory');
    expect(res.status).toBe(401);
  });

  test('returns an empty list when no items exist', async () => {
    const res = await request(app).get('/api/inventory').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/inventory', () => {
  test('creates an item with lastPrice and opening stock', async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set(auth())
      .send({
        name: '2x4 Lumber',
        sku: 'LUM-2X4',
        currentStock: 10,
        lastPrice: 4.5,
        unit: 'each',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: '2x4 Lumber',
      sku: 'LUM-2X4',
      currentStock: 10,
      lastPrice: 4.5,
    });

    const InventoryItem = mongoose.model('InventoryItem');
    const saved = await InventoryItem.findById(res.body._id);
    expect(saved.lastPrice).toBe(4.5);
    expect(saved.currentStock).toBe(10);
  });

  test('requires a name', async () => {
    const res = await request(app).post('/api/inventory').set(auth()).send({ sku: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/name/i);
  });

  test('rejects negative opening stock', async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set(auth())
      .send({ name: 'Bad', currentStock: -3 });
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/negative/i);
  });

  test('rejects a duplicate SKU', async () => {
    await request(app).post('/api/inventory').set(auth()).send({ name: 'A', sku: 'DUP-1' });
    const res = await request(app)
      .post('/api/inventory')
      .set(auth())
      .send({ name: 'B', sku: 'DUP-1' });
    expect(res.status).toBe(409);
    expect(res.body.msg).toMatch(/sku/i);
  });

  test('allows more than one item with a blank SKU', async () => {
    const first = await request(app).post('/api/inventory').set(auth()).send({ name: 'No SKU 1' });
    const second = await request(app).post('/api/inventory').set(auth()).send({ name: 'No SKU 2' });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });
});

describe('PUT /api/inventory/:id', () => {
  test('updates lastPrice and name without requiring a stock overwrite', async () => {
    const created = await request(app)
      .post('/api/inventory')
      .set(auth())
      .send({ name: 'Cable', sku: 'CAB-1', currentStock: 5, lastPrice: 1 });

    const res = await request(app)
      .put(`/api/inventory/${created.body._id}`)
      .set(auth())
      .send({
        name: 'RG6 Cable',
        sku: 'CAB-1',
        currentStock: 5,
        lastPrice: 2.25,
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('RG6 Cable');
    expect(res.body.lastPrice).toBe(2.25);
    expect(res.body.currentStock).toBe(5);
  });

  test('rejects a duplicate SKU on update', async () => {
    await request(app).post('/api/inventory').set(auth()).send({ name: 'A', sku: 'KEEP' });
    const other = await request(app)
      .post('/api/inventory')
      .set(auth())
      .send({ name: 'B', sku: 'OTHER' });

    const res = await request(app)
      .put(`/api/inventory/${other.body._id}`)
      .set(auth())
      .send({ name: 'B', sku: 'KEEP' });

    expect(res.status).toBe(409);
  });
});

describe('POST /api/inventory/:id/stock', () => {
  test('adds stock, records a movement, and stamps lastRestocked', async () => {
    const created = await request(app)
      .post('/api/inventory')
      .set(auth())
      .send({ name: 'Panel', sku: 'PNL-1', currentStock: 2 });

    const res = await request(app)
      .post(`/api/inventory/${created.body._id}/stock`)
      .set(auth())
      .send({ type: 'add', quantity: 3, reason: 'Truck delivery' });

    expect(res.status).toBe(200);
    expect(res.body.item.currentStock).toBe(5);
    expect(res.body.movement).toMatchObject({
      type: 'add',
      quantity: 3,
      previousStock: 2,
      newStock: 5,
      reason: 'Truck delivery',
    });
    expect(res.body.item.lastRestocked).toBeTruthy();
  });

  test('removes stock when enough is on hand', async () => {
    const created = await request(app)
      .post('/api/inventory')
      .set(auth())
      .send({ name: 'Siren', sku: 'SRN-1', currentStock: 4 });

    const res = await request(app)
      .post(`/api/inventory/${created.body._id}/stock`)
      .set(auth())
      .send({ type: 'remove', quantity: 1, reason: 'Used on job' });

    expect(res.status).toBe(200);
    expect(res.body.item.currentStock).toBe(3);
  });

  test('rejects a remove that would go negative', async () => {
    const created = await request(app)
      .post('/api/inventory')
      .set(auth())
      .send({ name: 'Keypad', sku: 'KPD-1', currentStock: 1 });

    const res = await request(app)
      .post(`/api/inventory/${created.body._id}/stock`)
      .set(auth())
      .send({ type: 'remove', quantity: 5, reason: 'Too many' });

    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/negative/i);

    const InventoryItem = mongoose.model('InventoryItem');
    const saved = await InventoryItem.findById(created.body._id);
    expect(saved.currentStock).toBe(1);
  });

  test('returns 404 for a missing item', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post(`/api/inventory/${fakeId}/stock`)
      .set(auth())
      .send({ type: 'add', quantity: 1 });
    expect(res.status).toBe(404);
  });

  test('sets on-hand from a physical count and returns the variance', async () => {
    const created = await request(app)
      .post('/api/inventory')
      .set(auth())
      .send({ name: 'Door Contact', sku: 'DC-1', currentStock: 20, lastPrice: 8 });

    const res = await request(app)
      .post(`/api/inventory/${created.body._id}/stock`)
      .set(auth())
      .send({ type: 'set', quantity: 17, reason: 'Shelf count 9/20' });

    expect(res.status).toBe(200);
    expect(res.body.item.currentStock).toBe(17);
    expect(res.body.movement).toMatchObject({
      type: 'set',
      quantity: 17,
      previousStock: 20,
      newStock: 17,
      reason: 'Shelf count 9/20',
    });
    expect(res.body.reconcile).toMatchObject({
      book: 20,
      counted: 17,
      usedQuantity: 3,
      foundQuantity: 0,
    });
    expect(res.body.jobMaterial).toBeUndefined();
  });

  test('count shortage assigned to a job charges the job once without a second stock drop', async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Count Co',
      email: 'count@test.com',
      phone: '555',
      projects: [{ name: 'Front door', status: 'Scheduled', materials: [] }],
    });
    const created = await request(app)
      .post('/api/inventory')
      .set(auth())
      .send({ name: 'Door Contact', sku: 'DC-JOB', currentStock: 20, lastPrice: 8 });

    const res = await request(app)
      .post(`/api/inventory/${created.body._id}/stock`)
      .set(auth())
      .send({
        type: 'set',
        quantity: 17,
        reason: 'Used on site, not logged',
        customerId: customer._id.toString(),
        projectId: customer.projects[0]._id.toString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.item.currentStock).toBe(17);
    expect(res.body.jobMaterial).toMatchObject({
      item: 'Door Contact',
      sku: 'DC-JOB',
      quantity: 3,
      cost: 8,
    });

    const InventoryItem = mongoose.model('InventoryItem');
    expect((await InventoryItem.findById(created.body._id)).currentStock).toBe(17);

    const refreshed = await Customer.findById(customer._id);
    expect(refreshed.projects[0].materials).toHaveLength(1);
    expect(refreshed.projects[0].materials[0]).toMatchObject({
      sku: 'DC-JOB',
      quantity: 3,
      cost: 8,
    });
  });

  test('remove with a job posts job cost and decrements stock once', async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Remove Co',
      email: 'remove@test.com',
      phone: '555',
      projects: [{ name: 'Garage', status: 'Scheduled', materials: [] }],
    });
    const created = await request(app)
      .post('/api/inventory')
      .set(auth())
      .send({ name: 'Siren', sku: 'SRN-JOB', currentStock: 6, lastPrice: 15 });

    const res = await request(app)
      .post(`/api/inventory/${created.body._id}/stock`)
      .set(auth())
      .send({
        type: 'remove',
        quantity: 2,
        customerId: customer._id.toString(),
        projectId: customer.projects[0]._id.toString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.item.currentStock).toBe(4);
    expect(res.body.jobMaterial.quantity).toBe(2);
    expect(res.body.movement.source).toMatchObject({
      kind: 'job',
      id: `${customer._id}:${customer.projects[0]._id}`,
    });

    const InventoryItem = mongoose.model('InventoryItem');
    expect((await InventoryItem.findById(created.body._id)).currentStock).toBe(4);
  });

  test('rejects assigning a job when a count finds extra stock', async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Overage Co',
      email: 'over@test.com',
      phone: '555',
      projects: [{ name: 'Shop', status: 'Scheduled', materials: [] }],
    });
    const created = await request(app)
      .post('/api/inventory')
      .set(auth())
      .send({ name: 'Magnet', sku: 'MAG-OV', currentStock: 2 });

    const res = await request(app)
      .post(`/api/inventory/${created.body._id}/stock`)
      .set(auth())
      .send({
        type: 'set',
        quantity: 5,
        customerId: customer._id.toString(),
        projectId: customer.projects[0]._id.toString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/reduced/i);
    const InventoryItem = mongoose.model('InventoryItem');
    expect((await InventoryItem.findById(created.body._id)).currentStock).toBe(2);
  });

  test('rejects a job assignment that is missing the project', async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Partial Co',
      email: 'partial@test.com',
      phone: '555',
      projects: [{ name: 'Office', status: 'Scheduled', materials: [] }],
    });
    const created = await request(app)
      .post('/api/inventory')
      .set(auth())
      .send({ name: 'Keypad', sku: 'KPD-J', currentStock: 4 });

    const res = await request(app)
      .post(`/api/inventory/${created.body._id}/stock`)
      .set(auth())
      .send({
        type: 'remove',
        quantity: 1,
        customerId: customer._id.toString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/customer and job/i);
  });

  test('assigning more use to a job that already has the SKU increments that line', async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Repeat Co',
      email: 'repeat@test.com',
      phone: '555',
      projects: [{
        name: 'Alarm',
        status: 'Scheduled',
        materials: [{ item: 'Door Contact', sku: 'DC-INC', quantity: 2, cost: 8 }],
      }],
    });
    const created = await request(app)
      .post('/api/inventory')
      .set(auth())
      .send({ name: 'Door Contact', sku: 'DC-INC', currentStock: 10, lastPrice: 8 });

    const res = await request(app)
      .post(`/api/inventory/${created.body._id}/stock`)
      .set(auth())
      .send({
        type: 'remove',
        quantity: 3,
        customerId: customer._id.toString(),
        projectId: customer.projects[0]._id.toString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.item.currentStock).toBe(7);
    expect(res.body.jobMaterial.quantity).toBe(5);

    const refreshed = await Customer.findById(customer._id);
    expect(refreshed.projects[0].materials).toHaveLength(1);
    expect(refreshed.projects[0].materials[0].quantity).toBe(5);
  });

  test('charges a job for items never received into inventory without changing stock', async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Direct Co',
      email: 'direct@test.com',
      phone: '555',
      projects: [{ name: 'Walk-in', status: 'Scheduled', materials: [] }],
    });
    const created = await request(app)
      .post('/api/inventory')
      .set(auth())
      .send({ name: 'Door Contact', sku: 'DC-NT', currentStock: 0, lastPrice: 12 });

    const res = await request(app)
      .post(`/api/inventory/${created.body._id}/stock`)
      .set(auth())
      .send({
        type: 'untracked',
        quantity: 3,
        customerId: customer._id.toString(),
        projectId: customer.projects[0]._id.toString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.item.currentStock).toBe(0);
    expect(res.body.movement).toMatchObject({
      type: 'untracked',
      quantity: 3,
      previousStock: 0,
      newStock: 0,
    });
    expect(res.body.jobMaterial).toMatchObject({
      sku: 'DC-NT',
      quantity: 3,
      cost: 12,
    });

    const InventoryItem = mongoose.model('InventoryItem');
    expect((await InventoryItem.findById(created.body._id)).currentStock).toBe(0);
  });

  test('deleting an untracked job charge does not invent inventory', async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'No Ghost Co',
      email: 'ghost@test.com',
      phone: '555',
      projects: [{ name: 'Walk-in', status: 'Scheduled', materials: [] }],
    });
    const created = await request(app)
      .post('/api/inventory')
      .set(auth())
      .send({ name: 'Door Contact', sku: 'DC-NG', currentStock: 0, lastPrice: 12 });

    const charged = await request(app)
      .post(`/api/inventory/${created.body._id}/stock`)
      .set(auth())
      .send({
        type: 'untracked',
        quantity: 2,
        customerId: customer._id.toString(),
        projectId: customer.projects[0]._id.toString(),
      });
    expect(charged.status).toBe(200);
    const materialId = charged.body.jobMaterial._id;

    const res = await request(app)
      .delete(`/api/customers/${customer._id}/projects/${customer.projects[0]._id}/materials/${materialId}`)
      .set(auth());
    expect(res.status).toBe(200);

    const InventoryItem = mongoose.model('InventoryItem');
    expect((await InventoryItem.findById(created.body._id)).currentStock).toBe(0);
  });

  test('rejects untracked use without a job', async () => {
    const created = await request(app)
      .post('/api/inventory')
      .set(auth())
      .send({ name: 'Siren', sku: 'SRN-NT', currentStock: 0 });

    const res = await request(app)
      .post(`/api/inventory/${created.body._id}/stock`)
      .set(auth())
      .send({ type: 'untracked', quantity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/never received/i);
  });
});

describe('GET /api/inventory/:id/movements', () => {
  test('lists movements newest first', async () => {
    const created = await request(app)
      .post('/api/inventory')
      .set(auth())
      .send({ name: 'Magnet', sku: 'MAG-1', currentStock: 0 });

    await request(app)
      .post(`/api/inventory/${created.body._id}/stock`)
      .set(auth())
      .send({ type: 'add', quantity: 2, reason: 'First' });
    await request(app)
      .post(`/api/inventory/${created.body._id}/stock`)
      .set(auth())
      .send({ type: 'add', quantity: 1, reason: 'Second' });

    const res = await request(app)
      .get(`/api/inventory/${created.body._id}/movements`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0].reason).toBe('Second');
    expect(res.body[1].reason).toBe('First');
  });
});

describe('DELETE /api/inventory/:id', () => {
  test('deletes an item', async () => {
    const created = await request(app)
      .post('/api/inventory')
      .set(auth())
      .send({ name: 'Temp', sku: 'TMP-1' });

    const res = await request(app)
      .delete(`/api/inventory/${created.body._id}`)
      .set(auth());
    expect(res.status).toBe(200);

    const InventoryItem = mongoose.model('InventoryItem');
    expect(await InventoryItem.findById(created.body._id)).toBeNull();
  });
});
