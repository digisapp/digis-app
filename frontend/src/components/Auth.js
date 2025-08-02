import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  signIn, 
  signUp, 
  resetPassword,
  getCurrentUser 
} from '../utils/supabase-auth';
import { AppContext } from '../contexts/AppContext';
import api from '../services/api';
import {
  EnvelopeIcon,
  LockClosedIcon,
  UserIcon,
  SparklesIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  UserGroupIcon,
  StarIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

const Auth = ({ mode: initialMode = 'signin', onModeSwitch }) => {
  const [searchParams] = useSearchParams();
  const typeFromUrl = searchParams.get('type');
  const modeFromUrl = searchParams.get('mode');
  
  const [mode, setMode] = useState(modeFromUrl || initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [accountType, setAccountType] = useState(typeFromUrl || 'fan'); // 'fan' or 'creator'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [displayNameFocused, setDisplayNameFocused] = useState(false);
  
  const navigate = useNavigate();
  const { setUser, setIsAuthenticated } = useContext(AppContext);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (onModeSwitch) {
      onModeSwitch(mode);
    }
  }, [mode, onModeSwitch]);

  const checkAuth = async () => {
    const { user } = await getCurrentUser();
    if (user) {
      await handleSuccessfulAuth(user);
    }
  };

  const handleSuccessfulAuth = async (user) => {
    try {
      const response = await api.auth.syncUser({
        supabaseId: user.id,
        email: user.email,
        metadata: user.user_metadata
      });

      const userData = response.data.user;
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userEmail', user.email);

      if (userData.is_creator) {
        navigate('/creator-studio');
      } else if (userData.username) {
        navigate('/discover');
      } else {
        navigate('/onboarding');
      }
    } catch (error) {
      console.error('Error syncing user:', error);
      
      // More detailed error handling
      if (error.response?.data?.message) {
        setError(`Authentication error: ${error.response.data.message}`);
      } else if (error.message) {
        setError(`Authentication error: ${error.message}`);
      } else {
        setError('Failed to complete authentication. Please try again.');
      }
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
          username: accountType === 'creator' ? username.toLowerCase().replace(/[^a-z0-9_]/g, '') : undefined,
          display_name: displayName || username,
          account_type: accountType,
          created_from: 'web'
        });

        if (error) throw error;

        if (user) {
          console.log('Sign up successful, user:', user);
          // For Supabase, if email confirmation is not required, we can sign in directly
          if (user.email_confirmed_at || user.confirmed_at) {
            await handleSuccessfulAuth(user);
          } else {
            if (accountType === 'creator') {
              // setSuccessMessage('Creator application submitted! You will receive an email once your application is reviewed.');
            } else {
              // setSuccessMessage('Welcome to Digis! Please check your email to verify your account.');
            }
          }
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
        // setSuccessMessage('Password reset email sent! Check your inbox.');
        setTimeout(() => {
          setMode('signin');
          // setSuccessMessage('');
        }, 3000);
      }
    } catch (error) {
      console.error('Auth error:', error);
      
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


  const validateUsername = (value) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleaned !== value) {
      setUsername(cleaned);
    } else {
      setUsername(value);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccessMessage('');
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-96 h-96 bg-yellow-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative min-h-screen flex items-center justify-center py-8 px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-3xl space-y-8"
        >
          {/* Logo/Brand */}
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <Link to="/" className="flex justify-center items-center mb-4 group">
              <div className="p-3 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl shadow-2xl group-hover:shadow-purple-500/50 transition-all">
                <SparklesIcon className="h-12 w-12 text-white" />
              </div>
              <span className="ml-3 text-3xl font-bold text-white">Digis</span>
            </Link>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2">
              {mode === 'signup' ? 'Join Digis' : 
               mode === 'reset' ? 'Reset Password' : 
               'Welcome Back'}
            </h2>
            <p className="text-sm md:text-base lg:text-lg text-gray-300">
              {mode === 'signup' ? 'Create your account and start connecting' : 
               mode === 'reset' ? 'We\'ll send you a reset link' : 
               'Sign in to continue to your account'}
            </p>
          </motion.div>

          {/* Form Card */}
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/10 backdrop-blur-xl p-8 lg:p-10 xl:p-12 rounded-3xl shadow-2xl border border-white/20"
          >
            {/* Alerts */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 bg-red-500/20 border border-red-500/50 backdrop-blur-sm rounded-xl p-4 flex items-start"
                >
                  <ExclamationCircleIcon className="h-5 w-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                  <p className="text-red-200 text-sm">{error}</p>
                </motion.div>
              )}

              {/* {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 bg-green-500/20 border border-green-500/50 backdrop-blur-sm rounded-xl p-4 flex items-start"
                >
                  <CheckCircleIcon className="h-5 w-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <p className="text-green-200 text-sm">{successMessage}</p>
                </motion.div>
              )} */}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Account type selection for signup */}
              <AnimatePresence>
                {mode === 'signup' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                  >
                    {/* Account Type Selection */}
                    <div className="space-y-4">
                      <label className="text-base font-medium text-gray-200 block">Choose your journey:</label>
                      <div className="grid grid-cols-2 gap-4">
                        <motion.button
                          type="button"
                          onClick={() => setAccountType('fan')}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`relative p-6 rounded-2xl border-2 transition-all ${
                            accountType === 'fan'
                              ? 'border-purple-400 bg-gradient-to-br from-purple-500/30 to-purple-600/20 text-white shadow-lg shadow-purple-500/20'
                              : 'border-white/20 bg-white/5 text-gray-300 hover:border-purple-300/50 hover:bg-white/10'
                          }`}
                        >
                          <UserGroupIcon className="h-8 w-8 mb-3 mx-auto" />
                          <div className="text-lg font-bold mb-1">Join as Fan</div>
                          <div className="text-xs opacity-90">Connect & support creators</div>
                          {accountType === 'fan' && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -top-2 -right-2 bg-purple-500 rounded-full p-1"
                            >
                              <CheckIcon className="h-4 w-4 text-white" />
                            </motion.div>
                          )}
                        </motion.button>
                        <motion.button
                          type="button"
                          onClick={() => setAccountType('creator')}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`relative p-6 rounded-2xl border-2 transition-all ${
                            accountType === 'creator'
                              ? 'border-pink-400 bg-gradient-to-br from-pink-500/30 to-pink-600/20 text-white shadow-lg shadow-pink-500/20'
                              : 'border-white/20 bg-white/5 text-gray-300 hover:border-pink-300/50 hover:bg-white/10'
                          }`}
                        >
                          <StarIcon className="h-8 w-8 mb-3 mx-auto" />
                          <div className="text-lg font-bold mb-1">Apply as Creator</div>
                          <div className="text-xs opacity-90">Create & monetize</div>
                          {accountType === 'creator' && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -top-2 -right-2 bg-pink-500 rounded-full p-1"
                            >
                              <CheckIcon className="h-4 w-4 text-white" />
                            </motion.div>
                          )}
                        </motion.button>
                      </div>
                      {accountType === 'creator' && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="text-xs text-amber-300/80 text-center bg-amber-500/10 rounded-lg p-2"
                        >
                          ✨ Creator applications are reviewed within 24 hours
                        </motion.p>
                      )}
                    </div>

                    {/* Username field only for creators */}
                    {accountType === 'creator' && (
                      <div className="relative">
                        <div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors ${
                          usernameFocused ? 'text-purple-400' : 'text-gray-400'
                        }`}>
                          <UserIcon className="h-5 w-5" />
                        </div>
                        <input
                          id="username"
                          name="username"
                          type="text"
                          required={accountType === 'creator'}
                          value={username}
                          onChange={(e) => validateUsername(e.target.value)}
                          onFocus={() => setUsernameFocused(true)}
                          onBlur={() => setUsernameFocused(false)}
                          className="block w-full pl-10 pr-3 py-3 md:py-4 bg-white/5 border border-white/10 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm md:text-base"
                          placeholder="Choose your username"
                          pattern="[a-z0-9_]+"
                          title="Username can only contain lowercase letters, numbers, and underscores"
                        />
                        <p className="mt-2 text-xs text-gray-400 ml-10">
                          This will be your unique creator handle
                        </p>
                      </div>
                    )}

                    <div className="relative">
                      <div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors ${
                        displayNameFocused ? 'text-purple-400' : 'text-gray-400'
                      }`}>
                        <SparklesIcon className="h-5 w-5" />
                      </div>
                      <input
                        id="displayName"
                        name="displayName"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        onFocus={() => setDisplayNameFocused(true)}
                        onBlur={() => setDisplayNameFocused(false)}
                        className="block w-full pl-10 pr-3 py-3 md:py-4 bg-white/5 border border-white/10 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm md:text-base"
                        placeholder="Display name (optional)"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email field */}
              <div className="relative">
                <div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors ${
                  emailFocused ? 'text-purple-400' : 'text-gray-400'
                }`}>
                  <EnvelopeIcon className="h-5 w-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  className="block w-full pl-10 pr-3 py-3 bg-white/5 border border-white/10 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="Email address"
                />
              </div>

              {/* Password field */}
              <AnimatePresence>
                {mode !== 'reset' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="relative"
                  >
                    <div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors ${
                      passwordFocused ? 'text-purple-400' : 'text-gray-400'
                    }`}>
                      <LockClosedIcon className="h-5 w-5" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      className="block w-full pl-10 pr-3 py-3 bg-white/5 border border-white/10 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      placeholder="Password"
                      minLength="6"
                    />
                    {mode === 'signup' && (
                      <p className="mt-2 text-xs text-gray-400 ml-10">
                        At least 6 characters
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Forgot password link */}
              {mode === 'signin' && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => switchMode('reset')}
                    className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Submit button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="relative w-full flex justify-center items-center py-3 md:py-4 px-4 border border-transparent text-base md:text-lg font-medium rounded-xl text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 opacity-0 group-hover:opacity-20 transition-opacity"></span>
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <>
                    <span>{mode === 'signup' ? 'Create Account' : mode === 'reset' ? 'Send Reset Link' : 'Sign In'}</span>
                    <ArrowRightIcon className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </motion.button>

            </form>

            {/* Mode switch */}
            <div className="mt-6 text-center">
              {mode === 'signup' ? (
                <p className="text-sm text-gray-300">
                  Already have an account?{' '}
                  <button
                    onClick={() => switchMode('signin')}
                    className="font-medium text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Sign in
                  </button>
                </p>
              ) : mode === 'signin' ? (
                <p className="text-sm text-gray-300">
                  Don't have an account?{' '}
                  <button
                    onClick={() => switchMode('signup')}
                    className="font-medium text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Sign up
                  </button>
                </p>
              ) : (
                <button
                  onClick={() => switchMode('signin')}
                  className="text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Back to sign in
                </button>
              )}
            </div>
          </motion.div>

          {/* Terms and Privacy */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-xs text-gray-400"
          >
            By continuing, you agree to our{' '}
            <Link to="/terms" className="text-purple-400 hover:text-purple-300">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-purple-400 hover:text-purple-300">
              Privacy Policy
            </Link>
          </motion.p>
        </motion.div>
      </div>

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

export default Auth;