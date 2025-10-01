import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PhoneIcon, 
  VideoCameraIcon,
  XMarkIcon,
  UserIcon,
  SparklesIcon,
  ClockIcon
} from '@heroicons/react/24/solid';
import { 
  PhoneArrowDownLeftIcon,
  PhoneXMarkIcon 
} from '@heroicons/react/24/outline';
import Button from './ui/Button';
import { useNavigate } from 'react-router-dom';
import { customToast } from './ui/EnhancedToaster';

const IncomingCallModal = ({ 
  isOpen, 
  onClose, 
  callData = {},
  onAccept,
  onDecline 
}) => {
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isRinging, setIsRinging] = useState(true);

  // Default call data - handle null callData
  const {
    id = '1',
    type = 'video', // 'video' or 'voice'
    caller = {
      name: 'Alice Johnson',
      username: 'alice123',
      avatar: null,
      tier: 'VIP',
      totalSpent: 2450
    },
    duration = 30,
    tokens = 240,
    scheduledTime = null
  } = callData || {};

  // Don't render if not open
  if (!isOpen) return null;

  // Play ringtone when modal opens
  useEffect(() => {
    if (isOpen && isRinging) {
      // Create audio element for ringtone
      const audio = new Audio('/sounds/pleasant-ringtone.mp3');
      audio.loop = true;
      audio.volume = 0.6;
      audioRef.current = audio;
      
      // Play ringtone
      audio.play().catch(err => {
        console.error('Failed to play ringtone:', err);
        // Fallback to web audio API if needed
        playWebAudioRingtone();
      });
    }

    return () => {
      // Stop ringtone when modal closes
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [isOpen, isRinging]);

  // Fallback ringtone using Web Audio API
  const playWebAudioRingtone = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    const playTone = (frequency, startTime, duration) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    // Pleasant chord progression
    const pattern = [
      { freq: 523.25, delay: 0 },     // C5
      { freq: 659.25, delay: 0.15 },  // E5
      { freq: 783.99, delay: 0.3 },   // G5
      { freq: 659.25, delay: 0.45 },  // E5
    ];

    const playPattern = () => {
      const now = audioContext.currentTime;
      pattern.forEach(({ freq, delay }) => {
        playTone(freq, now + delay, 0.4);
      });
    };

    // Play pattern repeatedly
    playPattern();
    const interval = setInterval(playPattern, 2000);
    
    // Store interval ID for cleanup
    audioRef.current = { interval, audioContext };
  };

  // Timer for call duration
  useEffect(() => {
    if (isOpen) {
      const timer = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setTimeElapsed(0);
    }
  }, [isOpen]);

  const handleAccept = async () => {
    setIsRinging(false);
    
    // Stop ringtone
    if (audioRef.current) {
      if (audioRef.current.pause) {
        audioRef.current.pause();
      } else if (audioRef.current.interval) {
        clearInterval(audioRef.current.interval);
        audioRef.current.audioContext.close();
      }
    }

    // Navigate to call
    if (type === 'video') {
      navigate(`/video-call/${id}?fan=${caller.username}`);
    } else {
      navigate(`/voice-call/${id}?fan=${caller.username}`);
    }

    customToast.success(`${type === 'video' ? 'Video' : 'Voice'} call connected!`, {
      icon: type === 'video' ? '🎥' : '📞'
    });

    if (onAccept) onAccept(callData);
    onClose();
  };

  const handleDecline = () => {
    setIsRinging(false);
    
    // Stop ringtone
    if (audioRef.current) {
      if (audioRef.current.pause) {
        audioRef.current.pause();
      } else if (audioRef.current.interval) {
        clearInterval(audioRef.current.interval);
        audioRef.current.audioContext.close();
      }
    }

    customToast.info('Call declined');
    if (onDecline) onDecline(callData);
    onClose();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'VIP':
        return 'from-purple-400 to-pink-400';
      case 'Gold':
        return 'from-yellow-400 to-amber-400';
      case 'Silver':
        return 'from-gray-300 to-gray-400';
      default:
        return 'from-blue-400 to-indigo-400';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && handleDecline()}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ 
              scale: 1, 
              opacity: 1,
              transition: { type: "spring", duration: 0.5 }
            }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl"
          >
            {/* Header with gradient background */}
            <div className={`relative h-48 bg-gradient-to-br ${getTierColor(caller.tier)} flex items-center justify-center`}>
              {/* Pulsing ring animation */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.2, 0.5]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute w-32 h-32 bg-white/20 rounded-full"
                />
                <motion.div
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.4, 0.1, 0.4]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.2
                  }}
                  className="absolute w-40 h-40 bg-white/20 rounded-full"
                />
                <motion.div
                  animate={{
                    scale: [1, 1.4, 1],
                    opacity: [0.3, 0.05, 0.3]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.4
                  }}
                  className="absolute w-48 h-48 bg-white/20 rounded-full"
                />
              </div>

              {/* Avatar */}
              <div className="relative z-10">
                {caller.avatar ? (
                  <img 
                    src={caller.avatar} 
                    alt={caller.name}
                    className="w-24 h-24 rounded-full border-4 border-white shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-lg">
                    <span className="text-3xl font-bold text-gray-700">
                      {caller.name.charAt(0)}
                    </span>
                  </div>
                )}
              </div>

              {/* Call type indicator */}
              <div className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-sm rounded-full">
                {type === 'video' ? (
                  <VideoCameraIcon className="w-6 h-6 text-white" />
                ) : (
                  <PhoneIcon className="w-6 h-6 text-white" />
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 text-center">
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <h2 className="text-2xl font-bold text-gray-900">
                  Incoming {type === 'video' ? 'Video' : 'Voice'} Call
                </h2>
              </motion.div>

              <div className="mt-2">
                <p className="text-xl font-semibold text-gray-800">{caller.name}</p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${getTierColor(caller.tier)}`}>
                    {caller.tier}
                  </span>
                  {caller.totalSpent > 2000 && (
                    <span className="flex items-center gap-1 text-xs text-gray-600">
                      <SparklesIcon className="w-4 h-4 text-yellow-500" />
                      Top Supporter
                    </span>
                  )}
                </div>
              </div>

              {/* Call details */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-4 h-4" />
                    {duration} min
                  </span>
                  <span className="font-bold text-purple-600">
                    {tokens} tokens
                  </span>
                </div>
                
                {timeElapsed > 0 && (
                  <p className="text-xs text-gray-500">
                    Ringing for {formatTime(timeElapsed)}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="mt-8 flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDecline}
                  className="flex-1 py-4 px-6 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <PhoneXMarkIcon className="w-6 h-6" />
                  Decline
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAccept}
                  className="flex-1 py-4 px-6 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 transition-colors animate-pulse"
                >
                  <PhoneArrowDownLeftIcon className="w-6 h-6" />
                  Accept
                </motion.button>
              </div>

              {/* Additional info */}
              {scheduledTime && (
                <p className="mt-4 text-xs text-gray-500">
                  Scheduled for {new Date(scheduledTime).toLocaleTimeString()}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IncomingCallModal;