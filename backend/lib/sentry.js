/**
 * Sentry Configuration for Backend
 * Error tracking and performance monitoring
 */

const Sentry = require('@sentry/node');
const { ProfilingIntegration } = require('@sentry/profiling-node');

/**
 * Initialize Sentry with environment-specific configuration
 */
function initSentry(app) {
  // Only initialize if DSN is provided
  if (!process.env.SENTRY_DSN) {
    console.log('ℹ️ Sentry DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      // Automatically instrument Node.js libraries and frameworks
      ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
      new ProfilingIntegration(),
    ],

    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in production, 100% in dev
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // Profile 10% of transactions

    // Release tracking
    release: process.env.npm_package_version || 'unknown',

    // Don't send errors in development to Sentry
    enabled: process.env.NODE_ENV !== 'test',

    // Configure error filtering
    beforeSend(event, hint) {
      // Filter out specific errors
      if (event.exception) {
        const error = hint.originalException;

        // Don't send 404 errors
        if (error?.status === 404) {
          return null;
        }

        // Don't send validation errors
        if (error?.name === 'ValidationError') {
          return null;
        }

        // Filter out non-critical Redis errors
        if (error?.message?.includes('Redis') && error?.message?.includes('ECONNREFUSED')) {
          console.error('Redis connection error (not sent to Sentry):', error.message);
          return null;
        }
      }

      // Filter out sensitive data
      if (event.request) {
        // Remove authorization headers
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }

        // Remove sensitive body data
        if (event.request.data) {
          const sensitiveFields = ['password', 'token', 'secret', 'credit_card', 'ssn'];
          sensitiveFields.forEach(field => {
            if (event.request.data[field]) {
              event.request.data[field] = '[REDACTED]';
            }
          });
        }
      }

      return event;
    },

    // Capture user context (without PII)
    initialScope: {
      tags: {
        component: 'backend',
      },
    },
  });

  console.log('✅ Sentry initialized for', process.env.NODE_ENV);
}

/**
 * Express error handler middleware
 */
function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Capture errors with status code >= 500
      if (error.status >= 500) {
        return true;
      }
      // Also capture critical business logic errors
      if (error.critical === true) {
        return true;
      }
      return false;
    }
  });
}

/**
 * Capture user context for better error tracking
 */
function setUserContext(user) {
  if (!user) {
    Sentry.configureScope(scope => scope.setUser(null));
    return;
  }

  Sentry.setUser({
    id: user.id,
    username: user.username,
    email: user.email, // Only if you want to track by email
    // Don't include sensitive data like tokens, passwords, etc.
    ip_address: '{{auto}}', // Let Sentry capture IP automatically
    segment: user.role === 'creator' ? 'creator' : 'fan',
  });
}

/**
 * Add custom context to errors
 */
function addContext(key, context) {
  Sentry.setContext(key, context);
}

/**
 * Capture custom messages
 */
function captureMessage(message, level = 'info') {
  Sentry.captureMessage(message, level);
}

/**
 * Capture exceptions with additional context
 */
function captureException(error, context = {}) {
  Sentry.withScope(scope => {
    // Add any additional context
    Object.keys(context).forEach(key => {
      scope.setContext(key, context[key]);
    });

    Sentry.captureException(error);
  });
}

/**
 * Create a transaction for performance monitoring
 */
function startTransaction(name, op = 'http.server') {
  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Monitor async operations
 */
async function monitorAsync(name, operation) {
  const transaction = startTransaction(name, 'function');

  try {
    const result = await operation();
    transaction.setStatus('ok');
    return result;
  } catch (error) {
    transaction.setStatus('internal_error');
    throw error;
  } finally {
    transaction.finish();
  }
}

/**
 * Add breadcrumb for better debugging
 */
function addBreadcrumb(message, category = 'custom', level = 'info', data = {}) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

module.exports = {
  Sentry,
  initSentry,
  sentryErrorHandler,
  setUserContext,
  addContext,
  captureMessage,
  captureException,
  startTransaction,
  monitorAsync,
  addBreadcrumb,
};