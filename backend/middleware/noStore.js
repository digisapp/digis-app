/**
 * No-Store Cache Middleware
 *
 * Prevents caching of auth'd endpoints to avoid stale role/profile data
 * CRITICAL for preventing "fan profile served after creator login" bugs
 *
 * Use this on:
 * - /api/users/me
 * - /api/auth/session
 * - Any endpoint that returns user-specific or role-specific data
 */
module.exports = function noStore(req, res, next) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store'); // For proxies/CDNs
  next();
};
