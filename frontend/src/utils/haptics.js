/**
 * Safe haptic feedback utility for mobile devices
 * Handles SSR/desktop gracefully without errors
 */

/**
 * Trigger haptic feedback with various intensity levels
 * @param {string} type - Type of haptic feedback: 'light', 'medium', 'heavy', 'success', 'warning', 'error'
 */
export const triggerHaptic = (type = 'light') => {
  // Guard against SSR and non-supporting browsers
  if (typeof navigator === 'undefined' || !navigator.vibrate) {
    return;
  }

  const patterns = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 20, 10],
    warning: [30, 10, 30],
    error: [50, 20, 50, 20, 50],
    selection: 5,
    impact: 15
  };

  try {
    navigator.vibrate(patterns[type] || patterns.light);
  } catch (error) {
    // Silently fail if vibrate is not supported
    console.debug('Haptic feedback not supported:', error);
  }
};

/**
 * Check if haptic feedback is supported
 * @returns {boolean}
 */
export const isHapticSupported = () => {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
};

/**
 * Trigger haptic with custom pattern
 * @param {number|number[]} pattern - Vibration pattern in milliseconds
 */
export const customHaptic = (pattern) => {
  if (typeof navigator === 'undefined' || !navigator.vibrate) {
    return;
  }

  try {
    navigator.vibrate(pattern);
  } catch (error) {
    console.debug('Custom haptic failed:', error);
  }
};

// Export default for convenience
export default triggerHaptic;