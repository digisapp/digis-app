const request = require('supertest');
const app = require('../../api/index');
const { pool } = require('../../utils/db');
const { 
  generateTestToken, 
  createTestUser, 
  cleanupTestUser,
  MockSocket,
  waitFor
} = require('../helpers/testUtils');

// Mock Agora token generation
jest.mock('agora-token', () => ({
  RtcTokenBuilder: {
    buildTokenWithUid: jest.fn(() => 'mock-rtc-token-12345')
  },
  RtcRole: {
    PUBLISHER: 1,
    SUBSCRIBER: 2
  }
}));

describe('Video Call API Integration Tests', () => {
  let server;
  let creatorUser;
  let fanUser;
  let creatorToken;
  let fanToken;
  let mockIo;
  
  beforeAll(async () => {
    server = app.listen(0);
    
    // Create test users
    creatorUser = await createTestUser(pool, {
      email: 'creator@example.com',
      username: 'testcreator',
      isCreator: true,
      initialBalance: 0
    });
    
    fanUser = await createTestUser(pool, {
      email: 'fan@example.com',
      username: 'testfan',
      isCreator: false,
      initialBalance: 1000 // Enough tokens for calls
    });
    
    // Set creator's price per minute
    await pool.query(
      'UPDATE users SET price_per_min = $1 WHERE supabase_id = $2',
      [10, creatorUser.supabase_id]
    );
    
    creatorToken = generateTestToken({
      supabase_id: creatorUser.supabase_id,
      email: creatorUser.email,
      username: creatorUser.username,
      isCreator: true
    });
    
    fanToken = generateTestToken({
      supabase_id: fanUser.supabase_id,
      email: fanUser.email,
      username: fanUser.username,
      isCreator: false
    });
    
    // Mock Socket.io
    mockIo = {
      to: jest.fn(() => ({
        emit: jest.fn()
      }))
    };
    app.set('io', mockIo);
  });
  
  afterAll(async () => {
    await cleanupTestUser(pool, creatorUser.supabase_id);
    await cleanupTestUser(pool, fanUser.supabase_id);
    await pool.end();
    await new Promise(resolve => server.close(resolve));
  });
  
  describe('GET /api/agora/token', () => {
    it('should generate Agora tokens for video calls', async () => {
      const response = await request(server)
        .get('/api/agora/token')
        .query({
          channel: 'test-channel-123',
          uid: '12345',
          role: 'host'
        })
        .set('Authorization', `Bearer ${creatorToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        rtcToken: expect.any(String),
        chatToken: expect.any(String),
        channel: 'test-channel-123',
        uid: 12345,
        role: 'host',
        expiresAt: expect.any(Number)
      });
    });
    
    it('should validate required parameters', async () => {
      const response = await request(server)
        .get('/api/agora/token')
        .query({ channel: 'test' }) // Missing uid and role
        .set('Authorization', `Bearer ${fanToken}`);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required parameters');
    });
    
    it('should validate role values', async () => {
      const response = await request(server)
        .get('/api/agora/token')
        .query({
          channel: 'test-channel',
          uid: '12345',
          role: 'invalid-role'
        })
        .set('Authorization', `Bearer ${fanToken}`);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Role must be either "host" or "audience"');
    });
  });
  
  describe('POST /api/users/sessions/join', () => {
    it('should allow fan to join creator session', async () => {
      const response = await request(server)
        .post('/api/users/sessions/join')
        .set('Authorization', `Bearer ${fanToken}`)
        .send({
          creatorId: creatorUser.supabase_id,
          sessionType: 'video'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        session: expect.objectContaining({
          channel: expect.any(String),
          creator_id: creatorUser.id,
          fan_id: fanUser.id,
          session_type: 'video',
          status: 'active',
          price_per_min: '10.00'
        }),
        agoraToken: expect.any(String),
        chatToken: expect.any(String)
      });
    });
    
    it('should check fan has sufficient balance', async () => {
      // Set fan balance to 0
      await pool.query(
        'UPDATE token_balances SET balance = 0 WHERE supabase_user_id = $1',
        [fanUser.supabase_id]
      );
      
      const response = await request(server)
        .post('/api/users/sessions/join')
        .set('Authorization', `Bearer ${fanToken}`)
        .send({
          creatorId: creatorUser.supabase_id,
          sessionType: 'video'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Insufficient token balance');
      
      // Restore balance
      await pool.query(
        'UPDATE token_balances SET balance = 1000 WHERE supabase_user_id = $1',
        [fanUser.supabase_id]
      );
    });
    
    it('should prevent creators from joining other creators', async () => {
      const response = await request(server)
        .post('/api/users/sessions/join')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          creatorId: fanUser.supabase_id,
          sessionType: 'video'
        });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Creators cannot join other sessions');
    });
  });
  
  describe('POST /api/users/sessions/:sessionId/end', () => {
    let activeSession;
    
    beforeEach(async () => {
      // Create an active session
      const sessionResult = await pool.query(`
        INSERT INTO sessions (
          channel,
          creator_id,
          fan_id,
          session_type,
          status,
          price_per_min,
          start_time
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `, [
        'test-session-' + Date.now(),
        creatorUser.id,
        fanUser.id,
        'video',
        'active',
        10
      ]);
      activeSession = sessionResult.rows[0];
    });
    
    it('should end session and calculate billing', async () => {
      // Wait a bit to accumulate some duration
      await waitFor(1000);
      
      const response = await request(server)
        .post(`/api/users/sessions/${activeSession.id}/end`)
        .set('Authorization', `Bearer ${fanToken}`)
        .send({});
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        session: expect.objectContaining({
          status: 'ended',
          duration_minutes: expect.any(Number),
          tokens_cost: expect.any(String)
        }),
        billing: expect.objectContaining({
          duration_minutes: expect.any(Number),
          tokens_charged: expect.any(Number),
          creator_earnings: expect.any(Number)
        })
      });
      
      // Verify tokens were transferred
      const fanBalance = await pool.query(
        'SELECT balance FROM token_balances WHERE supabase_user_id = $1',
        [fanUser.supabase_id]
      );
      expect(Number(fanBalance.rows[0].balance)).toBeLessThan(1000);
      
      const creatorBalance = await pool.query(
        'SELECT balance FROM token_balances WHERE supabase_user_id = $1',
        [creatorUser.supabase_id]
      );
      expect(Number(creatorBalance.rows[0].balance)).toBeGreaterThan(0);
    });
    
    it('should prevent double-ending sessions', async () => {
      // End session first time
      await request(server)
        .post(`/api/users/sessions/${activeSession.id}/end`)
        .set('Authorization', `Bearer ${fanToken}`)
        .send({});
      
      // Try to end again
      const response = await request(server)
        .post(`/api/users/sessions/${activeSession.id}/end`)
        .set('Authorization', `Bearer ${fanToken}`)
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Session is not active');
    });
    
    it('should only allow session participants to end session', async () => {
      const otherUser = await createTestUser(pool, {
        email: 'other@example.com'
      });
      const otherToken = generateTestToken({
        supabase_id: otherUser.supabase_id
      });
      
      const response = await request(server)
        .post(`/api/users/sessions/${activeSession.id}/end`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({});
      
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('not a participant');
      
      await cleanupTestUser(pool, otherUser.supabase_id);
    });
  });
  
  describe('Chat during video calls', () => {
    let activeSession;
    
    beforeEach(async () => {
      const sessionResult = await pool.query(`
        INSERT INTO sessions (
          channel,
          creator_id,
          fan_id,
          session_type,
          status,
          start_time
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *
      `, [
        'chat-test-' + Date.now(),
        creatorUser.id,
        fanUser.id,
        'video',
        'active'
      ]);
      activeSession = sessionResult.rows[0];
    });
    
    describe('POST /api/agora/chat/message', () => {
      it('should store chat messages during calls', async () => {
        const response = await request(server)
          .post('/api/agora/chat/message')
          .set('Authorization', `Bearer ${fanToken}`)
          .send({
            channel: activeSession.channel,
            message: 'Hello creator!',
            type: 'text'
          });
        
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          message: expect.objectContaining({
            channel: activeSession.channel,
            senderId: fanUser.supabase_id,
            text: 'Hello creator!',
            type: 'text',
            isOwn: true
          })
        });
      });
      
      it('should support file messages', async () => {
        const response = await request(server)
          .post('/api/agora/chat/message')
          .set('Authorization', `Bearer ${creatorToken}`)
          .send({
            channel: activeSession.channel,
            message: 'Shared file',
            type: 'file',
            fileUrl: 'https://example.com/file.pdf'
          });
        
        expect(response.status).toBe(200);
        expect(response.body.message).toMatchObject({
          type: 'file',
          fileUrl: 'https://example.com/file.pdf'
        });
      });
    });
    
    describe('GET /api/agora/chat/messages/:channel', () => {
      it('should retrieve chat history', async () => {
        // Send a few messages
        await request(server)
          .post('/api/agora/chat/message')
          .set('Authorization', `Bearer ${fanToken}`)
          .send({
            channel: activeSession.channel,
            message: 'Message 1'
          });
        
        await request(server)
          .post('/api/agora/chat/message')
          .set('Authorization', `Bearer ${creatorToken}`)
          .send({
            channel: activeSession.channel,
            message: 'Message 2'
          });
        
        const response = await request(server)
          .get(`/api/agora/chat/messages/${activeSession.channel}`)
          .set('Authorization', `Bearer ${fanToken}`);
        
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          messages: expect.arrayContaining([
            expect.objectContaining({
              text: 'Message 1',
              senderId: fanUser.supabase_id,
              isOwn: true
            }),
            expect.objectContaining({
              text: 'Message 2',
              senderId: creatorUser.supabase_id,
              isOwn: false
            })
          ])
        });
      });
    });
  });
  
  describe('Session history and analytics', () => {
    it('should track session history for users', async () => {
      const response = await request(server)
        .get('/api/users/sessions/history')
        .set('Authorization', `Bearer ${fanToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        sessions: expect.arrayContaining([
          expect.objectContaining({
            session_type: 'video',
            status: expect.stringMatching(/active|ended/),
            creator_username: creatorUser.username
          })
        ])
      });
    });
    
    it('should provide creator earnings summary', async () => {
      const response = await request(server)
        .get('/api/analytics/creator/earnings')
        .set('Authorization', `Bearer ${creatorToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        earnings: expect.objectContaining({
          total_earned: expect.any(String),
          total_sessions: expect.any(String),
          total_minutes: expect.any(String)
        })
      });
    });
  });
});