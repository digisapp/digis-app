/**
 * React Query hook for fetching creator overview data
 *
 * Provides aggregated creator metrics in a single API call:
 * - Token balances and earnings
 * - Payouts, tips, and payments
 * - Sessions and streaming stats
 * - Content, followers, subscribers
 * - Analytics data
 *
 * Features:
 * - Automatic caching (60 seconds server-side + React Query cache)
 * - Auto-refresh on window focus
 * - Optional time-range filtering
 * - Cache invalidation helpers
 * - Loading and error states
 *
 * @example
 * // Basic usage
 * const { data, isLoading, error } = useCreatorOverview();
 *
 * @example
 * // With time range filter (last 30 days)
 * const from = new Date(Date.now() - 30*24*60*60*1000).toISOString();
 * const to = new Date().toISOString();
 * const { data } = useCreatorOverview({ from, to });
 *
 * @example
 * // With cache bypass
 * const { data, refetch } = useCreatorOverview({ noCache: true });
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../utils/apiClient';

/**
 * Fetch creator overview data from API
 * @param {Object} params - Query parameters
 * @param {string} params.from - Start date (ISO 8601)
 * @param {string} params.to - End date (ISO 8601)
 * @param {boolean} params.noCache - Bypass server cache
 * @returns {Promise<Object>} Creator overview data
 */
const fetchCreatorOverview = async (params = {}) => {
  const queryParams = new URLSearchParams();

  if (params.from) queryParams.set('from', params.from);
  if (params.to) queryParams.set('to', params.to);
  if (params.noCache) queryParams.set('noCache', 'true');

  const url = `/api/v1/creators/overview${queryParams.toString() ? `?${queryParams}` : ''}`;

  const response = await apiClient.get(url);
  return response.data;
};

/**
 * Hook for fetching and caching creator overview data
 * @param {Object} params - Query parameters
 * @param {string} params.from - Start date (ISO 8601)
 * @param {string} params.to - End date (ISO 8601)
 * @param {boolean} params.noCache - Bypass server cache
 * @param {Object} options - React Query options
 * @returns {Object} Query result with data, loading, error states
 */
export function useCreatorOverview(params = {}, options = {}) {
  const queryClient = useQueryClient();

  // Build unique query key based on params
  const queryKey = ['creator-overview', params];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchCreatorOverview(params),
    staleTime: 60 * 1000, // Consider data fresh for 60 seconds (matches server cache)
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: true, // Refresh when user returns to tab
    refetchOnReconnect: true, // Refresh when network reconnects
    retry: 1, // Retry once on failure
    ...options,
  });

  /**
   * Invalidate cache and force refresh
   */
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['creator-overview'] });
  };

  /**
   * Prefetch with different params (e.g., for tab switching)
   */
  const prefetch = (prefetchParams = {}) => {
    queryClient.prefetchQuery({
      queryKey: ['creator-overview', prefetchParams],
      queryFn: () => fetchCreatorOverview(prefetchParams),
      staleTime: 60 * 1000,
    });
  };

  return {
    // Data and states
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,

    // Derived states for common error types
    unauthorized: query.error?.status === 401 || query.error?.response?.status === 401,
    notFound: query.error?.status === 404 || query.error?.response?.status === 404,

    // Actions
    refetch: query.refetch,
    invalidate,
    prefetch,

    // Raw query object for advanced usage
    query,
  };
}

/**
 * Hook for fetching overview with last N days filter
 * @param {number} days - Number of days to look back
 * @param {Object} options - React Query options
 * @returns {Object} Query result
 */
export function useCreatorOverviewLastDays(days = 30, options = {}) {
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const to = new Date().toISOString();

  return useCreatorOverview({ from, to }, options);
}

/**
 * Hook to invalidate all creator overview queries
 * Useful after creating new content, receiving tips, etc.
 */
export function useInvalidateCreatorOverview() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['creator-overview'] });
  };
}

/**
 * Format helpers for displaying overview data
 */
export const formatters = {
  /**
   * Format number with thousand separators
   */
  number: (n) => Number(n || 0).toLocaleString(),

  /**
   * Format cents to USD string
   */
  usd: (cents) => {
    const dollars = Number(cents || 0) / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(dollars);
  },

  /**
   * Format cents to compact USD (1.2k, 3.4M)
   */
  usdCompact: (cents) => {
    const dollars = Number(cents || 0) / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(dollars);
  },

  /**
   * Format seconds to readable duration
   */
  duration: (seconds) => {
    const s = Number(seconds || 0);
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  },

  /**
   * Format percentage
   */
  percent: (value, total) => {
    if (!total || total === 0) return '0%';
    const pct = (Number(value || 0) / Number(total)) * 100;
    return `${pct.toFixed(1)}%`;
  },
};

export default useCreatorOverview;
