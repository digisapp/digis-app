const { db } = require('./db');
const { supabaseAdmin } = require('./supabase-admin');
const winston = require('winston');
const redis = require('redis');

// Initialize Redis client
let redisClient;
const initRedis = async () => {
  if (!redisClient) {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) return new Error('Redis reconnection limit reached');
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error', { error: err.message });
    });

    redisClient.on('connect', () => {
      logger.info('Redis Client Connected');
    });

    try {
      await redisClient.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis', { error: error.message });
      // Continue without Redis - fallback to database only
    }
  }
  return redisClient;
};

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/payouts.log' })
  ]
});

// Cache helper functions
const cache = {
  async get(key) {
    try {
      if (!redisClient?.isReady) return null;
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.warn('Cache get error', { key, error: error.message });
      return null;
    }
  },

  async set(key, value, ttl = 3600) {
    try {
      if (!redisClient?.isReady) return;
      await redisClient.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.warn('Cache set error', { key, error: error.message });
    }
  },

  async invalidate(pattern) {
    try {
      if (!redisClient?.isReady) return;
      // Use SCAN instead of KEYS for production safety
      let cursor = 0;
      let toDelete = [];
      do {
        const result = await redisClient.scan(cursor, {
          MATCH: pattern,
          COUNT: 100
        });
        cursor = result.cursor;
        if (result.keys && result.keys.length > 0) {
          toDelete.push(...result.keys);
        }
      } while (cursor !== 0);

      if (toDelete.length > 0) {
        await redisClient.del(toDelete);
      }
    } catch (error) {
      logger.warn('Cache invalidate error', { pattern, error: error.message });
    }
  },

  // Distributed lock implementation using Redis SET NX EX
  async acquireLock(key, ttl = 30) {
    try {
      if (!redisClient?.isReady) return true; // Fallback to allow processing
      const lockKey = `lock:${key}`;
      const lockValue = `${process.pid}_${Date.now()}`;
      const result = await redisClient.set(lockKey, lockValue, {
        NX: true, // Only set if not exists
        EX: ttl   // Expire after TTL seconds
      });
      return result === 'OK' ? lockValue : null;
    } catch (error) {
      logger.error('Failed to acquire lock', { key, error: error.message });
      return null;
    }
  },

  async releaseLock(key, lockValue) {
    try {
      if (!redisClient?.isReady) return;
      const lockKey = `lock:${key}`;
      // Only release if we own the lock
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await redisClient.eval(script, {
        keys: [lockKey],
        arguments: [lockValue]
      });
    } catch (error) {
      logger.error('Failed to release lock', { key, error: error.message });
    }
  }
};

// Import stripe-connect (mocked if not available)
let stripeConnect;
try {
  stripeConnect = require('./stripe-connect');
} catch (error) {
  logger.warn('stripe-connect not found, using mock implementation');
  stripeConnect = {
    createPayout: async (accountId, amount, metadata) => {
      logger.info('Mock: Creating payout', { accountId, amount, metadata });
      return { id: `mock_payout_${Date.now()}`, status: 'pending' };
    },
    retryFailedPayout: async (payoutId) => {
      logger.info('Mock: Retrying payout', { payoutId });
      return { id: payoutId, status: 'paid' };
    },
    updateAccountStatus: async (accountId) => {
      logger.info('Mock: Updating account status', { accountId });
      return { status: 'active' };
    }
  };
}

class PayoutProcessor {
  constructor() {
    this.processingLock = new Map();
  }

  /**
   * Initialize the processor
   */
  async initialize() {
    await initRedis();
    logger.info('Payout processor initialized');
  }

  /**
   * Process scheduled payouts with caching
   */
  async processScheduledPayouts() {
    const startTime = Date.now();
    logger.info('Starting scheduled payout processing');

    try {
      // Check cache first
      const cacheKey = `payouts:scheduled:${new Date().toISOString().split('T')[0]}`;
      const cached = await cache.get(cacheKey);
      if (cached && cached.timestamp > Date.now() - 300000) { // 5 min cache
        logger.info('Using cached payout data', { 
          creatorCount: cached.data.length,
          cacheAge: Date.now() - cached.timestamp 
        });
        return cached.data;
      }

      // Get eligible creators with optimized query
      const eligibleCreators = await this.getEligibleCreators();
      logger.info(`Found ${eligibleCreators.length} eligible creators for payout`);

      const results = [];
      const batchSize = 10;

      // Process in batches for better performance
      for (let i = 0; i < eligibleCreators.length; i += batchSize) {
        const batch = eligibleCreators.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(creator => this.processCreatorPayout(creator))
        );
        results.push(...batchResults);
      }

      // Cache results
      await cache.set(cacheKey, {
        timestamp: Date.now(),
        data: results
      }, 3600); // 1 hour cache

      // Summary statistics
      const stats = {
        total: results.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        totalAmount: results.reduce((sum, r) => sum + (r.amount || 0), 0),
        processingTime: Date.now() - startTime
      };

      logger.info('Payout processing completed', stats);
      await this.sendAdminNotification('Payout Processing Complete', stats);

      return results;
    } catch (error) {
      logger.error('Failed to process scheduled payouts', { error: error.message });
      throw error;
    }
  }

  /**
   * Get eligible creators with caching
   */
  async getEligibleCreators() {
    const cacheKey = 'payouts:eligible_creators';
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const query = `
      SELECT DISTINCT
        c.creator_id,
        u.email,
        u.username,
        csa.stripe_account_id,
        cps.minimum_payout_amount,
        cps.payout_frequency,
        cps.is_enabled,
        COALESCE(
          (SELECT SUM(amount) 
           FROM creator_earnings ce 
           WHERE ce.creator_id = c.creator_id 
           AND ce.status = 'pending'),
          0
        ) as pending_balance,
        COALESCE(
          (SELECT MAX(created_at) 
           FROM creator_payouts cp 
           WHERE cp.creator_id = c.creator_id 
           AND cp.status = 'completed'),
          '1970-01-01'::timestamp
        ) as last_payout_date
      FROM creator_payout_settings cps
      JOIN users u ON u.supabase_id = cps.creator_id
      JOIN creator_stripe_accounts csa ON csa.creator_id = cps.creator_id
      JOIN (
        SELECT DISTINCT creator_id 
        FROM creator_earnings 
        WHERE status = 'pending'
      ) c ON c.creator_id = cps.creator_id
      WHERE cps.is_enabled = true
      AND csa.status = 'active'
      AND csa.payouts_enabled = true
    `;

    const result = await db.query(query);
    const creators = result.rows.filter(creator => {
      // Check if creator meets payout criteria
      if (creator.pending_balance < creator.minimum_payout_amount) {
        return false;
      }

      // Check payout frequency
      const daysSinceLastPayout = Math.floor(
        (Date.now() - new Date(creator.last_payout_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      switch (creator.payout_frequency) {
        case 'daily':
          return daysSinceLastPayout >= 1;
        case 'weekly':
          return daysSinceLastPayout >= 7;
        case 'biweekly':
          return daysSinceLastPayout >= 14;
        case 'monthly':
          return daysSinceLastPayout >= 30;
        default:
          return false;
      }
    });

    // Cache for 5 minutes
    await cache.set(cacheKey, creators, 300);
    return creators;
  }

  /**
   * Process individual creator payout with distributed locking
   */
  async processCreatorPayout(creator) {
    const { creator_id, stripe_account_id, pending_balance, email, username } = creator;

    // Acquire distributed lock using Redis
    const lockKey = `payout:creator:${creator_id}`;
    const lockValue = await cache.acquireLock(lockKey, 60); // 60 second TTL

    if (!lockValue) {
      logger.warn('Could not acquire lock for creator payout', { creator_id });
      return { creator_id, status: 'skipped', reason: 'already_processing' };
    }

    try {
      // Begin transaction
      await db.query('BEGIN');

      // Lock earnings records
      const earningsQuery = `
        SELECT id, amount, type, reference_id
        FROM creator_earnings
        WHERE creator_id = $1 AND status = 'pending'
        FOR UPDATE
      `;
      const earningsResult = await db.query(earningsQuery, [creator_id]);
      const earnings = earningsResult.rows;

      if (earnings.length === 0) {
        await db.query('ROLLBACK');
        return { creator_id, status: 'skipped', reason: 'no_pending_earnings' };
      }

      const totalAmount = earnings.reduce((sum, e) => sum + parseFloat(e.amount), 0);

      // Create payout record
      const payoutQuery = `
        INSERT INTO creator_payouts 
        (creator_id, stripe_account_id, amount, currency, status, earnings_count, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, payout_id
      `;
      const payoutResult = await db.query(payoutQuery, [
        creator_id,
        stripe_account_id,
        totalAmount,
        'USD',
        'processing',
        earnings.length,
        JSON.stringify({
          earnings_ids: earnings.map(e => e.id),
          initiated_at: new Date().toISOString()
        })
      ]);
      const payoutRecord = payoutResult.rows[0];

      // Update earnings status
      const earningIds = earnings.map(e => e.id);
      await db.query(
        `UPDATE creator_earnings 
         SET status = 'processing', payout_id = $1, updated_at = NOW()
         WHERE id = ANY($2)`,
        [payoutRecord.id, earningIds]
      );

      // Commit transaction
      await db.query('COMMIT');

      // Invalidate caches
      await cache.invalidate(`creator:${creator_id}:*`);
      await cache.invalidate('payouts:eligible_creators');

      // Create Stripe payout
      try {
        const stripePayout = await stripeConnect.createPayout(
          stripe_account_id,
          totalAmount,
          {
            payout_id: payoutRecord.payout_id,
            creator_id,
            earnings_count: earnings.length
          }
        );

        // Update payout with Stripe ID
        await db.query(
          `UPDATE creator_payouts 
           SET stripe_payout_id = $1, status = 'submitted', submitted_at = NOW()
           WHERE id = $2`,
          [stripePayout.id, payoutRecord.id]
        );

        logger.info('Payout created successfully', {
          creator_id,
          payout_id: payoutRecord.id,
          stripe_payout_id: stripePayout.id,
          amount: totalAmount
        });

        // Send notification to creator
        await this.notifyCreator(creator_id, {
          type: 'payout_initiated',
          amount: totalAmount,
          payout_id: payoutRecord.payout_id
        });

        return {
          creator_id,
          status: 'success',
          payout_id: payoutRecord.id,
          amount: totalAmount,
          stripe_payout_id: stripePayout.id
        };
      } catch (stripeError) {
        logger.error('Stripe payout creation failed', {
          creator_id,
          error: stripeError.message
        });

        // Update payout status
        await db.query(
          `UPDATE creator_payouts 
           SET status = 'failed', 
               failed_at = NOW(),
               failure_reason = $1
           WHERE id = $2`,
          [stripeError.message, payoutRecord.id]
        );

        // Revert earnings status
        await db.query(
          `UPDATE creator_earnings 
           SET status = 'pending', payout_id = NULL
           WHERE id = ANY($1)`,
          [earningIds]
        );

        return {
          creator_id,
          status: 'failed',
          reason: stripeError.message,
          payout_id: payoutRecord.id
        };
      }
    } catch (error) {
      await db.query('ROLLBACK');
      logger.error('Payout processing failed', {
        creator_id,
        error: error.message
      });
      return {
        creator_id,
        status: 'failed',
        reason: error.message
      };
    } finally {
      // Release distributed lock
      await cache.releaseLock(lockKey, lockValue);
    }
  }

  /**
   * Retry failed payouts with caching
   */
  async retryFailedPayouts() {
    const cacheKey = 'payouts:failed:retry';
    const cached = await cache.get(cacheKey);
    if (cached && cached.timestamp > Date.now() - 600000) { // 10 min cache
      logger.info('Failed payouts recently retried, skipping');
      return cached.data;
    }

    const query = `
      SELECT id, creator_id, stripe_account_id, stripe_payout_id, amount, retry_count
      FROM creator_payouts
      WHERE status = 'failed'
      AND retry_count < 3
      AND failed_at > NOW() - INTERVAL '7 days'
      ORDER BY failed_at DESC
      LIMIT 50
    `;

    const result = await db.query(query);
    const failedPayouts = result.rows;

    logger.info(`Found ${failedPayouts.length} failed payouts to retry`);

    const results = [];
    for (const payout of failedPayouts) {
      try {
        // Retry with Stripe
        const retriedPayout = await stripeConnect.retryFailedPayout(
          payout.stripe_payout_id
        );

        // Update database
        await db.query(
          `UPDATE creator_payouts 
           SET status = 'submitted', 
               retry_count = retry_count + 1,
               last_retry_at = NOW()
           WHERE id = $1`,
          [payout.id]
        );

        // Update earnings
        await db.query(
          `UPDATE creator_earnings 
           SET status = 'processing'
           WHERE payout_id = $1`,
          [payout.id]
        );

        results.push({
          payout_id: payout.id,
          status: 'retried',
          stripe_status: retriedPayout.status
        });

        logger.info('Payout retry successful', {
          payout_id: payout.id,
          creator_id: payout.creator_id
        });
      } catch (error) {
        // Update retry count
        await db.query(
          `UPDATE creator_payouts 
           SET retry_count = retry_count + 1,
               last_retry_at = NOW(),
               failure_reason = $1
           WHERE id = $2`,
          [error.message, payout.id]
        );

        results.push({
          payout_id: payout.id,
          status: 'retry_failed',
          error: error.message
        });

        logger.error('Payout retry failed', {
          payout_id: payout.id,
          error: error.message
        });
      }
    }

    // Cache results
    await cache.set(cacheKey, {
      timestamp: Date.now(),
      data: results
    }, 600);

    return results;
  }

  /**
   * Update Stripe account statuses with caching
   */
  async updateAccountStatuses() {
    const query = `
      SELECT creator_id, stripe_account_id, last_status_check
      FROM creator_stripe_accounts
      WHERE status = 'active'
      AND (last_status_check IS NULL OR last_status_check < NOW() - INTERVAL '24 hours')
      LIMIT 100
    `;

    const result = await db.query(query);
    const accounts = result.rows;

    logger.info(`Updating status for ${accounts.length} Stripe accounts`);

    const results = [];
    for (const account of accounts) {
      const cacheKey = `stripe:account:${account.stripe_account_id}`;
      const cached = await cache.get(cacheKey);
      
      if (cached) {
        results.push({ 
          creator_id: account.creator_id, 
          status: 'cached',
          data: cached 
        });
        continue;
      }

      try {
        const status = await stripeConnect.updateAccountStatus(
          account.stripe_account_id
        );

        await db.query(
          `UPDATE creator_stripe_accounts 
           SET charges_enabled = $1,
               payouts_enabled = $2,
               requirements = $3,
               last_status_check = NOW()
           WHERE stripe_account_id = $4`,
          [
            status.charges_enabled,
            status.payouts_enabled,
            JSON.stringify(status.requirements),
            account.stripe_account_id
          ]
        );

        // Cache for 1 hour
        await cache.set(cacheKey, status, 3600);

        results.push({
          creator_id: account.creator_id,
          status: 'updated',
          account_status: status
        });
      } catch (error) {
        logger.error('Failed to update account status', {
          creator_id: account.creator_id,
          error: error.message
        });

        results.push({
          creator_id: account.creator_id,
          status: 'failed',
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Notify creator about payout
   */
  async notifyCreator(creatorId, notification) {
    try {
      await db.query(
        `INSERT INTO payout_notifications 
         (creator_id, type, data, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [creatorId, notification.type, JSON.stringify(notification)]
      );

      // Invalidate creator notification cache
      await cache.invalidate(`creator:${creatorId}:notifications`);
    } catch (error) {
      logger.error('Failed to create payout notification', {
        creator_id: creatorId,
        error: error.message
      });
    }
  }

  /**
   * Send admin notification
   */
  async sendAdminNotification(subject, data) {
    logger.info('Admin notification', { subject, data });
    
    // Implementation would send email/Slack notification
    // For now, just log it
    
    try {
      await db.query(
        `INSERT INTO admin_notifications 
         (type, subject, data, created_at)
         VALUES ('payout', $1, $2, NOW())`,
        ['payout', subject, JSON.stringify(data)]
      );
    } catch (error) {
      logger.error('Failed to create admin notification', {
        error: error.message
      });
    }
  }

  /**
   * Get payout statistics with caching
   */
  async getPayoutStats(timeframe = '30d') {
    const cacheKey = `payouts:stats:${timeframe}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const interval = {
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days'
    }[timeframe] || '30 days';

    const query = `
      SELECT 
        COUNT(*) as total_payouts,
        COUNT(DISTINCT creator_id) as unique_creators,
        SUM(amount) as total_amount,
        AVG(amount) as average_amount,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_payouts,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payouts,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_payouts,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600)::numeric(10,2) as avg_processing_hours
      FROM creator_payouts
      WHERE created_at > NOW() - INTERVAL '${interval}'
    `;

    const result = await db.query(query);
    const stats = result.rows[0];

    // Cache for 30 minutes
    await cache.set(cacheKey, stats, 1800);
    return stats;
  }
}

// Export singleton instance
const payoutProcessor = new PayoutProcessor();
module.exports = payoutProcessor;