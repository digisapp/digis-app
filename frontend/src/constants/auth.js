/**
 * Authentication Constants
 *
 * Single source of truth for authentication-related constants.
 */

/**
 * Logout destination - where users land after signing out
 * Handles both root deploys (/) and subpath deploys (/app/)
 * @constant {string}
 */
export const LOGOUT_DEST = (() => {
  const baseUrl = import.meta.env.BASE_URL || '/';
  // Normalize: remove trailing slashes, then add single trailing slash
  return baseUrl.replace(/\/+$/, '') + '/';
})();
