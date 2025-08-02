import { io } from 'socket.io-client';
import { supabase } from '../utils/supabase-auth.js';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async connect() {
    if (this.socket && this.connected) {
      console.log('Socket already connected');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user for socket connection');
      return;
    }

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.warn('No auth token available for socket connection');
        // Retry connection after a delay
        setTimeout(() => this.connect(), 5000);
        return;
      }
      
      // Connect to Socket.io server
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      console.log('Connecting to Socket.io server at:', backendUrl);
      
      this.socket = io(backendUrl, {
        auth: {
          token
        },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        timeout: 10000 // 10 second connection timeout
      });

      this.setupEventHandlers();
    } catch (error) {
      console.error('Socket connection error:', error);
      // Retry connection after a delay
      setTimeout(() => this.connect(), 5000);
    }
  }

  setupEventHandlers() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit('connection-status', { connected: true });
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.connected = false;
      this.emit('connection-status', { connected: false });
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.disconnect();
      }
    });

    // Balance update events
    this.socket.on('balance-updated', (data) => {
      console.log('Balance updated:', data);
      this.emit('balance-updated', data);
    });

    // Viewer count events
    this.socket.on('viewer-count', (data) => {
      console.log('Viewer count updated:', data);
      this.emit('viewer-count', data);
    });

    // Stream analytics events
    this.socket.on('stream-analytics', (data) => {
      console.log('Stream analytics updated:', data);
      this.emit('stream-analytics', data);
    });

    // Notification events
    this.socket.on('notification', (data) => {
      console.log('New notification:', data);
      this.emit('notification', data);
    });

    // Stream ended event
    this.socket.on('stream-ended', (data) => {
      console.log('Stream ended:', data);
      this.emit('stream-ended', data);
    });
    
    // Presence events
    this.socket.on('user-presence', (data) => {
      console.log('User presence update:', data);
      this.emit('user-presence', data);
    });
    
    this.socket.on('user-presence-list', (data) => {
      console.log('User presence list:', data);
      this.emit('user-presence-list', data);
    });
    
    // Typing events
    this.socket.on('user-typing', (data) => {
      console.log('Typing indicator:', data);
      this.emit('user-typing', data);
    });
  }

  // Join a stream room
  joinStream(streamId) {
    if (!this.socket || !this.connected) {
      console.error('Socket not connected');
      return;
    }
    
    this.socket.emit('join-stream', streamId);
    console.log(`Joined stream: ${streamId}`);
  }

  // Leave a stream room
  leaveStream(streamId) {
    if (!this.socket || !this.connected) {
      console.error('Socket not connected');
      return;
    }
    
    this.socket.emit('leave-stream', streamId);
    console.log(`Left stream: ${streamId}`);
  }

  // Update stream analytics
  updateStreamAnalytics(data) {
    if (!this.socket || !this.connected) {
      console.error('Socket not connected');
      return;
    }
    
    this.socket.emit('update-stream-analytics', data);
  }

  // Subscribe to events
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  // Emit events to local listeners
  emit(event, data) {
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

  // Send custom event to server
  sendEvent(event, data) {
    if (!this.socket || !this.connected) {
      console.error('Socket not connected');
      return;
    }
    
    this.socket.emit(event, data);
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.listeners.clear();
    }
  }

  // Get connection status
  isConnected() {
    return this.connected;
  }
  
  // Update presence status
  updatePresence(status) {
    if (!this.socket || !this.connected) {
      console.error('Socket not connected');
      return;
    }
    
    this.socket.emit('update-presence', status);
  }
  
  // Get user presence
  getUserPresence(userIds) {
    if (!this.socket || !this.connected) {
      console.error('Socket not connected');
      return;
    }
    
    this.socket.emit('get-user-presence', userIds);
  }
  
  // Start typing
  startTyping(channel, recipientId = null) {
    if (!this.socket || !this.connected) {
      console.error('Socket not connected');
      return;
    }
    
    this.socket.emit('typing-start', { channel, recipientId });
  }
  
  // Stop typing
  stopTyping(channel, recipientId = null) {
    if (!this.socket || !this.connected) {
      console.error('Socket not connected');
      return;
    }
    
    this.socket.emit('typing-stop', { channel, recipientId });
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;