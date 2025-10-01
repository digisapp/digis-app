// Centralized view constants and route mappings

// View constants - single source of truth for all views
export const VIEW = Object.freeze({
  HOME: 'home',
  DASHBOARD: 'dashboard',
  EXPLORE: 'explore',
  MESSAGES: 'messages',
  WALLET: 'wallet',
  PROFILE: 'profile',
  SETTINGS: 'settings',
  CONTENT: 'content',
  SCHEDULE: 'schedule',
  ANALYTICS: 'analytics',
  CALLS: 'calls',
  CALL_REQUESTS: 'call-requests',
  CALL_MANAGEMENT: 'call-management',
  TV: 'tv',
  CLASSES: 'classes',
  ADMIN: 'admin',
  STREAMING: 'streaming',
  VIDEO_CALL: 'videoCall',
  VOICE_CALL: 'voiceCall',
  FOLLOWERS: 'followers',
  SUBSCRIBERS: 'subscribers',
  EDIT_PROFILE: 'edit-profile',
  CREATOR_APPLICATION: 'creator-application',
  SHOP: 'shop',
  SHOP_MANAGEMENT: 'shop-management',
  COLLECTIONS: 'collections',
  DIGITALS: 'digitals',
  RATES: 'rates',
  PRIVACY: 'privacy',
  TERMS: 'terms',
  TOKEN_PURCHASE: 'token-purchase',
  CONNECT: 'connect'
});

// Path mappings for each view
export const PATH_FOR_VIEW = Object.freeze({
  [VIEW.HOME]: '/',
  [VIEW.DASHBOARD]: '/dashboard',
  [VIEW.EXPLORE]: '/explore',
  [VIEW.MESSAGES]: '/messages',
  [VIEW.WALLET]: '/wallet',
  [VIEW.PROFILE]: '/profile',
  [VIEW.SETTINGS]: '/settings',
  [VIEW.CONTENT]: '/content',
  [VIEW.SCHEDULE]: '/schedule',
  [VIEW.ANALYTICS]: '/analytics',
  [VIEW.CALLS]: '/calls',
  [VIEW.CALL_REQUESTS]: '/call-requests',
  [VIEW.CALL_MANAGEMENT]: '/call-management',
  [VIEW.TV]: '/tv',
  [VIEW.CLASSES]: '/classes',
  [VIEW.ADMIN]: '/admin',
  [VIEW.STREAMING]: '/streaming',
  [VIEW.VIDEO_CALL]: '/call/video',
  [VIEW.VOICE_CALL]: '/call/voice',
  [VIEW.FOLLOWERS]: '/followers',
  [VIEW.SUBSCRIBERS]: '/subscribers',
  [VIEW.EDIT_PROFILE]: '/edit-profile',
  [VIEW.CREATOR_APPLICATION]: '/creator-application',
  [VIEW.SHOP]: '/shop',
  [VIEW.SHOP_MANAGEMENT]: '/shop-management',
  [VIEW.COLLECTIONS]: '/collections',
  [VIEW.DIGITALS]: '/digitals',
  [VIEW.RATES]: '/rates',
  [VIEW.PRIVACY]: '/privacy',
  [VIEW.TERMS]: '/terms',
  [VIEW.TOKEN_PURCHASE]: '/token-purchase',
  [VIEW.CONNECT]: '/connect'
});

// Reverse mapping for URL to view lookups
export const VIEW_FOR_PATH = Object.freeze(
  Object.fromEntries(
    Object.entries(PATH_FOR_VIEW).map(([view, path]) => [path, view])
  )
);

// Helper functions
export const getPathForView = (view) => PATH_FOR_VIEW[view] || '/';
export const getViewForPath = (path) => VIEW_FOR_PATH[path] || VIEW.HOME;

// Check if a view requires authentication
export const AUTH_REQUIRED_VIEWS = new Set([
  VIEW.DASHBOARD,
  VIEW.MESSAGES,
  VIEW.WALLET,
  VIEW.PROFILE,
  VIEW.SETTINGS,
  VIEW.CONTENT,
  VIEW.SCHEDULE,
  VIEW.ANALYTICS,
  VIEW.CALLS,
  VIEW.CALL_REQUESTS,
  VIEW.CALL_MANAGEMENT,
  VIEW.ADMIN,
  VIEW.STREAMING,
  VIEW.VIDEO_CALL,
  VIEW.VOICE_CALL,
  VIEW.FOLLOWERS,
  VIEW.SUBSCRIBERS,
  VIEW.EDIT_PROFILE,
  VIEW.SHOP_MANAGEMENT,
  VIEW.COLLECTIONS,
  VIEW.DIGITALS,
  VIEW.RATES
]);

// Check if a view is creator-only
export const CREATOR_ONLY_VIEWS = new Set([
  VIEW.ANALYTICS,
  VIEW.CALL_MANAGEMENT,
  VIEW.STREAMING,
  VIEW.FOLLOWERS,
  VIEW.SUBSCRIBERS,
  VIEW.SHOP_MANAGEMENT,
  VIEW.RATES
]);

// Check if a view is admin-only
export const ADMIN_ONLY_VIEWS = new Set([
  VIEW.ADMIN
]);

// Check if a view is public (no auth required)
export const PUBLIC_VIEWS = new Set([
  VIEW.HOME,
  VIEW.EXPLORE,
  VIEW.TV,
  VIEW.CLASSES,
  VIEW.SHOP,
  VIEW.PRIVACY,
  VIEW.TERMS,
  VIEW.CREATOR_APPLICATION,
  VIEW.CONNECT,
  VIEW.TOKEN_PURCHASE
]);

// Export helper to check view permissions
export const canAccessView = (view, { isAuthenticated, isCreator, isAdmin }) => {
  if (ADMIN_ONLY_VIEWS.has(view)) {
    return isAdmin;
  }
  if (CREATOR_ONLY_VIEWS.has(view)) {
    return isCreator;
  }
  if (AUTH_REQUIRED_VIEWS.has(view)) {
    return isAuthenticated;
  }
  return true; // Public view
};