// Route guards for role-based access control
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * WaitForRole - Shows fallback until role is resolved
 * Use this to wrap role-dependent routes to prevent flashing wrong UI
 *
 * @example
 * <WaitForRole fallback={<LoadingSpinner />}>
 *   <CreatorOnly><Dashboard /></CreatorOnly>
 * </WaitForRole>
 */
export const WaitForRole = ({ children, fallback = null }) => {
  const { authLoading, roleResolved } = useAuth();

  if (authLoading || !roleResolved) {
    return fallback ?? (
      <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="animate-spin h-8 w-8 border-2 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return children;
};

/**
 * CreatorOnly - Restricts access to creators and admins only
 * Redirects fans to explore page
 *
 * @example
 * <Route
 *   path="/dashboard"
 *   element={
 *     <WaitForRole>
 *       <CreatorOnly><Dashboard /></CreatorOnly>
 *     </WaitForRole>
 *   }
 * />
 */
export const CreatorOnly = ({ children, redirect = '/explore' }) => {
  const { roleResolved, isCreator, isAdmin } = useAuth();

  if (!roleResolved) return null; // WaitForRole should handle this

  return (isCreator || isAdmin) ? children : <Navigate to={redirect} replace />;
};

/**
 * FanOnly - Restricts access to fans only
 * Redirects creators/admins to dashboard
 *
 * @example
 * <Route
 *   path="/wallet"
 *   element={
 *     <WaitForRole>
 *       <FanOnly><WalletPage /></FanOnly>
 *     </WaitForRole>
 *   }
 * />
 */
export const FanOnly = ({ children, redirect = '/dashboard' }) => {
  const { roleResolved, isCreator, isAdmin } = useAuth();

  if (!roleResolved) return null; // WaitForRole should handle this

  return (!isCreator && !isAdmin) ? children : <Navigate to={redirect} replace />;
};

/**
 * AdminOnly - Restricts access to admins only
 * Redirects non-admins to their appropriate home page
 *
 * @example
 * <Route
 *   path="/admin"
 *   element={
 *     <WaitForRole>
 *       <AdminOnly><AdminPanel /></AdminOnly>
 *     </WaitForRole>
 *   }
 * />
 */
export const AdminOnly = ({ children }) => {
  const { roleResolved, isAdmin, isCreator } = useAuth();

  if (!roleResolved) return null; // WaitForRole should handle this

  if (!isAdmin) {
    // Redirect to appropriate home based on role
    const redirectTo = isCreator ? '/dashboard' : '/explore';
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};
