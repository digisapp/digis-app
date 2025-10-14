import * as Sentry from '@sentry/react';
import { ENV } from '../config/env';

/**
 * Initialize Sentry error tracking
 * Call this at the app's entry point (index.js or App.js)
 */
export const initSentry = () => {
  // Debug logging
  console.log('🔍 Sentry initialization check:', {
    mode: import.meta.env.MODE,
    sentryEnabled: import.meta.env.VITE_SENTRY_ENABLED,
    sentryDSN: import.meta.env.VITE_SENTRY_DSN ? 'DSN configured' : 'NO DSN'
  });

  // Only initialize in production or if explicitly enabled
  const shouldInitialize =
    import.meta.env.MODE === 'production' ||
    import.meta.env.VITE_SENTRY_ENABLED === 'true';

  if (!shouldInitialize) {
    console.log('❌ Sentry initialization skipped (not enabled)');
    return;
  }

  // Use the new digis-frontend project DSN
  const dsn = ENV.SENTRY?.DSN || import.meta.env.VITE_SENTRY_DSN || "https://39643d408b9ed97b88abb63fb81cfeb6@o4510043742994432.ingest.us.sentry.io/4510043876229120";

  if (!dsn) {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn,
    integrations: [
      // Browser tracing for performance monitoring
      Sentry.browserTracingIntegration(),
      // Replay sessions for debugging
      Sentry.replayIntegration({
        // Mask all text and inputs for privacy
        maskAllText: true,
        maskAllInputs: true,
        // Only sample 10% of sessions
        sessionSampleRate: 0.1,
        // Sample 100% of sessions with errors
        errorSampleRate: 1.0,
      }),
      // React-specific error boundary integration
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect: true,
        useLocation: true,
        useNavigationType: true,
      }),
    ],
    
    // Performance Monitoring
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    
    // Release tracking
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',
    
    // Environment
    environment: import.meta.env.MODE || 'development',
    
    // Session tracking
    autoSessionTracking: true,
    
    // Breadcrumbs configuration
    beforeBreadcrumb(breadcrumb) {
      // Filter out sensitive data from breadcrumbs
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        // Remove auth tokens from URLs
        if (breadcrumb.data?.url) {
          breadcrumb.data.url = breadcrumb.data.url.replace(/token=[^&]+/, 'token=REDACTED');
        }
        // Remove sensitive headers
        if (breadcrumb.data?.request?.headers?.Authorization) {
          breadcrumb.data.request.headers.Authorization = 'REDACTED';
        }
      }
      
      // Filter out noisy console logs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
        return null;
      }
      
      return breadcrumb;
    },
    
    // Error filtering
    beforeSend(event, hint) {
      // Filter out known non-errors
      const error = hint.originalException;
      
      // Ignore network errors that are expected
      if (error?.message?.includes('Network request failed') && navigator.onLine === false) {
        return null;
      }
      
      // Ignore ResizeObserver errors (common and usually harmless)
      if (error?.message?.includes('ResizeObserver loop limit exceeded')) {
        return null;
      }
      
      // Ignore errors from browser extensions
      if (error?.stack?.includes('chrome-extension://') || 
          error?.stack?.includes('moz-extension://')) {
        return null;
      }
      
      // Add user context if available
      const user = localStorage.getItem('digis-user-cache');
      if (user) {
        try {
          const userData = JSON.parse(user);
          event.user = {
            id: userData.user?.id,
            username: userData.user?.user_metadata?.username,
            email: userData.user?.email
          };
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Add custom context
      event.contexts = {
        ...event.contexts,
        app: {
          build_time: import.meta.env.VITE_BUILD_TIME || 'unknown',
          version: import.meta.env.VITE_APP_VERSION || '1.0.0',
        },
        device: {
          online: navigator.onLine,
          memory: navigator.deviceMemory,
          cores: navigator.hardwareConcurrency,
        }
      };
      
      return event;
    },
    
    // Ignore certain errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      // Facebook related
      'fb_xd_fragment',
      // Safari specific
      'Invalid Date',
      // Chrome extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
      // Other common non-errors
      'Network request failed',
      'NetworkError',
      'Failed to fetch',
      'Load failed',
      'The operation was aborted',
      'cancelled',
    ],
    
    // Don't send default PII
    sendDefaultPii: false,
  });

  console.log('✅ Sentry initialized successfully with DSN:', dsn);

  // Test that Sentry is working immediately
  console.log('🧪 Testing Sentry is active...');
  Sentry.captureMessage('Sentry initialization test', 'debug');
};

/**
 * Set user context for Sentry
 * Call this after user authentication
 */
export const setSentryUser = (user) => {
  if (!user) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: user.id || user.supabase_id,
    username: user.username,
    email: user.email,
    // Add custom attributes
    is_creator: user.is_creator,
    account_type: user.account_type,
  });
};

/**
 * Dedupe guard for logout breadcrumbs
 * Prevents double-logging if a user rage-clicks the logout button
 */
let logoutBreadcrumbLogged = false;

/**
 * Log logout breadcrumb (once per session)
 * Use this specifically for logout events to avoid duplicates
 */
export const logLogoutOnce = (data = {}) => {
  if (logoutBreadcrumbLogged) {
    console.log('🔄 Logout breadcrumb already logged, skipping duplicate');
    return;
  }

  logoutBreadcrumbLogged = true;
  Sentry.addBreadcrumb({
    message: 'logout',
    category: 'auth',
    level: 'info',
    data: {
      ...data,
      timestamp: new Date().toISOString()
    },
    timestamp: Date.now() / 1000,
  });
};

/**
 * Reset logout breadcrumb flag (called on login)
 */
export const resetLogoutBreadcrumb = () => {
  logoutBreadcrumbLogged = false;
};

/**
 * Add custom breadcrumb for tracking user actions
 */
export const addSentryBreadcrumb = (message, category = 'user', level = 'info', data = {}) => {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
};

/**
 * Capture a message (non-error) to Sentry
 */
export const captureMessage = (message, level = 'info', context = {}) => {
  Sentry.withScope((scope) => {
    Object.keys(context).forEach(key => {
      scope.setContext(key, context[key]);
    });
    Sentry.captureMessage(message, level);
  });
};

/**
 * Start a performance transaction
 */
export const startTransaction = (name, op = 'navigation') => {
  return Sentry.startTransaction({ name, op });
};

/**
 * Profiling for specific operations
 */
export const profileOperation = async (operationName, operation) => {
  const transaction = startTransaction(operationName, 'task');
  
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
};

/**
 * Create a Sentry-wrapped component
 */
export const withSentryProfiler = Sentry.withProfiler;

/**
 * Export Sentry instance for advanced usage
 */
export default Sentry;