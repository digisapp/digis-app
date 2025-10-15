import { useEffect, useState } from 'react';

/**
 * HydrationGate - Prevents SSR/client hydration mismatches
 *
 * Use this to wrap any component tree that depends on:
 * - Browser APIs (window, document, navigator)
 * - localStorage/sessionStorage
 * - Media queries or device detection
 * - Auth session state
 * - Dynamic values (Date.now(), Math.random())
 *
 * How it works:
 * - During SSR and initial client render: shows fallback (stable, no mismatch)
 * - After hydration (useEffect runs): shows children (safe, all browser APIs available)
 *
 * This eliminates React error #310 (Suspense hydration mismatch) by ensuring
 * the first client render matches what SSR produced.
 *
 * @param {React.ReactNode} children - Content to render after hydration
 * @param {React.ReactNode} fallback - Stable content during hydration (default: null)
 *
 * @example
 * <HydrationGate fallback={<Spinner />}>
 *   <ComponentThatUsesLocalStorage />
 * </HydrationGate>
 */
export default function HydrationGate({ children, fallback = null }) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // This only runs on the client after hydration
    setIsHydrated(true);
  }, []);

  // During SSR and initial client render: show fallback (matches server)
  // After hydration: show children (safe to use browser APIs)
  return isHydrated ? children : fallback;
}
