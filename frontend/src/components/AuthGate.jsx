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
        setRoleResolved?.(true);     // Let routes render public/fan UI (defensive)
        setAuthLoading?.(false);     // Defensive guard
        setReady(true);
      }
    }, 8000);

    const bootstrapAuth = async () => {
      try {
        console.log('🔐 AuthGate: Bootstrapping auth before render...');
        setAuthLoading?.(true);  // Defensive guard

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
            const res = await fetch(`${backendUrl}/users/profile`, {
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
          setUser?.(session?.user || null);    // Defensive guard
          if (profile) setProfile?.(profile);  // Defensive guard
          setRoleResolved?.(true);             // Always resolve - even if profile is fan or missing
          setAuthLoading?.(false);             // Defensive guard
          setReady(true);
        }
      } catch (error) {
        console.error('🔐 AuthGate: Error bootstrapping auth:', error);
        // Fail-open: still let app render. Public routes keep working.
        if (!cancelled) {
          setRoleResolved?.(true);   // Defensive guard
          setAuthLoading?.(false);   // Defensive guard
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
          <img
            src="/digis-logo-white.png"
            alt="Digis"
            style={{
              width: '192px',
              height: 'auto',
              margin: '0 auto',
              filter: 'drop-shadow(0 10px 25px rgba(0, 0, 0, 0.3))',
              animation: 'pulse 2s ease-in-out infinite'
            }}
          />
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 0.9; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.05); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return children;
}
