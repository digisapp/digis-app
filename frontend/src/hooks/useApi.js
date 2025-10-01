// src/hooks/useApi.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { getAuthToken } from '../utils/supabase-auth';
import { useDebounce } from '../utils/debounce';

/**
 * Base hook for authenticated API calls with retry logic
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Request options
 * @returns {Object} { data, loading, error, refetch }
 */
export const useApiCall = (endpoint, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortController = useRef(null);

  const execute = useCallback(async (overrideOptions = {}) => {
    if (abortController.current) {
      abortController.current.abort();
    }
    
    abortController.current = new AbortController();
    
    try {
      setLoading(true);
      setError(null);
      
      const token = await getAuthToken();
      const finalOptions = {
        ...options,
        ...overrideOptions,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
          ...overrideOptions.headers
        },
        signal: abortController.current.signal
      };
      
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}${endpoint}`,
        finalOptions
      );
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
      return result;
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        throw err;
      }
    } finally {
      setLoading(false);
    }
  }, [endpoint, options]);

  useEffect(() => {
    if (options.immediate !== false) {
      execute();
    }
    
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  return { data, loading, error, refetch: execute };
};

/**
 * Hook for paginated API calls
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Request options
 * @returns {Object} Pagination controls and data
 */
export const usePaginatedApi = (endpoint, options = {}) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(options.pageSize || 20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [items, setItems] = useState([]);
  
  const queryParams = new URLSearchParams({
    page,
    limit: pageSize,
    ...options.params
  }).toString();
  
  const { data, loading, error, refetch } = useApiCall(
    `${endpoint}?${queryParams}`,
    { ...options, immediate: false }
  );
  
  useEffect(() => {
    refetch();
  }, [page, pageSize, refetch]);
  
  useEffect(() => {
    if (data) {
      setItems(data.items || data.data || []);
      setTotalPages(data.totalPages || Math.ceil(data.total / pageSize) || 1);
      setTotalItems(data.total || data.totalItems || 0);
    }
  }, [data, pageSize]);
  
  const goToPage = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };
  
  const nextPage = () => goToPage(page + 1);
  const prevPage = () => goToPage(page - 1);
  const firstPage = () => goToPage(1);
  const lastPage = () => goToPage(totalPages);
  
  return {
    items,
    loading,
    error,
    page,
    pageSize,
    totalPages,
    totalItems,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    setPageSize,
    refetch
  };
};

/**
 * Hook for polling API endpoints
 * @param {string} endpoint - API endpoint
 * @param {number} interval - Polling interval in ms
 * @param {Object} options - Request options
 * @returns {Object} { data, loading, error, start, stop, isPolling }
 */
export const usePollingApi = (endpoint, interval = 5000, options = {}) => {
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef(null);
  const { data, loading, error, refetch } = useApiCall(endpoint, {
    ...options,
    immediate: false
  });
  
  const start = useCallback(() => {
    if (!isPolling) {
      setIsPolling(true);
      refetch(); // Initial fetch
      intervalRef.current = setInterval(() => {
        refetch();
      }, interval);
    }
  }, [isPolling, interval, refetch]);
  
  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsPolling(false);
    }
  }, []);
  
  useEffect(() => {
    if (options.autoStart !== false) {
      start();
    }
    
    return () => {
      stop();
    };
  }, []);
  
  return { data, loading, error, start, stop, isPolling };
};

/**
 * Hook for debounced search API calls
 * @param {string} endpoint - API endpoint
 * @param {string} query - Search query
 * @param {Object} options - Request options
 * @returns {Object} { results, loading, error, search }
 */
export const useSearchApi = (endpoint, query = '', options = {}) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debouncedQuery = useDebounce(query, options.debounceDelay || 300);
  const abortController = useRef(null);
  
  const search = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length < (options.minLength || 2)) {
      setResults([]);
      return;
    }
    
    if (abortController.current) {
      abortController.current.abort();
    }
    
    abortController.current = new AbortController();
    
    try {
      setLoading(true);
      setError(null);
      
      const token = await getAuthToken();
      const params = new URLSearchParams({
        q: searchQuery,
        ...options.params
      }).toString();
      
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}${endpoint}?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: abortController.current.signal
        }
      );
      
      if (!response.ok) {
        throw new Error(`Search error: ${response.status}`);
      }
      
      const data = await response.json();
      setResults(data.results || data.items || data.data || []);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, [endpoint, options]);
  
  useEffect(() => {
    if (debouncedQuery) {
      search(debouncedQuery);
    } else {
      setResults([]);
    }
    
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [debouncedQuery]);
  
  return { results, loading, error, search };
};

/**
 * Hook for mutation operations (POST, PUT, DELETE)
 * @param {Function} mutationFn - Function that performs the mutation
 * @returns {Object} { mutate, loading, error, data }
 */
export const useMutation = (mutationFn) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  
  const mutate = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);
      const result = await mutationFn(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [mutationFn]);
  
  return { mutate, loading, error, data };
};

// Legacy export for backward compatibility
export const useApi = useApiCall;

// src/hooks/useLocalStorage.js
export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error reading localStorage:', error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error setting localStorage:', error);
    }
  };

  return [storedValue, setValue];
};