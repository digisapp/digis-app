/**
 * Fetch with retry logic for network resilience
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options
 * @param {number} retries - Number of retry attempts
 * @param {number} delay - Delay between retries in milliseconds
 * @param {number} timeout - Request timeout in milliseconds
 * @returns {Promise<Response>} - The fetch response
 */
export const fetchWithRetry = async (url, options = {}, retries = 3, delay = 1000, timeout = 10000) => {
  // Parameter validation
  if (!url || typeof url !== 'string') {
    throw new Error('URL is required and must be a string');
  }
  if (typeof retries !== 'number' || retries < 1) {
    throw new Error('Retries must be a positive number');
  }
  if (typeof delay !== 'number' || delay < 0) {
    throw new Error('Delay must be a non-negative number');
  }
  if (typeof timeout !== 'number' || timeout < 0) {
    throw new Error('Timeout must be a non-negative number');
  }
  
  let lastError;
  const maxDelay = 30000; // Cap exponential backoff at 30 seconds
  
  for (let i = 0; i < retries; i++) {
    let timeoutId; // Declare outside try block
    
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeout);
      
      // Merge abort signal with existing options
      const fetchOptions = {
        ...options,
        signal: options.signal || controller.signal
      };
      
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);
      
      // If response is ok, return it
      if (response.ok) {
        return response;
      }
      
      // If it's a client error (4xx), don't retry (except 429 - rate limiting and 401 for JWT issues)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        // For 404s, silently return the response to let component-level handlers deal with it
        if (response.status === 404) {
          return response;
        }

        // Handle JWT token errors (401) - try to refresh and retry once
        if (response.status === 401 && i === 0) {
          const errorText = await response.text().catch(() => '');
          if (errorText.includes('token is malformed') || errorText.includes('invalid JWT')) {
            console.warn('⚠️ JWT token error detected, attempting session refresh...');
            try {
              // Dynamically import to avoid circular dependencies
              const { supabase } = await import('./supabase-auth.js');
              const { data: { session } } = await supabase.auth.refreshSession();

              if (session?.access_token) {
                // Update the Authorization header with new token
                if (options.headers) {
                  options.headers.Authorization = `Bearer ${session.access_token}`;
                }
                console.log('✅ Session refreshed, retrying request...');
                await new Promise(resolve => setTimeout(resolve, 500));
                continue; // Retry the request with new token
              }
            } catch (refreshError) {
              console.error('❌ Failed to refresh session:', refreshError);
              // Force user to re-login
              window.location.href = '/auth/signin?expired=true';
              throw new Error('Session expired. Please sign in again.');
            }
          }
        }

        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      // For server errors (5xx) and rate limiting (429), retry
      if (i < retries - 1) {
        const exponentialDelay = Math.min(delay * Math.pow(2, i), maxDelay);
        const retryDelay = response.status === 429 
          ? Math.min(parseInt(response.headers.get('Retry-After') || delay, 10) * 1000, maxDelay)
          : exponentialDelay;
          
        console.warn(`Retry ${i + 1}/${retries} for ${url}: HTTP ${response.status}, waiting ${retryDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      // Last attempt failed
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
      
    } catch (error) {
      // Clear timeout on error
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      lastError = error;
      
      // Check if it's a network error or abort error
      const isNetworkError = error.name === 'TypeError' && error.message.includes('Failed to fetch');
      const isAbortError = error.name === 'AbortError';
      
      // If it's an abort error from timeout, update error message
      if (isAbortError && !options.signal) {
        lastError = new Error(`Request timeout after ${timeout}ms`);
      }
      
      // If it's not a network error or we're on the last retry, throw
      if ((!isNetworkError && !isAbortError) || i === retries - 1) {
        throw lastError;
      }
      
      // Network error - retry with exponential backoff (capped)
      const retryDelay = Math.min(delay * Math.pow(2, i), maxDelay);
      console.warn(`Retry ${i + 1}/${retries} for ${url}: ${error.message}, waiting ${retryDelay}ms`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  throw lastError || new Error('Request failed after all retries');
};

/**
 * Enhanced fetch with retry for JSON APIs
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options
 * @param {number} retries - Number of retry attempts
 * @param {number} delay - Delay between retries in milliseconds
 * @param {number} timeout - Request timeout in milliseconds
 * @returns {Promise<any>} - The parsed JSON response
 */
export const fetchJSONWithRetry = async (url, options = {}, retries = 3, delay = 1000, timeout = 10000) => {
  const response = await fetchWithRetry(url, options, retries, delay, timeout);
  
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    console.error(`Expected JSON response but got ${contentType}:`, text);
    throw new Error('Response is not JSON');
  }
  
  try {
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to parse JSON response:', error);
    throw new Error('Invalid JSON response');
  }
};

/**
 * Create fetch with abort capability
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options
 * @param {number} timeout - Request timeout in milliseconds
 * @returns {object} - Object with promise and abort function
 */
export const createAbortableFetch = (url, options = {}, timeout = 10000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  const promise = fetch(url, {
    ...options,
    signal: controller.signal
  }).finally(() => {
    clearTimeout(timeoutId);
  });
  
  return {
    promise,
    abort: () => {
      clearTimeout(timeoutId);
      controller.abort();
    }
  };
};

/**
 * Validate environment variables
 * @returns {object} - Validated environment variables
 */
export const validateEnvVars = () => {
  const requiredVars = {
    VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_AGORA_APP_ID: import.meta.env.VITE_AGORA_APP_ID
  };

  const missing = Object.entries(requiredVars)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return requiredVars;
};