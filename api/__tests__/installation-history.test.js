/**
 * Phase 1: Installation and Service History
 * - Creating a history record when a project is marked complete
 * - GET /api/customers/:customerId/history, GET /api/installation-history
 * - PUT /api/installation-history/:id with edit audit trail
 * Phase 2: CSV export - GET /api/installation-history/export?ids=... or all
 */

import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

process.env.JWT_SECRET = 'test-secret';
process.env.VERCEL = '1';

const originalMongoUri = process.env.MONGO_URI;
let mongoServer;
let app;
let authToken;
let adminId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  process.env.MONGO_URI = mongoUri;
  await mongoose.disconnect();
  await mongoose.connect(mongoUri);
  const appModule = await import('../index.js');
  app = appModule.default;
  const User = mongoose.model('User');
  const hashed = await bcrypt.hash('p', 10);
  const admin = await User.create({
    username: 'admin',
    email: 'admin@test.com',
    password: hashed,
    role: 'admin',
    status: 'approved'
  });
  adminId = admin._id;
  authToken = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  if (originalMongoUri) process.env.MONGO_URI = originalMongoUri;
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) await collections[key].deleteMany({});
  const User = mongoose.model('User');
  const admin = await User.create({
    username: 'admin',
    email: 'admin@test.com',
    password: await bcrypt.hash('p', 10),
    role: 'admin',
    status: 'approved'
  });
  authToken = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
});

describe('Phase 1: History record on project complete', () => {
  test('marking project complete creates an installation/service history entry', async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '555-1111',
      address: '123 Main St',
      projects: [{ name: 'Kitchen Remodel', description: 'Full remodel', status: 'Scheduled' }]
    });
    const customerId = customer._id.toString();
    const projectId = customer.projects[0]._id.toString();

    const res = await request(app)
      .put(`/api/customers/${customerId}/projects/${projectId}/complete`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Completed');

    const ServiceHistory = mongoose.model('ServiceHistory');
    const entries = await ServiceHistory.find({ customerId: customer._id });
    expect(entries.length).toBe(1);
    expect(entries[0].customerName).toBe('Jane Doe');
    expect(entries[0].projectName).toBe('Kitchen Remodel');
    expect(entries[0].summary).toBe('Full remodel');
    expect(entries[0].type).toMatch(/installation|service/);
    expect(entries[0].completedAt).toBeDefined();
    expect(entries[0].editHistory).toEqual([]);
  });
});

describe('GET /api/customers/:customerId/history', () => {
  test('returns history entries for customer ordered by completedAt desc', async () => {
    const Customer = mongoose.model('Customer');
    const ServiceHistory = mongoose.model('ServiceHistory');
    const customer = await Customer.create({
      name: 'Bob',
      email: 'bob@test.com',
      phone: '555',
      address: '',
      projects: []
    });
    await ServiceHistory.create([
      { customerId: customer._id, customerName: 'Bob', projectName: 'P1', summary: 'S1', type: 'installation', completedAt: new Date('2024-01-02') },
      { customerId: customer._id, customerName: 'Bob', projectName: 'P2', summary: 'S2', type: 'service', completedAt: new Date('2024-01-03') }
    ]);

    const res = await request(app)
      .get(`/api/customers/${customer._id}/history`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].projectName).toBe('P2');
    expect(res.body[1].projectName).toBe('P1');
  });

  test('returns 403 without admin', async () => {
    const Customer = mongoose.model('Customer');
    const User = mongoose.model('User');
    const customer = await Customer.create({ name: 'C', email: 'c@c.com', phone: '1', projects: [] });
    const custUser = await User.create({
      username: 'cust',
      email: 'cust@c.com',
      password: await bcrypt.hash('p', 10),
      role: 'customer',
      status: 'approved',
      customerId: customer._id
    });
    const token = jwt.sign({ id: custUser._id }, process.env.JWT_SECRET);
    const res = await request(app)
      .get(`/api/customers/${customer._id}/history`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/installation-history', () => {
  test('returns all history entries with optional customerId filter', async () => {
    const Customer = mongoose.model('Customer');
    const ServiceHistory = mongoose.model('ServiceHistory');
    const c1 = await Customer.create({ name: 'A', email: 'a@a.com', phone: '1', projects: [] });
    const c2 = await Customer.create({ name: 'B', email: 'b@b.com', phone: '2', projects: [] });
    await ServiceHistory.create([
      { customerId: c1._id, customerName: 'A', projectName: 'P1', summary: 'S1', type: 'installation', completedAt: new Date() },
      { customerId: c2._id, customerName: 'B', projectName: 'P2', summary: 'S2', type: 'installation', completedAt: new Date() }
    ]);

    const res = await request(app)
      .get('/api/installation-history')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);

    const resFiltered = await request(app)
      .get(`/api/installation-history?customerId=${c1._id}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(resFiltered.status).toBe(200);
    expect(resFiltered.body.length).toBe(1);
    expect(resFiltered.body[0].customerName).toBe('A');
  });
});

describe('PUT /api/installation-history/:id', () => {
  test('updates entry and appends edit to editHistory', async () => {
    const Customer = mongoose.model('Customer');
    const ServiceHistory = mongoose.model('ServiceHistory');
    const customer = await Customer.create({ name: 'X', email: 'x@x.com', phone: '1', projects: [] });
    const entry = await ServiceHistory.create({
      customerId: customer._id,
      customerName: 'X',
      projectName: 'P',
      summary: 'Original summary',
      type: 'installation',
      completedAt: new Date(),
      editHistory: []
    });

    const res = await request(app)
      .put(`/api/installation-history/${entry._id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ summary: 'Updated summary', details: 'Some details' });

    expect(res.status).toBe(200);
    expect(res.body.summary).toBe('Updated summary');
    expect(res.body.details).toBe('Some details');
    expect(res.body.editHistory.length).toBe(1);
    expect(res.body.editHistory[0].editedBy).toBeDefined();
    expect(res.body.editHistory[0].editedAt).toBeDefined();
    expect(res.body.editHistory[0].changes).toMatch(/summary|Updated/);
  });
});

describe('Phase 2: CSV export', () => {
  test('GET /api/installation-history/export returns CSV for all when no ids', async () => {
    const Customer = mongoose.model('Customer');
    const ServiceHistory = mongoose.model('ServiceHistory');
    const customer = await Customer.create({ name: 'Export', email: 'e@e.com', phone: '555', address: '123 St', projects: [] });
    await ServiceHistory.create({
      customerId: customer._id,
      customerName: 'Export',
      projectName: 'Proj',
      summary: 'Summary',
      type: 'installation',
      completedAt: new Date('2024-06-15T10:00:00Z')
    });

    const res = await request(app)
      .get('/api/installation-history/export')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/csv/);
    expect(res.text).toMatch(/customerName|Customer Name/);
    expect(res.text).toMatch(/Export/);
    expect(res.text).toMatch(/Proj/);
  });

  test('GET /api/installation-history/export?ids=id1,id2 returns only those records', async () => {
    const Customer = mongoose.model('Customer');
    const ServiceHistory = mongoose.model('ServiceHistory');
    const customer = await Customer.create({ name: 'A', email: 'a@a.com', phone: '1', projects: [] });
    const e1 = await ServiceHistory.create({
      customerId: customer._id,
      customerName: 'A',
      projectName: 'P1',
      summary: 'S1',
      type: 'installation',
      completedAt: new Date()
    });
    await ServiceHistory.create({
      customerId: customer._id,
      customerName: 'A',
      projectName: 'P2',
      summary: 'S2',
      type: 'installation',
      completedAt: new Date()
    });

    const res = await request(app)
      .get(`/api/installation-history/export?ids=${e1._id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/P1/);
    expect(res.text).not.toMatch(/P2/);
  });
});
