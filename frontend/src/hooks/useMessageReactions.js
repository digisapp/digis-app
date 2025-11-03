// hooks/useMessageReactions.js
// Hook to manage message reactions
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

/**
 * Hook to add/remove reactions to messages
 *
 * @returns {Object} { addReaction, removing, error }
 */
export function useMessageReactions() {
  const [reacting, setReacting] = useState(false);
  const [error, setError] = useState(null);

  const addReaction = useCallback(async (messageId, reaction) => {
    if (!messageId || !reaction) {
      setError('Message ID and reaction are required');
      return null;
    }

    try {
      setReacting(true);
      setError(null);

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/messages/${messageId}/react`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ reaction })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to react to message');
      }

      if (data.success) {
        if (data.removed) {
          // Reaction was removed (toggled off)
          return { removed: true };
        }
        // Reaction was added
        return data.reaction;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Error reacting to message:', err);
      setError(err.message);
      toast.error(err.message || 'Failed to react to message');
      return null;
    } finally {
      setReacting(false);
    }
  }, []);

  return {
    addReaction,
    reacting,
    error
  };
}

/**
 * Common emoji reactions
 */
export const REACTIONS = [
  { emoji: '❤️', label: 'Love' },
  { emoji: '👍', label: 'Like' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '🎉', label: 'Celebrate' },
  { emoji: '💯', label: '100' }
];
