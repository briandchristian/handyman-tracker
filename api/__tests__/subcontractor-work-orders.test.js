/**
 * Subcontractor work-order REST CRUD.
 * In-memory Mongo only. Staff/admin money API — not customer jobs.
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
let staffToken;
let testUserId;
let staffUserId;

const auth = () => ({ Authorization: `Bearer ${authToken}` });
const staffAuth = () => ({ Authorization: `Bearer ${staffToken}` });

async function createOrder(overrides = {}) {
  return request(app)
    .post('/api/subcontractor-work-orders')
    .set(auth())
    .send({
      workOrderNumber: 'BRK-1001',
      siteName: 'Warehouse 12',
      siteAddress: '100 Industrial',
      siteCity: 'Nashville',
      jobType: 'service',
      status: 'assigned',
      hoursWorked: 2,
      hourlyRate: 55,
      travelPay: 20,
      equipmentLines: [
        { description: 'Motion', sku: 'PIR-2', quantity: 2, cost: 18, reimbursable: true },
      ],
      notes: 'After hours',
      ...overrides,
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
  await request(app).get('/api/health');

  const User = mongoose.model('User');
  testUserId = new mongoose.Types.ObjectId();
  staffUserId = new mongoose.Types.ObjectId();
  await User.create({
    _id: testUserId,
    username: 'woadmin',
    email: 'woadmin@example.com',
    password: 'hashedpassword',
    role: 'admin',
    status: 'approved',
  });
  await User.create({
    _id: staffUserId,
    username: 'wocustomer',
    email: 'wocustomer@example.com',
    password: 'hashedpassword',
    role: 'customer',
    status: 'approved',
  });
  authToken = jwt.sign({ id: testUserId.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
  staffToken = jwt.sign({ id: staffUserId.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
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

afterEach(async () => {
  assertInMemoryMongoUri(mongoose.connection.client?.s?.url || process.env.MONGO_URI || '');
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    if (key !== 'users') await collections[key].deleteMany({});
  }
});

describe('POST /api/subcontractor-work-orders', () => {
  test('creates a Brinks work order with labor, travel, and equipment due', async () => {
    const res = await createOrder();
    expect(res.status).toBe(201);
    expect(res.body.principal).toBe('Brinks');
    expect(res.body.workOrderNumber).toBe('BRK-1001');
    expect(res.body.laborPay).toBe(110);
    expect(res.body.travelPay).toBe(20);
    expect(res.body.equipmentTotal).toBe(36);
    expect(res.body.amountDue).toBe(166);
    expect(res.body.status).toBe('assigned');
  });

  test('cannot complete without a completion number', async () => {
    const res = await createOrder({ status: 'completed' });
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/completion/i);
  });

  test('rejects customer tokens', async () => {
    const res = await request(app)
      .post('/api/subcontractor-work-orders')
      .set(staffAuth())
      .send({ workOrderNumber: 'BRK-9' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/subcontractor-work-orders', () => {
  test('lists and filters by status', async () => {
    await createOrder({ workOrderNumber: 'OPEN-1', status: 'assigned' });
    await createOrder({
      workOrderNumber: 'DONE-1',
      status: 'completed',
      completionNumber: 'CL-22',
      completedDate: '2026-09-18',
    });

    const all = await request(app).get('/api/subcontractor-work-orders').set(auth());
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(2);
    expect(all.body.map((row) => row.workOrderNumber).sort()).toEqual(['DONE-1', 'OPEN-1']);

    const completed = await request(app)
      .get('/api/subcontractor-work-orders?status=completed')
      .set(auth());
    expect(completed.status).toBe(200);
    expect(completed.body).toHaveLength(1);
    expect(completed.body[0].completionNumber).toBe('CL-22');
    expect(completed.body[0].workOrderNumber).toBe('DONE-1');

    const badStatus = await request(app)
      .get('/api/subcontractor-work-orders?status=won')
      .set(auth());
    expect(badStatus.status).toBe(400);
  });
});

describe('PUT and DELETE /api/subcontractor-work-orders/:id', () => {
  test('updates totals and deletes the source document', async () => {
    const created = await createOrder();
    const id = created.body._id;

    const updated = await request(app)
      .put(`/api/subcontractor-work-orders/${id}`)
      .set(auth())
      .send({
        workOrderNumber: 'BRK-1001',
        status: 'invoiced',
        completionNumber: 'CL-990',
        hoursWorked: 4,
        hourlyRate: 55,
        travelPay: 15,
        equipmentLines: [{ description: 'Keypad', quantity: 1, cost: 40, reimbursable: true }],
      });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('invoiced');
    expect(updated.body.completionNumber).toBe('CL-990');
    expect(updated.body.laborPay).toBe(220);
    expect(updated.body.amountDue).toBe(275);

    const reconciled = await request(app)
      .put(`/api/subcontractor-work-orders/${id}`)
      .set(auth())
      .send({
        workOrderNumber: 'BRK-1001',
        status: 'paid',
        completionNumber: 'CL-990',
        hoursWorked: 4,
        hourlyRate: 55,
        travelPay: 15,
        equipmentLines: [{ description: 'Keypad', quantity: 1, cost: 40, reimbursable: true }],
        paidAmount: 250,
        paidDate: '2026-09-20',
        reconciliationNotes: 'Travel shorted $25',
      });
    expect(reconciled.status).toBe(200);
    expect(reconciled.body.amountDue).toBe(275);
    expect(reconciled.body.paidAmount).toBe(250);
    expect(reconciled.body.variance).toBe(-25);
    expect(reconciled.body.reconciliationNotes).toBe('Travel shorted $25');

    const blocked = await request(app)
      .put(`/api/subcontractor-work-orders/${id}`)
      .set(auth())
      .send({ workOrderNumber: 'BRK-1001', status: 'paid', completionNumber: '' });
    expect(blocked.status).toBe(400);

    const del = await request(app).delete(`/api/subcontractor-work-orders/${id}`).set(auth());
    expect(del.status).toBe(200);
    const list = await request(app).get('/api/subcontractor-work-orders').set(auth());
    expect(list.body).toHaveLength(0);
  });

  test('returns 404 for missing ids', async () => {
    const missingId = new mongoose.Types.ObjectId().toString();
    const put = await request(app)
      .put(`/api/subcontractor-work-orders/${missingId}`)
      .set(auth())
      .send({ workOrderNumber: 'X' });
    expect(put.status).toBe(404);
    const del = await request(app)
      .delete(`/api/subcontractor-work-orders/${missingId}`)
      .set(auth());
    expect(del.status).toBe(404);
  });
});
