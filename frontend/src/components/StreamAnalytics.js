import React, { useState, useEffect, forwardRef } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  HeartIcon,
  EyeIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const StreamAnalytics = forwardRef(({ streamStats, viewerData, revenueData, className = '' }, ref) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('1h'); // 1h, 4h, 24h, 7d
  
  // Mock data for charts
  const [viewerHistory, setViewerHistory] = useState([]);
  const [engagementData, setEngagementData] = useState([]);
  const [revenueHistory, setRevenueHistory] = useState([]);

  useEffect(() => {
    // Generate mock viewer history with stable time values
    const generateViewerHistory = () => {
      const data = [];
      const now = Date.now();
      const baseTime = Math.floor(now / 60000) * 60000; // Round to nearest minute
      
      for (let i = 0; i < 30; i++) {
        const timeStamp = baseTime - (29 - i) * 60000;
        data.push({
          time: new Date(timeStamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timeStamp, // Store timestamp for stable sorting
          viewers: Math.floor(Math.random() * 200) + 50,
          messages: Math.floor(Math.random() * 50) + 10
        });
      }
      setViewerHistory(data);
    };

    // Generate engagement data
    const generateEngagementData = () => {
      setEngagementData([
        { name: 'Chat Messages', value: streamStats?.messages || 450, color: '#8b5cf6' },
        { name: 'Reactions', value: 234, color: '#ec4899' },
        { name: 'Gifts Sent', value: 89, color: '#f59e0b' },
        { name: 'New Follows', value: streamStats?.newFollowers || 67, color: '#10b981' }
      ]);
    };

    // Generate revenue data
    const generateRevenueData = () => {
      const data = [];
      for (let i = 0; i < 7; i++) {
        data.push({
          day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
          tips: Math.floor(Math.random() * 500) + 100,
          gifts: Math.floor(Math.random() * 300) + 50,
          subs: Math.floor(Math.random() * 200) + 50
        });
      }
      setRevenueHistory(data);
    };

    generateViewerHistory();
    generateEngagementData();
    generateRevenueData();

    // Update every 30 seconds
    const interval = setInterval(() => {
      generateViewerHistory();
    }, 30000);

    return () => clearInterval(interval);
  }, [streamStats]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: ChartBarIcon },
    { id: 'viewers', label: 'Viewers', icon: UserGroupIcon },
    { id: 'revenue', label: 'Revenue', icon: CurrencyDollarIcon },
    { id: 'engagement', label: 'Engagement', icon: HeartIcon }
  ];

  const metrics = [
    {
      label: 'Current Viewers',
      value: streamStats?.viewers || 0,
      change: '+12%',
      icon: EyeIcon,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20'
    },
    {
      label: 'Peak Viewers',
      value: streamStats?.peakViewers || 0,
      change: 'All-time high',
      icon: ArrowTrendingUpIcon,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20'
    },
    {
      label: 'Avg Watch Time',
      value: '24m',
      change: '+5m from last',
      icon: ClockIcon,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20'
    },
    {
      label: 'Chat Activity',
      value: `${streamStats?.messages || 0}/min`,
      change: 'Very Active',
      icon: ChatBubbleLeftRightIcon,
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/20'
    }
  ];

  return (
    <div className={`bg-gradient-to-b from-gray-900/95 to-gray-950/95 backdrop-blur-xl rounded-xl border border-gray-800/50 shadow-2xl p-4 ${className}`} ref={ref}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl">
            <ChartBarIcon className="w-5 h-5 text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">Stream Analytics</h3>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex items-center gap-2">
          {['1h', '4h', '24h', '7d'].map(range => (
            <motion.button
              key={range}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all duration-200 ${
                timeRange === range
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              {range}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-3 border-b border-gray-800/50 pb-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200 border-b-2 rounded-t-lg ${
                activeTab === tab.id
                  ? 'text-white bg-gradient-to-b from-purple-500/20 to-transparent border-purple-400'
                  : 'text-gray-400 border-transparent hover:text-white hover:bg-gray-800/30'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {metrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <motion.div
                    key={metric.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`${metric.bgColor} rounded-xl p-3 backdrop-blur-sm border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200 hover:scale-[1.02]`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-gray-400">{metric.label}</p>
                        <p className={`text-xl font-bold ${metric.color} mt-1`}>
                          {metric.value}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{metric.change}</p>
                      </div>
                      <Icon className={`w-5 h-5 ${metric.color} opacity-50`} />
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Viewer Chart */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-3 backdrop-blur-sm border border-gray-700/50">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Viewer Count</h4>
              <ResponsiveContainer width="100%" height={158}>
                <AreaChart data={viewerHistory}>
                  <defs>
                    <linearGradient id="viewerGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#9ca3af" 
                    fontSize={12}
                    tick={{ fill: '#9ca3af' }}
                    tickLine={{ stroke: '#374151' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    stroke="#9ca3af" 
                    fontSize={12}
                    tick={{ fill: '#9ca3af' }}
                    tickLine={{ stroke: '#374151' }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#d1d5db' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="viewers"
                    stroke="#8b5cf6"
                    fillOpacity={1}
                    fill="url(#viewerGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          </>
        )}

        {/* Viewers Tab */}
        {activeTab === 'viewers' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Viewer Distribution */}
              <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-3 backdrop-blur-sm border border-gray-700/50">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Viewer Sources</h4>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Direct', value: 45, color: '#8b5cf6' },
                        { name: 'Browse', value: 30, color: '#ec4899' },
                        { name: 'Raid', value: 15, color: '#f59e0b' },
                        { name: 'Host', value: 10, color: '#10b981' }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {engagementData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Geographic Distribution */}
              <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-3 backdrop-blur-sm border border-gray-700/50">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Top Locations</h4>
                <div className="space-y-2">
                  {[
                    { country: 'United States', viewers: 234, flag: '🇺🇸' },
                    { country: 'United Kingdom', viewers: 156, flag: '🇬🇧' },
                    { country: 'Canada', viewers: 98, flag: '🇨🇦' },
                    { country: 'Germany', viewers: 67, flag: '🇩🇪' },
                    { country: 'Japan', viewers: 45, flag: '🇯🇵' }
                  ].map(location => (
                    <div key={location.country} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{location.flag}</span>
                        <span className="text-sm text-gray-300">{location.country}</span>
                      </div>
                      <span className="text-sm font-medium text-white">{location.viewers}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </>
        )}

        {/* Revenue Tab */}
        {activeTab === 'revenue' && (
          <>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-3 backdrop-blur-sm border border-gray-700/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-300">Revenue Breakdown</h4>
                <span className="text-lg font-bold text-green-400">
                  ${streamStats?.revenue || 0}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={revenueHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#d1d5db' }}
                  />
                  <Legend />
                  <Bar dataKey="tips" stackId="a" fill="#10b981" />
                  <Bar dataKey="gifts" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="subs" stackId="a" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Top Contributors */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-3 backdrop-blur-sm border border-gray-700/50">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Top Contributors</h4>
              <div className="space-y-2">
                {[
                  { user: 'BigSpender123', amount: 250, type: 'tip' },
                  { user: 'SuperFan456', amount: 180, type: 'gifts' },
                  { user: 'LoyalViewer789', amount: 150, type: 'sub' },
                  { user: 'GenerousGamer', amount: 120, type: 'tip' },
                  { user: 'StreamSupporter', amount: 100, type: 'gifts' }
                ].map((contributor, index) => (
                  <div key={contributor.user} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-400">#{index + 1}</span>
                      <span className="text-sm text-white">{contributor.user}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        contributor.type === 'tip' ? 'bg-green-500/20 text-green-400' :
                        contributor.type === 'gifts' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-purple-500/20 text-purple-400'
                      }`}>
                        {contributor.type}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-white">${contributor.amount}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}

        {/* Engagement Tab */}
        {activeTab === 'engagement' && (
          <>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-3 backdrop-blur-sm border border-gray-700/50">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Engagement Metrics</h4>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={engagementData} layout="horizontal">
                  <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={12} width={100} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#d1d5db' }}
                  />
                  <Bar dataKey="value" fill="#8b5cf6">
                    {engagementData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Chat Activity */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-3 backdrop-blur-sm border border-gray-700/50">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Chat Activity Over Time</h4>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={viewerHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#d1d5db' }}
                  />
                  <Line type="monotone" dataKey="messages" stroke="#ec4899" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
});

StreamAnalytics.displayName = 'StreamAnalytics';

export default StreamAnalytics;