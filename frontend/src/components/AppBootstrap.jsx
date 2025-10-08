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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key="loader"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          {/* Animated Logo */}
          <motion.div
            className="mb-8"
            animate={{
              rotate: [0, 360],
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          >
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-600 via-pink-500 to-purple-600 rounded-2xl shadow-2xl flex items-center justify-center">
              <span className="text-4xl font-bold text-white">D</span>
            </div>
          </motion.div>

          {/* Loading Text */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Loading Digis
            </h2>
            <p className="text-gray-600">Verifying your session...</p>
          </motion.div>

          {/* Animated Progress Bar */}
          <motion.div
            className="mt-8 w-64 h-1 bg-gray-200 rounded-full overflow-hidden mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <motion.div
              className="h-full bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600"
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
                className="w-2 h-2 bg-purple-400 rounded-full"
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
