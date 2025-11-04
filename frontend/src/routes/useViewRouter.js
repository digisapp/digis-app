import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useHybridStore, { useCurrentView } from '../stores/useHybridStore';
import { VIEW_TO_PATH, pathToViewSafe } from './routeConfig';
import { useAuth } from '../contexts/AuthContext';

/**
 * useViewRouter - Adapter Hook for Gradual Migration
 *
 * Keeps legacy currentView state in sync with URL-based routing.
 * This allows old setCurrentView('dashboard') calls to work while
 * progressively migrating to real URL routes.
 *
 * How it works:
 * 1. When store view changes → push URL (only after auth is resolved)
 * 2. When URL changes → update store view
 * 3. Prevents loops with lastViewRef and redirectedOnceRef tracking
 * 4. Preserves query params and hash during navigation
 * 5. Handles background tab wakes for proper sync
 */
export default function useViewRouter() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roleResolved } = useAuth();

  const currentView = useCurrentView();
  const setCurrentView = (view) => useHybridStore.getState().setCurrentView(view);

  const lastViewRef = useRef(currentView);
  const redirectedOnceRef = useRef(false);

  // 1) When store view changes, push URL (only if not already at that path)
  useEffect(() => {
    if (!currentView) return;

    // Don't navigate until role resolution is done to avoid battling "/" logic
    if (!roleResolved) return;

    // Skip adapter redirects while the page is backgrounded (iOS Safari fix)
    if (document.visibilityState === 'hidden') return;

    const expectedPath = VIEW_TO_PATH[currentView];

    // Guard against unknown views
    if (!expectedPath) {
      console.warn('[useViewRouter] Unknown view:', currentView);
      lastViewRef.current = currentView;
      return;
    }

    const isAtRoot = location.pathname === '/';
    // Check for exact match or prefix match (for dynamic routes like /stream/:id)
    const isAtExpectedPath = location.pathname === expectedPath ||
      (location.pathname.startsWith(expectedPath + '/') && expectedPath !== '/');

    // DISABLED: Don't auto-redirect from root - let users see the homepage
    // Users can navigate to their dashboard/explore via navigation links
    // if (isAtRoot && roleResolved && expectedPath !== '/') {
    //   console.log('📍 Redirecting from root to:', currentView, '→', expectedPath);
    //   // Preserve query params and hash
    //   const url = new URL(window.location.href);
    //   navigate(`${expectedPath}${url.search}${url.hash}`, { replace: true });
    //   lastViewRef.current = currentView;
    //   redirectedOnceRef.current = true;
    //   return;
    // }

    // Already at the expected path - reset redirect flag
    if (isAtExpectedPath) {
      redirectedOnceRef.current = false;
      lastViewRef.current = currentView;
      return;
    }

    // Don't navigate if at root during login flow
    if (isAtRoot) {
      lastViewRef.current = currentView;
      return;
    }

    // Prevent double navigation thrash
    if (lastViewRef.current === currentView && redirectedOnceRef.current) return;

    console.log('📍 Store view changed to:', currentView, '→ navigating to:', expectedPath);
    redirectedOnceRef.current = true;

    // Preserve query params and hash when translating a view
    const url = new URL(window.location.href);
    navigate(`${expectedPath}${url.search}${url.hash}`, { replace: true });
    lastViewRef.current = currentView;
  }, [currentView, roleResolved, navigate, location.pathname]);

  // 2) When URL changes (user clicks links / back/forward), update store view
  useEffect(() => {
    const path = location.pathname;
    const view = pathToViewSafe(path); // Use safe lookup with prefix fallback

    if (view && view !== lastViewRef.current) {
      console.log('📍 URL changed to:', path, '→ updating store view to:', view);
      setCurrentView(view);
      lastViewRef.current = view;
    }
  }, [location.pathname]);

  // 3) Handle background tab wakes - sync URL on visibility change
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (!roleResolved || !currentView) return;

      const expectedPath = VIEW_TO_PATH[currentView];
      // Check for exact match or prefix match (for dynamic routes)
      const isAtExpectedPath = location.pathname === expectedPath ||
        (location.pathname.startsWith(expectedPath + '/') && expectedPath !== '/');

      if (expectedPath && !isAtExpectedPath) {
        console.log('📍 Tab woke up - syncing URL to:', currentView, '→', expectedPath);
        const url = new URL(window.location.href);
        navigate(`${expectedPath}${url.search}${url.hash}`, { replace: true });
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [currentView, roleResolved, navigate, location.pathname]);
}
