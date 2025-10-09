/**
 * Sentry error tracking configuration
 * @module utils/sentry
 */

import * as Sentry from '@sentry/react';
import { captureConsoleIntegration, replayIntegration } from '@sentry/react';

// Environment configuration
const environment = import.meta.env.MODE || 'development';
const release = import.meta.env.VITE_APP_VERSION || 'unknown';
const dsn = import.meta.env.VITE_SENTRY_DSN;

/**
 * Initialize Sentry error tracking
 */
export const initSentry = () => {
  if (!dsn) {
    console.warn('Sentry DSN not configured');
    return;
  }

  Sentry.init({
    dsn,
    environment,
    release,

    // Performance monitoring
    integrations: [
      Sentry.browserTracingIntegration(),

      // Capture console errors
      captureConsoleIntegration({
        levels: ['error', 'warn']
      }),

      // Session replay
      replayIntegration({
        maskAllText: false,
        blockAllMedia: false
      })
    ],

    // Performance sampling
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,

    // Replay sampling
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    // Breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null;
      }
      
      // Don't log sensitive data
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        if (breadcrumb.data?.url?.includes('/api/auth')) {
          breadcrumb.data = {
            ...breadcrumb.data,
            // Redact auth endpoints
            url: '[REDACTED AUTH URL]'
          };
        }
      }
      
      return breadcrumb;
    },
    
    // Error filtering
    beforeSend(event, hint) {
      // Filter out known non-errors
      const error = hint.originalException;

      // Type guard for Error objects
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';

      // Ignore network errors in development
      if (environment === 'development' && errorMessage.includes('NetworkError')) {
        return null;
      }

      // Ignore ResizeObserver errors
      if (errorMessage.includes('ResizeObserver loop limit exceeded')) {
        return null;
      }

      // Ignore browser extension errors
      if (errorStack.includes('extension://')) {
        return null;
      }
      
      // Add user context
      const user = getUserContext();
      if (user) {
        event.user = {
          id: user.id,
          username: user.username,
          email: user.email
        };
      }
      
      // Add custom context
      event.contexts = {
        ...event.contexts,
        app: {
          version: release,
          environment,
          build_time: import.meta.env.VITE_BUILD_TIME
        }
      };
      
      return event;
    },
    
    // Ignore certain errors
    ignoreErrors: [
      // Browser errors
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      
      // Network errors
      'NetworkError',
      'Failed to fetch',
      'Load failed',
      
      // Safari errors
      'Safari CSP violation',
      
      // Chrome extensions
      'Extension context invalidated',
      'chrome-extension',
      'moz-extension'
    ],
    
    // Allowed URLs (ignore errors from third-party scripts)
    allowUrls: [
      /https?:\/\/(www\.)?yourapp\.com/,
      /https?:\/\/localhost/
    ],
    
    // Denied URLs
    denyUrls: [
      // Chrome extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
      
      // Other common extension patterns
      /127\.0\.0\.1:4001\/isrunning/i, // Kaspersky
      /webappstoolbarba\.texthelp\.com\//i,
      /metrics\.itunes\.apple\.com\.edgesuite\.net\//i
    ]
  });
};

/**
 * Get current user context for error reporting
 */
const getUserContext = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
};

/**
 * Capture exception with context
 */
export const captureException = (
  error: Error,
  context?: Record<string, any>,
  level: Sentry.SeverityLevel = 'error'
) => {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('additional', context);
    }
    scope.setLevel(level);
    Sentry.captureException(error);
  });
};

/**
 * Capture message with context
 */
export const captureMessage = (
  message: string,
  context?: Record<string, any>,
  level: Sentry.SeverityLevel = 'info'
) => {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('additional', context);
    }
    scope.setLevel(level);
    Sentry.captureMessage(message, level);
  });
};

/**
 * Add breadcrumb
 */
export const addBreadcrumb = (breadcrumb: Sentry.Breadcrumb) => {
  Sentry.addBreadcrumb(breadcrumb);
};

/**
 * Set user context
 */
export const setUser = (user: { id: string; username?: string; email?: string } | null) => {
  Sentry.setUser(user);
};

/**
 * Set custom context
 */
export const setContext = (key: string, context: Record<string, any>) => {
  Sentry.setContext(key, context);
};

/**
 * Start transaction for performance monitoring
 */
export const startTransaction = (name: string, op: string) => {
  return Sentry.startSpan({ name, op }, (span) => span);
};

/**
 * Profile a function execution
 */
export const profileFunction = async <T>(
  name: string,
  fn: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> => {
  return Sentry.startSpan(
    {
      name,
      op: 'function',
      attributes: tags
    },
    async () => {
      try {
        return await fn();
      } catch (error) {
        throw error;
      }
    }
  );
};

/**
 * Error boundary component
 */
export const ErrorBoundary = Sentry.ErrorBoundary;

/**
 * Profiler component
 */
export const Profiler = Sentry.Profiler;

/**
 * withSentryRouting HOC
 */
export const withSentryRouting = Sentry.withSentryRouting;

export default {
  initSentry,
  captureException,
  captureMessage,
  addBreadcrumb,
  setUser,
  setContext,
  startTransaction,
  profileFunction,
  ErrorBoundary,
  Profiler,
  withSentryRouting
};