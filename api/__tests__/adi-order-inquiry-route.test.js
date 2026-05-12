/**
 * ADI Supplier API Route - Phase 4 Order Inquiry wiring
 *
 * Verifies backend route delegates to ADI inquiry helper with
 * authenticated access and environment-backed credentials.
 */

import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

jest.mock('../suppliers/adiOrderInquiry.js', () => ({
  fetchAdiOrderInquiry: jest.fn(),
}));

import { fetchAdiOrderInquiry } from '../suppliers/adiOrderInquiry.js';

jest.setTimeout(30000);

process.env.JWT_SECRET = 'adi-inquiry-route-test-secret';
process.env.VERCEL = '1';
process.env.ADI_API_KEY = 'API00483';
process.env.ADI_API_PASSWORD = 'f2c46d810212477c';
process.env.ADI_API_SECRET_KEY = 'OTUzMWRlZThhZjM0MDlhZA==';

const originalMongoUri = process.env.MONGO_URI;
const originalMongoDatabase = process.env.MONGO_DATABASE;
const originalMongoDbName = process.env.MONGO_DB_NAME;

let app;
let mongoServer;
let authToken;

beforeAll(async () => {
  delete process.env.MONGO_DATABASE;
  delete process.env.MONGO_DB_NAME;

  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  process.env.MONGO_URI = mongoUri;

  await mongoose.disconnect();
  await mongoose.connect(mongoUri);

  const appModule = await import('../index.js');
  app = appModule.default;

  await request(app).post('/api/register').send({
    username: 'adi-inquiry-route-admin',
    email: 'adi-inquiry-route-admin@example.com',
    password: 'password123',
  });

  const User = mongoose.model('User');
  const testUser = await User.findOne({ username: 'adi-inquiry-route-admin' });
  if (testUser && testUser.status !== 'approved') {
    testUser.status = 'approved';
    await testUser.save();
  }

  const loginResponse = await request(app).post('/api/login').send({
    username: 'adi-inquiry-route-admin',
    password: 'password123',
  });

  authToken = loginResponse.body.token;
});

afterEach(async () => {
  jest.clearAllMocks();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
  if (originalMongoUri) {
    process.env.MONGO_URI = originalMongoUri;
  } else {
    delete process.env.MONGO_URI;
  }
  if (originalMongoDatabase) {
    process.env.MONGO_DATABASE = originalMongoDatabase;
  } else {
    delete process.env.MONGO_DATABASE;
  }
  if (originalMongoDbName) {
    process.env.MONGO_DB_NAME = originalMongoDbName;
  } else {
    delete process.env.MONGO_DB_NAME;
  }
});

describe('POST /api/suppliers/adi/order-inquiry', () => {
  test('returns ADI inquiry response for an authenticated request', async () => {
    fetchAdiOrderInquiry.mockResolvedValue({
      CustomerNumber: 'CUST001',
      CustomerSuffix: '000',
      ADIOrderNumber: '1234567890',
      ReturnCode: '00',
      ReturnMessage: '',
      OrderLineHead: {},
    });

    const response = await request(app)
      .post('/api/suppliers/adi/order-inquiry')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customerNumber: 'CUST001',
        customerSuffix: '000',
        adiOrderNumber: '1234567890',
      });

    expect(response.status).toBe(200);
    expect(response.body.ReturnCode).toBe('00');
    expect(fetchAdiOrderInquiry).toHaveBeenCalledWith({
      credentials: {
        apiKey: 'API00483',
        apiPassword: 'f2c46d810212477c',
        apiSecretKey: 'OTUzMWRlZThhZjM0MDlhZA==',
      },
      customerNumber: 'CUST001',
      customerSuffix: '000',
      adiOrderNumber: '1234567890',
    });

    const forwardedArgs = fetchAdiOrderInquiry.mock.calls[0][0];
    expect(forwardedArgs).not.toHaveProperty('clientRequestId');
    expect(forwardedArgs).not.toHaveProperty('timestamp');
  });

  test('returns 400 when ADI inquiry request validation fails', async () => {
    fetchAdiOrderInquiry.mockRejectedValue(new Error('adiOrderNumber is required'));

    const response = await request(app)
      .post('/api/suppliers/adi/order-inquiry')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customerNumber: 'CUST001',
        customerSuffix: '000',
      });

    expect(response.status).toBe(400);
    expect(response.body.msg).toBe('adiOrderNumber is required');
  });
});
