/**
 * Route Monitoring Hook
 *
 * Tracks route change performance and errors for observability.
 * Integrates with existing logger infrastructure.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { analytics } from '../lib/analytics';

/**
 * Monitor route changes and log performance metrics
 */
export function useRouteMonitoring() {
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  const navigationStart = useRef(Date.now());

  useEffect(() => {
    const currentPath = location.pathname;
    const duration = Date.now() - navigationStart.current;

    // Log route change
    if (currentPath !== previousPath.current) {
      const metrics = {
        path: currentPath,
        previousPath: previousPath.current,
        duration,
        timestamp: Date.now(),
      };

      // Development logging
      if (process.env.NODE_ENV === 'development') {
        console.log(`🗺️ Route: ${previousPath.current} → ${currentPath} (${duration}ms)`);
      }

      // Track page view and navigation
      analytics.page(currentPath, {
        from: previousPath.current,
        to: currentPath,
        duration_ms: duration,
      });

      analytics.navigate(previousPath.current, currentPath, duration);

      // Update refs for next navigation
      previousPath.current = currentPath;
      navigationStart.current = Date.now();
    }
  }, [location.pathname]);
}

/**
 * Monitor error boundaries at route level
 */
export function useRouteErrorMonitoring() {
  const location = useLocation();

  useEffect(() => {
    const handleError = (event) => {
      console.error('Route-level error:', {
        path: location.pathname,
        error: event.error,
        message: event.message,
      });

      // Send to error tracking service
      if (typeof window !== 'undefined' && window.Sentry) {
        window.Sentry.captureException(event.error, {
          tags: {
            route: location.pathname,
            errorType: 'route_error',
          },
        });
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [location.pathname]);
}

/**
 * Combined hook for route monitoring and error tracking
 */
export default function useRouteObservability() {
  useRouteMonitoring();
  useRouteErrorMonitoring();
}
