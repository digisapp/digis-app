/**
 * Route Configuration - Single Source of Truth
 *
 * Maps between view names (legacy) and URL paths (new).
 * Grow this as you migrate more screens to URL-based routing.
 *
 * IMPORTANT: Every route in AppRoutes.jsx should exist here, and vice-versa.
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
  'go-live': '/go-live',
  stream: '/stream',
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

/**
 * Reverse map: path → view
 * Supports exact matches and prefix fallback for nested routes
 */
export const PATH_TO_VIEW = Object.fromEntries(
  Object.entries(VIEW_TO_PATH).map(([view, path]) => [path, view])
);

/**
 * Safe path lookup with normalization
 * Handles views with or without leading slash, returns null for unknown views
 *
 * @param {string} view - View name (e.g., 'dashboard' or 'call-requests')
 * @returns {string|null} - Path (e.g., '/dashboard') or null if unknown
 */
export const viewToPathSafe = (view) => {
  if (!view) {
    console.warn('[routeConfig] viewToPathSafe: empty view');
    return null;
  }

  const path = VIEW_TO_PATH[view];

  if (!path) {
    console.warn(`[routeConfig] Unknown view: "${view}"`);
    return null;
  }

  // Ensure leading slash
  return path.startsWith('/') ? path : `/${path}`;
};

/**
 * Safe view lookup from path
 * Supports exact matches and prefix fallback for nested routes
 *
 * @param {string} path - URL path (e.g., '/dashboard' or '/analytics/overview')
 * @returns {string|null} - View name or null if not found
 */
export const pathToViewSafe = (path) => {
  if (!path) return null;

  // Exact match
  const exactView = PATH_TO_VIEW[path];
  if (exactView) return exactView;

  // Prefix fallback for nested routes (e.g., /analytics/overview → analytics)
  const prefixMatch = Object.entries(VIEW_TO_PATH).find(([, p]) =>
    path.startsWith(p) && path !== p
  );

  if (prefixMatch) {
    return prefixMatch[0];
  }

  return null;
};

/**
 * Navigation helper - use this everywhere instead of direct navigate()
 * Ensures consistent path handling and logging
 *
 * @param {Function} navigate - React Router navigate function
 * @param {string} view - View name to navigate to
 * @param {Object} options - Navigation options (replace, state, etc.)
 */
export const navigateToView = (navigate, view, options = {}) => {
  const path = viewToPathSafe(view);

  if (!path) {
    console.error(`[routeConfig] Cannot navigate to unknown view: "${view}"`);
    return;
  }

  console.log(`[routeConfig] Navigating to view: ${view} → ${path}`);
  navigate(path, options);
};
