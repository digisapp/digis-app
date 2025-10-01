import toast from 'react-hot-toast';

class AgoraChat {
  constructor(appKey, options = {}) {
    this.appKey = appKey;
    this.options = {
      apiUrl: options.apiUrl || 'https://api.agora.io',
      isHttpDNS: options.isHttpDNS !== false,
      delivery: options.delivery !== false, // Delivery receipts
      read: options.read !== false, // Read receipts
      autoLogin: options.autoLogin !== false,
      heartBeatWait: options.heartBeatWait || 30000,
      enableWebRTC: options.enableWebRTC !== false,
      ...options
    };
    
    this.connection = null;
    this.currentUser = null;
    this.isConnected = false;
    this.conversations = new Map();
    this.messages = new Map();
    this.presence = new Map();
    this.typingUsers = new Map();
    
    // Event handlers
    this.eventHandlers = {
      connected: [],
      disconnected: [],
      messageReceived: [],
      presenceUpdated: [],
      typingStatusChanged: [],
      readReceiptReceived: [],
      deliveryReceiptReceived: [],
      messageRecalled: [],
      contactEvent: [],
      groupEvent: []
    };
    
    // Message types
    this.messageTypes = {
      TEXT: 'txt',
      IMAGE: 'img',
      AUDIO: 'audio',
      VIDEO: 'video',
      FILE: 'file',
      LOCATION: 'loc',
      CUSTOM: 'custom',
      CMD: 'cmd'
    };
  }

  async initialize() {
    try {
      // Import Agora Chat SDK
      const AgoraChat = await import('agora-chat');
      
      // Create connection
      this.connection = new AgoraChat.connection({
        appKey: this.appKey,
        ...this.options
      });
      
      // Set up event listeners
      this.setupEventListeners();
      
      console.log('✅ Agora Chat SDK initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize Agora Chat:', error);
      return false;
    }
  }

  setupEventListeners() {
    if (!this.connection) return;

    // Connection events
    this.connection.addEventHandler('connection', {
      onConnected: () => {
        this.isConnected = true;
        this.emit('connected');
        console.log('✅ Connected to Agora Chat');
        // toast.success('Chat connected', { duration: 2000 });
      },
      
      onDisconnected: () => {
        this.isConnected = false;
        this.emit('disconnected');
        console.log('Disconnected from Agora Chat');
      },
      
      onError: (error) => {
        console.error('Agora Chat error:', error);
        toast.error(`Chat error: ${error.message}`);
      }
    });

    // Message events
    this.connection.addEventHandler('message', {
      onTextMessage: (message) => {
        this.handleMessage(message, 'text');
      },
      
      onImageMessage: (message) => {
        this.handleMessage(message, 'image');
      },
      
      onAudioMessage: (message) => {
        this.handleMessage(message, 'audio');
      },
      
      onVideoMessage: (message) => {
        this.handleMessage(message, 'video');
      },
      
      onFileMessage: (message) => {
        this.handleMessage(message, 'file');
      },
      
      onLocationMessage: (message) => {
        this.handleMessage(message, 'location');
      },
      
      onCustomMessage: (message) => {
        this.handleMessage(message, 'custom');
      },
      
      onCmdMessage: (message) => {
        this.handleCommandMessage(message);
      },
      
      onRecallMessage: (message) => {
        this.handleRecallMessage(message);
      },
      
      onDeliveryReceipt: (message) => {
        this.emit('deliveryReceiptReceived', message);
      },
      
      onReadReceipt: (message) => {
        this.emit('readReceiptReceived', message);
      }
    });

    // Presence events
    this.connection.addEventHandler('presence', {
      onPresence: (event) => {
        this.handlePresenceEvent(event);
      }
    });

    // Contact events
    this.connection.addEventHandler('contact', {
      onContactInvited: (msg) => {
        this.emit('contactEvent', { type: 'invited', data: msg });
      },
      
      onContactDeleted: (msg) => {
        this.emit('contactEvent', { type: 'deleted', data: msg });
      },
      
      onContactAdded: (msg) => {
        this.emit('contactEvent', { type: 'added', data: msg });
      },
      
      onContactRefuse: (msg) => {
        this.emit('contactEvent', { type: 'refused', data: msg });
      },
      
      onContactAgreed: (msg) => {
        this.emit('contactEvent', { type: 'agreed', data: msg });
      }
    });

    // Group events
    this.connection.addEventHandler('group', {
      onGroupEvent: (event) => {
        this.emit('groupEvent', event);
      }
    });
  }

  async login(username, password) {
    if (!this.connection) {
      await this.initialize();
    }

    try {
      const result = await this.connection.open({
        user: username,
        pwd: password
      });

      this.currentUser = {
        username,
        userId: result.user.userId,
        token: result.accessToken
      };

      this.isConnected = true;
      console.log(`✅ Logged in to Agora Chat as ${username}`);
      
      // Subscribe to presence
      await this.subscribePresence();
      
      // Load conversations
      await this.loadConversations();
      
      return true;
    } catch (error) {
      console.error('Agora Chat login failed:', error);
      toast.error('Failed to login to chat');
      return false;
    }
  }

  async loginWithToken(username, token) {
    if (!this.connection) {
      await this.initialize();
    }

    try {
      await this.connection.open({
        user: username,
        accessToken: token
      });

      this.currentUser = { username, token };
      this.isConnected = true;
      console.log(`✅ Logged in to Agora Chat with token`);
      
      await this.subscribePresence();
      await this.loadConversations();
      
      return true;
    } catch (error) {
      console.error('Token login failed:', error);
      return false;
    }
  }

  async logout() {
    try {
      await this.connection.close();
      this.isConnected = false;
      this.currentUser = null;
      this.conversations.clear();
      this.messages.clear();
      this.presence.clear();
      console.log('Logged out from Agora Chat');
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  // Message sending
  async sendTextMessage(to, text, chatType = 'singleChat', options = {}) {
    try {
      const message = this.connection.createTextMessage({
        chatType, // 'singleChat', 'groupChat', 'chatRoom'
        type: this.messageTypes.TEXT,
        to,
        msg: text,
        ext: options.ext || {}, // Extension fields
        ...options
      });

      // Request delivery receipt
      if (this.options.delivery) {
        message.setDeliveryReceipt(true);
      }

      const result = await this.connection.send(message);
      
      // Store message locally
      this.storeMessage(result.message);
      
      return result.message;
    } catch (error) {
      console.error('Failed to send text message:', error);
      toast.error('Failed to send message');
      throw error;
    }
  }

  async sendImageMessage(to, file, chatType = 'singleChat', options = {}) {
    try {
      const message = this.connection.createImageMessage({
        chatType,
        type: this.messageTypes.IMAGE,
        to,
        file,
        width: options.width || 360,
        height: options.height || 360,
        onFileUploadProgress: options.onProgress,
        onFileUploadComplete: options.onComplete,
        onFileUploadError: options.onError,
        ext: options.ext || {}
      });

      const result = await this.connection.send(message);
      this.storeMessage(result.message);
      
      return result.message;
    } catch (error) {
      console.error('Failed to send image:', error);
      throw error;
    }
  }

  async sendAudioMessage(to, file, length, chatType = 'singleChat', options = {}) {
    try {
      const message = this.connection.createAudioMessage({
        chatType,
        type: this.messageTypes.AUDIO,
        to,
        file,
        length, // Audio duration in seconds
        onFileUploadProgress: options.onProgress,
        onFileUploadComplete: options.onComplete,
        onFileUploadError: options.onError,
        ext: options.ext || {}
      });

      const result = await this.connection.send(message);
      this.storeMessage(result.message);
      
      return result.message;
    } catch (error) {
      console.error('Failed to send audio:', error);
      throw error;
    }
  }

  async sendVideoMessage(to, file, length, chatType = 'singleChat', options = {}) {
    try {
      const message = this.connection.createVideoMessage({
        chatType,
        type: this.messageTypes.VIDEO,
        to,
        file,
        length, // Video duration in seconds
        onFileUploadProgress: options.onProgress,
        onFileUploadComplete: options.onComplete,
        onFileUploadError: options.onError,
        ext: options.ext || {}
      });

      const result = await this.connection.send(message);
      this.storeMessage(result.message);
      
      return result.message;
    } catch (error) {
      console.error('Failed to send video:', error);
      throw error;
    }
  }

  async sendFileMessage(to, file, chatType = 'singleChat', options = {}) {
    try {
      const message = this.connection.createFileMessage({
        chatType,
        type: this.messageTypes.FILE,
        to,
        file,
        filename: file.name,
        filesize: file.size,
        onFileUploadProgress: options.onProgress,
        onFileUploadComplete: options.onComplete,
        onFileUploadError: options.onError,
        ext: options.ext || {}
      });

      const result = await this.connection.send(message);
      this.storeMessage(result.message);
      
      return result.message;
    } catch (error) {
      console.error('Failed to send file:', error);
      throw error;
    }
  }

  async sendLocationMessage(to, latitude, longitude, address, chatType = 'singleChat', options = {}) {
    try {
      const message = this.connection.createLocationMessage({
        chatType,
        type: this.messageTypes.LOCATION,
        to,
        addr: address,
        lat: latitude,
        lng: longitude,
        ext: options.ext || {}
      });

      const result = await this.connection.send(message);
      this.storeMessage(result.message);
      
      return result.message;
    } catch (error) {
      console.error('Failed to send location:', error);
      throw error;
    }
  }

  async sendCustomMessage(to, customEvent, customExts, chatType = 'singleChat', options = {}) {
    try {
      const message = this.connection.createCustomMessage({
        chatType,
        type: this.messageTypes.CUSTOM,
        to,
        customEvent,
        customExts,
        ext: options.ext || {}
      });

      const result = await this.connection.send(message);
      this.storeMessage(result.message);
      
      return result.message;
    } catch (error) {
      console.error('Failed to send custom message:', error);
      throw error;
    }
  }

  // Typing indicators
  async sendTypingCommand(to, action = 'start') {
    try {
      const message = this.connection.createCmdMessage({
        chatType: 'singleChat',
        type: this.messageTypes.CMD,
        to,
        action: action === 'start' ? 'typing_start' : 'typing_stop',
        ext: { timestamp: Date.now() }
      });

      await this.connection.send(message);
      return true;
    } catch (error) {
      console.error('Failed to send typing indicator:', error);
      return false;
    }
  }

  // Message management
  async recallMessage(messageId) {
    try {
      await this.connection.recallMessage({
        mid: messageId,
        to: this.getMessageById(messageId)?.to,
        chatType: this.getMessageById(messageId)?.chatType
      });
      
      // toast.success('Message recalled');
      return true;
    } catch (error) {
      console.error('Failed to recall message:', error);
      toast.error('Failed to recall message');
      return false;
    }
  }

  async deleteMessage(messageId) {
    try {
      // Delete from server
      await this.connection.deleteMessage({
        messageId
      });
      
      // Delete from local storage
      this.messages.delete(messageId);
      
      return true;
    } catch (error) {
      console.error('Failed to delete message:', error);
      return false;
    }
  }

  // Read receipts
  async sendReadReceipt(message) {
    try {
      const readMessage = this.connection.createReadMessage({
        id: message.id,
        to: message.from,
        chatType: message.chatType
      });
      
      await this.connection.send(readMessage);
      return true;
    } catch (error) {
      console.error('Failed to send read receipt:', error);
      return false;
    }
  }

  // Conversations
  async loadConversations() {
    try {
      const result = await this.connection.getConversationlist();
      
      result.data.forEach(conv => {
        this.conversations.set(conv.conversationId, conv);
      });
      
      return Array.from(this.conversations.values());
    } catch (error) {
      console.error('Failed to load conversations:', error);
      return [];
    }
  }

  async getConversation(conversationId, type = 'singleChat') {
    try {
      const conversation = await this.connection.getConversation({
        conversationId,
        type
      });
      
      this.conversations.set(conversationId, conversation);
      return conversation;
    } catch (error) {
      console.error('Failed to get conversation:', error);
      return null;
    }
  }

  async deleteConversation(conversationId) {
    try {
      await this.connection.deleteConversation({
        conversationId
      });
      
      this.conversations.delete(conversationId);
      return true;
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      return false;
    }
  }

  // Message history
  async getMessageHistory(targetId, chatType = 'singleChat', options = {}) {
    try {
      const result = await this.connection.getHistoryMessages({
        targetId,
        chatType,
        pageSize: options.pageSize || 20,
        cursor: options.cursor || null,
        searchDirection: options.searchDirection || 'up'
      });
      
      // Store messages locally
      result.messages.forEach(msg => {
        this.storeMessage(msg);
      });
      
      return result;
    } catch (error) {
      console.error('Failed to get message history:', error);
      return { messages: [], cursor: null };
    }
  }

  // Presence
  async subscribePresence(userIds = []) {
    try {
      await this.connection.subscribePresence({
        userIds,
        expiry: 7 * 24 * 3600 // 7 days
      });
      
      return true;
    } catch (error) {
      console.error('Failed to subscribe presence:', error);
      return false;
    }
  }

  async publishPresence(description = '') {
    try {
      await this.connection.publishPresence({
        description
      });
      
      return true;
    } catch (error) {
      console.error('Failed to publish presence:', error);
      return false;
    }
  }

  async getPresenceStatus(userIds) {
    try {
      const result = await this.connection.getPresenceStatus({
        userIds
      });
      
      // Update local presence cache
      result.result.forEach(status => {
        this.presence.set(status.userId, status);
      });
      
      return result.result;
    } catch (error) {
      console.error('Failed to get presence status:', error);
      return [];
    }
  }

  // Groups
  async createGroup(groupName, description, members = [], options = {}) {
    try {
      const result = await this.connection.createGroup({
        data: {
          groupname: groupName,
          desc: description,
          members,
          public: options.public !== false,
          approval: options.approval || false,
          inviteNeedConfirm: options.inviteNeedConfirm || false,
          maxusers: options.maxUsers || 200,
          ext: options.ext || {}
        }
      });
      
      return result.data;
    } catch (error) {
      console.error('Failed to create group:', error);
      throw error;
    }
  }

  async joinGroup(groupId) {
    try {
      await this.connection.joinGroup({
        groupId
      });
      
      // toast.success('Joined group successfully');
      return true;
    } catch (error) {
      console.error('Failed to join group:', error);
      toast.error('Failed to join group');
      return false;
    }
  }

  async leaveGroup(groupId) {
    try {
      await this.connection.quitGroup({
        groupId
      });
      
      return true;
    } catch (error) {
      console.error('Failed to leave group:', error);
      return false;
    }
  }

  // Translation
  async translateMessage(message, targetLanguages) {
    try {
      const result = await this.connection.translateMessage({
        msgId: message.id,
        languages: targetLanguages
      });
      
      return result.data;
    } catch (error) {
      console.error('Failed to translate message:', error);
      return null;
    }
  }

  // Push notifications
  async updatePushNickname(nickname) {
    try {
      await this.connection.updateOwnUserInfo({
        nickname
      });
      
      return true;
    } catch (error) {
      console.error('Failed to update push nickname:', error);
      return false;
    }
  }

  async setPushDisplayStyle(style = 'summary') {
    try {
      await this.connection.updatePushDisplayStyle({
        displayStyle: style // 'simple' or 'summary'
      });
      
      return true;
    } catch (error) {
      console.error('Failed to set push display style:', error);
      return false;
    }
  }

  // Helper methods
  handleMessage(message, type) {
    // Store message
    this.storeMessage(message);
    
    // Mark as delivered if enabled
    if (this.options.delivery && message.from !== this.currentUser?.username) {
      this.connection.sendDeliveryReceipt(message);
    }
    
    // Emit event
    this.emit('messageReceived', {
      message,
      type,
      conversation: message.chatType === 'singleChat' ? message.from : message.to
    });
    
    // Show notification for certain types
    if (type === 'text') {
      toast.custom((t) => (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 max-w-sm">
          <p className="font-medium text-gray-900 dark:text-white">{message.from}</p>
          <p className="text-gray-600 dark:text-gray-400">{message.msg}</p>
        </div>
      ), { duration: 4000 });
    }
  }

  handleCommandMessage(message) {
    // Handle typing indicators
    if (message.action === 'typing_start') {
      this.typingUsers.set(message.from, Date.now());
      this.emit('typingStatusChanged', { user: message.from, typing: true });
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        this.typingUsers.delete(message.from);
        this.emit('typingStatusChanged', { user: message.from, typing: false });
      }, 5000);
    } else if (message.action === 'typing_stop') {
      this.typingUsers.delete(message.from);
      this.emit('typingStatusChanged', { user: message.from, typing: false });
    }
  }

  handleRecallMessage(message) {
    // Remove from local storage
    this.messages.delete(message.mid);
    
    // Emit event
    this.emit('messageRecalled', message);
  }

  handlePresenceEvent(event) {
    // Update presence cache
    this.presence.set(event.userId, {
      status: event.status,
      description: event.description,
      timestamp: Date.now()
    });
    
    this.emit('presenceUpdated', event);
  }

  storeMessage(message) {
    this.messages.set(message.id, message);
    
    // Update conversation last message
    const conversationId = message.chatType === 'singleChat' 
      ? (message.from === this.currentUser?.username ? message.to : message.from)
      : message.to;
      
    const conversation = this.conversations.get(conversationId) || {
      conversationId,
      type: message.chatType,
      unreadCount: 0
    };
    
    conversation.lastMessage = message;
    conversation.lastMessageTime = message.time;
    
    if (message.from !== this.currentUser?.username) {
      conversation.unreadCount++;
    }
    
    this.conversations.set(conversationId, conversation);
  }

  getMessageById(messageId) {
    return this.messages.get(messageId);
  }

  getTypingUsers() {
    const now = Date.now();
    const active = [];
    
    for (const [user, timestamp] of this.typingUsers.entries()) {
      if (now - timestamp < 5000) {
        active.push(user);
      } else {
        this.typingUsers.delete(user);
      }
    }
    
    return active;
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

  // Get connection status
  getStatus() {
    return {
      connected: this.isConnected,
      user: this.currentUser,
      conversations: this.conversations.size,
      messages: this.messages.size,
      typingUsers: this.getTypingUsers()
    };
  }

  // Cleanup
  async destroy() {
    await this.logout();
    this.conversations.clear();
    this.messages.clear();
    this.presence.clear();
    this.typingUsers.clear();
    this.eventHandlers = {
      connected: [],
      disconnected: [],
      messageReceived: [],
      presenceUpdated: [],
      typingStatusChanged: [],
      readReceiptReceived: [],
      deliveryReceiptReceived: [],
      messageRecalled: [],
      contactEvent: [],
      groupEvent: []
    };
  }
}

export default AgoraChat;