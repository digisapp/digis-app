const redis = require('redis');

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn().mockResolvedValue(undefined),
  on: jest.fn()
};

// Mock Redis module
jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient)
}));

// Mock pg module
jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn()
  };
  
  const mockPool = {
    connect: jest.fn(() => Promise.resolve(mockClient)),
    query: jest.fn(),
    end: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    totalCount: 10,
    idleCount: 5,
    waitingCount: 0,
    _options: { max: 20 }
  };
  
  return { Pool: jest.fn(() => mockPool) };
});

// Import after mocks are set up
const {
  pool,
  query,
  getUserBySupabaseId,
  getCreators,
  createUser,
  updateUserProfile,
  getSessionById,
  getActiveSessions,
  getUserSessions,
  getCreatorEarnings,
  searchCreators,
  createSession,
  endSession,
  createPayment,
  cacheUtils,
  queryMetrics,
  getPoolStats
} = require('../utils/db-with-cache');

const { Pool } = require('pg');
const mockPool = new Pool();
const mockClient = { 
  query: jest.fn(), 
  release: jest.fn() 
};

describe('Database with Cache Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockClient);
    // Reset query metrics
    queryMetrics.queryCount = 0;
    queryMetrics.totalDuration = 0;
    queryMetrics.slowQueries = [];
  });

  afterAll(async () => {
    await pool.end();
    if (mockRedisClient) {
      await mockRedisClient.quit();
    }
  });

  describe('Redis Cache Integration', () => {
    test('should initialize Redis client', async () => {
      // Wait for Redis initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(redis.createClient).toHaveBeenCalledWith({
        url: expect.stringContaining('redis://'),
        socket: expect.objectContaining({
          reconnectStrategy: expect.any(Function)
        })
      });
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });

    test('cacheUtils should provide cache functions', () => {
      expect(cacheUtils).toHaveProperty('get');
      expect(cacheUtils).toHaveProperty('set');
      expect(cacheUtils).toHaveProperty('delete');
      expect(cacheUtils).toHaveProperty('client');
    });
  });

  describe('Cached User Operations', () => {
    test('getUserBySupabaseId should use cache on hit', async () => {
      const cachedUser = { id: 1, supabase_id: 'test-uid', bio: 'Cached user' };
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cachedUser));
      
      const user = await getUserBySupabaseId('test-uid');
      
      expect(user).toEqual(cachedUser);
      expect(mockRedisClient.get).toHaveBeenCalledWith('user:test-uid');
      expect(mockClient.query).not.toHaveBeenCalled(); // Should not hit database
    });

    test('getUserBySupabaseId should query database on cache miss', async () => {
      const dbUser = { id: 1, supabase_id: 'test-uid', bio: 'DB user' };
      mockRedisClient.get.mockResolvedValueOnce(null); // Cache miss
      mockClient.query.mockResolvedValueOnce({ rows: [dbUser], rowCount: 1 });
      mockRedisClient.setEx.mockResolvedValueOnce('OK');
      
      const user = await getUserBySupabaseId('test-uid');
      
      expect(user).toEqual(dbUser);
      expect(mockRedisClient.get).toHaveBeenCalledWith('user:test-uid');
      expect(mockClient.query).toHaveBeenCalled();
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'user:test-uid',
        300, // USER_TTL
        JSON.stringify(dbUser)
      );
    });

    test('createUser should invalidate user cache', async () => {
      const newUser = { id: 1, supabase_id: 'new-uid', is_creator: true };
      mockClient.query.mockResolvedValueOnce({ rows: [newUser], rowCount: 1 });
      mockRedisClient.keys.mockResolvedValueOnce(['user:new-uid']);
      mockRedisClient.del.mockResolvedValueOnce(1);
      
      await createUser('new-uid', true, 'Bio', 'pic.jpg', 2.00);
      
      expect(mockRedisClient.keys).toHaveBeenCalledWith('user:new-uid*');
      expect(mockRedisClient.keys).toHaveBeenCalledWith('creators:*');
    });

    test('updateUserProfile should invalidate caches', async () => {
      const updatedUser = { id: 1, supabase_id: 'test-uid', bio: 'Updated' };
      mockClient.query.mockResolvedValueOnce({ rows: [updatedUser], rowCount: 1 });
      mockRedisClient.keys
        .mockResolvedValueOnce(['user:test-uid'])
        .mockResolvedValueOnce(['creators:all']);
      mockRedisClient.del.mockResolvedValue(1);
      
      await updateUserProfile('test-uid', { bio: 'Updated', is_creator: true });
      
      expect(mockRedisClient.keys).toHaveBeenCalledWith('user:test-uid*');
      expect(mockRedisClient.keys).toHaveBeenCalledWith('creators:*');
    });
  });

  describe('Cached Creator Operations', () => {
    test('getCreators should use cache on hit', async () => {
      const cachedCreators = [
        { id: 1, is_creator: true },
        { id: 2, is_creator: true }
      ];
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cachedCreators));
      
      const creators = await getCreators();
      
      expect(creators).toEqual(cachedCreators);
      expect(mockRedisClient.get).toHaveBeenCalledWith('creators:all');
      expect(mockClient.query).not.toHaveBeenCalled();
    });

    test('getCreators should cache database results', async () => {
      const dbCreators = [{ id: 1, is_creator: true }];
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockClient.query.mockResolvedValueOnce({ rows: dbCreators, rowCount: 1 });
      mockRedisClient.setEx.mockResolvedValueOnce('OK');
      
      const creators = await getCreators();
      
      expect(creators).toEqual(dbCreators);
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'creators:all',
        60, // CREATORS_TTL
        JSON.stringify(dbCreators)
      );
    });

    test('searchCreators should cache search results', async () => {
      const searchResults = [{ id: 1, bio: 'test creator' }];
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockClient.query.mockResolvedValueOnce({ rows: searchResults, rowCount: 1 });
      mockRedisClient.setEx.mockResolvedValueOnce('OK');
      
      const results = await searchCreators('test', 10, 0);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'search:creators:test:10:0',
        30, // Short TTL for search results
        JSON.stringify({ rows: searchResults, rowCount: 1 })
      );
    });
  });

  describe('Cached Session Operations', () => {
    test('getSessionById should use cache', async () => {
      const cachedSession = { id: 1, creator_id: 1, fan_id: 2 };
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cachedSession));
      
      const session = await getSessionById(1);
      
      expect(session).toEqual(cachedSession);
      expect(mockRedisClient.get).toHaveBeenCalledWith('session:1');
    });

    test('createSession should invalidate session caches', async () => {
      const newSession = { id: 1, creator_id: 1, fan_id: 2 };
      mockClient.query.mockResolvedValueOnce({ rows: [newSession], rowCount: 1 });
      mockRedisClient.keys.mockResolvedValue([]);
      
      await createSession(1, 2, 'video');
      
      expect(mockRedisClient.keys).toHaveBeenCalledWith('sessions:user:1*');
      expect(mockRedisClient.keys).toHaveBeenCalledWith('sessions:user:2*');
      expect(mockRedisClient.keys).toHaveBeenCalledWith('sessions:active:*');
    });

    test('endSession should invalidate related caches', async () => {
      const endedSession = { id: 1, creator_id: 1, fan_id: 2, end_time: new Date() };
      mockClient.query.mockResolvedValueOnce({ rows: [endedSession], rowCount: 1 });
      mockRedisClient.keys.mockResolvedValue([]);
      
      await endSession(1);
      
      expect(mockRedisClient.keys).toHaveBeenCalledWith('session:1*');
      expect(mockRedisClient.keys).toHaveBeenCalledWith('sessions:user:1*');
      expect(mockRedisClient.keys).toHaveBeenCalledWith('sessions:user:2*');
    });

    test('getUserSessions should cache results', async () => {
      const sessions = [{ id: 1 }, { id: 2 }];
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockClient.query.mockResolvedValueOnce({ rows: sessions, rowCount: 2 });
      mockRedisClient.setEx.mockResolvedValueOnce('OK');
      
      await getUserSessions(1, 10, 0);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'sessions:user:1:10:0',
        180, // SESSION_TTL
        expect.any(String)
      );
    });

    test('getActiveSessions should use short cache TTL', async () => {
      const activeSessions = [{ id: 1, end_time: null }];
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockClient.query.mockResolvedValueOnce({ rows: activeSessions, rowCount: 1 });
      mockRedisClient.setEx.mockResolvedValueOnce('OK');
      
      await getActiveSessions(1);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'sessions:active:1',
        30, // Short TTL for active sessions
        expect.any(String)
      );
    });
  });

  describe('Cached Earnings and Stats', () => {
    test('getCreatorEarnings should cache statistics', async () => {
      const earnings = { 
        total_earnings: '1000.00',
        total_payments: '20',
        unique_customers: '10',
        average_payment: '50.00'
      };
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockClient.query.mockResolvedValueOnce({ rows: [earnings], rowCount: 1 });
      mockRedisClient.setEx.mockResolvedValueOnce('OK');
      
      await getCreatorEarnings(1);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'earnings:1',
        600, // STATS_TTL
        expect.any(String)
      );
    });

    test('createPayment should invalidate earnings cache', async () => {
      const payment = { id: 1, session_id: 1, amount: 50.00 };
      const session = { id: 1, creator_id: 1, fan_id: 2 };
      
      mockClient.query
        .mockResolvedValueOnce({ rows: [payment], rowCount: 1 }) // createPayment
        .mockResolvedValueOnce({ rows: [session], rowCount: 1 }); // getSessionById
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.keys.mockResolvedValue([]);
      
      await createPayment(1, 50.00, 10.00);
      
      expect(mockRedisClient.keys).toHaveBeenCalledWith('payments:user:1*');
      expect(mockRedisClient.keys).toHaveBeenCalledWith('earnings:1*');
    });
  });

  describe('Query Performance Monitoring', () => {
    test('should track query metrics', async () => {
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
      
      await query('SELECT 1');
      await query('SELECT 2');
      
      expect(queryMetrics.queryCount).toBe(2);
      expect(queryMetrics.totalDuration).toBeGreaterThan(0);
    });

    test('should track slow queries', async () => {
      // Simulate slow query
      mockClient.query.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ rows: [], rowCount: 0 }), 1100)
        )
      );
      
      await query('SELECT SLOW');
      
      expect(queryMetrics.slowQueries).toHaveLength(1);
      expect(queryMetrics.slowQueries[0]).toMatchObject({
        query: expect.stringContaining('SELECT SLOW'),
        duration: expect.any(Number),
        timestamp: expect.any(Date)
      });
      expect(queryMetrics.slowQueries[0].duration).toBeGreaterThan(1000);
    }, 2000);

    test('getPoolStats should include cache and query metrics', () => {
      queryMetrics.queryCount = 10;
      queryMetrics.totalDuration = 500;
      queryMetrics.slowQueries = [{}];
      
      const stats = getPoolStats();
      
      expect(stats).toMatchObject({
        totalCount: 10,
        idleCount: 5,
        waitingCount: 0,
        max: 20,
        utilizationPercent: 25,
        isHealthy: true,
        cacheEnabled: true,
        queryMetrics: {
          totalQueries: 10,
          avgDuration: 50,
          slowQueries: 1
        }
      });
    });
  });

  describe('Cache Error Handling', () => {
    test('should continue without cache on Redis errors', async () => {
      const dbUser = { id: 1, supabase_id: 'test-uid' };
      mockRedisClient.get.mockRejectedValueOnce(new Error('Redis error'));
      mockClient.query.mockResolvedValueOnce({ rows: [dbUser], rowCount: 1 });
      
      const user = await getUserBySupabaseId('test-uid');
      
      expect(user).toEqual(dbUser);
      expect(mockClient.query).toHaveBeenCalled(); // Falls back to database
    });

    test('should handle cache set errors gracefully', async () => {
      const dbUser = { id: 1, supabase_id: 'test-uid' };
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockClient.query.mockResolvedValueOnce({ rows: [dbUser], rowCount: 1 });
      mockRedisClient.setEx.mockRejectedValueOnce(new Error('Cache set error'));
      
      const user = await getUserBySupabaseId('test-uid');
      
      expect(user).toEqual(dbUser); // Should still return data
    });

    test('should handle cache delete errors gracefully', async () => {
      const newUser = { id: 1, supabase_id: 'new-uid' };
      mockClient.query.mockResolvedValueOnce({ rows: [newUser], rowCount: 1 });
      mockRedisClient.keys.mockRejectedValueOnce(new Error('Keys error'));
      
      // Should not throw
      await expect(createUser('new-uid', false)).resolves.toBeDefined();
    });
  });

  describe('Enhanced Schema Validation', () => {
    test('should add constraints and indexes', async () => {
      mockClient.query.mockResolvedValue({});
      
      // Import addMissingColumns
      const { addMissingColumns } = require('../utils/db-with-cache');
      await addMissingColumns();
      
      // Should execute BEGIN/COMMIT
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      
      // Should add constraints
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CHECK (total_sessions >= 0)')
      );
      
      // Should create indexes
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS')
      );
      
      // Should add triggers
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE OR REPLACE FUNCTION update_updated_at_column')
      );
    });

    test('should rollback on schema update error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Schema error'));
      
      const { addMissingColumns } = require('../utils/db-with-cache');
      
      await expect(addMissingColumns()).rejects.toThrow('Schema error');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});