import { useCallback, useRef, useState, useTransition, useDeferredValue, useEffect } from 'react';

/**
 * Custom hook for optimized state management with React 18 features
 */
export function useOptimizedState<T>(
  initialValue: T,
  options?: {
    deferUpdates?: boolean;
    persistKey?: string;
  }
) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<T>(initialValue);
  const deferredState = useDeferredValue(state);
  
  // Use deferred value if specified
  const currentState = options?.deferUpdates ? deferredState : state;
  
  // Optimized setState that uses transitions for non-urgent updates
  const setOptimizedState = useCallback((newValue: T | ((prev: T) => T)) => {
    if (options?.deferUpdates) {
      startTransition(() => {
        setState(newValue);
      });
    } else {
      setState(newValue);
    }
  }, [options?.deferUpdates]);
  
  // Persist to localStorage if key provided
  useEffect(() => {
    if (options?.persistKey) {
      localStorage.setItem(options.persistKey, JSON.stringify(currentState));
    }
  }, [currentState, options?.persistKey]);
  
  return [currentState, setOptimizedState, isPending] as const;
}

/**
 * Custom hook for search with debouncing and deferred updates
 */
export function useOptimizedSearch(initialValue = '', delay = 300) {
  const [search, setSearch] = useState(initialValue);
  const [debouncedSearch, setDebouncedSearch] = useState(initialValue);
  const deferredSearch = useDeferredValue(debouncedSearch);
  const [isPending, startTransition] = useTransition();
  
  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        setDebouncedSearch(search);
      });
    }, delay);
    
    return () => clearTimeout(timer);
  }, [search, delay]);
  
  return {
    search,
    setSearch,
    deferredSearch,
    isPending
  };
}

/**
 * Custom hook for infinite scroll with intersection observer
 */
export function useInfiniteScroll(
  callback: () => void,
  options?: IntersectionObserverInit
) {
  const observer = useRef<IntersectionObserver | null>(null);
  
  const lastElementRef = useCallback((node: HTMLElement | null) => {
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) {
        callback();
      }
    }, options);
    
    if (node) observer.current.observe(node);
  }, [callback, options]);
  
  return lastElementRef;
}

/**
 * Custom hook for optimistic updates
 */
export function useOptimisticUpdate<T>(
  initialValue: T,
  updateFn: (value: T) => Promise<T>
) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<Error | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const previousValueRef = useRef(initialValue);
  
  const update = useCallback(async (newValue: T) => {
    // Store previous value for rollback
    previousValueRef.current = value;
    
    // Optimistically update
    setValue(newValue);
    setIsUpdating(true);
    setError(null);
    
    try {
      const result = await updateFn(newValue);
      setValue(result); // Update with server response
    } catch (err) {
      // Rollback on error
      setValue(previousValueRef.current);
      setError(err as Error);
    } finally {
      setIsUpdating(false);
    }
  }, [value, updateFn]);
  
  return {
    value,
    update,
    error,
    isUpdating
  };
}

/**
 * Custom hook for real-time data with WebSocket
 */
export function useRealtimeData<T>(
  channel: string,
  initialData: T
) {
  const [data, setData] = useState<T>(initialData);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  
  useEffect(() => {
    const ws = new WebSocket(`${import.meta.env['VITE_WS_URL'] || 'ws://localhost:3001'}/${channel}`);
    wsRef.current = ws;
    
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onerror = () => setIsConnected(false);
    
    ws.onmessage = (event) => {
      try {
        const newData = JSON.parse(event.data);
        setData(newData);
      } catch (error) {
        console.error('Failed to parse WebSocket data:', error);
      }
    };
    
    return () => {
      ws.close();
    };
  }, [channel]);
  
  const send = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);
  
  return {
    data,
    isConnected,
    send
  };
}

/**
 * Custom hook for handling async operations with loading states
 */
export function useAsync<T, Args extends any[]>(
  asyncFunction: (...args: Args) => Promise<T>
) {
  const [state, setState] = useState<{
    loading: boolean;
    error: Error | null;
    data: T | null;
  }>({
    loading: false,
    error: null,
    data: null,
  });
  
  const execute = useCallback(async (...args: Args) => {
    setState({ loading: true, error: null, data: null });
    
    try {
      const data = await asyncFunction(...args);
      setState({ loading: false, error: null, data });
      return data;
    } catch (error) {
      setState({ loading: false, error: error as Error, data: null });
      throw error;
    }
  }, [asyncFunction]);
  
  return { ...state, execute };
}