import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LOGOUT_DEST } from '../constants/auth';
import AccessDenied from './ui/AccessDenied';

/**
 * Protected Route Component (Enhanced with Admin Support)
 *
 * CRITICAL: Wait for auth to resolve before any redirects (prevents loops)
 * - Still bootstrapping? Show placeholder (no redirect)
 * - Auth ready + no user? Redirect to login (or admin login for admin routes)
 * - Auth ready + wrong role? Show AccessDenied page or redirect
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
    // If trying to access admin, redirect to admin login
    const isAdminRoute = location.pathname.startsWith('/admin');
    const redirectPath = isAdminRoute ? '/admin/login' : '/';
    return <Navigate to={redirectPath} replace state={{ from: location }} />;
  }

  // Admin access required but user is not admin
  if (requireAdmin && !isAdmin) {
    return (
      <AccessDenied
        title="Admin Access Required"
        message="You don't have administrator privileges."
        suggestion="This section is restricted to platform administrators only. If you believe you should have access, please contact support."
        homeUrl={isCreator ? '/dashboard' : '/explore'}
      />
    );
  }

  // Creator access required but user is not creator
  if (requireCreator && !isCreator && !isAdmin) {
    return (
      <AccessDenied
        title="Creator Access Required"
        message="This feature is only available to creators."
        suggestion="Apply to become a creator to access this section."
        homeUrl="/explore"
      />
    );
  }

  // Use Outlet pattern for nested routes
  return children || <Outlet />;
};

export default ProtectedRoute;