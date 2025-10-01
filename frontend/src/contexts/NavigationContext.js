import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useHybridStore from '../stores/useHybridStore';

const NavigationContext = createContext(undefined);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
};

export const NavigationProvider = ({
  children,
  user,
  badges = {},
  tokenBalance,
  onGoLive,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const setCurrentView = useHybridStore((state) => state.setCurrentView);

  const role = useMemo(() => {
    if (!user) return 'fan';
    if (user.role === 'admin' || user.is_admin) return 'admin';
    if (user.is_creator) return 'creator';
    return 'fan';
  }, [user]);

  // Map paths to view states for mobile navigation
  const pathToView = useMemo(() => ({
    '/': role === 'creator' || role === 'admin' ? 'dashboard' : 'home',
    '/home': 'home',
    '/dashboard': 'dashboard',
    '/explore': 'explore',
    '/messages': 'messages',
    '/wallet': 'wallet',
    '/profile': 'profile',
    '/settings': 'settings',
    '/content': 'content',
    '/schedule': 'schedule',
    '/analytics': 'analytics',
    '/calls': 'calls',
    '/call-management': 'call-management',
    '/followers': 'followers',
    '/subscribers': 'subscribers',
    '/tv': 'tv',
    '/classes': 'classes',
    '/shop': 'shop',
    '/collections': 'collections',
  }), [role]);

  const onNavigate = useCallback(
    (path) => {
      if (!path) return;

      // Special handling for dashboard navigation - always navigate to dashboard
      if (path === '/dashboard') {
        console.log('📱 Navigation: Navigating to dashboard');
        setCurrentView('dashboard');
        navigate('/dashboard');
        return;
      }

      // Prevent double navigation to the same path (except for dashboard)
      if (path === location.pathname) {
        console.log('📱 Navigation: Already on path', path);
        return;
      }

      // Map the path to a view for the currentView state
      const view = pathToView[path];
      if (view && setCurrentView) {
        console.log('📱 Navigation: Setting view to', view, 'for path', path);
        setCurrentView(view);
      }

      // Update the URL
      navigate(path);
    },
    [navigate, location.pathname, setCurrentView, pathToView]
  );

  const onCenterAction = useCallback(() => {
    if (role === 'creator' && onGoLive) {
      onGoLive();
    }
  }, [role, onGoLive]);

  const value = useMemo(
    () => ({
      activePath: location.pathname,
      onNavigate,
      role,
      badges,
      tokenBalance,
      onCenterAction: role === 'creator' ? onCenterAction : undefined,
      isAuthenticated: !!user,
    }),
    [location.pathname, onNavigate, role, badges, tokenBalance, onCenterAction, user]
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};