/**
 * Route Configuration
 *
 * Central mapping between legacy view names and React Router paths.
 * Used by setView shim to maintain backward compatibility during gradual migration.
 */

export const VIEW_TO_PATH: Record<string, string> = {
  // Core views
  'dashboard': '/dashboard',
  'explore': '/explore',
  'home': '/',

  // User features
  'profile': '/profile',
  'settings': '/settings',
  'wallet': '/wallet',
  'messages': '/messages',

  // Creator features
  'analytics': '/analytics',
  'content': '/content',
  'schedule': '/schedule',
  'call-requests': '/call-requests',
  'calls': '/call-requests', // Alias
  'followers': '/followers',
  'subscribers': '/subscribers',
  'shop-management': '/shop-management',
  'kyc': '/kyc',
  'history': '/history',

  // Entertainment
  'tv': '/tv',
  'classes': '/classes',
  'shop': '/shop',
  'collections': '/collections',
  'streaming': '/streaming',
  'go-live': '/go-live',
  'stream': '/stream',

  // Social
  'following': '/following',

  // Call views
  'videoCall': '/call/video',
  'voiceCall': '/call/voice',

  // Admin
  'admin': '/admin',

  // Legacy/deprecated
  'offers': '/dashboard', // Merged into dashboard
  'creator-studio': '/content', // Renamed to content
  'subscriptions': '/subscribers', // Renamed to subscribers

  // Test/dev
  'supabase-test': '/supabase-test',
};

/**
 * Reverse mapping: path → view name
 * Useful for URL → currentView sync in adapter
 */
export const PATH_TO_VIEW: Record<string, string> = Object.entries(VIEW_TO_PATH).reduce(
  (acc, [view, path]) => {
    // Only set if not already mapped (handles aliases)
    if (!acc[path]) {
      acc[path] = view;
    }
    return acc;
  },
  {} as Record<string, string>
);

/**
 * Public routes that don't require authentication
 */
export const PUBLIC_ROUTES = [
  '/',
  '/terms',
  '/privacy',
  '/auth',
  '/creator/:username',
  '/:username/shop',
  '/:username/digitals',
  '/:username', // Direct username route
];

/**
 * Creator-only routes
 */
export const CREATOR_ROUTES = [
  '/analytics',
  '/content',
  '/call-requests',
  '/followers',
  '/subscribers',
  '/shop-management',
  '/history',
];

/**
 * Admin-only routes
 */
export const ADMIN_ROUTES = [
  '/admin',
];
