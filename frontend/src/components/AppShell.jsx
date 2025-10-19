import { Suspense, useEffect, useState } from 'react';
import ErrorBoundary from './ui/ErrorBoundary';

/**
 * SoftFallback - Suspense fallback that auto-expires
 *
 * Prevents infinite loading by rendering children anyway after timeout.
 * This ensures the app is never permanently stuck in a loading state.
 */
function SoftFallback({ children }) {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ Suspense fallback expired after 8s; rendering app anyway to prevent infinite loading');
      setExpired(true);
    }, 8000); // 8 second timeout

    return () => clearTimeout(timeoutId);
  }, []);

  // If expired, stop blocking and render children
  if (expired) {
    return <>{children}</>;
  }

  // Show loading spinner while waiting
  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div className="flex flex-col items-center gap-4">
        <img
          src="/digis-logo-white.png"
          alt="Digis"
          className="w-32 h-32 object-contain"
          onError={(e) => {
            // Fallback if logo doesn't exist
            e.target.style.display = 'none';
          }}
        />
        <div className="text-white text-lg font-medium">Loading...</div>
        <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  );
}

/**
 * AppShell - Root wrapper with fail-safe error and loading handling
 *
 * Ensures the app can never be permanently stuck in:
 * - Error state (ErrorBoundary catches and allows recovery)
 * - Loading state (SoftFallback times out and renders anyway)
 */
export default function AppShell({ children }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<SoftFallback>{children}</SoftFallback>}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
