import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
 * - fallbackPath: string - where to redirect on access denied (default: '/')
 */
const ProtectedRoute = ({
  children,
  requireCreator = false,
  requireAdmin = false,
  fallbackPath = '/'
}) => {
  const { user, authLoading, isCreator, isAdmin, profile, roleResolved, currentUser } = useAuth();
  const location = useLocation();

  // Hard guard: never render children until role & user are ready
  if (authLoading || !roleResolved || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated? Redirect to login (save current location for redirect after login)
  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Check role requirements
  if (requireAdmin && !isAdmin) {
    // Silent redirect for admin routes (security - don't reveal they exist)
    return <Navigate to={fallbackPath} replace />;
  }

  if (requireCreator && !isCreator && !isAdmin) {
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

  // Use Outlet pattern for nested routes (prevents cloning issues)
  // If children are provided (direct usage), render them
  return children || <Outlet />;
};

export default ProtectedRoute;