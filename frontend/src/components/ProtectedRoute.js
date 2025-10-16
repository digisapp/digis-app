import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LOGOUT_DEST } from '../constants/auth';

/**
 * Protected Route Component (Simplified, Surgical Fix)
 *
 * CRITICAL: Wait for auth to resolve before any redirects (prevents loops)
 * - Still bootstrapping? Show placeholder (no redirect)
 * - Auth ready + no user? Redirect to login
 * - Auth ready + wrong role? Redirect or show error
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
  const { user, authLoading, isCreator, isAdmin, profile, roleResolved } = useAuth();
  const location = useLocation();

  // Still bootstrapping? Render a tiny placeholder — don't redirect yet.
  if (authLoading || !roleResolved) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  // From here, auth is ready — make decisions:
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requireCreator && !isCreator && !isAdmin) {
    return <Navigate to="/explore" replace />;
  }

  // Use Outlet pattern for nested routes
  return children || <Outlet />;
};

export default ProtectedRoute;