import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  VideoCameraIcon,
  PhoneIcon,
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  SparklesIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { customToast } from '../ui/EnhancedToaster';
import useHybridStore from '../../stores/useHybridStore';

const CallRequestMessage = ({
  message,
  isCreator,
  onAccept,
  onDecline,
  tokenBalance = 0
}) => {
  const [timeRemaining, setTimeRemaining] = useState(60); // 60 seconds to respond
  const [isExpired, setIsExpired] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const {
    id,
    type = 'video', // 'video' or 'voice'
    status = 'pending', // 'pending', 'accepted', 'declined', 'expired', 'cancelled'
    caller = {},
    ratePerMinute = 0,
    minimumDuration = 5, // minimum 5 minutes
    createdAt
  } = message;

  // Calculate minimum tokens required
  const minimumTokensRequired = ratePerMinute * minimumDuration;
  const hasEnoughTokens = tokenBalance >= minimumTokensRequired;

  // Timer countdown
  useEffect(() => {
    if (status !== 'pending' || isCreator) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setIsExpired(true);
          clearInterval(timer);
          // Auto-decline if expired
          if (onDecline) {
            onDecline(id, 'expired');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, isCreator, id, onDecline]);

  const handleAccept = async () => {
    if (!hasEnoughTokens) {
      customToast.error(
        `You need at least ${minimumTokensRequired} tokens for a ${minimumDuration} minute call`,
        { icon: '💰' }
      );
      return;
    }

    setIsProcessing(true);
    try {
      await onAccept(id, {
        type,
        ratePerMinute,
        minimumDuration,
        callerId: caller.id
      });
      
      customToast.success(
        `${type === 'video' ? 'Video' : 'Voice'} call starting...`,
        { icon: type === 'video' ? '🎥' : '📞' }
      );
    } catch (error) {
      console.error('Error accepting call:', error);
      customToast.error('Failed to accept call');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    setIsProcessing(true);
    try {
      await onDecline(id, 'declined');
      customToast.info('Call declined');
    } catch (error) {
      console.error('Error declining call:', error);
      customToast.error('Failed to decline call');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds) => {
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  // Different UI based on status
  if (status === 'accepted') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center my-4"
      >
        <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-4 py-2 rounded-full text-sm flex items-center gap-2">
          <CheckIcon className="w-4 h-4" />
          Call accepted - Connecting...
        </div>
      </motion.div>
    );
  }

  if (status === 'declined') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center my-4"
      >
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-2 rounded-full text-sm flex items-center gap-2">
          <XMarkIcon className="w-4 h-4" />
          Call declined
        </div>
      </motion.div>
    );
  }

  if (status === 'expired' || isExpired) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center my-4"
      >
        <div className="bg-gray-100 dark:bg-gray-800 text-gray-500 px-4 py-2 rounded-full text-sm flex items-center gap-2">
          <ClockIcon className="w-4 h-4" />
          Call request expired
        </div>
      </motion.div>
    );
  }

  if (status === 'cancelled') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center my-4"
      >
        <div className="bg-gray-100 dark:bg-gray-800 text-gray-500 px-4 py-2 rounded-full text-sm flex items-center gap-2">
          <XMarkIcon className="w-4 h-4" />
          Call cancelled by {caller.name}
        </div>
      </motion.div>
    );
  }

  // Pending call request UI
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="my-4"
    >
      <div className={`
        relative overflow-hidden rounded-xl border-2 
        ${type === 'video' 
          ? 'border-blue-300 dark:border-blue-700 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20' 
          : 'border-green-300 dark:border-green-700 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20'
        }
      `}>
        {/* Animated background pulse */}
        <motion.div
          className="absolute inset-0 opacity-30"
          animate={{
            background: [
              'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.3) 0%, transparent 50%)',
              'radial-gradient(circle at 80% 50%, rgba(59, 130, 246, 0.3) 0%, transparent 50%)',
              'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.3) 0%, transparent 50%)'
            ]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />

        <div className="relative p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center
                  ${type === 'video' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-green-500 text-white'
                  }
                `}
              >
                {type === 'video' ? (
                  <VideoCameraIcon className="w-6 h-6" />
                ) : (
                  <PhoneIcon className="w-6 h-6" />
                )}
              </motion.div>
              
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {isCreator ? 'Call Request Sent' : `${caller.name} is calling...`}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {type === 'video' ? 'Video Call' : 'Voice Call'}
                </p>
              </div>
            </div>

            {/* Timer for fan */}
            {!isCreator && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 px-2 py-1 bg-white/80 dark:bg-gray-800/80 rounded-full"
              >
                <ClockIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className={`text-sm font-mono ${timeRemaining < 10 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                  {formatTime(timeRemaining)}
                </span>
              </motion.div>
            )}
          </div>

          {/* Rate information */}
          <div className="mb-4 p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Rate per minute:</span>
              <div className="flex items-center gap-1">
                <SparklesIcon className="w-4 h-4 text-purple-500" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  {ratePerMinute} tokens
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Minimum duration:
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {minimumDuration} minutes
              </span>
            </div>
            
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Minimum required:
                </span>
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  {minimumTokensRequired} tokens
                </span>
              </div>
            </div>
          </div>

          {/* Token balance warning for fan */}
          {!isCreator && !hasEnoughTokens && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg"
            >
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <ExclamationTriangleIcon className="w-5 h-5" />
                <p className="text-sm">
                  You need {minimumTokensRequired - tokenBalance} more tokens to accept this call
                </p>
              </div>
            </motion.div>
          )}

          {/* Action buttons */}
          {!isCreator ? (
            // Fan's actions
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDecline}
                disabled={isProcessing}
                className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
                Decline
              </motion.button>
              
              <motion.button
                whileHover={{ scale: hasEnoughTokens ? 1.02 : 1 }}
                whileTap={{ scale: hasEnoughTokens ? 0.98 : 1 }}
                onClick={handleAccept}
                disabled={isProcessing || !hasEnoughTokens}
                className={`
                  flex-1 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all
                  ${hasEnoughTokens
                    ? 'bg-green-500 hover:bg-green-600 text-white animate-pulse'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                <CheckIcon className="w-5 h-5" />
                Accept
                {hasEnoughTokens && (
                  <span className="text-xs">
                    ({minimumTokensRequired} tokens)
                  </span>
                )}
              </motion.button>
            </div>
          ) : (
            // Creator's view - waiting for response
            <div className="text-center">
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-sm text-gray-600 dark:text-gray-400"
              >
                Waiting for response...
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default CallRequestMessage;