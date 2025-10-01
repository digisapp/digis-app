// Timer management hook for automatic cleanup of timeouts and intervals
// Prevents memory leaks by ensuring all timers are cleared on unmount

import { useRef, useEffect, useCallback, useState } from 'react';
import { devLog } from '../utils/devLog';

/**
 * Hook for managing timers with automatic cleanup
 * @returns {Object} Timer management functions
 */
export function useTimers() {
  const timers = useRef(new Map());
  const intervals = useRef(new Map());
  const animationFrames = useRef(new Set());

  /**
   * Set a timeout with automatic cleanup
   * @param {Function} callback - Function to execute
   * @param {number} delay - Delay in milliseconds
   * @param {string} id - Optional ID for the timer
   * @returns {string} Timer ID
   */
  const setTimeout = useCallback((callback, delay, id = null) => {
    const timerId = id || `timeout_${Date.now()}_${Math.random()}`;

    // Clear existing timer with same ID
    if (timers.current.has(timerId)) {
      window.clearTimeout(timers.current.get(timerId));
      devLog(`Cleared existing timeout: ${timerId}`);
    }

    const timeoutId = window.setTimeout(() => {
      timers.current.delete(timerId);
      callback();
    }, delay);

    timers.current.set(timerId, timeoutId);
    devLog(`Set timeout: ${timerId} (${delay}ms)`);

    return timerId;
  }, []);

  /**
   * Clear a timeout
   * @param {string} timerId - Timer ID to clear
   */
  const clearTimeout = useCallback((timerId) => {
    if (timers.current.has(timerId)) {
      window.clearTimeout(timers.current.get(timerId));
      timers.current.delete(timerId);
      devLog(`Cleared timeout: ${timerId}`);
    }
  }, []);

  /**
   * Set an interval with automatic cleanup
   * @param {Function} callback - Function to execute
   * @param {number} delay - Interval in milliseconds
   * @param {string} id - Optional ID for the interval
   * @returns {string} Interval ID
   */
  const setInterval = useCallback((callback, delay, id = null) => {
    const intervalId = id || `interval_${Date.now()}_${Math.random()}`;

    // Clear existing interval with same ID
    if (intervals.current.has(intervalId)) {
      window.clearInterval(intervals.current.get(intervalId));
      devLog(`Cleared existing interval: ${intervalId}`);
    }

    const intervalRef = window.setInterval(callback, delay);
    intervals.current.set(intervalId, intervalRef);
    devLog(`Set interval: ${intervalId} (${delay}ms)`);

    return intervalId;
  }, []);

  /**
   * Clear an interval
   * @param {string} intervalId - Interval ID to clear
   */
  const clearInterval = useCallback((intervalId) => {
    if (intervals.current.has(intervalId)) {
      window.clearInterval(intervals.current.get(intervalId));
      intervals.current.delete(intervalId);
      devLog(`Cleared interval: ${intervalId}`);
    }
  }, []);

  /**
   * Request animation frame with automatic cleanup
   * @param {Function} callback - Function to execute
   * @returns {number} Animation frame ID
   */
  const requestAnimationFrame = useCallback((callback) => {
    const frameId = window.requestAnimationFrame((timestamp) => {
      animationFrames.current.delete(frameId);
      callback(timestamp);
    });

    animationFrames.current.add(frameId);
    return frameId;
  }, []);

  /**
   * Cancel animation frame
   * @param {number} frameId - Animation frame ID
   */
  const cancelAnimationFrame = useCallback((frameId) => {
    if (animationFrames.current.has(frameId)) {
      window.cancelAnimationFrame(frameId);
      animationFrames.current.delete(frameId);
    }
  }, []);

  /**
   * Clear all active timers
   */
  const clearAll = useCallback(() => {
    // Clear all timeouts
    timers.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    timers.current.clear();

    // Clear all intervals
    intervals.current.forEach((intervalRef) => {
      window.clearInterval(intervalRef);
    });
    intervals.current.clear();

    // Clear all animation frames
    animationFrames.current.forEach((frameId) => {
      window.cancelAnimationFrame(frameId);
    });
    animationFrames.current.clear();

    devLog('Cleared all timers');
  }, []);

  /**
   * Debounced function execution
   * @param {Function} callback - Function to debounce
   * @param {number} delay - Debounce delay
   * @returns {Function} Debounced function
   */
  const debounce = useCallback((callback, delay) => {
    const debounceId = `debounce_${callback.toString()}`;

    return (...args) => {
      clearTimeout(debounceId);
      setTimeout(() => callback(...args), delay, debounceId);
    };
  }, [setTimeout, clearTimeout]);

  /**
   * Throttled function execution
   * @param {Function} callback - Function to throttle
   * @param {number} limit - Throttle limit
   * @returns {Function} Throttled function
   */
  const throttle = useCallback((callback, limit) => {
    let inThrottle = false;
    const throttleId = `throttle_${callback.toString()}`;

    return (...args) => {
      if (!inThrottle) {
        callback(...args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
        }, limit, throttleId);
      }
    };
  }, [setTimeout]);

  /**
   * Execute function after delay
   * @param {number} delay - Delay in milliseconds
   * @returns {Promise} Promise that resolves after delay
   */
  const delay = useCallback((ms) => {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }, [setTimeout]);

  /**
   * Retry function with exponential backoff
   * @param {Function} fn - Function to retry
   * @param {Object} options - Retry options
   * @returns {Promise} Result of function
   */
  const retry = useCallback(async (fn, options = {}) => {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      factor = 2
    } = options;

    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt < maxAttempts - 1) {
          const delayMs = Math.min(
            initialDelay * Math.pow(factor, attempt),
            maxDelay
          );
          devLog(`Retry attempt ${attempt + 1} after ${delayMs}ms`);
          await delay(delayMs);
        }
      }
    }

    throw lastError;
  }, [delay]);

  /**
   * Poll a condition until it's met
   * @param {Function} condition - Condition function
   * @param {Object} options - Polling options
   * @returns {Promise} Resolves when condition is met
   */
  const poll = useCallback(async (condition, options = {}) => {
    const {
      interval = 1000,
      timeout = 30000
    } = options;

    const startTime = Date.now();
    const pollId = `poll_${Date.now()}`;

    return new Promise((resolve, reject) => {
      const checkCondition = async () => {
        try {
          const result = await condition();
          if (result) {
            clearInterval(pollId);
            resolve(result);
            return;
          }

          if (Date.now() - startTime > timeout) {
            clearInterval(pollId);
            reject(new Error('Polling timeout'));
            return;
          }
        } catch (error) {
          clearInterval(pollId);
          reject(error);
        }
      };

      setInterval(checkCondition, interval, pollId);
      checkCondition(); // Check immediately
    });
  }, [setInterval, clearInterval]);

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      clearAll();
    };
  }, [clearAll]);

  return {
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame,
    cancelAnimationFrame,
    clearAll,
    debounce,
    throttle,
    delay,
    retry,
    poll
  };
}

/**
 * Hook for a single timeout with cleanup
 * @param {Function} callback - Callback function
 * @param {number} delay - Delay in milliseconds
 * @param {Array} deps - Dependencies array
 */
export function useTimeout(callback, delay, deps = []) {
  const timers = useTimers();

  useEffect(() => {
    if (delay !== null && delay !== undefined) {
      timers.setTimeout(callback, delay, 'single-timeout');
    }

    return () => {
      timers.clearTimeout('single-timeout');
    };
  }, [delay, ...deps]);
}

/**
 * Hook for a single interval with cleanup
 * @param {Function} callback - Callback function
 * @param {number} delay - Interval in milliseconds
 * @param {Array} deps - Dependencies array
 */
export function useInterval(callback, delay, deps = []) {
  const timers = useTimers();

  useEffect(() => {
    if (delay !== null && delay !== undefined) {
      timers.setInterval(callback, delay, 'single-interval');
    }

    return () => {
      timers.clearInterval('single-interval');
    };
  }, [delay, ...deps]);
}

/**
 * Hook for debounced value
 * @param {any} value - Value to debounce
 * @param {number} delay - Debounce delay
 * @returns {any} Debounced value
 */
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timers = useTimers();

  useEffect(() => {
    timers.setTimeout(() => {
      setDebouncedValue(value);
    }, delay, 'debounce');

    return () => {
      timers.clearTimeout('debounce');
    };
  }, [value, delay, timers]);

  return debouncedValue;
}

// Export default
export default useTimers;