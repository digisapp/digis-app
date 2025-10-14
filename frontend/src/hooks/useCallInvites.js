import { useEffect, useState, useCallback } from 'react';
import { getSession } from '../utils/requireAuth';

/**
 * Hook to manage incoming call invitations
 *
 * Listens for real-time call events and manages invitation state
 * Automatically cleans up on component unmount or page hide
 *
 * @returns {Object} { invite, clearInvite }
 */
export default function useCallInvites() {
  const [invite, setInvite] = useState(null);

  const onInvite = useCallback((payload) => {
    // payload: { callId, creatorId, creatorName, avatar, callType, expiresAt, message }
    console.log('📞 Incoming call invitation:', payload);
    setInvite(payload);
  }, []);

  const onCallCanceled = useCallback(({ callId }) => {
    console.log('📵 Call canceled:', callId);
    setInvite((currentInvite) => {
      if (currentInvite?.callId === callId) {
        return null;
      }
      return currentInvite;
    });
  }, []);

  const onCallStatus = useCallback(({ callId, state }) => {
    console.log('📊 Call status update:', callId, state);
    if (state === 'declined' || state === 'ended' || state === 'missed') {
      setInvite((currentInvite) => {
        if (currentInvite?.callId === callId) {
          return null;
        }
        return currentInvite;
      });
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let socket = null;

    const setupSocket = async () => {
      try {
        // Get current session
        const session = await getSession();
        if (!session?.user) {
          console.log('⚠️ No session, skipping call invite listener');
          return;
        }

        const userId = session.user.id;

        // Dynamically import socket service
        // Adjust path based on your socket service location
        const socketModule = await import('../services/socket');
        socket = socketModule.default || socketModule;

        if (!mounted) return;

        // Join user's personal room
        console.log('🔌 Joining user room for call invitations:', userId);
        socket.emit('join', { room: `user:${userId}` });

        // Listen for call events
        socket.on('call:incoming', (payload) => {
          if (mounted) onInvite(payload);
        });

        socket.on('call:canceled', (payload) => {
          if (mounted) onCallCanceled(payload);
        });

        socket.on('call:status', (payload) => {
          if (mounted) onCallStatus(payload);
        });

        // Also listen for legacy event names if your backend uses them
        socket.on('call.invited', (payload) => {
          if (mounted) onInvite(payload);
        });

        socket.on('call.canceled', (payload) => {
          if (mounted) onCallCanceled(payload);
        });

      } catch (error) {
        console.error('❌ Error setting up call invites:', error);
      }
    };

    setupSocket();

    // Clean up on visibility change (backgrounding)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('📱 Page hidden, clearing call invitation');
        setInvite(null);
      }
    };

    const onPageHide = () => {
      console.log('📱 Page hiding, clearing call invitation');
      setInvite(null);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      mounted = false;

      // Remove event listeners
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);

      // Clean up socket listeners
      if (socket) {
        socket.off('call:incoming');
        socket.off('call:canceled');
        socket.off('call:status');
        socket.off('call.invited');
        socket.off('call.canceled');
      }
    };
  }, [onInvite, onCallCanceled, onCallStatus]);

  const clearInvite = useCallback(() => {
    setInvite(null);
  }, []);

  return {
    invite,
    clearInvite
  };
}
