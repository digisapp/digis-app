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

        if (session?.access_token) {
          console.log('🔐 [Bootstrap] Calling bootstrap with token...');
          // Bootstrap with token
          await bootstrap(session.access_token);
          console.log('🔐 [Bootstrap] Bootstrap complete');
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
            className="mb-8"
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

          {/* Loading Text */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <p className="text-white text-lg font-medium">Verifying your session...</p>
          </motion.div>

          {/* Animated Progress Bar */}
          <motion.div
            className="mt-8 w-64 h-1 bg-purple-700 rounded-full overflow-hidden mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <motion.div
              className="h-full bg-gradient-to-r from-pink-500 via-purple-400 to-pink-500"
              animate={{
                x: ['-100%', '100%']
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
          </motion.div>

          {/* Decorative Elements */}
          <div className="mt-12 flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-pink-400 rounded-full"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 1, 0.3]
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
