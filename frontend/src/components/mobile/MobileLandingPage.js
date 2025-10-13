import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  signIn,
  signUp,
  resetPassword
} from '../../utils/supabase-auth';
import { getAuthToken } from '../../utils/auth-helpers';
import {
  EnvelopeIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

const MobileLandingPage = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  // Prevent body scrolling when this component is mounted
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.classList.add('mobile-landing-active');

    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('mobile-landing-active');
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isForgotPassword) {
        await resetPassword(email);
        setSuccess('Password reset link sent to your email!');
        setIsForgotPassword(false);
        return;
      }

      if (isSignUp) {
        const { user } = await signUp(email, password);
        
        // Create user profile
        const token = await getAuthToken();
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/create-profile`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            username: username || email.split('@')[0],
            displayName: username || email.split('@')[0],
            bio: '', 
            profilePicture: null,
            accountType: 'user'
          })
        });

        if (!response.ok) {
          throw new Error('Failed to create profile');
        }

        // Sync with backend
        await syncUserData(user);
        
        setSuccess('Account created! Welcome to Digis!');
        setTimeout(() => {
          onLogin?.(user);
        }, 1500);
      } else {
        const { user } = await signIn(email, password);
        
        // Sync with backend
        await syncUserData(user);
        
        // Immediately redirect after successful login
        onLogin?.(user);
      }
    } catch (error) {
      let errorMessage = error.message;
      
      // User-friendly error messages
      if (errorMessage.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password';
      } else if (errorMessage.includes('Email not confirmed')) {
        errorMessage = 'Please check your email to confirm your account';
      } else if (errorMessage.includes('User already registered')) {
        errorMessage = 'An account with this email already exists';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const syncUserData = async (user) => {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/sync-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          supabaseId: user.id,
          email: user.email
        })
      });

      if (!response.ok) {
        console.error('Failed to sync user data');
      }
    } catch (error) {
      console.error('Error syncing user data:', error);
    }
  };

  return (
    <div className="mobile-landing-container bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-fuchsia-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />
      </div>

      {/* Content container with proper flex layout */}
      <div className="mobile-landing-flex px-4 relative z-10">
        {/* Top spacer */}
        <div className="mobile-landing-safe-top" />

        {/* Logo section with proper spacing */}
        <motion.div
          className="mobile-landing-logo text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Digis Logo */}
        <div className="mb-2">
          <img
            src="/digis-logo-white.png"
            alt="Digis"
            className="mx-auto h-16 w-auto hover:scale-105 transition-transform duration-200"
          />
        </div>
        
        {/* Subtitle only for specific actions */}
        {isForgotPassword && (
          <p className="text-white/90 text-lg mt-4">Reset your password</p>
        )}
        {isSignUp && (
          <p className="text-white/90 text-lg mt-4">Create your account</p>
        )}
      </motion.div>

        {/* Center content vertically */}
        <div className="flex-1 flex flex-col justify-center">
          {/* Auth Form */}
          <motion.div
            className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/20 mx-auto w-full max-w-md"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div className="relative">
            <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              disabled={loading}
              className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 transition-all disabled:opacity-50"
            />
          </div>

          {/* Username (Sign up only) */}
          <AnimatePresence>
            {isSignUp && (
              <motion.div 
                className="relative"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username (optional)"
                  disabled={loading}
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 transition-all disabled:opacity-50"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Password Input */}
          {!isForgotPassword && (
            <div className="relative">
              <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                disabled={loading}
                className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-400 transition-colors"
              >
                {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
          )}

          {/* Error/Success Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                className="bg-red-500/20 border border-red-500/50 backdrop-blur-sm text-red-200 px-4 py-3 rounded-xl text-sm"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                className="bg-green-500/20 border border-green-500/50 backdrop-blur-sm text-green-200 px-4 py-3 rounded-xl text-sm"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {success}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl hover:shadow-purple-500/30 transition-all"
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              isForgotPassword ? 'Send Reset Link' : isSignUp ? 'Create Account' : 'Sign In'
            )}
          </motion.button>

          {/* Forgot Password Link */}
          {!isSignUp && !isForgotPassword && (
            <button
              type="button"
              onClick={() => setIsForgotPassword(true)}
              className="w-full text-center text-purple-400 text-sm font-medium hover:text-purple-300 transition-colors"
            >
              Forgot password?
            </button>
          )}
        </form>

        {/* Toggle Sign Up / Sign In */}
        <div className="mt-6 pt-6 border-t border-white/10">
          {isForgotPassword ? (
            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setError('');
                setSuccess('');
              }}
              className="w-full text-center text-gray-300 text-sm"
            >
              Back to sign in
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setSuccess('');
                setPassword('');
              }}
              className="w-full text-center text-gray-300 text-sm"
            >
              {isSignUp ? (
                <>Already have an account? <span className="text-purple-400 font-semibold hover:text-purple-300">Sign in</span></>
              ) : (
                <>Don't have an account? <span className="text-purple-400 font-semibold hover:text-purple-300">Sign up</span></>
              )}
            </button>
          )}
        </div>
          </motion.div>
        </div>

        {/* Bottom spacer with safe area padding */}
        <div className="mobile-landing-safe-bottom" />
      </div>

      {/* Animation styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}} />
    </div>
  );
};

export default MobileLandingPage;