/**
 * REST for customer job tickets, bids, and projects.
 * In-memory Mongo. A bid save must not create a job.
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
let customerToken;

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
  const appModule = await import('../../server/app.js');
  app = appModule.default;
  await request(app).get('/api/health');

  const User = mongoose.model('User');
  const adminId = new mongoose.Types.ObjectId();
  const customerUserId = new mongoose.Types.ObjectId();
  await User.create({
    _id: adminId,
    username: 'workadmin',
    email: 'workadmin@example.com',
    password: 'hashedpassword',
    role: 'admin',
    status: 'approved',
  });
  await User.create({
    _id: customerUserId,
    username: 'workcustomer',
    email: 'workcustomer@example.com',
    password: 'hashedpassword',
    role: 'customer',
    status: 'approved',
  });
  authToken = jwt.sign({ id: adminId.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
  customerToken = jwt.sign({ id: customerUserId.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
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

async function createCustomer() {
  const Customer = mongoose.model('Customer');
  return Customer.create({
    name: 'Oak Street',
    address: '10 Oak',
    accountNumber: 'A-1044',
    projects: [{ name: 'Old combined', jobNumber: 'J-1001', status: 'Pending', bidAmount: 500 }],
  });
}

describe('customer job tickets, bids, and projects', () => {
  test('creates a job ticket with due and paid, and leaves the old project in place', async () => {
    const customer = await createCustomer();
    const res = await request(app)
      .post(`/api/customers/${customer._id}/service-jobs`)
      .set(auth())
      .send({
        name: 'Replace keypad',
        workType: 'service',
        status: 'invoiced',
        hoursWorked: 1,
        hourlyRate: 75,
        chargeLines: [{ description: 'Keypad', quantity: 1, price: 85 }],
        paidAmount: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body.jobNumber).toBe('A-1044-J0001');
    expect(res.body.amountDue).toBe(160);
    expect(res.body.variance).toBe(-60);

    const saved = await mongoose.model('Customer').findById(customer._id);
    expect(saved.projects).toHaveLength(1);
    expect(saved.serviceJobs).toHaveLength(1);
    expect(saved.bids).toHaveLength(0);
  });

  test('a bid is stored alone and does not create a job', async () => {
    const customer = await createCustomer();
    const res = await request(app)
      .post(`/api/customers/${customer._id}/bids`)
      .set(auth())
      .send({
        name: 'Cameras and access',
        status: 'declined',
        quotedAmount: 9100,
        lines: [{ description: 'Cameras', quantity: 4, estimate: 1800 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.quoteNumber).toBe('A-1044-B0001');
    expect(res.body.quotedAmount).toBe(9100);
    expect(res.body.linesTotal).toBe(7200);

    const saved = await mongoose.model('Customer').findById(customer._id);
    expect(saved.bids).toHaveLength(1);
    expect(saved.serviceJobs).toHaveLength(0);
  });

  test('a project groups a job without changing the job total', async () => {
    const customer = await createCustomer();
    const planRes = await request(app)
      .post(`/api/customers/${customer._id}/plans`)
      .set(auth())
      .send({ name: 'Building security', description: 'Phased install' });
    expect(planRes.status).toBe(201);
    expect(planRes.body.planNumber).toBe('A-1044-P0001');

    const jobRes = await request(app)
      .post(`/api/customers/${customer._id}/service-jobs`)
      .set(auth())
      .send({
        name: 'Rough-in',
        hoursWorked: 4,
        hourlyRate: 50,
        planId: planRes.body._id,
      });
    expect(jobRes.status).toBe(201);
    expect(jobRes.body.planId).toBe(String(planRes.body._id));
    expect(jobRes.body.amountDue).toBe(200);
  });

  test('updates a job ticket lines and paid amount in place', async () => {
    const customer = await createCustomer();
    const created = await request(app)
      .post(`/api/customers/${customer._id}/service-jobs`)
      .set(auth())
      .send({ name: 'Panel', hoursWorked: 1, hourlyRate: 80 });
    expect(created.status).toBe(201);

    const updated = await request(app)
      .put(`/api/customers/${customer._id}/service-jobs/${created.body._id}`)
      .set(auth())
      .send({
        name: 'Panel check',
        jobNumber: 'J-9999',
        hoursWorked: 1,
        hourlyRate: 80,
        status: 'paid',
        chargeLines: [{ description: 'Battery', quantity: 1, price: 20 }],
        paidAmount: 100,
      });

    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Panel check');
    expect(updated.body.jobNumber).toBe(created.body.jobNumber);
    expect(updated.body.amountDue).toBe(100);
    expect(updated.body.variance).toBe(0);
    expect(updated.body.chargeLines).toHaveLength(1);
    expect(updated.body.chargeLines[0].description).toBe('Battery');
  });

  test('rejects a job with no name and hides the routes from customers', async () => {
    const customer = await createCustomer();
    const missing = await request(app)
      .post(`/api/customers/${customer._id}/service-jobs`)
      .set(auth())
      .send({ hoursWorked: 1 });
    expect(missing.status).toBe(400);

    const hidden = await request(app)
      .post(`/api/customers/${customer._id}/bids`)
      .set({ Authorization: `Bearer ${customerToken}` })
      .send({ name: 'Secret quote' });
    expect(hidden.status).toBe(403);
  });

  test('a paid job ticket shows in accounting and the bid does not', async () => {
    const customer = await createCustomer();
    const jobRes = await request(app)
      .post(`/api/customers/${customer._id}/service-jobs`)
      .set(auth())
      .send({
        name: 'Replace keypad',
        status: 'scheduled',
        hoursWorked: 1,
        hourlyRate: 75,
        chargeLines: [{ description: 'Keypad', quantity: 1, price: 85 }],
        paidAmount: 160,
        paidDate: '2026-10-23',
      });
    expect(jobRes.status).toBe(201);

    const bidRes = await request(app)
      .post(`/api/customers/${customer._id}/bids`)
      .set(auth())
      .send({ name: 'Cameras and access', status: 'accepted', quotedAmount: 9100 });
    expect(bidRes.status).toBe(201);

    const summary = await request(app).get('/api/accounting/summary').set(auth());
    expect(summary.status).toBe(200);
    const ticket = summary.body.jobs.find((job) => job.jobNumber === 'A-1044-J0001');
    expect(ticket).toMatchObject({ billed: 160, paid: 160, balance: 0 });
    expect(summary.body.jobs.some((job) => job.jobNumber === 'A-1044-B0001')).toBe(false);
    expect(summary.body.period.revenue).toBe(160);
    expect(summary.body.ar).toEqual({ billed: 160, paid: 160, balance: 0 });
  });

  test('a business lists its people and a private individual does not', async () => {
    const business = await request(app)
      .post('/api/customers')
      .set(auth())
      .send({ name: 'Fashion Exchange', kind: 'business' });
    expect(business.status).toBe(200);
    expect(business.body.kind).toBe('business');

    const person = await request(app)
      .post(`/api/customers/${business.body._id}/people`)
      .set(auth())
      .send({ name: 'Ada Owner', role: 'Owner', phone: '931-279-7879' });
    expect(person.status).toBe(201);
    expect(person.body.name).toBe('Ada Owner');
    expect(person.body.role).toBe('Owner');

    const home = await request(app)
      .post('/api/customers')
      .set(auth())
      .send({ name: 'Sam Home', kind: 'individual' });
    expect(home.body.kind).toBe('individual');

    const denied = await request(app)
      .post(`/api/customers/${home.body._id}/people`)
      .set(auth())
      .send({ name: 'Sam Home' });
    expect(denied.status).toBe(400);

    const saved = await mongoose.model('Customer').findById(business.body._id);
    expect(saved.people).toHaveLength(1);
    expect(saved.people[0].phone).toBe('931-279-7879');
  });
});
