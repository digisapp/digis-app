/**
 * Custom hook for managing Agora RTC client and tracks
 * @module hooks/useAgoraClient
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import toast from 'react-hot-toast';

/**
 * Hook for managing Agora client connection and media tracks
 * @param {string} sessionId - The session/channel ID
 * @param {Object} user - Current user object
 * @returns {Object} Agora client state and methods
 */
export const useAgoraClient = (sessionId, user) => {
  const [client, setClient] = useState(null);
  const [localTracks, setLocalTracks] = useState({ video: null, audio: null });
  const [remoteTracks, setRemoteTracks] = useState(new Map());
  const [connectionState, setConnectionState] = useState('DISCONNECTED');
  const [isJoined, setIsJoined] = useState(false);
  const clientRef = useRef(null);

  /**
   * Initialize Agora client
   */
  useEffect(() => {
    const initClient = () => {
      const agoraClient = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: 'vp8' 
      });

      // Set up event listeners
      agoraClient.on('user-published', handleUserPublished);
      agoraClient.on('user-unpublished', handleUserUnpublished);
      agoraClient.on('user-left', handleUserLeft);
      agoraClient.on('connection-state-change', handleConnectionStateChange);
      agoraClient.on('network-quality', handleNetworkQuality);

      clientRef.current = agoraClient;
      setClient(agoraClient);
    };

    initClient();

    return () => {
      cleanup();
    };
  }, []);

  /**
   * Handle user published event
   */
  const handleUserPublished = useCallback(async (user, mediaType) => {
    try {
      await clientRef.current?.subscribe(user, mediaType);
      
      setRemoteTracks(prev => {
        const newMap = new Map(prev);
        const existingUser = newMap.get(user.uid) || { video: null, audio: null };
        
        if (mediaType === 'video') {
          existingUser.video = user.videoTrack;
        } else if (mediaType === 'audio') {
          existingUser.audio = user.audioTrack;
        }
        
        newMap.set(user.uid, existingUser);
        return newMap;
      });
    } catch (error) {
      console.error('Error subscribing to user:', error);
      toast.error('Failed to connect to participant');
    }
  }, []);

  /**
   * Handle user unpublished event
   */
  const handleUserUnpublished = useCallback((user, mediaType) => {
    setRemoteTracks(prev => {
      const newMap = new Map(prev);
      const existingUser = newMap.get(user.uid);
      
      if (existingUser) {
        if (mediaType === 'video') {
          existingUser.video = null;
        } else if (mediaType === 'audio') {
          existingUser.audio = null;
        }
        newMap.set(user.uid, existingUser);
      }
      
      return newMap;
    });
  }, []);

  /**
   * Handle user left event
   */
  const handleUserLeft = useCallback((user) => {
    setRemoteTracks(prev => {
      const newMap = new Map(prev);
      newMap.delete(user.uid);
      return newMap;
    });
  }, []);

  /**
   * Handle connection state changes
   */
  const handleConnectionStateChange = useCallback((curState, prevState) => {
    setConnectionState(curState);
    
    if (curState === 'DISCONNECTED') {
      toast.error('Connection lost. Attempting to reconnect...');
    } else if (curState === 'CONNECTED' && prevState === 'RECONNECTING') {
      toast.success('Reconnected successfully');
    }
  }, []);

  /**
   * Handle network quality updates
   */
  const handleNetworkQuality = useCallback((quality) => {
    // Handle network quality updates
    if (quality.downlinkNetworkQuality <= 2) {
      console.warn('Poor network quality detected');
    }
  }, []);

  /**
   * Join Agora channel
   */
  const joinChannel = useCallback(async (token, uid) => {
    if (!clientRef.current || isJoined) return;

    try {
      // Create local tracks
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      
      setLocalTracks({ audio: audioTrack, video: videoTrack });

      // Join channel
      await clientRef.current.join(
        import.meta.env.VITE_AGORA_APP_ID,
        sessionId,
        token,
        uid
      );

      // Publish local tracks
      await clientRef.current.publish([audioTrack, videoTrack]);
      
      setIsJoined(true);
      toast.success('Joined call successfully');
    } catch (error) {
      console.error('Failed to join channel:', error);
      toast.error('Failed to join call. Please check your permissions.');
      throw error;
    }
  }, [sessionId, isJoined]);

  /**
   * Leave channel and cleanup
   */
  const leaveChannel = useCallback(async () => {
    if (!clientRef.current || !isJoined) return;

    try {
      // Unpublish and close local tracks
      if (localTracks.audio) {
        localTracks.audio.close();
      }
      if (localTracks.video) {
        localTracks.video.close();
      }

      // Leave the channel
      await clientRef.current.leave();
      
      setIsJoined(false);
      setLocalTracks({ audio: null, video: null });
      setRemoteTracks(new Map());
    } catch (error) {
      console.error('Error leaving channel:', error);
    }
  }, [isJoined, localTracks]);

  /**
   * Toggle local audio
   */
  const toggleAudio = useCallback(async (enabled) => {
    if (localTracks.audio) {
      await localTracks.audio.setEnabled(enabled);
    }
  }, [localTracks.audio]);

  /**
   * Toggle local video
   */
  const toggleVideo = useCallback(async (enabled) => {
    if (localTracks.video) {
      await localTracks.video.setEnabled(enabled);
    }
  }, [localTracks.video]);

  /**
   * Cleanup on unmount
   */
  const cleanup = useCallback(() => {
    leaveChannel();
    clientRef.current?.removeAllListeners();
    clientRef.current = null;
  }, [leaveChannel]);

  return {
    client,
    localTracks,
    remoteTracks,
    connectionState,
    isJoined,
    joinChannel,
    leaveChannel,
    toggleAudio,
    toggleVideo
  };
};

export default useAgoraClient;