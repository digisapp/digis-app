import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import agoraLoader from '../../utils/AgoraLoader';
import toast from 'react-hot-toast';

// Check if device is mobile
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};
import {
  VideoCameraIcon,
  MicrophoneIcon,
  XMarkIcon,
  UserGroupIcon,
  HeartIcon,
  ChatBubbleLeftIcon,
  GiftIcon,
  CameraIcon,
  SparklesIcon,
  ArrowPathIcon,
  StopIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';

const MobileLiveStream = ({ user, onEnd, streamConfig = {} }) => {
  const [isLive, setIsLive] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [likes, setLikes] = useState(0);
  const [messages, setMessages] = useState([]);
  const [streamTitle, setStreamTitle] = useState('');
  const [showTitleInput, setShowTitleInput] = useState(true);
  const [localTracks, setLocalTracks] = useState({ video: null, audio: null });
  const [agoraRTC, setAgoraRTC] = useState(null);
  const [loading, setLoading] = useState(false);
  const [streamDuration, setStreamDuration] = useState(0);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [cameraPermission, setCameraPermission] = useState('prompt');
  const [permissionError, setPermissionError] = useState(null);
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState({ hasVideo: true, hasAudio: true });

  const videoRef = useRef(null);
  const clientRef = useRef(null);
  const startTimeRef = useRef(null);
  const durationIntervalRef = useRef(null);

  // Initialize Agora
  useEffect(() => {
    const initAgora = async () => {
      try {
        const AgoraRTC = await agoraLoader.loadRTC();
        setAgoraRTC(AgoraRTC);
      } catch (error) {
        console.error('Failed to load Agora SDK:', error);
        toast.error('Failed to initialize streaming');
      }
    };
    initAgora();

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  // Check available devices
  const checkAvailableDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideoInput = devices.some(device => device.kind === 'videoinput');
      const hasAudioInput = devices.some(device => device.kind === 'audioinput');

      setDeviceInfo({ hasVideo: hasVideoInput, hasAudio: hasAudioInput });

      console.log('Available devices:', { hasVideoInput, hasAudioInput, devices });
      return { hasVideo: hasVideoInput, hasAudio: hasAudioInput };
    } catch (error) {
      console.error('Error checking devices:', error);
      return { hasVideo: false, hasAudio: true };
    }
  };

  // Check camera permissions
  const checkCameraPermissions = async () => {
    try {
      // First check if we're in a secure context (HTTPS or localhost)
      if (!window.isSecureContext) {
        setPermissionError('Camera requires HTTPS connection');
        return false;
      }

      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionError('Media devices not supported on this browser');
        return false;
      }

      // Check what devices are available
      const devices = await checkAvailableDevices();

      // If no video device, try audio only
      if (!devices.hasVideo) {
        console.log('No video device found, switching to audio-only mode');
        setIsAudioOnly(true);

        // Try to get audio permission only
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
          });

          // Stop the stream immediately - we just wanted to check permissions
          stream.getTracks().forEach(track => track.stop());

          setCameraPermission('granted');
          setPermissionError(null);
          return true;
        } catch (audioError) {
          console.error('Audio permission error:', audioError);
          setPermissionError('No microphone access. Please enable microphone permissions.');
          return false;
        }
      }

      // Try to get camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: isFrontCamera ? 'user' : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });

      // Stop the stream immediately - we just wanted to check permissions
      stream.getTracks().forEach(track => track.stop());

      setCameraPermission('granted');
      setPermissionError(null);
      setIsAudioOnly(false);
      return true;
    } catch (error) {
      console.error('Camera permission error:', error);

      // Try audio-only as fallback
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError' || error.name === 'OverconstrainedError') {
        console.log('Camera not found, trying audio-only mode');
        setIsAudioOnly(true);

        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
          });

          audioStream.getTracks().forEach(track => track.stop());

          setCameraPermission('granted');
          setPermissionError(null);
          return true;
        } catch (audioError) {
          console.error('Audio fallback also failed:', audioError);
          setPermissionError('No camera or microphone found');
          return false;
        }
      }

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setCameraPermission('denied');
        setPermissionError('Camera access denied. Please enable camera permissions.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setPermissionError('Camera is being used by another application');
      } else {
        setPermissionError('Unable to access camera. Please try again.');
      }
      return false;
    }
  };

  // Initialize camera
  useEffect(() => {
    const initCamera = async () => {
      if (!agoraRTC) return;

      // Check permissions first
      const hasPermission = await checkCameraPermissions();
      if (!hasPermission) {
        console.error('No camera permission');
        return;
      }

      try {
        // Small delay to ensure permissions are properly set
        await new Promise(resolve => setTimeout(resolve, 500));

        let videoTrack = null;
        let audioTrack = null;

        // Create audio track (always needed)
        try {
          audioTrack = await agoraRTC.createMicrophoneAudioTrack({
            encoderConfig: 'music_standard',
            AEC: true, // Enable echo cancellation
            ANS: true, // Enable noise suppression
            AGC: true  // Enable auto gain control
          });
        } catch (audioError) {
          console.error('Failed to create audio track:', audioError);
          setPermissionError('Microphone access failed');
          return;
        }

        // Only create video track if not in audio-only mode
        if (!isAudioOnly) {
          try {
            videoTrack = await agoraRTC.createCameraVideoTrack({
              encoderConfig: '480p_1', // Start with lower resolution for mobile
              facingMode: isFrontCamera ? 'user' : 'environment',
              optimizationMode: 'motion' // Optimize for mobile
            });

            // Play video track in the video element
            if (videoRef.current && videoTrack) {
              videoTrack.play(videoRef.current);
            }
          } catch (videoError) {
            console.error('Failed to create video track, continuing with audio only:', videoError);
            setIsAudioOnly(true);
            videoTrack = null;
          }
        }

        setLocalTracks({ video: videoTrack, audio: audioTrack });
      } catch (error) {
        console.error('Failed to initialize camera:', error);

        // More specific error handling
        if (error.code === 'DEVICE_NOT_FOUND') {
          setPermissionError('Camera not found. Please check your device.');
        } else if (error.code === 'PERMISSION_DENIED') {
          setPermissionError('Camera permission denied. Please allow camera access.');
        } else {
          setPermissionError('Failed to start camera. Please try again.');
        }

        toast.error(permissionError || 'Camera initialization failed');
      }
    };

    // Don't auto-init camera on mobile - wait for user gesture
    if (agoraRTC && showTitleInput && !isMobileDevice()) {
      initCamera();
    }

    return () => {
      // Cleanup tracks
      if (localTracks.video) {
        localTracks.video.stop();
        localTracks.video.close();
      }
      if (localTracks.audio) {
        localTracks.audio.stop();
        localTracks.audio.close();
      }
    };
  }, [agoraRTC, isFrontCamera]);

  // Start streaming - triggered by user gesture for mobile
  const handleStartStream = async () => {
    if (!streamTitle.trim()) {
      toast.error('Please enter a stream title');
      return;
    }

    setLoading(true);

    // On mobile, initialize camera on user gesture if not already done
    if (isMobileDevice() && !localTracks.video && !localTracks.audio && agoraRTC) {
      const hasPermission = await checkCameraPermissions();
      if (!hasPermission) {
        setLoading(false);
        return;
      }

      try {
        await new Promise(resolve => setTimeout(resolve, 100));

        let videoTrack = null;
        let audioTrack = null;

        // Create audio track
        try {
          audioTrack = await agoraRTC.createMicrophoneAudioTrack({
            encoderConfig: 'music_standard',
            AEC: true,
            ANS: true,
            AGC: true
          });
        } catch (audioError) {
          console.error('Failed to create audio track:', audioError);
          setPermissionError('Microphone access failed');
          setLoading(false);
          return;
        }

        // Create video track if not audio-only
        if (!isAudioOnly) {
          try {
            videoTrack = await agoraRTC.createCameraVideoTrack({
              encoderConfig: '480p_1',
              facingMode: isFrontCamera ? 'user' : 'environment',
              optimizationMode: 'motion'
            });

            if (videoRef.current && videoTrack) {
              videoTrack.play(videoRef.current);
            }
          } catch (videoError) {
            console.error('Video track failed, using audio-only:', videoError);
            setIsAudioOnly(true);
          }
        }

        setLocalTracks({ video: videoTrack, audio: audioTrack });
      } catch (error) {
        console.error('Failed to initialize media:', error);
        setPermissionError('Failed to start camera');
        setLoading(false);
        return;
      }
    }

    try {
      // Here you would normally:
      // 1. Get Agora token from backend
      // 2. Join Agora channel
      // 3. Publish tracks
      // For now, we'll simulate it

      setIsLive(true);
      setShowTitleInput(false);
      startTimeRef.current = Date.now();

      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setStreamDuration(seconds);
        }
      }, 1000);

      // Simulate viewer count
      setTimeout(() => setViewerCount(Math.floor(Math.random() * 50) + 10), 2000);

      toast.success('You are now live! 🎉');
    } catch (error) {
      console.error('Failed to start stream:', error);
      toast.error('Failed to start stream');
    } finally {
      setLoading(false);
    }
  };

  // End streaming
  const handleEndStream = async () => {
    setShowEndConfirm(false);
    setLoading(true);

    try {
      // Clean up Agora connection
      if (clientRef.current) {
        await clientRef.current.leave();
      }

      // Clean up tracks
      if (localTracks.video) {
        localTracks.video.stop();
        localTracks.video.close();
      }
      if (localTracks.audio) {
        localTracks.audio.stop();
        localTracks.audio.close();
      }

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      toast.success('Stream ended');
      onEnd();
    } catch (error) {
      console.error('Error ending stream:', error);
      toast.error('Error ending stream');
    } finally {
      setLoading(false);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localTracks.video) {
      const newState = !isVideoEnabled;
      localTracks.video.setEnabled(newState);
      setIsVideoEnabled(newState);
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localTracks.audio) {
      const newState = !isAudioEnabled;
      localTracks.audio.setEnabled(newState);
      setIsAudioEnabled(newState);
    }
  };

  // Request camera permission
  const requestCameraPermission = async () => {
    setPermissionError(null);
    const hasPermission = await checkCameraPermissions();
    if (hasPermission) {
      // Reinitialize camera after getting permission
      window.location.reload(); // Simple reload to reinitialize
    }
  };

  // Switch camera
  const switchCamera = async () => {
    if (!agoraRTC || !localTracks.video) return;

    try {
      // Stop current video track
      localTracks.video.stop();
      localTracks.video.close();

      // Toggle camera facing
      setIsFrontCamera(!isFrontCamera);

      // Small delay for state update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create new video track with opposite camera
      const newVideoTrack = await agoraRTC.createCameraVideoTrack({
        encoderConfig: '480p_1',
        facingMode: isFrontCamera ? 'environment' : 'user', // Note: inverted because state hasn't updated yet
        optimizationMode: 'motion'
      });

      // Play new track
      if (videoRef.current) {
        newVideoTrack.play(videoRef.current);
      }

      setLocalTracks(prev => ({ ...prev, video: newVideoTrack }));
    } catch (error) {
      console.error('Failed to switch camera:', error);
      toast.error('Failed to switch camera');
      // Revert camera facing state
      setIsFrontCamera(!isFrontCamera);
    }
  };

  // Format duration
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Simulate receiving likes
  useEffect(() => {
    if (isLive) {
      const interval = setInterval(() => {
        if (Math.random() > 0.7) {
          setLikes(prev => prev + Math.floor(Math.random() * 5) + 1);
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isLive]);

  return (
    <div className="fixed inset-0 bg-black z-[9999]" style={{ height: '100vh', width: '100vw' }}>
      {/* Video Preview */}
      <div className="relative h-full w-full" style={{ height: '100vh', width: '100vw' }}>
        {!isAudioOnly ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
            webkit-playsinline="true"
            x5-playsinline="true"
            x5-video-player-type="h5"
            style={{
              transform: isFrontCamera ? 'scaleX(-1)' : 'none',
              WebkitTransform: isFrontCamera ? 'scaleX(-1)' : 'none',
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
            <div className="text-center text-white">
              <MicrophoneIcon className="w-24 h-24 mx-auto mb-4 animate-pulse" />
              <h2 className="text-2xl font-bold mb-2">Audio-Only Mode</h2>
              <p className="text-lg opacity-90">Broadcasting audio stream</p>
            </div>
          </div>
        )}

        {/* Dark overlay when not live */}
        {!isLive && (
          <div className="absolute inset-0 bg-black/40" />
        )}

        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isLive && (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded animate-pulse">
                      LIVE
                    </span>
                    <span className="text-white text-sm">
                      {formatDuration(streamDuration)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-white">
                      <UserGroupIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">{viewerCount}</span>
                    </div>
                    <div className="flex items-center gap-1 text-white">
                      <HeartIconSolid className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-medium">{likes}</span>
                    </div>
                  </div>
                  <h3 className="text-white font-medium mt-2 text-sm">{streamTitle}</h3>
                </>
              )}
            </div>

            {/* Close/End button */}
            <button
              onClick={() => isLive ? setShowEndConfirm(true) : onEnd()}
              className="p-2 bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Permission Error */}
        {permissionError && !isLive && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6">
            <div className="bg-white rounded-2xl p-6 shadow-2xl">
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <CameraIcon className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-xl font-bold mb-2">Camera Access Required</h2>
                <p className="text-gray-600 mb-6">{permissionError}</p>

                {cameraPermission === 'denied' && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-700 mb-2">
                      To enable camera access:
                    </p>
                    <ol className="text-left text-sm text-gray-600 space-y-1">
                      <li>1. Open your browser settings</li>
                      <li>2. Find site permissions</li>
                      <li>3. Allow camera access for this site</li>
                      <li>4. Refresh the page</li>
                    </ol>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={onEnd}
                    className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={requestCameraPermission}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-bold"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Title Input (before going live) */}
        {showTitleInput && !isLive && !permissionError && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6">
            <div className="bg-white rounded-2xl p-6 shadow-2xl">
              <h2 className="text-xl font-bold mb-4 text-center">Ready to go live?</h2>
              <input
                type="text"
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                placeholder="Enter stream title..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 text-center"
                maxLength={50}
              />
              <button
                onClick={handleStartStream}
                disabled={loading || !streamTitle.trim() || !localTracks.video}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-bold disabled:opacity-50"
              >
                {loading ? 'Starting...' : !localTracks.video ? 'Initializing camera...' : 'Start Stream'}
              </button>
            </div>
          </div>
        )}

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
          {isLive && (
            <>
              {/* Action buttons */}
              <div className="flex justify-center gap-4 mb-4">
                {/* Switch Camera - only show if video is available */}
                {!isAudioOnly && (
                  <button
                    onClick={switchCamera}
                    className="p-3 bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors"
                  >
                    <ArrowPathIcon className="w-6 h-6" />
                  </button>
                )}

                {/* Toggle Video - only show if video is available */}
                {!isAudioOnly && (
                  <button
                    onClick={toggleVideo}
                    className={`p-3 rounded-full transition-colors ${
                      isVideoEnabled
                        ? 'bg-black/40 text-white hover:bg-black/60'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    <VideoCameraIcon className={`w-6 h-6 ${!isVideoEnabled ? 'line-through' : ''}`} />
                  </button>
                )}

                {/* Toggle Audio */}
                <button
                  onClick={toggleAudio}
                  className={`p-3 rounded-full transition-colors ${
                    isAudioEnabled
                      ? 'bg-black/40 text-white hover:bg-black/60'
                      : 'bg-red-600 text-white'
                  }`}
                >
                  <MicrophoneIcon className={`w-6 h-6 ${!isAudioEnabled ? 'line-through' : ''}`} />
                </button>

                {/* Effects/Filters (placeholder) */}
                <button
                  className="p-3 bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors"
                >
                  <SparklesIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Comments/Chat preview */}
              <div className="max-h-32 overflow-y-auto mb-4">
                {messages.map((msg, i) => (
                  <div key={i} className="text-white text-sm mb-1">
                    <span className="font-bold">{msg.user}:</span> {msg.text}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* End Stream Confirmation */}
        <AnimatePresence>
          {showEndConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl p-6 w-full max-w-sm"
              >
                <h3 className="text-xl font-bold mb-3">End Stream?</h3>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to end your live stream?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowEndConfirm(false)}
                    className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEndStream}
                    className="flex-1 py-3 bg-red-600 text-white rounded-lg font-medium"
                  >
                    End Stream
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MobileLiveStream;