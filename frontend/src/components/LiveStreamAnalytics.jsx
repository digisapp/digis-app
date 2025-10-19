import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChartBarIcon,
  EyeIcon,
  ChatBubbleLeftRightIcon,
  GiftIcon,
  CurrencyDollarIcon,
  UserPlusIcon,
  XMarkIcon,
  ArrowTrendingUpIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/solid';

const LiveStreamAnalytics = ({
  streamStats = {},
  isCreator = false,
  className = '',
  compact = false
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [chartData, setChartData] = useState([]);
  const chartRef = useRef(null);

  // Track analytics over time for graph
  useEffect(() => {
    const now = Date.now();
    setChartData(prev => {
      const newData = [...prev, {
        timestamp: now,
        viewers: streamStats.viewers || 0,
        revenue: streamStats.revenue || 0,
        engagement: streamStats.engagement || 0
      }];

      // Keep last 20 data points (10 minutes if updating every 30s)
      return newData.slice(-20);
    });
  }, [streamStats.viewers, streamStats.revenue, streamStats.engagement]);

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCurrency = (tokens) => {
    const usd = tokens * 0.05; // Assuming 1 token = $0.05
    return `$${usd.toFixed(2)}`;
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const StatCard = ({ icon: Icon, label, value, color = 'purple', trend = null }) => (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`bg-gradient-to-br ${
        color === 'purple' ? 'from-purple-500/20 to-purple-700/20' :
        color === 'blue' ? 'from-blue-500/20 to-blue-700/20' :
        color === 'green' ? 'from-green-500/20 to-green-700/20' :
        color === 'yellow' ? 'from-yellow-500/20 to-yellow-700/20' :
        'from-pink-500/20 to-pink-700/20'
      } backdrop-blur-sm rounded-xl p-3 border border-white/10 relative overflow-hidden`}
    >
      {/* Background gradient animation */}
      <motion.div
        className={`absolute inset-0 bg-gradient-to-r ${
          color === 'purple' ? 'from-purple-400/0 via-purple-400/10 to-purple-400/0' :
          color === 'blue' ? 'from-blue-400/0 via-blue-400/10 to-blue-400/0' :
          color === 'green' ? 'from-green-400/0 via-green-400/10 to-green-400/0' :
          color === 'yellow' ? 'from-yellow-400/0 via-yellow-400/10 to-yellow-400/0' :
          'from-pink-400/0 via-pink-400/10 to-pink-400/0'
        }`}
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 3, repeat: Infinity, repeatDelay: 1 }}
      />

      <div className="relative flex items-center gap-3">
        <div className={`p-2 rounded-lg ${
          color === 'purple' ? 'bg-purple-500/30' :
          color === 'blue' ? 'bg-blue-500/30' :
          color === 'green' ? 'bg-green-500/30' :
          color === 'yellow' ? 'bg-yellow-500/30' :
          'bg-pink-500/30'
        }`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-white/70 text-xs font-medium">{label}</div>
          <div className="text-white text-xl font-bold">{value}</div>
        </div>
        {trend !== null && trend !== 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold ${
              trend > 0 ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'
            }`}
          >
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </motion.div>
        )}
      </div>
    </motion.div>
  );

  // Compact view for non-creators
  if (compact) {
    return (
      <div className={`flex items-center gap-3 bg-black/30 backdrop-blur-sm rounded-full px-4 py-2 border border-white/10 ${className}`}>
        <div className="flex items-center gap-2 text-white">
          <EyeIcon className="w-4 h-4" />
          <span className="font-semibold text-sm">{streamStats.viewers || 0}</span>
        </div>
        <div className="w-px h-4 bg-white/20" />
        <div className="flex items-center gap-2 text-white">
          <ChatBubbleLeftRightIcon className="w-4 h-4" />
          <span className="font-semibold text-sm">{streamStats.messages || 0}</span>
        </div>
        <div className="w-px h-4 bg-white/20" />
        <div className="flex items-center gap-2 text-white">
          <ClockIcon className="w-4 h-4" />
          <span className="font-semibold text-sm">{formatDuration(streamStats.duration || 0)}</span>
        </div>
      </div>
    );
  }

  // Full analytics view for creators
  if (!isCreator) return null;

  return (
    <AnimatePresence>
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", duration: 0.4 }}
          className={`bg-gradient-to-br from-gray-900/95 to-purple-900/95 backdrop-blur-md rounded-2xl p-5 border border-purple-400/30 shadow-2xl ${className}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <ChartBarIcon className="w-6 h-6 text-white" />
                </div>
              </motion.div>
              <div>
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  Live Analytics
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <SparklesIcon className="w-4 h-4 text-yellow-400" />
                  </motion.div>
                </h3>
                <p className="text-purple-200/70 text-xs">Real-time stream performance</p>
              </div>
            </div>

            <button
              onClick={() => setIsExpanded(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-white/70" />
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <StatCard
              icon={EyeIcon}
              label="Viewers"
              value={streamStats.viewers || 0}
              color="blue"
            />
            <StatCard
              icon={EyeIcon}
              label="Peak Viewers"
              value={streamStats.peakViewers || 0}
              color="purple"
            />
            <StatCard
              icon={ClockIcon}
              label="Duration"
              value={formatDuration(streamStats.duration || 0)}
              color="green"
            />
            <StatCard
              icon={ChatBubbleLeftRightIcon}
              label="Messages"
              value={formatNumber(streamStats.messages || 0)}
              color="yellow"
            />
            <StatCard
              icon={GiftIcon}
              label="Gifts & Tips"
              value={(streamStats.gifts || 0) + (streamStats.tips || 0)}
              color="pink"
            />
            <StatCard
              icon={CurrencyDollarIcon}
              label="Revenue"
              value={formatCurrency(streamStats.revenue || 0)}
              color="green"
            />
            <StatCard
              icon={UserPlusIcon}
              label="New Followers"
              value={streamStats.newFollowers || 0}
              color="purple"
            />
            <StatCard
              icon={ArrowTrendingUpIcon}
              label="Engagement"
              value={`${Math.round(streamStats.engagement || 0)}%`}
              color="blue"
            />
          </div>

          {/* Mini Graph */}
          {chartData.length > 1 && (
            <div className="bg-black/30 rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-semibold text-sm">Viewer Trend</h4>
                <div className="flex gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-white/70">Viewers</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-white/70">Revenue</span>
                  </div>
                </div>
              </div>

              {/* Simple SVG line graph */}
              <div ref={chartRef} className="h-24 relative">
                <svg className="w-full h-full">
                  {/* Grid lines */}
                  <line x1="0" y1="0" x2="100%" y2="0" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  <line x1="0" y1="100%" x2="100%" y2="100%" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

                  {/* Viewer trend line */}
                  <motion.polyline
                    points={chartData.map((d, i) => {
                      const x = (i / (chartData.length - 1)) * 100;
                      const maxViewers = Math.max(...chartData.map(d => d.viewers), 1);
                      const y = 100 - (d.viewers / maxViewers) * 80 - 10;
                      return `${x},${y}`;
                    }).join(' ')}
                    fill="none"
                    stroke="url(#viewerGradient)"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1 }}
                  />

                  <defs>
                    <linearGradient id="viewerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#60a5fa" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          )}

          {/* Quick Stats Summary */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4 grid grid-cols-2 gap-3"
          >
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg p-3 border border-purple-400/20">
              <div className="text-purple-200/70 text-xs mb-1">Avg. Watch Time</div>
              <div className="text-white font-bold">
                {streamStats.viewers > 0
                  ? formatDuration(Math.floor(streamStats.duration / streamStats.viewers))
                  : '0:00'
                }
              </div>
            </div>
            <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg p-3 border border-green-400/20">
              <div className="text-green-200/70 text-xs mb-1">Revenue/Min</div>
              <div className="text-white font-bold">
                {streamStats.duration > 0
                  ? formatCurrency(Math.floor((streamStats.revenue / (streamStats.duration / 60)) * 10) / 10)
                  : '$0.00'
                }
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Collapsed state - small button */}
      {!isExpanded && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setIsExpanded(true)}
          className={`bg-gradient-to-r from-purple-600 to-pink-600 rounded-full p-3 border border-white/20 shadow-lg hover:shadow-xl transition-all ${className}`}
        >
          <ChartBarIcon className="w-6 h-6 text-white" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};

export default LiveStreamAnalytics;
