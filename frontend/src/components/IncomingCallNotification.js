import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PhoneIcon, 
  PhoneArrowDownLeftIcon,
  VideoCameraIcon,
  ClockIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { 
  PhoneIcon as PhoneIconSolid, 
  VideoCameraIcon as VideoCameraIconSolid 
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const IncomingCallNotification = ({ 
  callRequest,
  isOpen,
  onAccept,
  onDecline,
  onClose,
  user 
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const [isRinging, setIsRinging] = useState(true);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  
  const audioRef = useRef(null);
  const callStartTime = useRef(null);
  const durationInterval = useRef(null);
  const ringTimeout = useRef(null);

  // Create fallback ring sound using Web Audio API
  const createFallbackRingSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);

      // Create ring pattern: ring for 1s, pause for 0.5s
      let isRingingPattern = true;
      const ringPattern = setInterval(() => {
        if (isRingingPattern) {
          oscillator.start(audioContext.currentTime);
          setTimeout(() => {
            try {
              oscillator.stop();
            } catch (e) {
              // Oscillator already stopped
            }
          }, 1000);
        }
        isRingingPattern = !isRingingPattern;
      }, 1500);

      // Store reference for cleanup
      audioRef.current = {
        pause: () => {
          clearInterval(ringPattern);
          audioContext.close();
        }
      };

    } catch (error) {
      console.error('Failed to create fallback ring sound:', error);
    }
  }, []);

  // Initialize audio for ringtone
  useEffect(() => {
    if (isOpen && callRequest) {
      // Create audio element for ringtone
      audioRef.current = new Audio();
      
      // Try different ring sound options
      const ringTones = [
        '/sounds/phone-ring.mp3',
        '/sounds/incoming-call.mp3',
        'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIaDDuO1fDNeSs='
      ];

      // Set loop and play ringtone
      audioRef.current.loop = true;
      audioRef.current.volume = 0.6;
      
      // Try to play ringtone (fallback if files don't exist)
      const playRingtone = async () => {
        try {
          // Try actual ring files first
          for (const ringTone of ringTones) {
            try {
              audioRef.current.src = ringTone;
              await audioRef.current.play();
              break;
            } catch (e) {
              console.warn('Failed to play ring tone:', ringTone);
              continue;
            }
          }
        } catch (error) {
          // Fallback to Web Audio API for generating ring sound
          console.warn('Using fallback ring sound');
          createFallbackRingSound();
        }
      };

      playRingtone();

      // Auto-decline after 30 seconds
      ringTimeout.current = setTimeout(() => {
        if (isRinging) {
          setIsRinging(false);
          if (audioRef.current) {
            audioRef.current.pause();
          }
          if (onDecline) {
            onDecline(callRequest);
          }
          if (onClose) {
            onClose();
          }
          toast.error('Call missed - no response after 30 seconds');
        }
      }, 30000);

      // Start call timer
      callStartTime.current = Date.now();
      durationInterval.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
      }, 1000);
    }

    return () => {
      // Cleanup on unmount
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (ringTimeout.current) {
        clearTimeout(ringTimeout.current);
      }
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [isOpen, callRequest, isRinging, onDecline, onClose, createFallbackRingSound]);

  const handleAccept = useCallback(async () => {
    setIsRinging(false);
    
    // Stop ringtone
    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (ringTimeout.current) {
      clearTimeout(ringTimeout.current);
    }

    // Call parent accept handler
    if (onAccept) {
      await onAccept(callRequest);
    }

    // toast.success(`Accepted ${callRequest?.sessionType} call from @${callRequest?.fanUsername}!`);
    onClose?.();
  }, [callRequest, onAccept, onClose]);

  const handleDecline = useCallback(async () => {
    setIsRinging(false);
    
    // Stop ringtone
    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (ringTimeout.current) {
      clearTimeout(ringTimeout.current);
    }

    // Call parent decline handler
    if (onDecline) {
      await onDecline(callRequest);
    }

    toast.error(`Declined ${callRequest?.sessionType} call from @${callRequest?.fanUsername}`);
    onClose?.();
  }, [callRequest, onDecline, onClose]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen || !callRequest) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative overflow-hidden"
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ 
            opacity: 1, 
            scale: 1, 
            y: 0,
            // Pulsing animation while ringing
            boxShadow: isRinging 
              ? ['0 0 20px rgba(59, 130, 246, 0.3)', '0 0 40px rgba(59, 130, 246, 0.6)', '0 0 20px rgba(59, 130, 246, 0.3)']
              : '0 25px 50px rgba(0, 0, 0, 0.25)'
          }}
          exit={{ opacity: 0, scale: 0.8, y: 50 }}
          transition={{ 
            duration: 0.3,
            boxShadow: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
          }}
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-purple-50 opacity-50"></div>
          
          {/* Incoming Call Header */}
          <div className="relative z-10 text-center mb-6">
            <motion.div
              animate={{ scale: isRinging ? [1, 1.1, 1] : 1 }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {callRequest.sessionType === 'video' ? (
                <VideoCameraIconSolid className="w-16 h-16 text-blue-600 mx-auto mb-3" />
              ) : (
                <PhoneIconSolid className="w-16 h-16 text-green-600 mx-auto mb-3" />
              )}
            </motion.div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Incoming {callRequest.sessionType === 'video' ? 'Video' : 'Voice'} Call
            </h2>
            
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <ClockIcon className="w-4 h-4" />
              <span>Ringing for {formatDuration(callDuration)}</span>
            </div>
          </div>

          {/* Caller Information */}
          <div className="relative z-10 text-center mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 shadow-lg">
              {callRequest.fanProfilePicUrl ? (
                <img
                  src={callRequest.fanProfilePicUrl}
                  alt={callRequest.fanUsername}
                  className="w-full h-full rounded-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={callRequest.fanProfilePicUrl ? 'hidden' : 'flex'}>
                {callRequest.fanUsername?.charAt(0)?.toUpperCase() || 'F'}
              </div>
            </div>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-1">
              @{callRequest.fanUsername}
            </h3>
            
            {callRequest.fanBio && (
              <p className="text-sm text-gray-600 mb-3">
                {callRequest.fanBio}
              </p>
            )}
            
            <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <CurrencyDollarIcon className="w-4 h-4" />
                <span>
                  ${callRequest.sessionType === 'video' 
                    ? (user?.videoPrice || 8) 
                    : (user?.voicePrice || 6)}/min
                </span>
              </div>
              
              {callRequest.estimatedDuration && (
                <div className="flex items-center gap-1">
                  <ClockIcon className="w-4 h-4" />
                  <span>~{callRequest.estimatedDuration} min</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="relative z-10 flex justify-center gap-6">
            {/* Decline Button */}
            <motion.button
              onClick={() => setShowDeclineConfirm(true)}
              className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-red-600 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <PhoneArrowDownLeftIcon className="w-7 h-7" />
            </motion.button>

            {/* Accept Button */}
            <motion.button
              onClick={handleAccept}
              className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-green-600 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              animate={{ 
                scale: isRinging ? [1, 1.1, 1] : 1,
                boxShadow: isRinging 
                  ? ['0 0 0 0 rgba(34, 197, 94, 0.4)', '0 0 0 10px rgba(34, 197, 94, 0)', '0 0 0 0 rgba(34, 197, 94, 0.4)']
                  : 'none'
              }}
              transition={{ 
                scale: { duration: 1, repeat: Infinity },
                boxShadow: { duration: 1.5, repeat: Infinity }
              }}
            >
              {callRequest.sessionType === 'video' ? (
                <VideoCameraIcon className="w-8 h-8" />
              ) : (
                <PhoneIcon className="w-8 h-8" />
              )}
            </motion.button>
          </div>

          {/* Quick Actions */}
          <div className="relative z-10 flex justify-center gap-4 mt-6">
            <button className="text-gray-500 hover:text-gray-700 text-sm">
              Message Instead
            </button>
            <button className="text-gray-500 hover:text-gray-700 text-sm">
              Schedule Later
            </button>
          </div>
        </motion.div>

        {/* Decline Confirmation */}
        <AnimatePresence>
          {showDeclineConfirm && (
            <motion.div
              className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white rounded-2xl p-6 w-80 text-center"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
              >
                <h3 className="text-lg font-semibold mb-3">Decline Call?</h3>
                <p className="text-gray-600 mb-6 text-sm">
                  This will end the incoming call from @{callRequest.fanUsername}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeclineConfirm(false)}
                    className="flex-1 py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDecline}
                    className="flex-1 py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default IncomingCallNotification;