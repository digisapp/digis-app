import { useEffect, useState, useCallback, useRef } from 'react';
import socketService from '../services/socket';

export const useSocket = () => {
  const [connected, setConnected] = useState(socketService.isConnected);
  
  useEffect(() => {
    // Subscribe to connection status changes
    const unsubscribe = socketService.on('connection-status', ({ connected }) => {
      setConnected(connected);
    });
    
    return unsubscribe;
  }, []);
  
  const joinStream = useCallback((streamId) => {
    socketService.joinStream(streamId);
  }, []);
  
  const leaveStream = useCallback((streamId) => {
    socketService.leaveStream(streamId);
  }, []);
  
  const updateAnalytics = useCallback((data) => {
    socketService.updateStreamAnalytics(data);
  }, []);
  
  const sendEvent = useCallback((event, data) => {
    socketService.sendEvent(event, data);
  }, []);
  
  const on = useCallback((event, callback) => {
    return socketService.on(event, callback);
  }, []);
  
  return {
    connected,
    joinStream,
    leaveStream,
    updateAnalytics,
    sendEvent,
    on
  };
};

// Hook for real-time balance updates
export const useBalance = (user) => {
  const [balance, setBalance] = useState(null);
  const { on, connected } = useSocket();
  
  useEffect(() => {
    if (!user || !connected) {
      return;
    }
    
    const unsubscribe = on('balance-updated', (data) => {
      setBalance(data.balance);
    });
    
    return unsubscribe;
  }, [on, connected, user]);
  
  return { balance };
};

// Hook for real-time viewer count
export const useViewerCount = (streamId, onViewerCountUpdate) => {
  const { joinStream, leaveStream, on } = useSocket();
  const hasJoinedRef = useRef(false);
  const currentStreamIdRef = useRef(null);
  
  useEffect(() => {
    if (!streamId) return;
    
    // Prevent rapid rejoining if stream ID hasn't changed
    if (currentStreamIdRef.current === streamId && hasJoinedRef.current) {
      return;
    }
    
    // Leave previous stream if switching
    if (currentStreamIdRef.current && currentStreamIdRef.current !== streamId) {
      leaveStream(currentStreamIdRef.current);
    }
    
    // Join the new stream room
    currentStreamIdRef.current = streamId;
    hasJoinedRef.current = true;
    joinStream(streamId);
    
    // Subscribe to viewer count updates
    const unsubscribe = on('viewer-count', (data) => {
      if (data.streamId === streamId && onViewerCountUpdate) {
        onViewerCountUpdate(data.count);
      }
    });
    
    // Cleanup
    return () => {
      if (hasJoinedRef.current && currentStreamIdRef.current === streamId) {
        leaveStream(streamId);
        hasJoinedRef.current = false;
        currentStreamIdRef.current = null;
      }
      unsubscribe();
    };
  }, [streamId]); // Only depend on streamId, not the functions
};

// Hook for real-time stream analytics
export const useStreamAnalytics = (streamId, onAnalyticsUpdate) => {
  const { on } = useSocket();
  
  useEffect(() => {
    if (!streamId) return;
    
    const unsubscribe = on('stream-analytics', (data) => {
      if (data.streamId === streamId && onAnalyticsUpdate) {
        onAnalyticsUpdate(data);
      }
    });
    
    return unsubscribe;
  }, [streamId, on, onAnalyticsUpdate]);
};

// Hook for real-time notifications
export const useNotifications = (onNotification) => {
  const { on } = useSocket();
  
  useEffect(() => {
    const unsubscribe = on('notification', (notification) => {
      if (onNotification) {
        onNotification(notification);
      }
    });
    
    return unsubscribe;
  }, [on, onNotification]);
};

// Hook for user presence
export const usePresence = () => {
  const [userPresence, setUserPresence] = useState(new Map());
  const { on } = useSocket();
  
  useEffect(() => {
    // Subscribe to presence updates
    const unsubPresence = on('user-presence', (data) => {
      setUserPresence(prev => {
        const updated = new Map(prev);
        updated.set(data.userId, {
          status: data.status,
          lastSeen: data.lastSeen
        });
        return updated;
      });
    });
    
    // Subscribe to presence list updates
    const unsubList = on('user-presence-list', (dataList) => {
      setUserPresence(prev => {
        const updated = new Map(prev);
        dataList.forEach(data => {
          updated.set(data.userId, {
            status: data.status,
            lastSeen: data.lastSeen
          });
        });
        return updated;
      });
    });
    
    return () => {
      unsubPresence();
      unsubList();
    };
  }, [on]);
  
  const updatePresence = useCallback((status) => {
    socketService.updatePresence(status);
  }, []);
  
  const getUserPresence = useCallback((userIds) => {
    socketService.getUserPresence(userIds);
  }, []);
  
  return {
    userPresence,
    updatePresence,
    getUserPresence
  };
};

// Hook for typing indicators
export const useTyping = (channel, recipientId = null) => {
  const [typingUsers, setTypingUsers] = useState(new Set());
  const { on } = useSocket();
  const typingTimeoutRef = useRef(null);
  
  useEffect(() => {
    const unsubscribe = on('user-typing', (data) => {
      if (data.channel === channel) {
        setTypingUsers(prev => {
          const updated = new Set(prev);
          if (data.isTyping) {
            updated.add(data.userId);
          } else {
            updated.delete(data.userId);
          }
          return updated;
        });
      }
    });
    
    return unsubscribe;
  }, [on, channel]);
  
  const startTyping = useCallback(() => {
    socketService.startTyping(channel, recipientId);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Auto-stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      socketService.stopTyping(channel, recipientId);
    }, 3000);
  }, [channel, recipientId]);
  
  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socketService.stopTyping(channel, recipientId);
  }, [channel, recipientId]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      stopTyping();
    };
  }, [stopTyping]);
  
  return {
    typingUsers,
    startTyping,
    stopTyping
  };
};

// Hook for recording events
export const useRecordingEvents = (onRecordingSaved) => {
  const { on, connected } = useSocket();
  
  useEffect(() => {
    if (!connected) return;
    
    const unsubscribeAutoSaved = on('recording_auto_saved', (data) => {
      if (onRecordingSaved) {
        onRecordingSaved({
          ...data,
          autoSaved: true,
          message: `2K Recording saved and available for ${data.tokenPrice} tokens`
        });
      }
    });
    
    const unsubscribeSaved = on('recording_saved', (data) => {
      if (onRecordingSaved) {
        onRecordingSaved({
          ...data,
          autoSaved: false,
          message: '2K Recording saved to your profile'
        });
      }
    });
    
    return () => {
      unsubscribeAutoSaved();
      unsubscribeSaved();
    };
  }, [on, connected, onRecordingSaved]);
};