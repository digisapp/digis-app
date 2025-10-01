import { useState, useCallback, useRef, useEffect } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import logger from '../utils/logger';
import environment from '../config/environment';

// Custom hook for managing Agora tracks
export const useAgoraTracks = () => {
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localScreenTrack, setLocalScreenTrack] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState(null);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState(null);

  const tracksRef = useRef({ audio: null, video: null, screen: null });
  const cleanupRef = useRef(false);

  // Get available devices
  const getDevices = useCallback(async () => {
    try {
      const devices = await AgoraRTC.getDevices();
      const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
      const videoInputDevices = devices.filter(device => device.kind === 'videoinput');

      setAudioDevices(audioInputDevices);
      setVideoDevices(videoInputDevices);

      logger.info(`Found ${audioInputDevices.length} audio devices and ${videoInputDevices.length} video devices`);
    } catch (err) {
      logger.error('Failed to get devices:', err);
    }
  }, []);

  // Initialize devices on mount
  useEffect(() => {
    getDevices();
  }, [getDevices]);

  // Create audio track
  const createAudioTrack = useCallback(async (config = {}) => {
    try {
      // Close existing track if any
      if (tracksRef.current.audio) {
        tracksRef.current.audio.close();
      }

      const audioConfig = {
        encoderConfig: 'speech_standard',
        ANS: environment.FEATURES.ENABLE_NOISE_SUPPRESSION,
        AEC: true,
        AGC: true,
        ...config
      };

      if (selectedAudioDevice) {
        audioConfig.microphoneId = selectedAudioDevice;
      }

      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack(audioConfig);

      tracksRef.current.audio = audioTrack;
      setLocalAudioTrack(audioTrack);
      setIsAudioEnabled(true);

      logger.info('Audio track created successfully');
      return audioTrack;
    } catch (err) {
      logger.error('Failed to create audio track:', err);
      throw err;
    }
  }, [selectedAudioDevice]);

  // Create video track
  const createVideoTrack = useCallback(async (config = {}) => {
    try {
      // Close existing track if any
      if (tracksRef.current.video) {
        tracksRef.current.video.close();
      }

      const videoQuality = environment.VIDEO_CALL.DEFAULT_VIDEO_QUALITY;
      const qualityConfig = environment.VIDEO_CALL.VIDEO_QUALITIES[videoQuality];

      const videoConfig = {
        encoderConfig: {
          width: qualityConfig.width,
          height: qualityConfig.height,
          frameRate: qualityConfig.frameRate,
          bitrateMin: qualityConfig.bitrate * 0.5,
          bitrateMax: qualityConfig.bitrate,
        },
        ...config
      };

      if (selectedVideoDevice) {
        videoConfig.cameraId = selectedVideoDevice;
      }

      const videoTrack = await AgoraRTC.createCameraVideoTrack(videoConfig);

      tracksRef.current.video = videoTrack;
      setLocalVideoTrack(videoTrack);
      setIsVideoEnabled(true);

      logger.info('Video track created successfully');
      return videoTrack;
    } catch (err) {
      logger.error('Failed to create video track:', err);
      throw err;
    }
  }, [selectedVideoDevice]);

  // Create screen share track
  const createScreenTrack = useCallback(async (config = {}) => {
    if (!environment.FEATURES.ENABLE_SCREEN_SHARE) {
      logger.warn('Screen sharing is disabled');
      return null;
    }

    try {
      const screenConfig = {
        encoderConfig: {
          width: environment.VIDEO_CALL.SCREEN_SHARE_CONFIG.width,
          height: environment.VIDEO_CALL.SCREEN_SHARE_CONFIG.height,
          frameRate: environment.VIDEO_CALL.SCREEN_SHARE_CONFIG.frameRate,
          bitrateMax: environment.VIDEO_CALL.SCREEN_SHARE_CONFIG.bitrate,
        },
        ...config
      };

      const screenTrack = await AgoraRTC.createScreenVideoTrack(screenConfig, 'disable');

      tracksRef.current.screen = screenTrack;
      setLocalScreenTrack(screenTrack);
      setIsScreenSharing(true);

      logger.info('Screen track created successfully');
      return screenTrack;
    } catch (err) {
      logger.error('Failed to create screen track:', err);
      throw err;
    }
  }, []);

  // Create both audio and video tracks
  const createTracks = useCallback(async (audioConfig = {}, videoConfig = {}) => {
    const tracks = await Promise.all([
      createAudioTrack(audioConfig),
      createVideoTrack(videoConfig)
    ]);

    return tracks;
  }, [createAudioTrack, createVideoTrack]);

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    if (!localAudioTrack) return;

    const newState = !isAudioEnabled;
    await localAudioTrack.setEnabled(newState);
    setIsAudioEnabled(newState);

    logger.info(`Audio ${newState ? 'enabled' : 'disabled'}`);
  }, [localAudioTrack, isAudioEnabled]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!localVideoTrack) return;

    const newState = !isVideoEnabled;
    await localVideoTrack.setEnabled(newState);
    setIsVideoEnabled(newState);

    logger.info(`Video ${newState ? 'enabled' : 'disabled'}`);
  }, [localVideoTrack, isVideoEnabled]);

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      if (localScreenTrack) {
        localScreenTrack.close();
        setLocalScreenTrack(null);
        tracksRef.current.screen = null;
      }
      setIsScreenSharing(false);
      logger.info('Screen sharing stopped');
    } else {
      // Start screen sharing
      await createScreenTrack();
    }
  }, [isScreenSharing, localScreenTrack, createScreenTrack]);

  // Switch camera
  const switchCamera = useCallback(async (deviceId) => {
    if (!localVideoTrack) return;

    try {
      await localVideoTrack.setDevice(deviceId);
      setSelectedVideoDevice(deviceId);
      logger.info(`Switched to camera: ${deviceId}`);
    } catch (err) {
      logger.error('Failed to switch camera:', err);
      throw err;
    }
  }, [localVideoTrack]);

  // Switch microphone
  const switchMicrophone = useCallback(async (deviceId) => {
    if (!localAudioTrack) return;

    try {
      await localAudioTrack.setDevice(deviceId);
      setSelectedAudioDevice(deviceId);
      logger.info(`Switched to microphone: ${deviceId}`);
    } catch (err) {
      logger.error('Failed to switch microphone:', err);
      throw err;
    }
  }, [localAudioTrack]);

  // Set video quality
  const setVideoQuality = useCallback(async (quality) => {
    if (!localVideoTrack) return;

    const qualityConfig = environment.VIDEO_CALL.VIDEO_QUALITIES[quality];
    if (!qualityConfig) {
      logger.warn(`Unknown video quality: ${quality}`);
      return;
    }

    try {
      await localVideoTrack.setEncoderConfiguration({
        width: qualityConfig.width,
        height: qualityConfig.height,
        frameRate: qualityConfig.frameRate,
        bitrateMin: qualityConfig.bitrate * 0.5,
        bitrateMax: qualityConfig.bitrate,
      });

      logger.info(`Video quality set to: ${quality}`);
    } catch (err) {
      logger.error('Failed to set video quality:', err);
    }
  }, [localVideoTrack]);

  // Get audio level
  const getAudioLevel = useCallback(() => {
    if (!localAudioTrack) return 0;
    return localAudioTrack.getVolumeLevel();
  }, [localAudioTrack]);

  // Cleanup tracks
  const cleanup = useCallback(() => {
    if (cleanupRef.current) return;
    cleanupRef.current = true;

    // Close all tracks
    Object.values(tracksRef.current).forEach(track => {
      if (track) {
        track.close();
      }
    });

    tracksRef.current = { audio: null, video: null, screen: null };
    setLocalAudioTrack(null);
    setLocalVideoTrack(null);
    setLocalScreenTrack(null);

    logger.info('All tracks cleaned up');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    // Tracks
    localAudioTrack,
    localVideoTrack,
    localScreenTrack,

    // States
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,

    // Devices
    audioDevices,
    videoDevices,
    selectedAudioDevice,
    selectedVideoDevice,

    // Actions
    createAudioTrack,
    createVideoTrack,
    createScreenTrack,
    createTracks,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    switchCamera,
    switchMicrophone,
    setVideoQuality,
    getAudioLevel,
    getDevices,
    cleanup,
  };
};