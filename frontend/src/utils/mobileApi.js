/**
 * Centralized API client for mobile pages
 * Features: Auth, retry logic, abort handling, type safety
 */

import React from 'react';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Exponential backoff with jitter
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const getRetryDelay = (attempt) => Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);

// Main API client factory
export const createApiClient = (signal) => {
  const baseUrl = import.meta.env.VITE_BACKEND_URL || '';
  const token = localStorage.getItem('auth_token');

  return async function request(path, options = {}) {
    const {
      method = 'GET',
      body = null,
      headers = {},
      retries = 3,
      onProgress = null,
    } = options;

    const requestOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      signal,
    };

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    let lastError;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`${baseUrl}${path}`, requestOptions);

        // Handle 401 - clear auth and redirect
        if (response.status === 401) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          throw new ApiError('Authentication required', 401);
        }

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : getRetryDelay(attempt);
          if (attempt < retries) {
            await wait(delay);
            continue;
          }
        }

        // Handle other errors
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new ApiError(
            errorData.message || `Request failed: ${response.status}`,
            response.status,
            errorData
          );
        }

        // Success - parse response
        const data = await response.json();
        return data;

      } catch (error) {
        // Handle abort
        if (error.name === 'AbortError') {
          throw error;
        }

        // Handle network errors with retry
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
          lastError = new ApiError('Network error - please check your connection', 0);
          
          if (attempt < retries && !navigator.onLine) {
            // Wait for online status
            await new Promise((resolve) => {
              const handleOnline = () => {
                window.removeEventListener('online', handleOnline);
                resolve();
              };
              window.addEventListener('online', handleOnline);
              
              // Timeout after delay
              setTimeout(() => {
                window.removeEventListener('online', handleOnline);
                resolve();
              }, getRetryDelay(attempt));
            });
            continue;
          }
        }

        // Re-throw API errors immediately
        if (error instanceof ApiError) {
          throw error;
        }

        lastError = error;
        
        // Retry on other errors
        if (attempt < retries) {
          await wait(getRetryDelay(attempt));
          continue;
        }
      }
    }

    throw lastError || new ApiError('Request failed after retries', 0);
  };
};

// Convenience hook for React components
export const useApi = () => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const controllerRef = React.useRef(null);

  React.useEffect(() => {
    return () => {
      // Cleanup: abort pending requests
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, []);

  const request = React.useCallback(async (path, options = {}) => {
    setLoading(true);
    setError(null);

    // Create new abort controller
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    controllerRef.current = new AbortController();

    try {
      const api = createApiClient(controllerRef.current.signal);
      const data = await api(path, options);
      setLoading(false);
      return data;
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err);
        setLoading(false);
        throw err;
      }
    }
  }, []);

  return { request, loading, error, setError };
};

// Typed API endpoints
export const api = {
  creators: {
    list: (category = 'all', page = 1) => 
      `/creators?category=${category}&page=${page}`,
    get: (id) => `/creators/${id}`,
    featured: () => '/api/creators/featured',
  },
  messages: {
    list: () => '/api/messages',
    get: (id) => `/messages/${id}`,
    send: () => '/api/messages',
    markRead: (id) => `/messages/${id}/read`,
  },
  wallet: {
    balance: () => '/api/wallet/balance',
    transactions: (page = 1) => `/wallet/transactions?page=${page}`,
    purchase: () => '/api/tokens/purchase',
  },
  user: {
    profile: () => '/api/user/profile',
    update: () => '/api/user/profile',
    preferences: () => '/api/user/preferences',
  },
  streaming: {
    live: () => '/api/streaming/live',
    join: (id) => `/streaming/${id}/join`,
    leave: (id) => `/streaming/${id}/leave`,
  },
  notifications: {
    list: () => '/api/notifications',
    markRead: (id) => `/notifications/${id}/read`,
    markAllRead: () => '/api/notifications/read-all',
  },
};

// Offline queue integration
export const offlineQueue = {
  queue: [],
  
  add: (request) => {
    offlineQueue.queue.push({
      ...request,
      timestamp: Date.now(),
      id: crypto.randomUUID(),
    });
    
    // Persist to localStorage
    localStorage.setItem('offline_queue', JSON.stringify(offlineQueue.queue));
  },

  process: async () => {
    if (!navigator.onLine) return;
    
    const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
    const api = createApiClient();
    
    for (const request of queue) {
      try {
        await api(request.path, request.options);
        // Remove successful request
        offlineQueue.queue = offlineQueue.queue.filter(r => r.id !== request.id);
      } catch (error) {
        console.error('Failed to process offline request:', error);
      }
    }
    
    localStorage.setItem('offline_queue', JSON.stringify(offlineQueue.queue));
  },
};

// Auto-process offline queue when online
window.addEventListener('online', () => {
  offlineQueue.process();
});

// Export for use in components
export default createApiClient;