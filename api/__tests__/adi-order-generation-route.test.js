/**
 * ADI Supplier API Route - Phase 3 Order Generation wiring
 *
 * Verifies the backend route delegates to the ADI order helper with
 * authenticated access and environment-backed credentials.
 */

import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

jest.mock('../suppliers/adiOrderGeneration.js', () => ({
  fetchAdiOrderGeneration: jest.fn(),
}));

import { fetchAdiOrderGeneration } from '../suppliers/adiOrderGeneration.js';

jest.setTimeout(30000);

process.env.JWT_SECRET = 'adi-order-route-test-secret';
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
    username: 'adi-order-route-admin',
    email: 'adi-order-route-admin@example.com',
    password: 'password123',
  });

  const User = mongoose.model('User');
  const testUser = await User.findOne({ username: 'adi-order-route-admin' });
  if (testUser && testUser.status !== 'approved') {
    testUser.status = 'approved';
    await testUser.save();
  }

  const loginResponse = await request(app).post('/api/login').send({
    username: 'adi-order-route-admin',
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

describe('POST /api/suppliers/adi/order-generation', () => {
  test('returns ADI order response for an authenticated request', async () => {
    fetchAdiOrderGeneration.mockResolvedValue({
      ReturnCode: '00',
      ReturnMessage: 'Order 1234567890 created successfully',
    });

    const response = await request(app)
      .post('/api/suppliers/adi/order-generation')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customerNumber: 'CUST001',
        customerSuffix: '000',
        poNumber: 'PO-12345',
        shipmentPickupIndicator: 'P',
        orderList: [{ ItemNumber: '12345', Quantity: 2, ItemPrice: 19.99 }],
      });

    expect(response.status).toBe(200);
    expect(response.body.ReturnCode).toBe('00');
    expect(fetchAdiOrderGeneration).toHaveBeenCalledWith({
      credentials: {
        apiKey: 'API00483',
        apiPassword: 'f2c46d810212477c',
        apiSecretKey: 'OTUzMWRlZThhZjM0MDlhZA==',
      },
      customerNumber: 'CUST001',
      customerSuffix: '000',
      poNumber: 'PO-12345',
      referenceNumber: undefined,
      shipmentPickupIndicator: 'P',
      shipmentComplete: undefined,
      shipmentCarrier: undefined,
      shipmentMethod: undefined,
      pickupDC: undefined,
      promoCode: undefined,
      promoCodeType: undefined,
      emailAddress: undefined,
      dropShipmentName: undefined,
      dropShipmentAddress1: undefined,
      dropShipmentAddress2: undefined,
      dropShipmentAddress3: undefined,
      dropShipmentCity: undefined,
      dropShipmentStateProvince: undefined,
      dropShipmentZipcode: undefined,
      dropShipmentCountryCode: undefined,
      orderList: [{ ItemNumber: '12345', Quantity: 2, ItemPrice: 19.99 }],
    });

    const forwardedArgs = fetchAdiOrderGeneration.mock.calls[0][0];
    expect(forwardedArgs).not.toHaveProperty('clientRequestId');
    expect(forwardedArgs).not.toHaveProperty('timestamp');
  });

  test('returns 400 when ADI order request validation fails', async () => {
    fetchAdiOrderGeneration.mockRejectedValue(new Error('poNumber is required'));

    const response = await request(app)
      .post('/api/suppliers/adi/order-generation')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customerNumber: 'CUST001',
        customerSuffix: '000',
        shipmentPickupIndicator: 'P',
        orderList: [{ ItemNumber: '12345', Quantity: 2, ItemPrice: 19.99 }],
      });

    expect(response.status).toBe(400);
    expect(response.body.msg).toBe('poNumber is required');
  });
});
