/**
 * Reserved Usernames - Shared List for Client & Server
 *
 * These usernames cannot be claimed by users to prevent collisions
 * with app routes, API endpoints, and system pages.
 *
 * IMPORTANT: Keep this list synchronized with backend validation.
 * Location: backend/shared/reservedUsernames.js (mirror this file)
 */

export const RESERVED_USERNAMES = new Set([
  // Core app routes
  'explore',
  'dashboard',
  'admin',
  'settings',
  'profile',
  'wallet',
  'messages',
  'notifications',

  // Authentication & onboarding
  'login',
  'signup',
  'signin',
  'register',
  'auth',
  'logout',
  'signout',

  // Content & features
  'stream',
  'streaming',
  'live',
  'tv',
  'classes',
  'shop',
  'collections',
  'content',
  'digitals',
  'offers',

  // User management
  'followers',
  'following',
  'subscribers',
  'subscriptions',
  'analytics',
  'earnings',
  'schedule',
  'calendar',
  'calls',
  'call-requests',
  'history',

  // Legal & support
  'terms',
  'privacy',
  'help',
  'support',
  'contact',
  'about',
  'faq',

  // Technical routes
  'api',
  'static',
  'assets',
  'public',
  'cdn',
  'media',
  'uploads',

  // Admin & internal
  'admin',
  'moderator',
  'staff',
  'team',
  'internal',

  // Shop & commerce
  'shop-management',
  'cart',
  'checkout',
  'orders',
  'products',

  // Other features
  'kyc',
  'verification',
  'creator',
  'fan',
  'user',
  'account',
  'billing',
  'payment',
  'subscribe',

  // Common reserved words
  'app',
  'home',
  'index',
  'main',
  'root',
  'www',
  'blog',
  'news',
  'search',

  // Brand protection
  'digis',
  'digisapp',
  'official',

  // Test & debugging
  'test',
  'testing',
  'debug',
  'supabase-test'
]);

/**
 * Check if a username is reserved
 * @param {string} username - Username to check (case-insensitive)
 * @returns {boolean} true if reserved, false if available
 */
export function isReservedUsername(username) {
  if (!username) return true;
  return RESERVED_USERNAMES.has(username.toLowerCase());
}

/**
 * Get a user-friendly error message for reserved usernames
 * @param {string} username - The reserved username
 * @returns {string} Error message
 */
export function getReservedUsernameError(username) {
  if (!username) return 'Username is required';

  const lower = username.toLowerCase();

  if (RESERVED_USERNAMES.has(lower)) {
    return `"${username}" is reserved for app functionality. Please choose a different username.`;
  }

  return 'Invalid username';
}

export default {
  RESERVED_USERNAMES,
  isReservedUsername,
  getReservedUsernameError
};
