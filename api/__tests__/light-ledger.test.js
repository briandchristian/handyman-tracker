/**
 * Light ledger APIs: cost centers, expenses, labor, Direct vs Indirect summary,
 * project workType, and period filter.
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

async function seedJob({ workType = 'installation', billAmount = 500 } = {}) {
  const Customer = mongoose.model('Customer');
  const customer = await Customer.create({
    name: 'Ledger Co',
    email: 'ledger@test.com',
    phone: '555',
    projects: [{
      name: 'Alarm',
      description: 'Install',
      status: 'Scheduled',
      workType,
      billAmount,
      materials: [{ item: 'Panel', quantity: 1, cost: 80 }],
    }],
  });
  return {
    customerId: customer._id.toString(),
    projectId: customer.projects[0]._id.toString(),
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
  await request(app).get('/api/health');

  const User = mongoose.model('User');
  testUserId = new mongoose.Types.ObjectId();
  await User.create({
    _id: testUserId,
    username: 'ledgeradmin',
    email: 'ledgeradmin@example.com',
    password: 'hashedpassword',
    role: 'admin',
    status: 'approved',
    laborRate: 45,
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
      username: 'ledgeradmin',
      email: 'ledgeradmin@example.com',
      password: 'hashedpassword',
      role: 'admin',
      status: 'approved',
      laborRate: 45,
    });
  } else if (existing.laborRate !== 45) {
    existing.laborRate = 45;
    await existing.save();
  }
});

afterEach(async () => {
  assertInMemoryMongoUri(mongoose.connection.client?.s?.url || process.env.MONGO_URI || '');
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    if (key !== 'users') await collections[key].deleteMany({});
  }
});

describe('GET /api/cost-centers', () => {
  test('seeds office, bidding, fuel, and consumables', async () => {
    const res = await request(app).get('/api/cost-centers').set(auth());
    expect(res.status).toBe(200);
    const codes = res.body.map((center) => center.code);
    expect(codes).toEqual(expect.arrayContaining(['OFFICE', 'BIDDING', 'FUEL', 'CONSUMABLES', 'MISC']));
  });
});

describe('expenses', () => {
  test('records overhead without a project and job fuel as direct', async () => {
    const { customerId, projectId } = await seedJob();
    const overhead = await request(app)
      .post('/api/expenses')
      .set(auth())
      .send({ date: '2026-09-10', amount: 120, payee: 'Landlord', costCenterCode: 'OFFICE', description: 'Rent' });
    expect(overhead.status).toBe(201);
    expect(overhead.body.costCenterCode).toBe('OFFICE');
    expect(overhead.body.projectId == null || overhead.body.projectId === '').toBe(true);

    const fuel = await request(app)
      .post('/api/expenses')
      .set(auth())
      .send({
        date: '2026-09-11',
        amount: 35,
        payee: 'Shell',
        costCenterCode: 'FUEL',
        customerId,
        projectId,
      });
    expect(fuel.status).toBe(201);
    expect(String(fuel.body.projectId)).toBe(projectId);

    const summary = await request(app).get('/api/accounting/summary').set(auth());
    expect(summary.status).toBe(200);
    expect(summary.body.direct.expenses).toBe(35);
    expect(summary.body.direct.materials).toBe(80);
    expect(summary.body.indirect.total).toBe(120);
    expect(summary.body.jobs[0].contribution).toBe(385);
    expect(summary.body.jobs[0].profit).toBe(420);
  });

  test('rejects unknown cost centers and non-positive amounts', async () => {
    const unknown = await request(app)
      .post('/api/expenses')
      .set(auth())
      .send({ date: '2026-09-10', amount: 10, costCenterCode: 'NOTAREAL' });
    expect(unknown.status).toBe(400);

    const zero = await request(app)
      .post('/api/expenses')
      .set(auth())
      .send({ date: '2026-09-10', amount: 0, costCenterCode: 'OFFICE' });
    expect(zero.status).toBe(400);
  });

  test('deletes an expense', async () => {
    const created = await request(app)
      .post('/api/expenses')
      .set(auth())
      .send({ date: '2026-09-10', amount: 12, costCenterCode: 'CONSUMABLES' });
    const id = created.body._id;
    const del = await request(app).delete(`/api/expenses/${id}`).set(auth());
    expect(del.status).toBe(200);
    const list = await request(app).get('/api/expenses').set(auth());
    expect(list.body).toHaveLength(0);
  });

  test('updates a job expense without moving it to another job', async () => {
    const { customerId, projectId } = await seedJob();
    const other = await seedJob({ workType: 'service', billAmount: 100 });
    const created = await request(app)
      .post('/api/expenses')
      .set(auth())
      .send({
        date: '2026-09-11',
        amount: 35,
        payee: 'Shell',
        description: 'Gas',
        costCenterCode: 'FUEL',
        customerId,
        projectId,
      });
    expect(created.status).toBe(201);

    const updated = await request(app)
      .put(`/api/expenses/${created.body._id}`)
      .set(auth())
      .send({
        date: '2026-09-12',
        amount: 42,
        payee: 'BP',
        description: 'Diesel',
        costCenterCode: 'VEHICLE',
      });
    expect(updated.status).toBe(200);
    expect(updated.body.amount).toBe(42);
    expect(updated.body.payee).toBe('BP');
    expect(updated.body.description).toBe('Diesel');
    expect(updated.body.costCenterCode).toBe('VEHICLE');
    expect(String(updated.body.customerId)).toBe(customerId);
    expect(String(updated.body.projectId)).toBe(projectId);

    const moved = await request(app)
      .put(`/api/expenses/${created.body._id}`)
      .set(auth())
      .send({ customerId: other.customerId, projectId: other.projectId, amount: 42 });
    expect(moved.status).toBe(400);
    expect(String(moved.body.customerId || created.body.customerId)).not.toBe(other.customerId);

    const stillOnJob = await request(app)
      .get(`/api/expenses?customerId=${customerId}&projectId=${projectId}`)
      .set(auth());
    expect(stillOnJob.body).toHaveLength(1);
    expect(String(stillOnJob.body[0].projectId)).toBe(projectId);
  });

  test('returns 404 when updating a missing expense', async () => {
    const missing = await request(app)
      .put('/api/expenses/64b000000000000000000001')
      .set(auth())
      .send({ amount: 10, costCenterCode: 'FUEL' });
    expect(missing.status).toBe(404);
  });
});

describe('labor entries', () => {
  test('stores hourlyCost and uses user laborRate when omitted', async () => {
    const { customerId, projectId } = await seedJob();
    const explicit = await request(app)
      .post('/api/labor-entries')
      .set(auth())
      .send({
        date: '2026-09-12',
        hours: 2,
        hourlyCost: 50,
        workType: 'install',
        customerId,
        projectId,
      });
    expect(explicit.status).toBe(201);
    expect(explicit.body.hourlyCost).toBe(50);

    const fromRate = await request(app)
      .post('/api/labor-entries')
      .set(auth())
      .send({
        date: '2026-09-12',
        hours: 1,
        workType: 'install',
        customerId,
        projectId,
      });
    expect(fromRate.status).toBe(201);
    expect(fromRate.body.hourlyCost).toBe(45);

    const bidding = await request(app)
      .post('/api/labor-entries')
      .set(auth())
      .send({ date: '2026-09-12', hours: 3, hourlyCost: 40, workType: 'bidding' });
    expect(bidding.status).toBe(201);

    const summary = await request(app).get('/api/accounting/summary').set(auth());
    expect(summary.body.direct.labor).toBe(145);
    expect(summary.body.indirect.labor).toBe(120);
    expect(summary.body.jobs[0].contribution).toBe(275);
  });

  test('updates job hours and keeps them on the same job', async () => {
    const { customerId, projectId } = await seedJob();
    const other = await seedJob({ workType: 'service', billAmount: 100 });
    const created = await request(app)
      .post('/api/labor-entries')
      .set(auth())
      .send({
        date: '2026-09-12',
        hours: 2,
        hourlyCost: 50,
        workType: 'install',
        notes: 'Panel',
        customerId,
        projectId,
      });
    expect(created.status).toBe(201);

    const updated = await request(app)
      .put(`/api/labor-entries/${created.body._id}`)
      .set(auth())
      .send({
        date: '2026-09-13',
        hours: 3.5,
        hourlyCost: 40,
        workType: 'service',
        notes: 'Service call',
      });
    expect(updated.status).toBe(200);
    expect(updated.body.hours).toBe(3.5);
    expect(updated.body.hourlyCost).toBe(40);
    expect(updated.body.workType).toBe('service');
    expect(updated.body.notes).toBe('Service call');
    expect(String(updated.body.customerId)).toBe(customerId);
    expect(String(updated.body.projectId)).toBe(projectId);

    const blankRate = await request(app)
      .put(`/api/labor-entries/${created.body._id}`)
      .set(auth())
      .send({ hours: 3.5, hourlyCost: '' });
    expect(blankRate.status).toBe(200);
    expect(blankRate.body.hourlyCost).toBe(45);

    const moved = await request(app)
      .put(`/api/labor-entries/${created.body._id}`)
      .set(auth())
      .send({ customerId: other.customerId, projectId: other.projectId, hours: 3.5 });
    expect(moved.status).toBe(400);

    const stillOnJob = await request(app)
      .get(`/api/labor-entries?customerId=${customerId}&projectId=${projectId}`)
      .set(auth());
    expect(stillOnJob.body).toHaveLength(1);
    expect(String(stillOnJob.body[0].projectId)).toBe(projectId);
  });

  test('deletes a labor entry', async () => {
    const created = await request(app)
      .post('/api/labor-entries')
      .set(auth())
      .send({ date: '2026-09-12', hours: 1, hourlyCost: 40, workType: 'admin' });
    const id = created.body._id;
    const del = await request(app).delete(`/api/labor-entries/${id}`).set(auth());
    expect(del.status).toBe(200);
    const list = await request(app).get('/api/labor-entries').set(auth());
    expect(list.body).toHaveLength(0);
  });
});

describe('project workType', () => {
  test('complete writes ServiceHistory type from the project workType', async () => {
    const { customerId, projectId } = await seedJob({ workType: 'service' });
    const complete = await request(app)
      .put(`/api/customers/${customerId}/projects/${projectId}/complete`)
      .set(auth())
      .send({});
    expect(complete.status).toBe(200);

    const ServiceHistory = mongoose.model('ServiceHistory');
    const history = await ServiceHistory.findOne({ projectId });
    expect(history.type).toBe('service');

    const summary = await request(app).get('/api/accounting/summary').set(auth());
    expect(summary.body.jobs[0].workType).toBe('service');
  });
});

describe('GET /api/accounting/summary period', () => {
  test('from/to query filters P&L but keeps AR', async () => {
    const Customer = mongoose.model('Customer');
    await Customer.create({
      name: 'Old Co',
      email: 'old@test.com',
      phone: '1',
      projects: [{
        name: 'August job',
        status: 'Billed',
        billAmount: 800,
        createdAt: new Date('2026-08-05T00:00:00.000Z'),
        materials: [],
      }],
    });
    await request(app)
      .post('/api/expenses')
      .set(auth())
      .send({ date: '2026-09-08', amount: 70, costCenterCode: 'OFFICE' });

    const res = await request(app)
      .get('/api/accounting/summary?from=2026-09-01&to=2026-09-30')
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(0);
    expect(res.body.indirect.total).toBe(70);
    expect(res.body.ar.billed).toBe(800);
    expect(res.body.period.from).toBe('2026-09-01');
    expect(res.body.period.overheadRateOnCost).toBeNull();
  });
});
