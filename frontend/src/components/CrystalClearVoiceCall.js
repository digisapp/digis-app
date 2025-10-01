import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhoneIcon,
  PhoneXMarkIcon,
  MicrophoneIcon,
  SpeakerWaveIcon,
  SignalIcon,
  CloudArrowUpIcon,
  AdjustmentsHorizontalIcon,
  MusicalNoteIcon,
  SparklesIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import Card from './ui/Card';
import Button from './ui/Button';
import VoiceCallEnhancements from './VoiceCallEnhancements';
import agoraLoader from '../utils/AgoraLoader';
import toast from 'react-hot-toast';

const CrystalClearVoiceCall = ({
  channel,
  token,
  uid,
  isHost = false,
  onCallEnd,
  onTokenExpired,
  user
}) => {
  const [agoraRTC, setAgoraRTC] = useState(null);
  const [client, setClient] = useState(null);
  const [audioTrack, setAudioTrack] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [networkQuality, setNetworkQuality] = useState({ uplink: 0, downlink: 0 });
  const [audioStats, setAudioStats] = useState({
    bitrate: 0,
    packetLoss: 0,
    latency: 0,
    sampleRate: 48000,
    channels: 2
  });
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [showEnhancements, setShowEnhancements] = useState(false);
  const [activeFeatures, setActiveFeatures] = useState({
    aiNoiseSuppression: true,
    echoCancellation: true,
    voiceEnhancement: true,
    spatialAudio: false,
    cloudRecording: false
  });

  const callStartTime = useRef(null);
  const durationInterval = useRef(null);
  const statsInterval = useRef(null);

  useEffect(() => {
    initializeAgora();
    return () => {
      cleanup();
    };
  }, []);

  const initializeAgora = async () => {
    try {
      const rtc = await agoraLoader.ensureLoaded();
      setAgoraRTC(rtc);

      // Create client with optimized voice settings
      const agoraClient = rtc.createClient({ 
        mode: 'rtc', 
        codec: 'vp8',
        role: isHost ? 'host' : 'audience'
      });

      // Set up event handlers
      agoraClient.on('user-joined', handleUserJoined);
      agoraClient.on('user-left', handleUserLeft);
      agoraClient.on('user-published', handleUserPublished);
      agoraClient.on('user-unpublished', handleUserUnpublished);
      agoraClient.on('network-quality', handleNetworkQuality);
      agoraClient.on('token-privilege-will-expire', handleTokenExpiring);
      agoraClient.on('connection-state-change', handleConnectionStateChange);

      setClient(agoraClient);
      
      // Auto-join
      await joinCall(agoraClient, rtc);
    } catch (error) {
      console.error('Failed to initialize Agora:', error);
      toast.error('Failed to initialize voice call');
    }
  };

  const joinCall = async (agoraClient, rtc) => {
    try {
      // Join channel
      await agoraClient.join(process.env.REACT_APP_AGORA_APP_ID, channel, token, uid);
      
      // Create audio track with 48kHz sampling
      const track = await rtc.createMicrophoneAudioTrack({
        encoderConfig: {
          sampleRate: 48000,
          stereo: true,
          bitrate: 128
        },
        AEC: activeFeatures.echoCancellation,
        ANS: activeFeatures.aiNoiseSuppression,
        AGC: true
      });

      // Apply initial enhancements
      if (activeFeatures.voiceEnhancement) {
        await track.setVoiceBeautifierPreset('singing_beautifier');
      }

      setAudioTrack(track);
      
      // Publish audio track
      await agoraClient.publish([track]);
      
      setIsJoined(true);
      callStartTime.current = Date.now();
      
      // Start duration timer
      durationInterval.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
      }, 1000);

      // Start stats collection
      startStatsCollection(agoraClient, track);
      
      // toast.success('Voice call connected with crystal-clear 48kHz audio!');
    } catch (error) {
      console.error('Failed to join call:', error);
      toast.error('Failed to join voice call');
    }
  };

  const startStatsCollection = (agoraClient, track) => {
    statsInterval.current = setInterval(async () => {
      try {
        const stats = agoraClient.getRTCStats();
        const audioStats = await track.getStats();
        
        setAudioStats({
          bitrate: Math.round(stats.SendBitrate / 1000),
          packetLoss: stats.SendPacketLossRate || 0,
          latency: stats.RTT || 0,
          sampleRate: audioStats.sampleRate || 48000,
          channels: audioStats.channelCount || 2
        });
      } catch (error) {
        console.error('Failed to get stats:', error);
      }
    }, 1000);
  };

  const handleUserJoined = (user) => {
    console.log('User joined:', user.uid);
    setRemoteUsers(prev => [...prev, user]);
  };

  const handleUserLeft = (user) => {
    console.log('User left:', user.uid);
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
  };

  const handleUserPublished = async (user, mediaType) => {
    if (mediaType === 'audio') {
      await client.subscribe(user, mediaType);
      user.audioTrack.play();
      
      // Apply spatial audio if enabled
      if (activeFeatures.spatialAudio) {
        const position = calculateSpatialPosition(user.uid);
        user.audioTrack.setSpatialPosition(position.x, position.y, position.z);
      }
    }
  };

  const handleUserUnpublished = (user, mediaType) => {
    if (mediaType === 'audio') {
      user.audioTrack?.stop();
    }
  };

  const handleNetworkQuality = (stats) => {
    setNetworkQuality({
      uplink: stats.uplinkNetworkQuality,
      downlink: stats.downlinkNetworkQuality
    });
  };

  const handleTokenExpiring = () => {
    console.log('Token expiring soon');
    if (onTokenExpired) {
      onTokenExpired();
    }
  };

  const handleConnectionStateChange = (curState, revState, reason) => {
    console.log('Connection state:', curState, reason);
    if (curState === 'DISCONNECTED') {
      toast.error('Call disconnected');
      endCall();
    }
  };

  const calculateSpatialPosition = (uid) => {
    // Calculate spatial position based on user order
    const index = remoteUsers.findIndex(u => u.uid === uid);
    const angle = (index * 60) - 90; // Spread users in front
    const distance = 2;
    
    return {
      x: distance * Math.cos(angle * Math.PI / 180),
      y: 0,
      z: distance * Math.sin(angle * Math.PI / 180)
    };
  };

  const toggleMute = async () => {
    if (audioTrack) {
      await audioTrack.setEnabled(isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleFeature = async (feature) => {
    const newState = !activeFeatures[feature];
    setActiveFeatures(prev => ({ ...prev, [feature]: newState }));

    if (audioTrack) {
      switch (feature) {
        case 'aiNoiseSuppression':
          await audioTrack.setAINSMode(newState);
          break;
        case 'echoCancellation':
          await audioTrack.setAECMode(newState);
          break;
        case 'voiceEnhancement':
          if (newState) {
            await audioTrack.setVoiceBeautifierPreset('singing_beautifier');
          } else {
            await audioTrack.setVoiceBeautifierPreset('off');
          }
          break;
        case 'spatialAudio':
          // Re-apply spatial positions for all users
          if (newState) {
            remoteUsers.forEach(user => {
              if (user.audioTrack) {
                const position = calculateSpatialPosition(user.uid);
                user.audioTrack.setSpatialPosition(position.x, position.y, position.z);
              }
            });
          }
          break;
      }
    }
  };

  const endCall = async () => {
    cleanup();
    if (onCallEnd) {
      onCallEnd();
    }
  };

  const cleanup = async () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
    }
    if (statsInterval.current) {
      clearInterval(statsInterval.current);
    }
    if (audioTrack) {
      audioTrack.stop();
      audioTrack.close();
    }
    if (client) {
      await client.leave();
      client.removeAllListeners();
    }
    setIsJoined(false);
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getNetworkQualityLabel = (quality) => {
    const labels = ['Unknown', 'Excellent', 'Good', 'Poor', 'Bad', 'Very Bad', 'No Connection'];
    return labels[quality] || 'Unknown';
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card className="overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <PhoneIcon className="w-6 h-6" />
                Crystal Clear Voice Call
              </h2>
              <p className="text-purple-100 mt-1">48kHz HD Audio Quality</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-purple-100">Duration</p>
                <p className="text-xl font-mono">{formatDuration(callDuration)}</p>
              </div>
              
              <Button
                onClick={endCall}
                variant="secondary"
                className="bg-red-600 hover:bg-red-700 text-white"
                icon={<PhoneXMarkIcon className="w-5 h-5" />}
              >
                End Call
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="bg-gray-50 dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Sample Rate</p>
              <p className="text-sm font-semibold text-purple-600">{audioStats.sampleRate}Hz</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Bitrate</p>
              <p className="text-sm font-semibold text-purple-600">{audioStats.bitrate}kbps</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Latency</p>
              <p className="text-sm font-semibold text-purple-600">{audioStats.latency}ms</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Packet Loss</p>
              <p className="text-sm font-semibold text-purple-600">{audioStats.packetLoss}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Network</p>
              <p className="text-sm font-semibold text-purple-600">
                {getNetworkQualityLabel(networkQuality.uplink)}
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="p-6">
          {/* Active Features */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Active Features
            </h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(activeFeatures).map(([key, enabled]) => (
                <button
                  key={key}
                  onClick={() => toggleFeature(key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    enabled
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </button>
              ))}
            </div>
          </div>

          {/* Main Controls */}
          <div className="flex items-center justify-center gap-4">
            <Button
              onClick={toggleMute}
              variant={isMuted ? 'secondary' : 'primary'}
              size="lg"
              className="rounded-full w-16 h-16"
            >
              <MicrophoneIcon className={`w-6 h-6 ${isMuted ? 'text-red-600' : ''}`} />
            </Button>

            <Button
              onClick={() => setShowEnhancements(!showEnhancements)}
              variant="secondary"
              size="lg"
              className="rounded-full w-16 h-16"
            >
              <AdjustmentsHorizontalIcon className="w-6 h-6" />
            </Button>
          </div>

          {/* Remote Users */}
          {remoteUsers.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Participants ({remoteUsers.length})
              </h3>
              <div className="flex flex-wrap gap-3">
                {remoteUsers.map(user => (
                  <div
                    key={user.uid}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg"
                  >
                    <SpeakerWaveIcon className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium">User {user.uid}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Voice Enhancements Panel */}
      <AnimatePresence>
        {showEnhancements && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mt-6"
          >
            <VoiceCallEnhancements
              audioTrack={audioTrack}
              agoraClient={client}
              isHost={isHost}
              onSettingsChange={(settings) => {
                console.log('Voice settings changed:', settings);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CrystalClearVoiceCall;