/**
 * Route Preloader - Micro-perf win for route transitions
 *
 * Preloads lazy route chunks on hover/focus intent.
 * Reduces perceived loading time when user clicks navigation.
 *
 * Usage:
 *   import { preloadRoute } from '@/utils/routePreloader';
 *
 *   <NavLink
 *     to="/messages"
 *     onMouseEnter={() => preloadRoute(() => import('../components/pages/MessagesPage'))}
 *   />
 */

const preloadedRoutes = new Set();

export function preloadRoute(importer) {
  // Only preload each route once
  const key = importer.toString();

  if (!preloadedRoutes.has(key)) {
    try {
      importer?.();
      preloadedRoutes.add(key);
    } catch (error) {
      console.warn('Route preload failed:', error);
    }
  }
}

/**
 * Preload multiple routes at once
 */
export function preloadRoutes(importers) {
  importers.forEach(importer => preloadRoute(importer));
}

/**
 * Clear preload cache (useful for testing)
 */
export function clearPreloadCache() {
  preloadedRoutes.clear();
}
