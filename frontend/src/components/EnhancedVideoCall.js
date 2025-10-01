import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AgoraRTC from 'agora-rtc-sdk-ng';
import PropTypes from 'prop-types';
import {
  VideoCameraIcon,
  MicrophoneIcon,
  PhoneXMarkIcon,
  ComputerDesktopIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  SpeakerWaveIcon,
  CameraIcon,
  RecordIcon,
  ShareIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import {
  VideoCameraIcon as VideoCameraIconSolid,
  MicrophoneIcon as MicrophoneIconSolid,
  ComputerDesktopIcon as ComputerDesktopIconSolid
} from '@heroicons/react/24/solid';

// Import our interactive components
import InstantMessagingChat from './InstantMessagingChat';
import InteractiveLivePolls from './InteractiveLivePolls';
import LiveStreamQA from './LiveStreamQA';
import LiveReactionsSystem from './LiveReactionsSystem';

const EnhancedVideoCall = ({
  appId,
  channel,
  token,
  uid,
  onLeave,
  isCreator = false,
  sessionType = 'video', // 'video', 'voice', 'stream'
  user,
  websocket
}) => {
  // Core Agora state
  const [client, setClient] = useState(null);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [localScreenTrack, setLocalScreenTrack] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [joined, setJoined] = useState(false);
  
  // UI state
  const [isVideoEnabled, setIsVideoEnabled] = useState(sessionType !== 'voice');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showPolls, setShowPolls] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState('excellent');
  const [viewerCount, setViewerCount] = useState(1);
  
  // Settings state
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMicrophone, setSelectedMicrophone] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [videoQuality, setVideoQuality] = useState('720p_60');
  const [enableBeautyFilter, setEnableBeautyFilter] = useState(false);
  
  // Device lists
  const [cameras, setCameras] = useState([]);
  const [microphones, setMicrophones] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  
  // Refs
  const localVideoRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    initializeAgora();
    loadDevices();
    
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (client && joined) {
      setupConnectionQualityMonitoring();
    }
  }, [client, joined]);

  const initializeAgora = async () => {
    try {
      // Create Agora client
      const agoraClient = AgoraRTC.createClient({
        mode: sessionType === 'stream' ? 'live' : 'rtc',
        codec: 'vp8'
      });

      // Set client role for live streaming
      if (sessionType === 'stream') {
        await agoraClient.setClientRole(isCreator ? 'host' : 'audience');
      }

      setClient(agoraClient);

      // Set up event handlers
      setupAgoraEventHandlers(agoraClient);

      // Join channel
      await agoraClient.join(appId, channel, token, uid);
      setJoined(true);

      // Create and publish local tracks
      if (isCreator || sessionType !== 'stream') {
        await createAndPublishTracks(agoraClient);
      }

      console.log('✅ Agora client initialized and joined channel');
    } catch (error) {
      console.error('❌ Error initializing Agora:', error);
    }
  };

  const setupAgoraEventHandlers = (agoraClient) => {
    // User joined
    agoraClient.on('user-joined', (user) => {
      console.log('👤 User joined:', user.uid);
      setRemoteUsers(prev => [...prev, user]);
      setViewerCount(prev => prev + 1);
    });

    // User left
    agoraClient.on('user-left', (user) => {
      console.log('👋 User left:', user.uid);
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
      setViewerCount(prev => Math.max(1, prev - 1));
    });

    // User published
    agoraClient.on('user-published', async (user, mediaType) => {
      console.log('📡 User published:', user.uid, mediaType);
      await agoraClient.subscribe(user, mediaType);
      
      setRemoteUsers(prev => prev.map(u => 
        u.uid === user.uid 
          ? { ...u, [mediaType]: user[mediaType] }
          : u
      ));
    });

    // User unpublished
    agoraClient.on('user-unpublished', (user, mediaType) => {
      console.log('📡 User unpublished:', user.uid, mediaType);
      setRemoteUsers(prev => prev.map(u => 
        u.uid === user.uid 
          ? { ...u, [mediaType]: undefined }
          : u
      ));
    });

    // Connection state change
    agoraClient.on('connection-state-change', (curState, revState) => {
      console.log('🔌 Connection state changed:', curState);
      updateConnectionQuality(curState);
    });

    // Network quality
    agoraClient.on('network-quality', (stats) => {
      updateNetworkQuality(stats);
    });
  };

  const createAndPublishTracks = async (agoraClient) => {
    try {
      // Create audio track
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: 'music_standard'
      });
      setLocalAudioTrack(audioTrack);

      // Create video track if needed
      let videoTrack = null;
      if (isVideoEnabled) {
        videoTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: getVideoEncoderConfig()
        });
        setLocalVideoTrack(videoTrack);
        
        // Play local video
        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }
      }

      // Publish tracks
      const tracksToPublish = [audioTrack];
      if (videoTrack) tracksToPublish.push(videoTrack);
      
      await agoraClient.publish(tracksToPublish);
      console.log('✅ Local tracks published');
    } catch (error) {
      console.error('❌ Error creating tracks:', error);
    }
  };

  const getVideoEncoderConfig = () => {
    switch (videoQuality) {
      case '720p_60':
        return { width: 1280, height: 720, frameRate: 60, bitrateMax: 4000 };
      case '1080p':
        return { width: 1920, height: 1080, frameRate: 30, bitrateMax: 2500 };
      case '720p':
        return { width: 1280, height: 720, frameRate: 30, bitrateMax: 1500 };
      case '480p':
        return { width: 640, height: 480, frameRate: 30, bitrateMax: 800 };
      default:
        return { width: 1280, height: 720, frameRate: 60, bitrateMax: 3500 };
    }
  };

  const toggleVideo = async () => {
    if (!localVideoTrack && !isVideoEnabled) {
      // Create and publish video track
      try {
        const videoTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: getVideoEncoderConfig()
        });
        setLocalVideoTrack(videoTrack);
        
        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }
        
        if (client) {
          await client.publish(videoTrack);
        }
        
        setIsVideoEnabled(true);
      } catch (error) {
        console.error('Error enabling video:', error);
      }
    } else if (localVideoTrack) {
      // Toggle existing video track
      await localVideoTrack.setEnabled(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleAudio = async () => {
    if (localAudioTrack) {
      await localAudioTrack.setEnabled(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        // Create screen track
        const screenTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: {
            width: 2560,
            height: 1440,
            frameRate: 60,
            bitrateMax: 6000
          }
        });

        setLocalScreenTrack(screenTrack);

        // Unpublish camera video if sharing screen
        if (localVideoTrack && client) {
          await client.unpublish(localVideoTrack);
        }

        // Publish screen track
        if (client) {
          await client.publish(screenTrack);
        }

        setIsScreenSharing(true);

        // Notify other participants via WebSocket
        if (websocket) {
          websocket.send(JSON.stringify({
            type: 'screen_share_start',
            channelId: channel,
            sessionId: channel
          }));
        }

        // Handle screen share ended (user stops sharing)
        screenTrack.on('track-ended', () => {
          stopScreenShare();
        });

        console.log('✅ Screen sharing started');
      } catch (error) {
        console.error('❌ Error starting screen share:', error);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = async () => {
    try {
      if (localScreenTrack && client) {
        await client.unpublish(localScreenTrack);
        localScreenTrack.close();
        setLocalScreenTrack(null);
      }

      // Re-publish camera video
      if (localVideoTrack && client && isVideoEnabled) {
        await client.publish(localVideoTrack);
      }

      setIsScreenSharing(false);

      // Notify other participants
      if (websocket) {
        websocket.send(JSON.stringify({
          type: 'screen_share_end',
          channelId: channel,
          sessionId: channel
        }));
      }

      console.log('✅ Screen sharing stopped');
    } catch (error) {
      console.error('❌ Error stopping screen share:', error);
    }
  };

  const toggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // In a real implementation, you'd start server-side recording
      console.log('🔴 Recording started');
    } else {
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }

      console.log('⏹️ Recording stopped');
    }
  };

  const switchCamera = async (deviceId) => {
    if (localVideoTrack && deviceId !== selectedCamera) {
      try {
        await localVideoTrack.setDevice(deviceId);
        setSelectedCamera(deviceId);
        console.log('📷 Camera switched to:', deviceId);
      } catch (error) {
        console.error('Error switching camera:', error);
      }
    }
  };

  const switchMicrophone = async (deviceId) => {
    if (localAudioTrack && deviceId !== selectedMicrophone) {
      try {
        await localAudioTrack.setDevice(deviceId);
        setSelectedMicrophone(deviceId);
        console.log('🎤 Microphone switched to:', deviceId);
      } catch (error) {
        console.error('Error switching microphone:', error);
      }
    }
  };

  const loadDevices = async () => {
    try {
      const devices = await AgoraRTC.getDevices();
      
      setCameras(devices.filter(device => device.kind === 'videoinput'));
      setMicrophones(devices.filter(device => device.kind === 'audioinput'));
      setSpeakers(devices.filter(device => device.kind === 'audiooutput'));
      
      // Set default devices
      const defaultCamera = devices.find(d => d.kind === 'videoinput');
      const defaultMic = devices.find(d => d.kind === 'audioinput');
      
      if (defaultCamera) setSelectedCamera(defaultCamera.deviceId);
      if (defaultMic) setSelectedMicrophone(defaultMic.deviceId);
      
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  const setupConnectionQualityMonitoring = () => {
    // Monitor connection quality
    setInterval(() => {
      if (client) {
        client.getStats().then(stats => {
          // Update connection quality based on stats
          updateConnectionQualityFromStats(stats);
        });
      }
    }, 5000);
  };

  const updateConnectionQuality = (state) => {
    switch (state) {
      case 'CONNECTED':
        setConnectionQuality('excellent');
        break;
      case 'RECONNECTING':
        setConnectionQuality('poor');
        break;
      case 'DISCONNECTED':
        setConnectionQuality('disconnected');
        break;
      default:
        setConnectionQuality('good');
    }
  };

  const updateNetworkQuality = (stats) => {
    const uplinkQuality = stats.uplinkNetworkQuality;
    const downlinkQuality = stats.downlinkNetworkQuality;
    
    const avgQuality = (uplinkQuality + downlinkQuality) / 2;
    
    if (avgQuality <= 2) {
      setConnectionQuality('excellent');
    } else if (avgQuality <= 4) {
      setConnectionQuality('good');
    } else {
      setConnectionQuality('poor');
    }
  };

  const updateConnectionQualityFromStats = (stats) => {
    // Implementation for detailed stats analysis
    // Update connection quality based on detailed network stats
  };

  const leaveChannel = async () => {
    try {
      // Stop recording if active
      if (isRecording) {
        toggleRecording();
      }

      // Stop screen sharing if active
      if (isScreenSharing) {
        await stopScreenShare();
      }

      // Clean up tracks
      if (localVideoTrack) {
        localVideoTrack.close();
      }
      if (localAudioTrack) {
        localAudioTrack.close();
      }
      if (localScreenTrack) {
        localScreenTrack.close();
      }

      // Leave channel
      if (client) {
        await client.leave();
      }

      onLeave?.();
    } catch (error) {
      console.error('Error leaving channel:', error);
    }
  };

  const cleanup = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getConnectionQualityColor = () => {
    switch (connectionQuality) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-yellow-500';
      case 'poor': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div ref={containerRef} className="h-screen bg-gray-900 flex flex-col relative overflow-hidden">
      {/* Header */}
      <motion.div 
        className="bg-black/50 backdrop-blur-sm text-white p-4 flex items-center justify-between z-10"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              connectionQuality === 'excellent' ? 'bg-green-500' :
              connectionQuality === 'good' ? 'bg-yellow-500' :
              connectionQuality === 'poor' ? 'bg-red-500' : 'bg-gray-500'
            } animate-pulse`} />
            <span className="text-sm font-medium capitalize">{connectionQuality}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <EyeIcon className="w-4 h-4" />
            <span className="text-sm">{viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}</span>
          </div>
          
          {isRecording && (
            <div className="flex items-center gap-2 bg-red-500 px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-sm font-medium">REC {formatDuration(recordingDuration)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-white/80">Channel: {channel}</span>
        </div>
      </motion.div>

      {/* Main Content Area */}
      <div className="flex-1 flex relative">
        {/* Video Area */}
        <div className="flex-1 relative">
          {/* Remote Users Grid */}
          <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
            {remoteUsers.map((user) => (
              <motion.div
                key={user.uid}
                className="bg-gray-800 rounded-xl overflow-hidden relative"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <div 
                  ref={(ref) => {
                    if (ref && user.videoTrack) {
                      user.videoTrack.play(ref);
                    }
                  }}
                  className="w-full h-full"
                />
                
                {/* User Info Overlay */}
                <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-sm">
                  User {user.uid}
                </div>
                
                {/* Audio Indicator */}
                {user.audioTrack && (
                  <div className="absolute top-2 right-2 bg-green-500 w-3 h-3 rounded-full animate-pulse" />
                )}
              </motion.div>
            ))}
          </div>

          {/* Local Video */}
          <motion.div 
            className="absolute bottom-4 right-4 w-48 h-36 bg-gray-800 rounded-xl overflow-hidden border-2 border-white/20"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            {isVideoEnabled ? (
              <div ref={localVideoRef} className="w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-700">
                <VideoCameraIcon className="w-8 h-8 text-gray-400" />
              </div>
            )}
            
            {/* Local Video Controls Overlay */}
            <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-sm">
              You {isScreenSharing && '(Screen)'}
            </div>
          </motion.div>
        </div>

        {/* Side Panel */}
        <AnimatePresence>
          {(showChat || showPolls || showQA) && (
            <motion.div
              className="w-80 bg-white border-l border-gray-200 flex flex-col"
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Panel Tabs */}
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => { setShowChat(true); setShowPolls(false); setShowQA(false); }}
                  className={`flex-1 p-3 text-sm font-medium ${
                    showChat ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  aria-label="Chat panel"
                  role="tab"
                  aria-selected={showChat}
                  onKeyDown={(e) => e.key === 'Enter' && (setShowChat(true), setShowPolls(false), setShowQA(false))}
                >
                  Chat
                </button>
                <button
                  onClick={() => { setShowChat(false); setShowPolls(true); setShowQA(false); }}
                  className={`flex-1 p-3 text-sm font-medium ${
                    showPolls ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  aria-label="Polls panel"
                  role="tab"
                  aria-selected={showPolls}
                  onKeyDown={(e) => e.key === 'Enter' && (setShowChat(false), setShowPolls(true), setShowQA(false))}
                >
                  Polls
                </button>
                <button
                  onClick={() => { setShowChat(false); setShowPolls(false); setShowQA(true); }}
                  className={`flex-1 p-3 text-sm font-medium ${
                    showQA ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  aria-label="Q&A panel"
                  role="tab"
                  aria-selected={showQA}
                  onKeyDown={(e) => e.key === 'Enter' && (setShowChat(false), setShowPolls(false), setShowQA(true))}
                >
                  Q&A
                </button>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-hidden">
                {showChat && (
                  <InstantMessagingChat
                    user={user}
                    isCreator={isCreator}
                    channelId={channel}
                    websocket={websocket}
                  />
                )}
                
                {showPolls && (
                  <InteractiveLivePolls
                    websocket={websocket}
                    channelId={channel}
                    isCreator={isCreator}
                    user={user}
                  />
                )}
                
                {showQA && (
                  <LiveStreamQA
                    websocket={websocket}
                    channelId={channel}
                    isCreator={isCreator}
                    user={user}
                    sessionId={channel}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Live Reactions Overlay */}
      <LiveReactionsSystem
        websocket={websocket}
        channelId={channel}
        user={user}
        containerRef={containerRef}
        showReactionBar={false}
        position="overlay"
      />

      {/* Bottom Controls */}
      <motion.div 
        className="bg-black/80 backdrop-blur-sm text-white p-4"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <div className="flex items-center justify-between">
          {/* Left Controls */}
          <div className="flex items-center gap-3">
            {/* Video Toggle */}
            <motion.button
              onClick={toggleVideo}
              className={`p-3 rounded-xl transition-all ${
                isVideoEnabled 
                  ? 'bg-gray-700 hover:bg-gray-600' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label={isVideoEnabled ? 'Turn off video' : 'Turn on video'}
              onKeyDown={(e) => e.key === 'Enter' && toggleVideo()}
            >
              {isVideoEnabled ? (
                <VideoCameraIconSolid className="w-6 h-6" />
              ) : (
                <VideoCameraIcon className="w-6 h-6" />
              )}
            </motion.button>

            {/* Audio Toggle */}
            <motion.button
              onClick={toggleAudio}
              className={`p-3 rounded-xl transition-all ${
                isAudioEnabled 
                  ? 'bg-gray-700 hover:bg-gray-600' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
              onKeyDown={(e) => e.key === 'Enter' && toggleAudio()}
            >
              {isAudioEnabled ? (
                <MicrophoneIconSolid className="w-6 h-6" />
              ) : (
                <MicrophoneIcon className="w-6 h-6" />
              )}
            </motion.button>

            {/* Screen Share */}
            <motion.button
              onClick={toggleScreenShare}
              className={`p-3 rounded-xl transition-all ${
                isScreenSharing 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
              onKeyDown={(e) => e.key === 'Enter' && toggleScreenShare()}
            >
              {isScreenSharing ? (
                <ComputerDesktopIconSolid className="w-6 h-6" />
              ) : (
                <ComputerDesktopIcon className="w-6 h-6" />
              )}
            </motion.button>

            {/* Recording (Creator only) */}
            {isCreator && (
              <motion.button
                onClick={toggleRecording}
                className={`p-3 rounded-xl transition-all ${
                  isRecording 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                onKeyDown={(e) => e.key === 'Enter' && toggleRecording()}
              >
                <div className="relative">
                  <RecordIcon className="w-6 h-6" />
                  {isRecording && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full animate-pulse" />
                  )}
                </div>
              </motion.button>
            )}
          </div>

          {/* Center - Reactions */}
          <div className="flex items-center">
            <LiveReactionsSystem
              websocket={websocket}
              channelId={channel}
              user={user}
              containerRef={containerRef}
              showReactionBar={true}
              position="bottom"
            />
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            {/* Chat Toggle */}
            <motion.button
              onClick={() => setShowChat(!showChat)}
              className={`p-3 rounded-xl transition-all ${
                showChat 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label={showChat ? 'Hide chat' : 'Show chat'}
              onKeyDown={(e) => e.key === 'Enter' && setShowChat(!showChat)}
            >
              <ChatBubbleLeftRightIcon className="w-6 h-6" />
            </motion.button>

            {/* Polls Toggle (Creator only) */}
            {isCreator && (
              <motion.button
                onClick={() => setShowPolls(!showPolls)}
                className={`p-3 rounded-xl transition-all ${
                  showPolls 
                    ? 'bg-purple-600 hover:bg-purple-700' 
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label={showPolls ? 'Hide polls' : 'Show polls'}
                onKeyDown={(e) => e.key === 'Enter' && setShowPolls(!showPolls)}
              >
                📊
              </motion.button>
            )}

            {/* Q&A Toggle */}
            <motion.button
              onClick={() => setShowQA(!showQA)}
              className={`p-3 rounded-xl transition-all ${
                showQA 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label={showQA ? 'Hide Q&A' : 'Show Q&A'}
              onKeyDown={(e) => e.key === 'Enter' && setShowQA(!showQA)}
            >
              ❓
            </motion.button>

            {/* Settings */}
            <motion.button
              onClick={() => setShowSettings(!showSettings)}
              className="p-3 rounded-xl bg-gray-700 hover:bg-gray-600 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Settings"
              onKeyDown={(e) => e.key === 'Enter' && setShowSettings(!showSettings)}
            >
              <Cog6ToothIcon className="w-6 h-6" />
            </motion.button>

            {/* Leave Call */}
            <motion.button
              onClick={leaveChannel}
              className="p-3 rounded-xl bg-red-600 hover:bg-red-700 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Leave call"
              onKeyDown={(e) => e.key === 'Enter' && leaveChannel()}
            >
              <PhoneXMarkIcon className="w-6 h-6" />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl p-6 w-full max-w-md max-h-96 overflow-y-auto"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Settings</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Close settings"
                  onKeyDown={(e) => e.key === 'Enter' && setShowSettings(false)}
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Camera Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Camera
                  </label>
                  <select
                    value={selectedCamera}
                    onChange={(e) => switchCamera(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {cameras.map((camera) => (
                      <option key={camera.deviceId} value={camera.deviceId}>
                        {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Microphone Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Microphone
                  </label>
                  <select
                    value={selectedMicrophone}
                    onChange={(e) => switchMicrophone(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {microphones.map((mic) => (
                      <option key={mic.deviceId} value={mic.deviceId}>
                        {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Video Quality */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Video Quality
                  </label>
                  <select
                    value={videoQuality}
                    onChange={(e) => setVideoQuality(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="480p">480p</option>
                    <option value="720p">720p HD</option>
                    <option value="1080p">1080p Full HD</option>
                    <option value="2k">2K Ultra HD (Recommended)</option>
                  </select>
                </div>

                {/* Beauty Filter */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Beauty Filter
                  </label>
                  <button
                    onClick={() => setEnableBeautyFilter(!enableBeautyFilter)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      enableBeautyFilter ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                    role="switch"
                    aria-checked={enableBeautyFilter}
                    aria-label="Beauty filter"
                    onKeyDown={(e) => e.key === 'Enter' && setEnableBeautyFilter(!enableBeautyFilter)}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        enableBeautyFilter ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

EnhancedVideoCall.propTypes = {
  appId: PropTypes.string.isRequired,
  channel: PropTypes.string.isRequired,
  token: PropTypes.string.isRequired,
  uid: PropTypes.number.isRequired,
  onLeave: PropTypes.func.isRequired,
  isCreator: PropTypes.bool,
  sessionType: PropTypes.oneOf(['video', 'voice', 'stream']),
  user: PropTypes.object.isRequired,
  websocket: PropTypes.object.isRequired
};

EnhancedVideoCall.defaultProps = {
  isCreator: false,
  sessionType: 'video'
};

export default memo(EnhancedVideoCall);