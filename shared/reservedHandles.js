/**
 * Reserved Handles - Username Blacklist
 *
 * These names cannot be used as usernames to prevent conflicts with:
 * - App routes (/explore, /login, etc.)
 * - System files (robots.txt, favicon.ico, etc.)
 * - Admin/internal pages
 * - Future features
 *
 * Used by both frontend and backend for validation.
 *
 * IMPORTANT: When adding new top-level routes to the app,
 * add them here to prevent username conflicts!
 */

const RESERVED_HANDLES = new Set([
  // Empty/invalid
  '',

  // Core app pages
  'home',
  'explore',
  'search',
  'discover',
  'trending',
  'live',

  // Auth & account
  'login',
  'logout',
  'signup',
  'register',
  'signin',
  'signout',
  'auth',
  'verify',
  'confirm',
  'reset',
  'forgot',
  'password',

  // User features
  'settings',
  'profile',
  'edit',
  'account',
  'dashboard',
  'wallet',
  'balance',
  'tokens',
  'purchases',

  // Creator features
  'creator',
  'creators',
  'become-creator',
  'apply',
  'studio',
  'analytics',
  'earnings',
  'payouts',
  'schedule',
  'availability',

  // Communication
  'messages',
  'inbox',
  'chat',
  'notifications',
  'alerts',
  'calls',
  'video',
  'voice',

  // Commerce
  'offers',
  'deals',
  'shop',
  'store',
  'cart',
  'checkout',
  'payment',
  'billing',
  'subscribe',
  'subscription',
  'subscriptions',
  'membership',
  'tiers',

  // Content
  'posts',
  'feed',
  'stream',
  'streams',
  'video',
  'videos',
  'photo',
  'photos',
  'gallery',
  'media',
  'content',

  // Legal & info
  'privacy',
  'terms',
  'tos',
  'legal',
  'dmca',
  'copyright',
  'help',
  'support',
  'faq',
  'about',
  'contact',
  'press',
  'blog',
  'news',

  // Admin & internal
  'admin',
  'staff',
  'moderator',
  'mod',
  'internal',
  'system',
  'api',
  'webhook',
  'webhooks',
  'cron',

  // Technical/system
  'uploads',
  'static',
  'assets',
  'public',
  'cdn',
  'img',
  'images',
  'js',
  'css',
  'fonts',

  // System files
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'manifest.json',
  '.well-known',

  // Reserved for future features
  'tv',
  'premium',
  'vip',
  'exclusive',
  'special',
  'featured',
  'verified',
  'official',

  // Prevent confusion with common usernames
  'digis',
  'admin',
  'support',
  'help',
  'team',
  'info',
  'hello',
  'welcome',

  // Prevent abuse
  'fuck',
  'shit',
  'ass',
  'bitch',
  'nigger',
  'nigga',
  'faggot',
  'cunt',
  'dick',
  'cock',
  'pussy',
  'porn',
  'sex',
  'xxx',
  'adult',

  // Test/placeholder
  'test',
  'demo',
  'example',
  'sample',
  'placeholder',
  'null',
  'undefined',
  'none',
  'admin',
  'root',
  'user',
  'guest'
]);

/**
 * Check if a username is reserved
 * @param {string} username - Username to check (will be normalized)
 * @returns {boolean} - True if reserved, false otherwise
 */
function isReserved(username) {
  if (!username) return true;
  const normalized = String(username).trim().toLowerCase();
  return RESERVED_HANDLES.has(normalized);
}

/**
 * Get all reserved handles as an array
 * @returns {string[]} - Array of reserved handles
 */
function getAllReserved() {
  return Array.from(RESERVED_HANDLES).sort();
}

// CommonJS export (for backend)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RESERVED_HANDLES,
    isReserved,
    getAllReserved
  };
}

// ES Module export (for frontend)
if (typeof exports !== 'undefined') {
  exports.RESERVED_HANDLES = RESERVED_HANDLES;
  exports.isReserved = isReserved;
  exports.getAllReserved = getAllReserved;
}
