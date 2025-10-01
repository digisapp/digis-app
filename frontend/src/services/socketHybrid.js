import io from 'socket.io-client';
import { ENV } from '../config/env';
import useHybridStore from '../stores/useHybridStore';

class SocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.wasConnected = false; // Track if we ever had a successful connection
  }

  /**
   * Connect to socket server with authentication
   */
  connect(userId, token) {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    this.socket = io(ENV.BACKEND_URL, {
      auth: { token, userId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    });

    this.setupEventHandlers();
    this.setupStoreIntegration();
  }

  /**
   * Setup core event handlers
   */
  setupEventHandlers() {
    const store = useHybridStore.getState();

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Socket connected');
      this.wasConnected = true; // Mark that we've successfully connected at least once
      this.reconnectAttempts = 0;
      
      // Sync online status
      const user = store.user;
      if (user) {
        this.socket.emit('user:online', { userId: user.id });
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected, manually reconnect
        this.reconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.handleReconnect();
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      store.addNotification({
        type: 'error',
        title: 'Connection Error',
        message: 'Lost connection to server. Trying to reconnect...',
        timestamp: Date.now()
      });
    });
  }

  /**
   * Setup integration with Zustand store
   */
  setupStoreIntegration() {
    const store = useHybridStore.getState();

    // Chat events
    this.socket.on('message:new', (data) => {
      store.addMessage(data.channelId, data.message);
      
      // Increment unread if not in active channel
      const activeChannel = store.activeChannel;
      if (data.channelId !== activeChannel) {
        store.incrementUnread(data.channelId);
      }
      
      // Add notification for direct messages
      if (data.isDirect) {
        store.addNotification({
          type: 'message',
          title: `New message from ${data.message.sender}`,
          message: data.message.text,
          data: { channelId: data.channelId },
          timestamp: Date.now()
        });
      }
    });

    this.socket.on('typing:start', (data) => {
      store.setTypingUser(data.channelId, data.userId, true);
    });

    this.socket.on('typing:stop', (data) => {
      store.setTypingUser(data.channelId, data.userId, false);
    });

    this.socket.on('user:online', (data) => {
      store.setOnlineUser(data.userId, true);
    });

    this.socket.on('user:offline', (data) => {
      store.setOnlineUser(data.userId, false);
    });

    this.socket.on('users:online', (data) => {
      store.setOnlineUsers(data.userIds);
    });

    // Notification events
    this.socket.on('notification:new', (notification) => {
      store.addNotification(notification);
    });

    this.socket.on('call:incoming', (callData) => {
      store.setIncomingCall(callData);
      
      // Play ringtone
      this.playSound('ringtone');
    });
    
    // Handle call request (appears as message in chat)
    this.socket.on('call:request', (callRequest) => {
      // Add call request as a message in the active conversation
      store.addMessage(callRequest.conversation_id || callRequest.receiver_id, {
        ...callRequest,
        type: 'call_request',
        id: callRequest.id || `call-request-${Date.now()}`,
        timestamp: new Date().toISOString()
      });
      
      // Also show notification if not in active chat
      const activeConversation = store.activeChannel;
      if (activeConversation !== callRequest.conversation_id) {
        store.addNotification({
          id: `call-notif-${Date.now()}`,
          type: 'call_request',
          title: `${callRequest.caller.name} wants to call`,
          message: `${callRequest.callType === 'video' ? 'Video' : 'Voice'} call - ${callRequest.ratePerMinute} tokens/min`,
          timestamp: Date.now(),
          read: false,
          data: callRequest
        });
      }
      
      // Play subtle notification sound
      this.playSound('notification');
    });
    
    // Handle call acceptance
    this.socket.on('call:accepted', (data) => {
      // Update message status in store
      store.updateMessage(data.conversation_id, data.callId, { status: 'accepted' });
      
      // Show notification to creator
      store.addNotification({
        type: 'success',
        title: 'Call Accepted',
        message: 'Your call request has been accepted. Connecting...',
        timestamp: Date.now()
      });
    });
    
    // Handle call decline
    this.socket.on('call:declined', (data) => {
      // Update message status in store
      store.updateMessage(data.conversation_id, data.callId, { status: 'declined' });
      
      // Show notification to creator
      store.addNotification({
        type: 'info',
        title: 'Call Declined',
        message: 'Your call request was declined',
        timestamp: Date.now()
      });
    });
    
    // Handle call cancellation
    this.socket.on('call:cancelled', (data) => {
      // Update message status in store
      store.updateMessage(data.conversation_id, data.callId, { status: 'cancelled' });
    });

    this.socket.on('call:ended', () => {
      store.clearIncomingCall();
    });

    // Stream events
    this.socket.on('stream:started', (streamData) => {
      // Add stream alert if following this creator
      const user = store.user;
      if (user && streamData.creatorId !== user.id) {
        store.addStreamAlert({
          creatorId: streamData.creatorId,
          creatorName: streamData.creatorName,
          streamTitle: streamData.title,
          type: 'live'
        });
      }
      
      // Update active streams list
      store.addActiveStream(streamData);
    });

    this.socket.on('stream:ended', (streamId) => {
      store.removeActiveStream(streamId);
    });

    this.socket.on('stream:viewers', (data) => {
      const currentStream = store.currentStream;
      if (currentStream?.id === data.streamId) {
        store.setViewerCount(data.count);
      }
    });

    this.socket.on('stream:tip', (data) => {
      store.incrementStreamStat('tips', data.amount);
      store.addMessage(data.streamId, {
        id: Date.now().toString(),
        type: 'tip',
        sender: data.sender,
        text: `tipped ${data.amount} tokens`,
        amount: data.amount,
        timestamp: Date.now()
      });
    });

    // Token balance updates
    this.socket.on('tokens:updated', (data) => {
      store.setTokenBalance(data.balance);
      
      if (data.reason) {
        store.addNotification({
          type: 'info',
          title: 'Token Balance Updated',
          message: data.reason,
          timestamp: Date.now()
        });
      }
    });

    this.socket.on('tokens:received', (data) => {
      store.updateTokenBalance(data.amount);
      store.addNotification({
        type: 'tip',
        title: 'Tokens Received!',
        message: `${data.senderName} sent you ${data.amount} tokens`,
        data: { amount: data.amount, senderId: data.senderId },
        timestamp: Date.now()
      });
    });
  }

  /**
   * Emit events with store integration
   */
  
  // Chat methods
  sendMessage(channelId, message) {
    const store = useHybridStore.getState();
    const user = store.user;
    
    if (!user) return;
    
    const messageData = {
      channelId,
      message: {
        id: Date.now().toString(),
        text: message,
        sender: user.name || user.email,
        senderId: user.id,
        timestamp: Date.now()
      }
    };
    
    // Optimistically add to store
    store.addMessage(channelId, messageData.message);
    
    // Emit to server
    this.socket.emit('message:send', messageData);
  }

  startTyping(channelId) {
    const store = useHybridStore.getState();
    const user = store.user;
    
    if (!user) return;
    
    this.socket.emit('typing:start', { channelId, userId: user.id });
    store.setTypingUser(channelId, user.id, true);
  }

  stopTyping(channelId) {
    const store = useHybridStore.getState();
    const user = store.user;
    
    if (!user) return;
    
    this.socket.emit('typing:stop', { channelId, userId: user.id });
    store.setTypingUser(channelId, user.id, false);
  }

  joinChannel(channelId) {
    const store = useHybridStore.getState();
    store.setActiveChannel(channelId);
    this.socket.emit('channel:join', { channelId });
  }

  leaveChannel(channelId) {
    this.socket.emit('channel:leave', { channelId });
  }

  // Stream methods
  startStream(streamData) {
    const store = useHybridStore.getState();
    store.startStream(streamData);
    this.socket.emit('stream:start', streamData);
  }

  endStream(streamId) {
    const store = useHybridStore.getState();
    store.endStream();
    this.socket.emit('stream:end', { streamId });
  }

  updateViewerCount(streamId, count) {
    this.socket.emit('stream:viewers', { streamId, count });
  }

  sendStreamTip(streamId, amount, message) {
    const store = useHybridStore.getState();
    const user = store.user;
    
    if (!user) return;
    
    this.socket.emit('stream:tip', {
      streamId,
      amount,
      message,
      sender: user.name || user.email,
      senderId: user.id
    });
  }

  // Call methods
  initiateCall(targetUserId, callType = 'video') {
    const store = useHybridStore.getState();
    const user = store.user;
    
    if (!user) return;
    
    this.socket.emit('call:initiate', {
      targetUserId,
      callType,
      callerId: user.id,
      callerName: user.name || user.email
    });
  }

  acceptCall(callId) {
    const store = useHybridStore.getState();
    store.clearIncomingCall();
    this.socket.emit('call:accept', { callId });
  }

  declineCall(callId) {
    const store = useHybridStore.getState();
    store.clearIncomingCall();
    this.socket.emit('call:decline', { callId });
  }

  endCall(callId) {
    this.socket.emit('call:end', { callId });
  }

  // Utility methods
  playSound(type) {
    const sounds = {
      notification: '/sounds/notification.mp3',
      ringtone: '/sounds/ringtone.mp3',
      message: '/sounds/message.mp3',
      tip: '/sounds/tip.mp3'
    };
    
    const audio = new Audio(sounds[type] || sounds.notification);
    audio.volume = 0.5;
    audio.play().catch(e => console.log('Could not play sound:', e));
  }

  /**
   * Handle reconnection with exponential backoff
   */
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      // Only show error notification if we had a connection before
      // This prevents showing error on initial login when backend might still be starting
      if (this.wasConnected) {
        const store = useHybridStore.getState();
        store.addNotification({
          type: 'error',
          title: 'Connection Lost',
          message: 'Lost connection to server. Please check your internet connection.',
          timestamp: Date.now()
        });
      } else {
        // For initial connection failures, just log silently
        console.log('Initial connection failed, backend might still be starting');
      }
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Reconnecting in ${delay}ms... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.reconnect();
    }, delay);
  }

  /**
   * Manually reconnect
   */
  reconnect() {
    const store = useHybridStore.getState();
    const user = store.user;
    
    if (user && this.socket) {
      this.socket.connect();
    }
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Add custom event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Remove custom event listener
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
    
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  /**
   * Emit custom event
   */
  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }

  /**
   * Get connection status
   */
  isConnected() {
    return this.socket?.connected || false;
  }
}

// Create singleton instance
const socketService = new SocketService();

// Auto-connect when user is available
if (typeof window !== 'undefined') {
  // Subscribe to auth changes
  useHybridStore.subscribe(
    (state) => state.user,
    (user) => {
      if (user && !socketService.isConnected()) {
        // Get token and connect
        const token = localStorage.getItem('supabase.auth.token');
        if (token) {
          socketService.connect(user.id, token);
        }
      } else if (!user && socketService.isConnected()) {
        // Disconnect if user logs out
        socketService.disconnect();
      }
    }
  );
}

export default socketService;