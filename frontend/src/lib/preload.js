/**
 * Route Preloading Utilities
 *
 * Prefetch lazy-loaded route chunks on hover/focus to improve
 * perceived performance.
 *
 * Usage:
 *   <Link to="/dashboard" onMouseEnter={() => preload(() => import('./Dashboard'))}>
 *     Dashboard
 *   </Link>
 */

import { useEffect } from 'react';

/**
 * Preload a lazy component module
 *
 * Safe to call multiple times - browser will cache the module.
 * Failures are silently ignored to avoid breaking navigation.
 */
export function preload(fn) {
  try {
    // Start the import but don't wait for it
    fn().catch(() => {
      // Ignore errors - user will see loading state if navigation happens
      // before preload completes
    });
  } catch {
    // Ignore synchronous errors
  }
}

/**
 * Preload multiple modules at once
 *
 * Usage:
 *   preloadAll([
 *     () => import('./Dashboard'),
 *     () => import('./Settings'),
 *   ]);
 */
export function preloadAll(fns) {
  fns.forEach(preload);
}

/**
 * Preload on idle (when browser is not busy)
 *
 * Usage:
 *   preloadOnIdle(() => import('./HeavyComponent'));
 */
export function preloadOnIdle(fn) {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => preload(fn));
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => preload(fn), 1);
  }
}

/**
 * Hook to preload routes on mount (for critical routes)
 *
 * Usage:
 *   usePreloadRoutes([
 *     () => import('./Dashboard'),
 *     () => import('./Explore'),
 *   ]);
 */
export function usePreloadRoutes(imports) {
  useEffect(() => {
    preloadOnIdle(() => Promise.all(imports.map(fn => fn())));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
