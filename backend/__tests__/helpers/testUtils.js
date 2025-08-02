const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a test JWT token
 */
const generateTestToken = (payload = {}) => {
  const defaultPayload = {
    supabase_id: uuidv4(),
    email: `test-${Date.now()}@example.com`,
    username: `user${Math.floor(100000 + Math.random() * 900000)}`,
    isCreator: false,
    isAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
  };
  
  return jwt.sign(
    { ...defaultPayload, ...payload },
    process.env.JWT_SECRET || 'test-secret'
  );
};

/**
 * Create mock Supabase auth header
 */
const createSupabaseAuthHeader = (userId) => {
  return {
    'Authorization': `Bearer ${generateTestToken({ supabase_id: userId })}`
  };
};

/**
 * Clean up test user data
 */
const cleanupTestUser = async (pool, userId) => {
  const tables = [
    'tips',
    'followers',
    'creator_subscriptions',
    'token_transactions',
    'token_balances',
    'payments',
    'sessions',
    'creator_applications',
    'notifications',
    'users'
  ];
  
  for (const table of tables) {
    try {
      await pool.query(
        `DELETE FROM ${table} WHERE supabase_user_id = $1 OR supabase_id = $1 OR user_id = $1`,
        [userId]
      );
    } catch (err) {
      // Ignore errors, some columns might not exist in all tables
    }
  }
};

/**
 * Create test user in database
 */
const createTestUser = async (pool, options = {}) => {
  const userId = options.userId || uuidv4();
  const email = options.email || `test-${Date.now()}@example.com`;
  const username = options.username || `user${Math.floor(100000 + Math.random() * 900000)}`;
  
  const userResult = await pool.query(`
    INSERT INTO users (
      supabase_id,
      email,
      email_verified,
      username,
      display_name,
      is_creator,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING *
  `, [
    userId,
    email,
    true,
    username,
    options.displayName || username,
    options.isCreator || false
  ]);
  
  // Create token balance
  await pool.query(`
    INSERT INTO token_balances (
      supabase_user_id,
      balance,
      created_at
    ) VALUES ($1, $2, NOW())
  `, [userId, options.initialBalance || 0]);
  
  return userResult.rows[0];
};

/**
 * Mock WebSocket for Socket.io tests
 */
class MockSocket {
  constructor() {
    this.events = {};
    this.rooms = new Set();
  }
  
  on(event, callback) {
    this.events[event] = callback;
  }
  
  emit(event, data) {
    if (this.events[event]) {
      this.events[event](data);
    }
  }
  
  join(room) {
    this.rooms.add(room);
  }
  
  leave(room) {
    this.rooms.delete(room);
  }
  
  to(room) {
    return {
      emit: (event, data) => {
        // Mock emit to room
      }
    };
  }
}

/**
 * Wait for async operations
 */
const waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock Stripe customer/payment method
 */
const mockStripeCustomer = {
  id: 'cus_test123',
  email: 'test@example.com',
  metadata: {
    userId: 'test-user-id'
  }
};

const mockStripePaymentMethod = {
  id: 'pm_test123',
  type: 'card',
  card: {
    brand: 'visa',
    last4: '4242',
    exp_month: 12,
    exp_year: 2025
  }
};

module.exports = {
  generateTestToken,
  createSupabaseAuthHeader,
  cleanupTestUser,
  createTestUser,
  MockSocket,
  waitFor,
  mockStripeCustomer,
  mockStripePaymentMethod
};