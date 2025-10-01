const { 
  pool, 
  query, 
  getClient, 
  testConnection,
  createUser,
  getUserBySupabaseId,
  getCreators,
  updateUserProfile,
  createSession,
  endSession,
  getUserSessions,
  createPayment,
  getPaymentHistory,
  getCreatorEarnings,
  searchCreators,
  getSessionById,
  getActiveSessions,
  transaction,
  healthCheck,
  getPoolStats,
  addMissingColumns
} = require('../utils/db');

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

// Get mocked pool and client
const { Pool } = require('pg');
const mockPool = new Pool();
const mockClient = { 
  query: jest.fn(), 
  release: jest.fn() 
};

describe('Database Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockClient);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Connection Management', () => {
    test('testConnection should successfully connect and check database', async () => {
      // Mock successful queries
      mockClient.query
        .mockResolvedValueOnce({ 
          rows: [{ 
            current_time: new Date(), 
            database_name: 'test_db',
            version: 'PostgreSQL 14.0' 
          }] 
        })
        .mockResolvedValueOnce({ rows: [{ table_name: 'users' }, { table_name: 'sessions' }] })
        .mockResolvedValueOnce({ rows: [{ column_name: 'id', data_type: 'integer' }] })
        .mockResolvedValueOnce({ rows: [{ column_name: 'id', data_type: 'integer' }] })
        .mockResolvedValueOnce({ rows: [{ column_name: 'id', data_type: 'integer' }] });

      const result = await testConnection();
      
      expect(result).toBe(true);
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    test('testConnection should handle connection errors', async () => {
      mockPool.connect.mockRejectedValueOnce(new Error('Connection refused'));
      
      const result = await testConnection();
      
      expect(result).toBe(false);
      expect(mockPool.connect).toHaveBeenCalled();
    });

    test('getClient should return a client with retry logic', async () => {
      mockPool.connect
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce(mockClient);
      
      const client = await getClient();
      
      expect(client).toBe(mockClient);
      expect(mockPool.connect).toHaveBeenCalledTimes(2);
    });

    test('getClient should throw after max retries', async () => {
      mockPool.connect.mockRejectedValue(new Error('ETIMEDOUT'));
      
      await expect(getClient()).rejects.toThrow('ETIMEDOUT');
      expect(mockPool.connect).toHaveBeenCalledTimes(3); // 3 retries
    });
  });

  describe('Query Execution', () => {
    test('query should execute successfully', async () => {
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockClient.query.mockResolvedValueOnce(mockResult);
      
      const result = await query('SELECT * FROM users WHERE id = $1', [1]);
      
      expect(result).toEqual(mockResult);
      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
      expect(mockClient.release).toHaveBeenCalled();
    });

    test('query should retry on transient errors', async () => {
      const mockResult = { rows: [], rowCount: 0 };
      mockClient.query
        .mockRejectedValueOnce(new Error('Connection terminated'))
        .mockResolvedValueOnce(mockResult);
      
      const result = await query('SELECT 1');
      
      expect(result).toEqual(mockResult);
      expect(mockClient.query).toHaveBeenCalledTimes(2);
    });

    test('query should handle specific error codes', async () => {
      const authError = new Error('Authentication failed');
      authError.code = '28P01';
      mockClient.query.mockRejectedValueOnce(authError);
      
      await expect(query('SELECT 1')).rejects.toThrow('Database authentication failed');
    });
  });

  describe('User Operations', () => {
    test('createUser should insert a new user', async () => {
      const mockUser = { 
        id: 1, 
        supabase_id: 'test-uid', 
        is_creator: true,
        bio: 'Test bio',
        profile_pic_url: 'https://example.com/pic.jpg',
        price_per_min: 2.50
      };
      mockClient.query.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 });
      
      const result = await createUser('test-uid', true, 'Test bio', 'https://example.com/pic.jpg', 2.50);
      
      expect(result.rows[0]).toEqual(mockUser);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['test-uid', true, 'Test bio', 'https://example.com/pic.jpg', 2.50]
      );
    });

    test('getUserBySupabaseId should return user or null', async () => {
      const mockUser = { id: 1, supabase_id: 'test-uid' };
      mockClient.query.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 });

      const user = await getUserBySupabaseId('test-uid');

      expect(user).toEqual(mockUser);
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE supabase_id = $1',
        ['test-uid']
      );
    });

    test('getUserBySupabaseId should return null for non-existent user', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const user = await getUserBySupabaseId('non-existent');

      expect(user).toBeNull();
    });

    test('getCreators should return all creators', async () => {
      const mockCreators = [
        { id: 1, supabase_id: 'creator1', is_creator: true },
        { id: 2, supabase_id: 'creator2', is_creator: true }
      ];
      mockClient.query.mockResolvedValueOnce({ rows: mockCreators, rowCount: 2 });
      
      const creators = await getCreators();
      
      expect(creators).toEqual(mockCreators);
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE is_creator = TRUE ORDER BY id DESC',
        undefined
      );
    });

    test('updateUserProfile should update allowed fields', async () => {
      const updates = { bio: 'Updated bio', price_per_min: 3.00 };
      const mockUpdatedUser = { id: 1, supabase_id: 'test-uid', ...updates };
      mockClient.query.mockResolvedValueOnce({ rows: [mockUpdatedUser], rowCount: 1 });
      
      const result = await updateUserProfile('test-uid', updates);
      
      expect(result.rows[0]).toEqual(mockUpdatedUser);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        ['Updated bio', 3.00, 'test-uid']
      );
    });

    test('updateUserProfile should throw error for invalid fields', async () => {
      await expect(updateUserProfile('test-uid', {})).rejects.toThrow('No valid fields to update');
    });

    test('searchCreators should find creators by search term', async () => {
      const mockResults = [{ id: 1, bio: 'test creator' }];
      mockClient.query.mockResolvedValueOnce({ rows: mockResults, rowCount: 1 });
      
      const results = await searchCreators('test');
      
      expect(results).toEqual({ rows: mockResults, rowCount: 1 });
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(bio) LIKE $1'),
        ['%test%', 20, 0]
      );
    });
  });

  describe('Session Operations', () => {
    test('createSession should create a new session', async () => {
      const mockSession = { 
        id: 1, 
        creator_id: 1, 
        fan_id: 2, 
        type: 'video',
        start_time: new Date()
      };
      mockClient.query.mockResolvedValueOnce({ rows: [mockSession], rowCount: 1 });
      
      const result = await createSession(1, 2, 'video');
      
      expect(result.rows[0]).toEqual(mockSession);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sessions'),
        [1, 2, 'video']
      );
    });

    test('endSession should update end_time', async () => {
      const mockEndedSession = { 
        id: 1, 
        end_time: new Date()
      };
      mockClient.query.mockResolvedValueOnce({ rows: [mockEndedSession], rowCount: 1 });
      
      const result = await endSession(1);
      
      expect(result.rows[0]).toEqual(mockEndedSession);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sessions'),
        [1]
      );
    });

    test('getSessionById should return session with user details', async () => {
      const mockSession = { 
        id: 1,
        creator_supabase_id: 'creator1',
        member_supabase_id: 'member1'
      };
      mockClient.query.mockResolvedValueOnce({ rows: [mockSession], rowCount: 1 });
      
      const session = await getSessionById(1);
      
      expect(session).toEqual(mockSession);
    });

    test('getUserSessions should return paginated sessions', async () => {
      const mockSessions = [{ id: 1 }, { id: 2 }];
      mockClient.query.mockResolvedValueOnce({ rows: mockSessions, rowCount: 2 });
      
      const result = await getUserSessions(1, 10, 0);
      
      expect(result.rows).toEqual(mockSessions);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE s.creator_id = $1 OR s.fan_id = $1'),
        [1, 10, 0]
      );
    });

    test('getActiveSessions should return sessions without end_time', async () => {
      const mockActiveSessions = [{ id: 1, end_time: null }];
      mockClient.query.mockResolvedValueOnce({ rows: mockActiveSessions, rowCount: 1 });
      
      const result = await getActiveSessions(1);
      
      expect(result.rows).toEqual(mockActiveSessions);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('AND s.end_time IS NULL'),
        [1]
      );
    });
  });

  describe('Payment Operations', () => {
    test('createPayment should insert payment record', async () => {
      const mockPayment = { 
        id: 1, 
        session_id: 1, 
        amount: 50.00,
        tip: 10.00
      };
      mockClient.query.mockResolvedValueOnce({ rows: [mockPayment], rowCount: 1 });
      
      const result = await createPayment(1, 50.00, 10.00);
      
      expect(result.rows[0]).toEqual(mockPayment);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payments'),
        [1, 50.00, 10.00]
      );
    });

    test('getPaymentHistory should return paginated payments', async () => {
      const mockPayments = [{ id: 1, amount: 50.00 }];
      mockClient.query.mockResolvedValueOnce({ rows: mockPayments, rowCount: 1 });
      
      const result = await getPaymentHistory(1, 10, 0);
      
      expect(result.rows).toEqual(mockPayments);
    });

    test('getCreatorEarnings should return earnings summary', async () => {
      const mockEarnings = { 
        total_earnings: '500.00',
        total_payments: '10',
        unique_customers: '5',
        average_payment: '50.00'
      };
      mockClient.query.mockResolvedValueOnce({ rows: [mockEarnings], rowCount: 1 });
      
      const result = await getCreatorEarnings(1);
      
      expect(result.rows[0]).toEqual(mockEarnings);
    });
  });

  describe('Transaction Support', () => {
    test('transaction should handle successful transaction', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Callback query
        .mockResolvedValueOnce({}); // COMMIT
      
      const result = await transaction(async (client) => {
        return await client.query('SELECT 1');
      });
      
      expect(result.rows[0]).toEqual({ id: 1 });
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    test('transaction should rollback on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Transaction error')); // Callback query
      
      await expect(transaction(async (client) => {
        throw new Error('Transaction error');
      })).rejects.toThrow('Transaction error');
      
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('Health and Monitoring', () => {
    test('healthCheck should return true when healthy', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ health: 1 }] });
      
      const isHealthy = await healthCheck();
      
      expect(isHealthy).toBe(true);
    });

    test('healthCheck should return false on error', async () => {
      mockPool.connect.mockRejectedValueOnce(new Error('Connection failed'));
      
      const isHealthy = await healthCheck();
      
      expect(isHealthy).toBe(false);
    });

    test('healthCheck should timeout after 5 seconds', async () => {
      mockPool.connect.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 6000))
      );
      
      const isHealthy = await healthCheck();
      
      expect(isHealthy).toBe(false);
    }, 10000);

    test('getPoolStats should return pool statistics', () => {
      const stats = getPoolStats();
      
      expect(stats).toEqual({
        totalCount: 10,
        idleCount: 5,
        waitingCount: 0,
        max: 20,
        utilizationPercent: 25,
        isHealthy: true
      });
    });
  });

  describe('Schema Management', () => {
    test('addMissingColumns should add columns and constraints', async () => {
      mockClient.query.mockResolvedValue({});
      
      await addMissingColumns();
      
      // Should execute ALTER TABLE commands
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ALTER TABLE users')
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ALTER TABLE sessions')
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ALTER TABLE payments')
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    test('addMissingColumns should handle errors gracefully', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Column already exists'));
      
      // Should not throw, just log
      await expect(addMissingColumns()).resolves.not.toThrow();
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle authentication errors', async () => {
      const authError = new Error('Authentication failed');
      authError.code = '28P01';
      mockClient.query.mockRejectedValueOnce(authError);
      
      await expect(query('SELECT 1')).rejects.toThrow('Database authentication failed');
    });

    test('should handle connection refused errors', async () => {
      const connError = new Error('Connection refused');
      connError.code = 'ECONNREFUSED';
      mockClient.query.mockRejectedValueOnce(connError);
      
      await expect(query('SELECT 1')).rejects.toThrow('Database connection refused');
    });

    test('should handle timeout errors', async () => {
      const timeoutError = new Error('Query timeout');
      timeoutError.code = 'ETIMEDOUT';
      mockClient.query.mockRejectedValueOnce(timeoutError);
      
      await expect(query('SELECT 1')).rejects.toThrow('Database query timed out');
    });

    test('should handle unique constraint violations', async () => {
      const uniqueError = new Error('Duplicate key');
      uniqueError.code = '23505';
      mockClient.query.mockRejectedValueOnce(uniqueError);
      
      await expect(query('INSERT INTO users')).rejects.toThrow('Duplicate key error');
    });

    test('should handle foreign key violations', async () => {
      const fkError = new Error('Foreign key violation');
      fkError.code = '23503';
      mockClient.query.mockRejectedValueOnce(fkError);
      
      await expect(query('INSERT INTO sessions')).rejects.toThrow('Referenced record does not exist');
    });
  });

  describe('Retry Logic', () => {
    test('should retry on transient errors', async () => {
      mockClient.query
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce({ rows: [] });
      
      await query('SELECT 1');
      
      expect(mockClient.query).toHaveBeenCalledTimes(2);
    });

    test('should not retry on non-transient errors', async () => {
      const error = new Error('Syntax error');
      error.code = '42601';
      mockClient.query.mockRejectedValueOnce(error);
      
      await expect(query('SELECT 1')).rejects.toThrow('Syntax error');
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    test('should use exponential backoff for retries', async () => {
      const start = Date.now();
      mockClient.query
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce({ rows: [] });
      
      await query('SELECT 1');
      
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThan(500); // At least 500ms for retries
      expect(mockClient.query).toHaveBeenCalledTimes(3);
    });
  });
});