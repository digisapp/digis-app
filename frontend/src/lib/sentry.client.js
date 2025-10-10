/**
 * Sentry Client Configuration
 *
 * Initializes Sentry for error tracking, performance monitoring,
 * and session replay in production.
 *
 * To enable:
 * 1. Install: npm i @sentry/react
 * 2. Set VITE_SENTRY_DSN in .env.production
 * 3. Call initSentry() in main.jsx before ReactDOM.render()
 */

/**
 * Initialize Sentry SDK
 *
 * Only runs in production to avoid polluting dev logs.
 * Safe to call even if Sentry package is not installed.
 */
export function initSentry() {
  // Skip in development
  if (!import.meta.env.PROD) {
    console.debug('[sentry] Skipping initialization in development mode');
    return;
  }

  // Check if DSN is configured
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn('[sentry] VITE_SENTRY_DSN not configured - error tracking disabled');
    return;
  }

  try {
    // Dynamic import to avoid bundle bloat if not using Sentry
    import('@sentry/react').then((Sentry) => {
      Sentry.init({
        dsn,

        // Performance monitoring
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
          }),
        ],

        // Performance sampling (20% of transactions)
        tracesSampleRate: 0.2,

        // Session replay sampling
        replaysSessionSampleRate: 0.0, // Don't record all sessions
        replaysOnErrorSampleRate: 1.0, // Record all error sessions

        // Environment tracking
        environment: import.meta.env.MODE,

        // Release tracking (use git commit hash in CI)
        release: import.meta.env.VITE_APP_VERSION || 'development',

        // Ignore common non-errors
        ignoreErrors: [
          // Browser extensions
          'top.GLOBALS',
          'Can\'t find variable: _AutofillCallbackHandler',

          // Network errors (expected in some cases)
          'NetworkError',
          'Failed to fetch',

          // Third-party scripts
          'fb_xd_fragment',
          'bmi_SafeAddOnload',
        ],

        // Attach user context automatically
        beforeSend(event, hint) {
          // Filter out development errors
          if (event.environment === 'development') {
            return null;
          }

          // Add route context if available
          if (window.location) {
            event.tags = {
              ...event.tags,
              route: window.location.pathname,
            };
          }

          return event;
        },
      });

      console.debug('[sentry] Initialized successfully');
    });
  } catch (error) {
    console.error('[sentry] Failed to initialize:', error);
  }
}

/**
 * Manually capture an exception
 *
 * Usage:
 *   try { ... } catch (err) { captureError(err, { context: 'user_action' }); }
 */
export function captureError(error, context) {
  if (!import.meta.env.PROD) {
    console.error('[sentry]', error, context);
    return;
  }

  if (window.Sentry) {
    window.Sentry.captureException(error, {
      extra: context,
    });
  }
}

/**
 * Set user context for error tracking
 *
 * Usage:
 *   setUser({ id: '123', email: 'user@example.com' });
 */
export function setUser(user) {
  if (!import.meta.env.PROD) return;

  if (window.Sentry) {
    window.Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  }
}

/**
 * Clear user context (on logout)
 */
export function clearUser() {
  if (!import.meta.env.PROD) return;

  if (window.Sentry) {
    window.Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for debugging context
 *
 * Usage:
 *   addBreadcrumb('User clicked submit button', { formId: 'login' });
 */
export function addBreadcrumb(message, data) {
  if (!import.meta.env.PROD) return;

  if (window.Sentry) {
    window.Sentry.addBreadcrumb({
      message,
      data,
      level: 'info',
    });
  }
}
