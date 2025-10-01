/**
 * Retry utility functions for WebSocket and API calls
 */

/**
 * Retry configuration options
 * @typedef {Object} RetryOptions
 * @property {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @property {number} initialDelay - Initial delay in ms (default: 1000)
 * @property {number} maxDelay - Maximum delay in ms (default: 10000)
 * @property {number} backoffMultiplier - Delay multiplier for exponential backoff (default: 2)
 * @property {function} onRetry - Callback called on each retry attempt
 * @property {function} shouldRetry - Function to determine if should retry based on error
 */

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  onRetry: null,
  shouldRetry: (error) => true
};

/**
 * Sleep utility
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate exponential backoff delay
 * @param {number} attempt - Current attempt number (0-based)
 * @param {RetryOptions} options - Retry options
 * @returns {number} Delay in milliseconds
 */
const calculateDelay = (attempt, options) => {
  const delay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt);
  return Math.min(delay, options.maxDelay);
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {RetryOptions} options - Retry options
 * @returns {Promise} Result of the function
 */
export const retry = async (fn, options = {}) => {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt === opts.maxRetries || !opts.shouldRetry(error)) {
        throw error;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, opts);
      
      // Call onRetry callback if provided
      if (opts.onRetry) {
        opts.onRetry(error, attempt + 1, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError;
};

/**
 * WebSocket-specific retry wrapper
 * @param {WebSocket} websocket - WebSocket instance
 * @param {Object} message - Message to send
 * @param {RetryOptions} options - Retry options
 * @returns {Promise} Promise that resolves when message is sent
 */
export const retryWebSocketSend = async (websocket, message, options = {}) => {
  const defaultOptions = {
    ...DEFAULT_RETRY_OPTIONS,
    shouldRetry: (error) => {
      // Only retry if WebSocket is connecting or temporarily closed
      return websocket.readyState === WebSocket.CONNECTING ||
             websocket.readyState === WebSocket.CLOSED;
    },
    onRetry: (error, attempt, delay) => {
      console.warn(`WebSocket send retry ${attempt}, waiting ${delay}ms...`, error);
    }
  };

  const opts = { ...defaultOptions, ...options };

  return retry(() => {
    if (websocket.readyState !== WebSocket.OPEN) {
      throw new Error(`WebSocket not open (state: ${websocket.readyState})`);
    }
    
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    websocket.send(messageStr);
  }, opts);
};

/**
 * Fetch with retry wrapper
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {RetryOptions} retryOptions - Retry options
 * @returns {Promise<Response>} Fetch response
 */
export const fetchWithRetry = async (url, options = {}, retryOptions = {}) => {
  const defaultRetryOptions = {
    ...DEFAULT_RETRY_OPTIONS,
    shouldRetry: (error) => {
      // Retry on network errors or 5xx status codes
      if (!error.response) return true; // Network error
      const status = error.response.status;
      return status >= 500 && status < 600;
    },
    onRetry: (error, attempt, delay) => {
      console.warn(`Fetch retry ${attempt} for ${url}, waiting ${delay}ms...`, error);
    }
  };

  const opts = { ...defaultRetryOptions, ...retryOptions };

  return retry(async () => {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.response = response;
      throw error;
    }
    
    return response;
  }, opts);
};

/**
 * Create a retry wrapper for a specific WebSocket instance
 * @param {WebSocket} websocket - WebSocket instance
 * @param {RetryOptions} defaultOptions - Default retry options
 * @returns {Function} Function to send messages with retry
 */
export const createWebSocketSender = (websocket, defaultOptions = {}) => {
  return (message, options = {}) => {
    return retryWebSocketSend(websocket, message, { ...defaultOptions, ...options });
  };
};

/**
 * Retry wrapper for Supabase real-time subscriptions
 * @param {Function} subscribeFn - Function that creates subscription
 * @param {RetryOptions} options - Retry options
 * @returns {Promise} Subscription result
 */
export const retrySubscription = async (subscribeFn, options = {}) => {
  const defaultOptions = {
    ...DEFAULT_RETRY_OPTIONS,
    maxRetries: 5,
    initialDelay: 2000,
    onRetry: (error, attempt, delay) => {
      console.warn(`Subscription retry ${attempt}, waiting ${delay}ms...`, error);
    }
  };

  const opts = { ...defaultOptions, ...options };

  return retry(subscribeFn, opts);
};

/**
 * Create a debounced retry function
 * @param {Function} fn - Function to debounce and retry
 * @param {number} wait - Debounce wait time in ms
 * @param {RetryOptions} retryOptions - Retry options
 * @returns {Function} Debounced retry function
 */
export const debounceRetry = (fn, wait = 300, retryOptions = {}) => {
  let timeout;
  let pending = null;

  return (...args) => {
    clearTimeout(timeout);

    if (pending) {
      pending.cancel = true;
    }

    const promise = new Promise((resolve, reject) => {
      pending = { cancel: false };
      
      timeout = setTimeout(async () => {
        if (pending.cancel) {
          reject(new Error('Cancelled'));
          return;
        }

        try {
          const result = await retry(() => fn(...args), retryOptions);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          pending = null;
        }
      }, wait);
    });

    return promise;
  };
};

/**
 * Circuit breaker pattern for preventing cascading failures
 * @param {Function} fn - Function to protect
 * @param {Object} options - Circuit breaker options
 * @returns {Function} Protected function
 */
export const circuitBreaker = (fn, options = {}) => {
  const opts = {
    threshold: 5,        // Number of failures before opening circuit
    timeout: 60000,      // Time to wait before half-opening circuit (ms)
    resetTimeout: 120000, // Time to wait before resetting failure count (ms)
    ...options
  };

  let failures = 0;
  let lastFailureTime = null;
  let circuitOpenTime = null;
  let state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN

  return async (...args) => {
    // Reset failure count if enough time has passed
    if (lastFailureTime && Date.now() - lastFailureTime > opts.resetTimeout) {
      failures = 0;
      state = 'CLOSED';
    }

    // Check if circuit is open
    if (state === 'OPEN') {
      if (Date.now() - circuitOpenTime > opts.timeout) {
        state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn(...args);
      
      // Reset on success
      if (state === 'HALF_OPEN') {
        failures = 0;
        state = 'CLOSED';
      }
      
      return result;
    } catch (error) {
      failures++;
      lastFailureTime = Date.now();

      if (failures >= opts.threshold) {
        state = 'OPEN';
        circuitOpenTime = Date.now();
      }

      throw error;
    }
  };
};

export default {
  retry,
  retryWebSocketSend,
  fetchWithRetry,
  createWebSocketSender,
  retrySubscription,
  debounceRetry,
  circuitBreaker
};