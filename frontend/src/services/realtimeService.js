// Centralized WebSocket/realtime service
// Single connection, multiple subscribers, auto-reconnect, offline queue integration

import { devLog, devError } from '../utils/devLog';
import { offlineQueue } from './offlineQueueService';

// Configuration
const WS_RECONNECT_DELAY = 1000; // Start with 1 second
const WS_MAX_RECONNECT_DELAY = 30000; // Max 30 seconds
const WS_RECONNECT_DECAY = 1.5; // Exponential backoff factor
const WS_HEARTBEAT_INTERVAL = 30000; // 30 seconds
const WS_CONNECTION_TIMEOUT = 5000; // 5 seconds to connect

// Event types
export const EVENTS = {
  // Connection events
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error',

  // Message events
  MESSAGE_NEW: 'message:new',
  MESSAGE_SENT: 'message:sent',
  MESSAGE_DELIVERED: 'message:delivered',
  MESSAGE_READ: 'message:read',
  MESSAGE_TYPING: 'message:typing',

  // Call events
  CALL_INCOMING: 'call:incoming',
  CALL_ACCEPTED: 'call:accepted',
  CALL_REJECTED: 'call:rejected',
  CALL_ENDED: 'call:ended',
  CALL_MISSED: 'call:missed',

  // Stream events
  STREAM_STARTED: 'stream:started',
  STREAM_ENDED: 'stream:ended',
  STREAM_VIEWER_JOINED: 'stream:viewer:joined',
  STREAM_VIEWER_LEFT: 'stream:viewer:left',
  STREAM_CHAT_MESSAGE: 'stream:chat:message',
  STREAM_GIFT_SENT: 'stream:gift:sent',

  // Notification events
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',

  // User events
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  USER_STATUS_CHANGED: 'user:status:changed',

  // Token events
  TOKEN_BALANCE_UPDATED: 'token:balance:updated',
  TOKEN_TRANSACTION: 'token:transaction'
};

class RealtimeService {
  constructor() {
    this.ws = null;
    this.url = null;
    this.isConnected = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.connectionTimer = null;
    this.listeners = new Map();
    this.eventQueue = [];
    this.userId = null;
    this.token = null;
    this.reconnectDelay = WS_RECONNECT_DELAY;
    this.lastActivity = Date.now();
  }

  /**
   * Initialize the service with connection details
   * @param {Object} config - Configuration options
   */
  init(config = {}) {
    const {
      url = this.buildWebSocketUrl(),
      userId,
      token,
      autoConnect = true
    } = config;

    this.url = url;
    this.userId = userId;
    this.token = token || localStorage.getItem('accessToken');

    devLog('RealtimeService initialized:', {
      url: this.url,
      userId: this.userId,
      hasToken: !!this.token
    });

    if (autoConnect && this.userId && this.token) {
      this.connect();
    }
  }

  /**
   * Build WebSocket URL from environment
   */
  buildWebSocketUrl() {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
    const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = backendUrl.replace(/^https?:\/\//, '');
    return `${wsProtocol}://${wsHost}/ws`;
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      devLog('Already connected to WebSocket');
      return Promise.resolve();
    }

    if (this.isReconnecting) {
      devLog('Already reconnecting...');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        devLog('Connecting to WebSocket:', this.url);

        // Add auth token to URL
        const urlWithAuth = `${this.url}?token=${this.token}`;
        this.ws = new WebSocket(urlWithAuth);

        // Connection timeout
        this.connectionTimer = setTimeout(() => {
          if (this.ws.readyState !== WebSocket.OPEN) {
            devError('WebSocket connection timeout');
            this.ws.close();
            reject(new Error('Connection timeout'));
          }
        }, WS_CONNECTION_TIMEOUT);

        // Connection opened
        this.ws.onopen = () => {
          clearTimeout(this.connectionTimer);
          this.isConnected = true;
          this.isReconnecting = false;
          this.reconnectAttempts = 0;
          this.reconnectDelay = WS_RECONNECT_DELAY;

          devLog('WebSocket connected');

          // Send authentication
          this.send({
            type: 'auth',
            userId: this.userId,
            token: this.token
          });

          // Start heartbeat
          this.startHeartbeat();

          // Flush queued events
          this.flushEventQueue();

          // Emit connected event
          this.emit(EVENTS.CONNECTED);

          resolve();
        };

        // Message received
        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        // Connection closed
        this.ws.onclose = (event) => {
          clearTimeout(this.connectionTimer);
          this.isConnected = false;

          devLog('WebSocket closed:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          });

          this.stopHeartbeat();
          this.emit(EVENTS.DISCONNECTED, { code: event.code, reason: event.reason });

          // Auto-reconnect if not a clean close
          if (!event.wasClean && event.code !== 1000) {
            this.scheduleReconnect();
          }
        };

        // Connection error
        this.ws.onerror = (error) => {
          clearTimeout(this.connectionTimer);
          devError('WebSocket error:', error);
          this.emit(EVENTS.ERROR, error);
          reject(error);
        };

      } catch (error) {
        devError('Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }

    this.stopHeartbeat();
    this.isReconnecting = false;

    if (this.ws) {
      this.ws.onclose = null; // Prevent auto-reconnect
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.isConnected = false;
    devLog('WebSocket disconnected');
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (this.isReconnecting) return;

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.reconnectDelay * Math.pow(WS_RECONNECT_DECAY, this.reconnectAttempts - 1),
      WS_MAX_RECONNECT_DELAY
    );

    devLog(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.emit(EVENTS.RECONNECTING, { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Connection failed, will auto-retry
      });
    }, delay);
  }

  /**
   * Handle incoming WebSocket message
   */
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      this.lastActivity = Date.now();

      devLog('WebSocket message received:', data);

      // Handle heartbeat
      if (data.type === 'pong') {
        return;
      }

      // Map server events to our event types
      const eventType = this.mapServerEvent(data.type);

      if (eventType) {
        this.emit(eventType, data.data || data);
      }

      // Also emit raw event for backward compatibility
      this.emit(data.type, data.data || data);

    } catch (error) {
      devError('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Map server event types to our standardized events
   */
  mapServerEvent(serverType) {
    const eventMap = {
      'new_message': EVENTS.MESSAGE_NEW,
      'message_sent': EVENTS.MESSAGE_SENT,
      'message_delivered': EVENTS.MESSAGE_DELIVERED,
      'message_read': EVENTS.MESSAGE_READ,
      'typing': EVENTS.MESSAGE_TYPING,
      'incoming_call': EVENTS.CALL_INCOMING,
      'call_accepted': EVENTS.CALL_ACCEPTED,
      'call_rejected': EVENTS.CALL_REJECTED,
      'call_ended': EVENTS.CALL_ENDED,
      'stream_started': EVENTS.STREAM_STARTED,
      'stream_ended': EVENTS.STREAM_ENDED,
      'stream_chat': EVENTS.STREAM_CHAT_MESSAGE,
      'notification': EVENTS.NOTIFICATION_NEW,
      'user_online': EVENTS.USER_ONLINE,
      'user_offline': EVENTS.USER_OFFLINE,
      'balance_updated': EVENTS.TOKEN_BALANCE_UPDATED
    };

    return eventMap[serverType];
  }

  /**
   * Send data through WebSocket
   */
  send(data) {
    if (!this.isConnected || this.ws?.readyState !== WebSocket.OPEN) {
      devLog('Queueing event (not connected):', data);
      this.eventQueue.push(data);

      // If offline, use offline queue for certain events
      if (!navigator.onLine && data.type === 'message') {
        offlineQueue.queueMessage(data);
      }
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(message);
      devLog('WebSocket message sent:', data);
      return true;
    } catch (error) {
      devError('Failed to send WebSocket message:', error);
      this.eventQueue.push(data);
      return false;
    }
  }

  /**
   * Flush queued events
   */
  flushEventQueue() {
    if (this.eventQueue.length === 0) return;

    devLog(`Flushing ${this.eventQueue.length} queued events`);

    const queue = [...this.eventQueue];
    this.eventQueue = [];

    queue.forEach(data => {
      this.send(data);
    });
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping' });

        // Check for stale connection
        if (Date.now() - this.lastActivity > WS_HEARTBEAT_INTERVAL * 3) {
          devLog('Connection appears stale, reconnecting...');
          this.ws.close();
        }
      }
    }, WS_HEARTBEAT_INTERVAL);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event).add(callback);
    devLog(`Subscribed to event: ${event}`);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event
   */
  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event to all listeners
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          devError(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Send a message
   */
  sendMessage(conversationId, content, options = {}) {
    return this.send({
      type: 'message',
      conversationId,
      content,
      ...options
    });
  }

  /**
   * Send typing indicator
   */
  sendTyping(conversationId, isTyping = true) {
    return this.send({
      type: 'typing',
      conversationId,
      isTyping
    });
  }

  /**
   * Join a stream room
   */
  joinStream(streamId) {
    return this.send({
      type: 'join_stream',
      streamId
    });
  }

  /**
   * Leave a stream room
   */
  leaveStream(streamId) {
    return this.send({
      type: 'leave_stream',
      streamId
    });
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isReconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts,
      queuedEvents: this.eventQueue.length
    };
  }
}

// Create singleton instance
export const realtimeService = new RealtimeService();

// Export for testing
export { RealtimeService };

// React hook for using realtime service
import { useEffect, useState, useCallback } from 'react';

export function useRealtime(events = {}) {
  const [status, setStatus] = useState(() => realtimeService.getStatus());

  useEffect(() => {
    // Update status on connection changes
    const handleStatusChange = () => {
      setStatus(realtimeService.getStatus());
    };

    const unsubscribers = [
      realtimeService.on(EVENTS.CONNECTED, handleStatusChange),
      realtimeService.on(EVENTS.DISCONNECTED, handleStatusChange),
      realtimeService.on(EVENTS.RECONNECTING, handleStatusChange)
    ];

    // Subscribe to user events
    Object.entries(events).forEach(([event, handler]) => {
      unsubscribers.push(realtimeService.on(event, handler));
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  const send = useCallback((data) => realtimeService.send(data), []);
  const sendMessage = useCallback((conversationId, content, options) =>
    realtimeService.sendMessage(conversationId, content, options), []);
  const sendTyping = useCallback((conversationId, isTyping) =>
    realtimeService.sendTyping(conversationId, isTyping), []);

  return {
    ...status,
    send,
    sendMessage,
    sendTyping,
    service: realtimeService
  };
}

// Export default
export default realtimeService;