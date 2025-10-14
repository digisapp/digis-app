/**
 * useIsMounted Hook
 *
 * Provides a ref that tracks whether a component is still mounted.
 * Use this to prevent state updates or navigation after unmount/logout.
 *
 * @returns {React.MutableRefObject<boolean>} Ref that is true when mounted, false after unmount
 *
 * @example
 * const isMounted = useIsMounted();
 *
 * useEffect(() => {
 *   let cancelled = false;
 *   (async () => {
 *     const res = await fetch('/api/something');
 *     if (cancelled || !isMounted.current) return;
 *     // safe: no state update or navigate after unmount/logout
 *     setState(res.data);
 *   })();
 *   return () => { cancelled = true; };
 * }, []);
 */
import { useEffect, useRef } from 'react';

export default function useIsMounted() {
  const ref = useRef(true);
  useEffect(() => () => { ref.current = false; }, []);
  return ref;
}
