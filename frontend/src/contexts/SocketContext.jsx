import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import socketService from '../services/socket';
import { useAuth } from './AuthContext';
import { analytics } from '../lib/analytics';
import toast from 'react-hot-toast';

/**
 * SocketContext - Centralized Socket.io management
 *
 * Handles:
 * - Connection lifecycle (connect on login, disconnect on logout)
 * - Event listeners (calls, messages, balance updates)
 * - Connection status
 * - Emit functions with clean API
 *
 * Replaces scattered socket logic in App.js
 */

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { user, isCreator, updateTokenBalance } = useAuth();
  const [connected, setConnected] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callAccepted, setCallAccepted] = useState(null);

  /**
   * Initialize socket connection when user logs in
   */
  useEffect(() => {
    if (!user) {
      setConnected(false);
      return;
    }

    let cleanupFns = [];
    const timeoutId = setTimeout(async () => {
      try {
        console.log('📡 Initializing Socket.io connection...');
        await socketService.connect();

        // Subscribe to connection status
        const unsubConnection = socketService.on('connection-status', ({ connected }) => {
          console.log('📡 Socket connection status:', connected);
          setConnected(connected);
        });
        cleanupFns.push(unsubConnection);

        // Subscribe to call requests (for creators)
        const unsubCallRequest = socketService.on('call-request', (data) => {
          console.log('📞 Incoming call request:', data);
          if (isCreator) {
            // Store incoming call data for creators
            setIncomingCall({
              id: data.requestId,
              type: data.type,
              caller: {
                id: data.fanId,
                name: data.fanName,
                username: data.fanName
              },
              rate: data.rate
            });
          }
        });
        cleanupFns.push(unsubCallRequest);

        // Subscribe to call acceptance (for fans)
        const unsubCallAccepted = socketService.on('call-accepted', (data) => {
          console.log('✅ Call accepted by creator:', data);

          // Track call acceptance in analytics
          analytics.track('call_accepted', {
            type: data.type || 'video',
            roomId: data.roomId,
            creatorId: data.creatorId,
          });

          // Set state to trigger navigation (with deduplication)
          setCallAccepted((prev) => {
            // Deduplicate: ignore if same roomId already set
            if (prev?.roomId === data.roomId) return prev;

            // Set new call data with timestamp for freshness check
            return {
              type: data.type || 'video',
              roomId: data.roomId,
              creatorId: data.creatorId,
              at: Date.now(),
            };
          });
        });
        cleanupFns.push(unsubCallAccepted);

        // Subscribe to call rejection (for fans)
        const unsubCallRejected = socketService.on('call-rejected', (data) => {
          console.log('❌ Call rejected by creator:', data);
          toast.error('Call was declined by the creator', { duration: 4000 });
          analytics.track('call_rejected', {
            type: data.type,
            roomId: data.roomId,
            creatorId: data.creatorId,
          });
        });
        cleanupFns.push(unsubCallRejected);

        // Subscribe to call cancellation (for fans)
        const unsubCallCancelled = socketService.on('call-cancelled', (data) => {
          console.log('🚫 Call cancelled:', data);
          toast.error('The call was cancelled.');
          analytics.track('call_cancelled', {
            reason: data?.reason,
            roomId: data?.roomId,
          });
          // Clear any pending accept state to stop navigation
          setCallAccepted(null);
        });
        cleanupFns.push(unsubCallCancelled);

        // Subscribe to balance updates (real-time)
        const unsubBalance = socketService.on('balance-update', ({ balance }) => {
          console.log('💰 Balance updated via socket:', balance);
          if (updateTokenBalance) {
            updateTokenBalance(balance);
          }
        });
        cleanupFns.push(unsubBalance);

      } catch (error) {
        console.warn('Socket connection failed (non-critical):', error.message);
      }
    }, 1500); // Wait 1.5s for backend to be ready

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      cleanupFns.forEach(fn => fn());
      socketService.disconnect();
      setConnected(false);
    };
  }, [user, isCreator, updateTokenBalance]);

  /**
   * Emit functions (memoized)
   */
  const requestCall = useCallback((payload) => {
    console.log('📞 Requesting call:', payload);
    socketService.emit('call-request', payload);
  }, []);

  const respondToCall = useCallback((payload) => {
    console.log('📞 Responding to call:', payload);
    socketService.emit('call-response', payload);
  }, []);

  const sendMessage = useCallback((payload) => {
    console.log('💬 Sending message:', payload);
    socketService.emit('message', payload);
  }, []);

  const joinRoom = useCallback((roomId) => {
    console.log('🚪 Joining room:', roomId);
    socketService.emit('join-room', roomId);
  }, []);

  const leaveRoom = useCallback((roomId) => {
    console.log('🚪 Leaving room:', roomId);
    socketService.emit('leave-room', roomId);
  }, []);

  /**
   * Clear incoming call (when accepted or declined)
   */
  const clearIncomingCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  /**
   * Clear call accepted state (after navigation)
   */
  const clearCallAccepted = useCallback(() => {
    setCallAccepted(null);
  }, []);

  // Memoized value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    // Connection state
    connected,

    // Incoming call state
    incomingCall,
    clearIncomingCall,

    // Call accepted state (for fans)
    callAccepted,
    clearCallAccepted,

    // Socket emit functions
    requestCall,
    respondToCall,
    sendMessage,
    joinRoom,
    leaveRoom,

    // Expose raw service for advanced usage
    socketService
  }), [connected, incomingCall, clearIncomingCall, callAccepted, clearCallAccepted, requestCall, respondToCall, sendMessage, joinRoom, leaveRoom]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
