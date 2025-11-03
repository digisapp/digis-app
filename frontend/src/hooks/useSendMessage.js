// hooks/useSendMessage.js
// Hook to send messages with token deduction
import { useState, useCallback } from 'react';
import { supabase } from '../utils/supabase-client-v2';
import toast from 'react-hot-toast';

/**
 * Hook to send messages
 *
 * @returns {Object} { sendMessage, sending, error }
 */
export function useSendMessage() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = useCallback(async ({
    recipientId,
    content,
    mediaUrl = null,
    mediaType = null,
    messageType = 'text',
    isPremium = false,
    metadata = {}
  }) => {
    if (!recipientId) {
      setError('Recipient ID is required');
      return null;
    }

    if (!content && !mediaUrl) {
      setError('Message content or media is required');
      return null;
    }

    try {
      setSending(true);
      setError(null);

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientId,
          content,
          mediaUrl,
          mediaType,
          messageType,
          isPremium,
          metadata
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 402) {
          toast.error(`Insufficient tokens. Need ${data.required} tokens, have ${data.balance}.`);
          throw new Error('Insufficient tokens');
        }
        throw new Error(data.error || 'Failed to send message');
      }

      if (data.success && data.message) {
        // Show success toast for premium messages
        if (isPremium && data.message.tokens_spent > 0) {
          toast.success(`Message sent! ${data.message.tokens_spent} tokens spent.`);
        }
        return data.message;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err.message);

      // Don't show toast for insufficient tokens (already shown above)
      if (err.message !== 'Insufficient tokens') {
        toast.error(err.message || 'Failed to send message');
      }

      return null;
    } finally {
      setSending(false);
    }
  }, []);

  return {
    sendMessage,
    sending,
    error
  };
}

/**
 * Hook to get message rates for a creator
 *
 * @param {string} creatorId - The creator's user ID
 * @returns {Object} { rates, loading, error }
 */
export function useMessageRates(creatorId) {
  const [rates, setRates] = useState({ text: 0, image: 0, audio: 0, video: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRates = useCallback(async () => {
    if (!creatorId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/messages/rates/${creatorId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setRates(data.rates);
      } else {
        throw new Error(data.error || 'Failed to fetch message rates');
      }
    } catch (err) {
      console.error('Error fetching message rates:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [creatorId]);

  useState(() => {
    fetchRates();
  }, [fetchRates]);

  return {
    rates,
    loading,
    error,
    refetch: fetchRates
  };
}

/**
 * Hook to upload media for messages
 *
 * @returns {Object} { uploadMedia, uploading, progress, error }
 */
export function useMediaUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const uploadMedia = useCallback(async (file) => {
    if (!file) {
      setError('File is required');
      return null;
    }

    try {
      setUploading(true);
      setProgress(0);
      setError(null);

      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user?.id;

      if (!userId) {
        throw new Error('Not authenticated');
      }

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `messages/${userId}/${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('message-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percentCompleted);
          }
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('message-media')
        .getPublicUrl(filePath);

      setProgress(100);

      return {
        url: urlData.publicUrl,
        path: filePath,
        type: file.type.startsWith('image/') ? 'image' :
              file.type.startsWith('video/') ? 'video' :
              file.type.startsWith('audio/') ? 'audio' : 'file'
      };
    } catch (err) {
      console.error('Error uploading media:', err);
      setError(err.message);
      toast.error('Failed to upload file');
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  return {
    uploadMedia,
    uploading,
    progress,
    error
  };
}
