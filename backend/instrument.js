/**
 * Sentry Instrumentation
 * This file must be imported/required at the very top of your application
 * before any other modules to ensure proper error tracking
 */

const Sentry = require("@sentry/node");
// Note: ProfilingIntegration is automatically included when @sentry/profiling-node is installed

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://bb5fca25819a084b32da3e82c74708c9@o4510043742994432.ingest.us.sentry.io/4510043784937472",

  // Environment
  environment: process.env.NODE_ENV || "development",

  // Release tracking
  release: process.env.npm_package_version || "unknown",

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Profiling
  profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  integrations: [
    // Profiling will be automatically added if available
  ],

  // Capture user IP addresses for debugging (can be disabled for privacy)
  sendDefaultPii: true,

  // Only send errors in production
  enabled: process.env.NODE_ENV !== "test",

  // Session tracking
  autoSessionTracking: true,

  // Breadcrumbs
  maxBreadcrumbs: 100,

  // Before sending event to Sentry
  beforeSend(event, hint) {
    // Filter out sensitive data
    if (event.request) {
      // Remove authorization headers
      if (event.request.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
        delete event.request.headers["x-supabase-auth"];
      }

      // Remove sensitive body data
      if (event.request.data) {
        const sensitiveFields = ["password", "token", "secret", "apiKey", "credit_card", "ssn"];
        sensitiveFields.forEach(field => {
          if (event.request.data[field]) {
            event.request.data[field] = "[REDACTED]";
          }
        });
      }
    }

    // Filter out specific errors
    const error = hint.originalException;

    // Don't send 404 errors
    if (error?.status === 404) {
      return null;
    }

    // Don't send validation errors (they're expected)
    if (error?.name === "ValidationError") {
      return null;
    }

    // Filter out non-critical Redis errors
    if (error?.message?.includes("Redis") && error?.message?.includes("ECONNREFUSED")) {
      console.error("Redis connection error (not sent to Sentry):", error.message);
      return null;
    }

    return event;
  },

  // Ignore certain errors
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
    "Network request failed",
    "Failed to fetch",
    "NetworkError",
    "Load failed",
    "The operation was aborted",
    "cancelled",
  ],

  // Initial scope configuration
  initialScope: {
    tags: {
      component: "backend",
      service: "digis-api",
    },
    user: {
      segment: "backend-service",
    },
  },
});

console.log("✅ Sentry instrumentation loaded for", process.env.NODE_ENV);

module.exports = Sentry;