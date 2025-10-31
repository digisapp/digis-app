/**
 * Centralized navigation utilities for auth flows
 * Single source of truth for auth URL construction
 */

import { createSearchParams } from 'react-router-dom';

/**
 * @typedef {'signin' | 'signup' | 'verify-email' | 'reset'} AuthMode
 */

/**
 * Build proper auth URL with pathname + search params
 * Prevents the common bug: navigate({ search: '?mode=signin' }) → /?mode=signin
 *
 * @param {AuthMode} mode - Auth mode to navigate to
 * @returns {{pathname: string, search: string}} Object with pathname and search for React Router navigate()
 */
export function buildAuthUrl(mode) {
  const search = createSearchParams({ mode }).toString();
  return {
    pathname: '/auth',
    search: `?${search}`
  };
}
