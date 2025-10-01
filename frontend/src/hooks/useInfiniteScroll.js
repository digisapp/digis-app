// High-performance infinite scroll hook using IntersectionObserver
// Replaces scroll event listeners for better performance

import { useEffect, useCallback, useRef } from 'react';
import { devLog } from '../utils/devLog';

/**
 * Hook for implementing infinite scroll with IntersectionObserver
 * @param {Function} onLoadMore - Callback to load more items
 * @param {Object} options - Configuration options
 * @param {boolean} options.hasMore - Whether there are more items to load
 * @param {boolean} options.loading - Whether currently loading
 * @param {string} options.rootMargin - IntersectionObserver root margin (default: '400px')
 * @param {number} options.threshold - IntersectionObserver threshold (default: 0.1)
 * @param {boolean} options.enabled - Whether infinite scroll is enabled (default: true)
 * @returns {Object} - { sentinelRef, reset }
 */
export function useInfiniteScroll(onLoadMore, options = {}) {
  const {
    hasMore = true,
    loading = false,
    rootMargin = '400px',
    threshold = 0.1,
    enabled = true
  } = options;

  const sentinelRef = useRef(null);
  const observerRef = useRef(null);
  const loadingRef = useRef(loading);
  const hasMoreRef = useRef(hasMore);

  // Update refs to avoid stale closures
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  // Memoized load handler
  const handleIntersection = useCallback((entries) => {
    const [entry] = entries;

    if (entry?.isIntersecting && hasMoreRef.current && !loadingRef.current) {
      devLog('Infinite scroll triggered');
      onLoadMore();
    }
  }, [onLoadMore]);

  // Set up observer
  useEffect(() => {
    if (!enabled) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    // Disconnect previous observer if exists
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin,
      threshold
    });

    // Start observing
    observerRef.current.observe(sentinel);
    devLog('Infinite scroll observer connected', { rootMargin, threshold });

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
        devLog('Infinite scroll observer disconnected');
      }
    };
  }, [enabled, handleIntersection, rootMargin, threshold]);

  // Reset function to restart observation
  const reset = useCallback(() => {
    if (observerRef.current && sentinelRef.current) {
      observerRef.current.unobserve(sentinelRef.current);
      observerRef.current.observe(sentinelRef.current);
      devLog('Infinite scroll reset');
    }
  }, []);

  return { sentinelRef, reset };
}

/**
 * Simplified version for basic use cases
 * @param {React.RefObject} ref - Ref to the sentinel element
 * @param {Function} onHit - Callback when sentinel is visible
 * @param {Object} options - IntersectionObserver options
 */
export function useInfiniteScrollSimple(ref, onHit, options = {}) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onHit();
        }
      },
      {
        rootMargin: options.rootMargin || '600px 0px',
        threshold: options.threshold || 0
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, onHit, options.rootMargin, options.threshold]);
}

// Export default for convenience
export default useInfiniteScroll;