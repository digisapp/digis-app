/**
 * Retry utility with exponential backoff
 * Prevents API request storms when backend is down or slow
 */

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - The async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.retries - Maximum number of retries (default: 2)
 * @param {number} options.baseDelay - Base delay in ms (default: 300)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 1500)
 * @returns {Promise} - The result of the function or throws the last error
 */
export async function withRetries(fn, { retries = 2, baseDelay = 300, maxDelay = 1500 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on certain errors
      if (shouldNotRetry(error)) {
        throw error;
      }

      // If this was the last attempt, throw
      if (attempt === retries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

      console.log(`Retry attempt ${attempt + 1}/${retries} after ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Check if an error should not be retried
 * @param {Error} error - The error to check
 * @returns {boolean} - True if should not retry
 */
function shouldNotRetry(error) {
  // Don't retry on 4xx errors (except 429 rate limit)
  if (error.response) {
    const status = error.response.status;
    if (status >= 400 && status < 500 && status !== 429) {
      return true;
    }
  }

  // Don't retry on network policy violations or CORS errors
  if (error.message && (
    error.message.includes('CORS') ||
    error.message.includes('blocked by') ||
    error.message.includes('ERR_BLOCKED')
  )) {
    return true;
  }

  return false;
}

/**
 * Sleep for a given duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with retry wrapper
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {Object} retryOptions - Retry options
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, options = {}, retryOptions = {}) {
  return withRetries(
    () => fetch(url, options),
    retryOptions
  );
}
