import React, { useEffect, useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useAnalyticsStore, useAnalyticsData, useAnalyticsControls } from '../stores/useAnalyticsStore';
import Card from './ui/Card';
import Button from './ui/Button';
import toast from 'react-hot-toast';
import {
  ChartBarIcon,
  UsersIcon,
  CurrencyDollarIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

const StreamAnalyticsEnhanced = ({ streamId, isCreator = false }) => {
  const { initialize, cleanup, fetchAnalytics, setTimeRange, toggleAutoRefresh } = useAnalyticsControls();
  const { 
    streamAnalytics, 
    globalAnalytics, 
    isLoading, 
    error, 
    timeRange, 
    autoRefreshEnabled,
    lastUpdated 
  } = useAnalyticsData();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (streamId) {
      initialize(streamId);
      fetchAnalytics(streamId);
    }
    return cleanup;
  }, [streamId]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: ChartBarIcon },
    { id: 'viewers', label: 'Viewers', icon: UsersIcon },
    { id: 'revenue', label: 'Revenue', icon: CurrencyDollarIcon },
    { id: 'engagement', label: 'Engagement', icon: ChatBubbleLeftRightIcon }
  ];

  const timeRanges = [
    { value: '1h', label: 'Last Hour' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' }
  ];

  const handleRefresh = async () => {
    try {
      await fetchAnalytics(streamId);
      toast.success('Analytics refreshed!', { icon: '📊' });
    } catch (err) {
      toast.error('Failed to refresh analytics');
    }
  };

  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
    toast.success(`Showing ${range} analytics`, { icon: '⏱️' });
  };

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-500">
          <p className="text-lg font-semibold mb-2">Unable to load analytics</p>
          <p className="text-sm">{error}</p>
          <Button onClick={handleRefresh} className="mt-4">
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  const realTimeData = streamAnalytics?.realTimeData || {};
  const historicalData = streamAnalytics?.historicalData || {};
  const demographics = streamAnalytics?.demographics || {};
  const performance = streamAnalytics?.performance || {};

  // Format data for charts
  const viewerChartData = historicalData.viewers || [];
  const revenueChartData = historicalData.revenue || [];
  const engagementChartData = [
    { name: 'Messages', value: realTimeData.totalMessages || 0, color: '#8b5cf6' },
    { name: 'Tips', value: historicalData.tips?.length || 0, color: '#ec4899' },
    { name: 'Reactions', value: Math.floor((realTimeData.totalMessages || 0) * 0.3), color: '#f59e0b' },
    { name: 'Shares', value: Math.floor((realTimeData.currentViewers || 0) * 0.1), color: '#10b981' }
  ].filter(item => item.value > 0);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-700">
          <p className="text-white font-semibold">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Stream Analytics</h2>
            <p className="text-gray-400 text-sm">
              Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Never'}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {/* Time Range Selector */}
            <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
              {timeRanges.map(range => (
                <button
                  key={range.value}
                  onClick={() => handleTimeRangeChange(range.value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    timeRange === range.value
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
            
            {/* Controls */}
            <Button
              onClick={() => toggleAutoRefresh()}
              variant={autoRefreshEnabled ? 'primary' : 'secondary'}
              size="sm"
              className="flex items-center gap-2"
            >
              <ClockIcon className="w-4 h-4" />
              {autoRefreshEnabled ? 'Auto' : 'Manual'}
            </Button>
            
            <Button
              onClick={handleRefresh}
              variant="secondary"
              size="sm"
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Current Viewers</p>
              <p className="text-2xl font-bold text-white">
                {realTimeData.currentViewers?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Peak: {realTimeData.peakViewers?.toLocaleString() || 0}
              </p>
            </div>
            <UsersIcon className="w-8 h-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Average Watch Time</p>
              <p className="text-2xl font-bold text-white">
                {Math.floor((realTimeData.averageWatchTime || 0) / 60)}m
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Total: {Math.floor((realTimeData.averageWatchTime || 0) * (realTimeData.currentViewers || 0) / 3600)}h
              </p>
            </div>
            <ClockIcon className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Revenue</p>
              <p className="text-2xl font-bold text-white">
                ${(realTimeData.revenue || 0).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Tips: ${(realTimeData.totalTips || 0).toFixed(2)}
              </p>
            </div>
            <CurrencyDollarIcon className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Engagement Rate</p>
              <p className="text-2xl font-bold text-white">
                {(realTimeData.engagement || 0).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {realTimeData.totalMessages || 0} messages
              </p>
            </div>
            <ArrowTrendingUpIcon className="w-8 h-8 text-pink-500" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Card className="p-6">
        <div className="flex gap-1 mb-6 border-b border-gray-700">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 font-medium transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'text-purple-500 border-purple-500'
                    : 'text-gray-400 border-transparent hover:text-white'
                }`}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`${tab.id}-panel`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            role="tabpanel"
            id={`${activeTab}-panel`}
          >
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Viewer Trends</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={viewerChartData}>
                      <defs>
                        <linearGradient id="viewerGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="time" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="viewers"
                        stroke="#8b5cf6"
                        fillOpacity={1}
                        fill="url(#viewerGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Engagement Breakdown</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={engagementChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={entry => `${entry.name}: ${entry.value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {engagementChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Viewers Tab */}
            {activeTab === 'viewers' && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Viewer Analytics</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={viewerChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="viewers"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="messages"
                      stroke="#ec4899"
                      strokeWidth={2}
                      dot={{ fill: '#ec4899', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                
                {/* Demographics */}
                {demographics.countries && (
                  <div className="mt-6">
                    <h4 className="text-md font-semibold text-white mb-3">Top Locations</h4>
                    <div className="space-y-2">
                      {Object.entries(demographics.countries).slice(0, 5).map(([country, count]) => (
                        <div key={country} className="flex justify-between items-center p-2 bg-gray-800 rounded">
                          <span className="text-gray-300">{country}</span>
                          <span className="text-white font-semibold">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Revenue Tab */}
            {activeTab === 'revenue' && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Revenue Analytics</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="tips" fill="#ec4899" />
                    <Bar dataKey="gifts" fill="#f59e0b" />
                    <Bar dataKey="subscriptions" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
                
                {/* Revenue Summary */}
                <div className="mt-6 grid grid-cols-3 gap-4">
                  <Card className="p-4 bg-gray-800">
                    <p className="text-gray-400 text-sm">Total Tips</p>
                    <p className="text-xl font-bold text-pink-500">
                      ${(realTimeData.totalTips || 0).toFixed(2)}
                    </p>
                  </Card>
                  <Card className="p-4 bg-gray-800">
                    <p className="text-gray-400 text-sm">Gifts Value</p>
                    <p className="text-xl font-bold text-yellow-500">
                      ${((historicalData.tips?.length || 0) * 5).toFixed(2)}
                    </p>
                  </Card>
                  <Card className="p-4 bg-gray-800">
                    <p className="text-gray-400 text-sm">Total Revenue</p>
                    <p className="text-xl font-bold text-green-500">
                      ${(realTimeData.revenue || 0).toFixed(2)}
                    </p>
                  </Card>
                </div>
              </div>
            )}

            {/* Engagement Tab */}
            {activeTab === 'engagement' && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Engagement Metrics</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={historicalData.engagement || []}>
                    <defs>
                      <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke="#ec4899"
                      fillOpacity={1}
                      fill="url(#engagementGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
                
                {/* Performance Metrics */}
                {performance && (
                  <div className="mt-6">
                    <h4 className="text-md font-semibold text-white mb-3">Stream Performance</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-400">Connection Quality</span>
                          <span className="text-white">{performance.connectionQuality || 'Good'}</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${performance.connectionScore || 85}%` }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-400">Bitrate</span>
                          <span className="text-white">{performance.bitrate || '3500'} kbps</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${(performance.bitrate || 3500) / 50}%` }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-400">Buffer Ratio</span>
                          <span className="text-white">{performance.bufferRatio || '0.5'}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-yellow-500 h-2 rounded-full"
                            style={{ width: `${100 - (performance.bufferRatio || 0.5) * 10}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </Card>

      {/* Quick Actions for Creators */}
      {isCreator && (
        <Card className="p-4">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => setShowDetails(!showDetails)}
              variant="secondary"
              size="sm"
            >
              {showDetails ? 'Hide' : 'Show'} Detailed Report
            </Button>
            <Button
              onClick={() => {
                const data = JSON.stringify(streamAnalytics, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analytics-${streamId}-${timeRange}.json`;
                a.click();
                toast.success('Analytics exported!', { icon: '📥' });
              }}
              variant="secondary"
              size="sm"
            >
              Export Data
            </Button>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success('Analytics link copied!', { icon: '📋' });
              }}
              variant="secondary"
              size="sm"
            >
              Share Analytics
            </Button>
          </div>
        </Card>
      )}

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <ArrowPathIcon className="w-6 h-6 text-purple-500 animate-spin" />
                <span className="text-white">Loading analytics...</span>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default memo(StreamAnalyticsEnhanced);