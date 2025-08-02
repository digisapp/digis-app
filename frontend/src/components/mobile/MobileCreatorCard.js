import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useMobileUI } from './MobileUIProvider';
import {
  StarIcon,
  VideoCameraIcon,
  SparklesIcon,
  CheckBadgeIcon,
  HeartIcon,
  ChatBubbleLeftIcon
} from '@heroicons/react/24/solid';
import { HeartIcon as HeartOutlineIcon } from '@heroicons/react/24/outline';

const MobileCreatorCard = ({ 
  creator, 
  onSelect,
  onFollow,
  onMessage,
  variant = 'default' // 'default', 'compact', 'featured'
}) => {
  const { triggerHaptic } = useMobileUI();
  const [isFollowing, setIsFollowing] = useState(creator.isFollowing || false);
  const [isLiked, setIsLiked] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleFollow = (e) => {
    e.stopPropagation();
    setIsFollowing(!isFollowing);
    triggerHaptic?.('success');
    onFollow?.(creator, !isFollowing);
  };

  const handleLike = (e) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
    triggerHaptic?.('light');
  };

  const handleMessage = (e) => {
    e.stopPropagation();
    triggerHaptic?.('light');
    onMessage?.(creator);
  };

  const handleSelect = () => {
    triggerHaptic?.('light');
    onSelect?.(creator);
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.3, ease: 'easeOut' }
    },
    tap: { scale: 0.98 }
  };

  if (variant === 'compact') {
    return (
      <motion.div
        className="mobile-list-item"
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileTap="tap"
        onClick={handleSelect}
      >
        <div className="relative">
          <img 
            src={creator.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.displayName || 'User')}&size=48`} 
            alt={creator.displayName}
            className="mobile-list-item-avatar"
          />
          {creator.isLive && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
              <SparklesIcon className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
        
        <div className="mobile-list-item-content">
          <div className="flex items-center gap-1">
            <h3 className="mobile-list-item-title">{creator.displayName}</h3>
            {creator.isVerified && (
              <CheckBadgeIcon className="w-4 h-4 text-blue-500" />
            )}
          </div>
          <p className="mobile-list-item-subtitle">
            {creator.bio || `@${creator.username}`}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleLike}
            className="mobile-touch-target"
          >
            {isLiked ? (
              <HeartIcon className="w-5 h-5 text-red-500" />
            ) : (
              <HeartOutlineIcon className="w-5 h-5 text-gray-400" />
            )}
          </button>
          
          <button
            onClick={handleMessage}
            className="mobile-touch-target"
          >
            <ChatBubbleLeftIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </motion.div>
    );
  }

  if (variant === 'featured') {
    return (
      <motion.div
        className="relative overflow-hidden rounded-2xl shadow-lg"
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileTap="tap"
        onClick={handleSelect}
        style={{ aspectRatio: '3/4' }}
      >
        {/* Background Image */}
        <div className="absolute inset-0">
          {!imageLoaded && (
            <div className="mobile-skeleton w-full h-full" />
          )}
          <img 
            src={creator.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.displayName || 'User')}&size=400`} 
            alt={creator.displayName}
            className="w-full h-full object-cover"
            onLoad={() => setImageLoaded(true)}
            style={{ display: imageLoaded ? 'block' : 'none' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>
        
        {/* Status Badge */}
        {creator.isLive && (
          <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
            <SparklesIcon className="w-4 h-4" />
            LIVE
          </div>
        )}
        
        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-bold">{creator.displayName}</h3>
            {creator.isVerified && (
              <CheckBadgeIcon className="w-5 h-5 text-white" />
            )}
          </div>
          
          <p className="text-sm opacity-90 mb-3 line-clamp-2">
            {creator.bio || 'Available for video calls and messages'}
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <StarIcon className="w-4 h-4 text-yellow-400" />
                <span>{creator.rating || '4.9'}</span>
              </div>
              <div className="flex items-center gap-1">
                <VideoCameraIcon className="w-4 h-4" />
                <span>{creator.rate || '5'} tokens/min</span>
              </div>
            </div>
            
            <motion.button
              onClick={handleFollow}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                isFollowing 
                  ? 'bg-white/20 text-white border border-white/40' 
                  : 'bg-white text-gray-900'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Default variant
  return (
    <motion.div
      className="mobile-card"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileTap="tap"
      onClick={handleSelect}
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="relative">
          {!imageLoaded && (
            <div className="mobile-skeleton-avatar" />
          )}
          <img 
            src={creator.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.displayName || 'User')}&size=64`} 
            alt={creator.displayName}
            className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
            onLoad={() => setImageLoaded(true)}
            style={{ display: imageLoaded ? 'block' : 'none' }}
          />
          {creator.isLive && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
              <SparklesIcon className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900">{creator.displayName}</h3>
            {creator.isVerified && (
              <CheckBadgeIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-gray-500 mb-2">@{creator.username}</p>
          
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              <StarIcon className="w-4 h-4 text-yellow-400" />
              <span className="font-medium">{creator.rating || '4.9'}</span>
            </div>
            <span className="text-gray-400">•</span>
            <span className="text-gray-600">{creator.rate || '5'} tokens/min</span>
          </div>
        </div>
      </div>
      
      {creator.bio && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {creator.bio}
        </p>
      )}
      
      <div className="flex gap-2">
        <motion.button
          onClick={handleFollow}
          className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
            isFollowing 
              ? 'bg-gray-100 text-gray-700' 
              : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
          }`}
          whileTap={{ scale: 0.95 }}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </motion.button>
        
        <motion.button
          onClick={handleMessage}
          className="px-4 py-3 bg-gray-100 rounded-xl"
          whileTap={{ scale: 0.95 }}
        >
          <ChatBubbleLeftIcon className="w-5 h-5 text-gray-600" />
        </motion.button>
        
        <motion.button
          onClick={handleLike}
          className="px-4 py-3 bg-gray-100 rounded-xl"
          whileTap={{ scale: 0.95 }}
        >
          {isLiked ? (
            <HeartIcon className="w-5 h-5 text-red-500" />
          ) : (
            <HeartOutlineIcon className="w-5 h-5 text-gray-600" />
          )}
        </motion.button>
      </div>
      
      {creator.tags && creator.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {creator.tags.slice(0, 3).map((tag, index) => (
            <span key={index} className="mobile-chip">
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default MobileCreatorCard;