// hooks/useTypingIndicator.js
// Hook to manage typing indicators
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../utils/supabase-client-v2';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to manage typing indicators for a conversation
 *
 * @param {string} conversationId - The conversation ID
 * @returns {Object} { typingUsers, setTyping, isTyping }
 */
export function useTypingIndicator(conversationId) {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState([]);
  const typingTimeoutRef = useRef(null);

  // Set typing status (called when user types)
  const setTyping = useCallback(async (isTyping) => {
    if (!conversationId || !user) return;

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/messages/${conversationId}/typing`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ isTyping })
        }
      );

      // Auto-stop typing after 3 seconds of no activity
      if (isTyping) {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setTyping(false);
        }, 3000);
      }
    } catch (err) {
      console.error('Error updating typing status:', err);
    }
  }, [conversationId, user]);

  // Helper to check if other users are typing
  const isTyping = typingUsers.length > 0;

  useEffect(() => {
    if (!conversationId) return;

    // Subscribe to typing indicators
    const channel = supabase
      .channel(`typing:${conversationId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'typing_indicators',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        console.log('⌨️ Typing status changed:', payload);

        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const typingUser = payload.new;

          // Don't show current user as typing
          if (typingUser.user_id === user?.id) return;

          // Add or update typing user
          setTypingUsers(prev => {
            const exists = prev.find(u => u.user_id === typingUser.user_id);
            if (exists) {
              return prev.map(u =>
                u.user_id === typingUser.user_id ? typingUser : u
              );
            }
            return [...prev, typingUser];
          });

          // Auto-remove after 10 seconds (stale indicator)
          setTimeout(() => {
            setTypingUsers(prev =>
              prev.filter(u => u.user_id !== typingUser.user_id)
            );
          }, 10000);
        } else if (payload.eventType === 'DELETE') {
          // Remove typing user
          setTypingUsers(prev =>
            prev.filter(u => u.user_id !== payload.old.user_id)
          );
        }
      })
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(channel);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Stop typing when unmounting
      setTyping(false);
    };
  }, [conversationId, user, setTyping]);

  return {
    typingUsers,
    setTyping,
    isTyping
  };
}

/**
 * Hook to handle typing detection from input field
 * Automatically calls setTyping when user types
 *
 * @param {Function} setTyping - The setTyping function from useTypingIndicator
 * @returns {Function} handleInputChange - Function to call on input change
 */
export function useTypingDetection(setTyping) {
  const typingRef = useRef(false);
  const timeoutRef = useRef(null);

  const handleInputChange = useCallback((value) => {
    if (!setTyping) return;

    // User started typing
    if (value && !typingRef.current) {
      typingRef.current = true;
      setTyping(true);
    }

    // Reset timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // User stopped typing (no input for 2 seconds)
    timeoutRef.current = setTimeout(() => {
      if (typingRef.current) {
        typingRef.current = false;
        setTyping(false);
      }
    }, 2000);
  }, [setTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (typingRef.current && setTyping) {
        setTyping(false);
      }
    };
  }, [setTyping]);

  return handleInputChange;
}
