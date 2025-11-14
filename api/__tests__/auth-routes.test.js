/**
 * Integration Tests for Authentication Routes
 * Testing: POST /api/register, POST /api/login, POST /api/customer-bid
 */

import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Set environment variables before importing app
process.env.JWT_SECRET = 'test-secret-key-for-auth';
process.env.VERCEL = '1'; // Prevent server from starting

let mongoServer;
let app;

beforeAll(async () => {
  // Create in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Disconnect any existing connections
  await mongoose.disconnect();
  
  // Connect to in-memory database
  await mongoose.connect(mongoUri);
  
  // Import app after database is connected
  const appModule = await import('../server.js');
  app = appModule.default;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clear all collections after each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('POST /api/register', () => {
  describe('Successful Registration', () => {
    test('should register a new user with valid credentials', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          username: 'newuser',
          password: 'password123'
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('msg', 'User registered successfully');
      
      // Verify user was actually created in database
      const User = mongoose.model('User');
      const user = await User.findOne({ username: 'newuser' });
      expect(user).toBeTruthy();
      expect(user.username).toBe('newuser');
      
      // Verify password was hashed
      expect(user.password).not.toBe('password123');
      const isValidPassword = await bcrypt.compare('password123', user.password);
      expect(isValidPassword).toBe(true);
    });

    test('should hash password with bcrypt before storing', async () => {
      const plainPassword = 'mySecurePass123';
      
      await request(app)
        .post('/api/register')
        .send({
          username: 'secureuser',
          password: plainPassword
        });
      
      const User = mongoose.model('User');
      const user = await User.findOne({ username: 'secureuser' });
      
      // Password should be hashed
      expect(user.password).not.toBe(plainPassword);
      expect(user.password).toMatch(/^\$2[aby]\$.{56}$/); // Bcrypt hash format
    });

    test('should accept minimum valid username length (3 chars)', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          username: 'abc',
          password: 'password123'
        });
      
      expect(response.status).toBe(201);
    });

    test('should accept minimum valid password length (6 chars)', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          username: 'testuser',
          password: '123456'
        });
      
      expect(response.status).toBe(201);
    });

    test('should accept long usernames', async () => {
      const longUsername = 'a'.repeat(50);
      const response = await request(app)
        .post('/api/register')
        .send({
          username: longUsername,
          password: 'password123'
        });
      
      expect(response.status).toBe(201);
    });
  });

  describe('Validation Errors', () => {
    test('should reject registration without username', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          password: 'password123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('Username and password are required');
    });

    test('should reject registration without password', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          username: 'testuser'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('Username and password are required');
    });

    test('should reject registration without both username and password', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('Username and password are required');
    });

    test('should reject username shorter than 3 characters', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          username: 'ab',
          password: 'password123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('Username must be at least 3 characters');
    });

    test('should reject password shorter than 6 characters', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          username: 'testuser',
          password: '12345'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('Password must be at least 6 characters');
    });

    test('should reject empty string username', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          username: '',
          password: 'password123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('Username and password are required');
    });

    test('should reject empty string password', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          username: 'testuser',
          password: ''
        });
      
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('Username and password are required');
    });
  });

  describe('Duplicate User Handling', () => {
    beforeEach(async () => {
      // Create a user before each test
      await request(app)
        .post('/api/register')
        .send({
          username: 'existinguser',
          password: 'password123'
        });
    });

    test('should reject registration with duplicate username', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          username: 'existinguser',
          password: 'differentpass'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('Username already exists');
    });

    test('should handle case-sensitive usernames correctly', async () => {
      // MongoDB by default is case-sensitive
      const response = await request(app)
        .post('/api/register')
        .send({
          username: 'ExistingUser', // Different case
          password: 'password123'
        });
      
      // Should succeed since case is different
      expect(response.status).toBe(201);
    });
  });

  describe('Edge Cases', () => {
    test('should handle special characters in username', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          username: 'user@123',
          password: 'password123'
        });
      
      expect(response.status).toBe(201);
    });

    test('should handle special characters in password', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          username: 'testuser',
          password: 'P@ssw0rd!#$%'
        });
      
      expect(response.status).toBe(201);
    });

    test('should handle unicode characters in username', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          username: 'user本',
          password: 'password123'
        });
      
      expect(response.status).toBe(201);
    });

    test('should trim or handle whitespace in credentials', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          username: 'testuser ',
          password: 'password123'
        });
      
      // Should either succeed or fail consistently
      expect([201, 400]).toContain(response.status);
    });
  });
});

describe('POST /api/login', () => {
  const testUser = {
    username: 'testuser',
    password: 'password123'
  };

  beforeEach(async () => {
    // Register a user before each login test
    await request(app)
      .post('/api/register')
      .send(testUser);
  });

  describe('Successful Login', () => {
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/login')
        .send(testUser);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(0);
    });

    test('should return valid JWT token', async () => {
      const response = await request(app)
        .post('/api/login')
        .send(testUser);
      
      const token = response.body.token;
      
      // Verify JWT structure (3 parts separated by dots)
      expect(token.split('.')).toHaveLength(3);
      
      // Verify token can be decoded
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded).toHaveProperty('id');
      expect(decoded).toHaveProperty('exp');
      expect(decoded).toHaveProperty('iat');
    });

    test('should include user ID in JWT payload', async () => {
      const response = await request(app)
        .post('/api/login')
        .send(testUser);
      
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
      
      // Get user from database
      const User = mongoose.model('User');
      const user = await User.findOne({ username: testUser.username });
      
      expect(decoded.id).toBe(user._id.toString());
    });

    test('should set token expiration to 1 hour', async () => {
      const response = await request(app)
        .post('/api/login')
        .send(testUser);
      
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
      
      const issuedAt = decoded.iat;
      const expiresAt = decoded.exp;
      const diff = expiresAt - issuedAt;
      
      // Should be 1 hour (3600 seconds)
      expect(diff).toBe(3600);
    });
  });

  describe('Authentication Failures', () => {
    test('should reject login without username', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          password: 'password123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('Username and password are required');
    });

    test('should reject login without password', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          username: 'testuser'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('Username and password are required');
    });

    test('should reject login with non-existent user', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          username: 'nonexistentuser',
          password: 'password123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('Invalid credentials');
    });

    test('should reject login with incorrect password', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          username: testUser.username,
          password: 'wrongpassword'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('Invalid credentials');
    });

    test('should not reveal whether username or password is wrong', async () => {
      // Test with wrong username
      const response1 = await request(app)
        .post('/api/login')
        .send({
          username: 'wronguser',
          password: 'password123'
        });
      
      // Test with wrong password
      const response2 = await request(app)
        .post('/api/login')
        .send({
          username: testUser.username,
          password: 'wrongpassword'
        });
      
      // Both should return same error message (security best practice)
      expect(response1.body.msg).toBe(response2.body.msg);
      expect(response1.body.msg).toBe('Invalid credentials');
    });

    test('should reject empty credentials', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          username: '',
          password: ''
        });
      
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('Username and password are required');
    });
  });

  describe('Password Verification', () => {
    test('should correctly verify hashed passwords', async () => {
      const response = await request(app)
        .post('/api/login')
        .send(testUser);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
    });

    test('should reject password with slight variations', async () => {
      const wrongPasswords = [
        'password124', // One digit off
        'Password123', // Wrong case
        'password12',  // Too short
        ' password123', // Extra space
        'password123 ', // Trailing space
      ];

      for (const wrongPassword of wrongPasswords) {
        const response = await request(app)
          .post('/api/login')
          .send({
            username: testUser.username,
            password: wrongPassword
          });
        
        expect(response.status).toBe(400);
        expect(response.body.msg).toBe('Invalid credentials');
      }
    });
  });

  describe('Case Sensitivity', () => {
    test('should treat username as case-sensitive', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          username: 'TestUser', // Different case
          password: testUser.password
        });
      
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('Invalid credentials');
    });
  });
});

describe('POST /api/customer-bid (Public Route)', () => {
  describe('Successful Bid Submission', () => {
    test('should create new customer with bid request', async () => {
      const bidData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-1234',
        address: '123 Main St',
        projectName: 'Kitchen Remodel',
        projectDescription: 'Need to remodel kitchen with new cabinets'
      };

      const response = await request(app)
        .post('/api/customer-bid')
        .send(bidData);
      
      expect(response.status).toBe(201);
      expect(response.body.msg).toContain('Bid request submitted successfully');
      expect(response.body.customer).toHaveProperty('name', 'John Doe');
      expect(response.body.customer).toHaveProperty('email', 'john@example.com');
      
      // Verify customer was created in database
      const Customer = mongoose.model('Customer');
      const customer = await Customer.findOne({ email: 'john@example.com' });
      expect(customer).toBeTruthy();
      expect(customer.projects).toHaveLength(1);
      expect(customer.projects[0].name).toBe('Kitchen Remodel');
      expect(customer.projects[0].status).toBe('Pending');
    });

    test('should add project to existing customer', async () => {
      const firstBid = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '555-5678',
        address: '456 Oak Ave',
        projectName: 'Bathroom Remodel',
        projectDescription: 'Upgrade bathroom fixtures'
      };

      // Submit first bid
      await request(app)
        .post('/api/customer-bid')
        .send(firstBid);
      
      // Submit second bid with same email
      const secondBid = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '555-5678',
        address: '456 Oak Ave',
        projectName: 'Deck Construction',
        projectDescription: 'Build new deck in backyard'
      };

      const response = await request(app)
        .post('/api/customer-bid')
        .send(secondBid);
      
      expect(response.status).toBe(200);
      expect(response.body.msg).toContain('found your existing account');
      
      // Verify customer has 2 projects
      const Customer = mongoose.model('Customer');
      const customer = await Customer.findOne({ email: 'jane@example.com' });
      expect(customer.projects).toHaveLength(2);
      expect(customer.projects[1].name).toBe('Deck Construction');
    });

    test('should work without address (optional field)', async () => {
      const bidData = {
        name: 'Bob Johnson',
        email: 'bob@example.com',
        phone: '555-9999',
        projectName: 'Fence Repair',
        projectDescription: 'Fix broken fence sections'
      };

      const response = await request(app)
        .post('/api/customer-bid')
        .send(bidData);
      
      expect(response.status).toBe(201);
      
      const Customer = mongoose.model('Customer');
      const customer = await Customer.findOne({ email: 'bob@example.com' });
      expect(customer.address).toBe('');
    });
  });

  describe('Validation Errors', () => {
    test('should reject bid without name', async () => {
      const response = await request(app)
        .post('/api/customer-bid')
        .send({
          email: 'test@example.com',
          phone: '555-1234',
          projectName: 'Test Project',
          projectDescription: 'Test description'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('Name, email, and phone are required');
    });

    test('should reject bid without email', async () => {
      const response = await request(app)
        .post('/api/customer-bid')
        .send({
          name: 'John Doe',
          phone: '555-1234',
          projectName: 'Test Project',
          projectDescription: 'Test description'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('Name, email, and phone are required');
    });

    test('should reject bid without phone', async () => {
      const response = await request(app)
        .post('/api/customer-bid')
        .send({
          name: 'John Doe',
          email: 'test@example.com',
          projectName: 'Test Project',
          projectDescription: 'Test description'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('Name, email, and phone are required');
    });

    test('should reject bid without project name', async () => {
      const response = await request(app)
        .post('/api/customer-bid')
        .send({
          name: 'John Doe',
          email: 'test@example.com',
          phone: '555-1234',
          projectDescription: 'Test description'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('Project name and description are required');
    });

    test('should reject bid without project description', async () => {
      const response = await request(app)
        .post('/api/customer-bid')
        .send({
          name: 'John Doe',
          email: 'test@example.com',
          phone: '555-1234',
          projectName: 'Test Project'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe('Project name and description are required');
    });

    test('should reject invalid email format', async () => {
      const invalidEmails = [
        'notanemail',
        'missing@domain',
        '@nodomain.com',
        'spaces in@email.com',
        'double@@email.com'
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/customer-bid')
          .send({
            name: 'Test User',
            email,
            phone: '555-1234',
            projectName: 'Test',
            projectDescription: 'Test'
          });
        
        expect(response.status).toBe(400);
        expect(response.body.msg).toBe('Invalid email format');
      }
    });

    test('should accept valid email formats', async () => {
      const validEmails = [
        'simple@example.com',
        'name.surname@example.com',
        'user+tag@example.co.uk',
        'user123@test-domain.com'
      ];

      for (const email of validEmails) {
        const response = await request(app)
          .post('/api/customer-bid')
          .send({
            name: 'Test User',
            email,
            phone: '555-1234',
            projectName: 'Test Project',
            projectDescription: 'Test description'
          });
        
        expect([200, 201]).toContain(response.status);
      }
    });
  });

  describe('Project Status', () => {
    test('should set initial project status to "Pending"', async () => {
      await request(app)
        .post('/api/customer-bid')
        .send({
          name: 'Test User',
          email: 'pending@example.com',
          phone: '555-0000',
          projectName: 'Test Project',
          projectDescription: 'Test'
        });
      
      const Customer = mongoose.model('Customer');
      const customer = await Customer.findOne({ email: 'pending@example.com' });
      expect(customer.projects[0].status).toBe('Pending');
    });

    test('should set createdAt timestamp', async () => {
      const beforeTime = new Date();
      
      await request(app)
        .post('/api/customer-bid')
        .send({
          name: 'Test User',
          email: 'timestamp@example.com',
          phone: '555-0000',
          projectName: 'Test Project',
          projectDescription: 'Test'
        });
      
      const afterTime = new Date();
      
      const Customer = mongoose.model('Customer');
      const customer = await Customer.findOne({ email: 'timestamp@example.com' });
      const createdAt = new Date(customer.projects[0].createdAt);
      
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });
});

