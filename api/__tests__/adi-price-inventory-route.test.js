/**
 * ADI Supplier API Route - Phase 2 Price & Inventory wiring
 *
 * Verifies the backend route delegates to the ADI client helper with
 * authenticated access and environment-backed credentials.
 */

import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

jest.mock('../suppliers/adiPriceInventory.js', () => ({
  fetchAdiPriceAndInventoryDetails: jest.fn(),
}));

import { fetchAdiPriceAndInventoryDetails } from '../suppliers/adiPriceInventory.js';

jest.setTimeout(30000);

process.env.JWT_SECRET = 'adi-route-test-secret';
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
    username: 'adi-route-admin',
    email: 'adi-route-admin@example.com',
    password: 'password123',
  });

  const User = mongoose.model('User');
  const testUser = await User.findOne({ username: 'adi-route-admin' });
  if (testUser && testUser.status !== 'approved') {
    testUser.status = 'approved';
    await testUser.save();
  }

  const loginResponse = await request(app).post('/api/login').send({
    username: 'adi-route-admin',
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

describe('POST /api/suppliers/adi/price-inventory', () => {
  test('returns ADI response for an authenticated request', async () => {
    fetchAdiPriceAndInventoryDetails.mockResolvedValue({
      CustomerNumber: 'CUST001',
      CustomerSuffix: '000',
      ReturnCode: '00',
      ReturnMessage: '',
      ItemList: [],
    });

    const response = await request(app)
      .post('/api/suppliers/adi/price-inventory')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customerNumber: 'CUST001',
        customerSuffix: '000',
        itemList: [{ ItemNumber: '12345', Quantity: 2 }],
        clientRequestId: 'e95d18b5-5dae-4b52-9109-6fe0a81e0018',
        timestamp: 4293512740888,
      });

    expect(response.status).toBe(200);
    expect(response.body.ReturnCode).toBe('00');

    expect(fetchAdiPriceAndInventoryDetails).toHaveBeenCalledWith({
      credentials: {
        apiKey: 'API00483',
        apiPassword: 'f2c46d810212477c',
        apiSecretKey: 'OTUzMWRlZThhZjM0MDlhZA==',
      },
      customerNumber: 'CUST001',
      customerSuffix: '000',
      itemList: [{ ItemNumber: '12345', Quantity: 2 }],
      clientRequestId: 'e95d18b5-5dae-4b52-9109-6fe0a81e0018',
      timestamp: 4293512740888,
    });
  });

  test('returns 400 when ADI request validation fails', async () => {
    fetchAdiPriceAndInventoryDetails.mockRejectedValue(new Error('customerNumber is required'));

    const response = await request(app)
      .post('/api/suppliers/adi/price-inventory')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customerNumber: '',
        customerSuffix: '000',
        itemList: [{ ItemNumber: '12345', Quantity: 2 }],
      });

    expect(response.status).toBe(400);
    expect(response.body.msg).toBe('customerNumber is required');

    const forwardedArgs = fetchAdiPriceAndInventoryDetails.mock.calls[0][0];
    expect(forwardedArgs).not.toHaveProperty('clientRequestId');
    expect(forwardedArgs).not.toHaveProperty('timestamp');
  });
});
