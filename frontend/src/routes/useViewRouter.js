import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useHybridStore, { useCurrentView } from '../stores/useHybridStore';
import { VIEW_TO_PATH, PATH_TO_VIEW } from './routeConfig';

/**
 * useViewRouter - Adapter Hook for Gradual Migration
 *
 * Keeps legacy currentView state in sync with URL-based routing.
 * This allows old setCurrentView('dashboard') calls to work while
 * progressively migrating to real URL routes.
 *
 * How it works:
 * 1. When store view changes → push URL
 * 2. When URL changes → update store view
 * 3. Prevents loops with lastViewRef tracking
 */
export default function useViewRouter() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentView = useCurrentView();
  const setCurrentView = (view) => useHybridStore.getState().setCurrentView(view);

  const lastViewRef = useRef(currentView);

  // 1) When store view changes, push URL (only if not already at that path)
  useEffect(() => {
    if (!currentView) return;

    const expectedPath = VIEW_TO_PATH[currentView];
    if (expectedPath && location.pathname !== expectedPath) {
      console.log('📍 Store view changed to:', currentView, '→ navigating to:', expectedPath);
      navigate(expectedPath, { replace: false });
    }
    lastViewRef.current = currentView;
  }, [currentView, navigate, location.pathname]);

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
