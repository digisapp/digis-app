/**
 * Legacy View Navigation Shim
 *
 * Provides backward compatibility for setCurrentView() calls by routing through
 * React Router instead of updating Zustand state.
 *
 * Usage:
 *   // Instead of: setCurrentView('dashboard')
 *   setView(navigate, 'dashboard')
 *
 * This function will be gradually removed as components migrate to:
 *   - <Link to="/dashboard"> for declarative navigation
 *   - navigate('/dashboard') for imperative navigation
 */

import { NavigateFunction } from 'react-router-dom';
import { VIEW_TO_PATH } from './routeConfig';

/**
 * Navigate to a view using the legacy view name.
 * Maps view names to routes and uses React Router for navigation.
 *
 * @param navigate - React Router navigate function from useNavigate()
 * @param view - Legacy view name (e.g., 'dashboard', 'explore')
 * @param options - Optional navigation options (replace, state, etc.)
 */
export function setView(
  navigate: NavigateFunction,
  view: string,
  options?: { replace?: boolean; state?: any }
): void {
  const path = VIEW_TO_PATH[view];

  if (!path) {
    console.warn(
      `⚠️ setView: Unknown view "${view}". Falling back to /explore.`,
      '\nKnown views:',
      Object.keys(VIEW_TO_PATH).join(', ')
    );
    navigate('/explore', options);
    return;
  }

  // Log navigation for debugging during migration
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔀 setView: "${view}" → "${path}"`);
  }

  navigate(path, options);
}

/**
 * Type-safe view names (for autocomplete and validation)
 */
export type ViewName = keyof typeof VIEW_TO_PATH;

/**
 * Check if a view name is valid
 */
export function isValidView(view: string): view is ViewName {
  return view in VIEW_TO_PATH;
}

/**
 * Get the path for a view name (without navigating)
 */
export function getPathForView(view: string): string {
  return VIEW_TO_PATH[view] ?? '/explore';
}
