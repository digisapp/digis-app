import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CurrencyDollarIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  EyeIcon,
  VideoCameraIcon,
  PhoneIcon,
  SignalIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  SparklesIcon,
  TrophyIcon,
  ChartBarIcon,
  GiftIcon,
  FolderIcon
} from '@heroicons/react/24/outline';
import { 
  VideoCameraIcon as VideoCameraIconSolid,
  PhoneIcon as PhoneIconSolid
} from '@heroicons/react/24/solid';
import { getAuthToken } from '../utils/auth-helpers';

const CreatorToolsQuickAccess = ({ user, onShowAvailability, onShowGoLive, onShowOffers, onShowContent, tokenBalance, sessionStats, onShowEarnings }) => {
  const [quickStats, setQuickStats] = useState({
    todayEarnings: 0,
    pendingSessions: 0,
    unreadMessages: 0,
    liveViewers: 0
  });
  const [recentFans, setRecentFans] = useState([]);
  const [upcomingSchedule, setUpcomingSchedule] = useState([]);
  const [servicePricing, setServicePricing] = useState({
    streamPrice: 5,
    videoPrice: 8,
    voicePrice: 6,
    textMessagePrice: 1
  });
  const [savingPrices, setSavingPrices] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCreatorData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCreatorData = async () => {
    try {
      setLoading(true);
      // const authToken = await getAuthToken();
      
      // In a real app, these would be separate API calls
      // For now, using mock data
      setQuickStats({
        todayEarnings: 245,
        pendingSessions: 3,
        unreadMessages: 12,
        liveViewers: 0
      });

      setRecentFans([
        {
          id: 1,
          username: 'SuperFan123',
          displayName: 'Alice',
          avatar: null,
          totalSpent: 2450,
          lastTip: 100,
          lastInteraction: new Date(Date.now() - 3600000), // 1 hour ago
          isVip: true
        },
        {
          id: 2,
          username: 'MusicLover',
          displayName: 'Bob',
          avatar: null,
          totalSpent: 1890,
          lastTip: 50,
          lastInteraction: new Date(Date.now() - 7200000), // 2 hours ago
          isVip: false
        },
        {
          id: 3,
          username: 'ArtEnthusiast',
          displayName: 'Carol',
          avatar: null,
          totalSpent: 1670,
          lastTip: 75,
          lastInteraction: new Date(Date.now() - 86400000), // 1 day ago
          isVip: true
        }
      ]);

      setUpcomingSchedule([
        {
          id: 1,
          type: 'video_call',
          fan: 'SuperFan123',
          fanName: 'Alice',
          scheduledFor: new Date(Date.now() + 3600000), // 1 hour from now
          duration: 30,
          price: 45,
          notes: 'Gaming strategy session'
        },
        {
          id: 2,
          type: 'live_stream',
          title: 'Evening Art Stream',
          scheduledFor: new Date(Date.now() + 7200000), // 2 hours from now
          estimatedDuration: 120,
          category: 'Art'
        }
      ]);

      // Load creator's pricing from profile
      loadCreatorPricing();

      setServicePricing([
        {
          id: 1,
          type: 'image',
          title: 'Profile Banner',
          url: null,
          uploadedAt: new Date(Date.now() - 86400000),
          views: 1205
        },
        {
          id: 2,
          type: 'video',
          title: 'Intro Video',
          url: null,
          uploadedAt: new Date(Date.now() - 86400000 * 3),
          views: 892
        }
      ]);
    } catch (error) {
      console.error('Error fetching creator data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeUntil = (date) => {
    const now = new Date();
    const diff = date - now;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };


  const loadCreatorPricing = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/users/profile?uid=${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setServicePricing({
          streamPrice: data.stream_price || 5,
          videoPrice: data.video_price || 8,
          voicePrice: data.voice_price || 6,
          textMessagePrice: data.text_message_price || 1
        });
      }
    } catch (error) {
      console.error('Error loading pricing:', error);
    }
  };

  const handleSavePricing = async () => {
    setSavingPrices(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          uid: user.id,
          stream_price: parseFloat(servicePricing.streamPrice),
          video_price: parseFloat(servicePricing.videoPrice),
          voice_price: parseFloat(servicePricing.voicePrice),
          text_message_price: parseFloat(servicePricing.textMessagePrice)
        })
      });

      if (response.ok) {
        // Show success feedback
        const successEl = document.getElementById('pricing-success');
        if (successEl) {
          successEl.classList.remove('hidden');
          setTimeout(() => successEl.classList.add('hidden'), 3000);
        }
      } else {
        console.error('Failed to save pricing');
      }
    } catch (error) {
      console.error('Error saving pricing:', error);
    } finally {
      setSavingPrices(false);
    }
  };


  const StatCard = ({ title, value, change, icon: Icon, gradient, onClick, sparkle = false }) => (
    <motion.div 
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={onClick ? { scale: 0.98 } : {}}
      className={`relative overflow-hidden bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 ${onClick ? 'cursor-pointer' : ''} group`}
      onClick={onClick}
    >
      {/* Background gradient effect */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5 group-hover:opacity-10 transition-opacity`} />
      
      {/* Sparkle effect */}
      {sparkle && (
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-2 right-2"
        >
          <SparklesIcon className="w-5 h-5 text-yellow-500" />
        </motion.div>
      )}
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          {change !== undefined && (
            <div className={`flex items-center gap-1 text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? <ArrowTrendingUpIcon className="w-4 h-4" /> : <ArrowTrendingDownIcon className="w-4 h-4" />}
              {Math.abs(change)}%
            </div>
          )}
        </div>
        <p className="text-sm text-gray-600 font-medium mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
      </div>
    </motion.div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 rounded-full border-4 border-gray-200 border-t-purple-600"
        />
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 text-gray-600 font-medium"
        >
          Loading your dashboard...
        </motion.p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Creator Dashboard</h1>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onShowGoLive}
          className="group relative overflow-hidden px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center gap-2">
            <SignalIcon className="w-5 h-5" />
            <span>Go Live</span>
          </div>
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute top-2 right-2 w-2 h-2 bg-white rounded-full"
          />
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onShowOffers || (() => console.log('Offers clicked'))}
          className="group relative overflow-hidden px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center gap-2">
            <GiftIcon className="w-5 h-5" />
            <span>Offers</span>
          </div>
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onShowContent || (() => console.log('Content clicked'))}
          className="group relative overflow-hidden px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center gap-2">
            <FolderIcon className="w-5 h-5" />
            <span>Content</span>
          </div>
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onShowAvailability}
          className="group relative overflow-hidden px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="w-5 h-5" />
            <span>Schedule</span>
          </div>
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onShowEarnings || (() => window.location.href = '/wallet')}
          className="group relative overflow-hidden px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5" />
            <span>Wallet</span>
          </div>
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
        </motion.button>
      </div>

      {/* Quick Stats */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
      >
        <StatCard
          title="Today's Earnings"
          value={`${quickStats.todayEarnings} tokens`}
          change={15}
          icon={CurrencyDollarIcon}
          gradient="from-emerald-500 to-green-600"
          onClick={onShowEarnings || (() => window.location.href = '/wallet')}
          sparkle={true}
        />
        <StatCard
          title="Pending Sessions"
          value={quickStats.pendingSessions}
          icon={CalendarDaysIcon}
          gradient="from-blue-500 to-indigo-600"
          onClick={() => {
            document.getElementById('upcoming-schedule')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        <StatCard
          title="Unread Messages"
          value={quickStats.unreadMessages}
          icon={ChatBubbleLeftRightIcon}
          gradient="from-purple-500 to-pink-600"
        />
        <StatCard
          title="Live Viewers"
          value={quickStats.liveViewers}
          icon={EyeIcon}
          gradient="from-red-500 to-rose-600"
        />
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Top Supporters */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrophyIcon className="w-6 h-6 text-yellow-500" />
              Top Gifters
            </h3>
            <span className="text-sm text-gray-500">This month</span>
          </div>
          <div className="space-y-4">
            {recentFans.map((fan, index) => (
              <motion.div 
                key={fan.id} 
                whileHover={{ x: 4 }}
                className="relative flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
              >
                {/* Rank Badge */}
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-md
                  ${index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white' :
                    index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                    index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' :
                    'bg-gray-200 text-gray-700'}
                `}>
                  {index + 1}
                </div>
                
                {/* Avatar */}
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                    {fan.displayName.charAt(0)}
                  </div>
                  {fan.isVip && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                      <SparklesIcon className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                
                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{fan.displayName}</span>
                    <span className="text-sm text-gray-500">@{fan.username}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-600">
                      <span className="font-medium text-gray-900">{fan.totalSpent}</span> tokens
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600">
                      Last tip: <span className="font-medium text-green-600">{fan.lastTip}</span>
                    </span>
                  </div>
                </div>
                
                {/* Time */}
                <div className="text-xs text-gray-500">
                  {formatTimeAgo(fan.lastInteraction)}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Upcoming Schedule */}
        <motion.div 
          id="upcoming-schedule"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <CalendarDaysIcon className="w-6 h-6 text-blue-500" />
              Upcoming Schedule
            </h3>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onShowAvailability}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Manage
            </motion.button>
          </div>
          
          <div className="space-y-4">
            {upcomingSchedule.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <CalendarDaysIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No upcoming sessions scheduled</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onShowAvailability}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Set Your Availability
                </motion.button>
              </motion.div>
            ) : (
              <AnimatePresence>
                {upcomingSchedule.map((session, index) => (
                  <motion.div 
                    key={session.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                    className="relative overflow-hidden bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 cursor-pointer group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 opacity-0 group-hover:opacity-5 transition-opacity" />
                    
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-3">
                        {/* Icon */}
                        <div className={`
                          w-12 h-12 rounded-xl flex items-center justify-center shadow-md
                          ${session.type === 'video_call' ? 'bg-gradient-to-br from-purple-500 to-purple-600' :
                            session.type === 'voice_call' ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
                            'bg-gradient-to-br from-red-500 to-pink-600'}
                        `}>
                          {session.type === 'video_call' ? 
                            <VideoCameraIconSolid className="w-6 h-6 text-white" /> :
                            session.type === 'voice_call' ? 
                            <PhoneIconSolid className="w-6 h-6 text-white" /> :
                            <SignalIcon className="w-6 h-6 text-white" />
                          }
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">
                            {session.type === 'live_stream' ? session.title : `${session.fanName}`}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <ClockIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              In {formatTimeUntil(session.scheduledFor)}
                            </span>
                          </div>
                          {session.notes && (
                            <p className="text-sm text-gray-500 mt-2 italic">"{session.notes}"</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Price & Duration */}
                      <div className="text-right">
                        {session.price && (
                          <div className="text-lg font-bold text-gray-900">
                            {session.price * (session.duration || 30)}
                            <span className="text-sm font-normal text-gray-600"> tokens</span>
                          </div>
                        )}
                        <div className="text-sm text-gray-500 mt-1">
                          {session.duration || session.estimatedDuration} minutes
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.div>

      </div>

      {/* Service Pricing Preview */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CurrencyDollarIcon className="w-6 h-6 text-purple-500" />
            Service Pricing
          </h3>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSavePricing}
            disabled={savingPrices}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CurrencyDollarIcon className="w-4 h-4" />
            {savingPrices ? 'Saving...' : 'Save Prices'}
          </motion.button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Live Stream Pricing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-br from-red-50 to-pink-50 p-4 rounded-xl border border-red-100"
          >
            <div className="flex items-center gap-2 mb-3">
              <SignalIcon className="w-5 h-5 text-red-600" />
              <h4 className="font-semibold text-gray-900">Live Stream</h4>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-500">$</span>
              <input
                type="number"
                value={servicePricing.streamPrice}
                onChange={(e) => setServicePricing({...servicePricing, streamPrice: e.target.value})}
                min="0.01"
                step="0.01"
                className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">Per minute rate</p>
          </motion.div>

          {/* Video Call Pricing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-xl border border-blue-100"
          >
            <div className="flex items-center gap-2 mb-3">
              <VideoCameraIcon className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-gray-900">Video Call</h4>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-500">$</span>
              <input
                type="number"
                value={servicePricing.videoPrice}
                onChange={(e) => setServicePricing({...servicePricing, videoPrice: e.target.value})}
                min="0.01"
                step="0.01"
                className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">Per minute rate</p>
          </motion.div>

          {/* Voice Call Pricing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-100"
          >
            <div className="flex items-center gap-2 mb-3">
              <PhoneIcon className="w-5 h-5 text-green-600" />
              <h4 className="font-semibold text-gray-900">Voice Call</h4>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-500">$</span>
              <input
                type="number"
                value={servicePricing.voicePrice}
                onChange={(e) => setServicePricing({...servicePricing, voicePrice: e.target.value})}
                min="0.01"
                step="0.01"
                className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">Per minute rate</p>
          </motion.div>

          {/* Text Message Pricing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="bg-gradient-to-br from-purple-50 to-indigo-50 p-4 rounded-xl border border-purple-100"
          >
            <div className="flex items-center gap-2 mb-3">
              <ChatBubbleLeftRightIcon className="w-5 h-5 text-purple-600" />
              <h4 className="font-semibold text-gray-900">Text Message</h4>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-500">$</span>
              <input
                type="number"
                value={servicePricing.textMessagePrice}
                onChange={(e) => setServicePricing({...servicePricing, textMessagePrice: e.target.value})}
                min="0.01"
                step="0.01"
                className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">Per message</p>
          </motion.div>
        </div>
        
        {/* Success Message */}
        <div id="pricing-success" className="hidden mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700 font-medium flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Pricing updated successfully!
          </p>
        </div>
      </motion.div>

    </div>
  );
};

export default CreatorToolsQuickAccess;