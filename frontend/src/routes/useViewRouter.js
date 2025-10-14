import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useHybridStore, { useCurrentView } from '../stores/useHybridStore';
import { VIEW_TO_PATH, PATH_TO_VIEW } from './routeConfig';
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
 */
export default function useViewRouter() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roleResolved } = useAuth(); // gate redirects until auth is known

  const currentView = useCurrentView();
  const setCurrentView = (view) => useHybridStore.getState().setCurrentView(view);

  const lastViewRef = useRef(currentView);
  const redirectedOnceRef = useRef(false);

  // 1) When store view changes, push URL (only if not already at that path)
  useEffect(() => {
    if (!currentView) return;

    // Don't navigate until role resolution is done to avoid battling "/" logic
    if (!roleResolved) return;

    const expectedPath = VIEW_TO_PATH[currentView];

    // Skip navigation if:
    // 1. No expected path exists
    // 2. Already at the expected path (prevents loops)
    // 3. Currently at root path (prevents interference with login redirects)
    if (!expectedPath) return;

    const isAtRoot = location.pathname === '/';
    const isAtExpectedPath = location.pathname === expectedPath;

    // Don't navigate if already at the target or if we're at root during login flow
    if (isAtExpectedPath || isAtRoot) {
      lastViewRef.current = currentView;
      return;
    }

    // Prevent double navigation thrash
    if (lastViewRef.current === currentView && redirectedOnceRef.current) return;

    console.log('📍 Store view changed to:', currentView, '→ navigating to:', expectedPath);
    redirectedOnceRef.current = true;
    navigate(expectedPath, { replace: false });
    lastViewRef.current = currentView;
  }, [currentView, roleResolved, navigate, location.pathname]);

  // 2) When URL changes (user clicks links / back/forward), update store view
  useEffect(() => {
    const path = location.pathname;
    const view = PATH_TO_VIEW[path];

    if (view && view !== lastViewRef.current) {
      console.log('📍 URL changed to:', path, '→ updating store view to:', view);
      setCurrentView(view);
      lastViewRef.current = view;
    }
  }, [location.pathname]);
}
