/**
 * AppBootstrap - Ensures auth is ready before rendering the app
 *
 * This component blocks rendering until we have authoritative session data from the backend.
 * This prevents role flip-flopping and ensures consistent UI state.
 *
 * CRITICAL: Wrap your entire app with this component
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../stores/useAuthStore';
import { supabase } from '../utils/supabase-auth';

export default function AppBootstrap({ children }) {
  const authStatus = useAuthStore((state) => state.authStatus);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [initAttempted, setInitAttempted] = useState(false);

  // Check if current route is public (doesn't require auth)
  const isPublicRoute = () => {
    const path = window.location.pathname;
    const publicPaths = [
      '/admin/login',
      '/terms',
      '/privacy',
      '/'
    ];
    return publicPaths.some(publicPath => path === publicPath || path.startsWith(publicPath));
  };

  useEffect(() => {
    if (initAttempted) return;

    let aborted = false;
    const controller = new AbortController();

    const initAuth = async () => {
      try {
        // Get Supabase session
        console.log('🔐 [Bootstrap] Getting Supabase session...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('🔐 [Bootstrap] Supabase session error:', sessionError);
        }

        console.log('🔐 [Bootstrap] Supabase session:', {
          hasSession: !!session,
          hasToken: !!session?.access_token,
          user: session?.user?.email
        });

        if (aborted) return;

        if (session?.access_token) {
          console.log('🔐 [Bootstrap] Calling bootstrap with token...');
          // Bootstrap with token (with 10s timeout to prevent infinite loading)
          try {
            await Promise.race([
              bootstrap(session.access_token),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Bootstrap timeout after 10s')), 10000)
              )
            ]);
            console.log('🔐 [Bootstrap] Bootstrap complete');
          } catch (bootstrapError) {
            console.error('🔐 [Bootstrap] Bootstrap failed:', bootstrapError);
            // Fall back to guest mode if bootstrap fails
            useAuthStore.getState().setAuthError(bootstrapError.message);
          }
        } else {
          // No session - set to fan/guest
          console.log('🔐 [Bootstrap] No session, setting as guest');
          useAuthStore.getState().setAuthError('Not authenticated');
        }
      } catch (error) {
        if (aborted) return;
        console.error('🔐 [Bootstrap] Init failed:', error);
        useAuthStore.getState().setAuthError(error.message);
      } finally {
        setInitAttempted(true);
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 [Bootstrap] Auth state changed:', event);

        if (event === 'SIGNED_OUT') {
          clearSession();
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.access_token) {
            await bootstrap(session.access_token);
          }
        }
      }
    );

    return () => {
      aborted = true;
      controller.abort();
      subscription.unsubscribe();
    };
  }, [initAttempted, bootstrap, clearSession]);

  // Skip auth check for public routes (like /admin/login)
  // This prevents infinite loading on pages that don't need authentication
  if (isPublicRoute()) {
    console.log('🔐 [Bootstrap] Public route detected, skipping auth gate');
    return <>{children}</>;
  }

  // Show loading state until auth is ready (for protected routes)
  if (authStatus !== 'ready') {
    return <BootstrapLoader />;
  }

  return <>{children}</>;
}

/**
 * Loading screen while bootstrapping
 */
function BootstrapLoader() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900 flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key="loader"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          {/* Animated Digis Logo */}
          <motion.div
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.9, 1, 0.9]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          >
            <img
              src="/digis-logo-white.png"
              alt="Digis"
              className="w-48 h-auto mx-auto filter drop-shadow-2xl"
            />
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
