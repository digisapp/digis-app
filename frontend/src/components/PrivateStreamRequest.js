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
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { HeartIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const PrivateStreamRequest = ({
  user,
  streamConfig,
  onAcceptRequest,
  onRejectRequest,
  className = ''
}) => {
  const [requests, setRequests] = useState([]);
  const [showNotification, setShowNotification] = useState(false);
  const [processingRequest, setProcessingRequest] = useState(null);

  // Mock private stream requests for demo
  useEffect(() => {
    if (!streamConfig?.audienceControl?.privateStreamPrice) return;

    // Simulate incoming private stream requests
    const mockRequest = () => {
      const mockFans = [
        { name: 'SuperFan123', avatar: '👤', tokens: 5000 },
        { name: 'LoyalViewer456', avatar: '😎', tokens: 8000 },
        { name: 'BigSpender789', avatar: '🤩', tokens: 10000 },
        { name: 'StreamLover321', avatar: '💖', tokens: 3000 }
      ];

      const randomFan = mockFans[Math.floor(Math.random() * mockFans.length)];
      
      const newRequest = {
        id: Date.now(),
        ...randomFan,
        timestamp: new Date(),
        price: streamConfig.audienceControl.privateStreamPrice,
        message: 'Would love a private session with you! 💕'
      };

      setRequests(prev => [...prev, newRequest]);
      setShowNotification(true);

      // Auto-hide notification after 10 seconds
      setTimeout(() => {
        setRequests(prev => prev.filter(r => r.id !== newRequest.id));
      }, 10000);
    };

    // Generate a request every 30-60 seconds
    const interval = setInterval(() => {
      if (Math.random() > 0.5) { // 50% chance
        mockRequest();
      }
    }, 30000 + Math.random() * 30000);

    // Initial request after 10 seconds
    const initialTimeout = setTimeout(mockRequest, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [streamConfig]);

  const handleAccept = async (request) => {
    setProcessingRequest(request.id);
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast.custom((t) => (
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4"
      >
        <CheckCircleIcon className="w-8 h-8" />
        <div>
          <p className="font-bold">Private Stream Started!</p>
          <p className="text-sm opacity-90">Transferring {request.name} to private room...</p>
        </div>
      </motion.div>
    ), { duration: 5000 });

    // Remove the request
    setRequests(prev => prev.filter(r => r.id !== request.id));
    setProcessingRequest(null);
    
    // Call parent handler
    onAcceptRequest?.(request);
  };

  const handleReject = (request) => {
    setRequests(prev => prev.filter(r => r.id !== request.id));
    // toast.success(`Declined private stream request from ${request.name}`);
    onRejectRequest?.(request);
  };

  if (!streamConfig?.audienceControl?.privateStreamPrice || requests.length === 0) {
    return null;
  }

  return (
    <div className={`absolute top-24 right-4 z-40 ${className}`}>
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
            className="mb-3 max-w-sm"
          >
            <motion.div 
              className="bg-gradient-to-br from-purple-900/95 to-pink-900/95 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-purple-400/30"
              whileHover={{ scale: 1.02 }}
              animate={{
                boxShadow: [
                  "0 0 20px rgba(168, 85, 247, 0.4)",
                  "0 0 40px rgba(236, 72, 153, 0.4)",
                  "0 0 20px rgba(168, 85, 247, 0.4)"
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <motion.div 
                    className="relative"
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-2xl shadow-lg">
                      {request.avatar}
                    </div>
                    <motion.div
                      className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  </motion.div>
                  <div>
                    <h4 className="text-white font-bold text-base">{request.name}</h4>
                    <div className="flex items-center gap-2 text-xs text-purple-200">
                      <CurrencyDollarIcon className="w-3 h-3" />
                      <span>{request.tokens.toLocaleString()} tokens</span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-purple-300 flex items-center gap-1">
                  <ClockIcon className="w-3 h-3" />
                  <span>Now</span>
                </div>
              </div>

              {/* Request Info */}
              <div className="bg-black/30 rounded-xl p-3 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <LockClosedIcon className="w-4 h-4 text-purple-300" />
                  <span className="text-sm font-semibold text-white">Private Stream Request</span>
                </div>
                <p className="text-xs text-purple-200 mb-3">{request.message}</p>
                
                {/* Price Display */}
                <motion.div 
                  className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/30 rounded-lg p-2"
                  animate={{ 
                    borderColor: ["rgba(74, 222, 128, 0.3)", "rgba(74, 222, 128, 0.6)", "rgba(74, 222, 128, 0.3)"]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-green-300">Offering:</span>
                    <div className="flex items-center gap-2">
                      <motion.span 
                        className="text-xl font-bold text-green-400"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        {request.price} tokens
                      </motion.span>
                      <span className="text-xs text-green-300">
                        (${(request.price * 0.05).toFixed(2)})
                      </span>
                    </div>
                  </div>
                </motion.div>
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
                      <span>Accept</span>
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

              {/* Info Text */}
              <p className="text-xs text-purple-300 text-center mt-3 italic">
                Fan can see & chat with you, but you won't see them
              </p>
            </motion.div>

            {/* Sparkle Effects */}
            <div className="absolute -top-2 -right-2">
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

export default PrivateStreamRequest;