import { useState, useEffect } from 'react';

/**
 * Hook for responsive design with media queries
 * Features: SSR safe, performance optimized, cleanup
 */
export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event) => {
      setMatches(event.matches);
    };

    // Use the newer addEventListener if available, fallback to addListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else {
      mediaQuery.addListener(handler);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler);
      } else {
        mediaQuery.removeListener(handler);
      }
    };
  }, [query]);

  // Prevent hydration mismatch by not rendering on server
  if (!mounted) {
    return false;
  }

  return matches;
};

// Predefined breakpoint hooks for common use cases
export const useIsMobile = () => {
  const mediaQuery = useMediaQuery('(max-width: 768px)');
  const touchQuery = useMediaQuery('(pointer: coarse)');
  
  // Also check for mobile user agent as fallback
  const isMobileUA = typeof window !== 'undefined' && 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Return true if any condition matches
  return mediaQuery || (touchQuery && isMobileUA);
};

export const useIsTablet = () => useMediaQuery('(min-width: 769px) and (max-width: 1024px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1025px)');
export const useIsLargeScreen = () => useMediaQuery('(min-width: 1280px)');

// Orientation hooks
export const useIsLandscape = () => useMediaQuery('(orientation: landscape)');
export const useIsPortrait = () => useMediaQuery('(orientation: portrait)');

// Accessibility hooks
export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
export const usePrefersDarkMode = () => useMediaQuery('(prefers-color-scheme: dark)');
export const usePrefersHighContrast = () => useMediaQuery('(prefers-contrast: high)');

export default useMediaQuery;