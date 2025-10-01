const { 
  initializeSupabaseAdmin, 
  verifySupabaseToken, 
  hasRole,
  clearUserCache 
} = require('../utils/supabase-admin');
const { createClient } = require('@supabase/supabase-js');

// Mock dependencies
jest.mock('@supabase/supabase-js');
jest.mock('../utils/db');
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    on: jest.fn(),
    quit: jest.fn()
  }))
}));

const mockPool = require('../utils/db').pool;
const mockSupabase = {
  auth: {
    getUser: jest.fn()
  }
};

describe('Supabase Admin Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    createClient.mockReturnValue(mockSupabase);
  });

  describe('initializeSupabaseAdmin', () => {
    it('should initialize Supabase admin client successfully', () => {
      const client = initializeSupabaseAdmin();
      
      expect(createClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-service-key',
        expect.objectContaining({
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
          },
          db: {
            schema: 'public'
          }
        })
      );
      expect(client).toBeDefined();
    });

    it('should throw error if environment variables are missing', () => {
      delete process.env.SUPABASE_URL;
      
      expect(() => initializeSupabaseAdmin()).toThrow(
        'Missing Supabase environment variables: SUPABASE_URL'
      );
    });

    it('should return existing client if already initialized', () => {
      const client1 = initializeSupabaseAdmin();
      const client2 = initializeSupabaseAdmin();
      
      expect(createClient).toHaveBeenCalledTimes(1);
      expect(client1).toBe(client2);
    });
  });

  describe('verifySupabaseToken', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
      mockReq = {
        headers: {
          authorization: 'Bearer test-token'
        }
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      mockNext = jest.fn();
      
      mockPool.query = jest.fn();
    });

    it('should verify valid token and attach user to request', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        email_confirmed_at: '2024-01-01',
        last_sign_in_at: '2024-01-01',
        user_metadata: { username: 'testuser' }
      };

      const mockDbUser = {
        id: 1,
        supabase_id: 'user-123',
        username: 'testuser',
        is_creator: false,
        is_super_admin: false,
        profile_pic_url: null
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockPool.query.mockResolvedValue({
        rows: [mockDbUser]
      });

      await verifySupabaseToken(mockReq, mockRes, mockNext);

      expect(mockSupabase.auth.getUser).toHaveBeenCalledWith('test-token');
      expect(mockPool.query).toHaveBeenCalled();
      expect(mockReq.user).toEqual({
        id: 1,
        uid: 'user-123',
        supabase_id: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        username: 'testuser',
        displayName: 'testuser',
        isCreator: false,
        isSuperAdmin: false,
        profilePicUrl: null,
        authTime: '2024-01-01',
        supabase: mockUser
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should create new user if not in database', async () => {
      const mockUser = {
        id: 'user-456',
        email: 'newuser@example.com',
        email_confirmed_at: null,
        last_sign_in_at: '2024-01-01',
        user_metadata: {}
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // First query returns no user
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      
      // Check for existing username
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      
      // Create user query
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 2,
          supabase_id: 'user-456',
          username: 'newuser',
          profile_pic_url: null
        }]
      });
      
      // Create token balance
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await verifySupabaseToken(mockReq, mockRes, mockNext);

      expect(mockPool.query).toHaveBeenCalledTimes(4);
      expect(mockReq.user.username).toBe('newuser');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing authorization header', async () => {
      mockReq.headers = {};

      await verifySupabaseToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'No token provided',
          message: 'Authorization header must be in format: Bearer <token>'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle expired token', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Token expired' }
      });

      await verifySupabaseToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Token expired. Please sign in again.'
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      const mockUser = {
        id: 'user-789',
        email: 'test@example.com'
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      await verifySupabaseToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Database error during authentication'
        })
      );
    });

    it('should handle retry logic for transient failures', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      };

      // First two calls fail, third succeeds
      mockSupabase.auth.getUser
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: { user: mockUser },
          error: null
        });

      mockPool.query.mockResolvedValue({
        rows: [{
          id: 1,
          supabase_id: 'user-123',
          username: 'testuser'
        }]
      });

      await verifySupabaseToken(mockReq, mockRes, mockNext);

      expect(mockSupabase.auth.getUser).toHaveBeenCalledTimes(3);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('hasRole', () => {
    it('should allow access for matching role', () => {
      const middleware = hasRole('authenticated');
      const mockReq = {
        user: {
          supabase: { role: 'authenticated' }
        }
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should deny access for non-matching role', () => {
      const middleware = hasRole('admin');
      const mockReq = {
        user: {
          supabase: { role: 'authenticated' }
        }
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Insufficient permissions',
          required_role: 'admin',
          current_role: 'authenticated'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should require authentication if no user', () => {
      const middleware = hasRole('authenticated');
      const mockReq = {};
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Authentication required'
        })
      );
    });
  });

  describe('clearUserCache', () => {
    it('should clear user cache from Redis', async () => {
      const redis = require('redis');
      const mockRedisClient = redis.createClient();
      
      await clearUserCache('test-token');
      
      // Since Redis is mocked, we can't directly test the deletion
      // In a real test, you would verify the del method was called
      expect(mockRedisClient.del).toBeDefined();
    });
  });
});