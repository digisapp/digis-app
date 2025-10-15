// Import console override first to suppress all console outputs in production
import './utils/console-override.js';

// Validate environment configuration before app starts
// NOTE: Import is synchronous - validation happens at parse time
import './config/runtime.js';

// Initialize observability (analytics + error tracking)
import { initAnalytics } from './lib/analytics';
import { initSentry } from './lib/sentry.client';
import { initWebVitals } from './lib/webvitals';

// Initialize analytics (logs to console in dev, tracks in prod)
initAnalytics();

// Initialize Sentry (only in production)
if (import.meta.env.PROD) {
  initSentry();
  // Track Core Web Vitals for performance monitoring
  initWebVitals();
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App.js';
import AppBootstrap from './components/AppBootstrap.jsx';
import AuthGate from './components/AuthGate.jsx';
import { disableAllServiceWorkers } from './utils/disableServiceWorker.js';

// Import new context providers
import { AuthProvider } from './contexts/AuthContext';
import { DeviceProvider } from './contexts/DeviceContext';
import { ModalProvider } from './contexts/ModalContext';
import { SocketProvider } from './contexts/SocketContext';

// Import styles
import './index.css';

// Disable all service workers immediately to prevent caching issues with auth
disableAllServiceWorkers();

// Add keyframe animation for spinner
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

// Error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Send error to Sentry (if available)
    if (window.Sentry) {
      window.Sentry.withScope((scope) => {
        scope.setExtras(errorInfo);
        window.Sentry.captureException(error);
      });
    }

    // Log errors in development
    if (import.meta.env.MODE === 'development') {
      console.error('React Error Boundary caught:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#fee', color: '#c00' }}>
          <h1>Something went wrong</h1>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary>Error details</summary>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.error && this.state.error.stack}
          </details>
          <button onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

try {
  // Create query client
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        cacheTime: 1000 * 60 * 10, // 10 minutes
        retry: false, // Disable retries for debugging
      },
    },
  });

  console.log('Query client created');

  // Mount the app
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  const root = ReactDOM.createRoot(rootElement);
  console.log('ReactDOM root created');

  root.render(
    <React.Suspense fallback={
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid rgba(255,255,255,0.3)',
          borderTop: '4px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    }>
      <ErrorBoundary>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <AuthGate>
              <AppBootstrap>
                {/* New Context Providers - Order matters! */}
                <AuthProvider>
                  <DeviceProvider>
                    {/* SocketProvider now handles all socket logic internally */}
                    <SocketProvider>
                      <ModalProvider>
                        <App />
                      </ModalProvider>
                    </SocketProvider>
                  </DeviceProvider>
                </AuthProvider>
              </AppBootstrap>
            </AuthGate>
            <Toaster position="top-right" />
          </QueryClientProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </React.Suspense>
  );

  console.log('React render called successfully');
} catch (error) {
  console.error('Error in main.jsx:', error);
  document.body.innerHTML = `
    <div style="padding: 20px; background: #fee; color: #c00; font-family: monospace;">
      <h1>Failed to initialize React app</h1>
      <pre>${error.stack}</pre>
    </div>
  `;
}