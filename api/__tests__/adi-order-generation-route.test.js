/**
 * ADI Supplier API Route - Phase 3 Order Generation wiring
 *
 * Verifies the backend route delegates to the ADI order helper with
 * authenticated access and environment-backed credentials.
 */

import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

jest.mock('../../server/lib/suppliers/adiOrderGeneration.js', () => {
  const actual = jest.requireActual('../../server/lib/suppliers/adiOrderGeneration.js');
  return {
    ...actual,
    fetchAdiOrderGeneration: jest.fn(),
  };
});

import { fetchAdiOrderGeneration } from '../../server/lib/suppliers/adiOrderGeneration.js';

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

  const appModule = await import('../../server/app.js');
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
      clientRequestId: expect.any(String),
    });

    const forwardedArgs = fetchAdiOrderGeneration.mock.calls[0][0];
    expect(forwardedArgs.clientRequestId).toEqual(expect.any(String));
    expect(forwardedArgs.clientRequestId.length).toBeGreaterThan(0);
    expect(forwardedArgs).not.toHaveProperty('timestamp');
  });

  test('logs the PO, customer, request id, and ADI reply without credentials', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    fetchAdiOrderGeneration.mockResolvedValue({
      ReturnCode: '01',
      ReturnMessage: 'Country code is invalid',
    });

    const response = await request(app)
      .post('/api/suppliers/adi/order-generation')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customerNumber: 'CUST001',
        customerSuffix: '000',
        poNumber: 'PO-2026-0004',
        clientRequestId: 'req-18064078',
        shipmentPickupIndicator: 'S',
        orderList: [{ ItemNumber: 'LA-ADCV730', Quantity: 3, ItemPrice: 201.56 }],
      });

    expect(response.status).toBe(200);
    expect(fetchAdiOrderGeneration.mock.calls[0][0].clientRequestId).toBe('req-18064078');

    const line = log.mock.calls
      .map((call) => call.map(String).join(' '))
      .find((entry) => entry.includes('[ADI GenerateOrder]'));
    expect(line).toContain('po=PO-2026-0004');
    expect(line).toContain('customer=CUST001');
    expect(line).toContain('requestId=req-18064078');
    expect(line).toContain('returnCode=01');
    expect(line).toContain('returnMessage=Country code is invalid');
    expect(line).not.toContain(process.env.ADI_API_KEY);
    expect(line).not.toContain(process.env.ADI_API_PASSWORD);
    expect(line).not.toContain(process.env.ADI_API_SECRET_KEY);
    log.mockRestore();
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
