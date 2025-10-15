/**
 * Safe fetch wrapper that doesn't crash the app on API errors
 * Returns { success: false, error } instead of throwing
 */
export async function safeFetch(url, options = {}) {
  try {
    console.log(`🌐 safeFetch: ${options.method || 'GET'} ${url}`);

    const response = await fetch(url, options);

    // Try to parse JSON response
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    let data;
    if (isJson) {
      try {
        data = await response.json();
      } catch (parseError) {
        console.warn(`⚠️  Failed to parse JSON response from ${url}:`, parseError.message);
        data = { success: false, error: 'Invalid JSON response' };
      }
    } else {
      const text = await response.text();
      data = { success: false, error: `Non-JSON response: ${text.substring(0, 100)}` };
    }

    // Check HTTP status
    if (!response.ok) {
      console.warn(`⚠️  HTTP ${response.status} from ${url}:`, data);
      return {
        success: false,
        status: response.status,
        error: data.error || data.message || `HTTP ${response.status}`,
        details: data
      };
    }

    // Success
    console.log(`✅ safeFetch success: ${url}`);
    return { success: true, ...data };

  } catch (networkError) {
    // Network error, timeout, or other fetch failure
    console.error(`❌ safeFetch network error for ${url}:`, networkError.message);
    return {
      success: false,
      error: 'Network error - check your connection',
      networkError: networkError.message
    };
  }
}

/**
 * Safe GET request
 */
export async function safeGet(url, headers = {}) {
  return safeFetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

/**
 * Safe POST request
 */
export async function safePost(url, body = {}, headers = {}) {
  return safeFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  });
}

/**
 * Safe PATCH request
 */
export async function safePatch(url, body = {}, headers = {}) {
  return safeFetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  });
}

/**
 * Batch multiple API calls in parallel and don't fail if some fail
 * Returns an array of results in the same order as requests
 */
export async function safeBatch(requests) {
  console.log(`📦 safeBatch: Running ${requests.length} requests in parallel`);

  const results = await Promise.all(
    requests.map(async ({ name, fn }) => {
      try {
        const result = await fn();
        return { name, ...result };
      } catch (error) {
        console.warn(`⚠️  safeBatch: ${name} failed:`, error.message);
        return {
          name,
          success: false,
          error: error.message
        };
      }
    })
  );

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`📊 safeBatch complete: ${succeeded} succeeded, ${failed} failed`);

  return results;
}
