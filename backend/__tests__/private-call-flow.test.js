const request = require('supertest');
const app = require('../api/index');
const { supabaseAdmin } = require('../utils/supabase-admin');

describe('Private Call Flow', () => {
  let fanToken, creatorToken;
  let fanId, creatorId;
  let streamId, requestId, sessionId;

  beforeAll(async () => {
    // Create test users
    const { data: fanData, error: fanError } = await supabaseAdmin.auth.admin.createUser({
      email: 'fan@test.com',
      password: 'password123',
      email_confirm: true
    });
    if (!fanError) {
      fanId = fanData.user.id;
      fanToken = 'test-fan-token'; // In production, this would be a real JWT
    }

    const { data: creatorData, error: creatorError } = await supabaseAdmin.auth.admin.createUser({
      email: 'creator@test.com',
      password: 'password123',
      email_confirm: true
    });
    if (!creatorError) {
      creatorId = creatorData.user.id;
      creatorToken = 'test-creator-token'; // In production, this would be a real JWT
    }

    // Set up test data in database
    await supabaseAdmin
      .from('users')
      .upsert([
        {
          supabase_id: fanId,
          email: 'fan@test.com',
          displayName: 'Test Fan',
          is_creator: false,
          token_balance: 1000
        },
        {
          supabase_id: creatorId,
          email: 'creator@test.com',
          displayName: 'Test Creator',
          is_creator: true,
          token_balance: 0
        }
      ]);

    streamId = `stream_${creatorId}_${Date.now()}`;
  });

  afterAll(async () => {
    // Clean up test data
    if (fanId) {
      await supabaseAdmin.auth.admin.deleteUser(fanId);
    }
    if (creatorId) {
      await supabaseAdmin.auth.admin.deleteUser(creatorId);
    }
  });

  describe('Private Call Request Flow', () => {
    test('Fan can request a private call', async () => {
      const response = await request(app)
        .post('/api/streaming/private-call-request')
        .set('Authorization', `Bearer ${fanToken}`)
        .send({
          streamId,
          creatorId,
          pricePerMinute: 100,
          minimumMinutes: 5,
          estimatedDuration: 10
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('requestId');
      expect(response.body).toHaveProperty('message', 'Private call request sent successfully');
      
      requestId = response.body.requestId;
    });

    test('Fan cannot request without sufficient tokens', async () => {
      const response = await request(app)
        .post('/api/streaming/private-call-request')
        .set('Authorization', `Bearer ${fanToken}`)
        .send({
          streamId,
          creatorId,
          pricePerMinute: 10000, // Very high price
          minimumMinutes: 5,
          estimatedDuration: 10
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Insufficient tokens');
    });

    test('Creator can view pending requests', async () => {
      const response = await request(app)
        .get('/api/streaming/private-call-requests')
        .set('Authorization', `Bearer ${creatorToken}`)
        .query({ streamId });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('requests');
      expect(Array.isArray(response.body.requests)).toBe(true);
    });

    test('Creator can accept a private call request', async () => {
      const response = await request(app)
        .post('/api/streaming/private-call-accept')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          requestId,
          streamId
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('channelName');
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('message', 'Private call started successfully');
      
      sessionId = response.body.sessionId;
    });

    test('Creator can reject a private call request', async () => {
      // Create another request first
      const requestResponse = await request(app)
        .post('/api/streaming/private-call-request')
        .set('Authorization', `Bearer ${fanToken}`)
        .send({
          streamId,
          creatorId,
          pricePerMinute: 50,
          minimumMinutes: 5,
          estimatedDuration: 10
        });

      const newRequestId = requestResponse.body.requestId;

      const response = await request(app)
        .post('/api/streaming/private-call-reject')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          requestId: newRequestId
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Private call request rejected');
    });

    test('Session can be ended with token calculation', async () => {
      // Wait a bit to simulate call duration
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await request(app)
        .post('/api/streaming/private-call-end')
        .set('Authorization', `Bearer ${fanToken}`)
        .send({
          sessionId,
          endReason: 'user_ended',
          finalDuration: 2, // 2 minutes
          finalTokensUsed: 200
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tokensCharged');
      expect(response.body).toHaveProperty('tokensRefunded');
      expect(response.body).toHaveProperty('message', 'Private call ended successfully');
    });
  });

  describe('Token Management', () => {
    test('Tokens are held when request is created', async () => {
      const initialBalance = 1000;
      
      const response = await request(app)
        .post('/api/streaming/private-call-request')
        .set('Authorization', `Bearer ${fanToken}`)
        .send({
          streamId,
          creatorId,
          pricePerMinute: 100,
          minimumMinutes: 5,
          estimatedDuration: 10
        });

      expect(response.status).toBe(200);
      
      // Check that tokens are held (not yet deducted)
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('token_balance')
        .eq('supabase_id', fanId)
        .single();
      
      expect(userData.token_balance).toBeLessThan(initialBalance);
    });

    test('Tokens are refunded when request is rejected', async () => {
      const response = await request(app)
        .post('/api/streaming/private-call-request')
        .set('Authorization', `Bearer ${fanToken}`)
        .send({
          streamId,
          creatorId,
          pricePerMinute: 100,
          minimumMinutes: 5,
          estimatedDuration: 10
        });

      const requestId = response.body.requestId;
      
      const rejectResponse = await request(app)
        .post('/api/streaming/private-call-reject')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ requestId });

      expect(rejectResponse.status).toBe(200);
      
      // Verify tokens are refunded
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('token_balance')
        .eq('supabase_id', fanId)
        .single();
      
      // Should have tokens refunded
      expect(userData.token_balance).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('Cannot accept non-existent request', async () => {
      const response = await request(app)
        .post('/api/streaming/private-call-accept')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          requestId: 'non-existent-id',
          streamId
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Request not found or already processed');
    });

    test('Cannot end non-existent session', async () => {
      const response = await request(app)
        .post('/api/streaming/private-call-end')
        .set('Authorization', `Bearer ${fanToken}`)
        .send({
          sessionId: 'non-existent-session',
          endReason: 'user_ended',
          finalDuration: 1,
          finalTokensUsed: 100
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Session not found');
    });
  });
});