import React, { Component } from 'react';
import { motion } from 'framer-motion';
import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
  HomeIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';

class ImprovedErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to error reporting service
    console.error('Error caught by boundary:', error, errorInfo);
    
    // You can log to an error reporting service here
    // logErrorToService(error, errorInfo);
    
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    });
    
    // Call onReset callback if provided
    this.props.onReset?.();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }));
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails, errorCount } = this.state;
      
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <motion.div
            className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-orange-500 p-8 text-white">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-full">
                  <ExclamationTriangleIcon className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold mb-1">Oops! Something went wrong</h1>
                  <p className="text-red-100">We encountered an unexpected error</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-8">
              <div className="space-y-6">
                {/* Error message */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h2 className="font-semibold text-red-900 mb-1">Error Details</h2>
                  <p className="text-red-700 font-mono text-sm">
                    {error?.toString() || 'An unexpected error occurred'}
                  </p>
                  {errorCount > 1 && (
                    <p className="text-red-600 text-sm mt-2">
                      This error has occurred {errorCount} times
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <motion.button
                    onClick={this.handleReset}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ArrowPathIcon className="w-5 h-5" />
                    Try Again
                  </motion.button>
                  
                  <motion.button
                    onClick={this.handleGoHome}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-all"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <HomeIcon className="w-5 h-5" />
                    Go to Home
                  </motion.button>
                </div>

                {/* Technical details toggle */}
                <button
                  onClick={this.toggleDetails}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {showDetails ? (
                    <ChevronUpIcon className="w-4 h-4" />
                  ) : (
                    <ChevronDownIcon className="w-4 h-4" />
                  )}
                  {showDetails ? 'Hide' : 'Show'} technical details
                </button>

                {/* Stack trace */}
                {showDetails && errorInfo && (
                  <motion.div
                    className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <h3 className="font-semibold mb-2 text-yellow-400">Stack Trace:</h3>
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {errorInfo.componentStack}
                    </pre>
                  </motion.div>
                )}

                {/* Help text */}
                <div className="text-sm text-gray-600 space-y-2">
                  <p>Here are some things you can try:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-500">
                    <li>Refresh the page</li>
                    <li>Clear your browser cache</li>
                    <li>Check your internet connection</li>
                    <li>Try again in a few minutes</li>
                  </ul>
                </div>

                {/* Contact support */}
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    If the problem persists, please{' '}
                    <a
                      href="/support"
                      className="text-purple-600 hover:text-purple-700 font-medium"
                    >
                      contact support
                    </a>
                    {' '}with the error details above.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Error fallback component for React Suspense
export const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
      <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-gray-600 mb-6">{error?.message || 'An unexpected error occurred'}</p>
      <button
        onClick={resetErrorBoundary}
        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
      >
        Try again
      </button>
    </div>
  </div>
);

// HOC to wrap components with error boundary
export const withErrorBoundary = (Component, fallbackComponent) => {
  return (props) => (
    <ImprovedErrorBoundary fallback={fallbackComponent}>
      <Component {...props} />
    </ImprovedErrorBoundary>
  );
};

export default ImprovedErrorBoundary;