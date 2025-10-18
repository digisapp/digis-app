import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  VideoCameraIcon,
  UserIcon,
  CurrencyDollarIcon,
  CheckIcon,
  XMarkIcon,
  LockClosedIcon,
  SparklesIcon,
  ClockIcon,
  CheckCircleIcon,
  BellAlertIcon,
  FireIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import { HeartIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';
import { useSocket } from '../hooks/useSocket';

const CreatorPrivateCallNotification = ({
  streamId,
  creatorId,
  onAcceptRequest,
  onRejectRequest,
  className = ''
}) => {
  const [requests, setRequests] = useState([]);
  const [processingRequest, setProcessingRequest] = useState(null);
  const [audioPlayed, setAudioPlayed] = useState(false);
  const { on, connected } = useSocket();

  // Listen for incoming private call requests via WebSocket
  useEffect(() => {
    if (!connected) return;

    const handlePrivateCallRequest = (request) => {
      // Add request to list with expiry time
      setRequests(prev => [...prev, {
        ...request,
        expiresAt: Date.now() + 120000, // 2 minutes from now
        timestamp: Date.now()
      }]);

      // Play notification sound
      if (!audioPlayed) {
        playNotificationSound();
        setAudioPlayed(true);
        setTimeout(() => setAudioPlayed(false), 3000);
      }

      // Show toast notification
      toast.custom((t) => (
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-xl shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <BellAlertIcon className="w-8 h-8" />
            <div>
              <p className="font-bold">Private Call Request!</p>
              <p className="text-sm opacity-90">{request.fanName} wants a private session</p>
              <p className="text-xs opacity-80 mt-1">{request.pricePerMinute} tokens/min</p>
            </div>
          </div>
        </motion.div>
      ), { duration: 5000 });
    };

    const unsubscribe = on('private-call-request', handlePrivateCallRequest);

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [on, connected, audioPlayed]);

  // Remove expired requests
  useEffect(() => {
    const interval = setInterval(() => {
      setRequests(prev => prev.filter(req => req.expiresAt > Date.now()));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const playNotificationSound = () => {
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Could not play sound:', e));
    } catch (error) {
      console.log('Audio playback not supported');
    }
  };

  const handleAccept = async (request) => {
    setProcessingRequest(request.id);
    
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/streaming/private-call-accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          requestId: request.id,
          streamId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Show success message
        toast.custom((t) => (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-4 rounded-xl shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="w-8 h-8" />
              <div>
                <p className="font-bold">Private Call Started!</p>
                <p className="text-sm opacity-90">Now in private session with {request.fanName}</p>
                <p className="text-xs opacity-80 mt-1">Stream ended, private mode active</p>
              </div>
            </div>
          </motion.div>
        ), { duration: 5000 });

        // Remove the request
        setRequests(prev => prev.filter(r => r.id !== request.id));
        
        // Call parent handler with session data
        onAcceptRequest?.({
          ...request,
          sessionId: data.sessionId,
          channelName: data.channelName,
          token: data.token
        });
      } else {
        throw new Error('Failed to accept request');
      }
    } catch (error) {
      console.error('Error accepting private call:', error);
      toast.error('Failed to accept private call request');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleReject = async (request) => {
    try {
      const authToken = await getAuthToken();
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/streaming/private-call-reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          requestId: request.id,
        }),
      });

      // Remove the request
      setRequests(prev => prev.filter(r => r.id !== request.id));
      toast.success(`Declined private call from ${request.fanName}`);
      
      onRejectRequest?.(request);
    } catch (error) {
      console.error('Error rejecting private call:', error);
      toast.error('Failed to reject request');
    }
  };

  const formatTimeRemaining = (expiresAt) => {
    const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (requests.length === 0) return null;

  return (
    <div className={`fixed top-24 right-4 z-50 max-w-sm ${className}`}>
      <AnimatePresence>
        {requests.map((request, index) => (
          <motion.div
            key={request.id}
            initial={{ x: 100, opacity: 0, scale: 0.8 }}
            animate={{ 
              x: 0, 
              opacity: 1, 
              scale: 1,
              y: index * 10
            }}
            exit={{ x: 100, opacity: 0, scale: 0.8 }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 25,
              delay: index * 0.1
            }}
            className="mb-3"
          >
            <motion.div 
              className="bg-gradient-to-br from-purple-900/95 via-pink-900/95 to-purple-900/95 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-purple-400/30"
              whileHover={{ scale: 1.02 }}
              animate={{
                boxShadow: [
                  "0 0 30px rgba(168, 85, 247, 0.5)",
                  "0 0 50px rgba(236, 72, 153, 0.5)",
                  "0 0 30px rgba(168, 85, 247, 0.5)"
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {/* Urgent Badge */}
              <motion.div
                className="absolute -top-2 -right-2"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                  <FireIcon className="w-3 h-3" />
                  URGENT
                </div>
              </motion.div>

              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <motion.div 
                    className="relative"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-2xl shadow-lg">
                      {request.fanAvatar || '👤'}
                    </div>
                    <motion.div
                      className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  </motion.div>
                  <div>
                    <h4 className="text-white font-bold text-base">{request.fanName}</h4>
                    <div className="flex items-center gap-2 text-xs text-purple-200">
                      <CurrencyDollarIcon className="w-3 h-3" />
                      <span>{request.fanTokenBalance?.toLocaleString()} tokens available</span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-orange-400 font-mono bg-orange-500/20 px-2 py-1 rounded">
                  {formatTimeRemaining(request.expiresAt)}
                </div>
              </div>

              {/* Request Details */}
              <div className="bg-black/40 rounded-xl p-3 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <LockClosedIcon className="w-4 h-4 text-purple-300" />
                  <span className="text-sm font-semibold text-white">Private Call Request</span>
                </div>
                
                {/* Price and Duration */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="bg-purple-500/20 rounded-lg p-2">
                    <p className="text-xs text-purple-300">Rate</p>
                    <p className="text-sm font-bold text-white">
                      {request.pricePerMinute} tokens/min
                    </p>
                  </div>
                  <div className="bg-purple-500/20 rounded-lg p-2">
                    <p className="text-xs text-purple-300">Est. Duration</p>
                    <p className="text-sm font-bold text-white">
                      {request.estimatedDuration} min
                    </p>
                  </div>
                </div>

                {/* Potential Earnings */}
                <motion.div 
                  className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/30 rounded-lg p-2"
                  animate={{ 
                    borderColor: ["rgba(74, 222, 128, 0.3)", "rgba(74, 222, 128, 0.6)", "rgba(74, 222, 128, 0.3)"]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-green-300">Potential Earnings:</span>
                    <div className="flex items-center gap-2">
                      <motion.span 
                        className="text-xl font-bold text-green-400"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        {request.pricePerMinute * request.estimatedDuration} tokens
                      </motion.span>
                      <span className="text-xs text-green-300">
                        (${(request.pricePerMinute * request.estimatedDuration * 0.05).toFixed(2)})
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* Privacy Notice */}
                <div className="flex items-center gap-2 mt-2 text-xs text-purple-300">
                  <EyeSlashIcon className="w-4 h-4" />
                  <span>Fan can see you, but you won't see them</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleAccept(request)}
                  disabled={processingRequest === request.id}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
                    processingRequest === request.id
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-lg'
                  }`}
                >
                  {processingRequest === request.id ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Starting...</span>
                    </>
                  ) : (
                    <>
                      <CheckIcon className="w-4 h-4" />
                      <span>Accept (${(request.pricePerMinute * request.estimatedDuration * 0.05).toFixed(0)})</span>
                    </>
                  )}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleReject(request)}
                  disabled={processingRequest === request.id}
                  className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-semibold text-sm transition-all duration-300 border border-red-500/30"
                >
                  <XMarkIcon className="w-4 h-4" />
                </motion.button>
              </div>

              {/* Important Notice */}
              <div className="mt-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2">
                <p className="text-xs text-yellow-300 text-center flex items-center justify-center gap-1">
                  <BellAlertIcon className="w-3 h-3" />
                  Stream will end when you accept
                </p>
              </div>
            </motion.div>

            {/* Sparkle Effects */}
            <div className="absolute -top-2 -left-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <SparklesIcon className="w-6 h-6 text-yellow-400 drop-shadow-glow" />
              </motion.div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* CSS for glow effect */}
      <style>{`
        .drop-shadow-glow {
          filter: drop-shadow(0 0 10px currentColor);
        }
      `}</style>
    </div>
  );
};

export default CreatorPrivateCallNotification;