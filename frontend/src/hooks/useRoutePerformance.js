import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Custom hook to track route performance metrics
 *
 * Tracks:
 * - Route navigation time
 * - Component mount time
 * - Time to interactive
 * - Route-specific metrics
 *
 * Usage:
 * ```javascript
 * function MyPage() {
 *   useRoutePerformance('dashboard');
 *   return <div>Dashboard</div>;
 * }
 * ```
 */
const useRoutePerformance = (routeName) => {
  const location = useLocation();
  const navigationStartRef = useRef(null);
  const mountStartRef = useRef(null);
  const hasLoggedRef = useRef(false);

  useEffect(() => {
    // Capture navigation start time
    navigationStartRef.current = performance.now();
    mountStartRef.current = performance.now();
    hasLoggedRef.current = false;

    return () => {
      // Reset on unmount
      hasLoggedRef.current = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    // Log performance metrics after component mounts
    if (!hasLoggedRef.current && mountStartRef.current) {
      const mountTime = performance.now() - mountStartRef.current;

      // Mark the route as interactive
      requestIdleCallback(() => {
        const interactiveTime = performance.now() - mountStartRef.current;

        logRoutePerformance({
          routeName,
          pathname: location.pathname,
          mountTime,
          interactiveTime,
          navigationStart: navigationStartRef.current,
        });

        hasLoggedRef.current = true;
      });
    }
  }, [routeName, location.pathname]);
};

/**
 * Log route performance metrics
 * In production, this would send to analytics service (e.g., Google Analytics, Datadog, etc.)
 */
function logRoutePerformance(metrics) {
  const {
    routeName,
    pathname,
    mountTime,
    interactiveTime,
    navigationStart,
  } = metrics;

  // Console logging for development
  if (process.env.NODE_ENV === 'development') {
    console.group(`📊 Route Performance: ${routeName}`);
    console.log(`Path: ${pathname}`);
    console.log(`Mount Time: ${mountTime.toFixed(2)}ms`);
    console.log(`Time to Interactive: ${interactiveTime.toFixed(2)}ms`);
    console.log(`Navigation Start: ${navigationStart.toFixed(2)}ms`);
    console.groupEnd();
  }

  // In production, send to analytics
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to Google Analytics
    if (window.gtag) {
      window.gtag('event', 'route_performance', {
        event_category: 'performance',
        event_label: routeName,
        value: Math.round(interactiveTime),
        mount_time: Math.round(mountTime),
        pathname,
      });
    }

    // Example: Send to custom analytics endpoint
    if (window.analytics?.track) {
      window.analytics.track('Route Performance', {
        routeName,
        pathname,
        mountTime: Math.round(mountTime),
        interactiveTime: Math.round(interactiveTime),
      });
    }

    // Store in performance buffer for later analysis
    storePerformanceMetric(metrics);
  }

  // Check for performance issues
  if (interactiveTime > 1000) {
    console.warn(`⚠️ Slow route detected: ${routeName} (${interactiveTime.toFixed(2)}ms)`);
  }
}

/**
 * Store performance metrics in sessionStorage for analysis
 */
function storePerformanceMetric(metrics) {
  try {
    const key = 'route_performance_metrics';
    const stored = sessionStorage.getItem(key);
    const performanceLog = stored ? JSON.parse(stored) : [];

    performanceLog.push({
      ...metrics,
      timestamp: Date.now(),
    });

    // Keep only last 50 metrics to avoid storage bloat
    const trimmed = performanceLog.slice(-50);

    sessionStorage.setItem(key, JSON.stringify(trimmed));
  } catch (error) {
    // Silently fail if storage is unavailable
    console.error('Failed to store performance metric:', error);
  }
}

/**
 * Retrieve stored performance metrics
 * Useful for debugging and analysis
 */
export function getPerformanceMetrics() {
  try {
    const key = 'route_performance_metrics';
    const stored = sessionStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to retrieve performance metrics:', error);
    return [];
  }
}

/**
 * Clear performance metrics
 */
export function clearPerformanceMetrics() {
  try {
    sessionStorage.removeItem('route_performance_metrics');
  } catch (error) {
    console.error('Failed to clear performance metrics:', error);
  }
}

/**
 * Get performance summary statistics
 */
export function getPerformanceSummary() {
  const metrics = getPerformanceMetrics();

  if (metrics.length === 0) {
    return null;
  }

  const summary = {};

  metrics.forEach((metric) => {
    const { routeName, mountTime, interactiveTime } = metric;

    if (!summary[routeName]) {
      summary[routeName] = {
        count: 0,
        totalMountTime: 0,
        totalInteractiveTime: 0,
        maxMountTime: 0,
        maxInteractiveTime: 0,
      };
    }

    const route = summary[routeName];
    route.count++;
    route.totalMountTime += mountTime;
    route.totalInteractiveTime += interactiveTime;
    route.maxMountTime = Math.max(route.maxMountTime, mountTime);
    route.maxInteractiveTime = Math.max(route.maxInteractiveTime, interactiveTime);
  });

  // Calculate averages
  Object.keys(summary).forEach((routeName) => {
    const route = summary[routeName];
    route.avgMountTime = route.totalMountTime / route.count;
    route.avgInteractiveTime = route.totalInteractiveTime / route.count;
  });

  return summary;
}

/**
 * Log performance summary to console
 */
export function logPerformanceSummary() {
  const summary = getPerformanceSummary();

  if (!summary) {
    console.log('No performance metrics available');
    return;
  }

  console.group('📊 Route Performance Summary');

  Object.entries(summary)
    .sort((a, b) => b[1].avgInteractiveTime - a[1].avgInteractiveTime)
    .forEach(([routeName, stats]) => {
      console.group(`${routeName} (${stats.count} navigations)`);
      console.log(`Avg Mount: ${stats.avgMountTime.toFixed(2)}ms`);
      console.log(`Avg Interactive: ${stats.avgInteractiveTime.toFixed(2)}ms`);
      console.log(`Max Mount: ${stats.maxMountTime.toFixed(2)}ms`);
      console.log(`Max Interactive: ${stats.maxInteractiveTime.toFixed(2)}ms`);
      console.groupEnd();
    });

  console.groupEnd();
}

// Expose to window for debugging
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.getPerformanceMetrics = getPerformanceMetrics;
  window.clearPerformanceMetrics = clearPerformanceMetrics;
  window.getPerformanceSummary = getPerformanceSummary;
  window.logPerformanceSummary = logPerformanceSummary;
}

export default useRoutePerformance;
