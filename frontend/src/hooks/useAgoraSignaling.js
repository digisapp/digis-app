import { useState, useEffect, useRef, useCallback } from 'react';
import AgoraSignaling from '../utils/AgoraSignaling';
import { supabase } from '../utils/supabase-auth.js';
import toast from 'react-hot-toast';

// Singleton instance
let signalingInstance = null;

export const useAgoraSignaling = (options = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [presence, setPresence] = useState(new Map());
  const [messages, setMessages] = useState([]);
  const [channels, setChannels] = useState([]);
  const [streamChannels, setStreamChannels] = useState([]);
  const [locks, setLocks] = useState(new Map());
  const [metadata, setMetadata] = useState(new Map());
  
  const signalingRef = useRef(null);
  const handlersRef = useRef({});

  // Initialize or get existing instance
  useEffect(() => {
    const initSignaling = async () => {
      if (!signalingInstance) {
        // Get Agora app ID from environment or config
        const appId = process.env.REACT_APP_AGORA_APP_ID;
        if (!appId) {
          console.error('Agora App ID not configured');
          return;
        }

        signalingInstance = new AgoraSignaling(appId, {
          enablePresence: true,
          enableStorage: true,
          enableLocks: true,
          ...options
        });

        await signalingInstance.initialize();
      }

      signalingRef.current = signalingInstance;

      // Set up event listeners
      setupEventListeners();

      // Auto-login if user is authenticated
      const user = supabase.auth.user();
      if (user && !signalingInstance.isConnected) {
        await login(user.id);
      }
    };

    initSignaling();

    return () => {
      // Don't destroy singleton on unmount
      cleanupEventListeners();
    };
  }, []);

  const setupEventListeners = () => {
    if (!signalingRef.current) return;

    // Connection state
    handlersRef.current.connectionStateChanged = (state) => {
      setIsConnected(state.currentState === 'CONNECTED');
    };

    // Messages
    handlersRef.current.messageReceived = (data) => {
      setMessages(prev => [...prev, data]);
      
      // Parse message if it's JSON
      try {
        const parsed = JSON.parse(data.message);
        handleParsedMessage(parsed, data);
      } catch (e) {
        // Handle as text message
      }
    };

    // Presence
    handlersRef.current.presenceUpdated = (data) => {
      setPresence(new Map(signalingRef.current.presenceData));
    };

    // Storage
    handlersRef.current.storageUpdated = (data) => {
      setMetadata(new Map(signalingRef.current.storage));
    };

    // Locks
    handlersRef.current.lockAcquired = (data) => {
      setLocks(new Map(signalingRef.current.locks));
    };

    handlersRef.current.lockReleased = (data) => {
      setLocks(new Map(signalingRef.current.locks));
    };

    // Register all handlers
    Object.entries(handlersRef.current).forEach(([event, handler]) => {
      signalingRef.current.on(event, handler);
    });
  };

  const cleanupEventListeners = () => {
    if (!signalingRef.current) return;

    Object.entries(handlersRef.current).forEach(([event, handler]) => {
      signalingRef.current.off(event, handler);
    });
  };

  const handleParsedMessage = (parsed, data) => {
    // Handle different message types
    switch (parsed.type) {
      case 'stream_event':
        handleStreamEvent(parsed, data);
        break;
      case 'viewer_action':
        handleViewerAction(parsed, data);
        break;
      case 'state_sync':
        handleStateSync(parsed, data);
        break;
      default:
        // Custom handling
        break;
    }
  };

  const handleStreamEvent = (event, data) => {
    // Handle stream-specific events (tips, gifts, etc.)
    switch (event.event) {
      case 'tip':
        toast.custom((t) => (
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-3 rounded-lg shadow-lg">
            💰 {event.sender} sent {event.amount} tokens!
          </div>
        ), { duration: 5000 });
        break;
      case 'gift':
        toast.custom((t) => (
          <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white px-4 py-3 rounded-lg shadow-lg">
            🎁 {event.sender} sent a {event.giftName}!
          </div>
        ), { duration: 5000 });
        break;
    }
  };

  const handleViewerAction = (action, data) => {
    // Handle viewer interactions
    console.log('Viewer action:', action);
  };

  const handleStateSync = (state, data) => {
    // Handle state synchronization
    console.log('State sync:', state);
  };

  // Public methods
  const login = useCallback(async (uid, token = null) => {
    if (!signalingRef.current) return false;
    
    const success = await signalingRef.current.login(uid, token);
    if (success) {
      setIsConnected(true);
      setChannels([]);
      setStreamChannels([]);
    }
    return success;
  }, []);

  const logout = useCallback(async () => {
    if (!signalingRef.current) return false;
    
    const success = await signalingRef.current.logout();
    if (success) {
      setIsConnected(false);
      setChannels([]);
      setStreamChannels([]);
      setMessages([]);
      setPresence(new Map());
    }
    return success;
  }, []);

  const joinChannel = useCallback(async (channelName) => {
    if (!signalingRef.current) return false;
    
    const success = await signalingRef.current.joinChannel(channelName);
    if (success) {
      setChannels(prev => [...new Set([...prev, channelName])]);
    }
    return success;
  }, []);

  const leaveChannel = useCallback(async (channelName) => {
    if (!signalingRef.current) return false;
    
    const success = await signalingRef.current.leaveChannel(channelName);
    if (success) {
      setChannels(prev => prev.filter(ch => ch !== channelName));
    }
    return success;
  }, []);

  const sendMessage = useCallback(async (channelName, message, options = {}) => {
    if (!signalingRef.current) return false;
    
    return await signalingRef.current.sendChannelMessage(channelName, message, options);
  }, []);

  const joinStreamChannel = useCallback(async (channelName, options = {}) => {
    if (!signalingRef.current) return false;
    
    const success = await signalingRef.current.joinStreamChannel(channelName, options);
    if (success) {
      setStreamChannels(prev => [...new Set([...prev, channelName])]);
    }
    return success;
  }, []);

  const leaveStreamChannel = useCallback(async (channelName) => {
    if (!signalingRef.current) return false;
    
    const success = await signalingRef.current.leaveStreamChannel(channelName);
    if (success) {
      setStreamChannels(prev => prev.filter(ch => ch !== channelName));
    }
    return success;
  }, []);

  const subscribeTopic = useCallback(async (channelName, topic, options = {}) => {
    if (!signalingRef.current) return false;
    
    return await signalingRef.current.subscribeTopic(channelName, topic, options);
  }, []);

  const publishToTopic = useCallback(async (channelName, topic, message, options = {}) => {
    if (!signalingRef.current) return false;
    
    return await signalingRef.current.publishToTopic(channelName, topic, message, options);
  }, []);

  const updatePresence = useCallback(async (channelName, attributes) => {
    if (!signalingRef.current) return false;
    
    return await signalingRef.current.setState(channelName, attributes);
  }, []);

  const getPresence = useCallback(async (channelName) => {
    if (!signalingRef.current) return [];
    
    return await signalingRef.current.getPresence(channelName);
  }, []);

  const setMetadata = useCallback(async (channelName, key, value, options = {}) => {
    if (!signalingRef.current) return false;
    
    return await signalingRef.current.setChannelMetadata(channelName, key, value, options);
  }, []);

  const getMetadata = useCallback(async (channelName, keys = []) => {
    if (!signalingRef.current) return {};
    
    return await signalingRef.current.getChannelMetadata(channelName, keys);
  }, []);

  const acquireLock = useCallback(async (channelName, lockName, ttl = 10) => {
    if (!signalingRef.current) return false;
    
    return await signalingRef.current.acquireLock(channelName, lockName, ttl);
  }, []);

  const releaseLock = useCallback(async (channelName, lockName) => {
    if (!signalingRef.current) return false;
    
    return await signalingRef.current.releaseLock(channelName, lockName);
  }, []);

  // Stream-specific helpers
  const sendStreamEvent = useCallback(async (channelName, event) => {
    return await sendMessage(channelName, {
      type: 'stream_event',
      event: event.type,
      ...event
    });
  }, [sendMessage]);

  const syncStreamState = useCallback(async (channelName, state) => {
    return await setMetadata(channelName, 'stream_state', state, {
      lock: 'stream_state_lock'
    });
  }, [setMetadata]);

  const broadcastToViewers = useCallback(async (streamChannel, message) => {
    return await publishToTopic(streamChannel, 'broadcast', {
      type: 'announcement',
      message,
      timestamp: Date.now()
    });
  }, [publishToTopic]);

  return {
    // Connection state
    isConnected,
    
    // Data
    presence,
    messages,
    channels,
    streamChannels,
    locks,
    metadata,
    
    // Core methods
    login,
    logout,
    joinChannel,
    leaveChannel,
    sendMessage,
    
    // Stream channels
    joinStreamChannel,
    leaveStreamChannel,
    subscribeTopic,
    publishToTopic,
    
    // Presence
    updatePresence,
    getPresence,
    
    // Storage
    setMetadata,
    getMetadata,
    
    // Locks
    acquireLock,
    releaseLock,
    
    // Stream helpers
    sendStreamEvent,
    syncStreamState,
    broadcastToViewers,
    
    // Instance reference
    signaling: signalingRef.current
  };
};

// Export singleton getter
export const getSignalingInstance = () => signalingInstance;