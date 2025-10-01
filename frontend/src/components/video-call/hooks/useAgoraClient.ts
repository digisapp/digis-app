/**
 * TypeScript version of Agora client hook
 * @module hooks/useAgoraClient
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  ConnectionState,
  UID
} from 'agora-rtc-sdk-ng';
import toast from 'react-hot-toast';

// Types
interface AgoraConfig {
  appId: string;
  channel: string;
  token: string | null;
  uid: UID;
  mode?: 'rtc' | 'live';
  codec?: 'vp8' | 'h264';
  role?: 'host' | 'audience';
}

interface LocalTracks {
  video: ICameraVideoTrack | null;
  audio: IMicrophoneAudioTrack | null;
}

interface RemoteUser extends IAgoraRTCRemoteUser {
  name?: string;
  avatar?: string;
  isCreator?: boolean;
}

interface AgoraClientState {
  client: IAgoraRTCClient | null;
  localTracks: LocalTracks;
  remoteTracks: Map<UID, RemoteUser>;
  connectionState: ConnectionState;
  isJoined: boolean;
  error: Error | null;
}

interface UseAgoraClientReturn extends AgoraClientState {
  joinChannel: () => Promise<void>;
  leaveChannel: () => Promise<void>;
  toggleAudio: (enabled?: boolean) => Promise<void>;
  toggleVideo: (enabled?: boolean) => Promise<void>;
  switchCamera: () => Promise<void>;
  setVideoQuality: (quality: VideoQuality) => Promise<void>;
  getStats: () => Promise<AgoraStats>;
}

interface VideoQuality {
  width: number;
  height: number;
  frameRate: number;
  bitrate?: number;
}

interface AgoraStats {
  duration: number;
  sendBytes: number;
  recvBytes: number;
  sendPackets: number;
  recvPackets: number;
  sendPacketsLost: number;
  recvPacketsLost: number;
  rtt: number;
  cpu: number;
  sendBitrate: number;
  recvBitrate: number;
}

// Video quality presets
const VIDEO_QUALITY_PRESETS: Record<string, VideoQuality> = {
  '1080p': { width: 1920, height: 1080, frameRate: 30, bitrate: 3000 },
  '720p': { width: 1280, height: 720, frameRate: 30, bitrate: 2000 },
  '480p': { width: 640, height: 480, frameRate: 30, bitrate: 1000 },
  '360p': { width: 480, height: 360, frameRate: 24, bitrate: 600 },
  '240p': { width: 320, height: 240, frameRate: 15, bitrate: 400 }
};

/**
 * Custom hook for managing Agora RTC client
 */
export const useAgoraClient = (config: AgoraConfig): UseAgoraClientReturn => {
  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [localTracks, setLocalTracks] = useState<LocalTracks>({
    video: null,
    audio: null
  });
  const [remoteTracks, setRemoteTracks] = useState<Map<UID, RemoteUser>>(new Map());
  const [connectionState, setConnectionState] = useState<ConnectionState>('DISCONNECTED');
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const cleanupRef = useRef(false);

  /**
   * Initialize Agora client
   */
  useEffect(() => {
    if (!config.appId) return;

    const agoraClient = AgoraRTC.createClient({
      mode: config.mode || 'rtc',
      codec: config.codec || 'vp8'
    });

    // Set up event listeners
    agoraClient.on('user-published', handleUserPublished);
    agoraClient.on('user-unpublished', handleUserUnpublished);
    agoraClient.on('user-joined', handleUserJoined);
    agoraClient.on('user-left', handleUserLeft);
    agoraClient.on('connection-state-change', handleConnectionStateChange);
    agoraClient.on('network-quality', handleNetworkQuality);
    agoraClient.on('exception', handleException);

    setClient(agoraClient);

    return () => {
      cleanupRef.current = true;
      cleanup(agoraClient);
    };
  }, [config.appId]);

  /**
   * Handle user published event
   */
  const handleUserPublished = useCallback(async (
    user: IAgoraRTCRemoteUser,
    mediaType: 'audio' | 'video'
  ) => {
    if (!client) return;

    try {
      await client.subscribe(user, mediaType);
      
      setRemoteTracks(prev => {
        const updated = new Map(prev);
        updated.set(user.uid, user as RemoteUser);
        return updated;
      });

      console.log(`User ${user.uid} published ${mediaType}`);
    } catch (err) {
      console.error('Error subscribing to user:', err);
    }
  }, [client]);

  /**
   * Handle user unpublished event
   */
  const handleUserUnpublished = useCallback((
    user: IAgoraRTCRemoteUser,
    mediaType: 'audio' | 'video'
  ) => {
    console.log(`User ${user.uid} unpublished ${mediaType}`);
  }, []);

  /**
   * Handle user joined event
   */
  const handleUserJoined = useCallback((user: IAgoraRTCRemoteUser) => {
    console.log(`User ${user.uid} joined channel`);
    toast.success('User joined the call');
  }, []);

  /**
   * Handle user left event
   */
  const handleUserLeft = useCallback((user: IAgoraRTCRemoteUser) => {
    setRemoteTracks(prev => {
      const updated = new Map(prev);
      updated.delete(user.uid);
      return updated;
    });
    
    console.log(`User ${user.uid} left channel`);
    toast.info('User left the call');
  }, []);

  /**
   * Handle connection state change
   */
  const handleConnectionStateChange = useCallback((
    curState: ConnectionState,
    prevState: ConnectionState,
    reason?: string
  ) => {
    setConnectionState(curState);
    console.log(`Connection state: ${prevState} -> ${curState}, reason: ${reason}`);
  }, []);

  /**
   * Handle network quality
   */
  const handleNetworkQuality = useCallback((stats: any) => {
    // Handle network quality updates
    if (stats.uplinkNetworkQuality > 3 || stats.downlinkNetworkQuality > 3) {
      console.warn('Poor network quality detected');
    }
  }, []);

  /**
   * Handle exceptions
   */
  const handleException = useCallback((event: any) => {
    console.error('Agora exception:', event);
    setError(new Error(event.msg || 'Agora exception occurred'));
  }, []);

  /**
   * Join channel
   */
  const joinChannel = useCallback(async () => {
    if (!client || !config.channel || isJoined) return;

    try {
      // Create local tracks
      const [audioTrack, videoTrack] = await Promise.all([
        AgoraRTC.createMicrophoneAudioTrack({
          encoderConfig: 'music_standard'
        }),
        AgoraRTC.createCameraVideoTrack({
          encoderConfig: VIDEO_QUALITY_PRESETS['720p']
        })
      ]);

      setLocalTracks({ audio: audioTrack, video: videoTrack });

      // Join channel
      await client.join(
        config.appId,
        config.channel,
        config.token,
        config.uid
      );

      // Publish local tracks
      if (config.role !== 'audience') {
        await client.publish([audioTrack, videoTrack]);
      }

      setIsJoined(true);
      toast.success('Joined channel successfully');
    } catch (err) {
      console.error('Error joining channel:', err);
      setError(err as Error);
      toast.error('Failed to join channel');
    }
  }, [client, config, isJoined]);

  /**
   * Leave channel
   */
  const leaveChannel = useCallback(async () => {
    if (!client || !isJoined) return;

    try {
      // Stop and close local tracks
      if (localTracks.audio) {
        localTracks.audio.stop();
        localTracks.audio.close();
      }
      if (localTracks.video) {
        localTracks.video.stop();
        localTracks.video.close();
      }

      // Leave channel
      await client.leave();
      
      setLocalTracks({ audio: null, video: null });
      setRemoteTracks(new Map());
      setIsJoined(false);
      
      toast.success('Left channel');
    } catch (err) {
      console.error('Error leaving channel:', err);
      setError(err as Error);
    }
  }, [client, isJoined, localTracks]);

  /**
   * Toggle audio
   */
  const toggleAudio = useCallback(async (enabled?: boolean) => {
    if (!localTracks.audio) return;

    const shouldEnable = enabled ?? !localTracks.audio.enabled;
    await localTracks.audio.setEnabled(shouldEnable);
    
    toast.success(shouldEnable ? 'Microphone unmuted' : 'Microphone muted');
  }, [localTracks.audio]);

  /**
   * Toggle video
   */
  const toggleVideo = useCallback(async (enabled?: boolean) => {
    if (!localTracks.video) return;

    const shouldEnable = enabled ?? !localTracks.video.enabled;
    await localTracks.video.setEnabled(shouldEnable);
    
    toast.success(shouldEnable ? 'Camera enabled' : 'Camera disabled');
  }, [localTracks.video]);

  /**
   * Switch camera
   */
  const switchCamera = useCallback(async () => {
    if (!localTracks.video) return;

    try {
      const devices = await AgoraRTC.getCameras();
      if (devices.length > 1) {
        const currentDevice = localTracks.video.getTrackLabel();
        const nextDevice = devices.find(d => d.label !== currentDevice);
        
        if (nextDevice) {
          await localTracks.video.setDevice(nextDevice.deviceId);
          toast.success('Camera switched');
        }
      }
    } catch (err) {
      console.error('Error switching camera:', err);
      toast.error('Failed to switch camera');
    }
  }, [localTracks.video]);

  /**
   * Set video quality
   */
  const setVideoQuality = useCallback(async (quality: VideoQuality) => {
    if (!localTracks.video) return;

    try {
      await localTracks.video.setEncoderConfiguration(quality);
      toast.success('Video quality updated');
    } catch (err) {
      console.error('Error setting video quality:', err);
      toast.error('Failed to update video quality');
    }
  }, [localTracks.video]);

  /**
   * Get connection stats
   */
  const getStats = useCallback(async (): Promise<AgoraStats> => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    const stats = client.getRTCStats();
    const localAudioStats = client.getLocalAudioStats();
    const localVideoStats = client.getLocalVideoStats();

    return {
      duration: stats.Duration || 0,
      sendBytes: stats.SendBytes || 0,
      recvBytes: stats.RecvBytes || 0,
      sendPackets: localAudioStats.sendPackets || 0,
      recvPackets: stats.RecvPackets || 0,
      sendPacketsLost: localAudioStats.sendPacketsLost || 0,
      recvPacketsLost: stats.RecvPacketsLost || 0,
      rtt: stats.RTT || 0,
      cpu: stats.CpuTotal || 0,
      sendBitrate: localVideoStats.sendBitrate || 0,
      recvBitrate: stats.RecvBitrate || 0
    };
  }, [client]);

  /**
   * Cleanup function
   */
  const cleanup = async (agoraClient: IAgoraRTCClient) => {
    try {
      // Stop local tracks
      if (localTracks.audio) {
        localTracks.audio.stop();
        localTracks.audio.close();
      }
      if (localTracks.video) {
        localTracks.video.stop();
        localTracks.video.close();
      }

      // Leave channel if joined
      if (agoraClient.connectionState !== 'DISCONNECTED') {
        await agoraClient.leave();
      }

      // Remove all listeners
      agoraClient.removeAllListeners();
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  };

  return {
    client,
    localTracks,
    remoteTracks,
    connectionState,
    isJoined,
    error,
    joinChannel,
    leaveChannel,
    toggleAudio,
    toggleVideo,
    switchCamera,
    setVideoQuality,
    getStats
  };
};

export default useAgoraClient;