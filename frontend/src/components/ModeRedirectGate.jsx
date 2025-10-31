import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * ModeRedirectGate - Auto-corrects /?mode=signin to /auth?mode=signin
 *
 * If user lands on /?mode=X (homepage with mode param),
 * immediately redirect to /auth?mode=X
 *
 * This prevents the common bug where navigate() pushes the wrong path.
 */
export function ModeRedirectGate() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const mode = params.get('mode');

    // If we have a mode param but we're NOT on /auth, redirect to /auth with the mode
    if (mode && pathname !== '/auth') {
      console.log(`🔀 ModeRedirectGate: Correcting ${pathname}?mode=${mode} → /auth?mode=${mode}`);
      navigate({ pathname: '/auth', search: `?mode=${mode}` }, { replace: true });
    }
  }, [pathname, search, navigate]);

  return null;
}
