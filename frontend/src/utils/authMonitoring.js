/**
 * Auth Monitoring & Observability
 *
 * Tracks auth interactions to identify when users unexpectedly
 * hit auth walls or permission issues.
 */

/**
 * Add breadcrumb for tracking (Sentry, LogRocket, etc.)
 * Falls back to console if no monitoring tool available
 */
const addBreadcrumb = (breadcrumb) => {
  // Sentry
  if (window.Sentry?.addBreadcrumb) {
    window.Sentry.addBreadcrumb(breadcrumb);
  }

  // LogRocket
  if (window.LogRocket?.track) {
    window.LogRocket.track(breadcrumb.message, breadcrumb.data);
  }

  // Fallback to console in development
  if (import.meta.env.DEV) {
    console.log('[Auth Breadcrumb]', breadcrumb.message, breadcrumb.data);
  }
};

/**
 * Track when interaction is blocked (no session)
 *
 * @param {string} intent - Action being attempted (e.g., 'follow', 'tip')
 * @param {string} username - Target username (sanitized)
 * @param {Object} metadata - Additional context
 */
export const trackInteractionBlocked = (intent, username, metadata = {}) => {
  const safeUsername = username?.substring(0, 20) || 'unknown';

  addBreadcrumb({
    category: 'auth',
    message: 'interaction_blocked',
    level: 'info',
    data: {
      intent,
      username: safeUsername,
      timestamp: new Date().toISOString(),
      ...metadata
    }
  });

  // Track metric for analytics
  if (window.gtag) {
    window.gtag('event', 'auth_blocked', {
      event_category: 'auth',
      event_label: intent,
      value: 1
    });
  }
};

/**
 * Track when interaction is allowed (user authenticated)
 *
 * @param {string} intent - Action being performed
 * @param {string} username - Target username (sanitized)
 * @param {Object} metadata - Additional context
 */
export const trackInteractionAllowed = (intent, username, metadata = {}) => {
  const safeUsername = username?.substring(0, 20) || 'unknown';

  addBreadcrumb({
    category: 'auth',
    message: 'interaction_allowed',
    level: 'info',
    data: {
      intent,
      username: safeUsername,
      timestamp: new Date().toISOString(),
      ...metadata
    }
  });

  // Track successful auth for conversion funnel
  if (window.gtag) {
    window.gtag('event', 'auth_success', {
      event_category: 'auth',
      event_label: intent,
      value: 1
    });
  }
};

/**
 * Track auth errors (unexpected failures)
 *
 * @param {string} intent - Action that failed
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
export const trackAuthError = (intent, error, context = {}) => {
  addBreadcrumb({
    category: 'auth',
    message: 'auth_error',
    level: 'error',
    data: {
      intent,
      error: error.message,
      stack: error.stack?.substring(0, 500),
      timestamp: new Date().toISOString(),
      ...context
    }
  });

  // Report error to monitoring
  if (window.Sentry?.captureException) {
    window.Sentry.captureException(error, {
      tags: { intent, category: 'auth' },
      extra: context
    });
  }
};

/**
 * Enhanced version of handleInteraction with monitoring
 *
 * Wraps your existing handleInteraction to add observability
 *
 * @param {Function} originalHandleInteraction - Your existing function
 * @returns {Function} - Wrapped version with monitoring
 *
 * @example
 * const handleInteraction = monitoredInteraction(requireAuthSimple);
 */
export const monitoredInteraction = (originalHandleInteraction) => {
  return async (intent, metadata) => {
    try {
      const result = await originalHandleInteraction({ intent, metadata });

      if (result) {
        // Auth succeeded
        trackInteractionAllowed(
          intent,
          metadata?.username || metadata?.creator?.username,
          { metadata }
        );
      } else {
        // Auth blocked (user not logged in)
        trackInteractionBlocked(
          intent,
          metadata?.username || metadata?.creator?.username,
          { metadata }
        );
      }

      return result;
    } catch (error) {
      // Unexpected error
      trackAuthError(intent, error, { metadata });
      throw error;
    }
  };
};

/**
 * Create a dashboard-friendly summary of auth metrics
 *
 * Call this periodically (e.g., every 5 minutes) to get auth funnel stats
 *
 * @returns {Object} Auth metrics
 */
export const getAuthMetrics = () => {
  // In production, these would be pulled from your analytics service
  // This is a placeholder for local tracking

  if (!window._authMetrics) {
    window._authMetrics = {
      blocked: 0,
      allowed: 0,
      errors: 0
    };
  }

  const metrics = window._authMetrics;

  return {
    blocked: metrics.blocked,
    allowed: metrics.allowed,
    errors: metrics.errors,
    conversionRate:
      metrics.blocked > 0
        ? ((metrics.allowed / (metrics.blocked + metrics.allowed)) * 100).toFixed(2)
        : 0,
    timestamp: new Date().toISOString()
  };
};

// Track metrics locally (dev mode)
if (import.meta.env.DEV) {
  if (!window._authMetrics) {
    window._authMetrics = { blocked: 0, allowed: 0, errors: 0 };
  }

  // Expose metrics getter in console
  window.getAuthMetrics = getAuthMetrics;
}
