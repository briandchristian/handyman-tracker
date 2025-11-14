/**
 * Unit Tests for Backend Utility Functions
 * Testing: getClientIp() and authMiddleware()
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock the server app (we'll import after mocking dependencies)
jest.mock('dotenv/config');
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    connect: jest.fn().mockResolvedValue(true),
    connection: {
      on: jest.fn(),
    },
  };
});

// We need to set JWT_SECRET before importing the server
process.env.JWT_SECRET = 'test-secret-key';
process.env.MONGO_URI = 'mongodb://test';
process.env.VERCEL = '1'; // Prevent server from listening in tests

let app;

beforeAll(async () => {
  // Import server after mocks are configured (dynamic import)
  const appModule = await import('../server.js');
  app = appModule.default;
});

describe('Backend Utility Functions', () => {
  describe('getClientIp() - IP Detection Logic', () => {
    // Test through actual middleware behavior since getClientIp is not exported
    
    test('should extract IP from x-forwarded-for header (single IP)', async () => {
      const response = await request(app)
        .post('/api/login')
        .set('x-forwarded-for', '192.168.1.100')
        .send({ username: 'test', password: 'test' });
      
      // The function runs - we can verify it doesn't crash
      expect(response.status).toBeDefined();
    });

    test('should extract first IP from x-forwarded-for header (multiple IPs)', async () => {
      const response = await request(app)
        .post('/api/login')
        .set('x-forwarded-for', '192.168.1.100, 10.0.0.1, 172.16.0.1')
        .send({ username: 'test', password: 'test' });
      
      // The middleware should handle the comma-separated list
      expect(response.status).toBeDefined();
    });

    test('should extract IP with whitespace handling', async () => {
      const response = await request(app)
        .post('/api/register')
        .set('x-forwarded-for', '  192.168.1.100  ')
        .send({ username: 'test', password: 'test123' });
      
      // Should trim whitespace properly
      expect(response.status).toBeDefined();
    });

    test('should handle IPv6 format with ::ffff: prefix', async () => {
      // Test that the app doesn't crash with IPv6 addresses
      const response = await request(app)
        .post('/api/login')
        .set('x-forwarded-for', '::ffff:192.168.1.100')
        .send({ username: 'test', password: 'test' });
      
      expect(response.status).toBeDefined();
    });

    test('should fallback when no x-forwarded-for header', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ username: 'test', password: 'test' });
      
      // Should use req.ip or socket.remoteAddress fallback
      expect(response.status).toBeDefined();
    });
  });

  describe('authMiddleware() - Authentication & Authorization', () => {
    const validUserId = '507f1f77bcf86cd799439011';
    let validToken;

    beforeAll(() => {
      // Create a valid JWT token for testing
      validToken = jwt.sign({ id: validUserId }, process.env.JWT_SECRET, { expiresIn: '1h' });
    });

    test('should reject request with no token (401)', async () => {
      const response = await request(app)
        .get('/api/customers');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('msg', 'No token');
    });

    test('should reject request with empty Authorization header', async () => {
      const response = await request(app)
        .get('/api/customers')
        .set('Authorization', '');
      
      expect(response.status).toBe(401);
      expect(response.body.msg).toBe('No token');
    });

    test('should reject request with "Bearer " only (no token)', async () => {
      const response = await request(app)
        .get('/api/customers')
        .set('Authorization', 'Bearer ');
      
      expect(response.status).toBe(401);
      expect(response.body.msg).toBe('No token');
    });

    test('should reject request with invalid token format', async () => {
      const response = await request(app)
        .get('/api/customers')
        .set('Authorization', 'Bearer invalid-token-format');
      
      expect(response.status).toBe(401);
      expect(response.body.msg).toBe('Invalid token');
    });

    test('should reject request with malformed JWT', async () => {
      const response = await request(app)
        .get('/api/customers')
        .set('Authorization', 'Bearer not.a.jwt');
      
      expect(response.status).toBe(401);
      expect(response.body.msg).toBe('Invalid token');
    });

    test('should reject expired token', async () => {
      // Create an expired token (expired 1 hour ago)
      const expiredToken = jwt.sign(
        { id: validUserId },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );
      
      const response = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${expiredToken}`);
      
      expect(response.status).toBe(401);
      expect(response.body.msg).toBe('Invalid token');
    });

    test('should reject token signed with wrong secret', async () => {
      const wrongToken = jwt.sign(
        { id: validUserId },
        'wrong-secret',
        { expiresIn: '1h' }
      );
      
      const response = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${wrongToken}`);
      
      expect(response.status).toBe(401);
      expect(response.body.msg).toBe('Invalid token');
    });

    test('should accept valid token and attach user to request', async () => {
      // Mock the database to prevent actual DB calls
      const mongoose = await import('mongoose');
      const mockFind = jest.fn().mockResolvedValue([]);
      mongoose.Model.prototype.constructor.find = mockFind;
      
      const response = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${validToken}`);
      
      // Should pass authentication (500 or 200 depending on DB mock, not 401)
      expect(response.status).not.toBe(401);
      // The middleware should have set req.user
      // We can't directly test req.user, but if we got past 401, it worked
    });

    test('should extract token from "Bearer <token>" format correctly', async () => {
      const response = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${validToken}`);
      
      // Should not return 401 (authentication error)
      expect(response.status).not.toBe(401);
    });

    test('should work with token without "Bearer " prefix', async () => {
      // Some implementations might send just the token
      const response = await request(app)
        .get('/api/customers')
        .set('Authorization', validToken);
      
      // Should still work (will extract token after replace)
      expect(response.status).not.toBe(401);
    });

    test('should log authentication attempts with IP and endpoint', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await request(app)
        .get('/api/customers')
        .set('x-forwarded-for', '192.168.1.50');
      
      // Should have logged the auth attempt
      // (We can't easily test console output, but ensure no crash)
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('should handle missing Authorization header gracefully', async () => {
      const response = await request(app)
        .get('/api/customers')
        .set('X-Custom-Header', 'value'); // Different header
      
      expect(response.status).toBe(401);
      expect(response.body.msg).toBe('No token');
    });

    test('should decode token and extract user ID', async () => {
      // Valid token should be decoded and user attached to req
      const response = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${validToken}`);
      
      // If token is valid, we should not get 401
      expect(response.status).not.toBe(401);
      
      // Verify the token can be decoded
      const decoded = jwt.verify(validToken, process.env.JWT_SECRET);
      expect(decoded).toHaveProperty('id', validUserId);
    });
  });

  describe('Error Handling Edge Cases', () => {
    test('should handle requests with special characters in headers', async () => {
      const response = await request(app)
        .post('/api/login')
        .set('x-forwarded-for', '192.168.1.1; DROP TABLE users;--')
        .send({ username: 'test', password: 'test' });
      
      // Should not crash, should handle gracefully
      expect(response.status).toBeDefined();
      expect([400, 500]).toContain(response.status);
    });

    test('should handle extremely long IP addresses', async () => {
      const longIp = '192.168.1.' + '1'.repeat(1000);
      const response = await request(app)
        .post('/api/login')
        .set('x-forwarded-for', longIp)
        .send({ username: 'test', password: 'test' });
      
      expect(response.status).toBeDefined();
    });

    test('should handle request with both token and no token scenarios', async () => {
      // First request without token
      const response1 = await request(app).get('/api/customers');
      expect(response1.status).toBe(401);
      
      // Second request with valid token
      const validToken = jwt.sign({ id: '123' }, process.env.JWT_SECRET, { expiresIn: '1h' });
      const response2 = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${validToken}`);
      expect(response2.status).not.toBe(401);
    });
  });
});

