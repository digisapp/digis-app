import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Admin Guard - Protects admin routes
 *
 * Fast redirect to login if not authenticated (no spinner loop).
 * Only blocks if user is authenticated but not admin.
 */
export default function AdminGuard({ children }) {
  const { user, isAdmin, authLoading, roleResolved } = useAuth();
  const location = useLocation();

  // If user isn't authenticated (or we can't tell yet), send to login FAST.
  // Don't wait for full role resolution - prevents spinner loop.
  if (!authLoading && !user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // If resolved and not admin → kick out to home
  if (!authLoading && roleResolved && user && !isAdmin) {
    console.warn('Non-admin user tried to access admin area:', user.email);
    return <Navigate to="/" replace />;
  }

  // While auth is loading, show a minimal inline loader (not full-screen splash)
  if (authLoading || !roleResolved) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // User is admin and ready - render the protected route
  return children;
}
