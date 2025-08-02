import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  VideoCameraIcon,
  MicrophoneIcon,
  CameraIcon,
  PhoneXMarkIcon,
  ChatBubbleLeftRightIcon,
  GiftIcon,
  SparklesIcon,
  HeartIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  VideoCameraSlashIcon
} from '@heroicons/react/24/outline';
import {
  MicrophoneIcon as MicrophoneIconSolid
} from '@heroicons/react/24/solid';
import AgoraRTC from 'agora-rtc-sdk-ng';

const MobileVideoStream = ({ creator, user, token, channel, onEnd }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [showEffects, setShowEffects] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [connectionQuality, setConnectionQuality] = useState('excellent');
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const clientRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const videoContainerRef = useRef(null);

  // Initialize Agora client
  useEffect(() => {
    const initializeAgora = async () => {
      try {
        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        clientRef.current = client;

        // Add event listeners
        client.on('user-published', async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === 'video') {
            const remoteVideoTrack = user.videoTrack;
            remoteVideoTrack.play(remoteVideoRef.current);
            setRemoteStream(remoteVideoTrack);
          }
          if (mediaType === 'audio') {
            const remoteAudioTrack = user.audioTrack;
            remoteAudioTrack.play();
          }
        });

        client.on('user-unpublished', (user, mediaType) => {
          if (mediaType === 'video') {
            setRemoteStream(null);
          }
        });

        client.on('network-quality', (stats) => {
          const quality = stats.uplinkNetworkQuality;
          if (quality >= 4) setConnectionQuality('excellent');
          else if (quality >= 3) setConnectionQuality('good');
          else if (quality >= 2) setConnectionQuality('fair');
          else setConnectionQuality('poor');
        });

        // Join channel
        await client.join(import.meta.env.VITE_AGORA_APP_ID, channel, token, user.id);

        // Create and publish local tracks
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        
        videoTrack.play(localVideoRef.current);
        setLocalStream(videoTrack);
        
        await client.publish([audioTrack, videoTrack]);
      } catch (error) {
        console.error('Error initializing Agora:', error);
      }
    };

    initializeAgora();

    // Update call duration
    const durationInterval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => {
      clearInterval(durationInterval);
      if (clientRef.current) {
        clientRef.current.leave();
        clientRef.current.removeAllListeners();
      }
    };
  }, [channel, token, user.id]);

  // Toggle video
  const toggleVideo = async () => {
    if (localStream) {
      await localStream.setEnabled(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  // Toggle audio
  const toggleAudio = async () => {
    const client = clientRef.current;
    const audioTrack = client?.localTracks.find(track => track.getTrackLabel().includes('audio'));
    if (audioTrack) {
      await audioTrack.setEnabled(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Send reaction
  const sendReaction = (type) => {
    const newReaction = {
      id: Date.now(),
      type,
      x: Math.random() * 80 + 10,
      y: Math.random() * 80 + 10
    };
    setReactions([...reactions, newReaction]);
    
    // Remove reaction after animation
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, 3000);
  };

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Connection quality indicator
  const getQualityColor = () => {
    switch (connectionQuality) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-yellow-500';
      case 'fair': return 'bg-orange-500';
      case 'poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div ref={videoContainerRef} className="mobile-video-container">
      {/* Remote Video (Full Screen) */}
      <div ref={remoteVideoRef} className="mobile-video-remote" />
      
      {/* Local Video (Picture-in-Picture) */}
      <motion.div 
        ref={localVideoRef} 
        className="mobile-video-local"
        drag
        dragConstraints={videoContainerRef}
        dragElastic={0.1}
        whileDrag={{ scale: 0.9 }}
      />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 mobile-safe-top">
        <div className="mobile-glass-card px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={creator.profile_pic_url || '/api/placeholder/40/40'} 
              alt={creator.username}
              className="w-10 h-10 rounded-full border-2 border-white"
            />
            <div>
              <h3 className="font-semibold text-white">{creator.username}</h3>
              <div className="flex items-center gap-2 text-xs text-white/80">
                <span className={`w-2 h-2 rounded-full ${getQualityColor()}`} />
                <span>{formatDuration(callDuration)}</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full bg-white/20 backdrop-blur-sm"
          >
            {isFullscreen ? (
              <ArrowsPointingInIcon className="w-5 h-5 text-white" />
            ) : (
              <ArrowsPointingOutIcon className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Reactions */}
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            className="absolute text-4xl"
            initial={{ 
              opacity: 0, 
              scale: 0,
              x: `${reaction.x}%`,
              y: `${reaction.y}%`
            }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              y: `${reaction.y - 30}%`
            }}
            exit={{ 
              opacity: 0,
              scale: 2,
              y: `${reaction.y - 60}%`
            }}
            transition={{ duration: 2, ease: "easeOut" }}
          >
            {reaction.type}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 mobile-safe-bottom">
        {/* Quick Reactions */}
        <div className="flex justify-center gap-2 mb-4">
          {['❤️', '👏', '🔥', '😍', '🎉'].map((emoji) => (
            <motion.button
              key={emoji}
              whileTap={{ scale: 0.8 }}
              onClick={() => sendReaction(emoji)}
              className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-2xl"
            >
              {emoji}
            </motion.button>
          ))}
        </div>

        {/* Main Controls */}
        <div className="mobile-video-controls">
          {/* Camera Toggle */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleVideo}
            className={`mobile-video-control-btn ${!isVideoEnabled ? 'bg-red-500/50' : ''}`}
          >
            {isVideoEnabled ? (
              <VideoCameraIcon className="w-6 h-6 text-white" />
            ) : (
              <VideoCameraSlashIcon className="w-6 h-6 text-white" />
            )}
          </motion.button>

          {/* Microphone Toggle */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleAudio}
            className={`mobile-video-control-btn ${!isAudioEnabled ? 'bg-red-500/50' : ''}`}
          >
            {isAudioEnabled ? (
              <MicrophoneIcon className="w-6 h-6 text-white" />
            ) : (
              <div className="relative">
                <MicrophoneIcon className="w-6 h-6 text-white" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-0.5 bg-white rotate-45 transform origin-center"></div>
                </div>
              </div>
            )}
          </motion.button>

          {/* End Call */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onEnd}
            className="mobile-video-control-btn end-call"
          >
            <PhoneXMarkIcon className="w-6 h-6 text-white" />
          </motion.button>

          {/* Chat */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowChat(!showChat)}
            className="mobile-video-control-btn"
          >
            <ChatBubbleLeftRightIcon className="w-6 h-6 text-white" />
          </motion.button>

          {/* Effects */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowEffects(!showEffects)}
            className="mobile-video-control-btn"
          >
            <SparklesIcon className="w-6 h-6 text-white" />
          </motion.button>
        </div>

        {/* Token Counter */}
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-sm rounded-full">
            <img src="/digis-coin.png" alt="Token" className="w-5 h-5" />
            <span className="text-white font-medium">
              {Math.floor(callDuration / 60) * creator.price_per_min} tokens spent
            </span>
          </div>
        </div>
      </div>

      {/* Chat Overlay */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="absolute top-0 right-0 bottom-0 w-80 bg-black/80 backdrop-blur-md p-4"
          >
            {/* Chat implementation */}
            <div className="text-white">Chat coming soon...</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Effects Panel */}
      <AnimatePresence>
        {showEffects && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="absolute bottom-20 left-0 right-0 bg-black/80 backdrop-blur-md p-4"
          >
            <div className="grid grid-cols-4 gap-4">
              {['Blur', 'Beauty', 'Vintage', 'B&W'].map((effect) => (
                <button
                  key={effect}
                  className="p-4 bg-white/20 rounded-lg text-white text-sm"
                >
                  {effect}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileVideoStream;