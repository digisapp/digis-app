import React from 'react';
import { motion } from 'framer-motion';
import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
  HomeIcon
} from '@heroicons/react/24/outline';

// Conditionally import Sentry
let Sentry = null;
try {
  // Use dynamic import which is supported in browsers
  import('@sentry/react').then(module => {
    Sentry = module;
  });
} catch (e) {
  // Sentry not available, error tracking disabled
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // ALWAYS log errors to help debugging mobile issues
    console.error('❌ Error Boundary caught an error:', error);
    console.error('❌ Error Info:', errorInfo);
    console.error('❌ Component Stack:', errorInfo.componentStack);
    console.error('❌ Environment:', import.meta.env.MODE);
    console.error('❌ Current Path:', window.location.pathname);
    console.error('❌ Viewport:', `${window.innerWidth}x${window.innerHeight}`);
    console.error('❌ User Agent:', navigator.userAgent);

    // Report to Sentry with additional context (if available)
    if (Sentry) {
      Sentry.withScope((scope) => {
        // Add error boundary context
        scope.setTag('error_boundary', true);
        scope.setLevel('error');
        scope.setContext('errorInfo', {
          componentStack: errorInfo.componentStack,
          retryCount: this.state.retryCount
        });
        
        // Add user context if available
        if (this.props.user) {
          scope.setUser({
            id: this.props.user.id,
            username: this.props.user.username,
            email: this.props.user.email
          });
        }
        
        // Add custom fingerprint for better grouping
        scope.setFingerprint(['error-boundary', error.name, error.message]);
        
        // Send to Sentry
        Sentry.captureException(error, {
          contexts: {
            react: {
              componentStack: errorInfo.componentStack
            }
          }
        });
      });
    }
  }

  handleRetry = () => {
    // Add retry limit
    if (this.state.retryCount >= 3) {
      if (import.meta.env.MODE === 'development') {
        console.warn('Max retry attempts reached');
      }
      return;
    }
    
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleKeyDown = (e, callback) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      callback();
    }
  };

  render() {
    if (this.state.hasError) {
      // In production, show error message with option to see details
      if (import.meta.env.MODE === 'production') {
        return (
          <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <h1 className="text-4xl font-bold text-white mb-4">
                We'll be right back!
              </h1>
              <p className="text-xl text-white/90 mb-8">
                Something went wrong. Please try refreshing the page.
              </p>
              <div className="space-y-4">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-8 py-3 bg-white text-purple-600 font-bold rounded-full hover:bg-gray-100 transition-all"
                >
                  Refresh Page
                </button>
                <button
                  onClick={() => {
                    // Clear auth and redirect to home
                    localStorage.clear();
                    window.location.href = '/';
                  }}
                  className="w-full px-8 py-3 bg-white/20 text-white font-bold rounded-full hover:bg-white/30 transition-all"
                >
                  Clear Data & Restart
                </button>
              </div>
              <details className="mt-6 text-left">
                <summary className="text-white/70 text-sm cursor-pointer hover:text-white">
                  Show error details
                </summary>
                <div className="mt-2 p-4 bg-black/30 rounded-lg text-xs text-white font-mono text-left overflow-auto max-h-40">
                  <div className="text-red-300 font-semibold mb-2">
                    {this.state.error?.toString()}
                  </div>
                  <div className="whitespace-pre-wrap text-white/80">
                    {this.state.errorInfo?.componentStack}
                  </div>
                </div>
              </details>
            </div>
          </div>
        );
      }

      // Development mode - show more details
      let { variant = 'full', showRetry = true, showDetails = false } = this.props;
      
      // Validate variant prop
      if (variant && !['full', 'compact'].includes(variant)) {
        if (import.meta.env.MODE === 'development') {
          console.warn(`Invalid ErrorBoundary variant: ${variant}. Using 'full'.`);
        }
        variant = 'full';
      }
      
      // Generate unique error ID
      const errorId = `error-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
      
      // Compact error display for smaller components
      if (variant === 'compact') {
        return (
          <motion.div 
            className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            role="alert"
            aria-live="assertive"
            id={errorId}
          >
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Something went wrong
                </h4>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                  This section couldn't load properly.
                </p>
                {showRetry && this.state.retryCount < 3 && (
                  <button
                    onClick={this.handleRetry}
                    onKeyDown={(e) => this.handleKeyDown(e, this.handleRetry)}
                    className="mt-2 text-sm text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium flex items-center gap-1"
                    aria-label="Retry loading the component"
                  >
                    <ArrowPathIcon className="w-4 h-4" aria-hidden="true" />
                    Try again {this.state.retryCount > 0 && `(${this.state.retryCount + 1}/3)`}
                  </button>
                )}
                {this.state.retryCount >= 3 && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    Maximum retry attempts reached
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        );
      }

      // Full error page
      return (
        <motion.div 
          className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-red-900/20 flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          role="alert"
          aria-live="assertive"
          id={errorId}
        >
          <div className="max-w-md w-full text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="mx-auto w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6"
            >
              <ExclamationTriangleIcon className="w-10 h-10 text-red-500" aria-hidden="true" />
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Oops! Something went wrong
              </h1>
              
              <p className="text-gray-600 dark:text-gray-300 mb-8">
                We encountered an unexpected error. Don't worry, our team has been notified and is working to fix this.
              </p>

              <div className="space-y-4">
                {showRetry && this.state.retryCount < 3 && (
                  <motion.button
                    onClick={this.handleRetry}
                    onKeyDown={(e) => this.handleKeyDown(e, this.handleRetry)}
                    className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 px-6 rounded-xl font-medium hover:from-red-600 hover:to-pink-600 transition-all flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    aria-label={`Retry loading the page, attempt ${this.state.retryCount + 1} of 3`}
                  >
                    <ArrowPathIcon className="w-5 h-5" aria-hidden="true" />
                    Try Again {this.state.retryCount > 0 && `(${this.state.retryCount + 1}/3)`}
                  </motion.button>
                )}
                
                {this.state.retryCount >= 3 && (
                  <p className="text-red-600 dark:text-red-400 font-medium">
                    Maximum retry attempts reached
                  </p>
                )}

                <motion.button
                  onClick={this.handleGoHome}
                  onKeyDown={(e) => this.handleKeyDown(e, this.handleGoHome)}
                  className="w-full bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-3 px-6 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all border border-gray-300 dark:border-gray-600 flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  aria-label="Return to homepage"
                >
                  <HomeIcon className="w-5 h-5" aria-hidden="true" />
                  Go Home
                </motion.button>
              </div>

              {showDetails && import.meta.env.MODE === 'development' && this.state.error && (
                <motion.details 
                  className="mt-8 text-left"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                    View technical details
                  </summary>
                  <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-mono text-gray-700 dark:text-gray-300 overflow-auto max-h-40">
                    <div className="text-red-600 dark:text-red-400 font-semibold mb-2">
                      {this.state.error.toString()}
                    </div>
                    <div className="whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </div>
                  </div>
                </motion.details>
              )}

              <p className="text-xs text-gray-400 dark:text-gray-500 mt-6">
                Error ID: {errorId}
              </p>
            </motion.div>
          </div>
        </motion.div>
      );
    }

    return this.props.children;
  }
}

// HOC for wrapping components with error boundary
export const withErrorBoundary = (Component, options = {}) => {
  const WrappedComponent = (props) => (
    <ErrorBoundary {...options}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

// Hook for error reporting in functional components
export const useErrorHandler = () => {
  return (error, errorInfo) => {
    // Only log in development
    if (import.meta.env.MODE === 'development') {
      console.error('Error caught by useErrorHandler:', error);
    }
    
    // Report to Sentry if available
    if (Sentry) {
      Sentry.withScope((scope) => {
        scope.setTag('error_source', 'useErrorHandler');
        scope.setLevel('error');
        
        if (errorInfo) {
          scope.setContext('errorInfo', errorInfo);
        }
        
        Sentry.captureException(error);
      });
    }
  };
};

export default ErrorBoundary;