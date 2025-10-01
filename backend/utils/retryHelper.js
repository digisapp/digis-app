/**
 * Retry helper for handling transient errors in async operations
 * Supports exponential backoff and custom retry conditions
 */

/**
 * Retry an async function with exponential backoff
 * @param {Function} fn - The async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} initialDelay - Initial delay in milliseconds
 * @param {Function} shouldRetry - Optional function to determine if error is retriable
 * @returns {Promise} - Result of the function
 */
const retry = async (fn, maxRetries = 3, initialDelay = 1000, shouldRetry = null) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }
      
      // Don't retry on last attempt
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(2, i);
      
      console.warn(`⚠️ Retry ${i + 1}/${maxRetries} after error: ${error.message}`);
      console.warn(`⏱️ Waiting ${delay}ms before retry...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

/**
 * Determine if a database error is retriable
 * @param {Error} error - The error to check
 * @returns {boolean} - Whether the error should be retried
 */
const isRetriableDBError = (error) => {
  const retriableErrors = [
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENOTFOUND',
    'EAI_AGAIN',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'Connection terminated',
    'timeout',
    'pool timeout'
  ];
  
  const errorString = error.toString();
  return retriableErrors.some(retriable => errorString.includes(retriable));
};

/**
 * Determine if a Stripe error is retriable
 * @param {Error} error - The error to check
 * @returns {boolean} - Whether the error should be retried
 */
const isRetriableStripeError = (error) => {
  // Stripe network errors
  if (error.type === 'StripeConnectionError') {
    return true;
  }
  
  // Rate limit errors
  if (error.statusCode === 429) {
    return true;
  }
  
  // Server errors
  if (error.statusCode >= 500) {
    return true;
  }
  
  // Timeout errors
  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
    return true;
  }
  
  return false;
};

/**
 * Retry database operations
 * @param {Function} fn - The database operation to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise} - Result of the operation
 */
const retryDB = async (fn, maxRetries = 3) => {
  return retry(fn, maxRetries, 1000, isRetriableDBError);
};

/**
 * Retry Stripe operations
 * @param {Function} fn - The Stripe operation to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise} - Result of the operation
 */
const retryStripe = async (fn, maxRetries = 3) => {
  return retry(fn, maxRetries, 2000, isRetriableStripeError);
};

module.exports = {
  retry,
  retryDB,
  retryStripe,
  isRetriableDBError,
  isRetriableStripeError
};