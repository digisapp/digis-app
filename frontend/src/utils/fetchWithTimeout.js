/**
 * Fetch with timeout and graceful fallback
 * Prevents infinite loading when backend is unresponsive
 */

/**
 * Fetch with timeout wrapper
 * @param {string} url - URL to fetch
 * @param {object} opts - Fetch options plus optional timeout
 * @param {number} opts.timeout - Timeout in ms (default: 6000)
 * @returns {Promise<Response>}
 * @throws {Error} - If timeout reached, error has name='timeout'
 */
export async function fetchWithTimeout(url, opts = {}) {
  const { timeout = 6000, ...rest } = opts;
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...rest,
      signal: ac.signal,
      credentials: rest.credentials || 'include' // Default to include for cookies
    });
    return response;
  } catch (error) {
    // Distinguish timeout vs network error
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'timeout';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Safe fetch wrapper that never throws - always returns an object
 * @param {string} url
 * @param {object} opts
 * @returns {Promise<{ok: boolean, data?: any, error?: string, status?: number}>}
 */
export async function safeFetch(url, opts = {}) {
  try {
    const response = await fetchWithTimeout(url, opts);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        ok: false,
        status: response.status,
        error: errorData.error || errorData.message || `HTTP ${response.status}`,
        data: errorData
      };
    }

    const data = await response.json().catch(() => ({}));
    return { ok: true, data, status: response.status };
  } catch (error) {
    return {
      ok: false,
      error: error.name === 'timeout' ? 'timeout' : error.message || 'Network error',
      status: error.name === 'timeout' ? 504 : 0
    };
  }
}
