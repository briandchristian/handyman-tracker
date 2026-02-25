/**
 * TDD: Customer Support (Phase 1) and Customer My Info (Phase 2)
 * - POST /api/customer/register (customer register, same data as request a bid + password)
 * - Customer login via existing /api/login (returns role so frontend can redirect)
 * - GET /api/customer/me (customer only; returns Customer + profile)
 * - PUT /api/customer/me (customer only; updates only profile, does not change Customer)
 * - Admin-only routes (e.g. GET /api/customers) reject customer role
 */

import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret-key-for-auth';
process.env.VERCEL = '1';

const originalMongoUri = process.env.MONGO_URI;
let mongoServer;
let app;

beforeAll(async () => {
  if (originalMongoUri && (
    originalMongoUri.includes('mongodb.net') ||
    originalMongoUri.includes('mongodb+srv://') ||
    (!originalMongoUri.includes('localhost') && !originalMongoUri.includes('127.0.0.1'))
  )) {
    console.warn('⚠️  WARNING: Original MONGO_URI may be production');
  }
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  process.env.MONGO_URI = mongoUri;
  await mongoose.disconnect();
  await mongoose.connect(mongoUri);
  const appModule = await import('../index.js');
  app = appModule.default;
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  if (originalMongoUri) process.env.MONGO_URI = originalMongoUri;
  else delete process.env.MONGO_URI;
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) await collections[key].deleteMany({});
});

describe('POST /api/customer/register', () => {
  test('should create Customer in DB and User with role customer, return token', async () => {
    const body = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '555-123-4567',
      address: '123 Main St',
      projectName: 'Kitchen Remodel',
      projectDescription: 'New cabinets and countertops',
      password: 'secret123'
    };
    const res = await request(app).post('/api/customer/register').send(body);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({ role: 'customer', email: 'jane@example.com' });
    expect(res.body.user).toHaveProperty('customerId');

    const Customer = mongoose.model('Customer');
    const User = mongoose.model('User');
    const customer = await Customer.findOne({ email: 'jane@example.com' });
    const user = await User.findOne({ email: 'jane@example.com' });
    expect(customer).toBeTruthy();
    expect(customer.name).toBe('Jane Doe');
    expect(customer.projects).toHaveLength(1);
    expect(customer.projects[0].name).toBe('Kitchen Remodel');
    expect(user).toBeTruthy();
    expect(user.role).toBe('customer');
    expect(user.status).toBe('approved');
    expect(user.customerId.toString()).toBe(customer._id.toString());
  });

  test('should reject missing required fields (name, email, phone, password)', async () => {
    const res = await request(app).post('/api/customer/register').send({
      email: 'a@b.com',
      phone: '555-0000',
      password: 'pass123'
    });
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/name|required/i);
  });

  test('should reject duplicate email (customer already has account)', async () => {
    const body = {
      name: 'First',
      email: 'dup@example.com',
      phone: '555-1111',
      password: 'pass123'
    };
    await request(app).post('/api/customer/register').send(body);
    const res = await request(app).post('/api/customer/register').send({
      ...body,
      name: 'Second'
    });
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/already|exists/i);
  });

  test('should allow registration without project (optional)', async () => {
    const res = await request(app).post('/api/customer/register').send({
      name: 'No Project',
      email: 'noproj@example.com',
      phone: '555-9999',
      address: '456 Oak',
      password: 'pass123'
    });
    expect(res.status).toBe(201);
    const Customer = mongoose.model('Customer');
    const customer = await Customer.findOne({ email: 'noproj@example.com' });
    expect(customer.projects).toEqual([]);
  });

  test('should update existing customer name, phone, address when registering with same email', async () => {
    const Customer = mongoose.model('Customer');
    await Customer.create({
      name: 'Old Name',
      email: 'update@example.com',
      phone: '555-OLD',
      address: 'Old Address',
      projects: []
    });
    const res = await request(app).post('/api/customer/register').send({
      name: 'New Name',
      email: 'update@example.com',
      phone: '555-NEW',
      address: 'New Address',
      password: 'pass123'
    });
    expect(res.status).toBe(201);
    const customer = await Customer.findOne({ email: 'update@example.com' });
    expect(customer.name).toBe('New Name');
    expect(customer.phone).toBe('555-NEW');
    expect(customer.address).toBe('New Address');
  });
});

describe('Customer login via POST /api/login', () => {
  test('should return role customer when customer logs in', async () => {
    const Customer = mongoose.model('Customer');
    const User = mongoose.model('User');
    const customer = await Customer.create({
      name: 'Login Test',
      email: 'logincust@example.com',
      phone: '555-0000',
      address: '',
      projects: []
    });
    const hashed = await bcrypt.hash('mypass', 10);
    await User.create({
      username: 'logincust@example.com',
      email: 'logincust@example.com',
      password: hashed,
      role: 'customer',
      status: 'approved',
      customerId: customer._id
    });
    const res = await request(app).post('/api/login').send({
      username: 'logincust@example.com',
      password: 'mypass'
    });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('customer');
    expect(res.body).toHaveProperty('token');
  });
});

describe('GET /api/customer/me', () => {
  test('should return 401 without token', async () => {
    const res = await request(app).get('/api/customer/me');
    expect(res.status).toBe(401);
  });

  test('should return 403 for admin user (not customer)', async () => {
    const User = mongoose.model('User');
    const hashed = await bcrypt.hash('adminpass', 10);
    const user = await User.create({
      username: 'adminuser',
      email: 'admin@example.com',
      password: hashed,
      role: 'admin',
      status: 'approved'
    });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    const res = await request(app)
      .get('/api/customer/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('should return customer record and profile for customer', async () => {
    const Customer = mongoose.model('Customer');
    const User = mongoose.model('User');
    const customer = await Customer.create({
      name: 'Me Test',
      email: 'me@example.com',
      phone: '555-1111',
      address: 'Original Address',
      projects: [{ name: 'P1', description: 'D1', status: 'Pending', createdAt: new Date() }]
    });
    const hashed = await bcrypt.hash('pass', 10);
    const user = await User.create({
      username: 'me@example.com',
      email: 'me@example.com',
      password: hashed,
      role: 'customer',
      status: 'approved',
      customerId: customer._id,
      customerProfile: { phone: '555-9999', address: 'Preferred Addr' }
    });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    const res = await request(app)
      .get('/api/customer/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.customer.name).toBe('Me Test');
    expect(res.body.customer.email).toBe('me@example.com');
    expect(res.body.profile).toEqual({ phone: '555-9999', address: 'Preferred Addr' });
  });
});

describe('PUT /api/customer/me', () => {
  test('should update only profile (phone, address), not Customer', async () => {
    const Customer = mongoose.model('Customer');
    const User = mongoose.model('User');
    const customer = await Customer.create({
      name: 'Put Test',
      email: 'put@example.com',
      phone: '555-0000',
      address: 'Admin Set Address',
      projects: []
    });
    const hashed = await bcrypt.hash('pass', 10);
    const user = await User.create({
      username: 'put@example.com',
      email: 'put@example.com',
      password: hashed,
      role: 'customer',
      status: 'approved',
      customerId: customer._id
    });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    const res = await request(app)
      .put('/api/customer/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '555-NEW-NUM', address: 'My Preferred Addr' });
    expect(res.status).toBe(200);
    expect(res.body.profile.phone).toBe('555-NEW-NUM');
    expect(res.body.profile.address).toBe('My Preferred Addr');

    const customerAfter = await Customer.findById(customer._id);
    expect(customerAfter.phone).toBe('555-0000');
    expect(customerAfter.address).toBe('Admin Set Address');
  });

  test('should return 403 for non-customer', async () => {
    const User = mongoose.model('User');
    const hashed = await bcrypt.hash('p', 10);
    const user = await User.create({
      username: 'admin2',
      email: 'admin2@example.com',
      password: hashed,
      role: 'admin',
      status: 'approved'
    });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    const res = await request(app)
      .put('/api/customer/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '555-0000' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/customer/me/bid', () => {
  test('should require authentication', async () => {
    const res = await request(app)
      .post('/api/customer/me/bid')
      .send({ projectName: 'P', projectDescription: 'D' });
    expect(res.status).toBe(401);
  });

  test('should reject non-customer (admin)', async () => {
    const User = mongoose.model('User');
    const hashed = await bcrypt.hash('admin', 10);
    const user = await User.create({
      username: 'adminbid',
      email: 'adminbid@example.com',
      password: hashed,
      role: 'admin',
      status: 'approved'
    });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    const res = await request(app)
      .post('/api/customer/me/bid')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectName: 'P', projectDescription: 'D' });
    expect(res.status).toBe(403);
  });

  test('should add project for logged-in customer', async () => {
    const Customer = mongoose.model('Customer');
    const User = mongoose.model('User');
    const customer = await Customer.create({
      name: 'Bid Customer',
      email: 'bidcust@example.com',
      phone: '555-1111',
      projects: []
    });
    const hashed = await bcrypt.hash('pass', 10);
    const user = await User.create({
      username: 'bidcust@example.com',
      email: 'bidcust@example.com',
      password: hashed,
      role: 'customer',
      status: 'approved',
      customerId: customer._id
    });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    const res = await request(app)
      .post('/api/customer/me/bid')
      .set('Authorization', `Bearer ${token}`)
      .send({
        projectName: 'New Deck',
        projectDescription: 'Build a 10x12 deck'
      });
    expect(res.status).toBe(201);
    expect(res.body.msg).toMatch(/submitted|contact/i);
    expect(res.body.customer.name).toBe('Bid Customer');
    expect(res.body.customer.email).toBe('bidcust@example.com');
    const updated = await Customer.findById(customer._id);
    expect(updated.projects).toHaveLength(1);
    expect(updated.projects[0].name).toBe('New Deck');
    expect(updated.projects[0].description).toBe('Build a 10x12 deck');
    expect(updated.projects[0].status).toBe('Pending');
  });

  test('should reject missing project name or description', async () => {
    const Customer = mongoose.model('Customer');
    const User = mongoose.model('User');
    const customer = await Customer.create({
      name: 'C2',
      email: 'c2@example.com',
      projects: []
    });
    const hashed = await bcrypt.hash('p', 10);
    const user = await User.create({
      username: 'c2@example.com',
      email: 'c2@example.com',
      password: hashed,
      role: 'customer',
      status: 'approved',
      customerId: customer._id
    });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    const resEmpty = await request(app)
      .post('/api/customer/me/bid')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectName: '', projectDescription: 'D' });
    expect(resEmpty.status).toBe(400);
    const resMissing = await request(app)
      .post('/api/customer/me/bid')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(resMissing.status).toBe(400);
  });
});

describe('Admin-only routes reject customer', () => {
  test('GET /api/customers returns 403 for customer role', async () => {
    const Customer = mongoose.model('Customer');
    const User = mongoose.model('User');
    const customer = await Customer.create({
      name: 'C',
      email: 'c@example.com',
      phone: '555',
      address: '',
      projects: []
    });
    const hashed = await bcrypt.hash('p', 10);
    const user = await User.create({
      username: 'c@example.com',
      email: 'c@example.com',
      password: hashed,
      role: 'customer',
      status: 'approved',
      customerId: customer._id
    });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.msg).toMatch(/Admin|denied/i);
  });
});
