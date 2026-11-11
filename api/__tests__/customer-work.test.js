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

  test('adds, edits, and deletes notes on a service job', async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Mike Dibble',
      email: 'mike-notes@test.com',
      phone: '555',
      accountNumber: 'A-1006',
      serviceJobs: [{
        name: 'IP Cameras for property',
        jobNumber: 'A-1006-J0001',
        status: 'scheduled',
        notes: 'Gate code is 1234',
      }],
    });
    const jobId = customer.serviceJobs[0]._id.toString();
    const added = await request(app)
      .post(`/api/customers/${customer._id}/service-jobs/${jobId}/notes`)
      .set(auth())
      .send({ text: 'Dog in the yard' });
    expect(added.status).toBe(201);
    expect(added.body.map((note) => note.text)).toEqual(['Gate code is 1234', 'Dog in the yard']);

    const noteId = added.body[1]._id;
    const edited = await request(app)
      .put(`/api/customers/${customer._id}/service-jobs/${jobId}/notes/${noteId}`)
      .set(auth())
      .send({ text: 'Dog is friendly' });
    expect(edited.status).toBe(200);
    expect(edited.body.notes.map((note) => note.text)).toEqual(['Gate code is 1234', 'Dog is friendly']);

    const removed = await request(app)
      .delete(`/api/customers/${customer._id}/service-jobs/${jobId}/notes/${noteId}`)
      .set(auth());
    expect(removed.status).toBe(200);
    expect(removed.body.notes.map((note) => note.text)).toEqual(['Gate code is 1234']);

    const blank = await request(app)
      .post(`/api/customers/${customer._id}/service-jobs/${jobId}/notes`)
      .set(auth())
      .send({ text: '   ' });
    expect(blank.status).toBe(400);
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

  test('keeps a purchased line in inventory, then uses it on the job', async () => {
    const supplier = await mongoose.model('Supplier').create({ name: 'Wave Electronics' });
    const customer = await createCustomer();
    const line = {
      description: 'Switch',
      sku: 'SW-1',
      quantity: 2,
      price: 500,
      paid: 180,
      supplierId: String(supplier._id),
    };
    const stocked = await request(app)
      .post(`/api/customers/${customer._id}/service-jobs`)
      .set(auth())
      .send({
        name: 'Cameras',
        chargeLines: [{ ...line, inventoryDisposition: 'stock' }],
      });
    expect(stocked.status).toBe(201);
    expect(stocked.body.chargeLines[0].inventoryDisposition).toBe('stock');
    expect(String(stocked.body.chargeLines[0].supplierId)).toBe(String(supplier._id));

    const item = await mongoose.model('InventoryItem').findOne({ sku: 'SW-1' });
    expect(item.currentStock).toBe(2);
    expect(String(item.preferredSupplier)).toBe(String(supplier._id));
    const purchased = await mongoose.model('InventoryMovement').find({ itemId: item._id }).sort({ _id: 1 });
    expect(purchased.map((movement) => movement.type)).toEqual(['receive']);
    expect(purchased[0].reason).toMatch(/Purchased for Cameras/i);

    const used = await request(app)
      .put(`/api/customers/${customer._id}/service-jobs/${stocked.body._id}`)
      .set(auth())
      .send({
        name: 'Cameras',
        chargeLines: [{ ...line, inventoryDisposition: 'used', inventoryItemId: String(item._id) }],
      });
    expect(used.status).toBe(200);
    const after = await mongoose.model('InventoryItem').findById(item._id);
    expect(after.currentStock).toBe(0);
    const movements = await mongoose.model('InventoryMovement').find({ itemId: item._id }).sort({ _id: 1 });
    expect(movements.map((movement) => movement.type)).toEqual(['receive', 'use']);
    expect(movements[1].reason).toMatch(/Used on Cameras/i);
  });

  test('leaves a SKU line out of inventory until that choice is made', async () => {
    const customer = await createCustomer();
    const res = await request(app)
      .post(`/api/customers/${customer._id}/service-jobs`)
      .set(auth())
      .send({
        name: 'Panel',
        chargeLines: [{ description: 'Switch', sku: 'SW-9', quantity: 1, price: 40, paid: 20 }],
      });
    expect(res.status).toBe(201);
    expect(await mongoose.model('InventoryItem').countDocuments({ sku: 'SW-9' })).toBe(0);
  });

  test('uses stock on hand and records the cost, price, and job', async () => {
    const item = await mongoose.model('InventoryItem').create({
      name: 'Switch',
      sku: 'SW-1',
      currentStock: 4,
      lastPrice: 180,
    });
    const customer = await createCustomer();
    const res = await request(app)
      .post(`/api/customers/${customer._id}/service-jobs`)
      .set(auth())
      .send({
        name: 'Cameras',
        chargeLines: [{
          description: 'Switch',
          sku: 'SW-1',
          quantity: 2,
          price: 500,
          paid: 180,
          inventoryDisposition: 'draw',
          inventoryItemId: String(item._id),
        }],
      });
    expect(res.status).toBe(201);
    const saved = await mongoose.model('InventoryItem').findById(item._id);
    expect(saved.currentStock).toBe(2);
    const movements = await mongoose.model('InventoryMovement').find({ itemId: item._id }).sort({ _id: 1 });
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe('use');
    expect(movements[0].quantity).toBe(2);
    expect(movements[0].unitCost).toBe(180);
    expect(movements[0].unitPrice).toBe(500);
    expect(movements[0].reason).toMatch(/Used on Cameras/i);
  });

  test('adds an inventory item onto a job and draws the stock', async () => {
    const item = await mongoose.model('InventoryItem').create({
      name: 'Switch',
      sku: 'SW-1',
      currentStock: 4,
      lastPrice: 180,
    });
    const customer = await createCustomer();
    const created = await request(app)
      .post(`/api/customers/${customer._id}/service-jobs`)
      .set(auth())
      .send({
        name: 'Cameras',
        hoursWorked: 1,
        hourlyRate: 75,
        chargeLines: [{ description: 'Keypad', quantity: 1, price: 85 }],
      });
    expect(created.status).toBe(201);

    const res = await request(app)
      .post(`/api/inventory/${item._id}/add-to-job`)
      .set(auth())
      .send({
        customerId: String(customer._id),
        jobId: String(created.body._id),
        quantity: 1,
        price: 500,
      });

    expect(res.status).toBe(201);
    expect(res.body.job.chargeLines).toHaveLength(2);
    expect(res.body.job.chargeLines[1]).toMatchObject({
      description: 'Switch',
      sku: 'SW-1',
      quantity: 1,
      price: 500,
      paid: 180,
      inventoryDisposition: 'draw',
    });
    expect(res.body.job.amountDue).toBe(660);
    const saved = await mongoose.model('InventoryItem').findById(item._id);
    expect(saved.currentStock).toBe(3);
    const movements = await mongoose.model('InventoryMovement').find({ itemId: item._id });
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe('use');
    expect(movements[0].unitCost).toBe(180);
    expect(movements[0].unitPrice).toBe(500);
    expect(movements[0].reason).toMatch(/Used on Cameras/i);
  });

  test('adds an out-of-stock inventory item onto a job without drawing it', async () => {
    const item = await mongoose.model('InventoryItem').create({
      name: 'Relay',
      sku: 'RL-1',
      currentStock: 0,
      lastPrice: 22,
    });
    const customer = await createCustomer();
    const created = await request(app)
      .post(`/api/customers/${customer._id}/service-jobs`)
      .set(auth())
      .send({ name: 'Cameras' });
    const res = await request(app)
      .post(`/api/inventory/${item._id}/add-to-job`)
      .set(auth())
      .send({
        customerId: String(customer._id),
        jobId: String(created.body._id),
        quantity: 1,
        price: 40,
      });
    expect(res.status).toBe(201);
    expect(res.body.job.chargeLines[0]).toMatchObject({
      description: 'Relay',
      quantity: 1,
      price: 40,
      paid: 22,
    });
    expect(res.body.job.chargeLines[0].inventoryDisposition || '').toBe('');
    expect(res.body.job.chargeLines[0].inventoryItemId || null).toBeNull();
    expect((await mongoose.model('InventoryItem').findById(item._id)).currentStock).toBe(0);
    expect(await mongoose.model('InventoryMovement').countDocuments({ itemId: item._id })).toBe(0);
  });

  test('puts a kept part back on the shelf when this job had removed it', async () => {
    const supplier = await mongoose.model('Supplier').create({ name: 'Wave Electronics' });
    const item = await mongoose.model('InventoryItem').create({
      name: 'Door contact',
      sku: 'Q9-QS1135840',
      currentStock: 0,
      lastPrice: 13.92,
    });
    const customer = await createCustomer();
    const line = {
      description: 'Door contact',
      sku: 'Q9-QS1135840',
      quantity: 1,
      price: 0,
      paid: 13.92,
      inventoryDisposition: 'stock',
      supplierId: String(supplier._id),
      inventoryItemId: String(item._id),
    };
    const created = await request(app)
      .post(`/api/customers/${customer._id}/service-jobs`)
      .set(auth())
      .send({ name: 'Cameras', chargeLines: [line] });
    expect(created.status).toBe(201);
    expect((await mongoose.model('InventoryItem').findById(item._id)).currentStock).toBe(1);

    const unchanged = await request(app)
      .put(`/api/customers/${customer._id}/service-jobs/${created.body._id}`)
      .set(auth())
      .send({ name: 'Cameras', chargeLines: [line] });
    expect(unchanged.status).toBe(200);
    expect((await mongoose.model('InventoryItem').findById(item._id)).currentStock).toBe(1);

    await mongoose.model('InventoryItem').updateOne({ _id: item._id }, { currentStock: 0 });
    await mongoose.model('InventoryMovement').create({
      itemId: item._id,
      sku: 'Q9-QS1135840',
      type: 'remove',
      quantity: 1,
      previousStock: 1,
      newStock: 0,
      reason: 'Removed from inventory for Cameras',
      source: { kind: 'service-job', id: `${customer._id}:${created.body._id}` },
    });

    const restored = await request(app)
      .put(`/api/customers/${customer._id}/service-jobs/${created.body._id}`)
      .set(auth())
      .send({ name: 'Cameras', chargeLines: [line] });
    expect(restored.status).toBe(200);
    expect((await mongoose.model('InventoryItem').findById(item._id)).currentStock).toBe(1);
  });

  test('rejects an inventory purchase that has no supplier', async () => {
    const customer = await createCustomer();
    const res = await request(app)
      .post(`/api/customers/${customer._id}/service-jobs`)
      .set(auth())
      .send({
        name: 'Cameras',
        chargeLines: [{
          description: 'Switch',
          sku: 'SW-2',
          quantity: 1,
          paid: 10,
          inventoryDisposition: 'stock',
        }],
      });
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/supplier/i);
    expect(await mongoose.model('InventoryItem').countDocuments({ sku: 'SW-2' })).toBe(0);
  });
});
