import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  EyeIcon,
  HeartIcon,
  ChatBubbleLeftRightIcon,
  VideoCameraIcon,
  PhoneIcon,
  CurrencyDollarIcon,
  ClockIcon,
  UserGroupIcon,
  CalendarIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';

const MobileAnalytics = ({ user, onNavigate }) => {
  const [timeRange, setTimeRange] = useState('week');
  const [activeTab, setActiveTab] = useState('overview');

  // Mock data
  const stats = {
    totalEarnings: {
      value: 8750.00,
      change: 12.5,
      trend: 'up'
    },
    totalSessions: {
      value: 145,
      change: 8.2,
      trend: 'up'
    },
    avgSessionTime: {
      value: 24.5,
      change: -3.1,
      trend: 'down'
    },
    newFollowers: {
      value: 328,
      change: 22.4,
      trend: 'up'
    }
  };

  const recentSessions = [
    { id: 1, type: 'video', fan: 'Sarah M.', duration: 32, earnings: 160, rating: 5 },
    { id: 2, type: 'voice', fan: 'Mike J.', duration: 18, earnings: 72, rating: 4 },
    { id: 3, type: 'video', fan: 'Emma W.', duration: 45, earnings: 225, rating: 5 },
    { id: 4, type: 'stream', fan: '24 viewers', duration: 120, earnings: 580, rating: null }
  ];

  const topFans = [
    { id: 1, name: 'Lisa Brown', spent: 2450, sessions: 18, avatar: '/api/placeholder/40/40' },
    { id: 2, name: 'Tom Wilson', spent: 1820, sessions: 12, avatar: '/api/placeholder/40/40' },
    { id: 3, name: 'Jessica Lee', spent: 1650, sessions: 15, avatar: '/api/placeholder/40/40' }
  ];

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'earnings', label: 'Earnings' },
    { id: 'engagement', label: 'Engagement' }
  ];

  const timeRanges = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: '7 Days' },
    { id: 'month', label: '30 Days' },
    { id: 'year', label: 'Year' }
  ];

  const getStatIcon = (type) => {
    switch (type) {
      case 'earnings': return CurrencyDollarIcon;
      case 'sessions': return VideoCameraIcon;
      case 'time': return ClockIcon;
      case 'followers': return UserGroupIcon;
      default: return ChartBarIcon;
    }
  };

  const chartData = [
    { day: 'Mon', value: 850 },
    { day: 'Tue', value: 1250 },
    { day: 'Wed', value: 950 },
    { day: 'Thu', value: 1450 },
    { day: 'Fri', value: 1800 },
    { day: 'Sat', value: 2200 },
    { day: 'Sun', value: 1950 }
  ];

  const maxChartValue = Math.max(...chartData.map(d => d.value));

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 ">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white pb-6" style={{ paddingTop: 'env(safe-area-inset-top, 20px)' }}>
        <div className="px-4 pt-4">
          <h1 className="text-2xl font-bold mb-4">Analytics</h1>

          {/* Time Range Selector */}
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {timeRanges.map((range) => (
              <button
                key={range.id}
                onClick={() => setTimeRange(range.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  timeRange === range.id
                    ? 'bg-white text-purple-600'
                    : 'bg-white/20 text-white'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="px-4 -mt-3">
        <div className="grid grid-cols-2 gap-3">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm p-4"
          >
            <div className="flex items-start justify-between mb-2">
              <CurrencyDollarIcon className="w-5 h-5 text-gray-400" />
              {stats.totalEarnings.trend === 'up' ? (
                <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
              ) : (
                <ArrowTrendingDownIcon className="w-4 h-4 text-red-500" />
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900">${stats.totalEarnings.value.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">Total Earnings</p>
            <p className={`text-xs font-semibold mt-1 ${
              stats.totalEarnings.trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              {stats.totalEarnings.trend === 'up' ? '+' : ''}{stats.totalEarnings.change}%
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-sm p-4"
          >
            <div className="flex items-start justify-between mb-2">
              <VideoCameraIcon className="w-5 h-5 text-gray-400" />
              {stats.totalSessions.trend === 'up' ? (
                <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
              ) : (
                <ArrowTrendingDownIcon className="w-4 h-4 text-red-500" />
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalSessions.value}</p>
            <p className="text-xs text-gray-500 mt-1">Total Sessions</p>
            <p className={`text-xs font-semibold mt-1 ${
              stats.totalSessions.trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              {stats.totalSessions.trend === 'up' ? '+' : ''}{stats.totalSessions.change}%
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-sm p-4"
          >
            <div className="flex items-start justify-between mb-2">
              <ClockIcon className="w-5 h-5 text-gray-400" />
              {stats.avgSessionTime.trend === 'up' ? (
                <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
              ) : (
                <ArrowTrendingDownIcon className="w-4 h-4 text-red-500" />
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.avgSessionTime.value} min</p>
            <p className="text-xs text-gray-500 mt-1">Avg Session</p>
            <p className={`text-xs font-semibold mt-1 ${
              stats.avgSessionTime.trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              {stats.avgSessionTime.trend === 'up' ? '+' : ''}{stats.avgSessionTime.change}%
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-sm p-4"
          >
            <div className="flex items-start justify-between mb-2">
              <UserGroupIcon className="w-5 h-5 text-gray-400" />
              {stats.newFollowers.trend === 'up' ? (
                <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
              ) : (
                <ArrowTrendingDownIcon className="w-4 h-4 text-red-500" />
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.newFollowers.value}</p>
            <p className="text-xs text-gray-500 mt-1">New Followers</p>
            <p className={`text-xs font-semibold mt-1 ${
              stats.newFollowers.trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              {stats.newFollowers.trend === 'up' ? '+' : ''}{stats.newFollowers.change}%
            </p>
          </motion.div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mt-6">
        <div className="bg-white rounded-xl shadow-sm p-1 flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4 mt-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Chart */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Earnings Trend</h2>
              <div className="h-40 flex items-end justify-between space-x-2">
                {chartData.map((item, index) => (
                  <motion.div
                    key={item.day}
                    initial={{ height: 0 }}
                    animate={{ height: `${(item.value / maxChartValue) * 100}%` }}
                    transition={{ delay: index * 0.1 }}
                    className="flex-1 bg-gradient-to-t from-indigo-500 to-purple-500 rounded-t-lg relative group"
                  >
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      ${item.value}
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="flex justify-between mt-2">
                {chartData.map((item) => (
                  <span key={item.day} className="text-xs text-gray-500 flex-1 text-center">
                    {item.day}
                  </span>
                ))}
              </div>
            </div>

            {/* Recent Sessions */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Recent Sessions</h2>
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full ${
                        session.type === 'video' ? 'bg-purple-100' :
                        session.type === 'voice' ? 'bg-blue-100' :
                        'bg-red-100'
                      }`}>
                        {session.type === 'video' ? (
                          <VideoCameraIcon className="w-4 h-4 text-purple-600" />
                        ) : session.type === 'voice' ? (
                          <PhoneIcon className="w-4 h-4 text-blue-600" />
                        ) : (
                          <EyeIcon className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{session.fan}</p>
                        <p className="text-xs text-gray-500">{session.duration} minutes</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">+${session.earnings}</p>
                      {session.rating && (
                        <div className="flex items-center space-x-0.5 mt-1">
                          {[...Array(5)].map((_, i) => (
                            <StarIcon
                              key={i}
                              className={`w-3 h-3 ${
                                i < session.rating ? 'text-yellow-500' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'earnings' && (
          <div className="space-y-4">
            {/* Top Fans */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Top Supporters</h2>
              <div className="space-y-3">
                {topFans.map((fan, index) => (
                  <div key={fan.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <img
                          src={fan.avatar}
                          alt={fan.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <span className="absolute -top-1 -left-1 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                          {index + 1}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{fan.name}</p>
                        <p className="text-xs text-gray-500">{fan.sessions} sessions</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-purple-600">${fan.spent}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue Breakdown */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Revenue Breakdown</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <VideoCameraIcon className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-gray-600">Video Calls</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">$4,250</p>
                    <p className="text-xs text-gray-500">48.6%</p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <PhoneIcon className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-gray-600">Voice Calls</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">$1,850</p>
                    <p className="text-xs text-gray-500">21.1%</p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <EyeIcon className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-gray-600">Live Streams</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">$2,650</p>
                    <p className="text-xs text-gray-500">30.3%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'engagement' && (
          <div className="space-y-4">
            {/* Engagement Stats */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Engagement Metrics</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg Response Time</span>
                  <span className="text-sm font-bold text-gray-900">2.5 min</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Message Reply Rate</span>
                  <span className="text-sm font-bold text-gray-900">94%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Call Accept Rate</span>
                  <span className="text-sm font-bold text-gray-900">78%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg Rating</span>
                  <div className="flex items-center space-x-1">
                    <span className="text-sm font-bold text-gray-900">4.8</span>
                    <StarIcon className="w-4 h-4 text-yellow-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* Peak Hours */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Peak Activity Hours</h2>
              <div className="space-y-2">
                {['8PM - 10PM', '2PM - 4PM', '10PM - 12AM'].map((time, index) => (
                  <div key={time} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{time}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full"
                          style={{ width: `${100 - (index * 20)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{100 - (index * 20)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileAnalytics;