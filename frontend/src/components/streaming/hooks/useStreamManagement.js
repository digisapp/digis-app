/**
 * Hook for managing stream lifecycle and state
 * @module hooks/useStreamManagement
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../utils/supabase-auth';
import toast from 'react-hot-toast';

/**
 * Manages stream creation, updates, and lifecycle
 */
export const useStreamManagement = (user, channel) => {
  const [streamStatus, setStreamStatus] = useState('idle'); // idle, preparing, live, ending, ended
  const [streamInfo, setStreamInfo] = useState({
    id: null,
    title: '',
    description: '',
    category: 'general',
    thumbnail: null,
    scheduledTime: null,
    isPrivate: false,
    ticketPrice: 0
  });
  const [streamStats, setStreamStats] = useState({
    duration: 0,
    viewerCount: 0,
    peakViewers: 0,
    totalEarnings: 0
  });
  
  const streamStartTime = useRef(null);
  const statsInterval = useRef(null);

  /**
   * Create or prepare a stream
   */
  const prepareStream = useCallback(async (streamData) => {
    try {
      setStreamStatus('preparing');
      
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/streaming/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          ...streamData,
          channel,
          creatorId: user.id
        })
      });

      if (!response.ok) throw new Error('Failed to prepare stream');

      const data = await response.json();
      setStreamInfo(data.stream);
      
      toast.success('Stream prepared successfully');
      return data.stream;
    } catch (error) {
      console.error('Error preparing stream:', error);
      setStreamStatus('idle');
      toast.error('Failed to prepare stream');
      throw error;
    }
  }, [channel, user]);

  /**
   * Start the stream
   */
  const startStream = useCallback(async () => {
    try {
      setStreamStatus('live');
      streamStartTime.current = Date.now();
      
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/streaming/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          streamId: streamInfo.id,
          channel
        })
      });

      if (!response.ok) throw new Error('Failed to start stream');

      // Start tracking stats
      statsInterval.current = setInterval(() => {
        const duration = Math.floor((Date.now() - streamStartTime.current) / 1000);
        setStreamStats(prev => ({ ...prev, duration }));
      }, 1000);
      
      toast.success('Stream is now live!', { icon: '🔴' });
    } catch (error) {
      console.error('Error starting stream:', error);
      setStreamStatus('idle');
      toast.error('Failed to start stream');
      throw error;
    }
  }, [streamInfo.id, channel]);

  /**
   * End the stream
   */
  const endStream = useCallback(async () => {
    try {
      setStreamStatus('ending');
      
      // Clear stats interval
      if (statsInterval.current) {
        clearInterval(statsInterval.current);
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/streaming/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          streamId: streamInfo.id,
          stats: streamStats
        })
      });

      if (!response.ok) throw new Error('Failed to end stream');

      const data = await response.json();
      setStreamStatus('ended');
      
      toast.success('Stream ended successfully');
      return data.summary;
    } catch (error) {
      console.error('Error ending stream:', error);
      toast.error('Failed to end stream properly');
      throw error;
    }
  }, [streamInfo.id, streamStats]);

  /**
   * Update stream settings
   */
  const updateStreamSettings = useCallback(async (updates) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/streaming/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          streamId: streamInfo.id,
          ...updates
        })
      });

      if (!response.ok) throw new Error('Failed to update stream');

      const data = await response.json();
      setStreamInfo(prev => ({ ...prev, ...updates }));
      
      toast.success('Stream settings updated');
    } catch (error) {
      console.error('Error updating stream:', error);
      toast.error('Failed to update stream settings');
      throw error;
    }
  }, [streamInfo.id]);

  /**
   * Update viewer count
   */
  const updateViewerCount = useCallback((count) => {
    setStreamStats(prev => ({
      ...prev,
      viewerCount: count,
      peakViewers: Math.max(prev.peakViewers, count)
    }));
  }, []);

  /**
   * Add earnings (tips, gifts, etc)
   */
  const addEarnings = useCallback((amount, type = 'tip') => {
    setStreamStats(prev => ({
      ...prev,
      totalEarnings: prev.totalEarnings + amount
    }));
    
    // Could also track by type if needed
  }, []);

  /**
   * Check if stream can be started
   */
  const canStartStream = useCallback(() => {
    return streamStatus === 'idle' || streamStatus === 'preparing';
  }, [streamStatus]);

  /**
   * Get formatted stream duration
   */
  const getFormattedDuration = useCallback(() => {
    const { duration } = streamStats;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [streamStats]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (statsInterval.current) {
        clearInterval(statsInterval.current);
      }
    };
  }, []);

  return {
    // State
    streamStatus,
    streamInfo,
    streamStats,
    formattedDuration: getFormattedDuration(),
    
    // Methods
    prepareStream,
    startStream,
    endStream,
    updateStreamSettings,
    updateViewerCount,
    addEarnings,
    canStartStream
  };
};

export default useStreamManagement;