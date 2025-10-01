import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Optimized timer hook that reduces re-renders
 * Updates ref every second but only commits to state at specified interval
 *
 * @param {number} updateInterval - How often to update state (in seconds)
 * @param {boolean} autoStart - Whether to start timer automatically
 * @returns {Object} Timer state and controls
 */
export const useOptimizedTimer = (updateInterval = 10, autoStart = true) => {
  const [duration, setDuration] = useState(0); // State for UI updates
  const durationRef = useRef(0); // Ref for actual timing
  const intervalRef = useRef(null);
  const isRunningRef = useRef(autoStart);
  const startTimeRef = useRef(null);
  const accumulatedTimeRef = useRef(0);

  // Start timer
  const start = useCallback(() => {
    if (isRunningRef.current) return;

    isRunningRef.current = true;
    startTimeRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      // Update ref every second (doesn't trigger re-render)
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      durationRef.current = accumulatedTimeRef.current + elapsed;

      // Only update state at specified interval to reduce re-renders
      if (durationRef.current % updateInterval === 0) {
        setDuration(durationRef.current);
      }
    }, 1000);
  }, [updateInterval]);

  // Pause timer
  const pause = useCallback(() => {
    if (!isRunningRef.current) return;

    isRunningRef.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Save accumulated time
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    accumulatedTimeRef.current += elapsed;
    durationRef.current = accumulatedTimeRef.current;
    setDuration(durationRef.current);
  }, []);

  // Stop and reset timer
  const stop = useCallback(() => {
    isRunningRef.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    durationRef.current = 0;
    accumulatedTimeRef.current = 0;
    startTimeRef.current = null;
    setDuration(0);
  }, []);

  // Reset timer without stopping
  const reset = useCallback(() => {
    durationRef.current = 0;
    accumulatedTimeRef.current = 0;
    startTimeRef.current = isRunningRef.current ? Date.now() : null;
    setDuration(0);
  }, []);

  // Get current duration without triggering re-render
  const getCurrentDuration = useCallback(() => {
    if (isRunningRef.current && startTimeRef.current) {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      return accumulatedTimeRef.current + elapsed;
    }
    return durationRef.current;
  }, []);

  // Force update state with current duration
  const forceUpdate = useCallback(() => {
    setDuration(getCurrentDuration());
  }, [getCurrentDuration]);

  // Cleanup on unmount
  useEffect(() => {
    if (autoStart) {
      start();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoStart, start]);

  return {
    // State (updates every updateInterval seconds)
    duration,

    // Controls
    start,
    pause,
    stop,
    reset,

    // Utils
    getCurrentDuration, // Get current duration without re-render
    forceUpdate, // Force state update
    isRunning: () => isRunningRef.current,

    // Refs for direct access (no re-renders)
    durationRef
  };
};

/**
 * Format duration for display (used with ref to avoid re-renders)
 * @param {Object} ref - Duration ref from useOptimizedTimer
 * @returns {string} Formatted duration
 */
export const useFormattedDuration = (ref) => {
  const [formatted, setFormatted] = useState('0:00');

  useEffect(() => {
    const interval = setInterval(() => {
      const seconds = ref.current;
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;

      let newFormatted;
      if (hours > 0) {
        newFormatted = `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      } else {
        newFormatted = `${mins}:${secs.toString().padStart(2, '0')}`;
      }

      setFormatted(newFormatted);
    }, 1000);

    return () => clearInterval(interval);
  }, [ref]);

  return formatted;
};

/**
 * Live timer display component that updates every second without parent re-renders
 */
export const LiveTimer = ({ durationRef, className = '' }) => {
  const formatted = useFormattedDuration(durationRef);

  return (
    <span className={`font-mono ${className}`}>
      {formatted}
    </span>
  );
};

export default useOptimizedTimer;