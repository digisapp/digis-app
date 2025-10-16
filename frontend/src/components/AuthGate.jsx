import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase-auth.js';
import { useAuth } from '../contexts/AuthContext';

/**
 * AuthGate ensures the app doesn't render until the session is bootstrapped
 * This prevents the "flash to default fan page" on refresh
 *
 * CRITICAL FIX: Extended timeout (8s) and fail-open logic to prevent infinite loading
 * If backend is down/slow, we still render the app (fail-open for resilience)
 */
export default function AuthGate({ children, fallback = null }) {
  const [ready, setReady] = useState(false);
  const [errored, setErrored] = useState(false);
  const { setUser, setProfile, setRoleResolved, authLoading, setAuthLoading } = useAuth();

  useEffect(() => {
    let cancelled = false;

    // Hard fail-open after 8s to avoid infinite splash screen
    const timeout = setTimeout(() => {
      if (!cancelled) {
        console.warn('🔐 AuthGate: Hit 8s timeout, forcing fail-open render');
        setErrored(true);
        setRoleResolved(true);     // Let routes render public/fan UI
        setAuthLoading(false);
        setReady(true);
      }
    }, 8000);

    const bootstrapAuth = async () => {
      try {
        console.log('🔐 AuthGate: Bootstrapping auth before render...');
        setAuthLoading(true);

        const { data: { session } } = await supabase.auth.getSession();

        if (cancelled) return;

        console.log('🔐 AuthGate: Session loaded', {
          hasSession: !!session,
          userEmail: session?.user?.email
        });

        let profile = null;
        if (session) {
          try {
            // Fetch profile with no-store to dodge SW/browser cache
            const backendUrl = import.meta.env.VITE_BACKEND_URL;
            const res = await fetch(`${backendUrl}/api/users/me`, {
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Cache-Control': 'no-store'
              }
            });

            if (res.ok) {
              profile = await res.json();
              profile.__isCanonical = true; // Mark as fresh from backend
              console.log('✅ AuthGate: Profile fetched', {
                username: profile.username,
                is_creator: profile.is_creator,
                is_admin: profile.is_admin
              });
            } else {
              console.warn('⚠️ AuthGate: Profile fetch failed:', res.status);
            }
          } catch (profileError) {
            console.error('🔐 AuthGate: Profile fetch error (non-blocking):', profileError);
            // Continue without profile - fail-open
          }
        }

        if (!cancelled) {
          setUser(session?.user || null);
          if (profile) setProfile(profile);
          setRoleResolved(true);    // Always resolve - even if profile is fan or missing
          setAuthLoading(false);
          setReady(true);
        }
      } catch (error) {
        console.error('🔐 AuthGate: Error bootstrapping auth:', error);
        // Fail-open: still let app render. Public routes keep working.
        if (!cancelled) {
          setRoleResolved(true);
          setAuthLoading(false);
          setReady(true);
        }
      } finally {
        clearTimeout(timeout);
      }
    };

    bootstrapAuth();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [setUser, setProfile, setRoleResolved, setAuthLoading]);

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
          <p style={{ fontSize: '16px', marginTop: '16px' }}>Verifying your session…</p>
          {errored && (
            <p style={{ fontSize: '12px', marginTop: '8px', opacity: 0.8 }}>
              Taking longer than expected. Continuing anyway...
            </p>
          )}
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
