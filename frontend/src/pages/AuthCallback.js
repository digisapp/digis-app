import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleAuthCallback } from '../utils/supabase-auth';
import api from '../services/api-hybrid';
import { AppContext } from '../contexts/AppContext';

const AuthCallback = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { setUser, setIsAuthenticated } = React.useContext(AppContext);

  const handleCallback = useCallback(async () => {
    try {
      // Handle the OAuth callback
      const { session, error: callbackError } = await handleAuthCallback();

      if (callbackError) {
        throw callbackError;
      }

      if (!session) {
        throw new Error('No session returned from callback');
      }

      // Sync with backend
      const response = await api.auth.syncUser({
        supabaseId: session.user.id,
        email: session.user.email,
        metadata: session.user.user_metadata
      });

      const userData = response.data.user;

      // Update app context
      setUser(userData);
      setIsAuthenticated(true);

      // Store auth info
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userEmail', session.user.email);

      // Navigate based on user type
      if (userData.is_creator) {
        navigate('/creator-studio');
      } else if (userData.username) {
        navigate('/discover');
      } else {
        navigate('/onboarding');
      }
    } catch (error) {
      console.error('Auth callback error:', error);
      setError(error.message || 'Failed to complete authentication');
      
      // Redirect to login after delay
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } finally {
      setLoading(false);
    }
  }, [navigate, setUser, setIsAuthenticated]);

  useEffect(() => {
    handleCallback();
  }, [handleCallback]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-pink-900 to-red-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Completing authentication...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-pink-900 to-red-900">
        <div className="max-w-md w-full bg-black/50 backdrop-blur-xl p-8 rounded-2xl border border-white/10 text-center">
          <div className="text-red-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Authentication Failed</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <p className="text-sm text-gray-400">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthCallback;