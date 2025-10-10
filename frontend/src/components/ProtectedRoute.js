import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { verifyUserRole, canAccessRoute, ROLES } from '../utils/roleVerification';

/**
 * Protected Route Component
 * Ensures only users with the correct role can access certain routes
 *
 * Props:
 * - role: 'admin' | 'creator' | 'fan' (preferred API)
 * - requireAdmin: boolean (legacy, maps to role='admin')
 * - requireCreator: boolean (legacy, maps to role='creator')
 * - requiredRole: ROLES enum value (legacy backend verification)
 */
const ProtectedRoute = ({
  children,
  role,
  requireAdmin,
  requireCreator,
  requiredRole,
  fallbackPath = '/',
  isAdmin,
  isCreator
}) => {
  // Normalize to requiredRole for backend verification
  let normalizedRole = requiredRole;

  if (role === 'admin' || requireAdmin) {
    normalizedRole = ROLES.ADMIN;
  } else if (role === 'creator' || requireCreator) {
    normalizedRole = ROLES.CREATOR;
  } else if (role === 'fan') {
    normalizedRole = ROLES.FAN;
  }
  const [isVerifying, setIsVerifying] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [verifiedRole, setVerifiedRole] = useState(null);

  useEffect(() => {
    async function checkAccess() {
      try {
        // Always verify with backend, don't trust frontend state
        const role = await verifyUserRole();
        setVerifiedRole(role);
        
        if (!role) {
          setHasAccess(false);
          setIsVerifying(false);
          return;
        }

        let allowed = false;

        switch (normalizedRole) {
          case ROLES.ADMIN:
            // Only true admins can access admin routes
            allowed = role.isAdmin === true;
            break;
          case ROLES.CREATOR:
            // Creators and admins can access creator routes
            allowed = role.isCreator === true || role.isAdmin === true;
            break;
          case ROLES.FAN:
            // All authenticated users can access fan routes
            allowed = true;
            break;
          default:
            allowed = await canAccessRoute(normalizedRole);
        }

        setHasAccess(allowed);

        // Log access attempt for security monitoring
        if (!allowed && normalizedRole === ROLES.ADMIN) {
          console.warn('⚠️ Unauthorized admin access attempt:', {
            email: role.email,
            primaryRole: role.primaryRole,
            attemptedRoute: window.location.pathname
          });
        }
      } catch (error) {
        console.error('Error verifying route access:', error);
        setHasAccess(false);
      } finally {
        setIsVerifying(false);
      }
    }

    checkAccess();
  }, [normalizedRole]);

  if (isVerifying) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    // For admin routes, completely hide and redirect
    if (normalizedRole === ROLES.ADMIN) {
      return <Navigate to={fallbackPath} replace />;
    }
    
    // For other routes, show access denied
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don't have permission to access this page.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Render children - don't try to clone them as they may be lazy-loaded
  // The verified role data is available via AuthContext
  return children;
};

export default ProtectedRoute;