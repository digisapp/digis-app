import { io } from 'socket.io-client';
import { getAuthToken, refreshSession, retry, supabase, isSupabaseConfigured } from '../utils/supabase-auth-enhanced';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.connectionPromise = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.connectionListeners = [];
    this.errorListeners = [];
  }

  async connect() {
    try {
      // If already connected, return immediately
      if (this.isConnected && this.socket?.connected) {
        console.log('Socket already connected');
        return Promise.resolve();
      }
      
      // If already connecting, return the existing promise
      if (this.isConnecting && this.connectionPromise) {
        console.log('Connection already in progress, returning existing promise');
        return this.connectionPromise;
      }
      
      // If socket exists but disconnected, just reconnect
      if (this.socket && !this.socket.connected) {
        console.log('Reconnecting existing socket');
        this.isConnecting = true;
        this.connectionPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.isConnecting = false;
            this.connectionPromise = null;
            reject(new Error('Socket reconnection timeout'));
          }, 10000);
          
          this.socket.connect();
          
          this.socket.once('connect', () => {
            clearTimeout(timeout);
            this.isConnecting = false;
            this.connectionPromise = null;
            resolve();
          });
          
          this.socket.once('connect_error', (error) => {
            clearTimeout(timeout);
            this.isConnecting = false;
            this.connectionPromise = null;
            reject(error);
          });
        });
        return this.connectionPromise;
      }

      // Check if Supabase is configured
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured - check environment variables');
      }

      // Validate socket URL
      const socketUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      if (!socketUrl || !socketUrl.startsWith('http')) {
        console.warn('Invalid or missing VITE_BACKEND_URL, using default: http://localhost:3001');
      }

      // Get the auth token with enhanced error handling
      const token = await this.getAuthToken();
      if (!token) {
        console.warn('No authentication token available - skipping socket connection');
        // Don't attempt connection without a valid token to avoid errors
        this.isConnecting = false;
        this.connectionPromise = null;
        return Promise.resolve();
      }

      // Mark as connecting
      this.isConnecting = true;

      this.socket = io(socketUrl, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling'],
        reconnection: false, // Disable auto-reconnection to control it manually
        reconnectionAttempts: 0,
        timeout: 20000,
        autoConnect: true,
        path: '/socket.io/'
      });

      this.setupEventHandlers();
      
      this.connectionPromise = new Promise((resolve, reject) => {
        const connectTimeout = setTimeout(() => {
          this.isConnecting = false;
          this.connectionPromise = null;
          reject(new Error('Socket connection timeout'));
        }, 30000);

        this.socket.on('connect', () => {
          clearTimeout(connectTimeout);
          this.isConnected = true;
          this.isConnecting = false;
          this.connectionPromise = null;
          this.reconnectAttempts = 0;
          console.log('Socket connected successfully');
          this.notifyConnectionListeners('connected');
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          clearTimeout(connectTimeout);
          this.isConnecting = false;
          this.connectionPromise = null;
          // Silently handle common connection errors
          if (!error.message?.includes('Server error')) {
            console.warn('Socket connection issue:', error.message);
          }
          // Don't attempt reconnection for authentication issues during initial connect
          if (error.message?.includes('Invalid token') || error.message?.includes('Authentication')) {
            // Silently fail - socket not required for basic functionality
            this.socket?.disconnect();
            this.socket = null;
          }
          reject(error);
        });
      });
      
      return this.connectionPromise;
    } catch (error) {
      console.error('Failed to connect socket:', error);
      this.notifyErrorListeners(error);
      throw error;
    }
  }

  async getAuthToken() {
    try {
      // Use enhanced getAuthToken which handles automatic refresh
      const token = await getAuthToken();
      return token;
    } catch (error) {
      console.error('Failed to get auth token:', error);
      this.notifyErrorListeners(error);
      return null;
    }
  }

  setupEventHandlers() {
    // Don't setup handlers if no socket
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log('Socket connected with ID:', this.socket.id);
      this.notifyConnectionListeners('connected');
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log('Socket disconnected:', reason);
      this.notifyConnectionListeners('disconnected', reason);
      
      // Handle different disconnect reasons
      if (reason === 'io server disconnect') {
        // Server disconnected, need to manually reconnect
        console.log('Server disconnected socket, attempting reconnection...');
        this.reconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      this.handleConnectionError(error);
    });

    // Enhanced error handling
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.notifyErrorListeners(error);
      
      // Handle specific error types
      if (error.message?.includes('Authentication')) {
        console.log('Authentication error, refreshing token...');
        this.refreshAuthAndReconnect();
      }
    });

    // Connection success confirmation from server
    this.socket.on('connection-success', (data) => {
      console.log('Connection confirmed by server:', data);
      this.notifyConnectionListeners('confirmed', data);
    });

    // Handle rate limit errors
    this.socket.on('error', (errorData) => {
      if (errorData.message?.includes('Rate limit')) {
        console.warn('Rate limit hit:', errorData);
        const retryAfter = errorData.retryAfter || 1;
        setTimeout(() => {
          console.log('Retrying after rate limit...');
        }, retryAfter * 1000);
      }
    });

    // Application event handlers
    const events = [
      'balance-updated',
      'viewer-count',
      'stream-analytics',
      'notification',
      'stream-ended',
      'user-presence',
      'user-presence-list',
      'user-typing',
      'chat-message' // Add support for VirtualGifts
    ];
    
    events.forEach(event => {
      this.socket.on(event, (data) => {
        console.log(`${event} received:`, data);
        this.emitToListeners(event, data);
      });
    });
  }

  // Handle connection errors with exponential backoff
  handleConnectionError(error) {
    // Check if it's a resource limit error
    if (error?.message?.includes('Insufficient resources') || 
        error?.message?.includes('transport error')) {
      console.warn('Socket resource limit reached - will retry with backoff');
      // Wait longer before retrying on resource errors
      this.reconnectDelay = 5000;
    }
    
    // Stop if we're already at max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // Silently stop - socket is optional for basic functionality
      if (this.socket) {
        this.socket.disconnect();
        this.socket.removeAllListeners();
        this.socket = null; // Clear the socket reference
      }
      this.isConnected = false;
      return;
    }
    
    this.reconnectAttempts++;
    
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      10000
    );
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnect();
      }
    }, delay);
  }

  async refreshAuthAndReconnect() {
    try {
      // Refresh the session with retry logic
      const { session, error } = await retry(
        () => refreshSession(),
        3, // 3 retries
        1000, // 1 second delay
        true // exponential backoff
      );
      
      if (error || !session) {
        throw new Error('Failed to refresh authentication');
      }

      // Update socket auth
      if (this.socket) {
        this.socket.auth.token = session.access_token;
        this.socket.connect();
      }
    } catch (error) {
      console.error('Failed to refresh auth:', error);
      this.notifyErrorListeners(error);
    }
  }

  async reconnect() {
    if (this.isConnected) {
      console.log('Already connected, skipping reconnection');
      return;
    }

    try {
      // Get fresh auth token
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token for reconnection');
      }

      if (!this.socket) {
        // Create new connection if socket is null
        await this.connect();
      } else {
        // Update existing socket auth
        this.socket.auth.token = token;
        this.socket.connect();
      }
    } catch (error) {
      console.error('Reconnection failed:', error);
      this.handleConnectionError(error);
    }
  }

  // Stream-related methods with promises
  joinStream(streamId) {
    // Prevent rapid calls
    if (this.lastJoinStream === streamId && Date.now() - this.lastJoinTime < 1000) {
      return Promise.resolve({ streamId, cached: true });
    }
    
    this.lastJoinStream = streamId;
    this.lastJoinTime = Date.now();
    
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('join-stream', streamId);

      // Listen for confirmation
      const confirmHandler = (data) => {
        if (data.streamId === streamId) {
          this.socket.off('stream-joined', confirmHandler);
          resolve(data);
        }
      };

      const errorHandler = (error) => {
        if (error.event === 'join-stream') {
          this.socket.off('error', errorHandler);
          reject(new Error(error.message));
        }
      };

      this.socket.on('stream-joined', confirmHandler);
      this.socket.on('error', errorHandler);

      // Timeout
      setTimeout(() => {
        this.socket.off('stream-joined', confirmHandler);
        this.socket.off('error', errorHandler);
        reject(new Error('Join stream timeout'));
      }, 10000);
    });
  }

  leaveStream(streamId) {
    // Prevent rapid calls
    if (this.lastLeaveStream === streamId && Date.now() - this.lastLeaveTime < 1000) {
      return Promise.resolve({ streamId, cached: true });
    }
    
    this.lastLeaveStream = streamId;
    this.lastLeaveTime = Date.now();
    
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('leave-stream', streamId);

      // Listen for confirmation
      const confirmHandler = (data) => {
        if (data.streamId === streamId) {
          this.socket.off('stream-left', confirmHandler);
          resolve(data);
        }
      };

      this.socket.on('stream-left', confirmHandler);

      // Timeout
      setTimeout(() => {
        this.socket.off('stream-left', confirmHandler);
        resolve(); // Resolve anyway after timeout
      }, 5000);
    });
  }


  // Enhanced event listeners with cleanup
  on(event, callback) {
    if (!this.socket) {
      console.warn(`Cannot listen to '${event}' - socket not initialized`);
      return () => {};
    }

    // Store listener reference
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Add listener to socket
    this.socket.on(event, callback);

    // Return cleanup function
    return () => {
      this.off(event, callback);
    };
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }

    // Remove from stored listeners
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
      if (this.listeners.get(event).size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  once(event, callback) {
    if (!this.socket) {
      console.warn(`Cannot listen to '${event}' once - socket not initialized`);
      return () => {};
    }

    const wrappedCallback = (...args) => {
      callback(...args);
      this.off(event, wrappedCallback);
    };

    return this.on(event, wrappedCallback);
  }

  // Emit events to local listeners only
  emitToListeners(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Event emitters with validation - emit to server
  emit(event, data) {
    if (!this.isConnected) {
      console.warn(`Cannot emit '${event}' - socket not connected`);
      return false;
    }

    try {
      this.socket.emit(event, data);
      // Also emit to local listeners
      this.emitToListeners(event, data);
      return true;
    } catch (error) {
      console.error(`Error emitting '${event}':`, error);
      return false;
    }
  }

  // Alias for backwards compatibility
  sendEvent(event, data) {
    return this.emit(event, data);
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      console.log('Disconnecting socket...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.notifyConnectionListeners('disconnected', 'manual');
    }
  }

  // Connection state listeners
  onConnectionChange(callback) {
    this.connectionListeners.push(callback);
    return () => {
      const index = this.connectionListeners.indexOf(callback);
      if (index > -1) {
        this.connectionListeners.splice(index, 1);
      }
    };
  }

  onError(callback) {
    this.errorListeners.push(callback);
    return () => {
      const index = this.errorListeners.indexOf(callback);
      if (index > -1) {
        this.errorListeners.splice(index, 1);
      }
    };
  }

  notifyConnectionListeners(status, data) {
    this.connectionListeners.forEach(callback => {
      try {
        callback(status, data);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  notifyErrorListeners(error) {
    this.errorListeners.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        console.error('Error in error listener:', err);
      }
    });
  }

  // Cleanup all listeners
  cleanup() {
    console.log('Cleaning up socket service...');
    
    // Cancel any pending connection attempt
    this.isConnecting = false;
    this.connectionPromise = null;
    
    // Disconnect socket first if connected
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
    
    // Reset reconnection attempts
    this.reconnectAttempts = 0;
    
    // Clear all listeners
    this.listeners.clear();
    this.connectionListeners = [];
    this.errorListeners = [];
  }

  // Get connection status
  getStatus() {
    return {
      isConnected: this.isConnected,
      socketId: this.socket?.id || null,
      reconnectAttempts: this.reconnectAttempts,
      hasActiveListeners: this.listeners.size > 0
    };
  }
  
  // Presence
  updatePresence(status) {
    if (!['online', 'away', 'busy', 'offline'].includes(status)) {
      console.error('Invalid presence status:', status);
      return false;
    }
    return this.emit('update-presence', status);
  }
  
  getUserPresence(userIds) {
    return new Promise((resolve, reject) => {
      if (!Array.isArray(userIds) || userIds.length === 0) {
        reject(new Error('Invalid user IDs'));
        return;
      }

      this.emit('get-user-presence', userIds);

      const responseHandler = (data) => {
        this.off('user-presence-list', responseHandler);
        resolve(data);
      };

      this.on('user-presence-list', responseHandler);

      // Timeout
      setTimeout(() => {
        this.off('user-presence-list', responseHandler);
        reject(new Error('Get presence timeout'));
      }, 5000);
    });
  }
  
  // Typing indicators
  startTyping(channel, recipientId = null) {
    this.emit('typing-start', { channel, recipientId });
  }

  stopTyping(channel, recipientId = null) {
    this.emit('typing-stop', { channel, recipientId });
  }

  // Update stream analytics
  updateStreamAnalytics(data) {
    return this.emit('update-stream-analytics', data);
  }

  // Get the underlying socket instance
  getSocket() {
    if (!this.socket) {
      console.warn('Socket not initialized');
      return null;
    }
    return this.socket;
  }
}

// Create singleton instance
const socketService = new SocketService();

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    socketService.cleanup();
  });
}

export default socketService;