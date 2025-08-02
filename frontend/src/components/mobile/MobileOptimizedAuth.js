import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMobileUI } from './MobileUIProvider';
import { 
  signUp, 
  signIn, 
  signInWithGoogle, 
  resetPassword, 
  handleAuthCallback as handleGoogleRedirectResult 
} from '../../utils/supabase-auth';
import {
  EnvelopeIcon,
  LockClosedIcon,
  UserIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowRightIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { getAuthToken } from '../../utils/auth-helpers';

const MobileOptimizedAuth = ({ onLogin, mode = 'signin' }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(mode === 'signup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { triggerHaptic } = useMobileUI();

  // Check for Google redirect result
  useEffect(() => {
    const checkRedirectResult = async () => {
      try {
        const result = await handleGoogleRedirectResult();
        if (result && result.user) {
          setLoading(true);
          setSuccess('Welcome back! 🎉');
          if (triggerHaptic) {
            triggerHaptic('success');
          }
          setTimeout(() => onLogin(result.user), 1000);
        }
      } catch (error) {
        console.error('Redirect error:', error);
      }
    };
    checkRedirectResult();
  }, [onLogin, triggerHaptic]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    triggerHaptic('light');

    try {
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

        setSuccess('Account created! Welcome to Digis! 🎉');
        triggerHaptic('success');
        setTimeout(() => onLogin(user), 1500);
      } else {
        const { user } = await signIn(email, password);
        setSuccess('Welcome back! 👋');
        triggerHaptic('success');
        setTimeout(() => onLogin(user), 1000);
      }
    } catch (error) {
      if (triggerHaptic) {
        triggerHaptic('error');
      }
      let errorMessage = error.message;
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    if (triggerHaptic) {
      triggerHaptic('light');
    }

    try {
      const result = await signInWithGoogle();
      
      if (!result) {
        // Mobile redirect flow
        setSuccess('Redirecting to Google...');
        return;
      }

      setSuccess('Signed in with Google! 🎉');
      triggerHaptic('success');
      setTimeout(() => onLogin(result.user), 1000);
    } catch (error) {
      if (triggerHaptic) {
        triggerHaptic('error');
      }
      setError('Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email first');
      triggerHaptic('warning');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email);
      setSuccess('Password reset email sent! 📧');
      triggerHaptic('success');
      setShowForgotPassword(false);
    } catch (error) {
      if (triggerHaptic) {
        triggerHaptic('error');
      }
      setError('Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && !email) {
      setError('Please enter your email');
      triggerHaptic('warning');
      return;
    }
    setCurrentStep(2);
    setError('');
    triggerHaptic('light');
  };

  const prevStep = () => {
    setCurrentStep(1);
    setError('');
    triggerHaptic('light');
  };

  const pageVariants = {
    enter: (direction) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction) => ({
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0
    })
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-50 to-pink-50">
      {/* Header */}
      <motion.div 
        className="px-6 py-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <img 
          src="/digis-logo-black.png" 
          alt="Digis" 
          className="h-10 mb-2"
        />
        <h1 className="text-2xl font-bold text-gray-900">
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h1>
        <p className="text-gray-600 mt-1">
          {isSignUp ? 'Join the creator economy' : 'Sign in to continue'}
        </p>
      </motion.div>

      {/* Form Container */}
      <div className="flex-1 px-6">
        <AnimatePresence mode="wait" custom={currentStep}>
          {/* Step 1: Email */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              custom={1}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'tween', duration: 0.3 }}
            >
              <form onSubmit={(e) => { e.preventDefault(); nextStep(); }}>
                <div className="space-y-4">
                  {/* Email Input */}
                  <div className="mobile-input-group">
                    <div className="relative">
                      <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mobile-input pl-12"
                        placeholder=" "
                        required
                        autoComplete="email"
                        inputMode="email"
                      />
                      <label className="mobile-input-label pl-12">Email Address</label>
                    </div>
                  </div>

                  {isSignUp && (
                    <div className="mobile-input-group">
                      <div className="relative">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="mobile-input pl-12"
                          placeholder=" "
                          autoComplete="username"
                        />
                        <label className="mobile-input-label pl-12">Username (optional)</label>
                      </div>
                    </div>
                  )}

                  {/* Continue Button */}
                  <motion.button
                    type="submit"
                    className="mobile-button w-full flex items-center justify-center gap-2"
                    whileTap={{ scale: 0.95 }}
                    disabled={loading}
                  >
                    Continue
                    <ArrowRightIcon className="w-4 h-4" />
                  </motion.button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Step 2: Password */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              custom={2}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'tween', duration: 0.3 }}
            >
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  {/* Back Button */}
                  <button
                    type="button"
                    onClick={prevStep}
                    className="flex items-center gap-2 text-gray-600 mb-4"
                  >
                    <ArrowLeftIcon className="w-4 h-4" />
                    {email}
                  </button>

                  {/* Password Input */}
                  <div className="mobile-input-group">
                    <div className="relative">
                      <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mobile-input pl-12 pr-12"
                        placeholder=" "
                        required
                        autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      />
                      <label className="mobile-input-label pl-12">Password</label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="w-5 h-5" />
                        ) : (
                          <EyeIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-purple-600 font-medium"
                    >
                      Forgot password?
                    </button>
                  )}

                  {/* Submit Button */}
                  <motion.button
                    type="submit"
                    className="mobile-button w-full"
                    whileTap={{ scale: 0.95 }}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <motion.div
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        />
                        {isSignUp ? 'Creating Account...' : 'Signing In...'}
                      </span>
                    ) : (
                      <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                    )}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error/Success Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
            >
              {error}
            </motion.div>
          )}
          
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm"
            >
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-gray-300" />
          <span className="text-sm text-gray-500">or</span>
          <div className="flex-1 h-px bg-gray-300" />
        </div>

        {/* Google Sign In */}
        <motion.button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border border-gray-300 rounded-full font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          whileTap={{ scale: 0.95 }}
          disabled={loading}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </motion.button>

        {/* Toggle Sign In/Up */}
        <div className="text-center mt-6">
          <span className="text-gray-600">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          </span>
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setCurrentStep(1);
              setError('');
              triggerHaptic('light');
            }}
            className="ml-2 text-purple-600 font-medium"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotPassword && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-end justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowForgotPassword(false)}
          >
            <motion.div
              className="bg-white rounded-t-3xl w-full max-w-lg p-6 pb-8"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
              
              <h3 className="text-xl font-semibold mb-2">Reset Password</h3>
              <p className="text-gray-600 mb-6">
                Enter your email and we'll send you a reset link
              </p>
              
              <div className="mobile-input-group mb-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mobile-input"
                  placeholder="Email address"
                  required
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowForgotPassword(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-full font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleForgotPassword}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-full font-medium"
                  disabled={loading}
                >
                  Send Reset Link
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileOptimizedAuth;