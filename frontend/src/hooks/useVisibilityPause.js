import { useEffect, useRef, useState } from 'react';

/**
 * useVisibilityPause - Automatically pause/resume media when tab is hidden
 * Prevents battery drain and bandwidth waste when user switches tabs
 *
 * @param {React.RefObject} mediaRef - Ref to video/audio element
 * @param {boolean} enabled - Whether to enable auto-pause (default: true)
 * @param {Function} onVisibilityChange - Optional callback (visible: boolean)
 *
 * @example
 * const videoRef = useRef(null);
 * useVisibilityPause(videoRef, true, (visible) => {
 *   if (!visible) console.log('User switched tabs, pausing video');
 * });
 */
export const useVisibilityPause = (
  mediaRef,
  enabled = true,
  onVisibilityChange = null
) => {
  const wasPlayingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !mediaRef.current) return;

    const handleVisibilityChange = () => {
      const isHidden = document.hidden;
      const media = mediaRef.current;

      if (!media) return;

      if (isHidden) {
        // Tab is hidden - pause if playing
        wasPlayingRef.current = !media.paused;
        if (!media.paused) {
          media.pause();
          console.log('📱 Tab hidden, pausing media');
        }
      } else {
        // Tab is visible - resume if was playing
        if (wasPlayingRef.current) {
          media.play().catch((err) => {
            console.warn('Could not resume playback:', err);
          });
          console.log('📱 Tab visible, resuming media');
          wasPlayingRef.current = false;
        }
      }

      // Call optional callback
      if (onVisibilityChange) {
        onVisibilityChange(!isHidden);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mediaRef, enabled, onVisibilityChange]);
};

/**
 * usePageVisibility - Simple hook to track page visibility state
 *
 * @returns {boolean} isVisible - Whether page is currently visible
 *
 * @example
 * const isVisible = usePageVisibility();
 * useEffect(() => {
 *   if (!isVisible) pauseBackgroundWork();
 * }, [isVisible]);
 */
export const usePageVisibility = () => {
  const [isVisible, setIsVisible] = useState(!document.hidden);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
};

export default useVisibilityPause;
