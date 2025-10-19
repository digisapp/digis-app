import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Public route guard with smart admin redirect
 *
 * Allows page to render immediately (no blocking spinner) but redirects
 * if user is already logged in as admin.
 *
 * Use for: /admin/login, /signup, etc.
 */
export default function PublicOrRedirectAdmin({ children }) {
  const { user, isAdmin, authLoading } = useAuth();

  // CRITICAL: While loading, do NOT block the page — render login immediately.
  // This prevents the infinite spinner issue.
  if (authLoading) return children;

  // If already an admin, skip login and go to admin dashboard
  if (user && isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Anyone else (not logged in, or logged in as non-admin) can see the page
  return children;
}
