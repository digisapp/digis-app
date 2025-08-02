import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase-auth';

const SupabaseTestPage = () => {
  const [testResults, setTestResults] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkCurrentSession();
  }, []);

  const addResult = (test, success, message, details = null) => {
    setTestResults(prev => [...prev, { 
      test, 
      success, 
      message, 
      details,
      timestamp: new Date().toLocaleTimeString() 
    }]);
  };

  const checkCurrentSession = async () => {
    addResult('Check Session', null, 'Checking current session...');
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      if (session) {
        setCurrentUser(session.user);
        addResult('Check Session', true, 'Active session found', {
          email: session.user.email,
          id: session.user.id,
          expires: new Date(session.expires_at * 1000).toLocaleString()
        });
      } else {
        addResult('Check Session', true, 'No active session');
      }
    } catch (error) {
      addResult('Check Session', false, error.message);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    addResult('Connection Test', null, 'Testing Supabase connection...');
    
    try {
      // Test database connection
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (error) throw error;
      
      addResult('Connection Test', true, 'Successfully connected to Supabase database');
      
      // Test auth endpoint
      const { error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      
      addResult('Auth Test', true, 'Auth service is accessible');
    } catch (error) {
      addResult('Connection Test', false, error.message);
    } finally {
      setLoading(false);
    }
  };

  const testSignUp = async () => {
    if (!testEmail || !testPassword) {
      addResult('Sign Up Test', false, 'Please enter email and password');
      return;
    }

    setLoading(true);
    addResult('Sign Up Test', null, 'Attempting sign up...');
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
          data: {
            username: testEmail.split('@')[0],
            full_name: 'Test User'
          }
        }
      });

      if (error) throw error;

      addResult('Sign Up Test', true, 'Sign up successful!', {
        userId: data.user?.id,
        email: data.user?.email,
        emailConfirmed: data.user?.email_confirmed_at ? 'Yes' : 'No (check email)'
      });

      // If email confirmations are disabled, user will be automatically signed in
      if (data.session) {
        setCurrentUser(data.user);
        addResult('Auto Sign In', true, 'User was automatically signed in');
      }
    } catch (error) {
      addResult('Sign Up Test', false, error.message);
    } finally {
      setLoading(false);
    }
  };

  const testSignIn = async () => {
    if (!testEmail || !testPassword) {
      addResult('Sign In Test', false, 'Please enter email and password');
      return;
    }

    setLoading(true);
    addResult('Sign In Test', null, 'Attempting sign in...');
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword
      });

      if (error) throw error;

      setCurrentUser(data.user);
      addResult('Sign In Test', true, 'Sign in successful!', {
        userId: data.user?.id,
        email: data.user?.email,
        session: data.session ? 'Active' : 'None'
      });
    } catch (error) {
      addResult('Sign In Test', false, error.message);
    } finally {
      setLoading(false);
    }
  };

  const testSignOut = async () => {
    setLoading(true);
    addResult('Sign Out Test', null, 'Signing out...');
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setCurrentUser(null);
      addResult('Sign Out Test', true, 'Successfully signed out');
    } catch (error) {
      addResult('Sign Out Test', false, error.message);
    } finally {
      setLoading(false);
    }
  };

  const checkSupabaseSettings = () => {
    const config = {
      url: import.meta.env.VITE_SUPABASE_URL,
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      backendUrl: import.meta.env.VITE_BACKEND_URL
    };

    addResult('Config Check', true, 'Environment configuration', {
      supabaseUrl: config.url || 'NOT SET',
      anonKey: config.anonKey ? `${config.anonKey.substring(0, 20)}...` : 'NOT SET',
      backendUrl: config.backendUrl || 'NOT SET'
    });
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Supabase Authentication Test</h1>
        
        {/* Current User Status */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Status</h2>
          {currentUser ? (
            <div className="text-green-600">
              <p className="font-medium">Signed in as: {currentUser.email}</p>
              <p className="text-sm text-gray-600">User ID: {currentUser.id}</p>
            </div>
          ) : (
            <p className="text-gray-600">Not signed in</p>
          )}
        </div>

        {/* Test Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Email
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Password
              </label>
              <input
                type="password"
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                placeholder="password123"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={checkSupabaseSettings}
              disabled={loading}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
            >
              Check Config
            </button>
            <button
              onClick={testConnection}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Test Connection
            </button>
            <button
              onClick={testSignUp}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              Test Sign Up
            </button>
            <button
              onClick={testSignIn}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Test Sign In
            </button>
            <button
              onClick={testSignOut}
              disabled={loading || !currentUser}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              Test Sign Out
            </button>
            <button
              onClick={clearResults}
              className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500"
            >
              Clear Results
            </button>
          </div>
        </div>

        {/* Test Results */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>
          
          {testResults.length === 0 ? (
            <p className="text-gray-600">No tests run yet. Click a test button above to start.</p>
          ) : (
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    result.success === null 
                      ? 'bg-gray-50 border-gray-300'
                      : result.success 
                      ? 'bg-green-50 border-green-300' 
                      : 'bg-red-50 border-red-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {result.test}
                        <span className="text-xs text-gray-500 ml-2">
                          {result.timestamp}
                        </span>
                      </h3>
                      <p className={`text-sm mt-1 ${
                        result.success === null 
                          ? 'text-gray-600'
                          : result.success 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {result.message}
                      </p>
                      {result.details && (
                        <pre className="text-xs mt-2 p-2 bg-gray-100 rounded overflow-x-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      )}
                    </div>
                    <div className="ml-4">
                      {result.success === null ? (
                        <span className="text-gray-400">⏳</span>
                      ) : result.success ? (
                        <span className="text-green-500 text-xl">✅</span>
                      ) : (
                        <span className="text-red-500 text-xl">❌</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Testing Instructions:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Click "Check Config" to verify your environment variables are set</li>
            <li>Click "Test Connection" to verify Supabase is accessible</li>
            <li>Enter a test email and password, then click "Test Sign Up"</li>
            <li>If email confirmations are enabled, check your email and confirm</li>
            <li>Use the same credentials to "Test Sign In"</li>
            <li>Click "Test Sign Out" to test the logout functionality</li>
          </ol>
          
          <h3 className="font-semibold text-blue-900 mt-4 mb-2">Common Issues:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
            <li>Email confirmations: Check Supabase Dashboard → Authentication → Settings</li>
            <li>Password requirements: Minimum 6 characters by default</li>
            <li>Invalid email: Supabase might have email domain restrictions</li>
            <li>CORS errors: Make sure your site URL is in Supabase allowed URLs</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SupabaseTestPage;