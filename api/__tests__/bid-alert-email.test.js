/**
 * Request a Bid stores the customer, then emails every address saved under
 * bid-alert settings. Staff can read and replace that list. A mail failure
 * must not turn a saved bid into an error. SMTP secrets are never returned.
 */

import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { assertInMemoryMongoUri } from '../../server/lib/mongoTestSafety.js';

jest.mock('../../server/lib/bidNotify.js', () => {
  const actual = jest.requireActual('../../server/lib/bidNotify.js');
  return {
    ...actual,
    sendBidAlert: jest.fn((...args) => actual.sendBidAlert(...args)),
  };
});

import { sendBidAlert } from '../../server/lib/bidNotify.js';

const actualBidNotify = jest.requireActual('../../server/lib/bidNotify.js');

jest.setTimeout(30000);

process.env.JWT_SECRET = 'bid-alert-test-secret';
process.env.VERCEL = '1';

const originalMongoUri = process.env.MONGO_URI;
const smtpKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
const originalSmtp = Object.fromEntries(smtpKeys.map((key) => [key, process.env[key]]));

let mongoServer;
let app;
let authToken;
let customerToken;
let adminId;
let customerId;

const heroBid = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '555-0100',
  address: '10 Main St',
  projectName: 'Camera install',
  projectDescription: 'Four outdoor cameras',
};

const clearSmtpEnv = () => {
  for (const key of smtpKeys) delete process.env[key];
};

const waitForAlert = async (calls = 1) => {
  const start = Date.now();
  while (sendBidAlert.mock.calls.length < calls) {
    if (Date.now() - start > 2000) {
      throw new Error(`expected sendBidAlert to be called ${calls} time(s)`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const pending = sendBidAlert.mock.results
    .slice(0, calls)
    .map((result) => result.value)
    .filter((value) => value && typeof value.then === 'function');
  await Promise.all(pending);
};

const waitForSentCount = async (count) => {
  const start = Date.now();
  let listed;
  while (Date.now() - start < 2000) {
    listed = await request(app)
      .get('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`);
    if ((listed.body.sent || []).length === count) return listed;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return listed;
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  assertInMemoryMongoUri(mongoUri);
  process.env.MONGO_URI = mongoUri;

  await mongoose.disconnect();
  await mongoose.connect(mongoUri);
  assertInMemoryMongoUri(mongoose.connection.client?.s?.url || '');

  const appModule = await import('../../server/app.js');
  app = appModule.default;
  // The first request reconnects using the app's database name. Create users after that.
  await request(app).get('/api/health');

  const User = mongoose.model('User');
  adminId = new mongoose.Types.ObjectId();
  customerId = new mongoose.Types.ObjectId();
  await User.create({
    _id: adminId,
    username: 'alert-admin',
    email: 'alert-admin@example.com',
    password: 'hashedpassword',
    role: 'admin',
    status: 'approved',
  });
  await User.create({
    _id: customerId,
    username: 'alert-customer',
    email: 'alert-customer@example.com',
    password: 'hashedpassword',
    role: 'customer',
    status: 'approved',
  });

  authToken = jwt.sign({ id: adminId.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
  customerToken = jwt.sign({ id: customerId.toString() }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  if (originalMongoUri) process.env.MONGO_URI = originalMongoUri;
  else delete process.env.MONGO_URI;
  for (const key of smtpKeys) {
    if (originalSmtp[key] === undefined) delete process.env[key];
    else process.env[key] = originalSmtp[key];
  }
});

beforeEach(async () => {
  jest.clearAllMocks();
  sendBidAlert.mockImplementation((...args) => actualBidNotify.sendBidAlert(...args));
  clearSmtpEnv();

  const User = mongoose.model('User');
  if (!(await User.findById(adminId))) {
    await User.create({
      _id: adminId,
      username: 'alert-admin',
      email: 'alert-admin@example.com',
      password: 'hashedpassword',
      role: 'admin',
      status: 'approved',
    });
  }
  if (!(await User.findById(customerId))) {
    await User.create({
      _id: customerId,
      username: 'alert-customer',
      email: 'alert-customer@example.com',
      password: 'hashedpassword',
      role: 'customer',
      status: 'approved',
    });
  }
});

afterEach(async () => {
  assertInMemoryMongoUri(mongoose.connection.client?.s?.url || '');
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    if (key !== 'users') await collections[key].deleteMany({});
  }
});

describe('bid alert settings', () => {
  test('requires an admin', async () => {
    const missing = await request(app).get('/api/settings/bid-alerts');
    expect(missing.status).toBe(401);

    const customer = await request(app)
      .get('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(customer.status).toBe(403);

    const denied = await request(app)
      .put('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ recipients: ['office@example.com'] });
    expect(denied.status).toBe(403);
  });

  test('starts empty and reports whether SMTP is configured without secrets', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_FROM = 'alerts@example.com';
    process.env.SMTP_PASS = 'super-secret-pass';

    const res = await request(app)
      .get('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.recipients).toEqual([]);
    expect(res.body.sent).toEqual([]);
    expect(res.body.smtpConfigured).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('super-secret-pass');
    expect(res.body.smtp).toBeUndefined();
  });

  test('saves, normalizes, and replaces the recipient list', async () => {
    const saved = await request(app)
      .put('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ recipients: ' Office@Example.com, boss@example.com\noffice@example.com ' });

    expect(saved.status).toBe(200);
    expect(saved.body.recipients).toEqual(['office@example.com', 'boss@example.com']);

    const again = await request(app)
      .put('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ recipients: ['only@example.com'] });
    expect(again.status).toBe(200);
    expect(again.body.recipients).toEqual(['only@example.com']);

    const listed = await request(app)
      .get('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`);
    expect(listed.body.recipients).toEqual(['only@example.com']);
    expect(listed.body.smtpConfigured).toBe(false);
  });

  test('rejects invalid addresses and leaves the saved list unchanged', async () => {
    await request(app)
      .put('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ recipients: ['keep@example.com'] });

    const res = await request(app)
      .put('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ recipients: ['keep@example.com', 'not-an-email'] });

    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/invalid email/i);
    expect(res.body.invalid).toEqual(['not-an-email']);

    const listed = await request(app)
      .get('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`);
    expect(listed.body.recipients).toEqual(['keep@example.com']);
  });

  test('rejects more than the maximum number of addresses', async () => {
    const recipients = Array.from({ length: 26 }, (_, index) => `user${index}@example.com`);
    const res = await request(app)
      .put('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ recipients });

    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/at most 25/i);
  });

  test('allows clearing the list', async () => {
    await request(app)
      .put('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ recipients: ['office@example.com'] });

    const cleared = await request(app)
      .put('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ recipients: [] });

    expect(cleared.status).toBe(200);
    expect(cleared.body.recipients).toEqual([]);
  });
});

describe('POST /api/customer-bid email alert', () => {
  test('emails the saved recipients after a new bid is stored', async () => {
    await request(app)
      .put('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ recipients: ['office@example.com', 'boss@example.com'] });
    sendBidAlert.mockClear();

    const res = await request(app).post('/api/customer-bid').send(heroBid);
    expect(res.status).toBe(201);

    await waitForAlert();
    expect(sendBidAlert).toHaveBeenCalledWith({
      recipients: ['office@example.com', 'boss@example.com'],
      bid: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '555-0100',
        address: '10 Main St',
        projectName: 'Camera install',
        projectDescription: 'Four outdoor cameras',
      },
    });

    const Customer = mongoose.model('Customer');
    const customer = await Customer.findOne({ email: 'jane@example.com' });
    expect(customer).toBeTruthy();
    expect(customer.heroBidUnread).toBe(true);
  });

  test('emails again when an existing customer submits another bid', async () => {
    const Customer = mongoose.model('Customer');
    await Customer.create({
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '555-0100',
      projects: [],
    });
    await request(app)
      .put('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ recipients: ['office@example.com'] });
    sendBidAlert.mockClear();

    const res = await request(app).post('/api/customer-bid').send(heroBid);
    expect(res.status).toBe(200);
    await waitForAlert();
    expect(sendBidAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: ['office@example.com'],
        bid: expect.objectContaining({ email: 'jane@example.com' }),
      })
    );
  });

  test('still saves the bid when sending throws', async () => {
    await request(app)
      .put('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ recipients: ['office@example.com'] });
    sendBidAlert.mockImplementation(() => {
      throw new Error('smtp down');
    });

    const res = await request(app).post('/api/customer-bid').send(heroBid);
    expect(res.status).toBe(201);
    await waitForAlert();

    const Customer = mongoose.model('Customer');
    expect(await Customer.findOne({ email: 'jane@example.com' })).toBeTruthy();
  });

  test('records the sent email without copying the customer', async () => {
    await request(app)
      .put('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ recipients: ['office@example.com', 'boss@example.com'] });
    sendBidAlert.mockResolvedValue({
      sent: true,
      recipients: ['office@example.com', 'boss@example.com'],
    });

    const res = await request(app).post('/api/customer-bid').send(heroBid);
    expect(res.status).toBe(201);
    await waitForAlert();

    const listed = await waitForSentCount(1);
    expect(listed.status).toBe(200);
    expect(listed.body.sent).toHaveLength(1);
    expect(listed.body.sent[0]).toMatchObject({
      recipients: ['office@example.com', 'boss@example.com'],
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '555-0100',
      address: '10 Main St',
      projectName: 'Camera install',
      projectDescription: 'Four outdoor cameras',
    });
    expect(listed.body.sent[0].subject).toContain('Camera install');
    expect(listed.body.sent[0].customerId).toBeUndefined();
    expect(listed.body.sent[0].projects).toBeUndefined();

    const Customer = mongoose.model('Customer');
    expect(await Customer.countDocuments({ email: 'jane@example.com' })).toBe(1);

    const replaced = await request(app)
      .put('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ recipients: ['only@example.com'] });
    expect(replaced.body.recipients).toEqual(['only@example.com']);

    const stillThere = await request(app)
      .get('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`);
    expect(stillThere.body.sent).toHaveLength(1);
  });

  test('does not record an email that was not sent', async () => {
    await request(app)
      .put('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ recipients: ['office@example.com'] });
    sendBidAlert.mockResolvedValue({ sent: false, reason: 'send-failed', error: 'connection refused' });

    const res = await request(app).post('/api/customer-bid').send(heroBid);
    expect(res.status).toBe(201);
    await waitForAlert();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const listed = await request(app)
      .get('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`);
    expect(listed.body.sent).toEqual([]);
  });

  test('deletes only the selected sent emails and leaves the customer', async () => {
    await request(app)
      .put('/api/settings/bid-alerts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ recipients: ['office@example.com'] });
    sendBidAlert.mockResolvedValue({
      sent: true,
      recipients: ['office@example.com'],
    });

    const denied = await request(app)
      .delete('/api/settings/bid-alerts/sent')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ ids: ['507f1f77bcf86cd799439011'] });
    expect(denied.status).toBe(403);

    const empty = await request(app)
      .delete('/api/settings/bid-alerts/sent')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ids: [] });
    expect(empty.status).toBe(400);

    await request(app).post('/api/customer-bid').send(heroBid);
    await waitForAlert(1);
    await request(app).post('/api/customer-bid').send({
      ...heroBid,
      projectName: 'Gate repair',
      projectDescription: 'Replace the latch',
    });
    await waitForAlert(2);

    const listed = await waitForSentCount(2);
    const drop = listed.body.sent.find((item) => item.projectName === 'Gate repair');
    const keep = listed.body.sent.find((item) => item.projectName === 'Camera install');

    const deleted = await request(app)
      .delete('/api/settings/bid-alerts/sent')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ids: [drop.id] });

    expect(deleted.status).toBe(200);
    expect(deleted.body.sent.map((item) => item.id)).toEqual([keep.id]);

    const Customer = mongoose.model('Customer');
    expect(await Customer.countDocuments({ email: 'jane@example.com' })).toBe(1);
  });

  test('still saves the bid when no alert addresses are configured', async () => {
    sendBidAlert.mockClear();
    const res = await request(app).post('/api/customer-bid').send(heroBid);
    expect(res.status).toBe(201);
    await waitForAlert();
    expect(sendBidAlert).toHaveBeenCalledWith(
      expect.objectContaining({ recipients: [], bid: expect.objectContaining({ email: 'jane@example.com' }) })
    );
  });
});
