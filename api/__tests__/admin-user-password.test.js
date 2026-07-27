/**
 * Admin user password reset: PUT /api/admin/users/:id/password
 */

import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret-key-for-admin-password';
process.env.VERCEL = '1';

const originalMongoUri = process.env.MONGO_URI;

let mongoServer;
let app;
let User;

const createUser = async (overrides = {}) => {
  const hashed = await bcrypt.hash(overrides.password || 'password123', 10);
  const user = new User({
    username: overrides.username || `user_${Date.now()}`,
    email: overrides.email || `user_${Date.now()}@example.com`,
    password: hashed,
    role: overrides.role || 'admin',
    status: overrides.status || 'approved',
    ...overrides,
    password: hashed,
  });
  await user.save();
  return user;
};

const authHeader = (user) => ({
  Authorization: `Bearer ${jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' })}`,
});

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  process.env.MONGO_URI = mongoUri;
  await mongoose.disconnect();
  await mongoose.connect(mongoUri);

  const appModule = await import('../../server/app.js');
  app = appModule.default;
  User = mongoose.model('User');

  // Warm up app DB connection before creating users directly via Mongoose
  await request(app).get('/api/health');
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  if (originalMongoUri) process.env.MONGO_URI = originalMongoUri;
  else delete process.env.MONGO_URI;
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('PUT /api/admin/users/:id/password', () => {
  test('admin can reset another user password', async () => {
    const admin = await createUser({ username: 'admin1', email: 'admin1@example.com', role: 'admin' });
    const target = await createUser({ username: 'target', email: 'target@example.com', role: 'admin' });

    const response = await request(app)
      .put(`/api/admin/users/${target._id}/password`)
      .set(authHeader(admin))
      .send({ newPassword: 'newpass456' });

    expect(response.status).toBe(200);
    expect(response.body.msg).toMatch(/password.*updated/i);

    const updated = await User.findById(target._id);
    const matches = await bcrypt.compare('newpass456', updated.password);
    expect(matches).toBe(true);
  });

  test('super-admin can reset user password', async () => {
    const superAdmin = await createUser({ username: 'super1', email: 'super1@example.com', role: 'super-admin' });
    const target = await createUser({ username: 'user2', email: 'user2@example.com', role: 'customer' });

    const response = await request(app)
      .put(`/api/admin/users/${target._id}/password`)
      .set(authHeader(superAdmin))
      .send({ newPassword: 'customer99' });

    expect(response.status).toBe(200);
  });

  test('rejects password shorter than 6 characters', async () => {
    const admin = await createUser({ username: 'admin2', email: 'admin2@example.com', role: 'admin' });
    const target = await createUser({ username: 'user3', email: 'user3@example.com' });

    const response = await request(app)
      .put(`/api/admin/users/${target._id}/password`)
      .set(authHeader(admin))
      .send({ newPassword: '12345' });

    expect(response.status).toBe(400);
    expect(response.body.msg).toBe('Password must be at least 6 characters');
  });

  test('rejects missing newPassword', async () => {
    const admin = await createUser({ username: 'admin3', email: 'admin3@example.com', role: 'admin' });
    const target = await createUser({ username: 'user4', email: 'user4@example.com' });

    const response = await request(app)
      .put(`/api/admin/users/${target._id}/password`)
      .set(authHeader(admin))
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.msg).toBe('New password is required');
  });

  test('returns 404 for non-existent user', async () => {
    const admin = await createUser({ username: 'admin4', email: 'admin4@example.com', role: 'admin' });
    const fakeId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .put(`/api/admin/users/${fakeId}/password`)
      .set(authHeader(admin))
      .send({ newPassword: 'newpass789' });

    expect(response.status).toBe(404);
    expect(response.body.msg).toBe('User not found');
  });

  test('rejects non-admin users', async () => {
    const customer = await createUser({ username: 'cust1', email: 'cust1@example.com', role: 'customer' });
    const target = await createUser({ username: 'user5', email: 'user5@example.com' });

    const response = await request(app)
      .put(`/api/admin/users/${target._id}/password`)
      .set(authHeader(customer))
      .send({ newPassword: 'newpass789' });

    expect(response.status).toBe(403);
  });

  test('rejects unauthenticated requests', async () => {
    const target = await createUser({ username: 'user6', email: 'user6@example.com' });

    const response = await request(app)
      .put(`/api/admin/users/${target._id}/password`)
      .send({ newPassword: 'newpass789' });

    expect(response.status).toBe(401);
  });
});
