/**
 * Route Monitoring Hook
 *
 * Tracks route change performance and errors for observability.
 * Integrates with existing logger infrastructure.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { analytics } from '../lib/analytics';
import { addBreadcrumb, setTag } from '../lib/sentry.client';
import { useAuth } from '../contexts/AuthContext';

/**
 * Monitor route changes and log performance metrics
 */
export function useRouteMonitoring() {
  const location = useLocation();
  const { role, roleHint, roleResolved } = useAuth();
  const previousPath = useRef(location.pathname);
  const navigationStart = useRef(Date.now());
  const firstNavigationLogged = useRef(false);

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

      // Production observability: Log first navigation with auth context
      if (!firstNavigationLogged.current && (role || roleHint)) {
        firstNavigationLogged.current = true;

        addBreadcrumb({
          category: 'navigation',
          level: 'info',
          message: 'First navigation after auth',
          data: {
            to: currentPath,
            from: previousPath.current,
            duration_ms: duration,
            role: role || roleHint || 'unknown',
            roleResolved,
            usedRoleHint: !role && !!roleHint
          }
        });

        // Set Sentry tags for issue grouping
        setTag('auth.role', role || roleHint || 'unknown');
        setTag('auth.roleResolved', String(roleResolved));
      }

      // Production observability: Log slow navigations (>2s)
      if (duration > 2000) {
        addBreadcrumb({
          category: 'navigation',
          level: 'warning',
          message: 'Slow navigation detected',
          data: {
            to: currentPath,
            from: previousPath.current,
            duration_ms: duration,
            role: role || roleHint || 'guest'
          }
        });
      }

      // Update refs for next navigation
      previousPath.current = currentPath;
      navigationStart.current = Date.now();
    }
  }, [location.pathname, role, roleHint, roleResolved]);
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
