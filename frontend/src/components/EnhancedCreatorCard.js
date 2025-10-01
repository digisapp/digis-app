import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  StarIcon,
  VideoCameraIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import Avatar from './ui/Avatar';

// Helper function to get gradient class based on category
const getCategoryGradient = (category) => {
  const gradients = {
    'Fitness': 'bg-gradient-to-r from-orange-500 to-red-500',
    'Wellness': 'bg-gradient-to-r from-green-500 to-teal-500',
    'Fashion': 'bg-gradient-to-r from-pink-500 to-purple-500',
    'Business': 'bg-gradient-to-r from-blue-600 to-indigo-600',
    'Creative': 'bg-gradient-to-r from-purple-500 to-pink-500',
    'Cooking': 'bg-gradient-to-r from-yellow-500 to-orange-500',
    'Tech': 'bg-gradient-to-r from-cyan-500 to-blue-500',
    'Music': 'bg-gradient-to-r from-violet-500 to-purple-500',
    'Gaming': 'bg-gradient-to-r from-purple-600 to-indigo-600',
    'Education': 'bg-gradient-to-r from-emerald-500 to-teal-500',
    'Entertainment': 'bg-gradient-to-r from-rose-500 to-pink-500',
    'Lifestyle': 'bg-gradient-to-r from-amber-500 to-orange-500',
    'Sports': 'bg-gradient-to-r from-red-500 to-orange-500',
    'Travel': 'bg-gradient-to-r from-sky-500 to-blue-500',
    'Beauty': 'bg-gradient-to-r from-pink-400 to-rose-400',
    'Art': 'bg-gradient-to-r from-indigo-500 to-purple-500',
    'Photography': 'bg-gradient-to-r from-gray-600 to-gray-800',
    'Dance': 'bg-gradient-to-r from-fuchsia-500 to-purple-500',
    'Comedy': 'bg-gradient-to-r from-yellow-400 to-amber-500',
    'Other': 'bg-gradient-to-r from-gray-500 to-gray-700'
  };
  return gradients[category] || gradients['Other'];
};

const EnhancedCreatorCard = ({
  creator,
  onStartVideoCall,
  onStartVoiceCall,
  onSendMessage,
  onToggleSave,
  savedCreators = [],
  isDashboard = false,
  onEditProfile,
  onUpdateProfile,
  onOpenQuickView
}) => {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmType, setConfirmType] = useState('');
  const [confirmData, setConfirmData] = useState(null);
  const isSaved = savedCreators.includes(creator.id);

  const handleActionClick = (e, type, callback, rate) => {
    e.stopPropagation();
    if (isDashboard) {
      // In dashboard mode, clicking any action button opens pricing modal
      if (onEditProfile) {
        onEditProfile('pricing');
      }
    } else {
      // In explore mode, these initiate actions
      setConfirmType(type);
      setConfirmData({ callback, rate });
      setShowConfirm(true);
    }
  };

  const handleConfirm = () => {
    if (confirmData?.callback) {
      confirmData.callback(creator);
    }
    setShowConfirm(false);
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setConfirmType('');
    setConfirmData(null);
  };

  const handleCardClick = () => {
    if (isDashboard && onEditProfile) {
      onEditProfile('profile');
    } else if (!isDashboard) {
      // Navigate to creator's profile page
      navigate(`/profile/${creator.username}`);
    }
  };

  // Determine display values
  const username = creator.username;
  const avatar = creator.avatar || creator.profile_pic_url || creator.profilePicUrl;
  const specialties = creator.specialties || creator.categories || [];
  const location = [creator.state, creator.country].filter(Boolean).join(', ');
  const isLive = creator.isLive || creator.isStreaming;
  const isOnline = creator.isOnline;

  return (
    <>
      <motion.div
        whileHover={{ 
          y: -6,
          transition: { duration: 0.3, ease: "easeOut" }
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="group cursor-pointer min-w-0 relative"
        onClick={handleCardClick}
      >
        <motion.div 
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-900/30 transition-all duration-500 overflow-hidden min-w-0"
          whileHover={{
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)"
          }}
        >
          {/* Image Section with All Overlays */}
          <div className="relative aspect-[3/4] overflow-hidden">
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
              <Avatar
                user={creator}
                size={200}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                showOnlineStatus={false}
                priority={true}
              />
            </div>

            {/* Enhanced gradient overlays for premium feel */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
            {/* Vignette effect */}
            <div className="absolute inset-0 bg-radial-gradient pointer-events-none" style={{
              background: 'radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.2) 100%)'
            }} />


            {/* Enhanced Status Badges with Glow */}
            {isLive ? (
              <motion.div 
                className="absolute top-3 left-3"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                <motion.span 
                  className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 font-semibold"
                  style={{
                    boxShadow: '0 0 20px rgba(239, 68, 68, 0.5), 0 4px 12px rgba(0, 0, 0, 0.2)'
                  }}
                  animate={{
                    boxShadow: [
                      '0 0 20px rgba(239, 68, 68, 0.5), 0 4px 12px rgba(0, 0, 0, 0.2)',
                      '0 0 30px rgba(239, 68, 68, 0.7), 0 4px 12px rgba(0, 0, 0, 0.2)',
                      '0 0 20px rgba(239, 68, 68, 0.5), 0 4px 12px rgba(0, 0, 0, 0.2)'
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  LIVE
                </motion.span>
              </motion.div>
            ) : isOnline ? (
              <motion.div 
                className="absolute top-3 left-3"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                <span 
                  className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-medium"
                  style={{
                    boxShadow: '0 0 15px rgba(34, 197, 94, 0.4), 0 4px 8px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                  Online
                </span>
              </motion.div>
            ) : null}

            {/* Save Button - Top Right (Not in Dashboard) */}
            {!isDashboard && onToggleSave && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSave(creator.id);
                }}
                className="absolute top-3 right-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-2 rounded-full hover:bg-white dark:hover:bg-gray-700 transition-colors shadow-lg"
              >
                {isSaved ? (
                  <StarIconSolid className="w-5 h-5 text-yellow-500" />
                ) : (
                  <StarIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>
            )}

            {/* Enhanced Category Badge with Gradient */}
            {specialties.length > 0 && (
              <motion.div 
                className="absolute top-14 right-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <span className={`px-3 py-1.5 backdrop-blur-sm text-white text-xs rounded-full shadow-lg font-semibold ${
                  getCategoryGradient(specialties[0])
                }`}>
                  {specialties[0]}
                </span>
              </motion.div>
            )}

            {/* Name and Username - Bottom Left */}
            <div className="absolute bottom-3 left-3 right-3">
              <h3 className="text-white font-bold text-lg leading-tight drop-shadow-lg">
                {username}
              </h3>
              {location && (
                <p className="text-white/80 text-xs mt-1 flex items-center gap-1 drop-shadow-md">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {location}
                </p>
              )}
            </div>

          </div>

          {/* Only show action buttons on Dashboard */}
          {isDashboard && (
            <div className="p-3 bg-white dark:bg-gray-800">
              <div className="grid grid-cols-3 gap-2">
                <motion.button
                  onClick={(e) => handleActionClick(e, 'video', onStartVideoCall, creator.videoPrice || creator.video_price || creator.pricePerMin || 5)}
                  className="relative flex items-center justify-center gap-1 px-2 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg transition-all text-sm font-medium overflow-hidden group"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  <VideoCameraIcon className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">
                    <span className="flex items-center gap-1">
                      {creator.videoPrice || creator.video_price || 150}
                    </span>
                  </span>
                </motion.button>

                <motion.button
                  onClick={(e) => handleActionClick(e, 'voice', onStartVoiceCall, creator.voicePrice || creator.voice_price || creator.pricePerMin || 5)}
                  className="relative flex items-center justify-center gap-1 px-2 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg transition-all text-sm font-medium overflow-hidden group"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-600 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  <PhoneIcon className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">
                    <span className="flex items-center gap-1">
                      {creator.voicePrice || creator.voice_price || 50}
                    </span>
                  </span>
                </motion.button>

                <motion.button
                  onClick={(e) => handleActionClick(e, 'message', onSendMessage, creator.messagePrice || creator.message_price || 2)}
                  className="relative flex items-center justify-center gap-1 px-2 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg transition-all text-sm font-medium overflow-hidden group"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    boxShadow: '0 2px 8px rgba(147, 51, 234, 0.3)'
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  <ChatBubbleLeftRightIcon className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">
                    <span className="flex items-center gap-1">
                      {creator.messagePrice || creator.message_price || 50}
                    </span>
                  </span>
                </motion.button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Confirmation Dialog - Only for Explore Mode */}
      {!isDashboard && (
        <AnimatePresence>
          {showConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold mb-4">
                  {confirmType === 'video' && 'Start Video Call?'}
                  {confirmType === 'voice' && 'Start Voice Call?'}
                  {confirmType === 'message' && 'Send Message?'}
                </h3>

                {confirmData?.rate > 0 && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Session Rate:</p>
                    <div className="flex items-center gap-2">
                      <SparklesIcon className="w-6 h-6 text-purple-600" />
                      <p className="text-2xl font-bold text-purple-600">{confirmData.rate} tokens/min</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Minimum 5 minutes</p>
                  </div>
                )}

                {confirmType === 'message' && (
                  <p className="text-sm text-gray-600 mb-4">Start a conversation with {username}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  >
                    Confirm
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </>
  );
};

export default EnhancedCreatorCard;