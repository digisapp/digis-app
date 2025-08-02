import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase-auth';
import { motion } from 'framer-motion';
import { SparklesIcon } from '@heroicons/react/24/outline';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the session from the URL
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          navigate('/auth?error=callback_failed');
          return;
        }

        if (session) {
          // Sync user with backend
          const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/sync-user`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              supabaseId: session.user.id,
              email: session.user.email,
              metadata: session.user.user_metadata
            })
          });

          if (response.ok) {
            const { user, isNewUser } = await response.json();
            
            // Store auth info
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('userEmail', session.user.email);
            
            // Navigate based on user status
            if (isNewUser || !user.username) {
              navigate('/onboarding');
            } else if (user.is_creator) {
              navigate('/creator-studio');
            } else {
              navigate('/discover');
            }
          } else {
            throw new Error('Failed to sync user');
          }
        } else {
          navigate('/auth');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/auth?error=sync_failed');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="flex justify-center mb-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="p-4 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl shadow-2xl"
          >
            <SparklesIcon className="h-16 w-16 text-white" />
          </motion.div>
        </div>
        
        <h2 className="text-3xl font-bold text-white mb-3">
          Completing Sign In...
        </h2>
        
        <p className="text-gray-300 mb-6">
          Please wait while we set up your account
        </p>
        
        <div className="flex justify-center">
          <div className="w-16 h-1 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              animate={{ x: [-64, 0] }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
              style={{ width: '200%' }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthCallback;