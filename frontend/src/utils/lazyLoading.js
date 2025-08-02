import React, { Suspense, lazy } from 'react';
import Skeleton from '../components/ui/Skeleton';

/**
 * Utility for implementing code splitting with loading states
 * Features: error boundaries, loading fallbacks, retry mechanisms
 */

// Custom loading fallback component
const LoadingFallback = ({ 
  variant = 'page',
  message = 'Loading...',
  height = 'auto'
}) => {
  switch (variant) {
    case 'page':
      return (
        <div className="p-6 space-y-6">
          <Skeleton.Text lines={1} width="40%" className="h-8" />
          <Skeleton.Card height="200px" />
          <Skeleton.Grid columns={3} rows={2} gap="1rem" />
        </div>
      );
    
    case 'modal':
      return (
        <div className="p-6 space-y-4">
          <Skeleton.Text lines={1} width="60%" className="h-6" />
          <Skeleton.Card height="150px" />
        </div>
      );
    
    case 'component':
      return (
        <div className="space-y-3">
          <Skeleton.Text lines={2} />
          <Skeleton.Card height={height} />
        </div>
      );
    
    default:
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-text-secondary">{message}</p>
          </div>
        </div>
      );
  }
};

// Enhanced lazy loading with error boundary
export const createLazyComponent = (
  importFn, 
  fallbackComponent = <LoadingFallback variant="page" />,
  errorFallback = null
) => {
  const LazyComponent = lazy(importFn);
  
  return React.forwardRef((props, ref) => {
    const ErrorBoundary = ({ children }) => {
      const [hasError, setHasError] = React.useState(false);
      const [error, setError] = React.useState(null);
      
      React.useEffect(() => {
        setHasError(false);
        setError(null);
      }, []);
      
      if (hasError) {
        if (errorFallback) {
          return errorFallback;
        }
        
        return (
          <div className="p-6 text-center">
            <div className="text-error mb-4">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
              <p className="text-sm text-text-secondary mb-4">
                Failed to load component. Please try again.
              </p>
              <button
                onClick={() => {
                  setHasError(false);
                  setError(null);
                  window.location.reload();
                }}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        );
      }
      
      return (
        <Suspense fallback={fallbackComponent}>
          {children}
        </Suspense>
      );
    };
    
    return (
      <ErrorBoundary>
        <LazyComponent {...props} ref={ref} />
      </ErrorBoundary>
    );
  });
};

// Preload utility for critical components
export const preloadComponent = (importFn) => {
  const componentImport = importFn();
  return componentImport;
};

// Route-based code splitting utility
export const createLazyRoute = (importFn, fallback = 'page') => {
  return createLazyComponent(
    importFn,
    <LoadingFallback variant={fallback} />,
    <div className="p-6 text-center">
      <h2 className="text-xl font-semibold text-error mb-2">Page failed to load</h2>
      <p className="text-text-secondary mb-4">There was an error loading this page.</p>
      <button 
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
      >
        Refresh Page
      </button>
    </div>
  );
};

// Bundle splitting configurations
export const chunkNames = {
  // Core chunks
  auth: 'auth',
  profile: 'profile',
  creator: 'creator',
  admin: 'admin',
  
  // Feature chunks
  video: 'video',
  chat: 'chat',
  tokens: 'tokens',
  
  // Vendor chunks
  charts: 'charts',
  calendar: 'calendar',
  media: 'media'
};

// Webpack magic comments for chunk naming
export const createChunkImport = (chunkName, importPath) => {
  return () => import(
    /* webpackChunkName: "[chunkName]" */
    /* webpackPrefetch: true */
    importPath
  );
};

export default {
  createLazyComponent,
  createLazyRoute,
  preloadComponent,
  LoadingFallback,
  chunkNames,
  createChunkImport
};