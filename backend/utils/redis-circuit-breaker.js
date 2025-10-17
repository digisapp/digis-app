/**
 * Redis Circuit Breaker
 *
 * Prevents cascading failures by opening circuit after N consecutive errors.
 * When open, returns null/default values instead of attempting Redis operations.
 *
 * States:
 * - CLOSED: Normal operation, all requests pass through
 * - OPEN: Circuit tripped, fail fast without calling Redis
 * - HALF_OPEN: Testing if Redis recovered, allow 1 request through
 *
 * Benefits:
 * - Prevents Redis connection timeouts from blocking requests
 * - Automatic recovery testing after cooldown period
 * - Graceful degradation (fail-open pattern)
 */

const { redis } = require('./redis');

class RedisCircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5; // Consecutive failures to open
    this.cooldownMs = options.cooldownMs || 60000; // 60s cooldown before retry
    this.successThreshold = options.successThreshold || 2; // Successes to close from half-open

    this.failures = 0;
    this.successes = 0;
    this.state = 'CLOSED'; // CLOSED | OPEN | HALF_OPEN
    this.openedAt = null;
    this.nextAttemptAt = null;

    // Metrics
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      circuitOpenCalls: 0,
      lastError: null,
      lastErrorAt: null
    };
  }

  /**
   * Execute Redis operation with circuit breaker protection
   *
   * @param {string} operation - Operation name (for logging)
   * @param {Function} fn - Async function that performs Redis operation
   * @param {*} defaultValue - Value to return on circuit open or error
   * @returns {Promise<*>} Result or default value
   */
  async execute(operation, fn, defaultValue = null) {
    this.metrics.totalCalls++;

    // If circuit is OPEN, fail fast
    if (this.state === 'OPEN') {
      const now = Date.now();

      // Check if cooldown period has passed
      if (now >= this.nextAttemptAt) {
        console.log(`[CircuitBreaker] Entering HALF_OPEN state (cooldown expired)`);
        this.state = 'HALF_OPEN';
        this.successes = 0;
      } else {
        this.metrics.circuitOpenCalls++;
        console.warn(`[CircuitBreaker] Circuit OPEN - failing fast for ${operation}`);
        return defaultValue;
      }
    }

    // Attempt operation
    try {
      const result = await fn();

      // Success - update circuit state
      this.onSuccess();
      this.metrics.successfulCalls++;

      return result;
    } catch (error) {
      // Failure - update circuit state
      this.onFailure(error, operation);
      this.metrics.failedCalls++;
      this.metrics.lastError = error.message;
      this.metrics.lastErrorAt = new Date().toISOString();

      return defaultValue;
    }
  }

  /**
   * Handle successful Redis operation
   */
  onSuccess() {
    this.failures = 0;

    if (this.state === 'HALF_OPEN') {
      this.successes++;

      if (this.successes >= this.successThreshold) {
        console.log(`[CircuitBreaker] Circuit CLOSED (${this.successes} successes in HALF_OPEN)`);
        this.state = 'CLOSED';
        this.successes = 0;
        this.openedAt = null;
        this.nextAttemptAt = null;
      }
    }
  }

  /**
   * Handle failed Redis operation
   */
  onFailure(error, operation) {
    this.failures++;

    console.error(`[CircuitBreaker] Redis failure (${this.failures}/${this.failureThreshold}):`, {
      operation,
      error: error.message,
      state: this.state
    });

    // If in HALF_OPEN and fails, reopen circuit immediately
    if (this.state === 'HALF_OPEN') {
      console.warn(`[CircuitBreaker] Circuit reopened (failure in HALF_OPEN)`);
      this.openCircuit();
      return;
    }

    // If failure threshold reached, open circuit
    if (this.failures >= this.failureThreshold) {
      console.error(`[CircuitBreaker] Circuit OPEN (${this.failures} consecutive failures)`);
      this.openCircuit();
    }
  }

  /**
   * Open circuit and schedule next retry
   */
  openCircuit() {
    this.state = 'OPEN';
    this.openedAt = Date.now();
    this.nextAttemptAt = this.openedAt + this.cooldownMs;

    console.error(`[CircuitBreaker] Circuit opened at ${new Date(this.openedAt).toISOString()}, will retry at ${new Date(this.nextAttemptAt).toISOString()}`);
  }

  /**
   * Manually reset circuit (for testing or admin intervention)
   */
  reset() {
    console.log(`[CircuitBreaker] Manual reset`);
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.openedAt = null;
    this.nextAttemptAt = null;
  }

  /**
   * Get current circuit state and metrics
   */
  getStatus() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      openedAt: this.openedAt,
      nextAttemptAt: this.nextAttemptAt,
      metrics: this.metrics
    };
  }
}

// Singleton instance
const breaker = new RedisCircuitBreaker({
  failureThreshold: 5,    // 5 consecutive failures
  cooldownMs: 60000,      // 60 seconds cooldown
  successThreshold: 2     // 2 successes to close
});

/**
 * Wrapped Redis operations with circuit breaker
 */
async function safeGet(key, defaultValue = null) {
  return breaker.execute('GET', async () => {
    if (!redis) throw new Error('Redis not configured');
    return await redis.get(key);
  }, defaultValue);
}

async function safeSet(key, value, ttlSeconds = 3600) {
  return breaker.execute('SET', async () => {
    if (!redis) throw new Error('Redis not configured');
    await redis.set(key, value, { ex: ttlSeconds });
    return true;
  }, false);
}

async function safeDel(key) {
  return breaker.execute('DEL', async () => {
    if (!redis) throw new Error('Redis not configured');
    await redis.del(key);
    return true;
  }, false);
}

async function safeIncr(key, ttlSeconds = 60) {
  return breaker.execute('INCR', async () => {
    if (!redis) throw new Error('Redis not configured');
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, ttlSeconds);
    }
    return count;
  }, 0);
}

async function safeSetNX(key, value, ttlSeconds = 60) {
  return breaker.execute('SETNX', async () => {
    if (!redis) throw new Error('Redis not configured');
    const result = await redis.set(key, value, {
      ex: ttlSeconds,
      nx: true
    });
    return result === 'OK';
  }, false);
}

/**
 * Health check endpoint helper
 */
async function getCircuitBreakerStatus() {
  return breaker.getStatus();
}

/**
 * Manually reset circuit (admin endpoint)
 */
function resetCircuitBreaker() {
  breaker.reset();
}

module.exports = {
  breaker,
  safeGet,
  safeSet,
  safeDel,
  safeIncr,
  safeSetNX,
  getCircuitBreakerStatus,
  resetCircuitBreaker
};
