/**
 * Integration Tests for Customer and Project Routes
 * Testing: Customer CRUD and Project management endpoints
 */

import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

// Set environment variables
process.env.JWT_SECRET = 'test-secret-key';
process.env.VERCEL = '1';

// SAFETY CHECK: Store original MONGO_URI to detect if we accidentally use production
const originalMongoUri = process.env.MONGO_URI;

let mongoServer;
let app;
let authToken;
let testUserId;

beforeAll(async () => {
  // SAFETY CHECK: Warn if we detect a production database URI before tests
  if (originalMongoUri && (
    originalMongoUri.includes('mongodb.net') || // MongoDB Atlas
    originalMongoUri.includes('mongodb+srv://') || // MongoDB Atlas connection string
    originalMongoUri.includes('production') || // Contains "production"
    (!originalMongoUri.includes('localhost') && !originalMongoUri.includes('127.0.0.1'))
  )) {
    console.warn('⚠️  WARNING: Original MONGO_URI detected (may be production):', 
      originalMongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials
  }
  
  // Create in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Set MONGO_URI before importing server so it uses our in-memory DB
  process.env.MONGO_URI = mongoUri;
  
  await mongoose.disconnect();
  await mongoose.connect(mongoUri);
  
  // Verify we're connected to the in-memory database
  const connectedUri = mongoose.connection.client?.s?.url || '';
  if (!connectedUri.includes('127.0.0.1') && !connectedUri.includes('localhost')) {
    throw new Error(`CRITICAL: Connected to unexpected database: ${connectedUri}. Tests aborted to protect production data!`);
  }
  
  // Import app (this registers the models)
  const appModule = await import('../server.js');
  app = appModule.default;
  
  // Wait a bit for models to be registered and server to connect
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Create test user in database and get auth token
  const User = mongoose.model('User');
  testUserId = new mongoose.Types.ObjectId();
  const testUser = new User({
    _id: testUserId,
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedpassword',
    role: 'admin',
    status: 'approved'
  });
  await testUser.save();
  
  authToken = jwt.sign({ id: testUserId.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
  // Restore original MONGO_URI if it existed
  if (originalMongoUri) {
    process.env.MONGO_URI = originalMongoUri;
  } else {
    delete process.env.MONGO_URI;
  }
});

afterEach(async () => {
  // SAFETY CHECK: Only clear collections if connected to in-memory database
  // Verify we're connected to the in-memory test database, not production
  const inMemoryUri = mongoServer?.getUri() || '';
  const currentUri = mongoose.connection.client?.s?.url || mongoose.connection.host || '';
  
  // Check if current connection matches the in-memory server URI
  // or contains localhost/127.0.0.1 (typical for in-memory servers)
  const isInMemoryDB = inMemoryUri && (
    currentUri.includes('127.0.0.1') || 
    currentUri.includes('localhost') ||
    inMemoryUri === currentUri ||
    currentUri.startsWith('mongodb://127.0.0.1') ||
    currentUri.startsWith('mongodb://localhost')
  );
  
  // Double-check: Only proceed if we're definitely using in-memory database
  if (isInMemoryDB && mongoose.connection.readyState === 1 && mongoServer) {
    // Clear all collections except users (we need the test user to persist)
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      if (key !== 'users') {
        await collections[key].deleteMany({});
      }
    }
  } else {
    // Log warning if we detect we might be connected to production
    console.error('❌ CRITICAL: Skipping collection cleanup - may be connected to production database!');
    console.error(`   Expected in-memory URI: ${inMemoryUri}`);
    console.error(`   Current connection URI: ${currentUri}`);
    console.error(`   Connection state: ${mongoose.connection.readyState}`);
    throw new Error('Test safety check failed: Possible production database connection detected!');
  }
});

// Helper function to ensure test user exists
const ensureTestUser = async () => {
  const User = mongoose.model('User');
  let existingUser = await User.findById(testUserId);
  if (!existingUser) {
    const testUser = new User({
      _id: testUserId,
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      role: 'admin',
      status: 'approved'
    });
    existingUser = await testUser.save();
  }
  return existingUser;
};

beforeEach(async () => {
  // Ensure test user exists before each test
  await ensureTestUser();
});

describe('GET /api/customers', () => {
  test('should require authentication', async () => {
    const response = await request(app).get('/api/customers');
    
    expect(response.status).toBe(401);
    expect(response.body.msg).toBe('No token');
  });

  test('should return empty array when no customers', async () => {
    const response = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test('should return all customers', async () => {
    await ensureTestUser();
    
    // Create some customers
    const Customer = mongoose.model('Customer');
    await Customer.create([
      { name: 'Customer 1', email: 'c1@test.com', phone: '111', projects: [] },
      { name: 'Customer 2', email: 'c2@test.com', phone: '222', projects: [] },
      { name: 'Customer 3', email: 'c3@test.com', phone: '333', projects: [] }
    ]);

    const response = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(3);
    expect(response.body[0]).toHaveProperty('name');
    expect(response.body[0]).toHaveProperty('email');
    expect(response.body[0]).toHaveProperty('_id');
  });

  test('should include customer projects in response', async () => {
    const Customer = mongoose.model('Customer');
    await Customer.create({
      name: 'Test Customer',
      email: 'test@test.com',
      phone: '555-1234',
      projects: [{
        name: 'Test Project',
        description: 'Description',
        status: 'Pending'
      }]
    });

    const response = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body[0].projects).toHaveLength(1);
    expect(response.body[0].projects[0].name).toBe('Test Project');
  });
});

describe('GET /api/customers/:id', () => {
  let customerId;

  beforeEach(async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Test Customer',
      email: 'test@test.com',
      phone: '555-1234',
      projects: []
    });
    customerId = customer._id.toString();
  });

  test('should require authentication', async () => {
    const response = await request(app).get(`/api/customers/${customerId}`);
    
    expect(response.status).toBe(401);
  });

  test('should return customer by ID', async () => {
    const response = await request(app)
      .get(`/api/customers/${customerId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('_id', customerId);
    expect(response.body).toHaveProperty('name', 'Test Customer');
    expect(response.body).toHaveProperty('email', 'test@test.com');
  });

  test('should return 404 for non-existent customer', async () => {
    await ensureTestUser();
    
    const fakeId = new mongoose.Types.ObjectId().toString();
    
    const response = await request(app)
      .get(`/api/customers/${fakeId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(404);
    expect(response.body.msg).toBe('Customer not found');
  });

  test('should return 400 for invalid customer ID format', async () => {
    const response = await request(app)
      .get('/api/customers/invalid-id')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(400);
    expect(response.body.msg).toBe('Invalid customer ID format');
  });

  test('should ensure projects array exists', async () => {
    await ensureTestUser();
    
    const response = await request(app)
      .get(`/api/customers/${customerId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('projects');
    expect(Array.isArray(response.body.projects)).toBe(true);
  });

  test('should return customer with projects', async () => {
    await ensureTestUser();
    
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Customer with Projects',
      email: 'projects@test.com',
      phone: '555-5555',
      projects: [
        { name: 'Project 1', description: 'Desc 1', status: 'Pending' },
        { name: 'Project 2', description: 'Desc 2', status: 'Bidded' }
      ]
    });

    const response = await request(app)
      .get(`/api/customers/${customer._id}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.projects).toHaveLength(2);
  });
});

describe('POST /api/customers', () => {
  test('should require authentication', async () => {
    const response = await request(app)
      .post('/api/customers')
      .send({ name: 'New Customer', email: 'new@test.com', phone: '555' });
    
    expect(response.status).toBe(401);
  });

  test('should create new customer', async () => {
    await ensureTestUser();
    
    const customerData = {
      name: 'New Customer',
      email: 'new@test.com',
      phone: '555-1234',
      address: '123 Main St'
    };

    const response = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send(customerData);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('_id');
    expect(response.body).toHaveProperty('name', 'New Customer');
    expect(response.body).toHaveProperty('email', 'new@test.com');
    
    // Verify in database
    const Customer = mongoose.model('Customer');
    const customer = await Customer.findById(response.body._id);
    expect(customer).toBeTruthy();
    expect(customer.name).toBe('New Customer');
  });

  test('should initialize projects array if not provided', async () => {
    await ensureTestUser();
    
    const response = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Customer Without Projects',
        email: 'noprojects@test.com',
        phone: '555'
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('projects');
    expect(response.body.projects).toEqual([]);
  });

  test('should accept customer with projects', async () => {
    await ensureTestUser();
    
    const customerData = {
      name: 'Customer With Projects',
      email: 'withprojects@test.com',
      phone: '555',
      projects: [
        { name: 'Initial Project', description: 'Test', status: 'Pending' }
      ]
    };

    const response = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send(customerData);
    
    expect(response.status).toBe(200);
    expect(response.body.projects).toHaveLength(1);
  });

  test('should accept minimal customer data', async () => {
    const response = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Minimal Customer'
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('name', 'Minimal Customer');
  });
});

describe('PUT /api/customers/:id', () => {
  let customerId;

  beforeEach(async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Original Name',
      email: 'original@test.com',
      phone: '555-0000',
      address: 'Original Address'
    });
    customerId = customer._id.toString();
  });

  test('should require authentication', async () => {
    const response = await request(app)
      .put(`/api/customers/${customerId}`)
      .send({ name: 'Updated' });
    
    expect(response.status).toBe(401);
  });

  test('should update customer name', async () => {
    await ensureTestUser();
    
    const response = await request(app)
      .put(`/api/customers/${customerId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Updated Name' });
    
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Updated Name');
    
    // Verify in database
    const Customer = mongoose.model('Customer');
    const customer = await Customer.findById(customerId);
    expect(customer.name).toBe('Updated Name');
  });

  test('should update customer email', async () => {
    await ensureTestUser();
    
    const response = await request(app)
      .put(`/api/customers/${customerId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ email: 'updated@test.com' });
    
    expect(response.status).toBe(200);
    expect(response.body.email).toBe('updated@test.com');
  });

  test('should update customer phone', async () => {
    await ensureTestUser();
    
    const response = await request(app)
      .put(`/api/customers/${customerId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ phone: '555-9999' });
    
    expect(response.status).toBe(200);
    expect(response.body.phone).toBe('555-9999');
  });

  test('should update customer address', async () => {
    await ensureTestUser();
    
    const response = await request(app)
      .put(`/api/customers/${customerId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ address: 'New Address' });
    
    expect(response.status).toBe(200);
    expect(response.body.address).toBe('New Address');
  });

  test('should update multiple fields at once', async () => {
    await ensureTestUser();
    
    const response = await request(app)
      .put(`/api/customers/${customerId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'New Name',
        email: 'newemail@test.com',
        phone: '555-1111',
        address: 'New Address'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('New Name');
    expect(response.body.email).toBe('newemail@test.com');
    expect(response.body.phone).toBe('555-1111');
    expect(response.body.address).toBe('New Address');
  });

  test('should return 404 for non-existent customer', async () => {
    await ensureTestUser();
    
    const fakeId = new mongoose.Types.ObjectId().toString();
    
    const response = await request(app)
      .put(`/api/customers/${fakeId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Updated' });
    
    expect(response.status).toBe(404);
    expect(response.body.msg).toBe('Customer not found');
  });

  test('should not modify fields not in request', async () => {
    const response = await request(app)
      .put(`/api/customers/${customerId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Only Name Updated' });
    
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Only Name Updated');
    expect(response.body.email).toBe('original@test.com'); // Unchanged
    expect(response.body.phone).toBe('555-0000'); // Unchanged
  });
});

describe('DELETE /api/customers/:id', () => {
  let customerId;

  beforeEach(async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'To Delete',
      email: 'delete@test.com',
      phone: '555'
    });
    customerId = customer._id.toString();
  });

  test('should require authentication', async () => {
    const response = await request(app).delete(`/api/customers/${customerId}`);
    
    expect(response.status).toBe(401);
  });

  test('should delete customer', async () => {
    await ensureTestUser();
    
    const response = await request(app)
      .delete(`/api/customers/${customerId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('msg', 'Customer deleted');
    
    // Verify deletion
    const Customer = mongoose.model('Customer');
    const customer = await Customer.findById(customerId);
    expect(customer).toBeNull();
  });

  test('should handle deletion of non-existent customer gracefully', async () => {
    await ensureTestUser();
    
    const fakeId = new mongoose.Types.ObjectId().toString();
    
    const response = await request(app)
      .delete(`/api/customers/${fakeId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    // Should not crash
    expect(response.status).toBe(200);
  });
});

describe('POST /api/customers/:customerId/projects', () => {
  let customerId;

  beforeEach(async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Test Customer',
      email: 'test@test.com',
      phone: '555',
      projects: []
    });
    customerId = customer._id.toString();
  });

  test('should require authentication', async () => {
    const response = await request(app)
      .post(`/api/customers/${customerId}/projects`)
      .send({ name: 'New Project' });
    
    expect(response.status).toBe(401);
  });

  test('should add project to customer', async () => {
    await ensureTestUser();
    
    const projectData = {
      name: 'New Project',
      description: 'Project description',
      status: 'Pending'
    };

    const response = await request(app)
      .post(`/api/customers/${customerId}/projects`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(projectData);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('name', 'New Project');
    expect(response.body).toHaveProperty('_id');
    
    // Verify in database
    const Customer = mongoose.model('Customer');
    const customer = await Customer.findById(customerId);
    expect(customer.projects).toHaveLength(1);
    expect(customer.projects[0].name).toBe('New Project');
  });

  test('should return 404 for non-existent customer', async () => {
    await ensureTestUser();
    
    const fakeId = new mongoose.Types.ObjectId().toString();
    
    const response = await request(app)
      .post(`/api/customers/${fakeId}/projects`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Project' });
    
    expect(response.status).toBe(404);
    expect(response.body.msg).toBe('Customer not found');
  });

  test('should add multiple projects to same customer', async () => {
    await ensureTestUser();

    // Add first project
    await request(app)
      .post(`/api/customers/${customerId}/projects`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Project 1', description: 'Desc 1' });
    
    // Add second project
    await request(app)
      .post(`/api/customers/${customerId}/projects`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Project 2', description: 'Desc 2' });
    
    // Verify both projects exist
    const Customer = mongoose.model('Customer');
    const customer = await Customer.findById(customerId);
    expect(customer).not.toBeNull();
    expect(customer.projects).toHaveLength(2);
  });

  test('should persist equipmentCategories on new project', async () => {
    await ensureTestUser();

    const projectData = {
      name: 'Alarm Job',
      description: 'Install',
      status: 'Pending',
      equipmentCategories: {
        burglarAlarm: true,
        fireAlarm: false,
        accessControl: true,
        cctv: true,
        monitoring: true
      }
    };

    const response = await request(app)
      .post(`/api/customers/${customerId}/projects`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(projectData);

    expect(response.status).toBe(200);
    expect(response.body.equipmentCategories).toMatchObject({
      burglarAlarm: true,
      fireAlarm: false,
      accessControl: true,
      cctv: true,
      monitoring: true
    });
  });
});

describe('PUT /api/customers/:customerId/projects/:projectId', () => {
  let customerId;
  let projectId;

  beforeEach(async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Test Customer',
      email: 'test@test.com',
      phone: '555',
      projects: [{
        name: 'Original',
        description: 'Old desc',
        status: 'Pending',
        equipmentCategories: {
          burglarAlarm: true,
          fireAlarm: false,
          accessControl: false,
          cctv: false,
          monitoring: false
        }
      }]
    });
    customerId = customer._id.toString();
    projectId = customer.projects[0]._id.toString();
  });

  test('should require authentication', async () => {
    const response = await request(app)
      .put(`/api/customers/${customerId}/projects/${projectId}`)
      .send({ name: 'X' });
    expect(response.status).toBe(401);
  });

  test('should update project name, description, and equipmentCategories', async () => {
    await ensureTestUser();

    const response = await request(app)
      .put(`/api/customers/${customerId}/projects/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Updated Name',
        description: 'New description',
        equipmentCategories: {
          burglarAlarm: false,
          fireAlarm: true,
          accessControl: true,
          cctv: true,
          monitoring: false
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.project.name).toBe('Updated Name');
    expect(response.body.project.description).toBe('New description');
    expect(response.body.project.equipmentCategories).toMatchObject({
      burglarAlarm: false,
      fireAlarm: true,
      accessControl: true,
      cctv: true,
      monitoring: false
    });
  });
});

describe('DELETE /api/customers/:customerId/projects/:projectId', () => {
  let customerId;
  let projectId;

  beforeEach(async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Test Customer',
      email: 'test@test.com',
      phone: '555',
      projects: [{
        name: 'Test Project',
        description: 'To be deleted'
      }]
    });
    customerId = customer._id.toString();
    projectId = customer.projects[0]._id.toString();
  });

  test('should require authentication', async () => {
    const response = await request(app)
      .delete(`/api/customers/${customerId}/projects/${projectId}`);
    
    expect(response.status).toBe(401);
  });

  test('should delete project', async () => {
    await ensureTestUser();
    
    const response = await request(app)
      .delete(`/api/customers/${customerId}/projects/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.msg).toBe('Project deleted');
    
    // Verify deletion
    const Customer = mongoose.model('Customer');
    const customer = await Customer.findById(customerId);
    expect(customer).not.toBeNull();
    expect(customer.projects).toHaveLength(0);
  });

  test('should return 404 for non-existent customer', async () => {
    await ensureTestUser();
    
    const fakeId = new mongoose.Types.ObjectId().toString();
    
    const response = await request(app)
      .delete(`/api/customers/${fakeId}/projects/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(404);
    expect(response.body.msg).toBe('Customer not found');
  });
});

describe('PUT /api/customers/:customerId/projects/:projectId/bid', () => {
  let customerId;
  let projectId;

  beforeEach(async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Test Customer',
      email: 'test@test.com',
      phone: '555',
      projects: [{
        name: 'Test Project',
        description: 'Project for bidding',
        status: 'Pending'
      }]
    });
    customerId = customer._id.toString();
    projectId = customer.projects[0]._id.toString();
  });

  test('should update bid amount and status', async () => {
    await ensureTestUser();
    
    const response = await request(app)
      .put(`/api/customers/${customerId}/projects/${projectId}/bid`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ bidAmount: 5000 });
    
    expect(response.status).toBe(200);
    expect(response.body.bidAmount).toBe(5000);
    expect(response.body.status).toBe('Bidded');
  });

  test('should return 404 for non-existent customer', async () => {
    await ensureTestUser();
    
    const fakeId = new mongoose.Types.ObjectId().toString();
    
    const response = await request(app)
      .put(`/api/customers/${fakeId}/projects/${projectId}/bid`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ bidAmount: 5000 });
    
    expect(response.status).toBe(404);
    expect(response.body.msg).toBe('Customer not found');
  });

  test('should return 404 for non-existent project', async () => {
    const fakeProjectId = new mongoose.Types.ObjectId().toString();
    
    const response = await request(app)
      .put(`/api/customers/${customerId}/projects/${fakeProjectId}/bid`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ bidAmount: 5000 });
    
    expect(response.status).toBe(404);
    expect(response.body.msg).toBe('Project not found');
  });
});

describe('PUT /api/customers/:customerId/projects/:projectId/schedule', () => {
  let customerId;
  let projectId;

  beforeEach(async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Test Customer',
      email: 'test@test.com',
      phone: '555',
      projects: [{
        name: 'Test Project',
        status: 'Bidded'
      }]
    });
    customerId = customer._id.toString();
    projectId = customer.projects[0]._id.toString();
  });

  test('should schedule project', async () => {
    await ensureTestUser();
    
    const scheduleDate = new Date('2024-12-25');
    
    const response = await request(app)
      .put(`/api/customers/${customerId}/projects/${projectId}/schedule`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ scheduleDate });
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('Scheduled');
    expect(new Date(response.body.scheduleDate)).toEqual(scheduleDate);
  });
});

describe('PUT /api/customers/:customerId/projects/:projectId/complete', () => {
  let customerId;
  let projectId;

  beforeEach(async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Test Customer',
      email: 'test@test.com',
      phone: '555',
      projects: [{
        name: 'Test Project',
        status: 'Scheduled'
      }]
    });
    customerId = customer._id.toString();
    projectId = customer.projects[0]._id.toString();
  });

  test('should mark project as completed', async () => {
    await ensureTestUser();
    
    const response = await request(app)
      .put(`/api/customers/${customerId}/projects/${projectId}/complete`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('Completed');
  });
});

describe('POST /api/customers/:customerId/projects/:projectId/materials', () => {
  let customerId;
  let projectId;

  beforeEach(async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Test Customer',
      email: 'test@test.com',
      phone: '555',
      projects: [{
        name: 'Test Project',
        materials: []
      }]
    });
    customerId = customer._id.toString();
    projectId = customer.projects[0]._id.toString();
  });

  test('should add material to project', async () => {
    await ensureTestUser();
    
    const material = {
      item: 'Lumber',
      quantity: 100,
      cost: 500,
      markup: 10
    };

    const response = await request(app)
      .post(`/api/customers/${customerId}/projects/${projectId}/materials`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(material);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject(material);
  });
});

describe('DELETE /api/customers/:customerId/projects/:projectId/materials/:materialId', () => {
  let customerId;
  let projectId;
  let materialId;

  beforeEach(async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Test Customer',
      email: 'test@test.com',
      phone: '555',
      projects: [{
        name: 'Test Project',
        materials: [{
          item: 'Lumber',
          quantity: 100,
          cost: 500,
          markup: 0
        }]
      }]
    });
    customerId = customer._id.toString();
    projectId = customer.projects[0]._id.toString();
    materialId = customer.projects[0].materials[0]._id.toString();
  });

  test('should delete material from project', async () => {
    await ensureTestUser();
    
    const response = await request(app)
      .delete(`/api/customers/${customerId}/projects/${projectId}/materials/${materialId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.msg).toBe('Material deleted');
    expect(response.body.materials).toHaveLength(0);
  });
});

describe('PUT /api/customers/:customerId/projects/:projectId/materials/:materialId', () => {
  let customerId;
  let projectId;
  let materialId;

  beforeEach(async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Test Customer',
      email: 'test@test.com',
      phone: '555',
      projects: [{
        name: 'Test Project',
        materials: [{
          item: 'Lumber',
          quantity: 4,
          cost: 10,
          markup: 0
        }]
      }]
    });

    customerId = customer._id.toString();
    projectId = customer.projects[0]._id.toString();
    materialId = customer.projects[0].materials[0]._id.toString();
  });

  test('should require authentication', async () => {
    const response = await request(app)
      .put(`/api/customers/${customerId}/projects/${projectId}/materials/${materialId}`)
      .send({ item: 'Plywood', quantity: 50, cost: 200 });

    expect(response.status).toBe(401);
    expect(response.body.msg).toBe('No token');
  });

  test('should update material in project', async () => {
    await ensureTestUser();

    const updated = { item: 'Plywood', quantity: 8, cost: 12, markup: 15 };

    const response = await request(app)
      .put(`/api/customers/${customerId}/projects/${projectId}/materials/${materialId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updated);

    expect(response.status).toBe(200);
    expect(response.body.msg).toBe('Material updated');
    expect(response.body.materials).toHaveLength(1);
    expect(response.body.materials[0]).toMatchObject(updated);
  });

  test('should return 404 for non-existent material', async () => {
    await ensureTestUser();

    const fakeMaterialId = new mongoose.Types.ObjectId().toString();

    const updated = { item: 'Plywood', quantity: 8, cost: 12, markup: 15 };

    const response = await request(app)
      .put(`/api/customers/${customerId}/projects/${projectId}/materials/${fakeMaterialId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updated);

    expect(response.status).toBe(404);
    expect(response.body.msg).toBe('Material not found');
  });
});

describe('POST /api/customers/:customerId/projects/:projectId/notes', () => {
  let customerId;
  let projectId;

  beforeEach(async () => {
    const Customer = mongoose.model('Customer');
    const customer = await Customer.create({
      name: 'Test Customer',
      email: 'notes@test.com',
      phone: '555',
      projects: [{ name: 'Test Project', description: 'Desc' }]
    });
    customerId = customer._id.toString();
    projectId = customer.projects[0]._id.toString();
  });

  test('should require authentication', async () => {
    const response = await request(app)
      .post(`/api/customers/${customerId}/projects/${projectId}/notes`)
      .send({ text: 'A note' });
    expect(response.status).toBe(401);
  });

  test('should add note to project and return notes array', async () => {
    await ensureTestUser();
    const response = await request(app)
      .post(`/api/customers/${customerId}/projects/${projectId}/notes`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ text: ' First note ' });
    expect(response.status).toBe(201);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].text).toBe('First note');
    expect(response.body[0]).toHaveProperty('addedAt');
  });

  test('should reject empty or missing text', async () => {
    await ensureTestUser();
    const resEmpty = await request(app)
      .post(`/api/customers/${customerId}/projects/${projectId}/notes`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ text: '   ' });
    expect(resEmpty.status).toBe(400);
    expect(resEmpty.body.msg).toMatch(/required/i);

    const resMissing = await request(app)
      .post(`/api/customers/${customerId}/projects/${projectId}/notes`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(resMissing.status).toBe(400);
  });

  test('should return 404 for non-existent customer', async () => {
    await ensureTestUser();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const response = await request(app)
      .post(`/api/customers/${fakeId}/projects/${projectId}/notes`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ text: 'Note' });
    expect(response.status).toBe(404);
    expect(response.body.msg).toBe('Customer not found');
  });

  test('should return 404 for non-existent project', async () => {
    await ensureTestUser();
    const fakeProjectId = new mongoose.Types.ObjectId().toString();
    const response = await request(app)
      .post(`/api/customers/${customerId}/projects/${fakeProjectId}/notes`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ text: 'Note' });
    expect(response.status).toBe(404);
    expect(response.body.msg).toBe('Project not found');
  });
});

