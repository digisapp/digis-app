/**
 * Analytics Facade
 *
 * Type-safe wrapper around window.analytics to prevent runtime errors
 * and provide consistent logging in development.
 *
 * Benefits:
 * - Safe in development (logs to console instead of calling undefined functions)
 * - Type-safe API (no window casting everywhere)
 * - Easy to swap analytics providers later
 * - Centralized tracking point for debugging
 */

const isProd = import.meta.env.PROD;

/**
 * Check if user has Do Not Track enabled
 */
function isDNTEnabled() {
  return navigator.doNotTrack === '1' ||
         navigator.doNotTrack === 'yes' ||
         window.doNotTrack === '1';
}

/**
 * Analytics API - mirrors Segment/Mixpanel/etc.
 *
 * Usage:
 *   analytics.identify('user-123', { email: 'user@example.com' });
 *   analytics.track('button_clicked', { button: 'sign_up' });
 *   analytics.page('/dashboard', { referrer: '/explore' });
 */
export const analytics = {
  /**
   * Identify a user with traits
   */
  identify(id, traits) {
    // Respect Do Not Track
    if (isDNTEnabled()) {
      console.debug('[analytics] DNT enabled - skipping identify');
      return;
    }

    if (!isProd) {
      console.debug('[analytics.identify]', id, traits);
      return;
    }

    const analyticsInstance = window.analytics;
    if (analyticsInstance?.identify) {
      analyticsInstance.identify(id, traits);
    }
  },

  /**
   * Track a custom event
   */
  track(name, props) {
    // Respect Do Not Track
    if (isDNTEnabled()) {
      console.debug('[analytics] DNT enabled - skipping track');
      return;
    }

    if (!isProd) {
      console.debug('[analytics.track]', name, props);
      return;
    }

    const analyticsInstance = window.analytics;
    if (analyticsInstance?.track) {
      analyticsInstance.track(name, props);
    }
  },

  /**
   * Track a page view
   */
  page(name, props) {
    // Respect Do Not Track
    if (isDNTEnabled()) {
      console.debug('[analytics] DNT enabled - skipping page');
      return;
    }

    if (!isProd) {
      console.debug('[analytics.page]', name, props);
      return;
    }

    const analyticsInstance = window.analytics;
    if (analyticsInstance?.page) {
      analyticsInstance.page(name, props);
    }
  },

  /**
   * Track a user action (convenience wrapper)
   */
  action(action, props) {
    this.track(`action_${action}`, props);
  },

  /**
   * Track navigation events (convenience wrapper)
   */
  navigate(from, to, duration) {
    this.track('route_navigation', {
      from,
      to,
      duration_ms: duration,
    });
  },
};

/**
 * Initialize analytics (call from main.jsx)
 *
 * Example:
 *   <script>
 *     window.analytics = { ... };
 *   </script>
 */
export function initAnalytics() {
  if (!isProd) {
    console.debug('[analytics] Running in development mode - events will be logged to console');
    return;
  }

  // Check if analytics is available
  if (!window.analytics) {
    console.warn('[analytics] window.analytics not found - tracking disabled');
    return;
  }

  console.debug('[analytics] Initialized successfully');
}
