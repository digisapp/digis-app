// hooks/useMessages.js
// Hook to fetch and subscribe to messages in a conversation
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase-client-v2';
import { apiGet } from '../lib/api';

/**
 * Hook to get messages for a specific conversation
 * Automatically subscribes to new messages and updates
 *
 * @param {string} conversationId - The conversation ID
 * @returns {Object} { messages, loading, error, loadMore, hasMore }
 */
export function useMessages(conversationId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // Fetch messages from API
  const fetchMessages = useCallback(async (before = null) => {
    if (!conversationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const url = before
        ? `/messages/conversation/${conversationId}?before=${before}`
        : `/messages/conversation/${conversationId}`;

      const response = await apiGet(url);

      if (response.success) {
        const newMessages = response.messages || [];

        if (before) {
          // Prepend older messages
          setMessages(prev => [...newMessages, ...prev]);
        } else {
          // Replace all messages
          setMessages(newMessages);
        }

        // Check if there are more messages to load
        setHasMore(newMessages.length >= 50);
      } else {
        throw new Error(response.error || 'Failed to fetch messages');
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  // Load more (older) messages
  const loadMore = useCallback(() => {
    if (!hasMore || loading || messages.length === 0) return;

    const oldestMessage = messages[0];
    if (oldestMessage?.created_at) {
      fetchMessages(oldestMessage.created_at);
    }
  }, [hasMore, loading, messages, fetchMessages]);

  useEffect(() => {
    if (!conversationId) return;

    // Initial fetch
    fetchMessages();

    // Subscribe to new messages in this conversation
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        console.log('📨 New message received:', payload.new);
        setMessages(prev => [...prev, payload.new]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        console.log('✏️ Message updated:', payload.new);
        // Update message in state (for read receipts, reactions, etc.)
        setMessages(prev =>
          prev.map(msg =>
            msg.id === payload.new.id ? { ...msg, ...payload.new } : msg
          )
        );
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        console.log('🗑️ Message deleted:', payload.old);
        // Remove message from state
        setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
      })
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, fetchMessages]);

  return {
    messages,
    loading,
    error,
    loadMore,
    hasMore,
    refetch: () => fetchMessages()
  };
}

/**
 * Hook to get unread message count
 *
 * @returns {Object} { unreadCount, loading, error, refetch }
 */
export function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiGet('/messages/unread/count');

      if (response.success) {
        setUnreadCount(response.count || 0);
      } else {
        throw new Error(response.error || 'Failed to fetch unread count');
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();

    // Subscribe to message updates to update unread count
    const channel = supabase
      .channel('unread-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, () => {
        fetchUnreadCount();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        // If message was marked as read, update count
        if (payload.new.is_read && !payload.old.is_read) {
          fetchUnreadCount();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUnreadCount]);

  return {
    unreadCount,
    loading,
    error,
    refetch: fetchUnreadCount
  };
}
