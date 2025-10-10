import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline';

const VideoCallModal = ({
  isOpen,
  onClose,
  creator,
  tokenCost,
  tokenBalance = 0,
  onCallStart
}) => {
  const navigate = useNavigate();
  const [showInsufficientTokens, setShowInsufficientTokens] = useState(false);

  const handleStartCall = () => {
    console.log('VideoCallModal - Token Check:', {
      tokenBalance,
      tokenCost,
      hasEnough: tokenBalance >= tokenCost
    });

    // Check if user has enough tokens (creators can also pay for calls with other creators)
    if (tokenBalance < tokenCost) {
      setShowInsufficientTokens(true);
      return;
    }

    if (onCallStart) {
      onCallStart();
    }
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10001]"
            onClick={onClose}
          />

          {/* Enhanced Modal with Message popup style */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 30 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed z-[10002]"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '420px',
              maxWidth: '90vw'
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="video-call-title"
          >
            {/* Glass morphism container */}
            <div className="relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_70px_-15px_rgba(139,92,246,0.3)] border border-white/20 dark:border-gray-700/30 overflow-hidden">
              {/* Gradient accent top border */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-violet-500"></div>

              {/* Floating orbs for ambiance */}
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"></div>

              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 rounded-xl transition-all hover:rotate-90 duration-200 z-10 group"
                aria-label="Close video call modal"
              >
                <XMarkIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
              </button>

              {/* Body with padding */}
              <div className="p-6 pb-8 relative" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
                {/* Mini avatar and name at top */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="relative">
                    <img
                      src={creator.avatar || creator.profile_pic_url || `https://ui-avatars.com/api/?name=${creator.username}&background=8B5CF6&color=fff`}
                      alt={creator.username}
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-violet-500/30 cursor-pointer hover:ring-4 hover:ring-violet-500/50 transition-all"
                      width={32}
                      height={32}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/profile/${creator.username}`);
                        onClose();
                      }}
                    />
                    {creator.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {creator.displayName || creator.display_name || creator.username}
                  </span>
                </div>

                {/* Call info card */}
                <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-xl p-4 mb-4 border border-violet-200/50 dark:border-violet-700/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <VideoCameraIcon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                      <span className="font-medium text-gray-900 dark:text-white">Video Call</span>
                    </div>
                    <span className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
                      {tokenCost} tokens/min
                    </span>
                  </div>
                </div>

                {/* Warning if insufficient tokens - only shown after clicking Start Call */}
                {showInsufficientTokens && (
                  <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg mb-4">
                    <p className="font-medium">Insufficient tokens</p>
                    <p className="text-xs mt-1">You need tokens to start this call.</p>
                    <button
                      onClick={() => navigate('/tokens')}
                      className="mt-2 w-full px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-all"
                    >
                      Purchase Tokens
                    </button>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartCall}
                    className="flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 relative overflow-hidden group bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg hover:shadow-xl hover:from-violet-700 hover:to-purple-700 transform hover:-translate-y-0.5"
                  >
                    {/* Button shimmer animation on hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[length:200%_100%] group-hover:animate-shimmer"></div>

                    <div className="relative flex items-center gap-2">
                      <VideoCameraIcon className="w-5 h-5" />
                      <span>Start Call</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default VideoCallModal;