import React, { useState, useEffect } from 'react';
import { 
  CalendarIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  VideoCameraIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  GiftIcon,
  UsersIcon,
  DocumentTextIcon,
  SignalIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import toast from 'react-hot-toast';

const EarningsPage = ({ user, isCreator }) => {
  const [dateRange, setDateRange] = useState('month'); // 'today', 'week', 'month', 'year', 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [earningsData, setEarningsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Fetch earnings data
  useEffect(() => {
    fetchEarningsData();
  }, [dateRange, customStartDate, customEndDate, selectedMonth]);

  const fetchEarningsData = async () => {
    setLoading(true);
    try {
      // In production, this would fetch from your API
      // For now, we'll use mock data immediately
      setEarningsData(generateMockEarningsData());
      setLoading(false);
    } catch (error) {
      console.error('Error fetching earnings:', error);
      toast.error('Failed to load earnings data');
      setLoading(false);
    }
  };

  const generateMockEarningsData = () => {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    
    // Generate daily earnings for the chart
    const dailyEarnings = [];
    for (let i = 1; i <= daysInMonth; i++) {
      dailyEarnings.push({
        date: i,
        amount: Math.floor(Math.random() * 500) + 100
      });
    }

    return {
      totalEarnings: 12450,
      monthlyEarnings: 3850,
      previousMonthEarnings: 3200,
      todayEarnings: 245,
      yesterdayEarnings: 320,
      weeklyEarnings: 1680,
      dailyEarnings,
      breakdown: {
        tips: 4250,
        subscriptions: 3200,
        content: 1850,
        messages: 1200,
        liveStreams: 850,
        videoCalls: 750,
        voiceCalls: 350
      },
      topEarningDays: [
        { date: '2024-01-15', amount: 580, reason: 'Live stream event' },
        { date: '2024-01-22', amount: 520, reason: 'New content release' },
        { date: '2024-01-08', amount: 480, reason: 'Multiple video calls' }
      ]
    };
  };

  const calculatePercentageChange = (current, previous) => {
    if (previous === 0) return 100;
    return ((current - previous) / previous * 100).toFixed(1);
  };

  const formatCurrency = (amount) => {
    return `$${(amount * 0.05).toFixed(2)}`;
  };

  // Prepare chart data
  const dailyChartData = earningsData?.dailyEarnings || [];
  
  const breakdownChartData = earningsData ? [
    { name: 'Tips', value: earningsData.breakdown.tips, fill: '#9333ea' },
    { name: 'Subscriptions', value: earningsData.breakdown.subscriptions, fill: '#3b82f6' },
    { name: 'Content', value: earningsData.breakdown.content, fill: '#22c55e' },
    { name: 'Messages', value: earningsData.breakdown.messages, fill: '#fb923c' },
    { name: 'Live Streams', value: earningsData.breakdown.liveStreams, fill: '#ec4899' },
    { name: 'Video Calls', value: earningsData.breakdown.videoCalls, fill: '#a855f7' },
    { name: 'Voice Calls', value: earningsData.breakdown.voiceCalls, fill: '#14b8a6' }
  ] : [];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload[0]) {
      return (
        <div className="bg-gray-900 text-white p-3 rounded-lg shadow-lg">
          <p className="text-sm font-medium">{`Day ${label}`}</p>
          <p className="text-sm">{`${payload[0].value} tokens`}</p>
        </div>
      );
    }
    return null;
  };

  if (!isCreator) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Creator Access Only</h2>
          <p className="text-gray-600">This page is only available for creators.</p>
        </div>
      </div>
    );
  }

  // Removed loading state - data loads immediately

  const percentageChange = calculatePercentageChange(
    earningsData.monthlyEarnings,
    earningsData.previousMonthEarnings
  );
  const isPositive = percentageChange >= 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Earnings Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Track your earnings and revenue streams</p>
        </div>
        
        {/* Date Range Selector */}
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
          
          {dateRange === 'month' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          )}
          
          {dateRange === 'custom' && (
            <>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Start date"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="End date"
              />
            </>
          )}
        </div>
      </div>

      {/* Earnings Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Today's Earnings */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Today's Earnings</h3>
            <CalendarIcon className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">
              {earningsData.todayEarnings}
            </span>
            <span className="text-sm text-gray-500">tokens</span>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            {formatCurrency(earningsData.todayEarnings)}
          </div>
        </div>

        {/* Monthly Earnings */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium opacity-90">Monthly Earnings</h3>
            <ChartBarIcon className="w-5 h-5 opacity-70" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">
              {earningsData.monthlyEarnings}
            </span>
            <span className="text-sm opacity-90">tokens</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm opacity-90">{formatCurrency(earningsData.monthlyEarnings)}</span>
            <span className={`text-sm flex items-center gap-1 ${isPositive ? 'text-green-300' : 'text-red-300'}`}>
              {isPositive ? <ArrowTrendingUpIcon className="w-4 h-4" /> : <ArrowTrendingDownIcon className="w-4 h-4" />}
              {Math.abs(percentageChange)}%
            </span>
          </div>
        </div>

        {/* Weekly Earnings */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Weekly Earnings</h3>
            <CalendarIcon className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">
              {earningsData.weeklyEarnings}
            </span>
            <span className="text-sm text-gray-500">tokens</span>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            {formatCurrency(earningsData.weeklyEarnings)}
          </div>
        </div>

        {/* Total Earnings */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Total Earnings</h3>
            <CurrencyDollarIcon className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">
              {earningsData.totalEarnings}
            </span>
            <span className="text-sm text-gray-500">tokens</span>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            {formatCurrency(earningsData.totalEarnings)}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Earnings Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Earnings Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyChartData}>
                <defs>
                  <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9333ea" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#9333ea" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#9333ea" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorEarnings)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Earnings Breakdown */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Earnings Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={breakdownChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#9333ea" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Revenue Streams</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Tips */}
          <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-lg">
            <div className="p-3 bg-purple-100 rounded-lg">
              <GiftIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Tips</p>
              <p className="text-lg font-semibold text-gray-900">{earningsData.breakdown.tips}</p>
              <p className="text-xs text-gray-500">{formatCurrency(earningsData.breakdown.tips)}</p>
            </div>
          </div>

          {/* Subscriptions */}
          <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
            <div className="p-3 bg-blue-100 rounded-lg">
              <UsersIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Subscriptions</p>
              <p className="text-lg font-semibold text-gray-900">{earningsData.breakdown.subscriptions}</p>
              <p className="text-xs text-gray-500">{formatCurrency(earningsData.breakdown.subscriptions)}</p>
            </div>
          </div>

          {/* Content */}
          <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg">
            <div className="p-3 bg-green-100 rounded-lg">
              <DocumentTextIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Content</p>
              <p className="text-lg font-semibold text-gray-900">{earningsData.breakdown.content}</p>
              <p className="text-xs text-gray-500">{formatCurrency(earningsData.breakdown.content)}</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex items-center gap-4 p-4 bg-orange-50 rounded-lg">
            <div className="p-3 bg-orange-100 rounded-lg">
              <ChatBubbleLeftRightIcon className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Messages</p>
              <p className="text-lg font-semibold text-gray-900">{earningsData.breakdown.messages}</p>
              <p className="text-xs text-gray-500">{formatCurrency(earningsData.breakdown.messages)}</p>
            </div>
          </div>

          {/* Live Streams */}
          <div className="flex items-center gap-4 p-4 bg-pink-50 rounded-lg">
            <div className="p-3 bg-pink-100 rounded-lg">
              <SignalIcon className="w-6 h-6 text-pink-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Live Streams</p>
              <p className="text-lg font-semibold text-gray-900">{earningsData.breakdown.liveStreams}</p>
              <p className="text-xs text-gray-500">{formatCurrency(earningsData.breakdown.liveStreams)}</p>
            </div>
          </div>

          {/* Video Calls */}
          <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-lg">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <VideoCameraIcon className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Video Calls</p>
              <p className="text-lg font-semibold text-gray-900">{earningsData.breakdown.videoCalls}</p>
              <p className="text-xs text-gray-500">{formatCurrency(earningsData.breakdown.videoCalls)}</p>
            </div>
          </div>

          {/* Voice Calls */}
          <div className="flex items-center gap-4 p-4 bg-teal-50 rounded-lg">
            <div className="p-3 bg-teal-100 rounded-lg">
              <PhoneIcon className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Voice Calls</p>
              <p className="text-lg font-semibold text-gray-900">{earningsData.breakdown.voiceCalls}</p>
              <p className="text-xs text-gray-500">{formatCurrency(earningsData.breakdown.voiceCalls)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Earning Days */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Earning Days</h3>
        <div className="space-y-3">
          {earningsData.topEarningDays.map((day, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold
                  ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-600'}`}>
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {new Date(day.date).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </p>
                  <p className="text-sm text-gray-600">{day.reason}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{day.amount} tokens</p>
                <p className="text-sm text-gray-600">{formatCurrency(day.amount)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EarningsPage;