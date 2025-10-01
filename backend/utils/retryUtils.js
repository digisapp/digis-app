const { logger } = require('./secureLogger');

/**
 * Retry utility for database operations
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Result of the function
 */
const retryDB = async (fn, options = {}) => {
  const {
    retries = 3,
    minTimeout = 1000,
    maxTimeout = 5000,
    factor = 2,
    onRetry = null
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        logger.info(`Database operation succeeded after ${attempt} retries`);
      }
      return result;
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      const nonRetryableErrors = [
        'invalid_token',
        'insufficient_balance',
        'duplicate_key',
        'foreign_key_violation',
        'check_violation'
      ];
      
      if (nonRetryableErrors.some(err => error.message?.includes(err))) {
        throw error;
      }
      
      if (attempt < retries - 1) {
        const timeout = Math.min(
          minTimeout * Math.pow(factor, attempt),
          maxTimeout
        );
        
        logger.warn(`Database operation failed, retrying in ${timeout}ms`, {
          attempt: attempt + 1,
          error: error.message
        });
        
        if (onRetry) {
          onRetry(error, attempt + 1);
        }
        
        await new Promise(resolve => setTimeout(resolve, timeout));
      }
    }
  }
  
  logger.error('Database operation failed after all retries', {
    retries,
    error: lastError.message
  });
  
  throw lastError;
};

/**
 * Retry utility for Stripe operations
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Result of the function
 */
const retryStripe = async (fn, options = {}) => {
  const {
    retries = 3,
    minTimeout = 2000,
    maxTimeout = 10000,
    factor = 2
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        logger.info(`Stripe operation succeeded after ${attempt} retries`);
      }
      return result;
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain Stripe errors
      const nonRetryableTypes = [
        'StripeCardError',
        'StripeInvalidRequestError',
        'StripeAuthenticationError'
      ];
      
      if (nonRetryableTypes.includes(error.type)) {
        throw error;
      }
      
      // Retry on rate limit errors with longer delay
      if (error.type === 'StripeRateLimitError') {
        const timeout = maxTimeout;
        logger.warn(`Stripe rate limit hit, waiting ${timeout}ms`);
        await new Promise(resolve => setTimeout(resolve, timeout));
        continue;
      }
      
      if (attempt < retries - 1) {
        const timeout = Math.min(
          minTimeout * Math.pow(factor, attempt),
          maxTimeout
        );
        
        logger.warn(`Stripe operation failed, retrying in ${timeout}ms`, {
          attempt: attempt + 1,
          error: error.message,
          type: error.type
        });
        
        await new Promise(resolve => setTimeout(resolve, timeout));
      }
    }
  }
  
  logger.error('Stripe operation failed after all retries', {
    retries,
    error: lastError.message,
    type: lastError.type
  });
  
  throw lastError;
};

/**
 * Retry utility for external API calls
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Result of the function
 */
const retryAPI = async (fn, options = {}) => {
  const {
    retries = 3,
    minTimeout = 1000,
    maxTimeout = 5000,
    factor = 2,
    shouldRetry = null
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        logger.info(`API call succeeded after ${attempt} retries`);
      }
      return result;
    } catch (error) {
      lastError = error;
      
      // Custom retry logic
      if (shouldRetry && !shouldRetry(error, attempt)) {
        throw error;
      }
      
      // Don't retry on client errors (4xx)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        throw error;
      }
      
      if (attempt < retries - 1) {
        const timeout = Math.min(
          minTimeout * Math.pow(factor, attempt),
          maxTimeout
        );
        
        logger.warn(`API call failed, retrying in ${timeout}ms`, {
          attempt: attempt + 1,
          error: error.message,
          status: error.response?.status
        });
        
        await new Promise(resolve => setTimeout(resolve, timeout));
      }
    }
  }
  
  logger.error('API call failed after all retries', {
    retries,
    error: lastError.message
  });
  
  throw lastError;
};

/**
 * Circuit breaker for external services
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.nextAttempt = Date.now();
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = 'CLOSED';
        this.successCount = 0;
        logger.info('Circuit breaker closed after successful recovery');
      }
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      this.successCount = 0;
      logger.warn('Circuit breaker opened after failure in HALF_OPEN state');
      return;
    }
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      logger.warn('Circuit breaker opened after reaching failure threshold', {
        failures: this.failures,
        threshold: this.failureThreshold
      });
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      nextAttempt: this.nextAttempt,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Pre-configured circuit breakers
const circuitBreakers = {
  stripe: new CircuitBreaker({
    failureThreshold: 3,
    resetTimeout: 30000 // 30 seconds
  }),
  agora: new CircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 60000 // 1 minute
  }),
  email: new CircuitBreaker({
    failureThreshold: 10,
    resetTimeout: 120000 // 2 minutes
  })
};

module.exports = {
  retryDB,
  retryStripe,
  retryAPI,
  CircuitBreaker,
  circuitBreakers
};