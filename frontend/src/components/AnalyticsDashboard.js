import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Area, AreaChart, ComposedChart
} from 'recharts';
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  UsersIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  EyeIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  WifiIcon,
  SignalIcon,
  PlayIcon,
  PauseIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';
import analyticsCollector from '../utils/AnalyticsCollector';
import { getAuthToken } from '../utils/auth-helpers';

const AnalyticsDashboard = ({ user, className = '' }) => {
  const [analytics, setAnalytics] = useState(null);
  const [realtime, setRealtime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [activeTab, setActiveTab] = useState('overview');
  const [isRealTimeActive, setIsRealTimeActive] = useState(true);
  const [realtimeEvents, setRealtimeEvents] = useState([]);
  const [dashboardMetrics, setDashboardMetrics] = useState(null);
  const wsRef = useRef(null);
  const realtimeIntervalRef = useRef(null);

  const periods = {
    '7': '7 Days',
    '30': '30 Days',
    '90': '90 Days'
  };

  const tabs = {
    overview: { label: 'Overview', icon: '📊' },
    financial: { label: 'Financial Analytics', icon: '💰', section: 'financial' },
    performance: { label: 'Performance Analytics', icon: '📈', section: 'performance' }
  };
  
  // Sub-tabs for each section
  const financialTabs = {
    earnings: { label: 'Earnings', icon: CurrencyDollarIcon },
    revenue: { label: 'Revenue Sources', icon: ChartBarIcon },
    payouts: { label: 'Payouts', icon: ArrowTrendingUpIcon }
  };
  
  const performanceTabs = {
    sessions: { label: 'Sessions', icon: PlayIcon },
    fans: { label: 'Fan Analytics', icon: UsersIcon },
    engagement: { label: 'Engagement', icon: SignalIcon },
    content: { label: 'Content Performance', icon: EyeIcon }
  };

  useEffect(() => {
    if (user) {
      fetchAnalytics();
      fetchRealtime();
      
      // Initialize analytics collector for dashboard
      initializeAnalytics();
      
      // Set up realtime WebSocket connection
      setupRealtimeConnection();
      
      // Set up realtime updates
      setupRealtimeUpdates();
      
      return cleanup;
    }
  }, [user, selectedPeriod]);

  useEffect(() => {
    if (isRealTimeActive && user) {
      startRealtimeTracking();
    } else {
      stopRealtimeTracking();
    }
  }, [isRealTimeActive, user]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/analytics/creator/${user.id}?period=${selectedPeriod}`, {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeAnalytics = () => {
    // Set up analytics collector listeners
    analyticsCollector.on('event_tracked', handleAnalyticsEvent);
    analyticsCollector.on('events_flushed', handleEventsFlushed);
    
    // Track dashboard page view
    analyticsCollector.trackPageView('analytics_dashboard', {
      period: selectedPeriod,
      tab: activeTab
    });
  };

  const setupRealtimeConnection = () => {
    if (!user || wsRef.current) return;

    const wsUrl = `${import.meta.env.VITE_BACKEND_URL?.replace('http', 'ws')}/ws/analytics/${user.id}`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('📊 Analytics WebSocket connected');
      // Authenticate
      getAuthToken().then(token => {
        wsRef.current.send(JSON.stringify({
          type: 'authenticate',
          token
        }));
      });
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleRealtimeMessage(data);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('Analytics WebSocket error:', error);
    };

    wsRef.current.onclose = () => {
      console.log('📊 Analytics WebSocket closed');
      // Attempt reconnection after 5 seconds
      setTimeout(setupRealtimeConnection, 5000);
    };
  };

  const setupRealtimeUpdates = () => {
    realtimeIntervalRef.current = setInterval(() => {
      if (isRealTimeActive) {
        fetchRealtime();
      }
    }, 10000); // Every 10 seconds
  };

  const fetchRealtime = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/analytics/realtime/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRealtime(data.realtime);
        
        // Update dashboard metrics
        updateDashboardMetrics(data.realtime);
      }
    } catch (error) {
      console.error('Failed to fetch realtime data:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatGrowth = (growth) => {
    const sign = growth >= 0 ? '+' : '';
    const color = growth >= 0 ? 'text-green-600' : 'text-red-600';
    return <span className={color}>{sign}{growth.toFixed(1)}%</span>;
  };

  const handleAnalyticsEvent = (eventData) => {
    setRealtimeEvents(prev => [
      { ...eventData, id: Date.now() + Math.random() },
      ...prev.slice(0, 49) // Keep last 50 events
    ]);
  };

  const handleEventsFlushed = (data) => {
    console.log(`📊 Dashboard: ${data.count} events flushed to backend`);
  };

  const handleRealtimeMessage = (message) => {
    switch (message.type) {
      case 'session_started':
        setRealtime(prev => prev ? {
          ...prev,
          activeSessions: [...prev.activeSessions, message.data]
        } : null);
        break;

      case 'session_ended':
        setRealtime(prev => prev ? {
          ...prev,
          activeSessions: prev.activeSessions.filter(s => s.id !== message.data.sessionId)
        } : null);
        break;

      case 'revenue_update':
        setRealtime(prev => prev ? {
          ...prev,
          today: {
            ...prev.today,
            earnings_today: message.data.totalEarnings
          }
        } : null);
        break;

      case 'metrics_update':
        updateDashboardMetrics(message.data);
        break;

      default:
        console.log('Unknown realtime message:', message);
    }
  };

  const updateDashboardMetrics = (metrics) => {
    setDashboardMetrics({
      timestamp: Date.now(),
      activeSessions: metrics.activeSessions?.length || 0,
      todayEarnings: metrics.today?.earnings_today || 0,
      todaySessions: metrics.today?.sessions_today || 0,
      onlineFollowers: metrics.onlineFollowers || 0
    });
  };

  const startRealtimeTracking = () => {
    // Send enable message to WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'enable_realtime',
        enabled: true
      }));
    }
  };

  const stopRealtimeTracking = () => {
    // Send disable message to WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'enable_realtime',
        enabled: false
      }));
    }
  };

  const cleanup = () => {
    if (realtimeIntervalRef.current) {
      clearInterval(realtimeIntervalRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    analyticsCollector.off('event_tracked', handleAnalyticsEvent);
    analyticsCollector.off('events_flushed', handleEventsFlushed);
  };

  const toggleRealtimeTracking = () => {
    setIsRealTimeActive(!isRealTimeActive);
    
    analyticsCollector.trackInteraction('toggle_realtime_tracking', {
      enabled: !isRealTimeActive
    });
  };

  const COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

  if (loading && !analytics) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
        <div className="animate-pulse" data-testid="loading-skeleton">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 text-center ${className}`}>
        <div className="text-gray-500">
          <div className="text-4xl mb-4">📊</div>
          <p>No analytics data available</p>
        </div>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Real-time Status */}
      {realtime && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <span className="w-3 h-3 bg-green-400 rounded-full mr-2 animate-pulse"></span>
            Live Status
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Active Sessions</div>
              <div className="font-bold text-xl text-blue-600">{realtime.activeSessions.length}</div>
            </div>
            <div>
              <div className="text-gray-600">Today's Earnings</div>
              <div className="font-bold text-xl text-green-600">
                {formatCurrency(realtime.today.earnings_today || 0)}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Sessions Today</div>
              <div className="font-bold text-xl text-purple-600">{realtime.today.sessions_today || 0}</div>
            </div>
            <div>
              <div className="text-gray-600">Online Followers</div>
              <div className="font-bold text-xl text-orange-600">{realtime.onlineFollowers}</div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Total Earnings</p>
              <p className="text-2xl font-bold">{formatCurrency(analytics.creator.totalEarnings)}</p>
              <p className="text-xs text-purple-200 mt-1">
                {formatGrowth(analytics.growth.revenue)} vs previous period
              </p>
            </div>
            <div className="text-3xl opacity-80">💰</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Sessions</p>
              <p className="text-2xl font-bold">{formatNumber(analytics.creator.totalSessions)}</p>
              <p className="text-xs text-blue-200 mt-1">
                {formatGrowth(analytics.growth.sessions)} vs previous period
              </p>
            </div>
            <div className="text-3xl opacity-80">🎥</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Followers</p>
              <p className="text-2xl font-bold">{formatNumber(analytics.creator.followerCount)}</p>
              <p className="text-xs text-green-200 mt-1">
                {formatGrowth(analytics.growth.uniqueFans)} unique fans growth
              </p>
            </div>
            <div className="text-3xl opacity-80">👥</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-4 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Avg Rating</p>
              <p className="text-2xl font-bold">{analytics.creator.avgRating.toFixed(1)}</p>
              <p className="text-xs text-orange-200 mt-1">
                {'⭐'.repeat(Math.round(analytics.creator.avgRating))}
              </p>
            </div>
            <div className="text-3xl opacity-80">⭐</div>
          </div>
        </motion.div>
      </div>

      {/* Top Supporters Preview */}
      <div className="bg-gradient-to-br from-amber-50 via-white to-yellow-50 dark:from-amber-950/20 dark:via-gray-800 dark:to-yellow-950/20 rounded-xl border border-amber-100 dark:border-amber-900 shadow-lg overflow-hidden">
        <div className="p-6 pb-4 bg-gradient-to-r from-amber-100/50 to-yellow-100/50 dark:from-amber-900/30 dark:to-yellow-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 rounded-2xl shadow-lg">
                <TrophyIcon className="w-6 h-6 text-white drop-shadow-md" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Top Supporters</h3>
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Your top 5 fans</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('fans')}
              className="text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium"
            >
              View All →
            </button>
          </div>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {analytics.fans.topFans.slice(0, 5).map((fan, index) => (
              <div key={index} className="flex items-center justify-between p-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                    index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500' :
                    index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400' :
                    index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500' :
                    'bg-gradient-to-br from-purple-400 to-pink-400'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{fan.username}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{fan.sessionCount} sessions</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-amber-600">{fan.totalSpent.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">tokens</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Earnings Chart */}
      {/* Enhanced Earnings Chart with Real-time Updates */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Earnings Over Time</h3>
          {dashboardMetrics && (
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                Live: {formatCurrency(dashboardMetrics.todayEarnings)}
              </div>
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={analytics.earnings.dailyData} aria-label="Earnings over time chart">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Area 
              yAxisId="left"
              type="monotone" 
              dataKey="earnings" 
              stroke="#8B5CF6" 
              fill="#8B5CF6" 
              fillOpacity={0.3} 
            />
            <Bar 
              yAxisId="right"
              dataKey="sessions" 
              fill="#10B981" 
              name="Sessions"
              opacity={0.6}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderEarnings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Period Total</h3>
          <div className="text-3xl font-bold text-green-600">
            {formatCurrency(analytics.earnings.totalPeriod)}
          </div>
          <div className="text-sm text-gray-500 mt-2">
            Last {analytics.period.days} days
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue by Type</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart aria-label="Revenue by type chart">
              <Pie
                data={analytics.sessions.typeBreakdown}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                dataKey="revenue"
              >
                {analytics.sessions.typeBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Tips Overview</h3>
          <div className="space-y-3">
            {analytics.tips.dailyData.slice(-7).map((tip, index) => (
              <div key={index} className="flex justify-between">
                <span className="text-sm text-gray-600">{tip.date}</span>
                <span className="font-medium">{tip.tokens} tokens</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Daily Earnings & Sessions</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={analytics.earnings.dailyData} aria-label="Daily earnings and sessions chart">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Bar yAxisId="right" dataKey="sessions" fill="#8B5CF6" name="Sessions" />
            <Line 
              yAxisId="left" 
              type="monotone" 
              dataKey="earnings" 
              stroke="#10B981" 
              strokeWidth={3}
              name="Earnings ($)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderSessions = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {analytics.sessions.typeBreakdown.map((type, index) => (
          <motion.div
            key={type.type}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <h3 className="text-lg font-semibold mb-2 capitalize">
              {type.type} Sessions
            </h3>
            <div className="text-2xl font-bold text-purple-600">
              {formatNumber(type.count)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {formatCurrency(type.revenue)} revenue
            </div>
            <div className="text-sm text-gray-500">
              {type.avgDuration.toFixed(1)} min avg
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Hourly Activity Pattern</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analytics.sessions.hourlyActivity} aria-label="Hourly activity pattern chart">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="sessions" fill="#8B5CF6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderFans = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-sm text-blue-600">One-time Fans</div>
          <div className="text-2xl font-bold text-blue-700">
            {analytics.fans.retention.oneTimeFans}
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="text-sm text-yellow-600">Casual Fans</div>
          <div className="text-2xl font-bold text-yellow-700">
            {analytics.fans.retention.casualFans}
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-sm text-green-600">Loyal Fans</div>
          <div className="text-2xl font-bold text-green-700">
            {analytics.fans.retention.loyalFans}
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="text-sm text-purple-600">Avg Sessions/Fan</div>
          <div className="text-2xl font-bold text-purple-700">
            {analytics.fans.retention.avgSessionsPerFan.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Top Supporters - Enhanced Design */}
      <div className="bg-gradient-to-br from-amber-50 via-white to-yellow-50 dark:from-amber-950/20 dark:via-gray-800 dark:to-yellow-950/20 rounded-xl border border-amber-100 dark:border-amber-900 shadow-lg overflow-hidden">
        {/* Enhanced Header */}
        <div className="p-6 pb-4 bg-gradient-to-r from-amber-100/50 to-yellow-100/50 dark:from-amber-900/30 dark:to-yellow-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl blur-lg opacity-60 animate-pulse"></div>
                <div className="relative p-3 bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 rounded-2xl shadow-lg">
                  <TrophyIcon className="w-7 h-7 text-white drop-shadow-md" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Top Supporters</h3>
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                  Your most valuable fans this period
                </p>
              </div>
            </div>
            <div className="text-sm text-amber-700 dark:text-amber-300 font-medium">
              Top {analytics.fans.topFans.length} of {analytics.fans.retention.uniqueFans || 0} fans
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6">
          <div className="space-y-4">
            {analytics.fans.topFans.map((fan, index) => {
              const totalMaxSpent = Math.max(...analytics.fans.topFans.map(f => f.totalSpent));
              const spentPercentage = (fan.totalSpent / totalMaxSpent) * 100;
              
              return (
                <div
                  key={index}
                  className="group relative p-4 rounded-xl transition-all duration-300 hover:shadow-lg border border-transparent hover:border-amber-200 hover:bg-gradient-to-r hover:from-amber-50 hover:to-yellow-50 dark:hover:from-amber-950/20 dark:hover:to-yellow-950/20"
                >
                  {/* Rank Badge */}
                  <div className="absolute -top-2 -left-2">
                    <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-lg transform group-hover:scale-110 transition-transform ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 shadow-yellow-400/50' :
                      index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 shadow-gray-400/50' :
                      index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 shadow-orange-400/50' :
                      'bg-gradient-to-br from-purple-400 to-pink-400 shadow-purple-400/50'
                    }`}>
                      <span className="text-sm font-black">{index + 1}</span>
                      {index === 0 && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-300 rounded-full animate-ping"></div>
                      )}
                    </div>
                  </div>
                  
                  <div className="ml-8">
                    {/* Fan Info */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-400 to-blue-500 flex items-center justify-center text-white font-bold">
                          {fan.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                            {fan.username}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {fan.sessionCount} sessions • Last: {new Date(fan.lastSession).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600">
                          {fan.totalSpent.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">tokens</p>
                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                          ≈ {formatCurrency(fan.totalSpent * 0.05)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Spending Progress Bar */}
                    <div className="mb-2">
                      <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${spentPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Summary Stats */}
          <div className="mt-6 pt-6 border-t border-amber-200 dark:border-amber-800">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-amber-600">
                  {analytics.fans.topFans.reduce((sum, fan) => sum + fan.totalSpent, 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Total Tokens from Top Fans</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(analytics.fans.topFans.reduce((sum, fan) => sum + fan.totalSpent, 0) * 0.05)}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Revenue from Top Fans</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">
                  {((analytics.fans.topFans.reduce((sum, fan) => sum + fan.totalSpent, 0) / analytics.creator.totalEarnings) * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">of Total Revenue</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFinancial = () => (
    <div className="space-y-6">
      {/* Financial Sub-tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
        {Object.entries(financialTabs).map(([key, tab]) => {
          const Icon = tab.icon;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === key
                  ? 'bg-white dark:bg-gray-800 text-green-600 dark:text-green-400 shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(analytics.creator.totalEarnings)}</p>
              <p className="text-xs text-green-200 mt-1">
                {formatGrowth(analytics.growth.revenue)} vs last period
              </p>
            </div>
            <CurrencyDollarIcon className="w-8 h-8 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-cyan-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Period Earnings</p>
              <p className="text-2xl font-bold">{formatCurrency(analytics.earnings.totalPeriod)}</p>
              <p className="text-xs text-blue-200 mt-1">Last {analytics.period.days} days</p>
            </div>
            <ChartBarIcon className="w-8 h-8 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Avg per Session</p>
              <p className="text-2xl font-bold">
                {formatCurrency(analytics.creator.totalEarnings / analytics.creator.totalSessions)}
              </p>
              <p className="text-xs text-purple-200 mt-1">Per session revenue</p>
            </div>
            <ArrowTrendingUpIcon className="w-8 h-8 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Today's Earnings</p>
              <p className="text-2xl font-bold">
                {formatCurrency(realtime?.today?.earnings_today || 0)}
              </p>
              <p className="text-xs text-orange-200 mt-1">
                {realtime?.today?.sessions_today || 0} sessions
              </p>
            </div>
            <ClockIcon className="w-8 h-8 opacity-80" />
          </div>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Revenue by Type</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={analytics.sessions.typeBreakdown}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="revenue"
                label={({type, revenue}) => `${type}: ${formatCurrency(revenue)}`}
              >
                {analytics.sessions.typeBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={analytics.earnings.dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Area type="monotone" dataKey="earnings" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Revenue Sources */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Top Revenue Sources</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 text-gray-700 dark:text-gray-300">Fan</th>
                <th className="text-right py-2 text-gray-700 dark:text-gray-300">Sessions</th>
                <th className="text-right py-2 text-gray-700 dark:text-gray-300">Total Spent</th>
                <th className="text-right py-2 text-gray-700 dark:text-gray-300">Avg per Session</th>
              </tr>
            </thead>
            <tbody>
              {analytics.fans.topFans.slice(0, 5).map((fan, index) => (
                <tr key={index} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-3">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center text-white text-sm font-bold mr-3">
                        {fan.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">{fan.username}</span>
                    </div>
                  </td>
                  <td className="text-right py-3 text-gray-700 dark:text-gray-300">{fan.sessionCount}</td>
                  <td className="text-right py-3 font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(fan.totalSpent)}
                  </td>
                  <td className="text-right py-3 text-gray-700 dark:text-gray-300">
                    {formatCurrency(fan.totalSpent / fan.sessionCount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderPerformance = () => (
    <div className="space-y-6">
      {/* Performance Sub-tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
        {Object.entries(performanceTabs).map(([key, tab]) => {
          const Icon = tab.icon;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === key
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Performance Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Sessions</p>
              <p className="text-2xl font-bold">{formatNumber(analytics.creator.totalSessions)}</p>
              <p className="text-xs text-blue-200 mt-1">
                {formatGrowth(analytics.growth.sessions)} growth
              </p>
            </div>
            <PlayIcon className="w-8 h-8 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Total Fans</p>
              <p className="text-2xl font-bold">{formatNumber(analytics.creator.followerCount)}</p>
              <p className="text-xs text-purple-200 mt-1">
                {formatGrowth(analytics.growth.uniqueFans)} growth
              </p>
            </div>
            <UsersIcon className="w-8 h-8 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-yellow-500 to-orange-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm">Engagement Rate</p>
              <p className="text-2xl font-bold">
                {((analytics.fans.retention.loyalFans / analytics.creator.followerCount) * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-yellow-200 mt-1">Loyal fan ratio</p>
            </div>
            <SignalIcon className="w-8 h-8 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-teal-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Avg Rating</p>
              <p className="text-2xl font-bold">{analytics.creator.avgRating.toFixed(1)}</p>
              <p className="text-xs text-green-200 mt-1">
                {'⭐'.repeat(Math.round(analytics.creator.avgRating))}
              </p>
            </div>
            <EyeIcon className="w-8 h-8 opacity-80" />
          </div>
        </div>
      </div>

      {/* Engagement Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Session Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={analytics.sessions.typeBreakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Fan Retention</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">One-time Fans</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{analytics.fans.retention.oneTimeFans}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{width: `${(analytics.fans.retention.oneTimeFans / analytics.creator.followerCount) * 100}%`}}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">Casual Fans</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{analytics.fans.retention.casualFans}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-yellow-500 h-2 rounded-full" 
                  style={{width: `${(analytics.fans.retention.casualFans / analytics.creator.followerCount) * 100}%`}}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">Loyal Fans</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{analytics.fans.retention.loyalFans}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{width: `${(analytics.fans.retention.loyalFans / analytics.creator.followerCount) * 100}%`}}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Activity Pattern */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Peak Activity Hours</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analytics.sessions.hourlyActivity}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="sessions" fill="#06B6D4" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Live Sessions if active */}
      {realtime?.activeSessions?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
            <span className="w-3 h-3 bg-green-400 rounded-full mr-2 animate-pulse"></span>
            Active Sessions
          </h3>
          <div className="space-y-3">
            {realtime.activeSessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{session.fan_username}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">{session.type} session</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600 dark:text-green-400">
                    ${session.price_per_min}/min
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Started {new Date(session.start_time).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={`bg-gray-50 rounded-xl shadow-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
            <p className="text-purple-100 mt-1">
              Creator insights for {analytics.creator.username}
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Real-time Toggle */}
            <button
              onClick={toggleRealtimeTracking}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isRealTimeActive
                  ? 'bg-green-500/20 text-green-100 border border-green-400/30'
                  : 'bg-white/10 text-white/70 border border-white/20'
              }`}
              aria-label={isRealTimeActive ? 'Pause real-time tracking' : 'Enable real-time tracking'}
              aria-pressed={isRealTimeActive}
              onKeyDown={(e) => e.key === 'Enter' && toggleRealtimeTracking()}
            >
              {isRealTimeActive ? (
                <>
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  <span>Live</span>
                </>
              ) : (
                <>
                  <PauseIcon className="w-4 h-4" />
                  <span>Paused</span>
                </>
              )}
            </button>
            
            <select
              value={selectedPeriod}
              onChange={(e) => {
                setSelectedPeriod(e.target.value);
                analyticsCollector.trackInteraction('period_changed', {
                  period: e.target.value
                });
              }}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              aria-label="Select time period"
            >
              {Object.entries(periods).map(([value, label]) => (
                <option key={value} value={value} className="text-gray-900">
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Section Tabs */}
        <div className="flex mt-6 bg-white/10 rounded-lg p-1" role="tablist">
          {Object.entries(tabs).map(([key, tab]) => (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key);
                analyticsCollector.trackInteraction('tab_changed', {
                  tab: key,
                  previousTab: activeTab
                });
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === key
                  ? 'bg-white text-purple-600 shadow-md'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              role="tab"
              aria-selected={activeTab === key}
              aria-label={`${tab.label} tab`}
              onKeyDown={(e) => e.key === 'Enter' && (setActiveTab(key), analyticsCollector.trackInteraction('tab_changed', {tab: key, previousTab: activeTab}))}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Section Header for Financial/Performance */}
        {activeTab === 'financial' && (
          <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border border-green-200 dark:border-green-800">
            <h3 className="text-lg font-bold text-green-900 dark:text-green-100 mb-2">💰 Financial Analytics</h3>
            <p className="text-sm text-green-700 dark:text-green-300">Track your earnings, revenue streams, and financial performance</p>
          </div>
        )}
        
        {activeTab === 'performance' && (
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-2">📈 Performance Analytics</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">Monitor engagement, audience growth, and content performance</p>
          </div>
        )}
        
        {/* Real-time Events Stream (when active) */}
        {isRealTimeActive && realtimeEvents.length > 0 && activeTab === 'overview' && (
          <div className="mb-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <span className="w-3 h-3 bg-blue-400 rounded-full mr-2 animate-pulse"></span>
                Live Events
              </h3>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {realtimeEvents.slice(0, 5).map((event) => (
                  <div key={event.id} className="text-xs text-blue-700 flex items-center justify-between">
                    <span className="capitalize">{event.eventType.replace('_', ' ')}</span>
                    <span className="text-blue-500">
                      {new Date(event.timestamp || Date.now()).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'financial' && renderFinancial()}
            {activeTab === 'performance' && renderPerformance()}
            {activeTab === 'earnings' && renderEarnings()}
            {activeTab === 'revenue' && renderEarnings()}
            {activeTab === 'payouts' && renderEarnings()}
            {activeTab === 'sessions' && renderSessions()}
            {activeTab === 'fans' && renderFans()}
            {activeTab === 'engagement' && renderFans()}
            {activeTab === 'content' && renderSessions()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

AnalyticsDashboard.propTypes = {
  user: PropTypes.object.isRequired,
  className: PropTypes.string
};

AnalyticsDashboard.defaultProps = {
  className: ''
};

export default memo(AnalyticsDashboard);