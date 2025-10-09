/**
 * Main app entry point with Sentry integration
 * @module main.sentry
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { initSentry, ErrorBoundary } from './utils/sentry';
import App from './App';
import './index.css';

// Initialize Sentry before app loads
initSentry();

// Custom error fallback component
const ErrorFallback = ({ error, resetError }: { error: unknown; resetError: () => void }) => {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  return (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-gray-800 rounded-lg p-6 text-center">
      <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      
      <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
      <p className="text-gray-400 mb-4">
        We've been notified and are working to fix the issue.
      </p>
      
      {process.env.NODE_ENV === 'development' && (
        <details className="text-left mb-4">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-400">
            Error details
          </summary>
          <pre className="mt-2 p-2 bg-gray-900 rounded text-xs text-red-400 overflow-auto">
            {errorObj.message}
            {errorObj.stack}
          </pre>
        </details>
      )}
      
      <div className="flex gap-3 justify-center">
        <button
          onClick={resetError}
          className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Go Home
        </button>
      </div>
    </div>
  </div>
  );
};

// Render app with error boundary
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary
      fallback={ErrorFallback}
      showDialog={process.env.NODE_ENV === 'development'}
      onError={(error, errorInfo) => {
// console.error('Error caught by boundary:', error, errorInfo);
      }}
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);