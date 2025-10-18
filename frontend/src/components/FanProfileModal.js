import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  UserPlusIcon,
  VideoCameraIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  GiftIcon,
  SparklesIcon,
  ChartBarIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  HeartIcon,
  StarIcon,
  PhotoIcon,
  MicrophoneIcon,
  FilmIcon,
  BoltIcon,
  PencilSquareIcon,
  DocumentTextIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import Button from './ui/Button';
import { supabase } from '../utils/supabase-auth';

const FanProfileModal = ({ 
  isOpen, 
  onClose, 
  fanId,
  fanData = null,
  isCreatorView = true,
  creatorId = null 
}) => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [notes, setNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  // Mock data structure - replace with real API call
  const mockProfileData = {
    fan: {
      id: fanId,
      username: fanData?.username || 'johndoe',
      displayName: fanData?.displayName || 'John Doe',
      avatar: fanData?.avatar || null,
      tier: 'VIP',
      verified: true,
      location: 'Los Angeles, CA',
      bio: 'Love connecting with my favorite creators!'
    },
    stats: {
      spentWithYou: 8500,  // Only what they spent with this creator
      spentWithYouUSD: 425.00,  // USD equivalent
      firstInteraction: '2024-04-20',
      lastActive: '2 hours ago',
      totalInteractionsWithYou: 142,  // Only interactions with this creator
      averageSpentPerMonth: 1200,  // Average with this creator
      highestSpendMonth: 2500,  // Highest month with this creator
      currentMonthSpent: 950,  // Current month with this creator
      loyaltyRank: 'Top 10%'  // Their rank among your fans
    },
    notes: 'Prefers evening calls around 8 PM. Works in tech. Birthday in March. Loves discussing movies and gaming.',
    spending: {
      videoCalls: {
        count: 45,
        totalTokens: 8500,
        totalMinutes: 850,
        averagePerSession: 189
      },
      voiceCalls: {
        count: 32,
        totalTokens: 2400,
        totalMinutes: 480,
        averagePerSession: 75
      },
      messages: {
        text: { count: 156, totalTokens: 156 },
        images: { count: 45, totalTokens: 90 },
        audio: { count: 23, totalTokens: 69 },
        video: { count: 12, totalTokens: 60 }
      },
      tips: {
        count: 28,
        totalTokens: 3500,
        largest: 500,
        average: 125
      },
      gifts: {
        count: 15,
        totalTokens: 1275,
        favoriteGift: '💝'
      }
    },
    engagement: {
      favoriteInteractionTime: 'Evening (8-10 PM)',
      mostActiveDay: 'Saturday',
      loyaltyScore: 92
    },
  };

  useEffect(() => {
    if (isOpen && fanId) {
      fetchFanProfile();
    }
  }, [isOpen, fanId]);

  const fetchFanProfile = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setProfileData(mockProfileData);
    } catch (error) {
      console.error('Error fetching fan profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays} days ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''} ago`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} year${years > 1 ? 's' : ''} ago`;
    }
  };

  const calculateFollowDuration = (followDate) => {
    const start = new Date(followDate);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays} days`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(diffDays / 365);
      const remainingMonths = Math.floor((diffDays % 365) / 30);
      return `${years} year${years > 1 ? 's' : ''}${remainingMonths > 0 ? ` ${remainingMonths} mo` : ''}`;
    }
  };

  const getSpendingTrend = () => {
    const current = profileData?.stats.currentMonthSpent || 0;
    const average = profileData?.stats.averageSpentPerMonth || 0;
    const percentage = average > 0 ? ((current - average) / average * 100).toFixed(0) : 0;
    return {
      trending: current >= average,
      percentage: Math.abs(percentage)
    };
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'VIP': return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white';
      case 'Gold': return 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white';
      case 'Silver': return 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800';
      case 'Bronze': return 'bg-gradient-to-r from-orange-400 to-orange-600 text-white';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'video_call': return <VideoCameraIcon className="w-4 h-4" />;
      case 'voice_call': return <PhoneIcon className="w-4 h-4" />;
      case 'message': return <ChatBubbleLeftRightIcon className="w-4 h-4" />;
      case 'tip': return <CurrencyDollarIcon className="w-4 h-4" />;
      case 'gift': return <GiftIcon className="w-4 h-4" />;
      default: return <SparklesIcon className="w-4 h-4" />;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
        >
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : profileData && (
            <>
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-2xl">
                        {profileData.fan.displayName.charAt(0)}
                      </div>
                      {profileData.fan.verified && (
                        <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1">
                          <StarIconSolid className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold flex items-center gap-2">
                        {profileData.fan.displayName}
                        <span className={`text-xs px-2 py-1 rounded-full ${getTierColor(profileData.fan.tier)}`}>
                          {profileData.fan.tier}
                        </span>
                      </h2>
                      <p className="text-purple-100">@{profileData.fan.username}</p>
                      {profileData.fan.location && (
                        <p className="text-sm text-purple-200 mt-1">{profileData.fan.location}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Key Stats Bar */}
                <div className="grid grid-cols-4 gap-4 mt-6">
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CurrencyDollarIcon className="w-4 h-4" />
                      <p className="text-xs text-purple-100">Spent With You</p>
                    </div>
                    <p className="text-2xl font-bold">{profileData.stats.spentWithYou.toLocaleString()}</p>
                    <p className="text-xs text-purple-200">≈ ${profileData.stats.spentWithYouUSD}</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarIcon className="w-4 h-4" />
                      <p className="text-xs text-purple-100">First Interaction</p>
                    </div>
                    <p className="text-lg font-bold">{new Date(profileData.stats.firstInteraction).toLocaleDateString()}</p>
                    <p className="text-xs text-purple-200">{formatDate(profileData.stats.firstInteraction)}</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <UserPlusIcon className="w-4 h-4" />
                      <p className="text-xs text-purple-100">Your Fan Since</p>
                    </div>
                    <p className="text-lg font-bold">{calculateFollowDuration(profileData.stats.firstInteraction)}</p>
                    <p className="text-xs text-purple-200">{profileData.stats.loyaltyRank}</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <HeartIcon className="w-4 h-4" />
                      <p className="text-xs text-purple-100">Loyalty Score</p>
                    </div>
                    <p className="text-2xl font-bold">{profileData.engagement.loyaltyScore}%</p>
                    <div className="mt-1 h-1 bg-white/20 rounded-full">
                      <div 
                        className="h-1 bg-white rounded-full"
                        style={{ width: `${profileData.engagement.loyaltyScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 dark:border-gray-700">
                <div className="flex">
                  {['overview', 'spending', 'notes'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 px-6 py-3 text-sm font-medium capitalize transition-colors ${
                        activeTab === tab
                          ? 'text-purple-600 border-b-2 border-purple-600'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[500px]">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Spending Trend */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Monthly Spending</h3>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm ${
                          getSpendingTrend().trending 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          <ArrowTrendingUpIcon className="w-4 h-4" />
                          {getSpendingTrend().percentage}%
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">This Month</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-white">
                            {profileData.stats.currentMonthSpent.toLocaleString()} tokens
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Average</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-white">
                            {profileData.stats.averageSpentPerMonth.toLocaleString()} tokens
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Highest</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-white">
                            {profileData.stats.highestSpendMonth.toLocaleString()} tokens
                          </p>
                        </div>
                      </div>
                    </div>


                    {/* Preferences */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Preferences</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Favorite Time</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {profileData.engagement.favoriteInteractionTime}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Most Active Day</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {profileData.engagement.mostActiveDay}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Total Interactions</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {profileData.stats.totalInteractionsWithYou}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'spending' && (
                  <div className="space-y-6">
                    {/* Spending Breakdown */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Video Calls */}
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-3 mb-3">
                          <VideoCameraIcon className="w-5 h-5 text-blue-600" />
                          <h4 className="font-semibold text-gray-900 dark:text-white">Video Calls</h4>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
                            <span className="font-bold text-gray-900 dark:text-white">
                              {profileData.spending.videoCalls.totalTokens.toLocaleString()} tokens
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Sessions</span>
                            <span className="text-sm font-medium">{profileData.spending.videoCalls.count}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Total Time</span>
                            <span className="text-sm font-medium">{profileData.spending.videoCalls.totalMinutes} min</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Avg/Session</span>
                            <span className="text-sm font-medium">{profileData.spending.videoCalls.averagePerSession} tokens</span>
                          </div>
                        </div>
                      </div>

                      {/* Voice Calls */}
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-3 mb-3">
                          <PhoneIcon className="w-5 h-5 text-green-600" />
                          <h4 className="font-semibold text-gray-900 dark:text-white">Voice Calls</h4>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
                            <span className="font-bold text-gray-900 dark:text-white">
                              {profileData.spending.voiceCalls.totalTokens.toLocaleString()} tokens
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Sessions</span>
                            <span className="text-sm font-medium">{profileData.spending.voiceCalls.count}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Total Time</span>
                            <span className="text-sm font-medium">{profileData.spending.voiceCalls.totalMinutes} min</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Avg/Session</span>
                            <span className="text-sm font-medium">{profileData.spending.voiceCalls.averagePerSession} tokens</span>
                          </div>
                        </div>
                      </div>

                      {/* Messages */}
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-3 mb-3">
                          <ChatBubbleLeftRightIcon className="w-5 h-5 text-purple-600" />
                          <h4 className="font-semibold text-gray-900 dark:text-white">Messages</h4>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                              <ChatBubbleLeftRightIcon className="w-3 h-3" /> Text
                            </span>
                            <span className="text-sm font-medium">
                              {profileData.spending.messages.text.count} ({profileData.spending.messages.text.totalTokens} tokens)
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                              <PhotoIcon className="w-3 h-3" /> Images
                            </span>
                            <span className="text-sm font-medium">
                              {profileData.spending.messages.images.count} ({profileData.spending.messages.images.totalTokens} tokens)
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                              <MicrophoneIcon className="w-3 h-3" /> Audio
                            </span>
                            <span className="text-sm font-medium">
                              {profileData.spending.messages.audio.count} ({profileData.spending.messages.audio.totalTokens} tokens)
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                              <FilmIcon className="w-3 h-3" /> Video
                            </span>
                            <span className="text-sm font-medium">
                              {profileData.spending.messages.video.count} ({profileData.spending.messages.video.totalTokens} tokens)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tips & Gifts */}
                      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-center gap-3 mb-3">
                          <GiftIcon className="w-5 h-5 text-yellow-600" />
                          <h4 className="font-semibold text-gray-900 dark:text-white">Tips & Gifts</h4>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Total Tips</span>
                            <span className="font-bold text-gray-900 dark:text-white">
                              {profileData.spending.tips.totalTokens.toLocaleString()} tokens
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Tip Count</span>
                            <span className="text-sm font-medium">{profileData.spending.tips.count}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Largest Tip</span>
                            <span className="text-sm font-medium">{profileData.spending.tips.largest} tokens</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Gift Count</span>
                            <span className="text-sm font-medium">{profileData.spending.gifts.count}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}


                {activeTab === 'notes' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <DocumentTextIcon className="w-5 h-5 text-purple-600" />
                        Private Notes
                      </h3>
                      {!editingNotes ? (
                        <button
                          onClick={() => {
                            setEditingNotes(true);
                            setNotes(profileData.notes || '');
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                          Edit
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              setSavingNotes(true);
                              // Save notes to backend
                              try {
                                const { data: { session } } = await supabase.auth.getSession();
                                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/creators/fan-notes`, {
                                  method: 'POST',
                                  headers: {
                                    'Authorization': `Bearer ${session?.access_token}`,
                                    'Content-Type': 'application/json'
                                  },
                                  body: JSON.stringify({
                                    fanId,
                                    notes
                                  })
                                });
                                
                                if (response.ok) {
                                  setProfileData(prev => ({ ...prev, notes }));
                                  setEditingNotes(false);
                                }
                              } catch (error) {
                                console.error('Error saving notes:', error);
                              } finally {
                                setSavingNotes(false);
                              }
                            }}
                            disabled={savingNotes}
                            className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                          >
                            {savingNotes ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => {
                              setEditingNotes(false);
                              setNotes(profileData.notes || '');
                            }}
                            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                      <p className="text-xs text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                        <InformationCircleIcon className="w-4 h-4" />
                        These notes are private and only visible to you
                      </p>
                    </div>

                    {editingNotes ? (
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes about this fan... (e.g., preferences, important dates, conversation topics, etc.)"
                        className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                        rows={8}
                      />
                    ) : (
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg min-h-[200px]">
                        {profileData.notes ? (
                          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{profileData.notes}</p>
                        ) : (
                          <p className="text-gray-500 dark:text-gray-400 italic">
                            No notes yet. Click Edit to add notes about this fan.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Quick Note Templates */}
                    {editingNotes && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick Add:</p>
                        <div className="flex flex-wrap gap-2">
                          {[
                            'Prefers video calls',
                            'Prefers voice calls',
                            'Evening availability',
                            'Morning availability',
                            'VIP customer',
                            'Birthday: ',
                            'Works in: ',
                            'Interests: '
                          ].map(template => (
                            <button
                              key={template}
                              onClick={() => {
                                setNotes(prev => prev + (prev ? '\n' : '') + template);
                              }}
                              className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                              {template}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<ChatBubbleLeftRightIcon className="w-4 h-4" />}
                      onClick={() => {
                        // Navigate to messages with this fan
                        onClose();
                      }}
                    >
                      Message
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<VideoCameraIcon className="w-4 h-4" />}
                      onClick={() => {
                        // Start video call
                        onClose();
                      }}
                    >
                      Video Call
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FanProfileModal;