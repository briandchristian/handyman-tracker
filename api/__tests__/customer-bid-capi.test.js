/**
 * Integration tests: POST /api/customer-bid fires a server-side Meta
 * Conversions API `Lead` event.
 *
 * Guarantees covered here:
 *  - With no `META_CAPI_ACCESS_TOKEN` configured the feature silently no-ops:
 *    no network call is attempted and the bid is still stored and acknowledged.
 *    (Brian has not generated a CAPI token yet, so this is the default state.)
 *  - With a token configured, the outgoing payload carries SHA-256 hashed email
 *    and phone. Raw PII must never leave the server.
 *  - A CAPI failure — thrown synchronously, rejected asynchronously, or a
 *    non-2xx response — must never break or delay the bid submission.
 *
 * `sendMetaLeadEvent` is wrapped (not replaced) so the real hashing logic runs
 * end-to-end through the route, while individual tests can still force failures.
 */

import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { assertInMemoryMongoUri } from '../../server/lib/mongoTestSafety.js';

jest.mock('../../server/lib/metaCapi.js', () => {
  const actual = jest.requireActual('../../server/lib/metaCapi.js');
  return {
    ...actual,
    sendMetaLeadEvent: jest.fn((...args) => actual.sendMetaLeadEvent(...args)),
  };
});

import { sendMetaLeadEvent } from '../../server/lib/metaCapi.js';

// Used to restore the real implementation between tests, since tests that force
// failures via mockImplementation/mockRejectedValue would otherwise leak.
const actualMetaCapi = jest.requireActual('../../server/lib/metaCapi.js');

jest.setTimeout(30000);

process.env.JWT_SECRET = 'capi-test-secret';
process.env.VERCEL = '1';

// Known SHA-256 digests of the normalized values, used to prove the route
// hashes rather than transmits.
const SHA256_BIDDER_EMAIL =
  '855f96e983f1f8e8be944692b6f719fd54329826cb62e98015efee8e2e071dd4'; // john@example.com
const SHA256_BIDDER_PHONE =
  '37aa61cf93eafdbe2a31163b441853f9ed1e099a8d711ffa93e8065324bc4c53'; // 9312797879

const originalMongoUri = process.env.MONGO_URI;
const originalToken = process.env.META_CAPI_ACCESS_TOKEN;
const originalPixelId = process.env.META_PIXEL_ID;
const originalFetch = global.fetch;

let mongoServer;
let app;

/**
 * Let the route's fire-and-forget CAPI call reach its first await. Uses
 * setTimeout rather than setImmediate, which the jsdom test environment
 * does not provide.
 */
const flushPendingCapiCall = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

const submitBid = (overrides = {}) =>
  request(app)
    .post('/api/customer-bid')
    .send({
      name: 'John Doe',
      email: 'john@example.com',
      phone: '(931) 279-7879',
      address: '1 Main St',
      projectName: 'Alarm install',
      projectDescription: 'Burglar alarm for a new build',
      ...overrides,
    });

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
  global.fetch = originalFetch;
});

beforeEach(() => {
  jest.clearAllMocks();
  sendMetaLeadEvent.mockImplementation((...args) =>
    actualMetaCapi.sendMetaLeadEvent(...args)
  );
  delete process.env.META_CAPI_ACCESS_TOKEN;
  delete process.env.META_PIXEL_ID;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
});

afterEach(async () => {
  assertInMemoryMongoUri(mongoose.connection.client?.s?.url || '');
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }

  if (originalToken !== undefined) {
    process.env.META_CAPI_ACCESS_TOKEN = originalToken;
  } else {
    delete process.env.META_CAPI_ACCESS_TOKEN;
  }
  if (originalPixelId !== undefined) {
    process.env.META_PIXEL_ID = originalPixelId;
  } else {
    delete process.env.META_PIXEL_ID;
  }
});

describe('POST /api/customer-bid — Meta CAPI disabled (no access token)', () => {
  test('stores the bid and returns success without attempting a network call', async () => {
    const response = await submitBid();
    await flushPendingCapiCall();

    expect(response.status).toBe(201);
    expect(response.body.msg).toMatch(/submitted successfully/i);
    expect(global.fetch).not.toHaveBeenCalled();

    const Customer = mongoose.model('Customer');
    const saved = await Customer.findOne({ email: 'john@example.com' });
    expect(saved).toBeTruthy();
    expect(saved.projects).toHaveLength(1);
  });

  test('resolves the CAPI helper as disabled rather than erroring', async () => {
    await submitBid();
    await flushPendingCapiCall();

    expect(sendMetaLeadEvent).toHaveBeenCalledTimes(1);
    await expect(sendMetaLeadEvent.mock.results[0].value).resolves.toEqual({
      sent: false,
      reason: 'disabled',
    });
  });

  test('does not attempt a CAPI call when validation rejects the bid', async () => {
    const response = await submitBid({ email: '' });
    await flushPendingCapiCall();

    expect(response.status).toBe(400);
    expect(sendMetaLeadEvent).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('POST /api/customer-bid — Meta CAPI enabled', () => {
  beforeEach(() => {
    process.env.META_CAPI_ACCESS_TOKEN = 'test-capi-token';
    process.env.META_PIXEL_ID = '1415642066441121';
  });

  test('sends a Lead event with SHA-256 hashed email and phone', async () => {
    const response = await submitBid();
    await flushPendingCapiCall();

    expect(response.status).toBe(201);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('1415642066441121');

    const body = JSON.parse(options.body);
    expect(body.access_token).toBe('test-capi-token');
    expect(body.data[0].event_name).toBe('Lead');
    expect(body.data[0].user_data.em).toEqual([SHA256_BIDDER_EMAIL]);
    expect(body.data[0].user_data.ph).toEqual([SHA256_BIDDER_PHONE]);
  });

  test('never transmits raw email or phone', async () => {
    await submitBid();
    await flushPendingCapiCall();

    const rawBody = global.fetch.mock.calls[0][1].body;
    expect(rawBody).not.toContain('john@example.com');
    expect(rawBody).not.toContain('9312797879');
    expect(rawBody).not.toContain('931) 279-7879');
  });

  test('normalizes a mixed-case email before hashing', async () => {
    await submitBid({ email: '  John@Example.COM  ' });
    await flushPendingCapiCall();

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.data[0].user_data.em).toEqual([SHA256_BIDDER_EMAIL]);
  });

  test('still succeeds when the CAPI response is a non-2xx error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal error',
    });

    const response = await submitBid();
    await flushPendingCapiCall();

    expect(response.status).toBe(201);
    expect(response.body.msg).toMatch(/submitted successfully/i);
  });
});

describe('POST /api/customer-bid — CAPI failures never break the bid', () => {
  beforeEach(() => {
    process.env.META_CAPI_ACCESS_TOKEN = 'test-capi-token';
  });

  test('bid submission succeeds when the CAPI helper throws synchronously', async () => {
    sendMetaLeadEvent.mockImplementation(() => {
      throw new Error('CAPI exploded synchronously');
    });

    const response = await submitBid();
    await flushPendingCapiCall();

    expect(response.status).toBe(201);
    expect(response.body.msg).toMatch(/submitted successfully/i);

    const Customer = mongoose.model('Customer');
    expect(await Customer.findOne({ email: 'john@example.com' })).toBeTruthy();
  });

  test('bid submission succeeds when the CAPI helper rejects', async () => {
    sendMetaLeadEvent.mockRejectedValue(new Error('CAPI network down'));

    const response = await submitBid();
    await flushPendingCapiCall();

    expect(response.status).toBe(201);
    expect(response.body.msg).toMatch(/submitted successfully/i);

    const Customer = mongoose.model('Customer');
    expect(await Customer.findOne({ email: 'john@example.com' })).toBeTruthy();
  });

  test('an existing customer adding a project also succeeds despite CAPI failure', async () => {
    const Customer = mongoose.model('Customer');
    await Customer.create({
      name: 'John Doe',
      email: 'john@example.com',
      phone: '9312797879',
      projects: [],
    });

    sendMetaLeadEvent.mockRejectedValue(new Error('CAPI network down'));

    const response = await submitBid();
    await flushPendingCapiCall();

    expect(response.status).toBe(200);
    expect(response.body.msg).toMatch(/existing account/i);

    const saved = await Customer.findOne({ email: 'john@example.com' });
    expect(saved.projects).toHaveLength(1);
  });

  test('fires the Lead event for an existing customer too', async () => {
    const Customer = mongoose.model('Customer');
    await Customer.create({
      name: 'John Doe',
      email: 'john@example.com',
      phone: '9312797879',
      projects: [],
    });

    const response = await submitBid();
    await flushPendingCapiCall();

    expect(response.status).toBe(200);
    expect(sendMetaLeadEvent).toHaveBeenCalledTimes(1);
    expect(sendMetaLeadEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'john@example.com',
        phone: '(931) 279-7879',
      })
    );
  });
});
