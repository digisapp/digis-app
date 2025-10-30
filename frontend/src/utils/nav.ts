/**
 * Centralized navigation utilities for auth flows
 * Single source of truth for auth URL construction
 */

import { createSearchParams } from 'react-router-dom';

export type AuthMode = 'signin' | 'signup' | 'verify-email' | 'reset';

/**
 * Build proper auth URL with pathname + search params
 * Prevents the common bug: navigate({ search: '?mode=signin' }) → /?mode=signin
 *
 * @param mode - Auth mode to navigate to
 * @returns Object with pathname and search for React Router navigate()
 */
export function buildAuthUrl(mode: AuthMode) {
  const search = createSearchParams({ mode }).toString();
  return {
    pathname: '/auth',
    search: `?${search}`
  };
}
