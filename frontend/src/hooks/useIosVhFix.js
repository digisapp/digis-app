import { useEffect } from 'react';

/**
 * iOS Viewport Height Fix
 *
 * Fixes the infamous iOS Safari "100vh includes address bar" bug.
 * Sets a CSS custom property --vh that always matches the actual viewport height,
 * accounting for Safari's dynamic UI and orientation changes.
 *
 * Usage:
 * 1. Call hook in your mobile shell component
 * 2. Use in CSS: min-height: calc(var(--vh, 1vh) * 100)
 * 3. Or use Tailwind: className="min-h-[100dvh]" (as fallback)
 */
export default function useIosVhFix() {
  useEffect(() => {
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    // Set on mount
    setVh();

    // Update on resize (keyboard open/close, split screen)
    window.addEventListener('resize', setVh);

    // Update on orientation change with delay (iOS needs time to recalculate)
    const handleOrientationChange = () => {
      setTimeout(setVh, 300);
    };
    window.addEventListener('orientationchange', handleOrientationChange);

    // Cleanup
    return () => {
      window.removeEventListener('resize', setVh);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);
}
