import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { verifyUserRole, canAccessRoute, ROLES } from '../utils/roleVerification';

/**
 * Protected Route Component
 * Ensures only users with the correct role can access certain routes
 */
const ProtectedRoute = ({ 
  children, 
  requiredRole, 
  fallbackPath = '/',
  isAdmin,
  isCreator 
}) => {
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
        
        switch (requiredRole) {
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
            allowed = await canAccessRoute(requiredRole);
        }
        
        setHasAccess(allowed);
        
        // Log access attempt for security monitoring
        if (!allowed && requiredRole === ROLES.ADMIN) {
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
  }, [requiredRole]);

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
    if (requiredRole === ROLES.ADMIN) {
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

  // Pass verified role data to children
  return React.cloneElement(children, { 
    verifiedRole,
    isVerifiedAdmin: verifiedRole?.isAdmin === true,
    isVerifiedCreator: verifiedRole?.isCreator === true
  });
};

export default ProtectedRoute;