// /src/utils/http.js
// Unified HTTP helper with consistent error handling and JSON parsing

/**
 * fetchJSON
 * Standardized fetch wrapper with automatic JSON parsing and error handling
 *
 * @param {string} url - Full URL to fetch
 * @param {object} options - Fetch options
 * @param {string} options.method - HTTP method (default: 'GET')
 * @param {object} options.headers - Additional headers
 * @param {object} options.body - Request body (will be JSON.stringify'd)
 * @returns {Promise<any>} Parsed JSON response
 * @throws {Error} If response is not ok
 */
export async function fetchJSON(url, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let msg = 'Request failed';
    try {
      const j = await res.json();
      msg = j.message || msg;
    } catch {}
    throw new Error(msg);
  }

  return res.json();
}
