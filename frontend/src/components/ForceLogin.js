import React, { useEffect } from 'react';
import { supabase } from '../utils/supabase-auth.js';

const ForceLogin = () => {
  useEffect(() => {
    // Check current auth state
    const checkAuth = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (currentUser) {
        console.log('User is already logged in:', currentUser.email);
        // Force redirect to dashboard
        window.location.href = '/dashboard';
      } else {
        console.log('No user logged in');
        // Clear any stuck state
        localStorage.clear();
        sessionStorage.clear();
        // Redirect to login
        window.location.href = '/';
      }
    };
    
    checkAuth();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">Authentication Check</h1>
        
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded">
            <p className="text-sm">Authentication Check in Progress...</p>
          </div>
          
          <button
            onClick={() => {
              localStorage.clear();
              sessionStorage.clear();
              window.location.href = '/';
            }}
            className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Clear All Data & Restart
          </button>
          
          <button
            onClick={() => {
              window.location.href = '/dashboard';
            }}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Force Go to Dashboard
          </button>
          
          <button
            onClick={async () => {
              try {
                // Try to sign in with test credentials
                await supabase.auth.signInWithPassword({ email: 'test@example.com', password: 'password123' });
                window.location.href = '/dashboard';
              } catch (error) {
                console.error('Login failed:', error);
                alert('Please use your own credentials to log in');
              }
            }}
            className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Quick Test Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForceLogin;