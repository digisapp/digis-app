import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HeartIcon,
  StarIcon,
  TrophyIcon,
  FireIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  ClockIcon,
  PhoneIcon,
  VideoCameraIcon,
  ChatBubbleLeftRightIcon,
  GiftIcon,
  SparklesIcon,
  ChartBarIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartIconSolid,
  StarIcon as StarIconSolid,
  TrophyIcon as TrophyIconSolid,
  FireIcon as FireIconSolid
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const FanEngagementSystem = ({ user, isCreator = false, targetCreatorId = null }) => {
  const [engagementData, setEngagementData] = useState({
    loyaltyTier: 'newcomer',
    totalSpent: 0,
    totalSessions: 0,
    totalMinutes: 0,
    streakDays: 0,
    lastInteraction: null,
    joinedDate: null,
    favoriteSessionType: 'video',
    averageSessionDuration: 0,
    totalTips: 0,
    badgesEarned: [],
    levelProgress: 0
  });

  const [topFans, setTopFans] = useState([]);
  const [fanStats, setFanStats] = useState([]);
  const [loyaltyRewards, setLoyaltyRewards] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Loyalty tier definitions
  const LOYALTY_TIERS = {
    newcomer: {
      name: 'Newcomer',
      icon: '👋',
      color: 'gray',
      minSpent: 0,
      benefits: ['Basic chat access', 'Standard support'],
      nextTier: 'regular'
    },
    regular: {
      name: 'Regular',
      icon: '⭐',
      color: 'blue',
      minSpent: 50,
      benefits: ['Priority chat', 'Profile badge', '5% discount on calls'],
      nextTier: 'vip'
    },
    vip: {
      name: 'VIP',
      icon: '💎',
      color: 'purple',
      minSpent: 200,
      benefits: ['Skip call queue', 'Exclusive content', '10% discount', 'VIP badge'],
      nextTier: 'legend'
    },
    legend: {
      name: 'Legend',
      icon: '👑',
      color: 'yellow',
      minSpent: 500,
      benefits: ['Guaranteed calls', 'Personal messages', '15% discount', 'Legend status'],
      nextTier: null
    }
  };

  // Badge definitions
  const BADGES = {
    first_call: { name: 'First Call', icon: '🎯', description: 'Completed your first call' },
    early_bird: { name: 'Early Bird', icon: '🌅', description: 'Called before 8 AM' },
    night_owl: { name: 'Night Owl', icon: '🦉', description: 'Called after 10 PM' },
    generous_tipper: { name: 'Generous Tipper', icon: '💰', description: 'Tipped over $50' },
    loyal_fan: { name: 'Loyal Fan', icon: '❤️', description: '30-day streak' },
    marathon_caller: { name: 'Marathon Caller', icon: '🏃', description: '2+ hour session' },
    regular_supporter: { name: 'Regular Supporter', icon: '🤝', description: '10+ calls in a month' },
    big_spender: { name: 'Big Spender', icon: '💎', description: 'Spent over $500' }
  };

  // Fetch engagement data
  const fetchEngagementData = useCallback(async () => {
    if (!user) return;

    try {
      const endpoint = isCreator 
        ? `/api/users/fan-engagement-overview`
        : `/api/users/fan-engagement${targetCreatorId ? `/${targetCreatorId}` : ''}`;
        
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        if (isCreator) {
          setTopFans(data.topFans || []);
          setFanStats(data.fanStats || []);
        } else {
          setEngagementData(data.engagement || {});
          setLoyaltyRewards(data.rewards || []);
          setAchievements(data.achievements || []);
        }
      }
    } catch (error) {
      console.error('Error fetching engagement data:', error);
      toast.error('Failed to load engagement data');
    } finally {
      setLoading(false);
    }
  }, [user, isCreator, targetCreatorId]);

  // Initialize
  useEffect(() => {
    if (user) {
      fetchEngagementData();
    }
  }, [user, fetchEngagementData]);

  // Calculate progress to next tier
  const calculateTierProgress = () => {
    const currentTier = LOYALTY_TIERS[engagementData.loyaltyTier];
    if (!currentTier.nextTier) return 100;
    
    const nextTier = LOYALTY_TIERS[currentTier.nextTier];
    const progress = ((engagementData.totalSpent - currentTier.minSpent) / (nextTier.minSpent - currentTier.minSpent)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  // Get tier color
  const getTierColor = (tier) => {
    return LOYALTY_TIERS[tier]?.color || 'gray';
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Format time duration
  const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const TierCard = ({ tier, isCurrentTier = false }) => {
    const tierInfo = LOYALTY_TIERS[tier];
    const color = tierInfo.color;
    
    return (
      <motion.div
        className={`p-4 rounded-xl border-2 transition-all ${
          isCurrentTier 
            ? `border-${color}-500 bg-${color}-50` 
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
        whileHover={{ scale: isCurrentTier ? 1 : 1.02 }}
      >
        <div className="text-center mb-3">
          <div className="text-3xl mb-2">{tierInfo.icon}</div>
          <h3 className={`font-semibold text-${isCurrentTier ? color + '-900' : 'gray-900'}`}>
            {tierInfo.name}
          </h3>
          <p className="text-sm text-gray-600">
            {formatCurrency(tierInfo.minSpent)}+ spent
          </p>
        </div>
        
        <div className="space-y-2">
          {tierInfo.benefits.map((benefit, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className={`w-1.5 h-1.5 rounded-full bg-${color}-500`} />
              <span className="text-gray-700">{benefit}</span>
            </div>
          ))}
        </div>
        
        {isCurrentTier && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Progress to {LOYALTY_TIERS[tierInfo.nextTier]?.name || 'Max Level'}</span>
              <span>{Math.round(calculateTierProgress())}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`bg-${color}-500 h-2 rounded-full transition-all duration-300`}
                style={{ width: `${calculateTierProgress()}%` }}
              />
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  const StatCard = ({ icon: Icon, title, value, subtitle, color = 'blue' }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center gap-4">
        <div className={`p-3 bg-${color}-100 rounded-full`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm font-medium text-gray-700">{title}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  );

  const BadgeCard = ({ badge, earned = false }) => (
    <motion.div
      className={`p-4 rounded-xl border-2 text-center transition-all ${
        earned 
          ? 'border-yellow-300 bg-yellow-50' 
          : 'border-gray-200 bg-gray-50'
      }`}
      whileHover={{ scale: earned ? 1.05 : 1 }}
    >
      <div className={`text-2xl mb-2 ${earned ? '' : 'grayscale opacity-50'}`}>
        {badge.icon}
      </div>
      <h4 className={`text-sm font-medium ${earned ? 'text-yellow-900' : 'text-gray-500'}`}>
        {badge.name}
      </h4>
      <p className={`text-xs mt-1 ${earned ? 'text-yellow-700' : 'text-gray-400'}`}>
        {badge.description}
      </p>
    </motion.div>
  );

  const FanCard = ({ fan, rank }) => (
    <div className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
          rank === 1 ? 'bg-yellow-500' : 
          rank === 2 ? 'bg-gray-400' : 
          rank === 3 ? 'bg-amber-600' : 'bg-blue-500'
        }`}>
          {rank <= 3 ? (rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉') : rank}
        </div>
        
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
          {fan.profilePicUrl ? (
            <img
              src={fan.profilePicUrl}
              alt={fan.username}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            fan.username?.charAt(0)?.toUpperCase() || 'F'
          )}
        </div>
      </div>
      
      <div className="flex-1">
        <h4 className="font-semibold text-gray-900">@{fan.username}</h4>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <CurrencyDollarIcon className="w-4 h-4" />
            {formatCurrency(fan.totalSpent)}
          </span>
          <span className="flex items-center gap-1">
            <PhoneIcon className="w-4 h-4" />
            {fan.totalCalls} calls
          </span>
          <span className="flex items-center gap-1">
            <ClockIcon className="w-4 h-4" />
            {formatDuration(fan.totalMinutes)}
          </span>
        </div>
      </div>
      
      <div className="text-right">
        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-${getTierColor(fan.loyaltyTier)}-100 text-${getTierColor(fan.loyaltyTier)}-800`}>
          {LOYALTY_TIERS[fan.loyaltyTier]?.icon}
          {LOYALTY_TIERS[fan.loyaltyTier]?.name}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading engagement data...</p>
        </div>
      </div>
    );
  }

  // Creator view - shows top fans and analytics
  if (isCreator) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <UserGroupIcon className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Fan Engagement</h2>
            <p className="text-gray-600">Track your biggest supporters and fan loyalty</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={HeartIcon}
            title="Total Fans"
            value={fanStats.totalFans || 0}
            color="pink"
          />
          <StatCard
            icon={TrophyIcon}
            title="VIP+ Fans"
            value={fanStats.vipFans || 0}
            color="purple"
          />
          <StatCard
            icon={CurrencyDollarIcon}
            title="Avg. Spend"
            value={formatCurrency(fanStats.averageSpend || 0)}
            color="green"
          />
          <StatCard
            icon={FireIcon}
            title="Active Streaks"
            value={fanStats.activeStreaks || 0}
            color="red"
          />
        </div>

        {/* Top Fans */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">
            Top Supporters ({topFans.length})
          </h3>
          
          {topFans.length > 0 ? (
            <div className="space-y-4">
              {topFans.map((fan, index) => (
                <FanCard key={fan.id} fan={fan} rank={index + 1} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <UserGroupIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No fan data available yet</p>
              <p className="text-sm text-gray-500">Complete some sessions to see your top supporters</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fan view - shows personal engagement stats
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
          {LOYALTY_TIERS[engagementData.loyaltyTier]?.icon}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {LOYALTY_TIERS[engagementData.loyaltyTier]?.name} Status
        </h2>
        <p className="text-gray-600">
          You've spent {formatCurrency(engagementData.totalSpent)} and earned {engagementData.badgesEarned?.length || 0} badges
        </p>
      </div>

      {/* Current Tier Progress */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Loyalty Progress</h3>
        <TierCard tier={engagementData.loyaltyTier} isCurrentTier={true} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={CurrencyDollarIcon}
          title="Total Spent"
          value={formatCurrency(engagementData.totalSpent)}
          color="green"
        />
        <StatCard
          icon={PhoneIcon}
          title="Total Sessions"
          value={engagementData.totalSessions}
          subtitle={`${formatDuration(engagementData.totalMinutes)} total`}
          color="blue"
        />
        <StatCard
          icon={FireIcon}
          title="Current Streak"
          value={`${engagementData.streakDays} days`}
          color="red"
        />
        <StatCard
          icon={GiftIcon}
          title="Tips Given"
          value={formatCurrency(engagementData.totalTips)}
          color="yellow"
        />
      </div>

      {/* Loyalty Tiers */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Loyalty Tiers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.keys(LOYALTY_TIERS).map(tier => (
            <TierCard 
              key={tier} 
              tier={tier} 
              isCurrentTier={tier === engagementData.loyaltyTier} 
            />
          ))}
        </div>
      </div>

      {/* Achievements/Badges */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          Achievements ({engagementData.badgesEarned?.length || 0}/{Object.keys(BADGES).length})
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(BADGES).map(([badgeKey, badge]) => (
            <BadgeCard 
              key={badgeKey} 
              badge={badge} 
              earned={engagementData.badgesEarned?.includes(badgeKey)} 
            />
          ))}
        </div>
      </div>

      {/* Engagement History */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Your Activity</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-2xl text-blue-600 mb-2">📅</div>
            <p className="text-sm text-gray-600">Member Since</p>
            <p className="font-medium">
              {engagementData.joinedDate 
                ? new Date(engagementData.joinedDate).toLocaleDateString() 
                : 'Recently'
              }
            </p>
          </div>
          
          <div>
            <div className="text-2xl text-purple-600 mb-2">
              {engagementData.favoriteSessionType === 'video' ? '📹' : '🎙️'}
            </div>
            <p className="text-sm text-gray-600">Favorite Type</p>
            <p className="font-medium capitalize">{engagementData.favoriteSessionType} calls</p>
          </div>
          
          <div>
            <div className="text-2xl text-green-600 mb-2">⏱️</div>
            <p className="text-sm text-gray-600">Avg. Session</p>
            <p className="font-medium">{formatDuration(engagementData.averageSessionDuration)}</p>
          </div>
        </div>
      </div>

      {/* Loyalty Rewards */}
      {loyaltyRewards.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Available Rewards</h3>
          <div className="space-y-3">
            {loyaltyRewards.map(reward => (
              <div key={reward.id} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div>
                  <h4 className="font-medium text-yellow-900">{reward.title}</h4>
                  <p className="text-sm text-yellow-700">{reward.description}</p>
                </div>
                <button className="px-3 py-1 bg-yellow-600 text-white text-sm rounded-full hover:bg-yellow-700 transition-colors">
                  Claim
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FanEngagementSystem;