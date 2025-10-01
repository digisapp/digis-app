import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import socketService from '../utils/socket';
import {
  HeartIcon,
  UserPlusIcon,
  GiftIcon,
  CurrencyDollarIcon,
  StarIcon,
  BoltIcon,
  FireIcon,
  TrophyIcon,
  SparklesIcon,
  RocketLaunchIcon,
  MegaphoneIcon,
  BellAlertIcon
} from '@heroicons/react/24/solid';

const StreamActivityFeed = ({ channel, className = '' }) => {
  const [activities, setActivities] = useState([]);
  const [filter, setFilter] = useState('all'); // all, follows, gifts, milestones
  const [showLiveIndicator, setShowLiveIndicator] = useState(true);
  const activityEndRef = useRef(null);

  // Connect to real Socket.io events
  useEffect(() => {
    if (!channel) return;
    
    // Socket event handlers
    const handleGiftReceived = (data) => {
      const activity = {
        id: Date.now() + Math.random(),
        type: 'gift',
        user: data.sender,
        icon: GiftIcon,
        color: 'text-pink-400',
        bgColor: 'bg-gradient-to-br from-pink-500/20 to-purple-500/20',
        borderColor: 'border-pink-500/30',
        message: 'sent',
        value: data.totalValue,
        giftName: data.giftType,
        giftEmoji: getGiftEmoji(data.giftType),
        timestamp: Date.now()
      };
      setActivities(prev => [activity, ...prev].slice(0, 50));
    };
    
    const handleTipReceived = (data) => {
      const activity = {
        id: Date.now() + Math.random(),
        type: 'tip',
        user: data.sender,
        icon: CurrencyDollarIcon,
        color: 'text-green-400',
        bgColor: 'bg-gradient-to-br from-green-500/20 to-emerald-500/20',
        borderColor: 'border-green-500/30',
        message: 'tipped',
        amount: data.amount,
        note: data.message,
        timestamp: Date.now()
      };
      setActivities(prev => [activity, ...prev].slice(0, 50));
    };
    
    const handleNewFollower = (data) => {
      const activity = {
        id: Date.now() + Math.random(),
        type: 'follow',
        user: data.follower,
        icon: UserPlusIcon,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20',
        borderColor: 'border-purple-500/30',
        message: 'started following',
        timestamp: Date.now()
      };
      setActivities(prev => [activity, ...prev].slice(0, 50));
    };
    
    const handleSubscription = (data) => {
      const activity = {
        id: Date.now() + Math.random(),
        type: 'subscription',
        user: data.subscriber,
        icon: StarIcon,
        color: 'text-yellow-400',
        bgColor: 'bg-gradient-to-br from-yellow-500/20 to-amber-500/20',
        borderColor: 'border-yellow-500/30',
        message: 'subscribed',
        tier: data.tier || 'Tier 1',
        streak: data.streak || 1,
        timestamp: Date.now()
      };
      setActivities(prev => [activity, ...prev].slice(0, 50));
    };
    
    const handleMilestone = (data) => {
      const activity = {
        id: Date.now() + Math.random(),
        type: 'milestone',
        icon: TrophyIcon,
        color: 'text-orange-400',
        bgColor: 'bg-gradient-to-br from-orange-500/20 to-red-500/20',
        borderColor: 'border-orange-500/30',
        message: data.message,
        timestamp: Date.now()
      };
      setActivities(prev => [activity, ...prev].slice(0, 50));
    };
    
    // Join stream room
    socketService.emit('join-stream', { channel });
    
    // Listen to events
    socketService.on('gift-received', handleGiftReceived);
    socketService.on('tip-received', handleTipReceived);
    socketService.on('new-follower', handleNewFollower);
    socketService.on('new-subscription', handleSubscription);
    socketService.on('milestone-reached', handleMilestone);
    
    return () => {
      socketService.emit('leave-stream', { channel });
      socketService.off('gift-received', handleGiftReceived);
      socketService.off('tip-received', handleTipReceived);
      socketService.off('new-follower', handleNewFollower);
      socketService.off('new-subscription', handleSubscription);
      socketService.off('milestone-reached', handleMilestone);
    };
  }, [channel]);
  
  const getGiftEmoji = (giftType) => {
    const emojis = {
      heart: '❤️',
      rose: '🌹',
      diamond: '💎',
      crown: '👑',
      rocket: '🚀',
      mansion: '🏰'
    };
    return emojis[giftType] || '🎁';
  };

  // Auto scroll to top for new activities
  useEffect(() => {
    activityEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activities]);

  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    if (filter === 'follows') return activity.type === 'follow' || activity.type === 'subscription';
    if (filter === 'gifts') return activity.type === 'gift' || activity.type === 'tip' || activity.type === 'superchat';
    if (filter === 'milestones') return activity.type === 'milestone' || activity.type === 'raid';
    return true;
  });

  const formatTime = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
  };

  return (
    <div className={`bg-gradient-to-b from-gray-900/95 to-gray-950/95 backdrop-blur-xl rounded-2xl flex flex-col h-full border border-purple-500/20 shadow-2xl shadow-purple-500/10 ${className}`}>
      {/* Header with Filters */}
      <div className="relative p-4 border-b border-purple-500/20 overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-purple-600/10 animate-gradient-x" />
        
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl">
                <SparklesIcon className="w-5 h-5 text-yellow-400" />
              </div>
              <h3 className="font-bold text-lg text-white">Activity Feed</h3>
              {showLiveIndicator && (
                <div className="flex items-center gap-1 px-3 py-1 bg-red-500/20 rounded-full animate-pulse">
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  <span className="text-xs text-red-400 font-medium">LIVE</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <BellAlertIcon className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400 font-medium">{activities.length}</span>
            </div>
          </div>
          
          {/* Filter Tabs */}
          <div className="flex gap-1">
            {[
              { id: 'all', label: 'All', icon: SparklesIcon },
              { id: 'follows', label: 'Follows', icon: UserPlusIcon },
              { id: 'gifts', label: 'Gifts', icon: GiftIcon },
              { id: 'milestones', label: 'Events', icon: TrophyIcon }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <motion.button
                  key={tab.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setFilter(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-all duration-200 ${
                    filter === tab.id
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                      : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {tab.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Activities List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-purple-600/50 scrollbar-track-gray-800/50">
        <div ref={activityEndRef} />
        <AnimatePresence>
          {filteredActivities.map((activity) => {
            const Icon = activity.icon;
            
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.9 }}
                transition={{ type: "spring", duration: 0.4 }}
                whileHover={{ scale: 1.02 }}
                className={`relative ${activity.bgColor} rounded-xl p-3 backdrop-blur-sm border ${activity.borderColor} hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-200 overflow-hidden`}
              >
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                </div>

                <div className="relative flex items-start gap-3">
                  {/* Icon with animation */}
                  <motion.div 
                    className={`p-2.5 bg-gray-900/50 rounded-xl ${activity.color} backdrop-blur-sm`}
                    animate={{ 
                      rotate: activity.type === 'milestone' ? [0, 360] : 0,
                      scale: activity.type === 'raid' || activity.type === 'superchat' ? [1, 1.2, 1] : 1
                    }}
                    transition={{ 
                      duration: activity.type === 'milestone' ? 2 : 1,
                      repeat: activity.type === 'raid' || activity.type === 'superchat' ? Infinity : 0,
                      repeatDelay: 3
                    }}
                  >
                    <Icon className="w-5 h-5" />
                  </motion.div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Main Text */}
                    <div className="text-sm leading-relaxed">
                      {activity.user && (
                        <span className="font-bold text-white hover:text-purple-400 cursor-pointer transition-colors">
                          {activity.user}
                        </span>
                      )}
                      <span className="text-gray-300"> {activity.message}</span>
                      
                      {/* Additional Info with enhanced styling */}
                      {activity.type === 'subscription' && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-md text-xs font-medium">
                            <StarIcon className="w-3 h-3" />
                            {activity.tier}
                          </span>
                          {activity.streak > 1 && (
                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-md text-xs font-medium">
                              <FireIcon className="w-3 h-3" />
                              {activity.streak} months
                            </span>
                          )}
                        </div>
                      )}
                      
                      {activity.type === 'gift' && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-2xl">{activity.giftEmoji}</span>
                          <span className="font-bold text-white">{activity.giftName}</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-pink-500/20 text-pink-400 rounded-md text-xs font-medium">
                            +{activity.value} tokens
                          </span>
                        </div>
                      )}
                      
                      {activity.type === 'tip' && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded-md text-xs font-bold">
                            ${activity.amount}
                          </span>
                          {activity.note && (
                            <p className="mt-1 text-xs text-gray-400 italic">"{activity.note}"</p>
                          )}
                        </div>
                      )}
                      
                      {activity.type === 'raid' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-md text-xs font-bold ml-1">
                          <UserPlusIcon className="w-3 h-3" />
                          {activity.viewers} viewers
                        </span>
                      )}
                      
                      {activity.type === 'superchat' && (
                        <div className="mt-2 p-2 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-lg border border-red-500/30">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-red-400">SUPER CHAT</span>
                            <span className="text-sm font-bold text-white">${activity.amount}</span>
                          </div>
                          <p className="text-sm text-white">{activity.text}</p>
                        </div>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{formatTime(activity.timestamp)}</span>
                      {(activity.type === 'raid' || activity.type === 'superchat' || (activity.type === 'tip' && activity.amount >= 20)) && (
                        <span className="text-xs text-purple-400 font-medium animate-pulse">• Featured</span>
                      )}
                    </div>
                  </div>

                </div>

                {/* Progress Bar for Milestones */}
                {activity.type === 'milestone' && (
                  <motion.div 
                    className="mt-3 h-1.5 bg-gray-800/50 rounded-full overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 1.5, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-orange-400 via-yellow-400 to-orange-400 relative overflow-hidden"
                    >
                      <motion.div 
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
                        animate={{ x: ['-200%', '200%'] }}
                        transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                      />
                    </motion.div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Empty State */}
        {filteredActivities.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <FireIcon className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">No activities yet</p>
            <p className="text-gray-600 text-xs mt-1">Stream events will appear here</p>
          </motion.div>
        )}
      </div>

      {/* Stats Footer */}
      <div className="p-3 border-t border-purple-500/20 bg-gradient-to-r from-gray-900/50 to-gray-950/50">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-gray-800/50">
            <p className="text-xs text-gray-500">Follows</p>
            <p className="text-sm font-bold text-purple-400">
              {activities.filter(a => a.type === 'follow').length}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-gray-800/50">
            <p className="text-xs text-gray-500">Gifts</p>
            <p className="text-sm font-bold text-pink-400">
              {activities.filter(a => a.type === 'gift').length}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-gray-800/50">
            <p className="text-xs text-gray-500">Revenue</p>
            <p className="text-sm font-bold text-green-400">
              ${activities.filter(a => a.type === 'tip' || a.type === 'superchat')
                .reduce((sum, a) => sum + (a.amount || 0), 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamActivityFeed;