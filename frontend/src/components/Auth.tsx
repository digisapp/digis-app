import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Auth() {
  const [params] = useSearchParams();
  const mode = params.get('mode') || 'signin';
  const { signInWithOtp } = useAuth();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get('email') as string;
    await signInWithOtp(email);
    alert('Magic link sent. Check your email.');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-pink-400 via-purple-500 to-indigo-600">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold">{mode === 'signup' ? 'Create account' : 'Sign in'}</h1>
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="w-full border rounded px-3 py-2"
        />
        <button className="w-full bg-black text-white rounded px-3 py-2 font-bold">
          {mode === 'signup' ? 'Sign up with email' : 'Send magic link'}
        </button>
        <div className="text-sm text-center">
          {mode === 'signup' ? (
            <Link to="/auth?mode=signin">Have an account? Sign in</Link>
          ) : (
            <Link to="/auth?mode=signup">New here? Create account</Link>
          )}
        </div>
      </form>
    </div>
  );
}
