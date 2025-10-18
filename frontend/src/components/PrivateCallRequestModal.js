import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  VideoCameraIcon,
  LockClosedIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon,
  InformationCircleIcon,
  SparklesIcon,
  BoltIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { HeartIcon } from '@heroicons/react/24/solid';
import Button from './ui/Button';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const PrivateCallRequestModal = ({
  isOpen,
  onClose,
  creator,
  streamId,
  fanId,
  fanTokenBalance,
  pricePerMinute,
  minimumMinutes = 5,
  className = ''
}) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [estimatedDuration, setEstimatedDuration] = useState(10);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [requestStatus, setRequestStatus] = useState(null); // 'pending', 'accepted', 'rejected'
  const [countdown, setCountdown] = useState(120); // 2 minutes countdown

  const totalCost = pricePerMinute * estimatedDuration;
  const hasEnoughTokens = fanTokenBalance >= totalCost;
  const maxAffordableMinutes = Math.floor(fanTokenBalance / pricePerMinute);

  // Countdown timer for request expiry
  useEffect(() => {
    if (requestStatus === 'pending' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setRequestStatus('expired');
      toast.error('Request expired. Please try again.');
      setTimeout(() => onClose(), 2000);
    }
  }, [countdown, requestStatus, onClose]);

  const handleRequestPrivateCall = async () => {
    if (!hasEnoughTokens) {
      toast.error('Insufficient tokens. Please purchase more tokens.');
      return;
    }

    if (!acceptedTerms) {
      toast.error('Please accept the terms to continue.');
      return;
    }

    setIsRequesting(true);

    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/streaming/private-call-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          streamId,
          creatorId: creator.id,
          pricePerMinute,
          minimumMinutes,
          estimatedDuration,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setRequestStatus('pending');
        
        toast.custom((t) => (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-xl shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <BoltIcon className="w-8 h-8" />
              </motion.div>
              <div>
                <p className="font-bold">Request Sent!</p>
                <p className="text-sm opacity-90">Waiting for {creator.displayName} to respond...</p>
                <p className="text-xs opacity-80 mt-1">Tokens held: {totalCost}</p>
              </div>
            </div>
          </motion.div>
        ), { duration: 5000 });

        // Listen for response via WebSocket
        listenForResponse(data.requestId);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send request');
      }
    } catch (error) {
      console.error('Error requesting private call:', error);
      toast.error(error.message || 'Failed to send private call request');
    } finally {
      setIsRequesting(false);
    }
  };

  const listenForResponse = (requestId) => {
    // In production, this would use WebSocket to listen for real-time response
    // For now, simulate with timeout
    setTimeout(() => {
      // Simulate acceptance for demo
      if (Math.random() > 0.3) {
        setRequestStatus('accepted');
        toast.custom((t) => (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-4 rounded-xl shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="w-8 h-8" />
              <div>
                <p className="font-bold">Request Accepted!</p>
                <p className="text-sm opacity-90">Redirecting to private call...</p>
              </div>
            </div>
          </motion.div>
        ), { duration: 3000 });
        
        setTimeout(() => {
          // Redirect to private call
          window.location.href = `/private-call/${requestId}`;
        }, 2000);
      } else {
        setRequestStatus('rejected');
        toast.error('Your request was declined. Tokens have been refunded.');
        setTimeout(() => onClose(), 3000);
      }
    }, 5000 + Math.random() * 5000); // Simulate 5-10 second response time
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={requestStatus === 'pending' ? undefined : onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className={`bg-gradient-to-br from-gray-900 via-purple-900/50 to-gray-900 rounded-2xl max-w-md w-full shadow-2xl border border-purple-500/20 ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-6 pb-4 border-b border-purple-500/20">
            <button
              onClick={onClose}
              disabled={requestStatus === 'pending'}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl"
              >
                <LockClosedIcon className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h2 className="text-xl font-bold text-white">Request Private Call</h2>
                <p className="text-sm text-purple-300">with {creator?.displayName}</p>
              </div>
            </div>

            {/* Request Status */}
            {requestStatus === 'pending' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full"
                    />
                    <span className="text-yellow-300 font-medium">Waiting for response...</span>
                  </div>
                  <span className="text-yellow-400 font-mono">{formatTime(countdown)}</span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Creator Info */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                {creator?.avatar || <VideoCameraIcon className="w-8 h-8 text-white" />}
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">{creator?.displayName}</h3>
                <div className="flex items-center gap-2 text-sm text-purple-300">
                  <span className="flex items-center gap-1">
                    <CurrencyDollarIcon className="w-4 h-4" />
                    {pricePerMinute} tokens/min
                  </span>
                  <span className="text-purple-500">•</span>
                  <span>Min: {minimumMinutes} minutes</span>
                </div>
              </div>
            </div>

            {/* Duration Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-purple-300 mb-2">
                Estimated Duration
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={minimumMinutes}
                  max={Math.min(60, maxAffordableMinutes)}
                  value={estimatedDuration}
                  onChange={(e) => setEstimatedDuration(parseInt(e.target.value))}
                  className="flex-1 accent-purple-500"
                  disabled={requestStatus === 'pending'}
                />
                <span className="text-white font-medium min-w-[60px]">
                  {estimatedDuration} min
                </span>
              </div>
              <div className="flex justify-between text-xs text-purple-400 mt-1">
                <span>{minimumMinutes} min</span>
                <span>{Math.min(60, maxAffordableMinutes)} min</span>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-black/30 rounded-xl p-4 mb-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-purple-300">Price per minute:</span>
                  <span className="text-white">{pricePerMinute} tokens</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-purple-300">Duration:</span>
                  <span className="text-white">{estimatedDuration} minutes</span>
                </div>
                <div className="border-t border-purple-500/20 pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="text-purple-300 font-medium">Total Cost:</span>
                    <div className="text-right">
                      <div className="text-xl font-bold text-white">{totalCost} tokens</div>
                      <div className="text-xs text-purple-400">${(totalCost * 0.05).toFixed(2)} USD</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Token Balance */}
              <div className="mt-4 pt-4 border-t border-purple-500/20">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-purple-300">Your Balance:</span>
                  <span className={`font-medium ${hasEnoughTokens ? 'text-green-400' : 'text-red-400'}`}>
                    {fanTokenBalance} tokens
                  </span>
                </div>
                {!hasEnoughTokens && (
                  <p className="text-xs text-red-400 mt-2">
                    You need {totalCost - fanTokenBalance} more tokens
                  </p>
                )}
              </div>
            </div>

            {/* Terms and Info */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <InformationCircleIcon className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-purple-300 space-y-1">
                  <p>• Tokens will be held until request is accepted or expires</p>
                  <p>• You'll be charged per minute during the call</p>
                  <p>• Call ends when tokens are depleted or manually ended</p>
                  <p>• Unused tokens will be refunded if declined</p>
                </div>
              </div>
            </div>

            {/* Terms Checkbox */}
            <label className="flex items-start gap-3 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                disabled={requestStatus === 'pending'}
              />
              <span className="text-xs text-purple-300">
                I understand that tokens will be deducted at {pricePerMinute} tokens per minute
                during the private call session
              </span>
            </label>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {requestStatus !== 'pending' && (
                <>
                  <Button
                    onClick={handleRequestPrivateCall}
                    disabled={!hasEnoughTokens || !acceptedTerms || isRequesting}
                    variant="primary"
                    fullWidth
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    {isRequesting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        Sending Request...
                      </>
                    ) : (
                      <>
                        <VideoCameraIcon className="w-5 h-5 mr-2" />
                        Request Private Call
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={onClose}
                    variant="secondary"
                    fullWidth
                  >
                    Cancel
                  </Button>
                </>
              )}
              
              {requestStatus === 'pending' && (
                <div className="w-full text-center">
                  <p className="text-purple-300 text-sm mb-2">
                    Waiting for {creator?.displayName} to respond...
                  </p>
                  <p className="text-purple-400 text-xs">
                    Request expires in {formatTime(countdown)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -top-4 -right-4 pointer-events-none">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <SparklesIcon className="w-8 h-8 text-purple-400 opacity-50" />
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PrivateCallRequestModal;