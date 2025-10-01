const request = require('supertest');
const app = require('../../api/index');
const { pool } = require('../../utils/db');
const { supabaseAdmin } = require('../../utils/supabase-admin');
const jwt = require('jsonwebtoken');

// Mock Supabase admin
jest.mock('../../utils/supabase-admin', () => ({
  supabaseAdmin: jest.fn(() => ({
    auth: {
      admin: {
        updateUserById: jest.fn().mockResolvedValue({ data: {}, error: null }),
        deleteUser: jest.fn().mockResolvedValue({ data: {}, error: null })
      }
    }
  }))
}));

describe('Auth API Integration Tests', () => {
  let server;
  let testUserId;
  let authToken;
  
  beforeAll(async () => {
    // Start server on a different port for testing
    server = app.listen(0); // Random available port
    
    // Create a test database schema if needed
    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        supabase_id UUID UNIQUE,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        is_creator BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `).catch(() => {}); // Ignore if already exists
  });
  
  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE supabase_id = $1', [testUserId]);
      await pool.query('DELETE FROM token_balances WHERE supabase_user_id = $1', [testUserId]);
      await pool.query('DELETE FROM creator_applications WHERE supabase_user_id = $1', [testUserId]);
    }
    
    // Close connections
    await pool.end();
    await new Promise(resolve => server.close(resolve));
  });
  
  describe('POST /api/auth/sync-user', () => {
    it('should create a new fan user successfully', async () => {
      testUserId = 'test-' + Date.now();
      const testEmail = `test-${Date.now()}@example.com`;
      
      const response = await request(server)
        .post('/api/auth/sync-user')
        .set('Authorization', 'Bearer test-token')
        .send({
          supabaseId: testUserId,
          email: testEmail,
          metadata: {
            account_type: 'fan',
            full_name: 'Test User'
          }
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        isNewUser: true,
        user: {
          supabase_id: testUserId,
          email: testEmail,
          is_creator: false,
          username: expect.stringMatching(/^user\d{6}$/)
        }
      });
      
      // Verify token balance was created
      const balanceResult = await pool.query(
        'SELECT * FROM token_balances WHERE supabase_user_id = $1',
        [testUserId]
      );
      expect(balanceResult.rows).toHaveLength(1);
      expect(balanceResult.rows[0].balance).toBe('0.00');
    });
    
    it('should create a creator application when signing up as creator', async () => {
      const creatorId = 'creator-' + Date.now();
      const creatorEmail = `creator-${Date.now()}@example.com`;
      
      const response = await request(server)
        .post('/api/auth/sync-user')
        .set('Authorization', 'Bearer test-token')
        .send({
          supabaseId: creatorId,
          email: creatorEmail,
          metadata: {
            account_type: 'creator',
            username: 'testcreator',
            display_name: 'Test Creator'
          }
        });
      
      expect(response.status).toBe(200);
      expect(response.body.user.username).toBe('testcreator');
      
      // Verify creator application was created
      const appResult = await pool.query(
        'SELECT * FROM creator_applications WHERE supabase_user_id = $1',
        [creatorId]
      );
      expect(appResult.rows).toHaveLength(1);
      expect(appResult.rows[0].status).toBe('pending');
      
      // Clean up
      await pool.query('DELETE FROM creator_applications WHERE supabase_user_id = $1', [creatorId]);
      await pool.query('DELETE FROM token_balances WHERE supabase_user_id = $1', [creatorId]);
      await pool.query('DELETE FROM users WHERE supabase_id = $1', [creatorId]);
    });
    
    it('should update existing user on sync', async () => {
      const response = await request(server)
        .post('/api/auth/sync-user')
        .set('Authorization', 'Bearer test-token')
        .send({
          supabaseId: testUserId,
          email: `test-${Date.now()}@example.com`,
          metadata: {}
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        isNewUser: false,
        user: {
          supabase_id: testUserId
        }
      });
    });
  });
  
  describe('GET /api/auth/profile', () => {
    beforeEach(() => {
      // Mock authentication middleware
      authToken = jwt.sign(
        { 
          supabase_id: testUserId,
          email: 'test@example.com',
          isCreator: false 
        },
        process.env.JWT_SECRET || 'test-secret'
      );
    });
    
    it('should get user profile with token balance', async () => {
      const response = await request(server)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        profile: {
          supabase_id: testUserId,
          token_balance: '0.00',
          follower_count: '0',
          following_count: '0'
        }
      });
    });
    
    it('should return 401 without auth token', async () => {
      const response = await request(server)
        .get('/api/auth/profile');
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('PUT /api/auth/profile', () => {
    it('should update user profile successfully', async () => {
      const response = await request(server)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          display_name: 'Updated Name',
          bio: 'Updated bio'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        profile: {
          display_name: 'Updated Name',
          bio: 'Updated bio'
        }
      });
    });
    
    it('should prevent fans from changing username', async () => {
      const response = await request(server)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'newusername'
        });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Fans cannot change their username');
    });
  });
  
  describe('GET /api/auth/check-username/:username', () => {
    it('should check username availability', async () => {
      const response = await request(server)
        .get('/api/auth/check-username/availableusername');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        available: true,
        username: 'availableusername'
      });
    });
    
    it('should detect taken usernames', async () => {
      // First get the actual username
      const profileResponse = await request(server)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);
      
      const existingUsername = profileResponse.body.profile.username;
      
      const response = await request(server)
        .get(`/api/auth/check-username/${existingUsername}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        available: false,
        username: existingUsername.toLowerCase()
      });
    });
  });
  
  describe('DELETE /api/auth/account', () => {
    it('should require email confirmation', async () => {
      const response = await request(server)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          confirmEmail: 'wrong@example.com'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Email confirmation does not match');
    });
    
    // Note: Actual deletion test would delete our test user, 
    // so we skip it to keep other tests working
  });
  
  describe('GET /api/auth/migration-status', () => {
    it('should return migration status for authenticated user', async () => {
      const response = await request(server)
        .get('/api/auth/migration-status')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        hasSupabaseId: true,
        migrationComplete: true,
        user: {
          email: expect.any(String),
          username: expect.any(String),
          isCreator: false
        }
      });
    });
  });
});