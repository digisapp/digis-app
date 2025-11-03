import React, { useState, useRef, useEffect, useCallback } from 'react';
import agoraLoader from '../utils/AgoraLoader';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import SimpleProductSelector from './streaming/SimpleProductSelector';
import {
  CurrencyDollarIcon,
  CheckCircleIcon,
  SparklesIcon,
  VideoCameraIcon,
  MicrophoneIcon,
  CogIcon,
  AdjustmentsHorizontalIcon,
  SignalIcon,
  WifiIcon,
  TrophyIcon,
  HashtagIcon,
  LockClosedIcon,
  XMarkIcon,
  PlusIcon,
  ClockIcon,
  UserGroupIcon,
  GlobeAltIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ShoppingBagIcon,
  PhotoIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';

const GoLiveSetup = ({ onGoLive, onCancel, user }) => {
  const [localTracks, setLocalTracks] = useState({ video: null, audio: null });
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamCategory, setStreamCategory] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceError, setDeviceError] = useState('');
  const [agoraRTC, setAgoraRTC] = useState(null);
  const [sdkLoading, setSdkLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [enableShopping, setEnableShopping] = useState(false);
  const [streamGoal, setStreamGoal] = useState({
    enabled: true,
    currentLevel: 1,
    level1: { amount: 5000, description: 'Level 1 Goal' },
    level2: { amount: 10000, description: 'Level 2 Goal' },
    level3: { amount: 25000, description: 'Level 3 Goal' }
  });
  
  // New state for enhancements
  const [streamTags, setStreamTags] = useState([]);
  const [currentTag, setCurrentTag] = useState('');
  const [streamPrivacy, setStreamPrivacy] = useState('public'); // public, followers, subscribers
  const [overlayLogo, setOverlayLogo] = useState(null);
  const logoFileInputRef = useRef(null);
  
  // Simplified audience control with just pricing
  const [audienceControl, setAudienceControl] = useState({
    visibility: 'public',
    joinPrice: 0,
    privateStreamPrice: 0,
    tokenRequirement: 0,
    minTokensPerMinute: 0,
    maxViewers: 0,
    ageRestriction: false,
    chatMode: 'everyone',
    chatMinTokens: 100
  });
  
  // Default advanced settings (hidden from UI)
  const [advancedSettings] = useState({
    videoResolution: '720p',
    frameRate: '60',
    autoRecord: true,
    allowDownloads: false,
    enableChatFilters: true,
    slowMode: false,
    notifySubscribers: true,
    scheduleStream: false
  });
  
  const videoRef = useRef(null);
  const clientRef = useRef(null);

  const categories = [
    'Gaming', 'Music', 'Art', 'Model', 'Fitness', 'Yoga', 'Cooking', 'Dance', 'Comedy',
    'Education', 'Lifestyle', 'Fashion', 'Tech', 'Sports', 'Travel',
    'Photography', 'Crafts', 'Beauty', 'Business', 'Meditation', 'Other'
  ];

  const cleanupTracks = useCallback(() => {
    // Clean up Agora tracks
    if (localTracks.video) {
      localTracks.video.stop();
      localTracks.video.close();
    }
    if (localTracks.audio) {
      localTracks.audio.stop();
      localTracks.audio.close();
    }
    
    // Clean up native stream if exists
    if (window.currentStream) {
      window.currentStream.getTracks().forEach(track => track.stop());
      window.currentStream = null;
    }
    
    // Clear video element srcObject
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null;
    }
  }, [localTracks.video, localTracks.audio]);

  useEffect(() => {
    // Auto-initialize camera when component mounts
    console.log('Auto-initializing camera on mount...');
    initializeCamera();

    // Handle orientation changes on mobile
    const handleOrientationChange = () => {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile && localTracks.video) {
        // Reinitialize camera with new orientation
        cleanupTracks();
        setTimeout(() => initializeCamera(), 500);
      }
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      cleanupTracks();
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-attach video when video is re-enabled or tracks change
  useEffect(() => {
    const attachVideo = async () => {
      if (localTracks.video && videoRef.current) {
        try {
          // Force video element to be visible first
          videoRef.current.style.opacity = '1';
          videoRef.current.style.display = 'block';
          videoRef.current.style.backgroundColor = 'transparent';
          
          // Then play the video track
          await localTracks.video.play(videoRef.current);
          console.log('✅ Video attached and playing');
        } catch (error) {
          console.error('Error attaching video:', error);
          // Retry once after a delay
          setTimeout(async () => {
            if (localTracks.video && videoRef.current) {
              try {
                videoRef.current.style.opacity = '1';
                videoRef.current.style.display = 'block';
                await localTracks.video.play(videoRef.current);
                console.log('✅ Video playing on retry');
              } catch (retryError) {
                console.error('Retry failed:', retryError);
              }
            }
          }, 500);
        }
      }
    };
    
    attachVideo();
  }, [localTracks.video]);

  const initializeCamera = async () => {
    try {
      setDeviceError('');
      // Don't set sdkLoading to true here as it hides the video element
      console.log('🎥 Initializing camera...');
      
      // Clean up any existing tracks first
      if (localTracks.video) {
        localTracks.video.stop();
        localTracks.video.close();
      }
      if (localTracks.audio) {
        localTracks.audio.stop();
        localTracks.audio.close();
      }
      
      // Clean up native stream if exists
      if (window.currentStream) {
        window.currentStream.getTracks().forEach(track => track.stop());
        window.currentStream = null;
      }
      
      // Try native getUserMedia first for faster initialization
      try {
        console.log('Trying native getUserMedia first...');
        // Mobile-optimized constraints
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const isPortrait = window.innerHeight > window.innerWidth;
        const constraints = {
          video: isMobile ? {
            facingMode: 'user',
            width: isPortrait ? { ideal: 720, max: 1080 } : { ideal: 1280, max: 1920 },
            height: isPortrait ? { ideal: 1280, max: 1920 } : { ideal: 720, max: 1080 },
            aspectRatio: isPortrait ? 9/16 : 16/9
          } : {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
          videoRef.current.style.opacity = '1';
          videoRef.current.style.display = 'block';
          videoRef.current.style.backgroundColor = 'transparent';
          
          // Add onloadedmetadata to ensure video is ready
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().then(() => {
              console.log('✅ Native video playing successfully');
            }).catch(err => {
              console.error('Error playing video:', err);
            });
          };
          
          // Store the stream for cleanup
          window.currentStream = stream;
          setIsVideoEnabled(true);
          setIsAudioEnabled(true);
          setDeviceError('');
          
          // Now load Agora SDK in background
          loadAgoraInBackground();
          return;
        }
      } catch (nativeError) {
        console.log('Native getUserMedia failed, falling back to Agora:', nativeError);
      }
      
      // Load Agora SDK if native failed
      if (!agoraRTC) {
        setSdkLoading(true);
        console.log('📦 Loading Agora SDK...');
        try {
          const AgoraRTC = await agoraLoader.loadRTC();
          setAgoraRTC(AgoraRTC);
          console.log('✅ Agora SDK loaded');
          
          // Create Agora client
          if (!clientRef.current) {
            clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

            // Add connection state monitoring for network feedback
            clientRef.current.on('connection-state-change', (curState, revState, reason) => {
              console.log('📡 Desktop connection state:', curState, 'reason:', reason);
              if (curState === 'DISCONNECTED' && reason) {
                toast.error('Connection lost. Please check your network.', {
                  duration: 4000,
                  icon: '🔌'
                });
              } else if (curState === 'CONNECTED') {
                console.log('✅ Connected to Agora servers');
              }
            });
          }

          // Create local tracks with specific settings
          const [videoTrack, audioTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
            {
              audioConfig: {
                encoderConfig: 'music_standard'
              }
            },
            {
              encoderConfig: {
                width: 1280,
                height: 720,
                frameRate: 30,
                bitrate: 2000
              },
              facingMode: 'user'
            }
          );
          
          setSdkLoading(false);
          
          console.log('✅ Tracks created:', { videoTrack, audioTrack });
          
          // Clear native stream if exists
          if (window.currentStream) {
            window.currentStream.getTracks().forEach(track => track.stop());
            window.currentStream = null;
          }
          
          // Set tracks
          setLocalTracks({ video: videoTrack, audio: audioTrack });
          
          // Ensure video and audio are enabled
          setIsVideoEnabled(true);
          setIsAudioEnabled(true);
          
          // Play video immediately
          if (videoTrack && videoRef.current) {
            videoRef.current.srcObject = null; // Clear any native stream
            videoRef.current.style.opacity = '1';
            videoRef.current.style.display = 'block';
            await videoTrack.play(videoRef.current);
            console.log('✅ Agora video track playing successfully');
          }
        } catch (sdkError) {
          setSdkLoading(false);
          console.error('Failed to load Agora SDK:', sdkError);
          throw sdkError;
        }
      } else {
        // SDK already loaded, use it
        await createAgoraTracks();
      }
      
    } catch (error) {
      console.error('Camera initialization error:', error);
      
      // User-friendly error messages
      let errorMessage = '';
      if (error.message?.includes('Permission denied')) {
        errorMessage = 'Camera/microphone access denied. Please check your browser permissions.';
      } else if (error.message?.includes('NotFoundError') || error.message?.includes('DEVICE_NOT_FOUND')) {
        errorMessage = 'No camera or microphone detected. Please connect a device and try again.';
      } else if (error.message?.includes('NotAllowedError')) {
        errorMessage = 'Permission to access camera/microphone was denied.';
      } else if (error.message?.includes('NotReadableError')) {
        errorMessage = 'Camera/microphone is already in use by another application.';
      } else {
        errorMessage = 'Unable to access camera or microphone. Please check your device settings.';
      }
      
      setDeviceError(errorMessage);
      setSdkLoading(false);
    }
  };

  const loadAgoraInBackground = async () => {
    if (!agoraRTC) {
      try {
        const AgoraRTC = await agoraLoader.loadRTC();
        setAgoraRTC(AgoraRTC);
        console.log('✅ Agora SDK loaded in background');
        
        // Create client for later use
        if (!clientRef.current) {
          clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        }
      } catch (error) {
        console.error('Failed to load Agora SDK in background:', error);
      }
    }
  };

  const createAgoraTracks = async () => {
    const AgoraRTC = agoraRTC;

    // Create Agora client if needed
    if (!clientRef.current) {
      clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    }

    // Check if mobile and orientation
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isPortrait = window.innerHeight > window.innerWidth;

    // Create local tracks with proper dimensions for mobile
    const [videoTrack, audioTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
      {
        audioConfig: {
          encoderConfig: 'music_standard'
        }
      },
      {
        encoderConfig: isMobile && isPortrait ? {
          width: 720,
          height: 1280,
          frameRate: 30,
          bitrate: 2000
        } : {
          width: 1280,
          height: 720,
          frameRate: 30,
          bitrate: 2000
        },
        facingMode: 'user'
      }
    );
    
    console.log('✅ Agora tracks created');
    
    // Clear native stream if exists
    if (window.currentStream) {
      window.currentStream.getTracks().forEach(track => track.stop());
      window.currentStream = null;
    }
    
    // Set tracks
    setLocalTracks({ video: videoTrack, audio: audioTrack });
    setIsVideoEnabled(true);
    setIsAudioEnabled(true);
    
    // Play video
    if (videoTrack && videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.style.opacity = '1';
      videoRef.current.style.display = 'block';
      await videoTrack.play(videoRef.current);
      console.log('✅ Agora video playing');
    }
  };

  const toggleVideo = async () => {
    if (localTracks.video) {
      if (isVideoEnabled) {
        await localTracks.video.setEnabled(false);
        setIsVideoEnabled(false);
      } else {
        await localTracks.video.setEnabled(true);
        setIsVideoEnabled(true);
      }
    } else if (window.currentStream) {
      // Handle native stream
      const videoTrack = window.currentStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = async () => {
    if (localTracks.audio) {
      if (isAudioEnabled) {
        await localTracks.audio.setEnabled(false);
        setIsAudioEnabled(false);
      } else {
        await localTracks.audio.setEnabled(true);
        setIsAudioEnabled(true);
      }
    } else if (window.currentStream) {
      // Handle native stream
      const audioTrack = window.currentStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const handleGoLive = async () => {
    // Validate stream information
    if (!streamTitle.trim()) {
      toast.error('Please enter a stream title');
      return;
    }

    if (!streamCategory) {
      toast.error('Please select a category');
      return;
    }

    // If using native stream, switch to Agora tracks
    if (window.currentStream && agoraRTC) {
      toast.loading('Switching to streaming mode...');
      try {
        await createAgoraTracks();
      } catch (error) {
        console.error('Failed to create Agora tracks:', error);
        toast.error('Failed to initialize streaming. Please try again.');
        return;
      }
    }

    // Validate that we have both video and audio tracks
    if (!localTracks.video && !window.currentStream?.getVideoTracks()?.length) {
      toast.error('Camera is required to go live. Please enable your camera.');
      return;
    }

    if (!localTracks.audio && !window.currentStream?.getAudioTracks()?.length) {
      toast.error('Microphone is required to go live. Please enable your microphone.');
      return;
    }

    // Validate that tracks are enabled
    if (!isVideoEnabled) {
      toast.error('Please enable your camera before going live');
      return;
    }

    if (!isAudioEnabled) {
      toast.error('Please enable your microphone before going live');
      return;
    }

    setLoading(true);

    try {
      // Pass the local tracks and stream info to parent
      const streamConfig = {
        title: streamTitle.trim(),
        category: streamCategory,
        description: streamDescription.trim(),
        tracks: localTracks,
        shoppingEnabled: enableShopping && selectedProducts.length > 0,
        selectedProducts: selectedProducts,
        client: clientRef.current,
        audienceControl: audienceControl,
        advancedSettings: advancedSettings,
        streamGoal: streamGoal,
        tags: streamTags,
        privacy: streamPrivacy,
        isTestStream: false,
        overlaySettings: overlayLogo ? {
          image: overlayLogo,
          position: 'top-left',
          size: 'small',
          opacity: 0.8
        } : null
      };

      await onGoLive(streamConfig);
      // Don't reset loading here - navigation will unmount this component

    } catch (error) {
      console.error('Go live error:', error);
      toast.error('Failed to start live stream');
      setLoading(false);
    }
  };

  const handleCancel = () => {
    cleanupTracks();
    onCancel();
  };
  
  // Handle tag addition
  const handleAddTag = () => {
    if (currentTag.trim() && streamTags.length < 5) {
      const tag = currentTag.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!streamTags.includes(tag)) {
        setStreamTags([...streamTags, tag]);
        setCurrentTag('');
      }
    } else if (streamTags.length >= 5) {
      toast.error('Maximum 5 tags allowed');
    }
  };
  
  // Handle tag removal
  const handleRemoveTag = (tagToRemove) => {
    setStreamTags(streamTags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      data-golive-modal="true"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Modal Content - Optimized for mobile */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="relative bg-white rounded-2xl sm:rounded-3xl w-[95%] sm:w-full max-w-6xl shadow-2xl flex flex-col mx-2 my-4 sm:m-4"
        style={{
          maxHeight: 'calc(100vh - 2rem)',
          height: 'auto',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {/* Header - Sticky on mobile */}
        <div className="sticky top-0 z-10 bg-gradient-to-br from-purple-600 via-pink-600 to-purple-600 p-3 sm:p-5 overflow-hidden rounded-t-2xl sm:rounded-t-3xl">
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative flex items-center justify-between">
            <div className="text-white">
              <motion.h2
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-lg sm:text-2xl font-bold"
              >
                <span className="hidden sm:inline">Go Live Setup</span>
                <span className="sm:hidden">Go Live</span>
              </motion.h2>
            </div>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleCancel}
              className="text-white/80 hover:text-white bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-1.5 sm:p-2 transition-all"
            >
              <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </motion.button>
          </div>
        </div>

        {/* Main Content - Mobile First Layout */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto">
          {/* Video Preview - Full width on mobile */}
          <div className="w-full lg:w-1/2 p-3 sm:p-6 bg-gradient-to-br from-gray-50 to-white flex flex-col">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col"
            >
              {/* Video Container */}
              <div className="relative bg-black rounded-xl sm:rounded-2xl overflow-hidden shadow-xl h-[250px] sm:h-[350px] lg:h-[400px]">
                {/* Always render video element for camera preview */}
                <video 
                  ref={videoRef} 
                  className="absolute inset-0 w-full h-full object-cover" 
                  id="stream-preview"
                  autoPlay
                  playsInline
                  muted
                  style={{
                    // Remove mirroring - video should show as-is like in live stream
                    backgroundColor: 'transparent',
                    opacity: deviceError || !isVideoEnabled ? '0' : '1',
                    display: 'block'
                  }}
                />
                {deviceError ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-center p-8"
                    >
                      <h4 className="text-white font-semibold text-xl mb-3">Camera Setup Required</h4>
                      <p className="text-gray-300 text-sm mb-6 max-w-xs mx-auto">{deviceError}</p>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={initializeCamera}
                        className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all font-medium shadow-lg"
                      >
                        Try Again
                      </motion.button>
                    </motion.div>
                  </div>
                ) : sdkLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-center"
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center mb-3 mx-auto"
                      >
                        <CogIcon className="w-8 h-8 text-purple-400" />
                      </motion.div>
                      <p className="text-gray-300 font-medium">Loading Camera...</p>
                    </motion.div>
                  </div>
                ) : !isVideoEnabled ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-gray-700/50 rounded-full flex items-center justify-center mb-3 mx-auto">
                        <VideoCameraIcon className="w-10 h-10 text-gray-400" />
                      </div>
                      <p className="text-gray-300 font-medium">Camera is Off</p>
                      <p className="text-gray-500 text-sm mt-1">Click the camera button to enable</p>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Camera/Mic Controls - Mobile-friendly */}
              <div className="flex items-center justify-center gap-3 sm:gap-4 mt-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleVideo}
                  className={`p-3 sm:p-4 rounded-full shadow-lg transition-all ${
                    isVideoEnabled
                      ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                  disabled={deviceError}
                >
                  <VideoCameraIcon className="w-6 h-6 sm:w-7 sm:h-7" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleAudio}
                  className={`p-3 sm:p-4 rounded-full shadow-lg transition-all ${
                    isAudioEnabled
                      ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                  disabled={deviceError}
                >
                  <MicrophoneIcon className="w-6 h-6 sm:w-7 sm:h-7" />
                </motion.button>
              </div>
            </motion.div>
          </div>

          {/* Stream Settings - Full width on mobile */}
          <div className="w-full lg:w-1/2 p-3 sm:p-6 bg-white">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              {/* Essential Settings */}
              <div className="space-y-3 sm:space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Title *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={streamTitle}
                      onChange={(e) => setStreamTitle(e.target.value)}
                      placeholder="What's your stream about?"
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 pr-16 sm:pr-20 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm sm:text-base"
                      maxLength={100}
                      required
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      {streamTitle && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                          <CheckCircleIcon className="w-5 h-5 text-green-500" />
                        </motion.div>
                      )}
                      <span className="text-xs text-gray-400">{streamTitle.length}/100</span>
                    </div>
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Category *
                  </label>
                  <select
                    value={streamCategory}
                    onChange={(e) => setStreamCategory(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none cursor-pointer text-sm sm:text-base"
                    required
                  >
                    <option value="">Select a category</option>
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Advanced Settings (Collapsible) */}
              <div className="bg-gray-50 rounded-lg sm:rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium text-sm sm:text-base text-gray-700 flex items-center gap-2">
                    <AdjustmentsHorizontalIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    Advanced Settings
                  </span>
                  {showAdvanced ? (
                    <ChevronUpIcon className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                
                {showAdvanced && (
                  <div className="p-4 border-t border-gray-200 space-y-4">
                    {/* Logo Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <PhotoIcon className="w-4 h-4 inline mr-1" />
                        Stream Logo (Top-Left)
                      </label>
                      <div className="flex items-center gap-3">
                        {overlayLogo ? (
                          <div className="flex items-center gap-3 flex-1">
                            <img
                              src={overlayLogo}
                              alt="Logo"
                              className="h-12 w-auto object-contain bg-gray-100 rounded-lg p-1"
                            />
                            <span className="text-sm text-gray-600 truncate flex-1">Logo uploaded</span>
                            <button
                              onClick={() => setOverlayLogo(null)}
                              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => logoFileInputRef.current?.click()}
                            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center justify-center gap-2 transition-colors"
                          >
                            <ArrowUpTrayIcon className="w-4 h-4" />
                            <span className="text-sm">Upload Logo (PNG)</span>
                          </button>
                        )}
                        <input
                          ref={logoFileInputRef}
                          type="file"
                          accept="image/png,image/jpg,image/jpeg"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 2 * 1024 * 1024) {
                                toast.error('Logo must be less than 2MB');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setOverlayLogo(reader.result);
                                toast.success('Logo uploaded!');
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Logo will appear in top-left corner. Max 2MB.
                      </p>
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <HashtagIcon className="w-4 h-4 inline mr-1" />
                        Tags (max 5)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={currentTag}
                          onChange={(e) => setCurrentTag(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                          placeholder="Add tag..."
                          className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                          maxLength={20}
                        />
                        <button
                          onClick={handleAddTag}
                          className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                          disabled={!currentTag.trim() || streamTags.length >= 5}
                        >
                          <PlusIcon className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {streamTags.map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs"
                          >
                            #{tag}
                            <button onClick={() => handleRemoveTag(tag)}>
                              <XMarkIcon className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Privacy */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <LockClosedIcon className="w-4 h-4 inline mr-1" />
                        Privacy
                      </label>
                      <select
                        value={streamPrivacy}
                        onChange={(e) => setStreamPrivacy(e.target.value)}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-white border border-gray-200 rounded-md sm:rounded-lg focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm"
                      >
                        <option value="public">Public</option>
                        <option value="followers">Followers Only</option>
                        <option value="subscribers">Subscribers Only</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Stream Pricing */}
              <div className="p-3 sm:p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg sm:rounded-xl border border-purple-200">
                <h4 className="font-semibold text-sm sm:text-base text-purple-800 flex items-center gap-2 mb-2 sm:mb-3">
                  <CurrencyDollarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  Stream Pricing
                </h4>

                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Join Price (tokens)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={audienceControl.joinPrice || 0}
                      onChange={(e) => setAudienceControl(prev => ({
                        ...prev,
                        joinPrice: Math.max(0, parseInt(e.target.value) || 0)
                      }))}
                      placeholder="0"
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-white border border-gray-200 rounded-md sm:rounded-lg focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm"
                    />
                    {audienceControl.joinPrice > 0 && (
                      <span className="text-xs text-purple-600 mt-1">
                        ≈ ${(audienceControl.joinPrice * 0.05).toFixed(2)}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Private Price (tokens)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={audienceControl.privateStreamPrice || 0}
                      onChange={(e) => setAudienceControl(prev => ({
                        ...prev,
                        privateStreamPrice: Math.max(0, parseInt(e.target.value) || 0)
                      }))}
                      placeholder="0"
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-white border border-gray-200 rounded-md sm:rounded-lg focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm"
                    />
                    {audienceControl.privateStreamPrice > 0 && (
                      <span className="text-xs text-pink-600 mt-1">
                        ≈ ${(audienceControl.privateStreamPrice * 0.05).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stream Goals (Collapsible) */}
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg sm:rounded-xl overflow-hidden border border-yellow-200">
                <button
                  onClick={() => setShowGoals(!showGoals)}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between hover:bg-yellow-100/50 transition-colors"
                >
                  <span className="font-medium text-sm sm:text-base text-orange-800 flex items-center gap-2">
                    <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    Stream Goals
                  </span>
                  {showGoals ? (
                    <ChevronUpIcon className="w-5 h-5 text-orange-600" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5 text-orange-600" />
                  )}
                </button>
                
                {showGoals && (
                  <div className="p-4 border-t border-yellow-200 space-y-3">
                    {[1, 2, 3].map((level) => (
                      <div key={level} className="flex gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-bold ${
                          level === 1 ? 'bg-green-500' :
                          level === 2 ? 'bg-blue-500' :
                          'bg-purple-500'
                        }`}>
                          {level}
                        </span>
                        <input
                          type="number"
                          min="100"
                          value={streamGoal[`level${level}`].amount}
                          onChange={(e) => setStreamGoal(prev => ({
                            ...prev,
                            [`level${level}`]: {
                              ...prev[`level${level}`],
                              amount: Math.max(100, parseInt(e.target.value) || 0)
                            }
                          }))}
                          className="w-24 px-2 py-1 bg-white border border-gray-200 rounded text-sm"
                        />
                        <input
                          type="text"
                          value={streamGoal[`level${level}`].description}
                          onChange={(e) => setStreamGoal(prev => ({
                            ...prev,
                            [`level${level}`]: {
                              ...prev[`level${level}`],
                              description: e.target.value
                            }
                          }))}
                          placeholder="Goal description..."
                          className="flex-1 px-2 py-1 bg-white border border-gray-200 rounded text-sm"
                          maxLength={30}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Live Shopping (Collapsible) */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg sm:rounded-xl overflow-hidden border border-purple-200">
                <button
                  onClick={() => setEnableShopping(!enableShopping)}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between hover:bg-purple-100/50 transition-colors"
                >
                  <span className="font-medium text-sm sm:text-base text-purple-800 flex items-center gap-2">
                    <ShoppingBagIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    Live Shopping
                    {selectedProducts.length > 0 && (
                      <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
                        {selectedProducts.length} selected
                      </span>
                    )}
                  </span>
                  {enableShopping ? (
                    <ChevronUpIcon className="w-5 h-5 text-purple-600" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5 text-purple-600" />
                  )}
                </button>

                {enableShopping && (
                  <div className="p-4 border-t border-purple-200">
                    <p className="text-sm text-gray-600 mb-3">
                      Select products to showcase during your stream
                    </p>

                    {/* Simple Product Selection List */}
                    <SimpleProductSelector
                      selectedProducts={selectedProducts}
                      onProductsChange={setSelectedProducts}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-gradient-to-t from-gray-50 to-white p-4 sm:p-6 pb-6 sm:pb-8 border-t border-gray-200 rounded-b-2xl sm:rounded-b-3xl">
          <div className="flex justify-between items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCancel}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-white border border-gray-300 rounded-lg sm:rounded-xl text-gray-700 hover:bg-gray-50 transition-all font-medium shadow-sm text-sm sm:text-base"
            >
              Cancel
            </motion.button>
            
            <motion.button
              whileHover={{ scale: loading ? 1 : 1.05 }}
              whileTap={{ scale: loading ? 1 : 0.95 }}
              onClick={handleGoLive}
              disabled={loading || !streamTitle || !streamCategory}
              className={`px-5 sm:px-8 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-semibold shadow-lg transition-all text-sm sm:text-base ${
                loading || !streamTitle || !streamCategory
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
              }`}
            >
              <span className="flex items-center gap-2">
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    <span className="animate-pulse">🔴</span>
                    <span>Go Live!</span>
                  </>
                )}
              </span>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Global styles */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
      `}</style>
    </div>
  );
};

export default GoLiveSetup;