/**
 * Hook for managing call recording functionality
 * @module hooks/useCallRecording
 */

import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

/**
 * Manages call recording via Agora cloud recording or local recording
 * @param {string} channel - Channel name
 * @param {string} uid - User ID
 * @returns {Object} Recording state and methods
 */
export const useCallRecording = (channel, uid) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const [recordingId, setRecordingId] = useState(null);
  const [recordingStatus, setRecordingStatus] = useState('idle'); // idle, starting, recording, stopping, stopped
  const recordingStartTime = useRef(null);

  /**
   * Start cloud recording via backend API
   */
  const startCloudRecording = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/recording/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          channel,
          uid,
          mode: 'mix' // mix mode combines all streams into one
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start recording');
      }

      const data = await response.json();
      return data.recordingId;
    } catch (error) {
      console.error('Cloud recording error:', error);
      throw error;
    }
  }, [channel, uid]);

  /**
   * Stop cloud recording
   */
  const stopCloudRecording = useCallback(async (recId) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/recording/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          recordingId: recId,
          channel
        })
      });

      if (!response.ok) {
        throw new Error('Failed to stop recording');
      }

      const data = await response.json();
      return data.recordingUrl;
    } catch (error) {
      console.error('Stop recording error:', error);
      throw error;
    }
  }, [channel]);

  /**
   * Start recording
   */
  const startRecording = useCallback(async () => {
    if (isRecording) {
      toast.error('Recording already in progress');
      return;
    }

    setRecordingStatus('starting');
    
    try {
      // Start cloud recording
      const recId = await startCloudRecording();
      
      setRecordingId(recId);
      setIsRecording(true);
      setRecordingStatus('recording');
      recordingStartTime.current = Date.now();
      
      toast.success('Recording started', {
        icon: '🔴',
        duration: 3000
      });
    } catch (error) {
      setRecordingStatus('idle');
      toast.error('Failed to start recording');
      console.error('Start recording error:', error);
    }
  }, [isRecording, startCloudRecording]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(async () => {
    if (!isRecording || !recordingId) {
      return;
    }

    setRecordingStatus('stopping');
    
    try {
      // Stop cloud recording and get URL
      const url = await stopCloudRecording(recordingId);
      
      setRecordingUrl(url);
      setIsRecording(false);
      setRecordingStatus('stopped');
      setRecordingId(null);
      
      const duration = Date.now() - recordingStartTime.current;
      const minutes = Math.floor(duration / 60000);
      
      toast.success(`Recording saved (${minutes} minutes)`, {
        icon: '✅',
        duration: 5000
      });
      
      return url;
    } catch (error) {
      setRecordingStatus('recording');
      toast.error('Failed to stop recording');
      console.error('Stop recording error:', error);
    }
  }, [isRecording, recordingId, stopCloudRecording]);

  /**
   * Get recording status for UI
   */
  const getRecordingStatus = useCallback(() => {
    if (!isRecording) return null;
    
    const elapsed = Date.now() - recordingStartTime.current;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    let timeString = '';
    if (hours > 0) {
      timeString = `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else {
      timeString = `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    
    return {
      isRecording: true,
      duration: timeString,
      status: recordingStatus
    };
  }, [isRecording, recordingStatus]);

  /**
   * Download recording
   */
  const downloadRecording = useCallback(async (url = recordingUrl) => {
    if (!url) {
      toast.error('No recording available');
      return;
    }

    try {
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `recording-${channel}-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Download started');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download recording');
    }
  }, [recordingUrl, channel]);

  /**
   * Check if recording is available
   */
  const isRecordingAvailable = useCallback(() => {
    return !!recordingUrl;
  }, [recordingUrl]);

  return {
    // State
    isRecording,
    recordingUrl,
    recordingStatus,
    recordingInfo: getRecordingStatus(),
    
    // Methods
    startRecording,
    stopRecording,
    downloadRecording,
    isRecordingAvailable
  };
};

export default useCallRecording;