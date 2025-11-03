// hooks/useConversations.js
// Hook to fetch and subscribe to conversations
import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase-client-v2';
import { apiGet } from '../lib/api';

/**
 * Hook to get all conversations for the current user
 * Automatically subscribes to new messages and updates
 *
 * @returns {Object} { conversations, loading, error, refetch }
 */
export function useConversations() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch conversations from API
  const fetchConversations = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiGet('/messages/conversations');

      if (response.success) {
        setConversations(response.conversations || []);
      } else {
        throw new Error(response.error || 'Failed to fetch conversations');
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();

    // Subscribe to new messages in ANY conversation
    // This will trigger a refetch when new messages arrive
    const channel = supabase
      .channel('all-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        console.log('📨 New message received, updating conversations');
        // Refetch conversations to update last message and timestamps
        fetchConversations();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations'
      }, (payload) => {
        console.log('🔄 Conversation updated');
        // Update the specific conversation in state
        setConversations(prev =>
          prev.map(conv =>
            conv.id === payload.new.id
              ? { ...conv, ...payload.new }
              : conv
          )
        );
      })
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    conversations,
    loading,
    error,
    refetch: fetchConversations
  };
}

/**
 * Hook to get or create a conversation with a specific user
 *
 * @param {string} otherUserId - The ID of the other user
 * @returns {Object} { conversation, loading, error, createConversation }
 */
export function useConversation(otherUserId) {
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createConversation = async () => {
    if (!otherUserId) {
      setError('User ID is required');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/messages/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ otherUserId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create conversation');
      }

      if (data.success && data.conversation) {
        setConversation(data.conversation);
        return data.conversation;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Error creating conversation:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    conversation,
    loading,
    error,
    createConversation
  };
}
