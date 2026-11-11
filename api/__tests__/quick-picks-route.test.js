/**
 * Company-wide quick picks. Saving the same SKU updates that part
 * instead of adding a second copy.
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
    username: 'pickuser',
    email: 'pick@example.com',
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
      username: 'pickuser',
      email: 'pick@example.com',
      password: 'hashedpassword',
      role: 'admin',
      status: 'approved',
    });
  }
});

afterEach(async () => {
  const currentUri = mongoose.connection.client?.s?.url || process.env.MONGO_URI || '';
  assertInMemoryMongoUri(currentUri);
  if (mongoose.connection.collections.quickpicks) {
    await mongoose.connection.collections.quickpicks.deleteMany({});
  }
});

describe('quick pick routes', () => {
  test('requires a signed-in user', async () => {
    const res = await request(app).get('/api/quick-picks');
    expect(res.status).toBe(401);
  });

  test('saves a part, updates it when the SKU is entered again, and removes it', async () => {
    const created = await request(app)
      .post('/api/quick-picks')
      .set(auth())
      .send({ description: 'Door contact', sku: 'DC-1', price: 32.5, paid: 13.92 });
    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({
      description: 'Door contact',
      sku: 'DC-1',
      price: 32.5,
      paid: 13.92,
    }));

    const updated = await request(app)
      .post('/api/quick-picks')
      .set(auth())
      .send({ description: 'Recessed contact', sku: 'dc-1', price: 36, paid: '' });
    expect(updated.status).toBe(200);
    expect(updated.body).toEqual(expect.objectContaining({
      _id: created.body._id,
      description: 'Recessed contact',
      sku: 'DC-1',
      price: 36,
      paid: null,
    }));

    const listed = await request(app).get('/api/quick-picks').set(auth());
    expect(listed.status).toBe(200);
    expect(listed.body.quickPicks).toHaveLength(1);
    expect(listed.body.quickPicks[0].description).toBe('Recessed contact');

    const removed = await request(app).delete(`/api/quick-picks/${created.body._id}`).set(auth());
    expect(removed.status).toBe(200);

    const empty = await request(app).get('/api/quick-picks').set(auth());
    expect(empty.body.quickPicks).toEqual([]);
  });

  test('rejects a part with no description and no SKU', async () => {
    const res = await request(app)
      .post('/api/quick-picks')
      .set(auth())
      .send({ description: ' ', price: 10 });
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/description or SKU/i);
  });
});
