// Centralized haptic feedback hook
import { useCallback, useRef, useEffect } from 'react';
import { devLog } from '../utils/devLog';

// Haptic feedback patterns
const HAPTIC_PATTERNS = {
  // Light feedback
  light: 10,
  selection: 10,
  tap: 15,

  // Medium feedback
  medium: 25,
  success: [15, 30, 15],
  warning: [20, 40, 20],

  // Heavy feedback
  heavy: 50,
  error: [30, 60, 30],
  notification: [20, 100, 20],

  // Custom patterns
  double: [15, 50, 15],
  triple: [10, 40, 10, 40, 10],
  long: 100,

  // Special patterns
  message: [10, 30, 10],
  like: [5, 15, 5],
  pullRefresh: [10, 20, 10],
  swipe: 8,
  toggle: 12,

  // Call patterns
  incomingCall: [100, 200, 100, 200, 100],
  endCall: [50, 100, 50],
  startCall: [20, 40, 20]
};

// Check if haptics are supported
const isHapticsSupported = () => {
  if (typeof window === 'undefined') return false;
  return 'vibrate' in navigator;
};

// Check if haptics are enabled (user preference)
const isHapticsEnabled = () => {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem('hapticsEnabled');
  return stored === null ? true : stored === 'true';
};

export const useHaptics = () => {
  const isSupported = useRef(isHapticsSupported());
  const isEnabled = useRef(isHapticsEnabled());
  const lastVibration = useRef(0);
  const minInterval = 50; // Minimum ms between vibrations

  // Update enabled state when storage changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'hapticsEnabled') {
        isEnabled.current = e.newValue === 'true';
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Main vibration function
  const vibrate = useCallback((pattern) => {
    if (!isSupported.current || !isEnabled.current) {
      return false;
    }

    // Throttle rapid vibrations
    const now = Date.now();
    if (now - lastVibration.current < minInterval) {
      devLog('Haptic throttled');
      return false;
    }

    try {
      const success = navigator.vibrate(pattern);
      if (success) {
        lastVibration.current = now;
        devLog('Haptic triggered:', pattern);
      }
      return success;
    } catch (error) {
      devLog('Haptic error:', error);
      return false;
    }
  }, []);

  // Trigger haptic by pattern name or custom pattern
  const trigger = useCallback((patternName = 'light') => {
    const pattern = typeof patternName === 'string'
      ? HAPTIC_PATTERNS[patternName] || HAPTIC_PATTERNS.light
      : patternName;

    return vibrate(pattern);
  }, [vibrate]);

  // Stop any ongoing vibration
  const stop = useCallback(() => {
    if (!isSupported.current) return false;

    try {
      return navigator.vibrate(0);
    } catch (error) {
      devLog('Failed to stop haptic:', error);
      return false;
    }
  }, []);

  // Enable/disable haptics
  const setEnabled = useCallback((enabled) => {
    isEnabled.current = enabled;
    localStorage.setItem('hapticsEnabled', String(enabled));
    devLog('Haptics', enabled ? 'enabled' : 'disabled');
  }, []);

  // Check if haptics are currently enabled
  const getEnabled = useCallback(() => {
    return isEnabled.current;
  }, []);

  // Preset haptic functions for common actions
  const haptics = {
    // Basic feedback
    light: () => trigger('light'),
    medium: () => trigger('medium'),
    heavy: () => trigger('heavy'),

    // UI feedback
    tap: () => trigger('tap'),
    selection: () => trigger('selection'),
    toggle: () => trigger('toggle'),
    swipe: () => trigger('swipe'),

    // Status feedback
    success: () => trigger('success'),
    warning: () => trigger('warning'),
    error: () => trigger('error'),

    // Message feedback
    message: () => trigger('message'),
    notification: () => trigger('notification'),
    like: () => trigger('like'),

    // Call feedback
    incomingCall: () => trigger('incomingCall'),
    startCall: () => trigger('startCall'),
    endCall: () => trigger('endCall'),

    // Other patterns
    pullRefresh: () => trigger('pullRefresh'),
    double: () => trigger('double'),
    triple: () => trigger('triple'),
    long: () => trigger('long')
  };

  return {
    trigger,
    stop,
    vibrate,
    setEnabled,
    getEnabled,
    isSupported: isSupported.current,
    ...haptics
  };
};

// Export for use in non-component contexts
export const hapticFeedback = {
  trigger: (pattern) => {
    if (!isHapticsSupported() || !isHapticsEnabled()) return false;
    const patternValue = typeof pattern === 'string'
      ? HAPTIC_PATTERNS[pattern] || HAPTIC_PATTERNS.light
      : pattern;
    return navigator.vibrate(patternValue);
  },
  stop: () => {
    if (!isHapticsSupported()) return false;
    return navigator.vibrate(0);
  },
  isSupported: isHapticsSupported(),
  isEnabled: isHapticsEnabled()
};