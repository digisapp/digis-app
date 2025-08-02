import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  signIn, 
  signUp, 
  signInWithGoogle, 
  resetPassword,
  getCurrentUser 
} from '../utils/supabase-auth';
import { AppContext } from '../contexts/AppContext';
import api from '../services/api';

const Auth = ({ mode: initialMode = 'signin' }) => {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  const navigate = useNavigate();
  const { setUser, setIsAuthenticated } = useContext(AppContext);

  useEffect(() => {
    // Check if user is already authenticated
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { user } = await getCurrentUser();
    if (user) {
      await handleSuccessfulAuth(user);
    }
  };

  const handleSuccessfulAuth = async (user) => {
    try {
      // Sync with backend to ensure user exists in our database
      const response = await api.post('/auth/sync-user', {
        supabaseId: user.id,
        email: user.email,
        metadata: user.user_metadata
      });

      const userData = response.data.user;

      // Update app context
      setUser(userData);
      setIsAuthenticated(true);

      // Store auth info
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userEmail', user.email);

      // Navigate based on user type
      if (userData.is_creator) {
        navigate('/creator-studio');
      } else if (userData.username) {
        navigate('/discover');
      } else {
        navigate('/onboarding');
      }
    } catch (error) {
      console.error('Error syncing user:', error);
      setError('Failed to complete authentication. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { user, error } = await signUp(email, password, {
          username: username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
          display_name: displayName || username,
          created_from: 'web'
        });

        if (error) throw error;

        if (user) {
          setSuccessMessage('Account created! Please check your email to verify your account.');
          // Don't auto-login until email is verified
        }
      } else if (mode === 'signin') {
        const { user, error } = await signIn(email, password);

        if (error) throw error;

        if (user) {
          await handleSuccessfulAuth(user);
        }
      } else if (mode === 'reset') {
        const { error } = await resetPassword(email);

        if (error) throw error;

        setSuccessMessage('Password reset email sent! Check your inbox.');
        setTimeout(() => setMode('signin'), 3000);
      }
    } catch (error) {
      console.error('Auth error:', error);
      
      // User-friendly error messages
      if (error.message?.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else if (error.message?.includes('User already registered')) {
        setError('An account with this email already exists.');
      } else if (error.message?.includes('Email not confirmed')) {
        setError('Please verify your email before signing in.');
      } else if (error.message?.includes('Password should be at least')) {
        setError('Password must be at least 6 characters long.');
      } else {
        setError(error.message || 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      const { error } = await signInWithGoogle();
      
      if (error) throw error;
      
      // OAuth redirects to callback URL, no need to handle success here
    } catch (error) {
      console.error('Google sign-in error:', error);
      setError('Failed to sign in with Google. Please try again.');
      setLoading(false);
    }
  };

  const validateUsername = (value) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleaned !== value) {
      setUsername(cleaned);
    } else {
      setUsername(value);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full space-y-8 bg-black/50 backdrop-blur-xl p-8 rounded-2xl border border-white/10"
      >
        <div>
          <h2 className="text-center text-3xl font-extrabold text-white">
            {mode === 'signup' ? 'Create your account' : 
             mode === 'reset' ? 'Reset your password' : 
             'Sign in to your account'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-300">
            {mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => {
                    setMode('signin');
                    setError('');
                    setSuccessMessage('');
                  }}
                  className="font-medium text-pink-400 hover:text-pink-300"
                >
                  Sign in
                </button>
              </>
            ) : mode === 'signin' ? (
              <>
                Don't have an account?{' '}
                <button
                  onClick={() => {
                    setMode('signup');
                    setError('');
                    setSuccessMessage('');
                  }}
                  className="font-medium text-pink-400 hover:text-pink-300"
                >
                  Sign up
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setMode('signin');
                  setError('');
                  setSuccessMessage('');
                }}
                className="font-medium text-pink-400 hover:text-pink-300"
              >
                Back to sign in
              </button>
            )}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm"
            >
              {error}
            </motion.div>
          )}

          {successMessage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg text-sm"
            >
              {successMessage}
            </motion.div>
          )}

          <div className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-300">
                    Username
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => validateUsername(e.target.value)}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 bg-white/5 border border-white/10 placeholder-gray-400 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Choose a unique username"
                    pattern="[a-z0-9_]+"
                    title="Username can only contain lowercase letters, numbers, and underscores"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Only lowercase letters, numbers, and underscores allowed
                  </p>
                </div>

                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium text-gray-300">
                    Display Name
                  </label>
                  <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 bg-white/5 border border-white/10 placeholder-gray-400 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Your public display name (optional)"
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 bg-white/5 border border-white/10 placeholder-gray-400 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="Enter your email"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 bg-white/5 border border-white/10 placeholder-gray-400 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="Enter your password"
                  minLength="6"
                />
                {mode === 'signup' && (
                  <p className="mt-1 text-xs text-gray-400">
                    Must be at least 6 characters long
                  </p>
                )}
              </div>
            )}
          </div>

          {mode === 'signin' && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setMode('reset');
                  setError('');
                  setSuccessMessage('');
                }}
                className="text-sm text-pink-400 hover:text-pink-300"
              >
                Forgot your password?
              </button>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : mode === 'signup' ? 'Sign up' : mode === 'reset' ? 'Send reset email' : 'Sign in'}
            </button>
          </div>

          {mode !== 'reset' && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-black/50 text-gray-400">Or continue with</span>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full flex items-center justify-center px-4 py-2 border border-white/10 rounded-lg shadow-sm text-sm font-medium text-white bg-white/5 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign {mode === 'signup' ? 'up' : 'in'} with Google
                </button>
              </div>
            </>
          )}
        </form>
      </motion.div>
    </div>
  );
};

export default Auth;