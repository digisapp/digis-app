/**
 * React Hook for Ably Presence
 *
 * Manages real-time presence tracking for streams using Ably Presence API.
 * Automatically enters presence on mount and leaves on unmount.
 *
 * Usage:
 * ```jsx
 * const { members, count, isLoading } = useAblyPresence(ablyClient, streamId, currentUser);
 * ```
 */

import { useEffect, useRef, useState } from 'react';
import { joinStreamPresence } from '../services/presence';

/**
 * Hook to manage Ably presence for a stream
 *
 * @param {import('ably').Realtime|null} ably - Ably client instance
 * @param {string|null} streamId - Stream ID to track presence for
 * @param {Object|null} user - Current user { id, username, avatar }
 * @returns {Object} { members, count, isLoading }
 */
export function useAblyPresence(ably, streamId, user) {
  const [members, setMembers] = useState([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const cleanupRef = useRef(null);

  useEffect(() => {
    // Early return if prerequisites aren't met
    if (!ably || !streamId || !user?.id) {
      setIsLoading(false);
      setMembers([]);
      setCount(0);
      return;
    }

    let unsubscribe = null;
    let presenceLeave = null;
    let mounted = true;

    const setupPresence = async () => {
      try {
        setIsLoading(true);

        // Join presence
        const presence = await joinStreamPresence(ably, streamId, {
          id: user.id,
          username: user.username || user.display_name,
          avatar: user.avatar || user.profile_pic_url
        });

        presenceLeave = presence.leave;

        // Get initial member list
        const initialMembers = await presence.getMembers();
        if (mounted) {
          setMembers(initialMembers);
          setCount(initialMembers.length);
          setIsLoading(false);
        }

        // Subscribe to presence changes
        unsubscribe = presence.subscribeMemberChanges(async (action, member) => {
          console.log(`👥 Presence ${action}:`, member.data?.name || member.clientId);

          // Refetch full list on any change for accuracy
          // (More reliable than trying to reconcile locally)
          try {
            const updatedMembers = await presence.getMembers();
            if (mounted) {
              setMembers(updatedMembers);
              setCount(updatedMembers.length);
            }
          } catch (error) {
            console.error('Error refreshing presence list:', error);
          }
        });

        cleanupRef.current = () => {
          try {
            unsubscribe?.();
          } catch (e) {
            console.warn('Error unsubscribing from presence:', e);
          }
          try {
            presenceLeave?.();
          } catch (e) {
            console.warn('Error leaving presence:', e);
          }
        };

      } catch (error) {
        console.error('Failed to setup presence:', error);
        if (mounted) {
          setIsLoading(false);
          setMembers([]);
          setCount(0);
        }
      }
    };

    setupPresence();

    // Cleanup on unmount or dependency change
    return () => {
      mounted = false;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [ably, streamId, user?.id]); // Only re-run if these change

  // Handle visibility change for mobile (backgrounding/foregrounding)
  // This keeps presence counts accurate when users switch apps
  useEffect(() => {
    if (!ably || !streamId || !user?.id) return;

    const handleVisibilityChange = async () => {
      try {
        const channel = ably.channels.get(`stream:${streamId}`);

        if (document.hidden) {
          // App backgrounded: leave presence to keep counts accurate
          await channel.presence.leave();
          console.log(`👋 Left presence (app backgrounded): stream:${streamId}`);
        } else {
          // App foregrounded: rejoin presence
          await channel.presence.enter({
            userId: user.id,
            name: user.username || user.display_name,
            avatar: user.avatar || user.profile_pic_url
          });
          console.log(`✅ Rejoined presence (app foregrounded): stream:${streamId}`);

          // Refresh member list
          const updatedMembers = await channel.presence.get();
          setMembers(updatedMembers.map(m => ({ clientId: m.clientId, data: m.data })));
          setCount(updatedMembers.length);
        }
      } catch (error) {
        console.error('Error handling visibility change:', error);
      }
    };

    // Register visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup listener on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [ably, streamId, user?.id, user?.username, user?.display_name, user?.avatar, user?.profile_pic_url]);

  return {
    members,     // Array of { clientId, data: { userId, name, avatar } }
    count,       // Number of active viewers
    isLoading    // Whether initial presence load is in progress
  };
}

/**
 * Hook to subscribe to presence changes without entering
 * Useful for admins or analytics dashboards
 */
export function useAblyPresenceMonitor(ably, streamId) {
  const [members, setMembers] = useState([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!ably || !streamId) return;

    const channel = ably.channels.get(`stream:${streamId}`);
    let mounted = true;

    const fetchMembers = async () => {
      try {
        const presenceMembers = await channel.presence.get();
        if (mounted) {
          setMembers(presenceMembers.map(m => ({ clientId: m.clientId, data: m.data })));
          setCount(presenceMembers.length);
        }
      } catch (error) {
        console.error('Error fetching presence:', error);
      }
    };

    // Fetch initial
    fetchMembers();

    // Subscribe to changes
    const handler = () => {
      fetchMembers();
    };

    channel.presence.subscribe(['enter', 'leave', 'update'], handler);

    return () => {
      mounted = false;
      channel.presence.unsubscribe(['enter', 'leave', 'update'], handler);
    };
  }, [ably, streamId]);

  return { members, count };
}

export default useAblyPresence;
