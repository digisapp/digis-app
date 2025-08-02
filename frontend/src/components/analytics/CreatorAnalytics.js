import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  UsersIcon,
  PlayIcon,
  ChatBubbleLeftRightIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CalendarIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const CreatorAnalytics = ({ user }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('7d');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mock data for demonstration
  const mockData = {
    overview: {
      totalEarnings: 145890,
      totalSessions: 234,
      totalFans: 1847,
      avgSessionDuration: 28.5,
      earningsChange: 12.5,
      sessionsChange: 8.3,
      fansChange: 15.2,
      durationChange: -2.1
    },
    earningsChart: [
      { date: 'Mon', amount: 18500, shortDate: 'M' },
      { date: 'Tue', amount: 22300, shortDate: 'T' },
      { date: 'Wed', amount: 19800, shortDate: 'W' },
      { date: 'Thu', amount: 24500, shortDate: 'T' },
      { date: 'Fri', amount: 28900, shortDate: 'F' },
      { date: 'Sat', amount: 31200, shortDate: 'S' },
      { date: 'Sun', amount: 26700, shortDate: 'S' }
    ],
    sessionTypes: [
      { name: 'Video', value: 45, color: '#8b5cf6', fullName: 'Video Calls' },
      { name: 'Voice', value: 30, color: '#ec4899', fullName: 'Voice Calls' },
      { name: 'Live', value: 20, color: '#3b82f6', fullName: 'Live Streams' },
      { name: 'Chat', value: 5, color: '#10b981', fullName: 'Messages' }
    ],
    fanDemographics: {
      ageGroups: [
        { age: '18-24', count: 420, percentage: 23 },
        { age: '25-34', count: 680, percentage: 37 },
        { age: '35-44', count: 510, percentage: 28 },
        { age: '45-54', count: 180, percentage: 10 },
        { age: '55+', count: 57, percentage: 3 }
      ],
      locations: [
        { country: 'US', fullName: 'United States', fans: 892, flag: '🇺🇸' },
        { country: 'UK', fullName: 'United Kingdom', fans: 324, flag: '🇬🇧' },
        { country: 'CA', fullName: 'Canada', fans: 256, flag: '🇨🇦' },
        { country: 'AU', fullName: 'Australia', fans: 189, flag: '🇦🇺' },
        { country: 'Other', fullName: 'Others', fans: 186, flag: '🌍' }
      ]
    },
    contentPerformance: [
      { type: 'Photos', views: 8934, engagement: 82, icon: '📸' },
      { type: 'Videos', views: 12456, engagement: 91, icon: '🎥' },
      { type: 'Streams', views: 5678, engagement: 88, icon: '📡' },
      { type: 'Posts', views: 3421, engagement: 76, icon: '📝' }
    ],
    engagementMetrics: [
      { metric: 'Response', fullMetric: 'Response Rate', value: 94 },
      { metric: 'Retention', fullMetric: 'Retention Rate', value: 87 },
      { metric: 'Satisfaction', fullMetric: 'Fan Satisfaction', value: 92 },
      { metric: 'Repeat', fullMetric: 'Repeat Bookings', value: 78 },
      { metric: 'Tips', fullMetric: 'Tips Received', value: 85 },
      { metric: 'Gifts', fullMetric: 'Gift Rate', value: 72 }
    ],
    quickStats: {
      todayEarnings: 3847,
      activeNow: 12,
      pendingSessions: 3,
      newMessages: 28
    }
  };

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setAnalyticsData(mockData);
      setLoading(false);
    }, 1000);
  }, [dateRange]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1500);
  };

  const tabs = [
    { id: 'overview', name: 'Overview', shortName: 'Overview', icon: ChartBarIcon },
    { id: 'earnings', name: 'Earnings', shortName: 'Earnings', icon: CurrencyDollarIcon },
    { id: 'audience', name: 'Audience', shortName: 'Fans', icon: UsersIcon },
    { id: 'content', name: 'Content', shortName: 'Content', icon: PlayIcon },
    { id: 'engagement', name: 'Engagement', shortName: 'Engage', icon: ChatBubbleLeftRightIcon }
  ];

  const dateRanges = [
    { value: '24h', label: 'Last 24 hours', shortLabel: '24h' },
    { value: '7d', label: 'Last 7 days', shortLabel: '7d' },
    { value: '30d', label: 'Last 30 days', shortLabel: '30d' },
    { value: '90d', label: 'Last 90 days', shortLabel: '90d' },
    { value: '1y', label: 'Last year', shortLabel: '1y' }
  ];

  const exportOptions = [
    { id: 'pdf', label: 'Export as PDF', icon: '📄' },
    { id: 'csv', label: 'Export as CSV', icon: '📊' },
    { id: 'excel', label: 'Export as Excel', icon: '📈' }
  ];

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const StatCard = ({ title, value, change, icon: Icon, prefix = '', suffix = '', trend, className = '' }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-2xl p-3 sm:p-4 lg:p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg">
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
            </div>
            <h3 className="text-[11px] sm:text-xs lg:text-sm text-gray-600 font-medium">{title}</h3>
          </div>
          <div className="mt-2">
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
              {prefix}<span className="tabular-nums">{typeof value === 'number' ? formatNumber(value) : value}</span>{suffix}
            </p>
            {trend && (
              <p className="text-[10px] sm:text-xs text-gray-500 mt-1">{trend}</p>
            )}
          </div>
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-0.5 text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full ${
            change >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {change >= 0 ? <ArrowUpIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <ArrowDownIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
            <span className="font-medium">{Math.abs(change)}%</span>
          </div>
        )}
      </div>
    </motion.div>
  );

  const QuickStatCard = ({ label, value, icon }) => (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3 border border-purple-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-600 mb-0.5">{label}</p>
          <p className="text-base font-bold text-gray-900">{formatNumber(value)}</p>
        </div>
        <span className="text-xl">{icon}</span>
      </div>
    </div>
  );

  const renderOverviewTab = () => (
    <div className="space-y-4 sm:space-y-6">
      {/* Quick Stats for Mobile */}
      <div className="grid grid-cols-2 gap-2 sm:hidden">
        <QuickStatCard label="Today's Earnings" value={analyticsData.quickStats.todayEarnings} icon="💰" />
        <QuickStatCard label="Active Now" value={analyticsData.quickStats.activeNow} icon="🟢" />
        <QuickStatCard label="Pending" value={analyticsData.quickStats.pendingSessions} icon="⏳" />
        <QuickStatCard label="Messages" value={analyticsData.quickStats.newMessages} icon="💬" />
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
        <StatCard
          title="Earnings"
          value={analyticsData.overview.totalEarnings}
          change={analyticsData.overview.earningsChange}
          icon={CurrencyDollarIcon}
          prefix="$"
          trend="↑ $12.5K from last period"
          className="col-span-2 sm:col-span-1"
        />
        <StatCard
          title="Sessions"
          value={analyticsData.overview.totalSessions}
          change={analyticsData.overview.sessionsChange}
          icon={PlayIcon}
          trend="18 today"
        />
        <StatCard
          title="Fans"
          value={analyticsData.overview.totalFans}
          change={analyticsData.overview.fansChange}
          icon={UsersIcon}
          trend="+142 new"
        />
        <StatCard
          title="Avg Duration"
          value={analyticsData.overview.avgSessionDuration}
          change={analyticsData.overview.durationChange}
          icon={CalendarIcon}
          suffix="m"
          trend="Per session"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Earnings Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm sm:text-base lg:text-lg font-semibold">Earnings Trend</h3>
            <span className="text-xs text-gray-500">This week</span>
          </div>
          <div className="h-[180px] sm:h-[250px] lg:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsData.earningsChart} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis 
                  dataKey="shortDate" 
                  stroke="#9ca3af" 
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#9ca3af" 
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickFormatter={(value) => `${value/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '8px',
                    fontSize: '12px',
                    padding: '8px'
                  }}
                  formatter={(value) => [`$${value.toLocaleString()}`, 'Earnings']}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorEarnings)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="bg-purple-50 rounded-lg py-2 px-1">
              <p className="text-[10px] text-gray-600">Best Day</p>
              <p className="text-xs font-semibold text-purple-700">Saturday</p>
            </div>
            <div className="bg-green-50 rounded-lg py-2 px-1">
              <p className="text-[10px] text-gray-600">Growth</p>
              <p className="text-xs font-semibold text-green-700">+15.3%</p>
            </div>
            <div className="bg-blue-50 rounded-lg py-2 px-1">
              <p className="text-[10px] text-gray-600">Avg/Day</p>
              <p className="text-xs font-semibold text-blue-700">$24.5K</p>
            </div>
          </div>
        </motion.div>

        {/* Session Types */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm sm:text-base lg:text-lg font-semibold">Session Types</h3>
            <span className="text-xs text-gray-500">All time</span>
          </div>
          <div className="h-[180px] sm:h-[250px] lg:h-[300px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analyticsData.sessionTypes}
                  cx="50%"
                  cy="45%"
                  labelLine={false}
                  label={({ value, index }) => {
                    const RADIAN = Math.PI / 180;
                    const radius = 60;
                    const x = 50 + radius * Math.cos(-90 * RADIAN);
                    const y = 45 + radius * Math.sin(-90 * RADIAN);
                    return (
                      <text 
                        x={x} 
                        y={y} 
                        fill="white" 
                        textAnchor="middle" 
                        dominantBaseline="central"
                        className="text-xs font-semibold"
                      >
                        {`${value}%`}
                      </text>
                    );
                  }}
                  outerRadius="70%"
                  fill="#8884d8"
                  dataKey="value"
                >
                  {analyticsData.sessionTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name, props) => [`${value}%`, props.payload.fullName]}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '8px',
                    fontSize: '12px',
                    padding: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            {analyticsData.sessionTypes.map((type, index) => (
              <div key={index} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: type.color }} />
                <div className="min-w-0">
                  <span className="text-xs font-medium text-gray-700 block truncate">{type.fullName}</span>
                  <span className="text-[10px] text-gray-500">{type.value}% • {Math.round(analyticsData.overview.totalSessions * type.value / 100)} sessions</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );

  const renderEarningsTab = () => (
    <div className="space-y-4 sm:space-y-6">
      {/* Earnings Summary Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-3 sm:p-4 lg:p-6 text-white">
          <p className="text-[10px] sm:text-xs lg:text-sm font-medium text-purple-100">Today</p>
          <p className="text-base sm:text-xl lg:text-2xl font-bold mt-1">$3.8K</p>
          <p className="text-[10px] sm:text-xs text-purple-200 mt-1">23 sessions</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-3 sm:p-4 lg:p-6 text-white">
          <p className="text-[10px] sm:text-xs lg:text-sm font-medium text-blue-100">This Week</p>
          <p className="text-base sm:text-xl lg:text-2xl font-bold mt-1">$21.9K</p>
          <p className="text-[10px] sm:text-xs text-blue-200 mt-1">142 sessions</p>
        </div>
        <div className="bg-gradient-to-br from-pink-500 to-red-600 rounded-2xl p-3 sm:p-4 lg:p-6 text-white">
          <p className="text-[10px] sm:text-xs lg:text-sm font-medium text-pink-100">This Month</p>
          <p className="text-base sm:text-xl lg:text-2xl font-bold mt-1">$87.6K</p>
          <p className="text-[10px] sm:text-xs text-pink-200 mt-1">598 sessions</p>
        </div>
      </div>

      {/* Detailed Earnings Chart */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
          <h3 className="text-sm sm:text-base lg:text-lg font-semibold">Earnings Breakdown</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors text-xs sm:text-sm"
            >
              <DownloadIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            {showExportMenu && (
              <div className="absolute top-10 right-0 bg-white rounded-lg shadow-lg border border-gray-200 z-10 w-40">
                {exportOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      setShowExportMenu(false);
                      // Handle export
                    }}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span>{option.icon}</span>
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="h-[250px] sm:h-[350px] lg:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analyticsData.earningsChart} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#9ca3af" 
                tick={{ fontSize: window.innerWidth < 640 ? 10 : 12 }}
                axisLine={false}
              />
              <YAxis 
                stroke="#9ca3af" 
                tick={{ fontSize: window.innerWidth < 640 ? 10 : 12 }}
                axisLine={false}
                tickFormatter={(value) => `$${value/1000}k`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px',
                  fontSize: '12px',
                  padding: '8px'
                }}
                formatter={(value) => [`$${value.toLocaleString()}`, 'Earnings']}
              />
              <Line 
                type="monotone" 
                dataKey="amount" 
                stroke="#8b5cf6" 
                strokeWidth={3}
                dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Mobile-friendly summary */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center border-t pt-4">
          <div>
            <p className="text-[10px] text-gray-500">Average</p>
            <p className="text-sm font-semibold">$24.5K</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500">Peak</p>
            <p className="text-sm font-semibold">$31.2K</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500">Low</p>
            <p className="text-sm font-semibold">$18.5K</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500">Total</p>
            <p className="text-sm font-semibold">$171.9K</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAudienceTab = () => (
    <div className="space-y-4 sm:space-y-6">
      {/* Age Distribution - Mobile Optimized */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
        <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-4">Age Distribution</h3>
        <div className="space-y-3">
          {analyticsData.fanDemographics.ageGroups.map((group, index) => (
            <div key={index} className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-700 w-12">{group.age}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${group.percentage}%` }}
                  transition={{ duration: 0.8, delay: index * 0.1 }}
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-end pr-2"
                >
                  <span className="text-[10px] text-white font-medium">{group.percentage}%</span>
                </motion.div>
              </div>
              <span className="text-xs text-gray-600 w-10 text-right">{group.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Locations - Mobile Card Layout */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
        <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-4">Top Locations</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {analyticsData.fanDemographics.locations.map((location, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-gradient-to-br ${
                index === 0 ? 'from-purple-50 to-pink-50' :
                index === 1 ? 'from-blue-50 to-purple-50' :
                index === 2 ? 'from-green-50 to-blue-50' :
                index === 3 ? 'from-yellow-50 to-green-50' :
                'from-gray-50 to-gray-100'
              } rounded-xl p-3 border ${
                index === 0 ? 'border-purple-200' :
                index === 1 ? 'border-blue-200' :
                index === 2 ? 'border-green-200' :
                index === 3 ? 'border-yellow-200' :
                'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{location.flag}</span>
                  <div>
                    <p className="font-medium text-sm text-gray-900">{location.fullName}</p>
                    <p className="text-xs text-gray-600">{location.fans} fans</p>
                  </div>
                </div>
                <div className={`text-lg font-bold ${
                  index === 0 ? 'text-purple-600' :
                  index === 1 ? 'text-blue-600' :
                  index === 2 ? 'text-green-600' :
                  index === 3 ? 'text-yellow-600' :
                  'text-gray-600'
                }`}>
                  #{index + 1}
                </div>
              </div>
              <div className="mt-2 bg-white/50 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full ${
                    index === 0 ? 'bg-purple-500' :
                    index === 1 ? 'bg-blue-500' :
                    index === 2 ? 'bg-green-500' :
                    index === 3 ? 'bg-yellow-500' :
                    'bg-gray-500'
                  }`}
                  style={{ width: `${(location.fans / analyticsData.fanDemographics.locations[0].fans) * 100}%` }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Fan Growth - Simplified Mobile View */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm sm:text-base lg:text-lg font-semibold">Fan Growth</h3>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
            +15.2% growth
          </span>
        </div>
        <div className="h-[180px] sm:h-[250px] lg:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={[
              { month: 'J', fans: 1234 },
              { month: 'F', fans: 1456 },
              { month: 'M', fans: 1523 },
              { month: 'A', fans: 1687 },
              { month: 'M', fans: 1789 },
              { month: 'J', fans: 1847 }
            ]} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorFans" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis 
                dataKey="month" 
                stroke="#9ca3af" 
                tick={{ fontSize: 10 }}
                axisLine={false}
              />
              <YAxis 
                stroke="#9ca3af" 
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px',
                  fontSize: '12px',
                  padding: '8px'
                }}
                formatter={(value) => [value, 'Fans']}
              />
              <Area 
                type="monotone" 
                dataKey="fans" 
                stroke="#ec4899" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorFans)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderContentTab = () => (
    <div className="space-y-4 sm:space-y-6">
      {/* Content Performance Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {analyticsData.contentPerformance.map((content, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="text-2xl mb-2 block">{content.icon}</span>
                <h4 className="font-semibold text-gray-900 text-sm sm:text-base">{content.type}</h4>
              </div>
              <div className={`text-xs px-2 py-1 rounded-full font-medium ${
                content.engagement >= 90 ? 'bg-green-100 text-green-700' :
                content.engagement >= 80 ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {content.engagement}%
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-purple-600 mb-1">{formatNumber(content.views)}</p>
            <p className="text-xs text-gray-600">views</p>
            <div className="mt-3 bg-gray-100 rounded-full h-2 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${content.engagement}%` }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Content Insights */}
      <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-4 sm:p-6 text-white">
        <h3 className="text-sm sm:text-base font-semibold mb-3">Content Insights</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
            <span className="text-xs">Best Performing</span>
            <span className="font-semibold">Videos (91% engagement)</span>
          </div>
          <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
            <span className="text-xs">Most Views</span>
            <span className="font-semibold">12.5K on Videos</span>
          </div>
          <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
            <span className="text-xs">Growth Rate</span>
            <span className="font-semibold">+23% this month</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEngagementTab = () => (
    <div className="space-y-4 sm:space-y-6">
      {/* Engagement Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {analyticsData.engagementMetrics.map((metric, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100"
          >
            <div className="flex flex-col">
              <span className="text-xs text-gray-600 mb-1">{metric.metric}</span>
              <div className="flex items-end justify-between">
                <span className={`text-2xl sm:text-3xl font-bold ${
                  metric.value >= 90 ? 'text-green-600' :
                  metric.value >= 75 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {metric.value}%
                </span>
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${
                  metric.value >= 90 ? 'from-green-100 to-green-200' :
                  metric.value >= 75 ? 'from-yellow-100 to-yellow-200' :
                  'from-red-100 to-red-200'
                } flex items-center justify-center`}>
                  <span className="text-lg">
                    {metric.value >= 90 ? '🎯' : metric.value >= 75 ? '📈' : '⚠️'}
                  </span>
                </div>
              </div>
              <div className="mt-2 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    metric.value >= 90 ? 'bg-green-500' :
                    metric.value >= 75 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${metric.value}%` }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Engagement Overview Radar Chart - Mobile Optimized */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
        <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-4">Engagement Overview</h3>
        <div className="h-[250px] sm:h-[350px] lg:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={analyticsData.engagementMetrics}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis 
                dataKey="metric" 
                stroke="#6b7280" 
                tick={{ fontSize: window.innerWidth < 640 ? 9 : 10 }}
                className="text-xs"
              />
              <PolarRadiusAxis 
                angle={90} 
                domain={[0, 100]} 
                stroke="#6b7280" 
                tick={{ fontSize: 9 }}
                tickCount={4}
              />
              <Radar 
                name="Performance" 
                dataKey="value" 
                stroke="#8b5cf6" 
                fill="#8b5cf6" 
                fillOpacity={0.6} 
                strokeWidth={2}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px',
                  fontSize: '12px',
                  padding: '8px'
                }}
                formatter={(value) => [`${value}%`, 'Score']}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        {/* Mobile Summary */}
        <div className="mt-4 bg-purple-50 rounded-xl p-3 border border-purple-200">
          <p className="text-xs text-purple-700 font-medium">Overall Performance</p>
          <p className="text-2xl font-bold text-purple-900 mt-1">
            {Math.round(analyticsData.engagementMetrics.reduce((acc, curr) => acc + curr.value, 0) / analyticsData.engagementMetrics.length)}%
          </p>
          <p className="text-[10px] text-purple-600 mt-1">Excellent engagement across all metrics</p>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-sm text-gray-600 mt-4">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-b-3xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 text-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Analytics</h1>
              <p className="text-purple-100 text-xs sm:text-sm lg:text-base mt-1">Track your performance</p>
            </div>
            <button
              onClick={handleRefresh}
              className={`p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
            >
              <ArrowPathIcon className="w-5 h-5 text-white" />
            </button>
          </div>
          
          {/* Mobile Quick Stats */}
          <div className="grid grid-cols-4 gap-2 mt-4 sm:hidden">
            <div className="text-center">
              <p className="text-xs text-purple-200">Today</p>
              <p className="font-semibold">$3.8K</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-purple-200">Active</p>
              <p className="font-semibold">12</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-purple-200">Fans</p>
              <p className="font-semibold">1.8K</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-purple-200">Status</p>
              <p className="font-semibold">Active</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="px-4 sm:px-0">
          {/* Mobile Tab Scrolling with Icons */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1 overflow-x-auto">
              <div className="flex gap-2 pb-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-all whitespace-nowrap text-sm ${
                      activeTab === tab.id
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
                        : 'bg-white text-gray-700 border border-gray-200'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.name}</span>
                    <span className="sm:hidden">{tab.shortName}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range Selector */}
            <div className="relative ml-2">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 bg-white shadow-sm"
              >
                <CalendarIcon className="w-4 h-4 text-gray-500" />
                <span className="font-medium">{dateRanges.find(r => r.value === dateRange)?.shortLabel}</span>
              </button>
              
              {showDatePicker && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-lg border border-gray-200 z-20 overflow-hidden">
                  {dateRanges.map((range) => (
                    <button
                      key={range.value}
                      onClick={() => {
                        setDateRange(range.value);
                        setShowDatePicker(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 transition-colors ${
                        dateRange === range.value ? 'bg-purple-50 text-purple-600 font-medium' : 'text-gray-700'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-4 sm:px-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'overview' && renderOverviewTab()}
              {activeTab === 'earnings' && renderEarningsTab()}
              {activeTab === 'audience' && renderAudienceTab()}
              {activeTab === 'content' && renderContentTab()}
              {activeTab === 'engagement' && renderEngagementTab()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default CreatorAnalytics;