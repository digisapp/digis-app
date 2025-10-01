import { useState, useEffect, useRef, useCallback } from 'react';
import { retryWebSocketSend, createWebSocketSender } from '../utils/retryUtils';

/**
 * Enhanced WebSocket hook with automatic retry logic
 * @param {string} url - WebSocket URL
 * @param {Object} options - Configuration options
 * @returns {Object} WebSocket state and methods
 */
export const useWebSocketWithRetry = (url, options = {}) => {
  const {
    reconnectAttempts = 5,
    reconnectDelay = 1000,
    reconnectBackoffMultiplier = 2,
    maxReconnectDelay = 30000,
    heartbeatInterval = 30000,
    messageRetryOptions = {},
    onOpen = null,
    onClose = null,
    onError = null,
    onMessage = null,
    onReconnect = null,
    autoConnect = true
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [lastError, setLastError] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const sendWithRetryRef = useRef(null);
  const messageQueueRef = useRef([]);

  // Calculate reconnect delay with exponential backoff
  const calculateReconnectDelay = useCallback((attempt) => {
    const delay = reconnectDelay * Math.pow(reconnectBackoffMultiplier, attempt);
    return Math.min(delay, maxReconnectDelay);
  }, [reconnectDelay, reconnectBackoffMultiplier, maxReconnectDelay]);

  // Heartbeat mechanism to detect connection loss
  const startHeartbeat = useCallback(() => {
    if (heartbeatInterval <= 0) return;

    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          console.error('Heartbeat failed:', error);
        }
      }
    }, heartbeatInterval);
  }, [heartbeatInterval]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Process queued messages
  const processMessageQueue = useCallback(() => {
    while (messageQueueRef.current.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
      const { message, options } = messageQueueRef.current.shift();
      sendWithRetryRef.current(message, options).catch(console.error);
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.CONNECTING ||
        wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      wsRef.current = new WebSocket(url);
      
      // Create retry sender for this instance
      sendWithRetryRef.current = createWebSocketSender(wsRef.current, messageRetryOptions);

      wsRef.current.onopen = (event) => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setReconnectCount(0);
        setLastError(null);
        startHeartbeat();
        processMessageQueue();
        
        if (onOpen) onOpen(event);
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected', event);
        setIsConnected(false);
        stopHeartbeat();
        
        if (onClose) onClose(event);

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectCount < reconnectAttempts) {
          const delay = calculateReconnectDelay(reconnectCount);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectCount + 1}/${reconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectCount(prev => prev + 1);
            if (onReconnect) onReconnect(reconnectCount + 1);
            connect();
          }, delay);
        }
      };

      wsRef.current.onerror = (event) => {
        console.error('WebSocket error:', event);
        setLastError(new Error('WebSocket error'));
        if (onError) onError(event);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle pong messages internally
          if (data.type === 'pong') {
            return;
          }
          
          if (onMessage) onMessage(data, event);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          if (onMessage) onMessage(event.data, event);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setLastError(error);
      if (onError) onError(error);
    }
  }, [
    url,
    reconnectCount,
    reconnectAttempts,
    calculateReconnectDelay,
    startHeartbeat,
    stopHeartbeat,
    processMessageQueue,
    messageRetryOptions,
    onOpen,
    onClose,
    onError,
    onMessage,
    onReconnect
  ]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect');
      wsRef.current = null;
    }

    setIsConnected(false);
    setReconnectCount(0);
    messageQueueRef.current = [];
  }, [stopHeartbeat]);

  // Send message with retry logic
  const sendMessage = useCallback((message, options = {}) => {
    const messageObj = typeof message === 'string' ? { data: message } : message;
    
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // Queue message if not connected
      if (options.queueIfOffline !== false) {
        messageQueueRef.current.push({ message: messageObj, options });
        return Promise.resolve();
      }
      return Promise.reject(new Error('WebSocket not connected'));
    }

    return sendWithRetryRef.current(messageObj, options);
  }, []);

  // Send message without retry (for time-sensitive messages)
  const sendImmediate = useCallback((message) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    wsRef.current.send(messageStr);
  }, []);

  // Get WebSocket state
  const getState = useCallback(() => {
    if (!wsRef.current) return 'DISCONNECTED';
    
    switch (wsRef.current.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'CONNECTED';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'DISCONNECTED';
      default:
        return 'UNKNOWN';
    }
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect]); // Only re-run if autoConnect changes

  return {
    // State
    isConnected,
    connectionState: getState(),
    reconnectCount,
    lastError,
    
    // Methods
    connect,
    disconnect,
    sendMessage,
    sendImmediate,
    
    // WebSocket instance (for advanced usage)
    ws: wsRef.current
  };
};

export default useWebSocketWithRetry;