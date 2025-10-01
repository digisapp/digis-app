import toast from 'react-hot-toast';

// Retry helper function
const retry = async (fn, maxRetries = 3, delay = 1000) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        console.warn(`Retry attempt ${i + 1}/${maxRetries} after error:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
};

class AgoraSignaling {
  constructor(appId, options = {}) {
    // Validate required parameters
    if (!appId) {
      throw new Error('appId is required');
    }
    if (typeof appId !== 'string') {
      throw new Error('appId must be a string');
    }
    if (typeof options !== 'object') {
      throw new Error('options must be an object');
    }
    
    this.appId = appId;
    this.options = {
      enablePresence: options.enablePresence !== false,
      enableStorage: options.enableStorage !== false,
      enableLocks: options.enableLocks !== false,
      region: options.region || 'GLOBAL',
      logLevel: options.logLevel || 'warning',
      ...options
    };
    
    this.rtmClient = null;
    this.uid = null;
    this.channels = new Map();
    this.streamChannels = new Map();
    this.presenceData = new Map();
    this.storage = new Map();
    this.locks = new Map();
    this.isConnected = false;
    
    // Event handlers
    this.eventHandlers = {
      connectionStateChanged: [],
      messageReceived: [],
      presenceUpdated: [],
      storageUpdated: [],
      lockAcquired: [],
      lockReleased: [],
      topicMessage: []
    };
  }

  async initialize() {
    try {
      // Dynamically import Agora RTM SDK
      const AgoraRTM = await import('agora-rtm-sdk');
      
      if (!AgoraRTM || !AgoraRTM.RTM) {
        throw new Error('Agora RTM SDK not loaded properly');
      }
      
      // Create RTM client
      this.rtmClient = new AgoraRTM.RTM(this.appId, this.uid, {
        logLevel: this.options.logLevel,
        cloudProxy: false,
        presenceTimeout: 300, // 5 minutes
        useStringUserId: true,
        region: this.options.region
      });
      
      // Set up event listeners
      this.setupEventListeners();
      
      console.log('✅ Agora Signaling (RTM) initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize Agora Signaling:', error);
      throw error; // Propagate error for retry logic
    }
  }

  setupEventListeners() {
    if (!this.rtmClient) return;

    // Connection state changes
    this.rtmClient.addEventListener('connection-state-changed', (state) => {
      this.isConnected = state.currentState === 'CONNECTED';
      this.emit('connectionStateChanged', state);
      
      if (this.isConnected) {
        console.log('✅ Connected to Agora Signaling');
        // toast.success('Real-time signaling connected', {
        //   duration: 2000,
        //   icon: '🔗'
        // });
      }
    });

    // Message from peer
    this.rtmClient.addEventListener('message-from-peer', (message) => {
      this.handlePeerMessage(message);
    });

    // Presence events
    if (this.options.enablePresence) {
      this.rtmClient.addEventListener('presence-event', (event) => {
        this.handlePresenceEvent(event);
      });
    }

    // Storage events
    if (this.options.enableStorage) {
      this.rtmClient.addEventListener('storage-event', (event) => {
        this.handleStorageEvent(event);
      });
    }

    // Lock events
    if (this.options.enableLocks) {
      this.rtmClient.addEventListener('lock-event', (event) => {
        this.handleLockEvent(event);
      });
    }
  }

  async login(uid, token = null) {
    // Validate parameters
    if (!uid) {
      throw new Error('uid is required');
    }
    
    if (!this.rtmClient) {
      await retry(() => this.initialize(), 3, 1000);
    }

    try {
      this.uid = uid;
      
      // Login with retry logic
      await retry(async () => {
        await this.rtmClient.login({
          uid: uid.toString(),
          token: token
        });
      }, 3, 1000);

      this.isConnected = true;
      console.log(`✅ Logged in to Agora Signaling as ${uid}`);
      return true;
    } catch (error) {
      console.error('Agora Signaling login failed:', error);
      toast.error('Failed to connect to real-time signaling');
      return false;
    }
  }

  async logout() {
    try {
      // Leave all channels
      for (const [channelName, channel] of this.channels) {
        await this.leaveChannel(channelName);
      }
      
      // Leave all stream channels
      for (const [channelName, channel] of this.streamChannels) {
        await this.leaveStreamChannel(channelName);
      }

      await this.rtmClient.logout();
      this.isConnected = false;
      console.log('Logged out from Agora Signaling');
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  // Message Channels
  async createChannel(channelName) {
    // Validate parameters
    if (!channelName || typeof channelName !== 'string') {
      throw new Error('channelName must be a non-empty string');
    }
    if (!this.rtmClient) {
      throw new Error('RTM client not initialized');
    }
    
    try {
      const channel = this.rtmClient.createChannel(channelName);
      this.channels.set(channelName, channel);
      
      // Set up channel event listeners
      channel.on('ChannelMessage', (message, memberId) => {
        this.emit('messageReceived', {
          channel: channelName,
          message: message.text || message,
          senderId: memberId,
          timestamp: Date.now()
        });
      });

      channel.on('MemberJoined', (memberId) => {
        this.updatePresence(channelName, memberId, 'joined');
      });

      channel.on('MemberLeft', (memberId) => {
        this.updatePresence(channelName, memberId, 'left');
      });

      console.log(`Created message channel: ${channelName}`);
      return channel;
    } catch (error) {
      console.error(`Failed to create channel ${channelName}:`, error);
      return null;
    }
  }

  async joinChannel(channelName) {
    try {
      let channel = this.channels.get(channelName);
      if (!channel) {
        channel = await this.createChannel(channelName);
      }

      await channel.join();
      console.log(`Joined channel: ${channelName}`);
      
      // Get initial member list
      const members = await channel.getMembers();
      this.updateChannelPresence(channelName, members);
      
      return true;
    } catch (error) {
      console.error(`Failed to join channel ${channelName}:`, error);
      return false;
    }
  }

  async leaveChannel(channelName) {
    try {
      const channel = this.channels.get(channelName);
      if (channel) {
        await channel.leave();
        channel.removeAllListeners();
        this.channels.delete(channelName);
        console.log(`Left channel: ${channelName}`);
      }
      return true;
    } catch (error) {
      console.error(`Failed to leave channel ${channelName}:`, error);
      return false;
    }
  }

  async sendChannelMessage(channelName, message, options = {}) {
    // Validate parameters
    if (!channelName || typeof channelName !== 'string') {
      throw new Error('channelName must be a non-empty string');
    }
    if (message === undefined || message === null) {
      throw new Error('message is required');
    }
    
    try {
      const channel = this.channels.get(channelName);
      if (!channel) {
        throw new Error(`Not in channel: ${channelName}`);
      }

      const rtmMessage = {
        text: typeof message === 'string' ? message : JSON.stringify(message),
        messageType: options.type || 'TEXT',
        ...options
      };

      // Send message with retry
      await retry(() => channel.sendMessage(rtmMessage), 3, 500);
      return true;
    } catch (error) {
      console.error(`Failed to send message to ${channelName}:`, error);
      return false;
    }
  }

  // Stream Channels
  async createStreamChannel(channelName) {
    try {
      const streamChannel = await this.rtmClient.createStreamChannel(channelName);
      this.streamChannels.set(channelName, streamChannel);
      
      // Set up stream channel event listeners
      streamChannel.on('StreamMessage', (message) => {
        this.emit('messageReceived', {
          channel: channelName,
          message: message.data,
          senderId: message.publisher,
          timestamp: message.timestamp,
          isStream: true
        });
      });

      console.log(`Created stream channel: ${channelName}`);
      return streamChannel;
    } catch (error) {
      console.error(`Failed to create stream channel ${channelName}:`, error);
      return null;
    }
  }

  async joinStreamChannel(channelName, options = {}) {
    try {
      let streamChannel = this.streamChannels.get(channelName);
      if (!streamChannel) {
        streamChannel = await this.createStreamChannel(channelName);
      }

      await streamChannel.join({
        token: options.token,
        withPresence: options.withPresence !== false,
        withMetadata: options.withMetadata !== false,
        withLock: this.options.enableLocks
      });

      console.log(`Joined stream channel: ${channelName}`);
      return true;
    } catch (error) {
      console.error(`Failed to join stream channel ${channelName}:`, error);
      return false;
    }
  }

  async leaveStreamChannel(channelName) {
    try {
      const streamChannel = this.streamChannels.get(channelName);
      if (streamChannel) {
        await streamChannel.leave();
        streamChannel.removeAllListeners();
        this.streamChannels.delete(channelName);
        console.log(`Left stream channel: ${channelName}`);
      }
      return true;
    } catch (error) {
      console.error(`Failed to leave stream channel ${channelName}:`, error);
      return false;
    }
  }

  // Topics (for Stream Channels)
  async subscribeTopic(channelName, topic, options = {}) {
    // Validate parameters
    if (!channelName || typeof channelName !== 'string') {
      throw new Error('channelName must be a non-empty string');
    }
    if (!topic || typeof topic !== 'string') {
      throw new Error('topic must be a non-empty string');
    }
    
    try {
      const streamChannel = this.streamChannels.get(channelName);
      if (!streamChannel) {
        throw new Error(`Not in stream channel: ${channelName}`);
      }

      await retry(() => streamChannel.subscribeTopic(topic, {
        users: options.users || [],
        dataOrdering: options.ordered !== false
      }), 3, 1000);

      console.log(`Subscribed to topic: ${topic} in channel: ${channelName}`);
      return true;
    } catch (error) {
      console.error(`Failed to subscribe to topic ${topic}:`, error);
      return false;
    }
  }

  async unsubscribeTopic(channelName, topic) {
    try {
      const streamChannel = this.streamChannels.get(channelName);
      if (!streamChannel) {
        throw new Error(`Not in stream channel: ${channelName}`);
      }

      await streamChannel.unsubscribeTopic(topic);
      console.log(`Unsubscribed from topic: ${topic}`);
      return true;
    } catch (error) {
      console.error(`Failed to unsubscribe from topic ${topic}:`, error);
      return false;
    }
  }

  async publishToTopic(channelName, topic, message, options = {}) {
    try {
      const streamChannel = this.streamChannels.get(channelName);
      if (!streamChannel) {
        throw new Error(`Not in stream channel: ${channelName}`);
      }

      await streamChannel.publishTopic(topic, {
        data: typeof message === 'string' ? message : JSON.stringify(message),
        customType: options.type || 'MESSAGE',
        ...options
      });

      return true;
    } catch (error) {
      console.error(`Failed to publish to topic ${topic}:`, error);
      return false;
    }
  }

  // Presence Management
  async updatePresence(channelName, userId, status) {
    const channelPresence = this.presenceData.get(channelName) || new Map();
    channelPresence.set(userId, {
      status,
      timestamp: Date.now(),
      customAttributes: {}
    });
    this.presenceData.set(channelName, channelPresence);

    this.emit('presenceUpdated', {
      channel: channelName,
      userId,
      status,
      presence: Array.from(channelPresence.entries())
    });
  }

  async setState(channelName, attributes) {
    try {
      const channel = this.channels.get(channelName) || this.streamChannels.get(channelName);
      if (!channel) {
        throw new Error(`Not in channel: ${channelName}`);
      }

      await this.rtmClient.presence.setState(channelName, attributes);
      console.log(`Updated presence state in ${channelName}`);
      return true;
    } catch (error) {
      console.error(`Failed to set presence state:`, error);
      return false;
    }
  }

  async getPresence(channelName) {
    try {
      const result = await this.rtmClient.presence.getPresence(channelName, {
        includeUserId: true,
        includeState: true
      });

      return result.userStateList || [];
    } catch (error) {
      console.error(`Failed to get presence for ${channelName}:`, error);
      return [];
    }
  }

  // Storage
  async setChannelMetadata(channelName, key, value, options = {}) {
    try {
      if (!this.options.enableStorage) {
        throw new Error('Storage is not enabled');
      }

      await this.rtmClient.storage.setChannelMetadata(channelName, {
        [key]: {
          value: typeof value === 'string' ? value : JSON.stringify(value),
          revision: options.revision || -1,
          lock: options.lock || null
        }
      });

      // Update local cache
      const channelStorage = this.storage.get(channelName) || new Map();
      channelStorage.set(key, value);
      this.storage.set(channelName, channelStorage);

      console.log(`Set metadata ${key} in channel ${channelName}`);
      return true;
    } catch (error) {
      console.error(`Failed to set channel metadata:`, error);
      return false;
    }
  }

  async getChannelMetadata(channelName, keys = []) {
    try {
      if (!this.options.enableStorage) {
        throw new Error('Storage is not enabled');
      }

      const result = await this.rtmClient.storage.getChannelMetadata(channelName, {
        keys: keys.length > 0 ? keys : undefined
      });

      return result.data || {};
    } catch (error) {
      console.error(`Failed to get channel metadata:`, error);
      return {};
    }
  }

  // Locks
  async acquireLock(channelName, lockName, ttl = 10) {
    // Validate parameters
    if (!channelName || typeof channelName !== 'string') {
      throw new Error('channelName must be a non-empty string');
    }
    if (!lockName || typeof lockName !== 'string') {
      throw new Error('lockName must be a non-empty string');
    }
    if (typeof ttl !== 'number' || ttl <= 0) {
      throw new Error('ttl must be a positive number');
    }
    
    try {
      if (!this.options.enableLocks) {
        throw new Error('Locks are not enabled');
      }

      await retry(() => this.rtmClient.lock.acquireLock(channelName, lockName, {
        ttl: ttl * 1000 // Convert to milliseconds
      }), 3, 1000);

      this.locks.set(`${channelName}:${lockName}`, {
        acquired: true,
        timestamp: Date.now(),
        ttl
      });

      this.emit('lockAcquired', { channel: channelName, lock: lockName });
      console.log(`Acquired lock: ${lockName} in channel: ${channelName}`);
      return true;
    } catch (error) {
      console.error(`Failed to acquire lock ${lockName}:`, error);
      return false;
    }
  }

  async releaseLock(channelName, lockName) {
    try {
      if (!this.options.enableLocks) {
        throw new Error('Locks are not enabled');
      }

      await this.rtmClient.lock.releaseLock(channelName, lockName);
      
      this.locks.delete(`${channelName}:${lockName}`);
      this.emit('lockReleased', { channel: channelName, lock: lockName });
      
      console.log(`Released lock: ${lockName}`);
      return true;
    } catch (error) {
      console.error(`Failed to release lock ${lockName}:`, error);
      return false;
    }
  }

  // Event handling
  on(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(handler);
    }
  }

  off(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
    }
  }

  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(data));
    }
  }

  // Helper methods
  handlePeerMessage(message) {
    this.emit('messageReceived', {
      message: message.text,
      senderId: message.peerId,
      timestamp: Date.now(),
      isPeer: true
    });
  }

  handlePresenceEvent(event) {
    const { channelName, channelType, snapshot } = event;
    
    // Update local presence cache
    if (snapshot) {
      const channelPresence = new Map();
      snapshot.forEach(user => {
        channelPresence.set(user.userId, {
          status: 'online',
          state: user.state || {},
          timestamp: Date.now()
        });
      });
      this.presenceData.set(channelName, channelPresence);
    }

    this.emit('presenceUpdated', event);
  }

  handleStorageEvent(event) {
    const { channelName, data } = event;
    
    // Update local storage cache
    const channelStorage = this.storage.get(channelName) || new Map();
    Object.entries(data).forEach(([key, value]) => {
      channelStorage.set(key, value);
    });
    this.storage.set(channelName, channelStorage);

    this.emit('storageUpdated', event);
  }

  handleLockEvent(event) {
    const { channelName, lockName, lockOwner } = event;
    
    if (event.eventType === 'ACQUIRED') {
      this.emit('lockAcquired', { channel: channelName, lock: lockName, owner: lockOwner });
    } else if (event.eventType === 'RELEASED') {
      this.emit('lockReleased', { channel: channelName, lock: lockName });
    }
  }

  updateChannelPresence(channelName, members) {
    const channelPresence = new Map();
    members.forEach(memberId => {
      channelPresence.set(memberId, {
        status: 'online',
        timestamp: Date.now()
      });
    });
    this.presenceData.set(channelName, channelPresence);
  }

  // Get connection status
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      uid: this.uid,
      channels: Array.from(this.channels.keys()),
      streamChannels: Array.from(this.streamChannels.keys()),
      presenceEnabled: this.options.enablePresence,
      storageEnabled: this.options.enableStorage,
      locksEnabled: this.options.enableLocks
    };
  }

  // Cleanup
  async destroy() {
    await this.logout();
    this.channels.clear();
    this.streamChannels.clear();
    this.presenceData.clear();
    this.storage.clear();
    this.locks.clear();
    this.eventHandlers = {
      connectionStateChanged: [],
      messageReceived: [],
      presenceUpdated: [],
      storageUpdated: [],
      lockAcquired: [],
      lockReleased: [],
      topicMessage: []
    };
  }
}

export default AgoraSignaling;