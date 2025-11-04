/**
 * Ably Real-time Service (Socket.io replacement for Vercel)
 *
 * Drop-in replacement for socketService.js with the same API.
 * Provides real-time messaging with Ably instead of Socket.io.
 *
 * Migration benefits:
 * - Works on Vercel serverless (no persistent connections needed)
 * - Automatic reconnection and message history
 * - Presence and typing indicators built-in
 * - Global CDN for low-latency worldwide
 */

import * as Ably from 'ably';

class AblyService {
  constructor() {
    this.client = null;
    this.channels = new Map();
    this.isConnected = false;
    this.isConnecting = false;
    this.connectionPromise = null;
    this.listeners = new Map();
    this.connectionListeners = [];
    this.errorListeners = [];
    this.userId = null;
    this.userRole = null;
  }

  /**
   * Connect to Ably using token authentication
   * Token endpoint prevents API key exposure
   * @param {string} streamId - Optional streamId for scoped capabilities
   */
  async connect(streamId = null) {
    try {
      // If already connected, return immediately
      if (this.isConnected && this.client) {
        console.log('Ably already connected');
        return Promise.resolve();
      }

      // If already connecting, return existing promise
      if (this.isConnecting && this.connectionPromise) {
        console.log('Ably connection in progress, returning existing promise');
        return this.connectionPromise;
      }

      // Mark as connecting
      this.isConnecting = true;

      // Get auth token from backend (prevents API key exposure)
      // Note: VITE_BACKEND_URL already includes /api/v1
      const authUrl = `${import.meta.env.VITE_BACKEND_URL}/realtime/ably/token`;

      // Get current user for clientId
      const token = await this.getAuthToken();

      // Build auth params with streamId for scoped capabilities
      const authParams = {};
      if (streamId) {
        authParams.streamId = streamId;
      }

      // Initialize Ably client with token authentication
      this.client = new Ably.Realtime({
        authUrl,
        authMethod: 'POST',
        authParams, // Pass streamId to backend for scoped token
        authHeaders: token ? {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        } : {},
        // Custom auth callback to handle 404 errors gracefully
        authCallback: async (tokenParams, callback) => {
          try {
            const response = await fetch(authUrl, {
              method: 'POST',
              headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(authParams)
            });

            if (response.status === 404) {
              console.log('ℹ️ Ably token endpoint not available yet - real-time features disabled');
              callback(new Error('Ably not configured'), null);
              this.isConnecting = false;
              this.connectionPromise = null;
              return;
            }

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const tokenRequest = await response.json();
            callback(null, tokenRequest);
          } catch (error) {
            console.error('Ably auth error:', error);
            callback(error, null);
            this.isConnecting = false;
            this.connectionPromise = null;
          }
        },
        // Automatic reconnection with exponential backoff
        disconnectedRetryTimeout: 15000, // Increase to 15s to reduce retries
        suspendedRetryTimeout: 30000, // Increase to 30s
        // Disable automatic connection to prevent immediate retry
        autoConnect: false,
        // Enable message history (last 50 messages on rejoin)
        recover: (lastConnectionDetails, callback) => {
          callback(true); // Always try to recover
        },
        // Echo messages (needed for some use cases)
        echoMessages: true,
        // Enable connection state recovery
        closeOnUnload: true
      });

      this.setupConnectionHandlers();

      // Wait for connection
      this.connectionPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.isConnecting = false;
          this.connectionPromise = null;
          console.log('ℹ️ Ably connection timeout - continuing without real-time features');
          resolve(); // Resolve instead of reject to not break the app
        }, 30000);

        this.client.connection.once('connected', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.isConnecting = false;
          this.connectionPromise = null;
          console.log('✅ Ably connected:', this.client.auth.clientId);
          this.userId = this.client.auth.clientId;
          this.notifyConnectionListeners('connected');
          resolve();
        });

        this.client.connection.once('failed', (error) => {
          clearTimeout(timeout);
          this.isConnecting = false;
          this.connectionPromise = null;
          console.log('ℹ️ Ably connection failed - continuing without real-time features');
          resolve(); // Resolve instead of reject to not break the app
        });
      });

      // Manually trigger connection since autoConnect is false
      this.client.connect();

      return this.connectionPromise;
    } catch (error) {
      console.log('ℹ️ Failed to initialize Ably - continuing without real-time features');
      this.isConnecting = false;
      this.notifyErrorListeners(error);
      // Don't throw - allow app to continue without real-time features
      return Promise.resolve();
    }
  }

  /**
   * Get authentication token from Supabase
   */
  async getAuthToken() {
    try {
      const { getAuthToken } = await import('../utils/supabase-auth');
      return await getAuthToken();
    } catch (error) {
      console.warn('No auth token available');
      return null;
    }
  }

  /**
   * Setup connection state handlers
   */
  setupConnectionHandlers() {
    if (!this.client) return;

    this.client.connection.on('connected', () => {
      this.isConnected = true;
      console.log('[Ably] ✅ Connected');
      this.notifyConnectionListeners('connected');
    });

    this.client.connection.on('connecting', () => {
      console.log('[Ably] 🔄 Connecting...');
      this.notifyConnectionListeners('connecting');
    });

    this.client.connection.on('disconnected', () => {
      this.isConnected = false;
      console.log('[Ably] ⚠️  Disconnected');
      this.notifyConnectionListeners('disconnected');
    });

    this.client.connection.on('suspended', () => {
      this.isConnected = false;
      console.log('[Ably] ⏸️  Connection suspended (will retry)');
      this.notifyConnectionListeners('suspended');
    });

    this.client.connection.on('closing', () => {
      console.log('[Ably] 👋 Closing connection...');
      this.notifyConnectionListeners('closing');
    });

    this.client.connection.on('closed', () => {
      this.isConnected = false;
      console.log('[Ably] ❌ Connection closed');
      this.notifyConnectionListeners('closed');
    });

    this.client.connection.on('failed', (error) => {
      this.isConnected = false;
      console.error('[Ably] 💥 Connection failed:', error);
      this.notifyConnectionListeners('failed', error);
      this.notifyErrorListeners(error);
    });

    this.client.connection.on('update', (stateChange) => {
      console.log('[Ably] 🔄 Connection update:', {
        previous: stateChange.previous,
        current: stateChange.current,
        reason: stateChange.reason || 'none'
      });
      this.notifyConnectionListeners('update', stateChange);
    });
  }

  /**
   * Get or create a channel
   * Uses rewind parameter to fetch last 50 messages on join
   */
  getChannel(channelName) {
    if (!this.client) {
      throw new Error('Ably client not initialized');
    }

    if (this.channels.has(channelName)) {
      return this.channels.get(channelName);
    }

    // Create channel with message history rewind
    const channel = this.client.channels.get(channelName, {
      params: {
        rewind: '50' // Get last 50 messages
      }
    });

    this.channels.set(channelName, channel);
    return channel;
  }

  /**
   * Join a stream (Socket.io compatibility)
   */
  async joinStream(streamId) {
    try {
      if (!this.isConnected) {
        console.warn('⚠️ Ably not connected - streaming will continue without real-time features');
        // Return mock response instead of throwing - allow streaming to continue
        return { streamId, viewerCount: 0, timestamp: Date.now(), offline: true };
      }

      const channelName = `stream:${streamId}`;
      const channel = this.getChannel(channelName);

      // Enter presence to track viewers
      await channel.presence.enter({
        userId: this.userId,
        joinedAt: Date.now()
      });

      // Subscribe to stream events
      channel.subscribe((message) => {
        this.emitToListeners(message.name, message.data);
      });

      // Get current viewer count
      const presenceSet = await channel.presence.get();
      const viewerCount = presenceSet.length;

      console.log(`Joined stream ${streamId}, viewers: ${viewerCount}`);

      return { streamId, viewerCount, timestamp: Date.now() };
    } catch (error) {
      console.error('Failed to join stream:', error);
      throw error;
    }
  }

  /**
   * Leave a stream (Socket.io compatibility)
   */
  async leaveStream(streamId) {
    try {
      const channelName = `stream:${streamId}`;

      if (this.channels.has(channelName)) {
        const channel = this.channels.get(channelName);

        // Leave presence
        await channel.presence.leave();

        // Unsubscribe from channel
        channel.unsubscribe();

        // Detach channel to free resources
        await channel.detach();

        this.channels.delete(channelName);
      }

      console.log(`Left stream ${streamId}`);
      return { streamId, timestamp: Date.now() };
    } catch (error) {
      console.error('Failed to leave stream:', error);
      throw error;
    }
  }

  /**
   * Subscribe to events (Socket.io compatibility)
   * Maps Socket.io event names to Ably channel subscriptions
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Map Socket.io events to Ably channels
    const eventMap = {
      'call-request': { channel: `user:${this.userId}`, event: 'call:request' },
      'call-accepted': { channel: `user:${this.userId}`, event: 'call:accepted' },
      'call-rejected': { channel: `user:${this.userId}`, event: 'call:rejected' },
      'call-cancelled': { channel: `user:${this.userId}`, event: 'call:cancelled' },
      'balance-update': { channel: `user:${this.userId}`, event: 'balance:update' },
      'token-balance-update': { channel: `user:${this.userId}`, event: 'balance:update' },
      'message': { channel: `user:${this.userId}`, event: 'message:new' },
      'notification': { channel: `user:${this.userId}`, event: 'notification:new' }
    };

    const mapping = eventMap[event];
    if (mapping && this.client) {
      const channel = this.getChannel(mapping.channel);

      // Subscribe to Ably event and map to callback
      channel.subscribe(mapping.event, (message) => {
        console.log(`📨 Ably event ${mapping.event}:`, message.data);
        // Emit to all listeners registered for this Socket.io event name
        this.emitToListeners(event, message.data);
      });
    }

    // Return cleanup function
    return () => {
      this.off(event, callback);
    };
  }

  /**
   * Unsubscribe from events
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
      if (this.listeners.get(event).size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Subscribe to event once
   */
  once(event, callback) {
    const wrappedCallback = (...args) => {
      callback(...args);
      this.off(event, wrappedCallback);
    };
    return this.on(event, wrappedCallback);
  }

  /**
   * Emit event to listeners
   */
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

  /**
   * Publish event to channel (Socket.io compatibility)
   */
  async emit(event, data) {
    try {
      if (!this.isConnected) {
        console.warn(`Cannot emit '${event}' - not connected`);
        return false;
      }

      // Map Socket.io emit events to Ably channel publishes
      const emitMap = {
        'call-request': {
          channel: (d) => `user:${d.creatorId || d.toUserId}`,
          event: 'call:request'
        },
        'call-response': {
          channel: (d) => `user:${d.fanId || d.fromUserId}`,
          event: d => d.accepted ? 'call:accepted' : 'call:rejected'
        },
        'call-accept': {
          channel: (d) => `user:${d.fromUserId}`,
          event: 'call:accepted'
        },
        'call-reject': {
          channel: (d) => `user:${d.fromUserId}`,
          event: 'call:rejected'
        },
        'call-cancel': {
          channel: (d) => `user:${d.toUserId}`,
          event: 'call:cancelled'
        },
        'message': {
          channel: (d) => `user:${d.toUserId || d.recipientId}`,
          event: 'message:new'
        },
        'join-room': {
          channel: (d) => `stream:${d}`,
          event: 'viewer:joined'
        },
        'leave-room': {
          channel: (d) => `stream:${d}`,
          event: 'viewer:left'
        }
      };

      const mapping = emitMap[event];

      if (mapping) {
        // Get channel name (might be a function)
        const channelName = typeof mapping.channel === 'function'
          ? mapping.channel(data)
          : mapping.channel;

        // Get event name (might be a function)
        const eventName = typeof mapping.event === 'function'
          ? mapping.event(data)
          : mapping.event;

        const channel = this.getChannel(channelName);

        // Publish to Ably channel
        await channel.publish(eventName, data);
        console.log(`📤 Published ${eventName} to ${channelName}`);

        return true;
      } else {
        // Fallback: determine channel based on data
        let channelName = 'chat:general';

        if (data.streamId || data.channel) {
          channelName = `stream:${data.streamId || data.channel}`;
        } else if (data.recipientId || data.toUserId) {
          channelName = `user:${data.recipientId || data.toUserId}`;
        }

        const channel = this.getChannel(channelName);

        // Publish to Ably channel
        await channel.publish(event, data);

        // Also emit to local listeners
        this.emitToListeners(event, data);

        return true;
      }
    } catch (error) {
      console.error(`Error emitting '${event}':`, error);
      return false;
    }
  }

  /**
   * Update presence status
   */
  async updatePresence(status) {
    try {
      const channel = this.getChannel('presence:global');

      await channel.presence.update({
        status,
        lastSeen: Date.now()
      });

      console.log(`Presence updated to: ${status}`);
      return true;
    } catch (error) {
      console.error('Failed to update presence:', error);
      return false;
    }
  }

  /**
   * Get user presence
   */
  async getUserPresence(userIds) {
    try {
      const channel = this.getChannel('presence:global');
      const presenceSet = await channel.presence.get();

      return presenceSet
        .filter(member => userIds.includes(member.clientId))
        .map(member => ({
          userId: member.clientId,
          status: member.data?.status || 'online',
          lastSeen: member.data?.lastSeen || Date.now()
        }));
    } catch (error) {
      console.error('Failed to get presence:', error);
      return [];
    }
  }

  /**
   * Typing indicators
   */
  async startTyping(channel, recipientId = null) {
    try {
      const channelName = recipientId
        ? `user:${recipientId}`
        : `stream:${channel}`;

      const ablyChannel = this.getChannel(channelName);

      await ablyChannel.presence.update({
        isTyping: true
      });

      return true;
    } catch (error) {
      console.error('Failed to start typing:', error);
      return false;
    }
  }

  async stopTyping(channel, recipientId = null) {
    try {
      const channelName = recipientId
        ? `user:${recipientId}`
        : `stream:${channel}`;

      const ablyChannel = this.getChannel(channelName);

      await ablyChannel.presence.update({
        isTyping: false
      });

      return true;
    } catch (error) {
      console.error('Failed to stop typing:', error);
      return false;
    }
  }

  /**
   * Disconnect from Ably
   */
  disconnect() {
    if (this.client) {
      console.log('Disconnecting from Ably...');

      // Leave all presence channels (silently handle auth errors)
      this.channels.forEach(async (channel) => {
        try {
          await channel.presence.leave();
          await channel.detach();
        } catch (error) {
          // Silently handle auth expiry errors during disconnect
          if (error?.message?.includes('authentication') || error?.message?.includes('401') || error?.statusCode === 401) {
            console.log('ℹ️ Channel disconnection skipped (auth expired)');
          } else {
            console.error('Error leaving channel:', error);
          }
        }
      });

      this.client.close();
      this.client = null;
      this.channels.clear();
      this.isConnected = false;
      this.notifyConnectionListeners('disconnected', 'manual');
    }
  }

  /**
   * Connection state listeners
   */
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

  /**
   * Cleanup all resources
   */
  cleanup() {
    console.log('Cleaning up Ably service...');

    this.disconnect();
    this.listeners.clear();
    this.connectionListeners = [];
    this.errorListeners = [];
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      clientId: this.client?.auth?.clientId || null,
      connectionState: this.client?.connection?.state || 'disconnected',
      hasActiveChannels: this.channels.size > 0
    };
  }
}

// Create singleton instance
const ablyService = new AblyService();

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    ablyService.cleanup();
  });
}

export default ablyService;
