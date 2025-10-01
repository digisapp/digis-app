import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  PlayCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  LockClosedIcon,
  CheckCircleIcon,
  FilmIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';
import { PlayIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { supabase } from '../utils/supabase-auth';

const VODPurchaseModal = ({ 
  isOpen, 
  onClose, 
  recording,
  tokenBalance,
  onPurchaseSuccess,
  onTokenPurchase
}) => {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  if (!recording) return null;
  
  const vodPrice = recording.price_in_tokens || 50;
  const hasEnoughTokens = tokenBalance >= vodPrice;
  const duration = recording.duration_seconds 
    ? `${Math.floor(recording.duration_seconds / 60)} min`
    : 'N/A';

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/vod/purchase/${recording.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('VOD access purchased! You have 48 hours to watch.');
        onPurchaseSuccess && onPurchaseSuccess(data);
        onClose();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to purchase VOD');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to purchase VOD access');
    } finally {
      setIsPurchasing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with thumbnail */}
            <div className="relative h-48 bg-gradient-to-br from-purple-600 to-pink-600">
              {recording.thumbnail_url ? (
                <img 
                  src={recording.thumbnail_url} 
                  alt={recording.stream_title}
                  className="w-full h-full object-cover opacity-80"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FilmIcon className="w-20 h-20 text-white/50" />
                </div>
              )}
              
              {/* Overlay with play icon */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-center justify-center">
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
                  <PlayIcon className="w-12 h-12 text-white" />
                </div>
              </div>
              
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-black/20 backdrop-blur-sm rounded-full hover:bg-black/40 transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Title and creator */}
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  {recording.stream_title || 'VOD Replay'}
                </h2>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <img
                    src={recording.creator_avatar || `https://ui-avatars.com/api/?name=${recording.creator_name}`}
                    alt={recording.creator_name}
                    className="w-6 h-6 rounded-full"
                  />
                  <span>{recording.creator_name}</span>
                  <span>•</span>
                  <span>{formatDate(recording.created_at)}</span>
                </div>
              </div>

              {/* VOD Details */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <LockClosedIcon className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold text-gray-900 dark:text-white">Pay-Per-View</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {vodPrice} tokens
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <ClockIcon className="w-4 h-4" />
                    <span>Duration: {duration}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <CalendarDaysIcon className="w-4 h-4" />
                    <span>48-hour rental period</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <PlayCircleIcon className="w-4 h-4" />
                    <span>Watch unlimited times during rental</span>
                  </div>
                </div>
              </div>

              {/* Token balance */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Your balance:</span>
                  <span className={`font-semibold ${hasEnoughTokens ? 'text-green-600' : 'text-red-600'}`}>
                    {tokenBalance} tokens
                  </span>
                </div>
                {!hasEnoughTokens && (
                  <div className="mt-2 text-xs text-red-600">
                    You need {vodPrice - tokenBalance} more tokens to purchase this VOD
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                {hasEnoughTokens ? (
                  <button
                    onClick={handlePurchase}
                    disabled={isPurchasing}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isPurchasing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="w-5 h-5" />
                        Purchase Access
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={onTokenPurchase}
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
                  >
                    <CurrencyDollarIcon className="w-5 h-5" />
                    Buy Tokens
                  </button>
                )}
                
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>

              {/* Info text */}
              <p className="mt-4 text-xs text-center text-gray-500 dark:text-gray-400">
                Once purchased, you'll have 48 hours to watch this content.
                The rental period starts immediately after purchase.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VODPurchaseModal;