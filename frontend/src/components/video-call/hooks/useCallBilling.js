/**
 * Hook for managing call billing and token calculations
 * @module hooks/useCallBilling
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Manages billing calculations for video/voice calls
 * @param {Object} user - Current user object
 * @param {boolean} isCreator - Whether user is the creator
 * @param {number} tokenBalance - User's current token balance
 * @param {number} ratePerMinute - Rate in tokens per minute
 * @returns {Object} Billing state and methods
 */
export const useCallBilling = (
  user,
  isCreator = false,
  tokenBalance = 0,
  ratePerMinute = 60 // Default 60 tokens per minute
) => {
  const [sessionCost, setSessionCost] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [billingStarted, setBillingStarted] = useState(false);
  const [warningShown, setWarningShown] = useState(false);
  
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const totalCostRef = useRef(0);

  /**
   * Calculate cost based on duration
   */
  const calculateCost = useCallback((durationInSeconds) => {
    const minutes = Math.ceil(durationInSeconds / 60);
    return minutes * ratePerMinute;
  }, [ratePerMinute]);

  /**
   * Start billing timer
   */
  const startBilling = useCallback(() => {
    if (billingStarted || isCreator) return;
    
    setBillingStarted(true);
    startTimeRef.current = Date.now();
    
    // Update every second
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setCallDuration(elapsed);
      
      // Calculate and update cost
      const cost = calculateCost(elapsed);
      setSessionCost(cost);
      totalCostRef.current = cost;
      
      // Check if user is running low on tokens
      if (!isCreator) {
        const remainingTokens = tokenBalance - cost;
        const remainingMinutes = Math.floor(remainingTokens / ratePerMinute);
        
        // Show warning at 5 minutes remaining
        if (remainingMinutes <= 5 && !warningShown) {
          setWarningShown(true);
          // Could trigger a warning notification here
        }
        
        // Auto-end call if out of tokens
        if (remainingTokens <= 0) {
          stopBilling();
          // Could trigger call end here
        }
      }
    }, 1000);
  }, [billingStarted, isCreator, calculateCost, tokenBalance, ratePerMinute, warningShown]);

  /**
   * Stop billing timer
   */
  const stopBilling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setBillingStarted(false);
  }, []);

  /**
   * Pause billing (for reconnections)
   */
  const pauseBilling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Resume billing after pause
   */
  const resumeBilling = useCallback(() => {
    if (!billingStarted || intervalRef.current) return;
    
    // Resume from where we left off
    const previousElapsed = callDuration;
    const resumeTime = Date.now() - (previousElapsed * 1000);
    startTimeRef.current = resumeTime;
    
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setCallDuration(elapsed);
      
      const cost = calculateCost(elapsed);
      setSessionCost(cost);
      totalCostRef.current = cost;
    }, 1000);
  }, [billingStarted, callDuration, calculateCost]);

  /**
   * Get final cost for the session
   */
  const calculateFinalCost = useCallback(() => {
    return totalCostRef.current;
  }, []);

  /**
   * Format duration for display
   */
  const formatDuration = useCallback((seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  /**
   * Get remaining time based on token balance
   */
  const getRemainingTime = useCallback(() => {
    if (isCreator) return null;
    
    const remainingTokens = tokenBalance - sessionCost;
    const remainingMinutes = Math.floor(remainingTokens / ratePerMinute);
    const remainingSeconds = Math.floor((remainingTokens % ratePerMinute) / (ratePerMinute / 60));
    
    return {
      minutes: remainingMinutes,
      seconds: remainingSeconds,
      formatted: `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`
    };
  }, [isCreator, tokenBalance, sessionCost, ratePerMinute]);

  /**
   * Check if user can afford call
   */
  const canAffordCall = useCallback((minimumMinutes = 1) => {
    if (isCreator) return true;
    return tokenBalance >= (minimumMinutes * ratePerMinute);
  }, [isCreator, tokenBalance, ratePerMinute]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    // State
    sessionCost,
    callDuration,
    billingStarted,
    formattedDuration: formatDuration(callDuration),
    
    // Methods
    startBilling,
    stopBilling,
    pauseBilling,
    resumeBilling,
    calculateFinalCost,
    
    // Utilities
    getRemainingTime,
    canAffordCall,
    ratePerMinute
  };
};

export default useCallBilling;