import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAuthToken } from '../utils/auth-helpers';

const EnhancedLeaderboards = ({ user, className = '' }) => {
  const [leaderboards, setLeaderboards] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('supporters');
  const [selectedPeriod, setSelectedPeriod] = useState('weekly');
  const [userRank, setUserRank] = useState(null);

  const categories = {
    supporters: {
      title: 'Top Supporters',
      description: 'Users who tip the most',
      icon: '💰',
      color: 'from-yellow-500 to-orange-500'
    },
    chatters: {
      title: 'Most Active Chatters',
      description: 'Users who chat the most in streams',
      icon: '💬',
      color: 'from-blue-500 to-purple-500'
    },
    streamers: {
      title: 'Top Streamers',
      description: 'Creators with most viewers',
      icon: '🎥',
      color: 'from-purple-500 to-pink-500'
    },
    discoverers: {
      title: 'Creator Discoverers',
      description: 'Users who find new creators',
      icon: '🔍',
      color: 'from-green-500 to-teal-500'
    },
    streakers: {
      title: 'Login Streaks',
      description: 'Longest login streaks',
      icon: '🔥',
      color: 'from-red-500 to-orange-500'
    },
    badges: {
      title: 'Badge Collectors',
      description: 'Most badges earned',
      icon: '🏆',
      color: 'from-indigo-500 to-purple-500'
    }
  };

  const periods = {
    daily: { label: 'Today', icon: '📅' },
    weekly: { label: 'This Week', icon: '📊' },
    monthly: { label: 'This Month', icon: '🗓️' },
    allTime: { label: 'All Time', icon: '⭐' }
  };

  useEffect(() => {
    if (user) {
      fetchLeaderboards();
    }
  }, [user, selectedCategory, selectedPeriod]);

  const fetchLeaderboards = async () => {
    try {
      setLoading(true);
      
      // Fetch different leaderboards based on category
      const endpoints = {
        supporters: '/api/users/leaderboard/supporters',
        chatters: '/api/users/leaderboard/chatters',
        streamers: '/api/users/leaderboard/streamers',
        discoverers: '/api/users/leaderboard/discoverers',
        streakers: '/api/users/leaderboard/streaks',
        badges: '/api/badges/leaderboard'
      };

      const response = await fetch(
        `${endpoints[selectedCategory]}?period=${selectedPeriod}&limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setLeaderboards(prev => ({
          ...prev,
          [`${selectedCategory}_${selectedPeriod}`]: data.leaderboard || data.users || []
        }));

        // Find user's rank
        const userPosition = data.leaderboard?.findIndex(
          entry => entry.userId === user.id || entry.supabase_id === user.id
        );
        setUserRank(userPosition >= 0 ? userPosition + 1 : null);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboards:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLeaderboard = () => {
    return leaderboards[`${selectedCategory}_${selectedPeriod}`] || [];
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return '🏅';
    }
  };

  const formatValue = (entry, category) => {
    switch (category) {
      case 'supporters':
        return `${(entry.totalTipped || entry.tokensEarned || 0).toLocaleString()} tokens`;
      case 'chatters':
        return `${(entry.messageCount || entry.messagesCount || 0).toLocaleString()} messages`;
      case 'streamers':
        return `${(entry.totalViewers || entry.viewers || 0).toLocaleString()} viewers`;
      case 'discoverers':
        return `${(entry.creatorsFound || entry.discoveries || 0)} creators`;
      case 'streakers':
        return `${entry.currentStreak || entry.streak || 0} days`;
      case 'badges':
        return `${entry.badgeCount || entry.totalPoints || 0} ${entry.badgeCount ? 'badges' : 'points'}`;
      default:
        return '0';
    }
  };

  const getSecondaryValue = (entry, category) => {
    switch (category) {
      case 'supporters':
        return `${entry.sessionsCount || 0} sessions`;
      case 'chatters':
        return `${entry.uniqueStreams || 0} streams`;
      case 'streamers':
        return `${entry.hoursStreamed || 0}h streamed`;
      case 'discoverers':
        return `${entry.referrals || 0} referrals`;
      case 'streakers':
        return `${entry.totalLogins || 0} total logins`;
      case 'badges':
        return `${entry.recentBadges?.length || 0} recent`;
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                  <div className="h-3 bg-gray-100 rounded w-24"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded w-20"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const currentLeaderboard = getCurrentLeaderboard();

  return (
    <div className={`bg-white rounded-xl shadow-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${categories[selectedCategory].color} p-6 text-white`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="text-3xl">{categories[selectedCategory].icon}</div>
          <div>
            <h2 className="text-2xl font-bold">{categories[selectedCategory].title}</h2>
            <p className="text-white/80">{categories[selectedCategory].description}</p>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {Object.entries(categories).map(([key, category]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === key
                  ? 'bg-white text-gray-900 shadow-md'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              <span>{category.icon}</span>
              <span className="hidden sm:inline">{category.title}</span>
            </button>
          ))}
        </div>

        {/* Period Tabs */}
        <div className="flex bg-white/10 rounded-lg p-1">
          {Object.entries(periods).map(([key, period]) => (
            <button
              key={key}
              onClick={() => setSelectedPeriod(key)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                selectedPeriod === key
                  ? 'bg-white text-gray-900 shadow-md'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>{period.icon}</span>
              <span className="hidden sm:inline">{period.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* User's Rank (if not in top 10) */}
      {userRank && userRank > 10 && (
        <div className="bg-blue-50 border-b border-blue-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
              #{userRank}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-900">Your Rank</div>
              <div className="text-xs text-blue-600">
                You're #{userRank} in {categories[selectedCategory].title.toLowerCase()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard List */}
      <div className="p-6">
        {currentLeaderboard.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-4">🏆</div>
            <div>No data available for this leaderboard</div>
            <div className="text-sm mt-2">Check back later or try a different period!</div>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="wait">
              {currentLeaderboard.map((entry, index) => {
                const rank = index + 1;
                const isCurrentUser = entry.userId === user.id || entry.supabase_id === user.id;
                
                return (
                  <motion.div
                    key={`${entry.userId || entry.supabase_id}-${selectedCategory}-${selectedPeriod}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                      isCurrentUser
                        ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 shadow-md'
                        : rank <= 3
                        ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200'
                        : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {/* Rank */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                      rank === 1
                        ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white shadow-lg'
                        : rank === 2
                        ? 'bg-gradient-to-r from-gray-300 to-gray-500 text-white shadow-lg'
                        : rank === 3
                        ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white shadow-lg'
                        : isCurrentUser
                        ? 'bg-gradient-to-r from-blue-400 to-purple-500 text-white'
                        : 'bg-white text-gray-600 border-2 border-gray-200'
                    }`}>
                      {rank <= 3 ? getRankIcon(rank) : `#${rank}`}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {entry.profilePic || entry.profile_pic_url ? (
                          <img
                            src={entry.profilePic || entry.profile_pic_url}
                            alt={entry.username || entry.displayName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 text-sm font-medium">
                            {(entry.username || entry.displayName || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="font-semibold text-gray-900 truncate">
                          {entry.username || entry.displayName || 'Anonymous'}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              You
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        {getSecondaryValue(entry, selectedCategory)}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-right">
                      <div className="font-bold text-lg text-gray-900">
                        {formatValue(entry, selectedCategory)}
                      </div>
                      {entry.recentBadges && entry.recentBadges.length > 0 && (
                        <div className="flex gap-1 mt-1 justify-end">
                          {entry.recentBadges.slice(0, 3).map((badge, i) => (
                            <span key={i} className="text-lg" title={badge.name}>
                              {badge.icon}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Special Effects for Top 3 */}
                    {rank <= 3 && (
                      <motion.div
                        className="absolute inset-0 pointer-events-none"
                        animate={{
                          background: [
                            'radial-gradient(circle at 0% 0%, rgba(255,215,0,0.1) 0%, transparent 50%)',
                            'radial-gradient(circle at 100% 100%, rgba(255,215,0,0.1) 0%, transparent 50%)',
                            'radial-gradient(circle at 0% 0%, rgba(255,215,0,0.1) 0%, transparent 50%)'
                          ]
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {currentLeaderboard.length > 0 && (
        <div className="border-t bg-gray-50 p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-gray-900">
                {currentLeaderboard.length}
              </div>
              <div className="text-sm text-gray-600">Total Participants</div>
            </div>
            <div>
              <div className="text-lg font-bold text-blue-600">
                {userRank || '-'}
              </div>
              <div className="text-sm text-gray-600">Your Rank</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600">
                {currentLeaderboard[0] ? formatValue(currentLeaderboard[0], selectedCategory) : '0'}
              </div>
              <div className="text-sm text-gray-600">Top Score</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedLeaderboards;