import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  signIn, 
  signUp, 
  resetPassword,
  getCurrentUser,
  signInWithGoogle,
  signInWithTwitter
} from '../utils/supabase-auth-enhanced';
import { analytics, observability } from '../utils/supabase-client-v2';
// import { useAuthActions, useUser, useIsCreator, useIsAdmin } from '../stores/useHybridStore'; // Temporarily disabled due to infinite loop
import api from '../services/api';
import toast from 'react-hot-toast';
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
  CheckIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';

// Last updated: 2025-09-26 19:55 - Logo size reduced to h-8, added pt-8 padding
const Auth = ({ mode: initialMode = 'signin', onModeSwitch, onLogin }) => {
  const [searchParams] = useSearchParams();
  const typeFromUrl = searchParams.get('type');
  const modeFromUrl = searchParams.get('mode');
  
  // Local UI state with useState - form inputs and UI toggles
  const [mode, setMode] = useState(modeFromUrl || initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [accountType, setAccountType] = useState(typeFromUrl || 'fan'); // 'fan' or 'creator'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const navigate = useNavigate();
  
  // Temporarily not using store due to infinite loop issue
  // const { setUser, setProfile, setTokenBalance } = useAuthActions();
  // const user = useUser();
  // const isCreator = useIsCreator();
  // const isAdmin = useIsAdmin();
  
  // Use local state for now
  const user = null;
  const isCreator = false;
  const isAdmin = false;

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
      // Try to sync with backend, but don't fail if backend is down
      let userData = null;
      try {
        const response = await api.auth.syncUser({
          supabaseId: user.id,
          email: user.email,
          metadata: user.user_metadata
        });
        userData = response.data.user;
      } catch (backendError) {
        console.warn('Backend sync failed, using Supabase data only:', backendError);
        // Use Supabase user data as fallback
        userData = {
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username || user.email?.split('@')[0],
          is_creator: user.user_metadata?.is_creator || false,
          is_super_admin: user.user_metadata?.is_super_admin || false,
          role: user.user_metadata?.role || 'user',
          token_balance: 0
        };
      }

      const finalUserData = userData || user;
      
      // Log user data for debugging
      console.log('🖥️ Desktop User data after login:', {
        email: finalUserData.email,
        is_creator: finalUserData.is_creator,
        is_super_admin: finalUserData.is_super_admin,
        role: finalUserData.role,
        username: finalUserData.username,
        creator_type: finalUserData.creator_type
      });
      
      // NO localStorage writes for roles - AuthContext is single source of truth
      // Only store authentication status for quicker boot detection
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userEmail', user.email);

      // Call the parent's onLogin callback with full user data
      if (onLogin) {
        const fullUserData = {
          ...user,
          ...finalUserData,
          is_creator: finalUserData.is_creator,
          is_super_admin: finalUserData.is_super_admin,
          role: finalUserData.role,
          profile: finalUserData
        };
        console.log('🖥️ Desktop: Calling onLogin with:', fullUserData);

        // CRITICAL: Let the parent (App.js) handle navigation after state is fully set
        // This ensures the role state is updated before navigation occurs
        await onLogin(fullUserData);
      }

      // Navigation is now handled by parent's onLogin callback
      // This prevents race conditions where navigation happens before state updates complete
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
        // Check age verification
        if (!ageVerified) {
          setError('You must be 18 or older to join Digis');
          setLoading(false);
          return;
        }

        // Validate date of birth if provided
        if (dateOfBirth) {
          const birthDate = new Date(dateOfBirth);
          const today = new Date();
          const age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
          
          if (age < 18) {
            setError('You must be 18 or older to join Digis');
            setLoading(false);
            return;
          }
        }

        // Track signup attempt
        analytics.trackEvent('signup_attempt', {
          account_type: accountType,
          method: 'email'
        });
        
        const { user, error } = await signUp(email, password, {
          username: username.toLowerCase().replace(/[^a-z0-9_]/g, ''), // Now required for both fans and creators
          account_type: accountType,
          created_from: 'web',
          date_of_birth: dateOfBirth,
          age_verified: ageVerified
        });

        if (error) throw error;

        if (user) {
          console.log('Sign up successful, user:', user);
          
          // Track successful signup
          analytics.trackEvent('signup_success', {
            account_type: accountType,
            user_id: user.id,
            method: 'email'
          });
          
          // For Supabase, if email confirmation is not required, we can sign in directly
          if (user.email_confirmed_at || user.confirmed_at) {
            await handleSuccessfulAuth(user);
          } else {
            if (accountType === 'creator') {
              setSuccessMessage('Creator application submitted! You will receive an email once your application is reviewed.');
              toast.success('Creator application submitted! You will receive an email once your application is reviewed.');
            } else {
              setSuccessMessage('Welcome to Digis! Please check your email to verify your account.');
              toast.success('Welcome to Digis! Please check your email to verify your account.');
            }
          }
        }
      } else if (mode === 'signin') {
        // Track signin attempt
        analytics.trackEvent('signin_attempt', { method: 'email' });
        
        const { user, error } = await signIn(email, password);
        if (error) throw error;
        if (user) {
          // Track successful signin
          analytics.trackEvent('signin_success', {
            user_id: user.id,
            method: 'email'
          });
          await handleSuccessfulAuth(user);
        }
      } else if (mode === 'reset') {
        // Track password reset request
        analytics.trackEvent('password_reset_request', { email });
        
        const { error } = await resetPassword(email);
        if (error) throw error;
        setSuccessMessage('Password reset email sent! Check your inbox.');
        toast.success('Password reset email sent! Check your inbox.');
        setTimeout(() => {
          setMode('signin');
          setSuccessMessage('');
        }, 3000);
      }
    } catch (error) {
      console.error('Auth error:', error);
      
      // Track auth errors for monitoring
      observability.trackError(error, {
        mode,
        account_type: accountType
      });
      
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
    
    // Check username availability after a delay
    if (cleaned.length >= 3) {
      checkUsernameAvailability(cleaned);
    } else {
      setUsernameAvailable(null);
    }
  };

  const checkUsernameAvailability = async (usernameToCheck) => {
    if (usernameToCheck.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    
    setCheckingUsername(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/check-username/${usernameToCheck}`);
      const data = await response.json();
      setUsernameAvailable(data.available);
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleOAuth = async (provider) => {
    setLoading(true);
    setError('');
    try {
      const { error } = provider === 'google' 
        ? await signInWithGoogle() 
        : await signInWithTwitter();
      
      if (error) throw error;
      
      // OAuth will redirect, so we show a loading state
      toast.success(`Redirecting to ${provider === 'google' ? 'Google' : 'Twitter/X'} for authentication...`);
    } catch (error) {
      console.error(`${provider} OAuth error:`, error);
      setError(error.message || `${provider === 'google' ? 'Google' : 'Twitter/X'} sign-in failed`);
      toast.error(error.message || 'OAuth sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccessMessage('');
  };

  return (
    <div className="fixed inset-0 w-full h-screen overflow-hidden bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900">
      {/* Animated background with full coverage */}
      <div className="absolute inset-0 w-full h-full">
        {/* Top left blob - larger and more spread */}
        <div className="absolute -top-20 -left-20 w-96 h-96 md:w-[40rem] md:h-[40rem] lg:w-[50rem] lg:h-[50rem] bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob"></div>
        
        {/* Top right blob - larger and more spread */}
        <div className="absolute -top-20 -right-20 w-96 h-96 md:w-[40rem] md:h-[40rem] lg:w-[50rem] lg:h-[50rem] bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000"></div>
        
        {/* Bottom left blob - larger and more spread */}
        <div className="absolute -bottom-20 -left-20 w-96 h-96 md:w-[40rem] md:h-[40rem] lg:w-[50rem] lg:h-[50rem] bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-4000"></div>
        
        {/* Bottom right blob - larger and more spread */}
        <div className="absolute -bottom-20 -right-20 w-96 h-96 md:w-[40rem] md:h-[40rem] lg:w-[50rem] lg:h-[50rem] bg-violet-600 rounded-full mix-blend-multiply filter blur-3xl opacity-35 animate-blob animation-delay-2000"></div>
        
        {/* Center blob for more coverage */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[35rem] h-[35rem] md:w-[45rem] md:h-[45rem] lg:w-[60rem] lg:h-[60rem] bg-fuchsia-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        
        {/* Additional desktop blobs for extra richness */}
        <div className="hidden lg:block absolute top-1/4 left-1/4 w-[35rem] h-[35rem] bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-25 animate-blob"></div>
        <div className="hidden lg:block absolute bottom-1/4 right-1/4 w-[35rem] h-[35rem] bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-25 animate-blob animation-delay-2000"></div>
      </div>

      <div className="relative z-10 w-full h-full overflow-y-auto flex items-center justify-center p-4 sm:p-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md lg:max-w-xl space-y-6 pt-8 sm:pt-0"
        >
          {/* Logo/Brand */}
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <Link to="/" className="flex justify-center items-center mb-6 group">
              <img
                src="/digis-logo-white.png"
                alt="Digis"
                className="h-12 sm:h-14 md:h-16 lg:h-20 w-auto hover:scale-105 transition-transform duration-200"
              />
            </Link>
            {mode === 'reset' && (
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white">Reset Password</h2>
                <p className="text-sm text-gray-300">
                  We'll send you a reset link
                </p>
              </div>
            )}
          </motion.div>

          {/* Form Card */}
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/10 backdrop-blur-xl p-6 sm:p-8 lg:p-10 rounded-3xl shadow-2xl border border-white/20"
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

            <form onSubmit={handleSubmit} className="space-y-5">
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
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <motion.button
                          type="button"
                          onClick={() => setAccountType('fan')}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`relative p-4 rounded-xl border-2 transition-all ${
                            accountType === 'fan'
                              ? 'border-purple-400 bg-gradient-to-br from-purple-500/30 to-purple-600/20 text-white shadow-lg shadow-purple-500/20'
                              : 'border-white/20 bg-white/5 text-gray-300 hover:border-purple-300/50 hover:bg-white/10'
                          }`}
                        >
                          <UserGroupIcon className="h-6 w-6 mb-2 mx-auto" />
                          <div className="text-sm font-semibold">Join as Fan</div>
                          <div className="text-xs opacity-80 mt-1">Connect & support</div>
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
                          className={`relative p-4 rounded-xl border-2 transition-all ${
                            accountType === 'creator'
                              ? 'border-pink-400 bg-gradient-to-br from-pink-500/30 to-pink-600/20 text-white shadow-lg shadow-pink-500/20'
                              : 'border-white/20 bg-white/5 text-gray-300 hover:border-pink-300/50 hover:bg-white/10'
                          }`}
                        >
                          <StarIcon className="h-6 w-6 mb-2 mx-auto" />
                          <div className="text-sm font-semibold">Apply as Creator</div>
                          <div className="text-xs opacity-80 mt-1">Create & monetize</div>
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

                    {/* Username field for both fans and creators */}
                    <div>
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
                          required
                          value={username}
                          onChange={(e) => validateUsername(e.target.value)}
                          onFocus={() => setUsernameFocused(true)}
                          onBlur={() => setUsernameFocused(false)}
                          className={`block w-full pl-10 pr-10 py-3 bg-white/5 border ${
                            username.length >= 3 && usernameAvailable === false 
                              ? 'border-red-500/50' 
                              : username.length >= 3 && usernameAvailable === true 
                              ? 'border-green-500/50' 
                              : 'border-white/10'
                          } text-white placeholder-gray-400 rounded-lg focus:outline-none transition-all text-sm sm:text-base`}
                          placeholder="Username"
                          pattern="[a-z0-9_]+"
                          title="Username can only contain lowercase letters, numbers, and underscores"
                        />
                        {/* Username availability indicator */}
                        {username.length >= 3 && (
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            {checkingUsername ? (
                              <div className="animate-spin h-5 w-5 border-2 border-purple-500 border-t-transparent rounded-full" />
                            ) : usernameAvailable === true ? (
                              <CheckCircleIcon className="h-5 w-5 text-green-400" />
                            ) : usernameAvailable === false ? (
                              <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
                            ) : null}
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-gray-400 ml-10">
                        {username.length >= 3 && usernameAvailable === false 
                          ? 'This username is already taken' 
                          : username.length >= 3 && usernameAvailable === true 
                          ? 'Username is available!' 
                          : accountType === 'creator' 
                          ? 'This will be your unique creator handle' 
                          : 'Your unique username on Digis'}
                      </p>
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
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  className="mobile-input block w-full pl-10 pr-3 py-3 sm:py-3.5 bg-white/5 border border-white/10 text-white placeholder-gray-400 rounded-lg focus:outline-none transition-all text-sm sm:text-base"
                  placeholder="Email"
                />
              </div>

              {/* Password field */}
              <AnimatePresence>
                {mode !== 'reset' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <div className="relative">
                      <div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors ${
                        passwordFocused ? 'text-purple-400' : 'text-gray-400'
                      }`}>
                        <LockClosedIcon className="h-5 w-5" />
                      </div>
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(false)}
                        className="block w-full pl-10 pr-12 py-3 sm:py-3.5 bg-white/5 border border-white/10 text-white placeholder-gray-400 rounded-lg focus:outline-none transition-all text-sm sm:text-base"
                        placeholder="Password"
                        minLength="6"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-purple-400 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {mode === 'signup' && (
                      <p className="text-xs text-gray-400 ml-10">
                        At least 6 characters
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Age Verification for Signup */}
              {mode === 'signup' && (
                <>
                  {/* Date of Birth field */}
                  <div className="relative">
                    <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-300 mb-2">
                      Date of Birth
                    </label>
                    <input
                      id="dateOfBirth"
                      name="dateOfBirth"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="block w-full px-3 py-3 bg-white/5 border border-white/10 text-white placeholder-gray-400 rounded-lg focus:outline-none transition-all text-sm"
                    />
                  </div>

                  {/* Age Verification Checkbox */}
                  <div className="flex items-start">
                    <div className="flex items-center h-5 mt-1">
                      <input
                        id="ageVerification"
                        name="ageVerification"
                        type="checkbox"
                        checked={ageVerified}
                        onChange={(e) => setAgeVerified(e.target.checked)}
                        className="w-4 h-4 text-purple-600 bg-white/10 border-gray-300 rounded"
                        required
                      />
                    </div>
                    <div className="ml-3">
                      <label htmlFor="ageVerification" className="text-sm text-gray-300">
                        I confirm that I am 18 years or older and agree to the{' '}
                        <Link to="/terms" className="text-purple-400 hover:text-purple-300 underline">
                          Terms of Service
                        </Link>{' '}
                        and{' '}
                        <Link to="/privacy" className="text-purple-400 hover:text-purple-300 underline">
                          Privacy Policy
                        </Link>
                      </label>
                      {!ageVerified && error && error.includes('18') && (
                        <p className="mt-1 text-xs text-red-400">
                          You must confirm you are 18 or older to continue
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Remember me and Forgot password for sign in */}
              {mode === 'signin' && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="h-4 w-4 text-purple-600 bg-white/10 border-gray-300 rounded"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-300">
                      Remember me
                    </label>
                  </div>
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
                className="relative w-full flex justify-center items-center py-3.5 sm:py-4 px-4 border border-transparent text-sm sm:text-base font-semibold rounded-xl text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 focus:outline-none shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group"
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