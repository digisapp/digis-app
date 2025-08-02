import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  HeartIcon, 
  UserGroupIcon, 
  ClockIcon,
  VideoCameraIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  RadioIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';

const EnhancedCreatorCard = ({ 
  creator, 
  onJoinSession, 
  onFollowToggle,
  onTip,
  onMessage,
  isAuthenticated = false,
  currentUserId = null
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFollowing, setIsFollowing] = useState(creator.isFollowing || false);
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Mock data for enhanced features
  const responseTime = creator.responseTime || `${Math.floor(Math.random() * 30) + 1}min`;
  const specialties = creator.specialties || ['Gaming', 'Music', 'Art'];
  const isOnline = creator.isOnline !== false;
  const isPremium = creator.isPremium || Math.random() > 0.7;
  
  // Mock content preview data
  const contentCount = creator.contentCount || Math.floor(Math.random() * 50) + 10;
  const latestContent = creator.latestContent || [
    { type: 'video', emoji: '🎬', count: Math.floor(Math.random() * 20) + 5 },
    { type: 'photo', emoji: '📸', count: Math.floor(Math.random() * 15) + 3 },
    { type: 'audio', emoji: '🎙️', count: Math.floor(Math.random() * 10) + 2 }
  ];
  
  const handleServiceClick = (serviceType, price) => {
    if (!isAuthenticated) {
      // Show sign-in prompt
      return;
    }
    
    if (onJoinSession) {
      onJoinSession(creator, serviceType, price);
    }
  };

  const handleFollowClick = async (e) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      // Show sign-in prompt
      return;
    }
    
    setIsFollowing(!isFollowing);
    if (onFollowToggle) {
      await onFollowToggle(creator.id, !isFollowing);
    }
  };

  const handleTipClick = (e) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      // Show sign-in prompt
      return;
    }
    
    if (onTip) {
      onTip(creator);
    }
  };

  const handleMessageClick = (e) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      // Show sign-in prompt
      return;
    }
    
    if (onMessage) {
      onMessage(creator);
    }
  };

  const services = [
    {
      type: 'stream',
      icon: RadioIcon,
      label: 'Live Stream',
      price: creator.streamPrice || creator.price_per_min || 5,
      color: 'from-purple-500 to-blue-500',
      available: true
    },
    {
      type: 'video',
      icon: VideoCameraIcon,
      label: 'Video Call',
      price: creator.videoPrice || creator.price_per_min || 8,
      color: 'from-pink-500 to-red-500',
      available: true
    },
    {
      type: 'voice',
      icon: PhoneIcon,
      label: 'Voice Call',
      price: creator.voicePrice || creator.price_per_min || 6,
      color: 'from-blue-500 to-cyan-500',
      available: true
    },
    {
      type: 'message',
      icon: ChatBubbleLeftRightIcon,
      label: 'Message',
      price: creator.messagePrice || creator.price_per_min || 2,
      color: 'from-green-500 to-emerald-500',
      available: true
    }
  ];

  return (
    <motion.div
      className="group relative bg-white rounded-3xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 * (creator.id || 0) }}
      whileHover={{ y: -8, scale: 1.02 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onMouseEnter={() => setShowQuickActions(true)}
      onMouseLeave={() => setShowQuickActions(false)}
    >
      {/* Premium Badge */}
      {isPremium && (
        <div className="absolute top-4 left-4 z-10">
          <div className="flex items-center gap-1 bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-3 py-1 rounded-full text-xs font-bold">
            <SparklesIcon className="w-3 h-3" />
            VIP
          </div>
        </div>
      )}

      {/* Online Status & Quick Actions */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {/* Online Indicator */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
          isOnline 
            ? 'bg-green-100 text-green-800' 
            : 'bg-gray-100 text-gray-600'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
          }`} />
          {isOnline ? 'Online' : 'Offline'}
        </div>

        {/* Heart/Follow Button */}
        <motion.button
          onClick={handleFollowClick}
          className={`p-2 rounded-full transition-all ${
            isFollowing 
              ? 'bg-red-100 text-red-600' 
              : 'bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600'
          }`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {isFollowing ? (
            <HeartIconSolid className="w-4 h-4" />
          ) : (
            <HeartIcon className="w-4 h-4" />
          )}
        </motion.button>
      </div>

      {/* Profile Section */}
      <div className="text-center mb-6 relative">
        {/* Profile Picture with Frame */}
        <div className="relative inline-block">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 p-1">
            <div className="w-full h-full rounded-full overflow-hidden bg-white">
              {creator.profilePicUrl || creator.profile_pic_url ? (
                <img 
                  src={creator.profilePicUrl || creator.profile_pic_url} 
                  alt={creator.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-2xl font-bold">
                  {(creator.username || creator.supabase_id || '?')[0]?.toUpperCase()}
                </div>
              )}
            </div>
          </div>
          
          {/* Activity Ring */}
          {isOnline && (
            <div className="absolute inset-0 rounded-full border-2 border-green-400 animate-ping opacity-75" />
          )}
        </div>

        {/* Creator Info */}
        <h3 className="text-lg font-bold text-gray-900 mt-3 mb-1">
          @{creator.username || creator.supabase_id}
        </h3>
        
        {creator.bio && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2 px-2">
            {creator.bio}
          </p>
        )}

        {/* Specialties */}
        <div className="flex flex-wrap gap-1 justify-center mb-3">
          {specialties.slice(0, 3).map((specialty) => (
            <span 
              key={specialty}
              className="px-2 py-1 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 text-xs rounded-full font-medium"
            >
              {specialty}
            </span>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center gap-4 text-xs text-gray-600 mb-4">
          <div className="flex items-center gap-1">
            <UserGroupIcon className="w-4 h-4" />
            <span>{creator.followerCount || Math.floor(Math.random() * 1000) + 100}</span>
          </div>
          <div className="flex items-center gap-1">
            <ClockIcon className="w-4 h-4" />
            <span>{responseTime}</span>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <motion.button
              key={service.type}
              onClick={() => handleServiceClick(service.type, service.price)}
              className={`relative p-3 rounded-xl bg-gradient-to-r ${service.color} text-white text-center transition-all group/service overflow-hidden`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={!service.available}
            >
              {/* Background Pattern */}
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/service:opacity-100 transition-opacity" />
              
              <Icon className="w-5 h-5 mx-auto mb-1" />
              <div className="text-xs font-medium mb-1">{service.label}</div>
              <div className="text-xs font-bold">${service.price}/min</div>
              
              {/* Hover Effect */}
              <div className="absolute inset-0 bg-white/20 rounded-xl scale-0 group-hover/service:scale-100 transition-transform duration-300" />
            </motion.button>
          );
        })}
      </div>

      {/* Content Preview Section */}
      <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
            <SparklesIcon className="w-3 h-3 text-purple-600" />
            Content Shop
          </span>
          <span className="text-xs text-gray-600 font-medium">{contentCount} items</span>
        </div>
        <div className="flex items-center gap-3">
          {latestContent.map((content, index) => (
            <div key={index} className="flex items-center gap-1 text-xs">
              <span className="text-base">{content.emoji}</span>
              <span className="text-gray-600 font-medium">{content.count}</span>
            </div>
          ))}
          <div className="ml-auto">
            <span className="text-xs text-purple-600 font-semibold hover:text-purple-700 cursor-pointer">
              View Shop →
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <motion.div 
        className="flex gap-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ 
          opacity: showQuickActions || isHovered ? 1 : 0.7, 
          y: showQuickActions || isHovered ? 0 : 10 
        }}
        transition={{ duration: 0.2 }}
      >
        <button
          onClick={handleMessageClick}
          className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2 px-4 rounded-xl text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
        >
          <ChatBubbleLeftRightIcon className="w-4 h-4" />
          Message
        </button>
        
        <button
          onClick={handleTipClick}
          className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white py-2 px-4 rounded-xl text-sm font-medium hover:from-amber-500 hover:to-yellow-600 transition-all flex items-center justify-center gap-2"
        >
          💰 Tip
        </button>
      </motion.div>

      {/* Hover Overlay Effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent rounded-3xl pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />

      {/* Floating Action Indicators */}
      {showQuickActions && (
        <motion.div
          className="absolute -top-2 -right-2 flex flex-col gap-2"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Live indicator for streaming */}
          {isOnline && (
            <div className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              LIVE
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};

export default EnhancedCreatorCard;