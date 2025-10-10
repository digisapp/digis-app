/**
 * AuthAnalyticsBridge
 *
 * Syncs user authentication state with analytics and error tracking services.
 * Automatically identifies users when they log in and clears context on logout.
 *
 * Mount once in App (inside providers).
 */

import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { analytics } from '../lib/analytics';
import { setUser, clearUser } from '../lib/sentry.client';

export default function AuthAnalyticsBridge() {
  const { user, profile, isAuthenticated, isCreator, isAdmin } = useAuth();

  useEffect(() => {
    // Clear user context on logout
    if (!isAuthenticated || !user) {
      analytics.track('user_logged_out');
      clearUser();
      return;
    }

    // Determine user role
    const role = isAdmin ? 'admin' : (isCreator ? 'creator' : 'fan');

    // User traits for analytics
    const traits = {
      email: user.email,
      username: profile?.username,
      role,
      createdAt: profile?.created_at,
      isCreator: isCreator,
      isAdmin: isAdmin,
    };

    // Identify user in analytics
    analytics.identify(user.id, traits);

    // Set user context in Sentry
    setUser({
      id: user.id,
      email: user.email,
      username: profile?.username,
    });

    // Track login event (only once per session)
    if (!sessionStorage.getItem('login_tracked')) {
      analytics.track('user_logged_in', { role });
      sessionStorage.setItem('login_tracked', 'true');
    }
  }, [
    isAuthenticated,
    user?.id,
    user?.email,
    profile?.username,
    profile?.created_at,
    isCreator,
    isAdmin,
  ]);

  // This component renders nothing
  return null;
}
