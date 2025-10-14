import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LOGOUT_DEST } from '../constants/auth';
import UnauthSplash from './UnauthSplash';

/**
 * Protected Route Component (Outlet-based - no cloning!)
 *
 * Tri-state auth handling:
 * - authLoading = true → show skeleton (prevents "Access Denied" flash)
 * - user = null → redirect to login
 * - user exists but lacks role → show access denied or redirect
 *
 * Props:
 * - requireCreator: boolean - requires creator role
 * - requireAdmin: boolean - requires admin role
 * - fallbackPath: string - where to redirect on access denied (default: LOGOUT_DEST)
 */
const ProtectedRoute = ({
  children,
  requireCreator = false,
  requireAdmin = false,
  fallbackPath = LOGOUT_DEST
}) => {
  const { user, authLoading, isCreator, isAdmin, profile, roleResolved, role } = useAuth();
  const location = useLocation();
  const [showSlowLoadingMessage, setShowSlowLoadingMessage] = useState(false);
  const [showUnauthSplash, setShowUnauthSplash] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Debug log for QA (can be removed in production)
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔒 ProtectedRoute guard:', {
      path: location.pathname,
      authLoading,
      roleResolved,
      role,
      requireCreator,
      requireAdmin
    });
  }

  // Show "Still loading..." message after 3s for slow role resolution
  useEffect(() => {
    if (authLoading || !roleResolved || !user) {
      const timer = setTimeout(() => {
        setShowSlowLoadingMessage(true);
      }, 3000);

      return () => {
        clearTimeout(timer);
        setShowSlowLoadingMessage(false);
      };
    } else {
      setShowSlowLoadingMessage(false);
    }
  }, [authLoading, roleResolved, user]);

  // Hard cap: after 6s, fail open (render children) instead of blocking forever
  useEffect(() => {
    if (authLoading || !roleResolved || !user) {
      const t = setTimeout(() => setTimedOut(true), 6000);
      return () => clearTimeout(t);
    } else {
      setTimedOut(false);
    }
  }, [authLoading, roleResolved, user]);

  // Guard while booting, but only briefly; then fail open after timeout
  if ((authLoading || !roleResolved || !user) && !timedOut) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Verifying access...</p>
          {/* Show "Still loading..." after 3s to reassure users */}
          {showSlowLoadingMessage && (
            <p className="text-gray-500 dark:text-gray-500 text-xs mt-2 animate-pulse">
              Still loading...
            </p>
          )}
          {/* Subtle skeleton - prevents "nothing → content" jump */}
          <div className="mt-8 space-y-3 max-w-md mx-auto">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto animate-pulse"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated? Show splash for ~300-500ms then redirect
  if (!user) {
    if (!showUnauthSplash) {
      // Show splash briefly to smooth UX
      setTimeout(() => setShowUnauthSplash(true), 400);
      return <UnauthSplash />;
    }
    return <Navigate to={LOGOUT_DEST} state={{ from: location }} replace />;
  }

  // Check role requirements ONLY once role is resolved (don't block route render)
  if (roleResolved && requireAdmin && !isAdmin) {
    // Silent redirect for admin routes (security - don't reveal they exist)
    return <Navigate to={fallbackPath} replace />;
  }

  if (roleResolved && requireCreator && !isCreator && !isAdmin) {
    // Show access denied for creator routes
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Creator Access Required
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This feature is only available to creators.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.href = '/profile'}
              className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
            >
              Apply to Become a Creator
            </button>
            <button
              onClick={() => window.history.back()}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If we timed out (backend hiccup), render children with a soft warning banner
  // Feature code paths can still check profile/isCreator as needed.
  const WarningBanner = timedOut && !roleResolved ? (
    <div className="fixed top-0 left-0 right-0 z-50 p-2 text-xs text-yellow-900 bg-yellow-100 border-b border-yellow-200 text-center">
      We couldn't verify your access right now. Some features may be limited. <button className="underline" onClick={() => window.location.replace('/?nocache=1')}>Retry</button>
    </div>
  ) : null;

  // Use Outlet pattern for nested routes (prevents cloning issues)
  // If children are provided (direct usage), render them
  return (
    <>
      {WarningBanner}
      {children || <Outlet />}
    </>
  );
};

export default ProtectedRoute;