import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  SparklesIcon,
  WalletIcon,
  HeartIcon,
  VideoCameraIcon,
  CalendarIcon,
  StarIcon,
  ClockIcon,
  TrophyIcon,
  FireIcon,
  ChevronRightIcon,
  BellIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import api from '../../services/api';
import EnhancedCreatorCard from '../EnhancedCreatorCard';

const MobileFanDashboard = ({ 
  user, 
  tokenBalance,
  onNavigate,
  onCreatorSelect,
  onTokenPurchase,
  onStartVideoCall,
  onStartVoiceCall
}) => {
  const [featuredCreators, setFeaturedCreators] = useState([]);
  const [liveCreators, setLiveCreators] = useState([]);
  const [followedCreators, setFollowedCreators] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(false); // Start with false to show dashboard immediately
  const [activeTab, setActiveTab] = useState('discover');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      // Don't set loading to true - let the dashboard show immediately
      const [featured, live, followed] = await Promise.all([
        api.creators.getFeatured().catch(() => ({ data: { creators: [] } })),
        api.creators.getLive().catch(() => ({ data: { creators: [] } })),
        api.following.getFollowed().catch(() => ({ data: { creators: [] } }))
      ]);

      setFeaturedCreators(featured.data?.creators || []);
      setLiveCreators(live.data?.creators || []);
      setFollowedCreators(followed.data?.creators || []);
      
      // Set some mock data if API fails
      if (!featured.data?.creators?.length) {
        setFeaturedCreators([
          { id: '1', username: 'Creator1', is_live: true, rating: 4.8, specialties: ['Gaming', 'Tech'] },
          { id: '2', username: 'Creator2', is_live: false, rating: 4.9, specialties: ['Art', 'Music'] }
        ]);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Set mock data on error
      setFeaturedCreators([
        { id: '1', username: 'Creator1', is_live: true, rating: 4.8 },
        { id: '2', username: 'Creator2', is_live: false, rating: 4.9 }
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const quickActions = [
    {
      id: 'explore',
      title: 'Explore',
      icon: MagnifyingGlassIcon,
      color: 'bg-gradient-to-r from-blue-500 to-cyan-500',
      onClick: () => onNavigate('explore'),
      description: 'Discover creators'
    },
    {
      id: 'tokens',
      title: 'Get Tokens',
      icon: WalletIcon,
      color: 'bg-gradient-to-r from-purple-500 to-indigo-500',
      onClick: onTokenPurchase,
      description: 'Buy tokens'
    },
    {
      id: 'live',
      title: 'Live Now',
      icon: SparklesIcon,
      color: 'bg-gradient-to-r from-red-500 to-pink-500',
      onClick: () => setActiveTab('live'),
      description: `${liveCreators.length} streaming`,
      badge: liveCreators.length
    },
    {
      id: 'schedule',
      title: 'Schedule',
      icon: CalendarIcon,
      color: 'bg-gradient-to-r from-green-500 to-emerald-500',
      onClick: () => onNavigate('schedule'),
      description: 'Upcoming calls'
    }
  ];

  const categories = [
    { id: 'trending', label: 'Trending', icon: FireIcon, color: 'text-red-500' },
    { id: 'new', label: 'New', icon: StarIcon, color: 'text-yellow-500' },
    { id: 'popular', label: 'Popular', icon: TrophyIcon, color: 'text-purple-500' },
    { id: 'online', label: 'Online', icon: ClockIcon, color: 'text-green-500' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 relative">
      {/* Header with safe area */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white pt-safe pb-12">
        <div className="px-safe">
          <div className="px-4 pt-4">
            {/* Logo, username and stats row */}
            <div className="flex justify-between items-center mb-4">
              {/* Avatar and Username on the left */}
              <div className="flex items-center gap-2">
                {/* User Avatar */}
                <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  {user?.profile_pic_url ? (
                    <img
                      src={user.profile_pic_url}
                      alt={user.username}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold text-base">
                      {user?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                {/* Username without @ */}
                {user && (
                  <p className="text-white text-lg font-semibold">
                    {user?.username || user?.email?.split('@')[0] || 'user'}
                  </p>
                )}
              </div>

              {/* Followers and Tokens on the right */}
              <div className="flex items-center gap-3">
                {/* Followers Button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onNavigate('followers')}
                  className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5"
                >
                  <HeartIcon className="w-5 h-5 text-white" />
                  <span className="font-bold text-white">{user?.followers_count || user?.followers || 0}</span>
                </motion.button>

                {/* Tokens Button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onNavigate('wallet')}
                  className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5"
                >
                  <WalletIcon className="w-5 h-5 text-white" />
                  <span className="font-bold text-white">{tokenBalance || 0}</span>
                </motion.button>
              </div>
            </div>
            
            {/* Welcome message */}
            <div>
              <h1 className="text-2xl font-bold">Welcome back!</h1>
              <p className="text-purple-100 text-sm mt-1">Discover amazing creators today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions - Enhanced cards */}
      <div className="px-safe">
        <div className="px-4 -mt-6">
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <motion.button
                key={action.id}
                whileTap={{ scale: 0.95 }}
                onClick={action.onClick}
                className={`${action.color} text-white rounded-2xl p-4 shadow-xl relative overflow-hidden transform hover:scale-105 transition-all duration-200`}
                aria-label={action.title}
              >
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-2">
                    <action.icon className="w-8 h-8" strokeWidth={1.5} />
                    {action.badge > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="bg-white text-gray-900 text-xs font-bold px-2 py-1 rounded-full animate-pulse shadow-md"
                      >
                        {action.badge}
                      </motion.span>
                    )}
                  </div>
                  <h3 className="font-semibold text-left text-base">{action.title}</h3>
                  <p className="text-xs text-white/90 text-left mt-1 line-clamp-2">{action.description}</p>
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Categories - Improved scrollable pills */}
      <div className="px-safe mt-6">
        <div className="px-4">
          <div className="flex space-x-2 overflow-x-auto scrollbar-hide pb-2 scroll-smooth">
            {categories.map((category) => (
              <motion.button
                key={category.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => onNavigate(`explore?category=${category.id}`)}
                className="flex-shrink-0 bg-white rounded-xl px-4 py-3 shadow-md border border-gray-100 flex items-center space-x-2 hover:shadow-lg transition-shadow active:bg-gray-50"
              >
                <category.icon className={`w-5 h-5 ${category.color}`} strokeWidth={2} />
                <span className="text-sm font-semibold text-gray-700">{category.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Live Now Section - Enhanced cards */}
      {liveCreators.length > 0 && (
        <div className="px-safe mt-6">
          <div className="px-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <SparklesIcon className="w-5 h-5 mr-2 text-red-500" />
                Live Now
              </h2>
              <button 
                onClick={() => onNavigate('live')}
                className="text-sm text-purple-600 font-semibold hover:text-purple-700 flex items-center"
              >
                View All
                <ChevronRightIcon className="w-4 h-4 ml-0.5" />
              </button>
            </div>
            <div className="flex space-x-3 overflow-x-auto scrollbar-hide pb-2 scroll-smooth">
              {liveCreators.map((creator) => (
                <div key={creator.id} className="flex-shrink-0 w-44">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onCreatorSelect(creator)}
                    className="relative w-full"
                  >
                    <div className="relative shadow-lg rounded-xl overflow-hidden">
                      <img 
                        src={creator.profile_pic_url || '/default-avatar.png'}
                        alt={creator.username}
                        className="w-44 h-52 object-cover"
                      />
                      <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse shadow-md flex items-center">
                        <span className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></span>
                        LIVE
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3">
                        <p className="text-white font-semibold text-sm truncate">{creator.username}</p>
                        <p className="text-white/90 text-xs flex items-center">
                          <span className="mr-1">👁</span>
                          {creator.viewers || 0} watching
                        </p>
                      </div>
                    </div>
                  </motion.button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Following Section */}
      {followedCreators.length > 0 && (
        <div className="px-4 mt-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-800">Following</h2>
            <button 
              onClick={() => onNavigate('following')}
              className="text-sm text-purple-600 font-medium"
            >
              View All
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {followedCreators.slice(0, 4).map((creator) => (
              <div key={creator.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                <div className="flex items-center space-x-3">
                  <img 
                    src={creator.profile_pic_url || '/default-avatar.png'}
                    alt={creator.username}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{creator.username}</p>
                    <div className="flex items-center space-x-1">
                      {creator.is_online ? (
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      ) : (
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      )}
                      <p className="text-xs text-gray-500">
                        {creator.is_online ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2 mt-3">
                  <button
                    onClick={() => onStartVideoCall(creator)}
                    className="flex-1 bg-purple-100 text-purple-700 text-xs font-medium py-2 rounded-lg"
                  >
                    Video
                  </button>
                  <button
                    onClick={() => onCreatorSelect(creator)}
                    className="flex-1 bg-gray-100 text-gray-700 text-xs font-medium py-2 rounded-lg"
                  >
                    Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Featured Creators */}
      <div className="px-4 mt-6 mb-8">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Featured Creators</h2>
          <button 
            onClick={() => onNavigate('explore')}
            className="text-sm text-purple-600 font-medium"
          >
            Explore
          </button>
        </div>
        <div className="space-y-3">
          {featuredCreators.slice(0, 3).map((creator) => (
            <EnhancedCreatorCard
              key={creator.id}
              creator={creator}
              user={user}
              onSelect={() => onCreatorSelect(creator)}
              onStartVideoCall={() => onStartVideoCall(creator)}
              onStartVoiceCall={() => onStartVoiceCall(creator)}
              isMobile={true}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MobileFanDashboard;