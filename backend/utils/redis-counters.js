/**
 * Redis-based counters for fast active session counts
 * Replaces slow COUNT(*) queries with cached values
 */

const redis = require('./redis');

class SessionCounters {
  constructor() {
    this.KEYS = {
      ACTIVE_SESSIONS: 'sessions:active:count',
      ACTIVE_CREATORS: 'sessions:active:creators',
      ACTIVE_FANS: 'sessions:active:fans'
    };
  }

  /**
   * Increment active session count when session starts
   */
  async incrementActive(sessionId, creatorId, fanId) {
    try {
      const multi = redis.client.multi();

      // Increment total active sessions
      multi.incr(this.KEYS.ACTIVE_SESSIONS);

      // Add creator to active set
      if (creatorId) {
        multi.sadd(this.KEYS.ACTIVE_CREATORS, creatorId);
      }

      // Add fan to active set
      if (fanId) {
        multi.sadd(this.KEYS.ACTIVE_FANS, fanId);
      }

      await multi.exec();
      console.log('✅ Session counter incremented:', sessionId);
    } catch (error) {
      console.error('❌ Failed to increment session counter:', error);
      // Non-fatal: don't fail the request if Redis is down
    }
  }

  /**
   * Decrement active session count when session ends
   */
  async decrementActive(sessionId, creatorId, fanId) {
    try {
      const multi = redis.client.multi();

      // Decrement total active sessions
      multi.decr(this.KEYS.ACTIVE_SESSIONS);

      // Check if creator has other active sessions
      if (creatorId) {
        const hasOtherSessions = await this.hasOtherActiveSessions(creatorId, sessionId);
        if (!hasOtherSessions) {
          multi.srem(this.KEYS.ACTIVE_CREATORS, creatorId);
        }
      }

      // Check if fan has other active sessions
      if (fanId) {
        const hasOtherSessions = await this.hasOtherActiveSessions(fanId, sessionId);
        if (!hasOtherSessions) {
          multi.srem(this.KEYS.ACTIVE_FANS, fanId);
        }
      }

      await multi.exec();
      console.log('✅ Session counter decremented:', sessionId);
    } catch (error) {
      console.error('❌ Failed to decrement session counter:', error);
    }
  }

  /**
   * Get active session counts (instant, from Redis)
   */
  async getCounts() {
    try {
      const [total, creators, fans] = await Promise.all([
        redis.client.get(this.KEYS.ACTIVE_SESSIONS),
        redis.client.scard(this.KEYS.ACTIVE_CREATORS),
        redis.client.scard(this.KEYS.ACTIVE_FANS)
      ]);

      return {
        activeSessions: parseInt(total) || 0,
        activeCreators: creators || 0,
        activeFans: fans || 0
      };
    } catch (error) {
      console.error('❌ Failed to get session counts from Redis:', error);
      // Fallback to database query (slower but reliable)
      return this.getCountsFromDB();
    }
  }

  /**
   * Fallback: Get counts from database (slower)
   */
  async getCountsFromDB() {
    const { pool } = require('./db');

    try {
      const result = await pool.query(`
        SELECT
          COUNT(*) as active_sessions,
          COUNT(DISTINCT creator_id) as active_creators,
          COUNT(DISTINCT fan_id) as active_fans
        FROM sessions
        WHERE status = 'active'
      `);

      return {
        activeSessions: parseInt(result.rows[0].active_sessions) || 0,
        activeCreators: parseInt(result.rows[0].active_creators) || 0,
        activeFans: parseInt(result.rows[0].active_fans) || 0
      };
    } catch (error) {
      console.error('❌ Failed to get session counts from DB:', error);
      return {
        activeSessions: 0,
        activeCreators: 0,
        activeFans: 0
      };
    }
  }

  /**
   * Check if user has other active sessions
   */
  async hasOtherActiveSessions(userId, excludeSessionId) {
    const { pool } = require('./db');

    const result = await pool.query(`
      SELECT EXISTS(
        SELECT 1 FROM sessions
        WHERE (creator_id = $1 OR fan_id = $1)
        AND status = 'active'
        AND id != $2
      ) as has_others
    `, [userId, excludeSessionId]);

    return result.rows[0].has_others;
  }

  /**
   * Reconcile Redis counts with database (run periodically)
   */
  async reconcile() {
    console.log('🔄 Reconciling session counts...');

    try {
      const dbCounts = await this.getCountsFromDB();

      // Update Redis with accurate counts from DB
      const multi = redis.client.multi();
      multi.set(this.KEYS.ACTIVE_SESSIONS, dbCounts.activeSessions);

      // Rebuild active creator/fan sets
      const { pool } = require('./db');

      const creators = await pool.query(`
        SELECT DISTINCT creator_id FROM sessions WHERE status = 'active' AND creator_id IS NOT NULL
      `);

      const fans = await pool.query(`
        SELECT DISTINCT fan_id FROM sessions WHERE status = 'active' AND fan_id IS NOT NULL
      `);

      multi.del(this.KEYS.ACTIVE_CREATORS);
      if (creators.rows.length > 0) {
        multi.sadd(this.KEYS.ACTIVE_CREATORS, ...creators.rows.map(r => r.creator_id));
      }

      multi.del(this.KEYS.ACTIVE_FANS);
      if (fans.rows.length > 0) {
        multi.sadd(this.KEYS.ACTIVE_FANS, ...fans.rows.map(r => r.fan_id));
      }

      await multi.exec();

      console.log('✅ Session counts reconciled:', dbCounts);
      return dbCounts;
    } catch (error) {
      console.error('❌ Failed to reconcile session counts:', error);
      throw error;
    }
  }
}

module.exports = new SessionCounters();
