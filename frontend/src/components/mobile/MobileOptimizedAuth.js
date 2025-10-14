import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMobileUI } from './MobileUIProvider';
import {
  signUp,
  signIn,
  resetPassword
} from '../../utils/supabase-auth';
import {
  EnvelopeIcon,
  LockClosedIcon,
  UserIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import { getAuthToken } from '../../utils/auth-helpers';
import api from '../../services/api';

const MobileOptimizedAuth = ({ onLogin, mode = 'signin', onClose }) => {
  const navigate = useNavigate();
  console.log('🟡 MobileOptimizedAuth rendered with mode:', mode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(mode === 'signup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const mobileContext = useMobileUI();
  const triggerHaptic = mobileContext?.triggerHaptic || (() => {});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (triggerHaptic) triggerHaptic('light');

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

        // Sync with backend to get full user data
        await syncUserData(user);
        
        setSuccess('Account created! Welcome to Digis! 🎉');
        if (triggerHaptic) triggerHaptic('success');
      } else {
        const { user } = await signIn(email, password);
        
        // Sync with backend to get full user data including creator status
        await syncUserData(user);
        
        setSuccess('Signed in successfully! 👋');
        if (triggerHaptic) triggerHaptic('success');
      }
    } catch (error) {
      if (triggerHaptic) triggerHaptic('error');
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

  // Sync user data with backend to get role and creator status
  const syncUserData = async (user) => {
    try {
      console.log('🔄 Syncing user data for mobile auth...', {
        userId: user.id,
        email: user.email,
        metadata: user.user_metadata
      });
      
      const response = await api.auth.syncUser({
        supabaseId: user.id,
        email: user.email,
        metadata: user.user_metadata
      });
      
      const userData = response.data.user;
      
      console.log('📱 Mobile user data synced - FULL RESPONSE:', userData);
      console.log('📱 Mobile user data synced - DETAILS:', {
        email: userData.email,
        is_creator: userData.is_creator,
        is_super_admin: userData.is_super_admin,
        role: userData.role,
        username: userData.username,
        creator_type: userData.creator_type
      });
      
      // Store role in localStorage for faster initial load
      const isCreatorUser = userData.is_creator === true || userData.creator_type !== null;
      const isAdminUser = userData.is_super_admin === true || userData.role === 'admin';
      
      localStorage.setItem('userRole', isAdminUser ? 'admin' : isCreatorUser ? 'creator' : 'fan');
      localStorage.setItem('userIsCreator', isCreatorUser ? 'true' : 'false');
      localStorage.setItem('userIsAdmin', isAdminUser ? 'true' : 'false');
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userEmail', user.email);
      
      console.log('📱 Mobile localStorage updated:', {
        userRole: localStorage.getItem('userRole'),
        userIsCreator: localStorage.getItem('userIsCreator'),
        userIsAdmin: localStorage.getItem('userIsAdmin')
      });
      
      // Pass the full user data to the parent component
      const fullUserData = {
        ...user,
        ...userData,
        is_creator: userData.is_creator,
        is_super_admin: userData.is_super_admin,
        role: userData.role,
        profile: userData
      };
      
      console.log('📱 Passing to onLogin:', fullUserData);

      // Call onLogin with full data - let PARENT handle navigation
      if (onLogin) {
        onLogin(fullUserData);
      }

      // REMOVED: Redundant navigate() call
      // Parent (App.js) will handle navigation based on AuthContext state
      // This prevents double-navigation flicker
      
    } catch (error) {
      console.error('❌ Error syncing mobile user data:', error);
      console.error('Error details:', error.response?.data || error.message);
      
      // If sync fails, still proceed with basic user data
      setTimeout(() => {
        if (onLogin) {
          onLogin(user);
        }
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 px-6">
      {/* Logo */}
      <div className="mb-8">
        <img 
          src="/digis-logo-black.png" 
          alt="Digis" 
          className="h-12"
        />
      </div>

      {/* Form Container */}
      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div className="relative">
            <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
              placeholder="Email"
              required
              autoComplete="email"
            />
          </div>

          {/* Username field for signup */}
          {isSignUp && (
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
                placeholder="Username (optional)"
                autoComplete="username"
              />
            </div>
          )}

          {/* Password Input */}
          <div className="relative">
            <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-12 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
              placeholder="Password"
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength="6"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeSlashIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-2xl hover:from-purple-700 hover:to-pink-700 transition-colors disabled:opacity-50"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
                />
                {isSignUp ? 'Creating Account...' : 'Signing In...'}
              </span>
            ) : (
              <span>{isSignUp ? 'Sign Up' : 'Sign In'}</span>
            )}
          </button>
        </form>

        {/* Error/Success Messages */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-center">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm text-center">
            {success}
          </div>
        )}

        {/* Toggle Sign In/Up */}
        <div className="text-center mt-6">
          <span className="text-gray-600 text-sm">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          </span>
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
              setSuccess('');
              triggerHaptic('light');
            }}
            className="ml-2 text-purple-600 font-medium text-sm"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileOptimizedAuth;