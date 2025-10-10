import { VIEW_TO_PATH } from './routeConfig';

/**
 * navigateToView - Helper to navigate using view names
 *
 * Keeps existing setCurrentView('xyz') calls working, but actually
 * navigates via routes. This is a drop-in replacement that works
 * with the useViewRouter adapter.
 *
 * Usage:
 *   import { useNavigate } from 'react-router-dom';
 *   import { navigateToView } from '../routes/navigateToView';
 *
 *   const navigate = useNavigate();
 *   navigateToView(navigate, 'dashboard');
 */
export function navigateToView(navigate, view) {
  const path = VIEW_TO_PATH[view] || '/';
  console.log('🔀 navigateToView:', view, '→', path);
  navigate(path);
}
