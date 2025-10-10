/**
 * Route Configuration - Single Source of Truth
 *
 * Maps between view names (legacy) and URL paths (new).
 * Grow this as you migrate more screens to URL-based routing.
 */

export const VIEW_TO_PATH = {
  // Auth & landing
  home: '/',

  // Core screens (high traffic)
  dashboard: '/dashboard',
  explore: '/explore',
  messages: '/messages',
  profile: '/profile',
  wallet: '/wallet',

  // Media & streaming
  tv: '/tv',
  streaming: '/streaming',
  videoCall: '/call/video',
  voiceCall: '/call/voice',

  // Creator features
  classes: '/classes',
  'call-requests': '/call-requests',
  schedule: '/schedule',
  analytics: '/analytics',
  content: '/content',
  calls: '/calls',

  // Shopping
  shop: '/shop',
  'shop-management': '/shop-management',
  collections: '/collections',

  // Admin
  admin: '/admin',

  // Social
  following: '/following',
  followers: '/followers',
  subscribers: '/subscribers',

  // Settings
  settings: '/settings',
  kyc: '/kyc',

  // Special
  'supabase-test': '/supabase-test',
  offers: '/offers',
  history: '/history'
};

export const PATH_TO_VIEW = Object.fromEntries(
  Object.entries(VIEW_TO_PATH).map(([view, path]) => [path, view])
);
