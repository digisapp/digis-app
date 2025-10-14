/**
 * Auth Gate Utilities
 *
 * DRY helpers to wrap auth-gated actions and prevent repetitive
 * if (!(await ...)) return; patterns that are error-prone.
 */

/**
 * Wraps an auth-gated action with proper flow control
 *
 * @param {Function} interactionCheck - Async function that returns boolean
 * @returns {Function} - Wrapped executor
 *
 * @example
 * const gate = withAuthGate(() => handleInteraction('follow', creator));
 * const handleFollow = async () => {
 *   await gate(async () => {
 *     // follow logic here
 *   });
 * };
 */
export const withAuthGate = (interactionCheck) => async (fn) => {
  try {
    const ok = await interactionCheck();
    if (!ok) return false;

    await fn();
    return true;
  } catch (error) {
    console.error('Auth gate error:', error);
    return false;
  }
};

/**
 * Hook-friendly version that includes click locking
 *
 * @param {Function} interactionCheck - Async function that returns boolean
 * @param {Object} options - Configuration options
 * @param {Function} options.onDenied - Called when auth check fails
 * @param {Function} options.onError - Called on error
 * @returns {Function} - Wrapped executor with double-click protection
 *
 * @example
 * const runGatedAction = useAuthGate(() => handleInteraction('tip', creator), {
 *   onDenied: () => console.log('Auth required'),
 *   onError: (err) => toast.error('Failed')
 * });
 *
 * const handleTip = () => runGatedAction(async () => {
 *   setShowTipModal(true);
 * });
 */
export const useAuthGate = (interactionCheck, options = {}) => {
  const lockRef = { current: false };

  return async (fn) => {
    // Double-click protection
    if (lockRef.current) return false;
    lockRef.current = true;

    try {
      const ok = await interactionCheck();

      if (!ok) {
        options.onDenied?.();
        return false;
      }

      await fn();
      return true;
    } catch (error) {
      console.error('Auth-gated action error:', error);
      options.onError?.(error);
      return false;
    } finally {
      lockRef.current = false;
    }
  };
};

/**
 * React hook version with useRef for proper React lifecycle
 */
import { useRef } from 'react';

export const useAuthGatedAction = (interactionCheck, options = {}) => {
  const clickLock = useRef(false);

  const runOnce = async (fn) => {
    if (clickLock.current) return false;
    clickLock.current = true;

    try {
      const ok = await interactionCheck();

      if (!ok) {
        options.onDenied?.();
        return false;
      }

      await fn();
      return true;
    } catch (error) {
      console.error('Auth-gated action error:', error);
      options.onError?.(error);
      return false;
    } finally {
      clickLock.current = false;
    }
  };

  return runOnce;
};
