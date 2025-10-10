import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase-auth.js';

/**
 * AuthGate ensures the app doesn't render until the session is bootstrapped
 * This prevents the "flash to default fan page" on refresh
 */
export default function AuthGate({ children, fallback = null }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      try {
        console.log('🔐 AuthGate: Bootstrapping auth before render...');
        // Force a session bootstrap before rendering the app
        const { data: { session } } = await supabase.auth.getSession();

        console.log('🔐 AuthGate: Session loaded', {
          hasSession: !!session,
          userEmail: session?.user?.email
        });

        if (isMounted) {
          setReady(true);
        }
      } catch (error) {
        console.error('🔐 AuthGate: Error bootstrapping auth:', error);
        // Still set ready to true so app doesn't hang
        if (isMounted) {
          setReady(true);
        }
      }
    };

    bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!ready) {
    // Show loading fallback while auth is bootstrapping
    return fallback || (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(to bottom right, #9333ea, #ec4899)'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{
            width: '64px',
            height: '64px',
            border: '4px solid rgba(255,255,255,0.3)',
            borderTop: '4px solid white',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ fontSize: '16px', marginTop: '16px' }}>Loading...</p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return children;
}
