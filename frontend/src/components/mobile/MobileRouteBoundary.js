import React, { Component, Suspense } from 'react';
import PropTypes from 'prop-types';
import { XCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import MobileSkeleton from './MobileSkeletons';

/**
 * MobileRouteBoundary - Error boundary wrapper for mobile routes
 * Prevents one crashed component from blanking the entire app
 *
 * Usage:
 * <MobileRouteBoundary routeName="Explore">
 *   <Suspense fallback={<MobileSkeleton />}>
 *     <MobileExplore />
 *   </Suspense>
 * </MobileRouteBoundary>
 */
class MobileErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const { routeName, onError } = this.props;

    // Log error with context
    console.error(`🚨 Mobile Route Error [${routeName}]:`, {
      error,
      errorInfo,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });

    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // Call optional error handler (for Sentry, logging, etc.)
    if (onError) {
      onError(error, errorInfo, routeName);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    const { hasError, error, errorCount } = this.state;
    const { children, routeName } = this.props;

    if (hasError) {
      // If error keeps happening (>3 times), show minimal fallback
      const isCrashLoop = errorCount > 3;

      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircleIcon className="w-10 h-10 text-red-600" />
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {isCrashLoop ? 'Persistent Error' : 'Something went wrong'}
            </h2>

            <p className="text-gray-600 mb-6">
              {isCrashLoop
                ? `The ${routeName} route keeps crashing. Please refresh the page or contact support.`
                : `An error occurred in ${routeName}. This has been logged.`
              }
            </p>

            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && error && (
              <div className="mb-6 p-4 bg-gray-100 rounded-lg text-left">
                <p className="text-xs font-mono text-red-600 mb-2 break-all">
                  {error.toString()}
                </p>
                {error.stack && (
                  <pre className="text-xs text-gray-600 overflow-auto max-h-32">
                    {error.stack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {!isCrashLoop && (
                <button
                  onClick={this.handleReset}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold active:scale-95 transition-transform"
                >
                  <ArrowPathIcon className="w-5 h-5" />
                  Try Again
                </button>
              )}

              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold active:scale-95 transition-transform"
              >
                Reload App
              </button>

              <button
                onClick={() => window.history.back()}
                className="w-full text-gray-500 py-2 text-sm"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

MobileErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  routeName: PropTypes.string.isRequired,
  onError: PropTypes.func
};

/**
 * Combined boundary: Error boundary + Suspense
 */
const MobileRouteBoundary = ({ children, routeName, fallback, onError }) => {
  return (
    <MobileErrorBoundary routeName={routeName} onError={onError}>
      <Suspense fallback={fallback || <MobileSkeleton count={5} type="list" />}>
        {children}
      </Suspense>
    </MobileErrorBoundary>
  );
};

MobileRouteBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  routeName: PropTypes.string.isRequired,
  fallback: PropTypes.node,
  onError: PropTypes.func
};

export default MobileRouteBoundary;
export { MobileErrorBoundary };
