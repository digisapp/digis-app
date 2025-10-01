import { supabase } from './supabase-auth';
import logger from './logger';

// API configuration
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second base delay

// Get API base URL from environment
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL ||
                     process.env.VITE_BACKEND_URL ||
                     process.env.REACT_APP_BACKEND_URL ||
                     'http://localhost:3005';

// Custom error class for API errors
class ApiError extends Error {
  constructor(message, status, data = null, retryable = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.retryable = retryable;
  }
}

// Exponential backoff calculation
const calculateBackoff = (attempt) => {
  return RETRY_DELAY * Math.pow(2, attempt) + Math.random() * 1000;
};

// Check if error is retryable
const isRetryable = (error) => {
  if (error.status >= 500) return true; // Server errors
  if (error.status === 429) return true; // Rate limit
  if (error.status === 0) return true; // Network error
  if (error.message?.includes('network')) return true;
  if (error.message?.includes('timeout')) return true;
  return false;
};

// Get current auth token
const getAuthToken = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    logger.warn('Failed to get auth token:', error);
    return null;
  }
};

// API Client Class
class ApiClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
    this.activeRequests = new Map();
    this.interceptors = {
      request: [],
      response: [],
      error: []
    };
  }

  // Add request interceptor
  addRequestInterceptor(interceptor) {
    this.interceptors.request.push(interceptor);
    return () => {
      const index = this.interceptors.request.indexOf(interceptor);
      if (index > -1) this.interceptors.request.splice(index, 1);
    };
  }

  // Add response interceptor
  addResponseInterceptor(interceptor) {
    this.interceptors.response.push(interceptor);
    return () => {
      const index = this.interceptors.response.indexOf(interceptor);
      if (index > -1) this.interceptors.response.splice(index, 1);
    };
  }

  // Add error interceptor
  addErrorInterceptor(interceptor) {
    this.interceptors.error.push(interceptor);
    return () => {
      const index = this.interceptors.error.indexOf(interceptor);
      if (index > -1) this.interceptors.error.splice(index, 1);
    };
  }

  // Build full URL
  buildURL(path) {
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseURL}${cleanPath}`;
  }

  // Execute request with retries
  async executeWithRetry(requestFn, options = {}) {
    const maxRetries = options.retries ?? MAX_RETRIES;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await requestFn();
        return result;
      } catch (error) {
        lastError = error;

        // Check if we should retry
        if (attempt < maxRetries && isRetryable(error)) {
          const delay = calculateBackoff(attempt);
          logger.info(`Retrying request (attempt ${attempt + 1}/${maxRetries}) after ${Math.round(delay)}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }

    throw lastError;
  }

  // Core request method
  async request(path, options = {}) {
    const {
      method = 'GET',
      data = null,
      headers = {},
      signal = null,
      timeout = DEFAULT_TIMEOUT,
      retries = MAX_RETRIES,
      withAuth = true,
      cache = 'default'
    } = options;

    // Create abort controller for timeout
    const controller = signal ? null : new AbortController();
    const requestSignal = signal || controller?.signal;

    // Set timeout
    const timeoutId = controller ? setTimeout(() => {
      controller.abort();
    }, timeout) : null;

    // Create unique request key for deduplication
    const requestKey = `${method}:${path}:${JSON.stringify(data)}`;

    // Check for duplicate in-flight requests
    if (this.activeRequests.has(requestKey) && method === 'GET') {
      logger.debug('Reusing in-flight request:', requestKey);
      return this.activeRequests.get(requestKey);
    }

    // Build request configuration
    const url = this.buildURL(path);
    const requestConfig = {
      method,
      headers: { ...this.defaultHeaders },
      signal: requestSignal,
      credentials: 'include',
      cache
    };

    // Add auth header if needed
    if (withAuth) {
      const token = await getAuthToken();
      if (token) {
        requestConfig.headers['Authorization'] = `Bearer ${token}`;
      }
    }

    // Add custom headers
    Object.assign(requestConfig.headers, headers);

    // Add body if present
    if (data && method !== 'GET') {
      requestConfig.body = JSON.stringify(data);
    }

    // Apply request interceptors
    for (const interceptor of this.interceptors.request) {
      await interceptor(requestConfig);
    }

    // Create request promise
    const requestPromise = this.executeWithRetry(async () => {
      logger.debug(`${method} ${url}`);

      try {
        const response = await fetch(url, requestConfig);

        // Clear timeout
        if (timeoutId) clearTimeout(timeoutId);

        // Parse response
        let responseData = null;
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
          responseData = await response.json();
        } else if (contentType?.includes('text')) {
          responseData = await response.text();
        } else if (!response.ok) {
          responseData = await response.text();
        }

        // Check for errors
        if (!response.ok) {
          const error = new ApiError(
            responseData?.message || response.statusText || 'Request failed',
            response.status,
            responseData,
            isRetryable({ status: response.status })
          );

          // Apply error interceptors
          for (const interceptor of this.interceptors.error) {
            await interceptor(error);
          }

          throw error;
        }

        // Apply response interceptors
        for (const interceptor of this.interceptors.response) {
          responseData = await interceptor(responseData) || responseData;
        }

        return responseData;
      } catch (error) {
        // Clear timeout
        if (timeoutId) clearTimeout(timeoutId);

        // Handle abort errors
        if (error.name === 'AbortError') {
          throw new ApiError('Request timeout', 0, null, true);
        }

        // Handle network errors
        if (!error.status) {
          throw new ApiError(
            error.message || 'Network error',
            0,
            null,
            true
          );
        }

        throw error;
      }
    }, { retries });

    // Store promise for deduplication (GET only)
    if (method === 'GET') {
      this.activeRequests.set(requestKey, requestPromise);

      // Clean up after completion
      requestPromise.finally(() => {
        this.activeRequests.delete(requestKey);
      });
    }

    return requestPromise;
  }

  // Convenience methods
  async get(path, options = {}) {
    return this.request(path, { ...options, method: 'GET' });
  }

  async post(path, data, options = {}) {
    return this.request(path, { ...options, method: 'POST', data });
  }

  async put(path, data, options = {}) {
    return this.request(path, { ...options, method: 'PUT', data });
  }

  async patch(path, data, options = {}) {
    return this.request(path, { ...options, method: 'PATCH', data });
  }

  async delete(path, options = {}) {
    return this.request(path, { ...options, method: 'DELETE' });
  }

  // Cancel all active requests
  cancelAll() {
    for (const [key, promise] of this.activeRequests.entries()) {
      logger.debug('Cancelling request:', key);
      // Requests with AbortController will be cancelled automatically
    }
    this.activeRequests.clear();
  }
}

// Create singleton instance
const apiClient = new ApiClient();

// Add default error interceptor for auth errors
apiClient.addErrorInterceptor(async (error) => {
  if (error.status === 401) {
    logger.warn('Authentication error, refreshing session...');
    try {
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && session) {
        logger.info('Session refreshed successfully');
        // Optionally retry the original request here
      } else {
        logger.error('Failed to refresh session:', refreshError);
        // Redirect to login
        window.location.href = '/auth';
      }
    } catch (e) {
      logger.error('Session refresh error:', e);
    }
  }
});

// Export both instance and class
export { ApiClient, ApiError };
export default apiClient;

// Export convenience functions for direct use
export const api = {
  get: (path, options) => apiClient.get(path, options),
  post: (path, data, options) => apiClient.post(path, data, options),
  put: (path, data, options) => apiClient.put(path, data, options),
  patch: (path, data, options) => apiClient.patch(path, data, options),
  delete: (path, options) => apiClient.delete(path, options),
  request: (path, options) => apiClient.request(path, options)
};