/**
 * Optimized Zustand Selectors with Memoization and Performance Patterns
 * Following latest v5 best practices for 2024-2025
 */

import { useCallback, useMemo } from 'react';
import { useStore } from '../stores/useStoreV5';
import { shallow } from 'zustand/shallow';
import { useStoreWithEqualityFn } from 'zustand/traditional';

/**
 * Performance-optimized selector hook
 * Prevents unnecessary re-renders by using shallow comparison
 */
export const useShallowStore = (selector) => {
  return useStore(selector, shallow);
};

/**
 * Atomic selectors for fine-grained subscriptions
 * Each selector only subscribes to specific state slices
 */
export const useAtomicSelectors = () => {
  // User-specific selectors
  const userId = useStore((state) => state.user?.id);
  const userName = useStore((state) => state.user?.name);
  const userRole = useStore((state) => state.user?.role);
  const userBalance = useStore((state) => state.user?.tokenBalance);
  
  // Analytics-specific selectors
  const currentViewers = useStore((state) => state.analytics.viewers);
  const revenue = useStore((state) => state.analytics.revenue);
  const engagement = useStore((state) => state.analytics.engagement);
  
  // Socket-specific selectors
  const isConnected = useStore((state) => state.socketConnected);
  
  return {
    user: { id: userId, name: userName, role: userRole, balance: userBalance },
    analytics: { viewers: currentViewers, revenue, engagement },
    socket: { isConnected },
  };
};

/**
 * Memoized computed values
 * Calculates derived state without causing re-renders
 */
export const useComputedValues = () => {
  const analyticsHistory = useStore((state) => state.analyticsHistory);
  const user = useStore((state) => state.user);
  
  const averageViewers = useMemo(() => {
    if (!analyticsHistory.length) return 0;
    const sum = analyticsHistory.reduce((acc, item) => acc + (item.viewers || 0), 0);
    return Math.round(sum / analyticsHistory.length);
  }, [analyticsHistory]);
  
  const peakViewers = useMemo(() => {
    if (!analyticsHistory.length) return 0;
    return Math.max(...analyticsHistory.map(item => item.viewers || 0));
  }, [analyticsHistory]);
  
  const totalEarnings = useMemo(() => {
    if (!analyticsHistory.length) return 0;
    return analyticsHistory.reduce((acc, item) => acc + (item.revenue || 0), 0);
  }, [analyticsHistory]);
  
  const isCreator = useMemo(() => {
    return user?.role === 'creator' || user?.is_creator === true;
  }, [user]);
  
  const isPremium = useMemo(() => {
    return user?.subscription?.plan === 'premium' || user?.tokenBalance > 1000;
  }, [user]);
  
  return {
    averageViewers,
    peakViewers,
    totalEarnings,
    isCreator,
    isPremium,
  };
};

/**
 * Action hooks with memoization
 * Prevents recreating functions on every render
 */
export const useMemoizedActions = () => {
  const fetchUser = useStore((state) => state.fetchUser);
  const updateUser = useStore((state) => state.updateUser);
  const updateAnalytics = useStore((state) => state.updateAnalytics);
  const sendSocketMessage = useStore((state) => state.sendSocketMessage);
  const reset = useStore((state) => state.reset);
  
  const memoizedFetchUser = useCallback(() => fetchUser(), [fetchUser]);
  
  const memoizedUpdateUser = useCallback(
    (updates) => updateUser(updates),
    [updateUser]
  );
  
  const memoizedUpdateAnalytics = useCallback(
    (data) => updateAnalytics(data),
    [updateAnalytics]
  );
  
  const memoizedSendMessage = useCallback(
    (type, payload) => sendSocketMessage(type, payload),
    [sendSocketMessage]
  );
  
  const memoizedReset = useCallback(() => reset(), [reset]);
  
  return {
    fetchUser: memoizedFetchUser,
    updateUser: memoizedUpdateUser,
    updateAnalytics: memoizedUpdateAnalytics,
    sendMessage: memoizedSendMessage,
    reset: memoizedReset,
  };
};

/**
 * Subscription hook for external state changes
 * Useful for side effects and non-React code
 */
export const useExternalSubscription = (selector, callback, options = {}) => {
  const { equalityFn = shallow, fireImmediately = false } = options;
  
  useCallback(() => {
    const unsubscribe = useStore.subscribe(selector, callback, {
      equalityFn,
      fireImmediately,
    });
    
    return unsubscribe;
  }, [selector, callback, equalityFn, fireImmediately]);
};

/**
 * Batched updates hook
 * Groups multiple state updates into a single render
 */
export const useBatchedUpdates = () => {
  const batchUpdate = useCallback((updates) => {
    useStore.setState((state) => {
      // Apply all updates in a single setState call
      Object.entries(updates).forEach(([key, value]) => {
        if (typeof value === 'function') {
          state[key] = value(state[key]);
        } else {
          state[key] = value;
        }
      });
    });
  }, []);
  
  return batchUpdate;
};

/**
 * Temporal state hook
 * Returns state at specific points in time
 */
export const useTemporalState = (historySize = 10) => {
  const [history, setHistory] = useState([]);
  const currentState = useStore();
  
  useEffect(() => {
    setHistory((prev) => [...prev.slice(-(historySize - 1)), currentState]);
  }, [currentState, historySize]);
  
  const getPreviousState = useCallback(
    (stepsBack = 1) => {
      const index = history.length - 1 - stepsBack;
      return index >= 0 ? history[index] : null;
    },
    [history]
  );
  
  const hasChanged = useCallback(
    (selector, stepsBack = 1) => {
      const previous = getPreviousState(stepsBack);
      if (!previous) return false;
      
      const currentValue = selector(currentState);
      const previousValue = selector(previous);
      
      return !shallow(currentValue, previousValue);
    },
    [currentState, getPreviousState]
  );
  
  return {
    history,
    getPreviousState,
    hasChanged,
  };
};

/**
 * Conditional subscription hook
 * Only subscribes when condition is met
 */
export const useConditionalSubscription = (condition, selector, callback) => {
  useEffect(() => {
    if (!condition) return;
    
    const unsubscribe = useStore.subscribe(selector, callback, {
      fireImmediately: true,
    });
    
    return unsubscribe;
  }, [condition, selector, callback]);
};

/**
 * Debounced selector hook
 * Delays state updates to prevent rapid re-renders
 */
export const useDebouncedSelector = (selector, delay = 300) => {
  const value = useStore(selector);
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
};

/**
 * Store snapshot hook
 * Creates immutable snapshots of store state
 */
export const useStoreSnapshot = () => {
  const createSnapshot = useCallback(() => {
    const state = useStore.getState();
    return JSON.parse(JSON.stringify(state));
  }, []);
  
  const restoreSnapshot = useCallback((snapshot) => {
    useStore.setState(snapshot);
  }, []);
  
  const compareSnapshots = useCallback((snapshot1, snapshot2) => {
    return JSON.stringify(snapshot1) === JSON.stringify(snapshot2);
  }, []);
  
  return {
    createSnapshot,
    restoreSnapshot,
    compareSnapshots,
  };
};

/**
 * Performance monitoring hook
 * Tracks render counts and state update frequency
 */
export const usePerformanceMonitor = (componentName) => {
  const renderCount = useRef(0);
  const updateCount = useRef(0);
  const lastUpdate = useRef(Date.now());
  
  useEffect(() => {
    renderCount.current += 1;
    
    if (import.meta.env.DEV) {
      console.log(`[${componentName}] Render #${renderCount.current}`);
    }
  });
  
  useEffect(() => {
    const unsubscribe = useStore.subscribe(() => {
      updateCount.current += 1;
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdate.current;
      lastUpdate.current = now;
      
      if (import.meta.env.DEV && timeSinceLastUpdate < 100) {
        console.warn(
          `[${componentName}] Rapid state updates detected: ${timeSinceLastUpdate}ms`
        );
      }
    });
    
    return unsubscribe;
  }, [componentName]);
  
  return {
    renderCount: renderCount.current,
    updateCount: updateCount.current,
  };
};