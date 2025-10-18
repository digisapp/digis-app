import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuthToken } from '../utils/supabase-auth';
import { fetchWithRetry } from '../utils/fetchWithRetry';

/**
 * useWalletBalance - Custom hook for wallet balance with:
 * - AbortController cleanup (no setState after unmount)
 * - WebSocket real-time updates
 * - Automatic refetch on balance_update events
 * - Integer-only balance (prevents float drift)
 *
 * @param {Object} user - Current user object
 * @param {WebSocket} websocket - Optional WebSocket connection
 * @returns {Object} { balance, loading, error, refetch }
 */
export const useWalletBalance = (user, websocket = null) => {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);
  const lastUpdateRef = useRef(0); // Prevent duplicate updates

  // Fetch balance with abort controller
  const fetchBalance = useCallback(async () => {
    if (!user?.uid) {
      setBalance(0);
      setLoading(false);
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const token = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/tokens/balance`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          signal: controller.signal
        }
      );

      if (response.ok) {
        const data = await response.json();

        // CRITICAL: Only update if still mounted and not aborted
        if (mountedRef.current && !controller.signal.aborted) {
          // Ensure integer balance (prevent float drift)
          const intBalance = Math.floor(data.balance || data.token_balance || 0);
          setBalance(intBalance);
          lastUpdateRef.current = Date.now();
        }
      } else {
        throw new Error('Failed to fetch balance');
      }
    } catch (err) {
      // Only log/set error if not aborted
      if (err.name !== 'AbortError' && mountedRef.current) {
        console.error('Error fetching wallet balance:', err);
        setError(err.message);
      }
    } finally {
      if (mountedRef.current && !controller.signal.aborted) {
        setLoading(false);
      }
      // Clear abort controller reference
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [user]);

  // Initial fetch on mount
  useEffect(() => {
    mountedRef.current = true;
    fetchBalance();

    return () => {
      mountedRef.current = false;
      // Abort any pending fetch
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchBalance]);

  // WebSocket listener for real-time balance updates
  useEffect(() => {
    if (!websocket || !user?.uid) return;

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle balance update events
        if (data.type === 'balance_update' || data.type === 'token_update') {
          // Debounce: ignore if updated within last 1s
          const now = Date.now();
          if (now - lastUpdateRef.current < 1000) {
            return;
          }

          // IMPORTANT: Don't trust push payload - refetch from source of truth
          console.log('💰 Balance update event received, refetching...');
          fetchBalance();
        }
      } catch (err) {
        console.error('Error handling websocket balance update:', err);
      }
    };

    websocket.addEventListener('message', handleMessage);

    return () => {
      websocket.removeEventListener('message', handleMessage);
    };
  }, [websocket, user, fetchBalance]);

  // Manual refetch function
  const refetch = useCallback(() => {
    return fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    loading,
    error,
    refetch
  };
};

/**
 * Format balance for display
 */
export const formatTokens = (balance) => {
  return Math.floor(balance).toLocaleString();
};

/**
 * Convert tokens to USD estimate
 */
export const tokensToUSD = (balance, rate = 0.05) => {
  return (Math.floor(balance) * rate).toFixed(2);
};

export default useWalletBalance;
