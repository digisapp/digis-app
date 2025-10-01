import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  VideoCameraIcon,
  ClockIcon,
  CurrencyDollarIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  BoltIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { HeartIcon } from '@heroicons/react/24/solid';
import Button from './ui/Button';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';
import { useAppStore } from '../stores/useAppStore';
import { useSocket } from '../hooks/useSocket';

const PrivateCallSession = ({
  session,
  isCreator,
  onSessionEnd,
  className = ''
}) => {
  const [duration, setDuration] = useState(0);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [remainingTokens, setRemainingTokens] = useState(session?.tokenHoldAmount || 0);
  const [isEnding, setIsEnding] = useState(false);
  const [lowTokenWarning, setLowTokenWarning] = useState(false);
  const [criticalTokenWarning, setCriticalTokenWarning] = useState(false);
  
  const durationRef = useRef(0);
  const tokenDeductionInterval = useRef(null);
  const { on, sendEvent, connected } = useSocket();
  
  const { 
    tokenBalance, 
    updatePrivateCallTokens, 
    subtractTokens,
    endPrivateCall 
  } = useAppStore();

  // Update duration every second
  useEffect(() => {
    const interval = setInterval(() => {
      durationRef.current += 1;
      setDuration(durationRef.current);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Token deduction logic - every minute
  useEffect(() => {
    if (!session || isCreator) return;

    // Deduct tokens every minute
    tokenDeductionInterval.current = setInterval(async () => {
      const tokensToDeduct = session.pricePerMinute;
      
      // Check if user has enough tokens
      if (remainingTokens < tokensToDeduct) {
        // Not enough tokens - end the call
        handleEndSession('tokens_depleted');
        return;
      }

      // Deduct tokens
      setTokensUsed(prev => prev + tokensToDeduct);
      setRemainingTokens(prev => prev - tokensToDeduct);
      updatePrivateCallTokens(tokensToDeduct);

      // Update backend
      try {
        const authToken = await getAuthToken();
        await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/streaming/private-call-update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            sessionId: session.id,
            tokensUsed: tokensToDeduct,
            duration: Math.floor(durationRef.current / 60)
          }),
        });
      } catch (error) {
        console.error('Error updating token usage:', error);
      }

      // Check for low token warnings
      const minutesRemaining = Math.floor(remainingTokens / session.pricePerMinute);
      if (minutesRemaining <= 1 && !criticalTokenWarning) {
        setCriticalTokenWarning(true);
        toast.custom((t) => (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="w-8 h-8" />
              <div>
                <p className="font-bold">Critical: Low Token Balance!</p>
                <p className="text-sm opacity-90">Call will end in less than 1 minute</p>
              </div>
            </div>
          </motion.div>
        ), { duration: 5000 });
      } else if (minutesRemaining <= 3 && !lowTokenWarning) {
        setLowTokenWarning(true);
        toast.custom((t) => (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-yellow-500 text-white px-6 py-4 rounded-xl shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="w-8 h-8" />
              <div>
                <p className="font-bold">Low Token Balance</p>
                <p className="text-sm opacity-90">Only {minutesRemaining} minutes remaining</p>
              </div>
            </div>
          </motion.div>
        ), { duration: 4000 });
      }
    }, 60000); // Every 60 seconds

    return () => {
      if (tokenDeductionInterval.current) {
        clearInterval(tokenDeductionInterval.current);
      }
    };
  }, [session, remainingTokens, isCreator, lowTokenWarning, criticalTokenWarning]);

  const handleEndSession = async (reason = 'user_ended') => {
    setIsEnding(true);

    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/streaming/private-call-end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          sessionId: session.id,
          endReason: reason,
          finalDuration: Math.floor(durationRef.current / 60),
          finalTokensUsed: tokensUsed
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Show session summary
        toast.custom((t) => (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-xl shadow-2xl max-w-md"
          >
            <div className="flex items-center gap-3 mb-3">
              <CheckCircleIcon className="w-8 h-8" />
              <div>
                <p className="font-bold">Private Call Ended</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="opacity-80">Duration:</span>
                <span className="font-semibold">{formatDuration(durationRef.current)}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-80">Tokens Used:</span>
                <span className="font-semibold">{tokensUsed}</span>
              </div>
              {!isCreator && data.tokensRefunded > 0 && (
                <div className="flex justify-between text-green-300">
                  <span>Tokens Refunded:</span>
                  <span className="font-semibold">+{data.tokensRefunded}</span>
                </div>
              )}
              {isCreator && (
                <div className="flex justify-between text-green-300">
                  <span>Tokens Earned:</span>
                  <span className="font-semibold">+{tokensUsed}</span>
                </div>
              )}
            </div>
          </motion.div>
        ), { duration: 8000 });

        // Update store
        endPrivateCall();
        
        // Call parent handler
        onSessionEnd?.(data);
      } else {
        throw new Error('Failed to end session');
      }
    } catch (error) {
      console.error('Error ending private call:', error);
      toast.error('Failed to end private call properly');
    } finally {
      setIsEnding(false);
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTokenTime = (tokens, pricePerMinute) => {
    const minutes = Math.floor(tokens / pricePerMinute);
    return `${minutes} min`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 ${className}`}
    >
      <div className="bg-gradient-to-br from-purple-900/95 via-pink-900/95 to-purple-900/95 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-purple-400/30 min-w-[350px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg"
            >
              <VideoCameraIcon className="w-5 h-5 text-white" />
            </motion.div>
            <div>
              <h3 className="text-white font-bold">Private Call Active</h3>
              <p className="text-xs text-purple-300">
                {isCreator ? `with ${session.fanName}` : `with ${session.creatorName}`}
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleEndSession('user_ended')}
            disabled={isEnding}
            className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
          >
            <XMarkIcon className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Session Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {/* Duration */}
          <div className="bg-black/30 rounded-lg p-2">
            <div className="flex items-center gap-1 text-xs text-purple-300 mb-1">
              <ClockIcon className="w-3 h-3" />
              <span>Duration</span>
            </div>
            <p className="text-white font-mono font-semibold text-sm">
              {formatDuration(duration)}
            </p>
          </div>

          {/* Tokens Used/Earned */}
          <div className="bg-black/30 rounded-lg p-2">
            <div className="flex items-center gap-1 text-xs text-purple-300 mb-1">
              <CurrencyDollarIcon className="w-3 h-3" />
              <span>{isCreator ? 'Earned' : 'Used'}</span>
            </div>
            <p className="text-white font-mono font-semibold text-sm">
              {tokensUsed}
            </p>
          </div>

          {/* Remaining */}
          {!isCreator && (
            <div className={`rounded-lg p-2 ${
              criticalTokenWarning ? 'bg-red-500/30' : 
              lowTokenWarning ? 'bg-yellow-500/30' : 
              'bg-black/30'
            }`}>
              <div className="flex items-center gap-1 text-xs text-purple-300 mb-1">
                <BoltIcon className="w-3 h-3" />
                <span>Remaining</span>
              </div>
              <p className={`font-mono font-semibold text-sm ${
                criticalTokenWarning ? 'text-red-400' : 
                lowTokenWarning ? 'text-yellow-400' : 
                'text-white'
              }`}>
                {formatTokenTime(remainingTokens, session.pricePerMinute)}
              </p>
            </div>
          )}
        </div>

        {/* Rate Info */}
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2 mb-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-purple-300">Rate:</span>
            <span className="text-white font-medium">
              {session.pricePerMinute} tokens/min
              <span className="text-purple-400 ml-1">
                (${(session.pricePerMinute * 0.05).toFixed(2)}/min)
              </span>
            </span>
          </div>
        </div>

        {/* Warning Messages */}
        <AnimatePresence>
          {criticalTokenWarning && !isCreator && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-500/20 border border-red-500/30 rounded-lg p-2 mb-2"
            >
              <div className="flex items-center gap-2 text-xs text-red-400">
                <ExclamationTriangleIcon className="w-4 h-4" />
                <span>Call will end soon - low balance!</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* End Call Button */}
        <Button
          onClick={() => handleEndSession('user_ended')}
          disabled={isEnding}
          variant="danger"
          fullWidth
          className="bg-red-600 hover:bg-red-700"
        >
          {isEnding ? (
            <>
              <ArrowPathIcon className="w-4 h-4 animate-spin mr-2" />
              Ending Call...
            </>
          ) : (
            <>
              <XMarkIcon className="w-4 h-4 mr-2" />
              End Private Call
            </>
          )}
        </Button>

        {/* Pulse Animation */}
        <motion.div
          className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl opacity-30 blur"
          animate={{
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{
            duration: 2,
            repeat: Infinity
          }}
        />
      </div>
    </motion.div>
  );
};

export default PrivateCallSession;