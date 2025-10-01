// Centralized breakpoint configuration for consistent mobile experience
export const BREAKPOINTS = {
  // Device breakpoints (updated for modern devices)
  MOBILE: 768,     // Mobile devices (includes larger phones)
  TABLET: 1024,    // Tablets
  DESKTOP: 1280,   // Desktop
  WIDE: 1536,      // Wide screens
  
  // Media query strings (updated for better mobile detection)
  MOBILE_QUERY: '(max-width: 768px)',     // All mobile devices
  TABLET_QUERY: '(max-width: 1024px)',    // Tablets and below
  MOBILE_PORTRAIT_QUERY: '(max-width: 768px) and (orientation: portrait)',
  MOBILE_LANDSCAPE_QUERY: '(max-width: 1024px) and (orientation: landscape)',
  DESKTOP_QUERY: '(min-width: 1280px)',   // Desktop and above
  WIDE_QUERY: '(min-width: 1536px)',      // Wide screens
  
  // Touch device detection
  TOUCH_QUERY: '(pointer: coarse)',
  HOVER_QUERY: '(hover: hover)',
};

// Touch target sizes (following iOS/Android guidelines)
export const TOUCH_TARGETS = {
  MINIMUM: 44,           // Minimum touch target size in pixels
  RECOMMENDED: 48,       // Recommended touch target size
  LARGE: 56,            // Large touch targets for primary actions
};

// Safe area insets for modern devices
export const SAFE_AREAS = {
  TOP: 'env(safe-area-inset-top)',
  RIGHT: 'env(safe-area-inset-right)',
  BOTTOM: 'env(safe-area-inset-bottom)',
  LEFT: 'env(safe-area-inset-left)',
};

// Animation durations optimized for mobile
export const ANIMATION = {
  FAST: 150,       // Fast transitions
  NORMAL: 250,     // Normal transitions
  SLOW: 350,       // Slow transitions
  SPRING: {
    stiffness: 300,
    damping: 30,
  },
};

// Z-index layers for consistent stacking
export const Z_INDEX = {
  DROPDOWN: 1000,
  STICKY: 1020,
  FIXED: 1030,
  MODAL_BACKDROP: 1040,
  MODAL: 1050,
  POPOVER: 1060,
  TOOLTIP: 1070,
  NOTIFICATION: 1080,
};

// Helper function to check if device is mobile
export const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  // Check for mobile in both portrait and landscape
  return window.matchMedia(BREAKPOINTS.MOBILE_QUERY).matches ||
         window.matchMedia(BREAKPOINTS.MOBILE_LANDSCAPE_QUERY).matches;
};

// Helper function to check orientation
export const isPortrait = () => {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(orientation: portrait)').matches;
};

// Helper function to check if device has touch capability
export const isTouchDevice = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(BREAKPOINTS.TOUCH_QUERY).matches ||
         'ontouchstart' in window ||
         navigator.maxTouchPoints > 0;
};

// Helper function to get current breakpoint
export const getCurrentBreakpoint = () => {
  if (typeof window === 'undefined') return 'desktop';
  
  const width = window.innerWidth;
  
  if (width <= BREAKPOINTS.MOBILE) return 'mobile';
  if (width <= BREAKPOINTS.TABLET) return 'tablet';
  if (width <= BREAKPOINTS.DESKTOP) return 'desktop';
  return 'wide';
};

export default BREAKPOINTS;