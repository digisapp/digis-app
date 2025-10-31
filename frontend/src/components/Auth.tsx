import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Auth() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const mode = params.get('mode') || 'signin';
  const { signInWithOtp, signInWithPassword, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [usePassword, setUsePassword] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Handle magic link callback or errors
  useEffect(() => {
    const errorParam = params.get('error');
    const errorDesc = params.get('error_description');

    // Check for hash-based tokens (Supabase magic link default)
    const hash = window.location.hash;
    const hasTokens = hash.includes('access_token') || hash.includes('refresh_token');

    if (errorParam === 'access_denied' && errorDesc) {
      setError(decodeURIComponent(errorDesc.replace(/\+/g, ' ')));
    } else if (hasTokens) {
      // Show processing message while Supabase exchanges tokens
      setMessage('🔐 Processing authentication...');
      setLoading(true);
      // AuthContext will handle the token exchange via onAuthStateChange
      // and the user state will update, triggering the redirect above
    } else if (mode === 'callback') {
      setMessage('✅ Signed in successfully! Redirecting...');
      setTimeout(() => navigate('/dashboard'), 1000);
    }
  }, [params, mode, navigate]);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error: authError } = await signInWithOtp(email);

    setLoading(false);

    if (authError) {
      setError(authError.message || 'Failed to send magic link');
    } else {
      setMessage('📧 Magic link sent! Check your email (including spam folder)');
      setEmail('');
    }
  }

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error: authError } = await signInWithPassword(email, password);

    setLoading(false);

    if (authError) {
      setError(authError.message || 'Invalid credentials');
    } else {
      navigate('/dashboard');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-pink-400 via-purple-500 to-indigo-600">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">
          {mode === 'signup' ? 'Create account' : 'Welcome back'}
        </h1>
        <p className="text-gray-600 mb-6">
          {mode === 'signup' ? 'Join Digis and connect with creators' : 'Sign in to continue'}
        </p>

        {/* Success message */}
        {message && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            {message}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}

        {/* Auth toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setUsePassword(false)}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              !usePassword
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Magic Link
          </button>
          <button
            onClick={() => setUsePassword(true)}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              usePassword
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Password
          </button>
        </div>

        {/* Magic Link Form */}
        {!usePassword && (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 text-white rounded-lg px-4 py-3 font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Sending...' : '✉️ Send magic link'}
            </button>
          </form>
        )}

        {/* Password Form */}
        {usePassword && (
          <form onSubmit={handlePasswordSignIn} className="space-y-4">
            <div>
              <label htmlFor="email-pwd" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email-pwd"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 text-white rounded-lg px-4 py-3 font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-600">
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <Link to="/auth?mode=signin" className="text-purple-600 hover:text-purple-700 font-medium">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New to Digis?{' '}
              <Link to="/auth?mode=signup" className="text-purple-600 hover:text-purple-700 font-medium">
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
