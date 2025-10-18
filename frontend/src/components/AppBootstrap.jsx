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

        // Always call bootstrap - it handles both authenticated and unauthenticated cases
        // When no token, bootstrap will use last-known role from localStorage
        console.log('🔐 [Bootstrap] Calling bootstrap...');
        await bootstrap(session?.access_token || null);
        console.log('🔐 [Bootstrap] Bootstrap complete');
      } catch (error) {
        if (aborted) return;
        console.error('🔐 [Bootstrap] Init failed:', error);
        // Don't call setAuthError - bootstrap already handles errors gracefully
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

  // Show loading state until auth is ready
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
