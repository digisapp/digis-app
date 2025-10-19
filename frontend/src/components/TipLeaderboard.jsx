import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrophyIcon, SparklesIcon, FireIcon } from '@heroicons/react/24/solid';
import { Crown } from 'lucide-react';
import { getAuthToken } from '../utils/auth-helpers';

const TipLeaderboard = ({
  creatorId,
  streamId,
  className = '',
  maxEntries = 5
}) => {
  const [topTippers, setTopTippers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today'); // today, week, month, all

  useEffect(() => {
    if (!creatorId) return;

    fetchTopTippers();

    // Refresh every 30 seconds during live stream
    const interval = setInterval(fetchTopTippers, 30000);
    return () => clearInterval(interval);
  }, [creatorId, period]);

  const fetchTopTippers = async () => {
    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/tips/stats/${creatorId}?period=${period}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTopTippers(data.top_tippers || []);
      }
    } catch (error) {
      console.error('Failed to fetch top tippers:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTokens = (amount) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toLocaleString();
  };

  const getMedalEmoji = (rank) => {
    switch (rank) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return `#${rank + 1}`;
    }
  };

  const getRankColor = (rank) => {
    switch (rank) {
      case 0: return 'from-yellow-400 to-amber-600';
      case 1: return 'from-gray-300 to-gray-500';
      case 2: return 'from-orange-400 to-orange-600';
      default: return 'from-purple-400 to-purple-600';
    }
  };

  if (loading) {
    return (
      <div className={`bg-gradient-to-br from-purple-900/20 to-pink-900/20 backdrop-blur-md rounded-2xl p-4 border border-purple-400/30 shadow-2xl ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center">
            <TrophyIcon className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-white font-bold text-lg">Top Supporters</h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/10 rounded-lg p-3 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (topTippers.length === 0) {
    return (
      <div className={`bg-gradient-to-br from-purple-900/20 to-pink-900/20 backdrop-blur-md rounded-2xl p-4 border border-purple-400/30 shadow-2xl ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center">
            <TrophyIcon className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-white font-bold text-lg">Top Supporters</h3>
        </div>
        <div className="text-center py-6">
          <SparklesIcon className="w-12 h-12 text-purple-300/50 mx-auto mb-2" />
          <p className="text-purple-200/70 text-sm">No tips yet. Be the first!</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-purple-900/20 to-pink-900/20 backdrop-blur-md rounded-2xl p-4 border border-purple-400/30 shadow-2xl ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg">
              <TrophyIcon className="w-6 h-6 text-white" />
            </div>
          </motion.div>
          <div>
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              Top Supporters
              <FireIcon className="w-4 h-4 text-orange-400 animate-pulse" />
            </h3>
            <p className="text-purple-200/70 text-xs capitalize">{period}</p>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex gap-1 bg-black/30 rounded-lg p-1">
          {['today', 'week', 'all'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                period === p
                  ? 'bg-purple-500 text-white'
                  : 'text-purple-200/70 hover:text-white'
              }`}
            >
              {p === 'today' ? 'Today' : p === 'week' ? 'Week' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Entries */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {topTippers.slice(0, maxEntries).map((tipper, index) => (
            <motion.div
              key={tipper.id || index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
              className={`relative overflow-hidden rounded-xl border ${
                index === 0
                  ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-400/40'
                  : 'bg-black/20 border-purple-400/20'
              }`}
            >
              {/* Background glow for top 3 */}
              {index < 3 && (
                <div className="absolute inset-0 opacity-20">
                  <div className={`h-full bg-gradient-to-r ${getRankColor(index)}`} />
                </div>
              )}

              <div className="relative flex items-center gap-3 p-3">
                {/* Rank Badge */}
                <div className="flex-shrink-0">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getRankColor(index)} flex items-center justify-center shadow-lg font-bold text-white text-sm`}>
                    {index < 3 ? getMedalEmoji(index) : `#${index + 1}`}
                  </div>
                </div>

                {/* Profile Picture */}
                <div className="flex-shrink-0 relative">
                  {tipper.profile_pic_url ? (
                    <img
                      src={tipper.profile_pic_url}
                      alt={tipper.display_name || tipper.username}
                      className="w-10 h-10 rounded-full border-2 border-white/20"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-2 border-white/20">
                      <span className="text-white font-semibold text-sm">
                        {(tipper.display_name || tipper.username || '?')[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  {index === 0 && (
                    <motion.div
                      className="absolute -top-1 -right-1"
                      animate={{ rotate: [0, 15, -15, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Crown className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    </motion.div>
                  )}
                </div>

                {/* Name and Amount */}
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold text-sm truncate">
                    {tipper.display_name || tipper.username || 'Anonymous'}
                  </div>
                  <div className="text-purple-200/70 text-xs">
                    @{tipper.username || 'unknown'}
                  </div>
                </div>

                {/* Tip Amount */}
                <div className="flex-shrink-0">
                  <motion.div
                    className={`px-3 py-1.5 rounded-lg font-bold text-sm ${
                      index === 0
                        ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white'
                        : 'bg-purple-500/30 text-purple-100'
                    }`}
                    whileHover={{ scale: 1.05 }}
                  >
                    {formatTokens(tipper.total_amount)} 💎
                  </motion.div>
                </div>
              </div>

              {/* Animated shine effect for #1 */}
              {index === 0 && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    repeatDelay: 2,
                    ease: "easeInOut"
                  }}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Competition Encouragement */}
      {topTippers.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-3 text-center"
        >
          <p className="text-purple-200/60 text-xs">
            💫 Show your support to climb the leaderboard!
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default TipLeaderboard;
