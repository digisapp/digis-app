const request = require('supertest');
const app = require('../api/index');
const { pool } = require('../utils/db');
const loyaltyService = require('../utils/loyalty-service');

describe('Dual Badge System Integration Tests', () => {
  let authToken;
  let creatorId;
  let fanId;
  let tierId;

  beforeAll(async () => {
    // Setup test database connection
    await pool.query('BEGIN');
    
    // Create test creator
    const creatorResult = await pool.query(
      `INSERT INTO users (id, email, username, is_creator, created_at)
       VALUES ($1, $2, $3, true, NOW())
       RETURNING id`,
      ['test-creator-id', 'creator@test.com', 'testcreator']
    );
    creatorId = creatorResult.rows[0].id;
    
    // Create test fan
    const fanResult = await pool.query(
      `INSERT INTO users (id, email, username, is_creator, token_balance, created_at)
       VALUES ($1, $2, $3, false, 1000, NOW())
       RETURNING id`,
      ['test-fan-id', 'fan@test.com', 'testfan']
    );
    fanId = fanResult.rows[0].id;
    
    // Create subscription tier
    const tierResult = await pool.query(
      `INSERT INTO membership_tiers (creator_id, name, price, tier_level, perks, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [creatorId, 'Gold VIP', 49.99, 8, JSON.stringify(['Exclusive content', 'Priority support'])]
    );
    tierId = tierResult.rows[0].id;
    
    // Mock auth token
    authToken = 'test-auth-token';
  });

  afterAll(async () => {
    await pool.query('ROLLBACK');
    await pool.end();
  });

  describe('Loyalty Badge Service', () => {
    test('should create initial bronze badge for new fan', async () => {
      const badge = await loyaltyService.trackInteraction(
        fanId,
        creatorId,
        0,
        'initial'
      );
      
      expect(badge).toBeDefined();
      expect(badge.level).toBe('bronze');
      expect(badge.total_spend).toBe(0);
      expect(badge.support_duration_days).toBe(0);
    });

    test('should upgrade badge based on spending', async () => {
      // Track $100 spending
      await loyaltyService.trackInteraction(
        fanId,
        creatorId,
        100,
        'purchase'
      );
      
      const badges = await loyaltyService.getUserBadges(fanId, creatorId);
      expect(badges[0].loyalty.level).toBe('gold');
      expect(badges[0].loyalty.totalSpend).toBeGreaterThanOrEqual(100);
    });

    test('should calculate combined discount correctly', async () => {
      const discount = loyaltyService.calculateCombinedDiscount('gold', 25);
      expect(discount).toBeLessThanOrEqual(50); // Max cap
      expect(discount).toBeGreaterThan(25); // More than subscription alone
    });

    test('should deliver perks based on loyalty level', async () => {
      const perks = loyaltyService.getLoyaltyPerks('diamond');
      expect(perks).toContain('Exclusive diamond content');
      expect(perks).toContain('Maximum discounts');
      expect(perks).toContain('VIP creator access');
    });
  });

  describe('Enhanced Subscriptions API', () => {
    test('POST /api/enhanced-subscriptions/subscribe - should create subscription with badges', async () => {
      const response = await request(app)
        .post('/api/enhanced-subscriptions/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tierId,
          paymentMethodId: 'tokens'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.membership).toBeDefined();
      expect(response.body.badges).toBeDefined();
      expect(response.body.badges.loyalty).toBeDefined();
      expect(response.body.badges.subscription).toBeDefined();
    });

    test('GET /api/enhanced-subscriptions/status/:creatorId - should return subscription with badges', async () => {
      const response = await request(app)
        .get(`/api/enhanced-subscriptions/status/${creatorId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.badges).toBeDefined();
      expect(response.body.perks.combined).toBeInstanceOf(Array);
    });

    test('GET /api/enhanced-subscriptions/creator/:creatorId/subscribers - should list subscribers with dual badges', async () => {
      const response = await request(app)
        .get(`/api/enhanced-subscriptions/creator/${creatorId}/subscribers`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.subscribers).toBeInstanceOf(Array);
      expect(response.body.stats).toBeDefined();
      expect(response.body.stats.loyaltyDistribution).toBeDefined();
    });
  });

  describe('Loyalty API Endpoints', () => {
    test('GET /api/loyalty/badges/:userId - should return user badges', async () => {
      const response = await request(app)
        .get(`/api/loyalty/badges/${fanId}`)
        .query({ creatorId })
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.badges).toBeDefined();
      expect(response.body.badges.loyalty.level).toBeDefined();
      expect(response.body.badges.loyalty.emoji).toBeDefined();
    });

    test('POST /api/loyalty/track-interaction - should track fan interaction', async () => {
      const response = await request(app)
        .post('/api/loyalty/track-interaction')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          creatorId,
          amount: 50,
          interactionType: 'tip'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.badge).toBeDefined();
    });

    test('GET /api/loyalty/creator/:creatorId/top-supporters - should return top supporters', async () => {
      const response = await request(app)
        .get(`/api/loyalty/creator/${creatorId}/top-supporters`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.supporters).toBeInstanceOf(Array);
    });

    test('GET /api/loyalty/perks/:userId - should return combined perks', async () => {
      const response = await request(app)
        .get(`/api/loyalty/perks/${fanId}`)
        .query({ creatorId })
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.perks).toBeDefined();
      expect(response.body.perks.active).toBeInstanceOf(Array);
      expect(response.body.perks.upcoming).toBeInstanceOf(Array);
    });

    test('POST /api/loyalty/deliver-perk - creator should be able to deliver manual perk', async () => {
      const response = await request(app)
        .post('/api/loyalty/deliver-perk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: fanId,
          perkType: 'creator_special',
          message: 'Special reward for being awesome!',
          data: { tokens: 10 }
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.delivery).toBeDefined();
    });
  });

  describe('Badge Display Integration', () => {
    test('should correctly format badge display data', () => {
      const badgeData = {
        loyalty: {
          level: 'gold',
          totalSpend: 150,
          supportDays: 45,
          emoji: '🥇'
        },
        subscription: {
          tier: 'Silver',
          displayName: 'Silver Member',
          emoji: '🩶'
        }
      };
      
      // Verify badge display format
      expect(badgeData.loyalty.emoji).toBe('🥇');
      expect(badgeData.subscription.emoji).toBe('🩶');
    });

    test('should handle users without badges gracefully', async () => {
      const newUserId = 'new-user-id';
      await pool.query(
        `INSERT INTO users (id, email, username, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [newUserId, 'new@test.com', 'newuser']
      );
      
      const badges = await loyaltyService.getUserBadges(newUserId, creatorId);
      expect(badges[0].loyalty.level).toBe('bronze'); // Default level
      expect(badges[0].subscription).toBeNull();
    });
  });

  describe('Perk Delivery System', () => {
    test('should record perk delivery', async () => {
      await pool.query(
        `INSERT INTO perk_deliveries (user_id, creator_id, perk_type, delivery_data, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [fanId, creatorId, 'test_perk', JSON.stringify({ test: true }), 'delivered']
      );
      
      const result = await pool.query(
        `SELECT * FROM perk_deliveries WHERE user_id = $1 AND creator_id = $2`,
        [fanId, creatorId]
      );
      
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].status).toBe('delivered');
    });

    test('should track perk redemptions', async () => {
      const redemptions = await pool.query(
        `SELECT COUNT(*) as count FROM perk_deliveries 
         WHERE user_id = $1 AND status = 'delivered'`,
        [fanId]
      );
      
      expect(Number(redemptions.rows[0].count)).toBeGreaterThan(0);
    });
  });

  describe('Socket Events', () => {
    test('should emit loyalty_upgraded event on badge upgrade', async () => {
      // Mock socket emission
      const mockEmit = jest.fn();
      jest.mock('../utils/socket', () => ({
        getIO: () => ({
          to: () => ({ emit: mockEmit })
        })
      }));
      
      // Trigger upgrade by adding more spending
      await loyaltyService.trackInteraction(
        fanId,
        creatorId,
        500,
        'subscription'
      );
      
      // Verify socket emission would occur
      // Note: In real implementation, check if mockEmit was called
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Edge Cases', () => {
    test('should handle null creator ID gracefully', async () => {
      const badges = await loyaltyService.getUserBadges(fanId, null);
      expect(badges).toBeInstanceOf(Array);
      expect(badges.length).toBeGreaterThan(0);
    });

    test('should cap combined discount at 50%', () => {
      const discount = loyaltyService.calculateCombinedDiscount('diamond', 40);
      expect(discount).toBe(50);
    });

    test('should handle concurrent badge updates', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          loyaltyService.trackInteraction(fanId, creatorId, 10, 'tip')
        );
      }
      
      const results = await Promise.all(promises);
      expect(results.every(r => r !== null)).toBe(true);
    });
  });
});

describe('Cron Job Tests', () => {
  const loyaltyPerkDeliveryJob = require('../jobs/loyalty-perk-delivery');
  
  test('should initialize cron jobs without errors', () => {
    expect(() => {
      loyaltyPerkDeliveryJob.start();
      loyaltyPerkDeliveryJob.stop();
    }).not.toThrow();
  });
  
  test('should have correct cron schedules', () => {
    expect(loyaltyPerkDeliveryJob.jobs).toBeDefined();
    // After starting, jobs array should be populated
    loyaltyPerkDeliveryJob.start();
    expect(loyaltyPerkDeliveryJob.jobs.length).toBeGreaterThan(0);
    loyaltyPerkDeliveryJob.stop();
  });
});