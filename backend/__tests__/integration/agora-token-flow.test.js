const request = require('supertest');
const app = require('../../api/index');
const { pool } = require('../../utils/db');

// Mock Supabase Auth SDK
const mockVerifyIdToken = jest.fn();
jest.mock('../../../middleware/auth-enhanced', () => ({
  verifySupabaseToken: jest.fn().mockImplementation((req, res, next) => {
    req.user = { id: 'test-user-123', supabase_id: 'test-user-123' };
    next();
  })
}));,
}));

// Mock Agora token generation
const mockRtcTokenBuilder = {
  buildTokenWithUid: jest.fn(),
};

jest.mock('agora-token', () => ({
  RtcTokenBuilder: mockRtcTokenBuilder,
  RtcRole: {
    PUBLISHER: 1,
    SUBSCRIBER: 2,
  },
}));

// Mock database connection
jest.mock('../../utils/db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

describe('Agora Token Generation Integration Tests', () => {
  const validSupabaseToken = 'valid-supabase-token';
  const mockUser = {
    uid: 'test-user-123',
    email: 'test@example.com',
  };

  beforeAll(() => {
    // Set required environment variables
    process.env.AGORA_APP_ID = 'test-agora-app-id';
    process.env.AGORA_APP_CERTIFICATE = 'test-agora-certificate';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockVerifyIdToken.mockResolvedValue(mockUser);
    mockRtcTokenBuilder.buildTokenWithUid.mockReturnValue('mock-rtc-token-12345');
    pool.query.mockResolvedValue({ rows: [] });
  });

  describe('GET /agora/test', () => {
    test('returns service status without authentication', async () => {
      const response = await request(app)
        .get('/agora/test')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Agora route working',
        environment: {
          hasAppId: true,
          hasAppCertificate: true,
        },
      });
    });

    test('shows missing environment configuration', async () => {
      delete process.env.AGORA_APP_ID;

      const response = await request(app)
        .get('/agora/test')
        .expect(200);

      expect(response.body.environment.hasAppId).toBe(false);

      // Restore for other tests
      process.env.AGORA_APP_ID = 'test-agora-app-id';
    });
  });

  describe('GET /agora/token', () => {
    const validTokenRequest = {
      channel: 'test-channel-123',
      uid: '12345',
      role: 'host',
    };

    test('successfully generates RTC token for host', async () => {
      const response = await request(app)
        .get('/agora/token')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .query(validTokenRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        rtcToken: 'mock-rtc-token-12345',
        chatToken: expect.any(String),
        token: expect.any(String),
        channel: 'test-channel-123',
        uid: 12345,
        role: 'host',
        expiresAt: expect.any(String),
        expiresIn: 7200,
        appId: 'test-agora-app-id',
      });

      expect(mockRtcTokenBuilder.buildTokenWithUid).toHaveBeenCalledWith(
        'test-agora-app-id',
        'test-agora-certificate',
        'test-channel-123',
        12345,
        1, // PUBLISHER role
        expect.any(Number)
      );
    });

    test('successfully generates RTC token for audience', async () => {
      const audienceRequest = { ...validTokenRequest, role: 'audience' };

      const response = await request(app)
        .get('/agora/token')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .query(audienceRequest)
        .expect(200);

      expect(response.body.role).toBe('audience');
      expect(mockRtcTokenBuilder.buildTokenWithUid).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        2, // SUBSCRIBER role
        expect.any(Number)
      );
    });

    test('rejects request without authentication', async () => {
      const response = await request(app)
        .get('/agora/token')
        .query(validTokenRequest)
        .expect(401);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('token'),
      });
    });

    test('validates required parameters', async () => {
      const response = await request(app)
        .get('/agora/token')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .query({ channel: 'test-channel' }) // Missing uid and role
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Missing required parameters (channel, uid, role)',
        required: ['channel', 'uid', 'role'],
      });
    });

    test('validates UID format', async () => {
      const invalidUidRequest = { ...validTokenRequest, uid: 'invalid-uid' };

      const response = await request(app)
        .get('/agora/token')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .query(invalidUidRequest)
        .expect(400);

      expect(response.body.error).toContain('UID must be a positive number');
    });

    test('validates role values', async () => {
      const invalidRoleRequest = { ...validTokenRequest, role: 'invalid-role' };

      const response = await request(app)
        .get('/agora/token')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .query(invalidRoleRequest)
        .expect(400);

      expect(response.body.error).toContain('Role must be either "host" or "audience"');
    });

    test('validates channel name format', async () => {
      const invalidChannelRequest = { ...validTokenRequest, channel: 'invalid@channel!' };

      const response = await request(app)
        .get('/agora/token')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .query(invalidChannelRequest)
        .expect(400);

      expect(response.body.error).toContain('Channel name must be alphanumeric');
    });

    test('handles token generation failure', async () => {
      mockRtcTokenBuilder.buildTokenWithUid.mockImplementation(() => {
        throw new Error('Token generation failed');
      });

      const response = await request(app)
        .get('/agora/token')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .query(validTokenRequest)
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Internal server error during token generation',
        details: 'Token generation failed',
      });
    });

    test('handles Supabase token verification failure', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid Supabase token'));

      const response = await request(app)
        .get('/agora/token')
        .set('Authorization', `Bearer invalid-token`)
        .query(validTokenRequest)
        .expect(401);

      expect(response.body.error).toContain('token');
    });
  });

  describe('POST /agora/validate', () => {
    test('validates custom token successfully', async () => {
      // Generate a valid custom token structure
      const tokenData = {
        appId: 'test-agora-app-id',
        channel: 'test-channel',
        uid: 12345,
        role: 'host',
        timestamp: Math.floor(Date.now() / 1000),
        expire: Math.floor(Date.now() / 1000) + 7200,
      };

      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', 'test-agora-certificate')
        .update(JSON.stringify(tokenData))
        .digest('hex');

      const customToken = Buffer.from(JSON.stringify({
        ...tokenData,
        signature,
      })).toString('base64');

      const response = await request(app)
        .post('/agora/validate')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .send({
          token: customToken,
          type: 'custom',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        valid: true,
        data: expect.objectContaining(tokenData),
      });
    });

    test('rejects token with invalid signature', async () => {
      const invalidToken = Buffer.from(JSON.stringify({
        appId: 'test-agora-app-id',
        channel: 'test-channel',
        signature: 'invalid-signature',
        expire: Math.floor(Date.now() / 1000) + 7200,
      })).toString('base64');

      const response = await request(app)
        .post('/agora/validate')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .send({
          token: invalidToken,
          type: 'custom',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        valid: false,
        error: 'Invalid token signature',
      });
    });

    test('rejects expired token', async () => {
      const expiredTokenData = {
        appId: 'test-agora-app-id',
        channel: 'test-channel',
        expire: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      };

      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', 'test-agora-certificate')
        .update(JSON.stringify(expiredTokenData))
        .digest('hex');

      const expiredToken = Buffer.from(JSON.stringify({
        ...expiredTokenData,
        signature,
      })).toString('base64');

      const response = await request(app)
        .post('/agora/validate')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .send({
          token: expiredToken,
          type: 'custom',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        valid: false,
        error: 'Token has expired',
      });
    });

    test('rejects unsupported token type', async () => {
      const response = await request(app)
        .post('/agora/validate')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .send({
          token: 'some-token',
          type: 'unsupported',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Unsupported token type',
        supportedTypes: ['custom'],
      });
    });
  });

  describe('GET /agora/rtm-token', () => {
    test('generates RTM token successfully', async () => {
      const response = await request(app)
        .get('/agora/rtm-token')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        rtmToken: expect.any(String),
        userId: mockUser.uid,
        expiresAt: expect.any(String),
        expiresIn: 24 * 60 * 60, // 24 hours
      });
    });

    test('generates RTM token with custom uid', async () => {
      const response = await request(app)
        .get('/agora/rtm-token')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .query({ uid: 'custom-user-456' })
        .expect(200);

      expect(response.body.userId).toBe('custom-user-456');
    });

    test('requires authentication for RTM token', async () => {
      const response = await request(app)
        .get('/agora/rtm-token')
        .expect(401);

      expect(response.body.error).toContain('token');
    });
  });

  describe('Chat Message Integration', () => {
    test('stores chat message successfully', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          channel: 'test-channel',
          sender_id: mockUser.uid,
          message: 'Hello, world!',
          type: 'text',
          file_url: null,
          created_at: new Date(),
        }],
      });

      const response = await request(app)
        .post('/agora/chat/message')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .send({
          channel: 'test-channel',
          message: 'Hello, world!',
          type: 'text',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: {
          id: 1,
          channel: 'test-channel',
          senderId: mockUser.uid,
          text: 'Hello, world!',
          type: 'text',
          isOwn: true,
        },
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chat_messages'),
        ['test-channel', mockUser.uid, 'Hello, world!', 'text', undefined]
      );
    });

    test('retrieves chat messages for channel', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            sender_id: 'user-1',
            message: 'First message',
            type: 'text',
            file_url: null,
            created_at: new Date(),
            is_creator: false,
          },
          {
            id: 2,
            sender_id: mockUser.uid,
            message: 'Second message',
            type: 'text',
            file_url: null,
            created_at: new Date(),
            is_creator: true,
          },
        ],
      });

      const response = await request(app)
        .get('/agora/chat/messages/test-channel')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        messages: [
          {
            id: 1,
            senderId: 'user-1',
            text: 'First message',
            isOwn: false,
            ext: { isCreator: false },
          },
          {
            id: 2,
            senderId: mockUser.uid,
            text: 'Second message',
            isOwn: true,
            ext: { isCreator: true },
          },
        ],
      });
    });

    test('deletes chat message by owner', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          sender_id: mockUser.uid,
        }],
      });

      const response = await request(app)
        .delete('/agora/chat/message/1')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Message deleted successfully',
      });

      expect(pool.query).toHaveBeenCalledWith(
        'DELETE FROM chat_messages WHERE id = $1 AND sender_id = $2 RETURNING *',
        ['1', mockUser.uid]
      );
    });

    test('prevents deletion of messages by non-owner', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // No matching rows

      const response = await request(app)
        .delete('/agora/chat/message/1')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .expect(404);

      expect(response.body.error).toContain('not found or unauthorized');
    });
  });

  describe('Channel Information', () => {
    test('retrieves channel information', async () => {
      const response = await request(app)
        .get('/agora/channel/test-channel-123')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        channel: 'test-channel-123',
        active: true,
        participants: 0,
        type: 'rtc',
        settings: {
          maxParticipants: 100,
          allowRecording: true,
          allowScreenShare: true,
        },
      });
    });
  });

  describe('Performance and Load Testing Preparation', () => {
    test('handles concurrent token requests', async () => {
      const concurrentRequests = 10;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .get('/agora/token')
          .set('Authorization', `Bearer ${validSupabaseToken}`)
          .query({
            channel: `test-channel-${i}`,
            uid: (1000 + i).toString(),
            role: 'host',
          });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);

      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.channel).toBe(`test-channel-${index}`);
        expect(response.body.uid).toBe(1000 + index);
      });

      expect(mockRtcTokenBuilder.buildTokenWithUid).toHaveBeenCalledTimes(concurrentRequests);
    });

    test('measures token generation response time', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/agora/token')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .query(validTokenRequest)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    test('handles database connection errors gracefully', async () => {
      pool.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/agora/chat/message')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .send({
          channel: 'test-channel',
          message: 'Test message',
        })
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Failed to save chat message',
        details: 'Database connection failed',
      });
    });
  });

  describe('Security Testing', () => {
    test('prevents token generation without proper authentication', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

      const response = await request(app)
        .get('/agora/token')
        .set('Authorization', 'Bearer malicious-token')
        .query(validTokenRequest)
        .expect(401);

      expect(mockRtcTokenBuilder.buildTokenWithUid).not.toHaveBeenCalled();
    });

    test('sanitizes input parameters', async () => {
      const maliciousRequest = {
        channel: '<script>alert("xss")</script>',
        uid: '12345',
        role: 'host',
      };

      const response = await request(app)
        .get('/agora/token')
        .set('Authorization', `Bearer ${validSupabaseToken}`)
        .query(maliciousRequest)
        .expect(400);

      expect(response.body.error).toContain('Channel name must be alphanumeric');
    });

    test('rate limits token requests', async () => {
      // This would require implementing rate limiting middleware
      // For now, we'll test that the endpoint doesn't crash with many requests
      const rapidRequests = [];
      
      for (let i = 0; i < 100; i++) {
        rapidRequests.push(
          request(app)
            .get('/agora/token')
            .set('Authorization', `Bearer ${validSupabaseToken}`)
            .query(validTokenRequest)
        );
      }

      const responses = await Promise.allSettled(rapidRequests);
      
      // All requests should either succeed or be rate limited, not crash
      responses.forEach((result) => {
        if (result.status === 'fulfilled') {
          expect([200, 429]).toContain(result.value.status);
        }
      });
    });
  });

  afterAll(async () => {
    // Clean up any resources if needed
    if (app && app.close) {
      await app.close();
    }
  });
});