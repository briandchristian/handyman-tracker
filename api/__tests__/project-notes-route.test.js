/**
 * Project Notes Route tests
 *
 * Verifies editing and deleting customer project notes through authenticated routes.
 */

import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { assertInMemoryMongoUri } from '../mongoTestSafety.js';

jest.setTimeout(30000);

process.env.JWT_SECRET = 'project-notes-route-test-secret';
process.env.VERCEL = '1';

const originalMongoUri = process.env.MONGO_URI;
const originalMongoDatabase = process.env.MONGO_DATABASE;
const originalMongoDbName = process.env.MONGO_DB_NAME;

let app;
let mongoServer;
let authToken;

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

  const appModule = await import('../index.js');
  app = appModule.default;

  await request(app).post('/api/register').send({
    username: 'notes-route-admin',
    email: 'notes-route-admin@example.com',
    password: 'password123',
  });

  const User = mongoose.model('User');
  const testUser = await User.findOne({ username: 'notes-route-admin' });
  if (testUser && (testUser.status !== 'approved' || testUser.role === 'pending')) {
    testUser.status = 'approved';
    testUser.role = 'admin';
    await testUser.save();
  }

  const loginResponse = await request(app).post('/api/login').send({
    username: 'notes-route-admin',
    password: 'password123',
  });

  authToken = loginResponse.body.token;
});

afterEach(async () => {
  jest.clearAllMocks();
  const activeUri = mongoose.connection?.client?.s?.url || process.env.MONGO_URI || '';
  assertInMemoryMongoUri(activeUri);
  const Customer = mongoose.model('Customer');
  await Customer.deleteMany({});
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

const seedCustomerWithProjectNote = async () => {
  const Customer = mongoose.model('Customer');
  const customer = await Customer.create({
    name: 'Note Customer',
    email: 'note-customer@example.com',
    phone: '555-1000',
    address: '123 Test Lane',
    projects: [
      {
        name: 'Test Project',
        description: 'Project for notes routes',
        status: 'Pending',
        materials: [],
        notes: [{ text: 'Original note text', addedAt: new Date() }],
      },
    ],
  });

  const project = customer.projects[0];
  const note = project.notes[0];
  return {
    customerId: customer._id.toString(),
    projectId: project._id.toString(),
    noteId: note._id.toString(),
  };
};

describe('Project note edit/delete routes', () => {
  test('PUT /api/customers/:customerId/projects/:projectId/notes/:noteId updates note text', async () => {
    const ids = await seedCustomerWithProjectNote();

    const response = await request(app)
      .put(`/api/customers/${ids.customerId}/projects/${ids.projectId}/notes/${ids.noteId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ text: 'Updated route note text' });

    expect(response.status).toBe(200);
    expect(response.body.msg).toBe('Note updated');
    expect(Array.isArray(response.body.notes)).toBe(true);
    expect(response.body.notes[0].text).toBe('Updated route note text');
  });

  test('DELETE /api/customers/:customerId/projects/:projectId/notes/:noteId removes a note', async () => {
    const ids = await seedCustomerWithProjectNote();

    const response = await request(app)
      .delete(`/api/customers/${ids.customerId}/projects/${ids.projectId}/notes/${ids.noteId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.msg).toBe('Note deleted');
    expect(Array.isArray(response.body.notes)).toBe(true);
    expect(response.body.notes.length).toBe(0);
  });
});

describe('Project payment route', () => {
  test('PUT /api/customers/:customerId/projects/:projectId/paid updates paid to date', async () => {
    const ids = await seedCustomerWithProjectNote();

    const response = await request(app)
      .put(`/api/customers/${ids.customerId}/projects/${ids.projectId}/paid`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ paidToDate: 1250 });

    expect(response.status).toBe(200);
    expect(response.body.paidToDate).toBe(1250);
  });

  test('PUT /api/customers/:customerId/projects/:projectId/paid rejects negative values', async () => {
    const ids = await seedCustomerWithProjectNote();

    const response = await request(app)
      .put(`/api/customers/${ids.customerId}/projects/${ids.projectId}/paid`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ paidToDate: -10 });

    expect(response.status).toBe(400);
    expect(response.body.msg).toMatch(/non-negative/i);
  });
});

describe('Project tax route', () => {
  test('PUT /api/customers/:customerId/projects/:projectId/tax-rate updates tax rate', async () => {
    const ids = await seedCustomerWithProjectNote();

    const response = await request(app)
      .put(`/api/customers/${ids.customerId}/projects/${ids.projectId}/tax-rate`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ taxRate: 8.25 });

    expect(response.status).toBe(200);
    expect(response.body.taxRate).toBe(8.25);
  });

  test('PUT /api/customers/:customerId/projects/:projectId/tax-rate rejects negative values', async () => {
    const ids = await seedCustomerWithProjectNote();

    const response = await request(app)
      .put(`/api/customers/${ids.customerId}/projects/${ids.projectId}/tax-rate`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ taxRate: -1 });

    expect(response.status).toBe(400);
    expect(response.body.msg).toMatch(/non-negative/i);
  });
});

describe('Project material taxable route behavior', () => {
  test('PUT /api/customers/:customerId/projects/:projectId/materials/:materialId updates taxable flag', async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Taxable Customer',
      email: 'taxable-customer@example.com',
      phone: '555-2000',
      address: '456 Tax Lane',
      projects: [
        {
          name: 'Taxable Project',
          description: 'Project for taxable material route',
          status: 'Pending',
          materials: [{ item: 'Labor', quantity: 1, cost: 100, markup: 0, taxable: true }],
          notes: [],
        },
      ],
    });

    const project = customer.projects[0];
    const material = project.materials[0];

    const response = await request(app)
      .put(`/api/customers/${customer._id}/projects/${project._id}/materials/${material._id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ taxable: false });

    expect(response.status).toBe(200);
    expect(response.body.msg).toBe('Material updated');
    expect(response.body.materials[0].taxable).toBe(false);
  });
});
