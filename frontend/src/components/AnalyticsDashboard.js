import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  PauseIcon
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
    earnings: { label: 'Earnings', icon: '💰' },
    sessions: { label: 'Sessions', icon: '🎥' },
    fans: { label: 'Fans', icon: '👥' },
    performance: { label: 'Performance', icon: '📈' }
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
      const response = await fetch(`/api/analytics/creator/${user.id}?period=${selectedPeriod}`, {
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
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/analytics/realtime/${user.id}`, {
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
          <ComposedChart data={analytics.earnings.dailyData}>
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
            <PieChart>
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
          <LineChart data={analytics.earnings.dailyData}>
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
          <BarChart data={analytics.sessions.hourlyActivity}>
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

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Top Fans</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2">Fan</th>
                <th className="text-right py-2">Sessions</th>
                <th className="text-right py-2">Total Spent</th>
                <th className="text-right py-2">Last Session</th>
              </tr>
            </thead>
            <tbody>
              {analytics.fans.topFans.map((fan, index) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-3">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold mr-3">
                        {fan.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{fan.username}</span>
                    </div>
                  </td>
                  <td className="text-right py-3">{fan.sessionCount}</td>
                  <td className="text-right py-3 font-medium text-green-600">
                    {formatCurrency(fan.totalSpent)}
                  </td>
                  <td className="text-right py-3 text-sm text-gray-500">
                    {new Date(fan.lastSession).toLocaleDateString()}
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Growth Metrics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Session Growth</span>
              <span className="font-bold">{formatGrowth(analytics.growth.sessions)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Revenue Growth</span>
              <span className="font-bold">{formatGrowth(analytics.growth.revenue)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Fan Growth</span>
              <span className="font-bold">{formatGrowth(analytics.growth.uniqueFans)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Performance Score</h3>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">
              {Math.round((analytics.creator.avgRating / 5) * 100)}
            </div>
            <div className="text-gray-500">Overall Score</div>
            <div className="mt-4 flex justify-center">
              {'⭐'.repeat(Math.round(analytics.creator.avgRating))}
            </div>
          </div>
        </div>
      </div>

      {realtime?.activeSessions.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Active Sessions</h3>
          <div className="space-y-3">
            {realtime.activeSessions.map((session, index) => (
              <div key={session.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <div className="font-medium">{session.fan_username}</div>
                  <div className="text-sm text-gray-600 capitalize">{session.type} session</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600">
                    ${session.price_per_min}/min
                  </div>
                  <div className="text-xs text-gray-500">
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
            >
              {Object.entries(periods).map(([value, label]) => (
                <option key={value} value={value} className="text-gray-900">
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex mt-6 bg-white/10 rounded-lg p-1">
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
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
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
            {activeTab === 'earnings' && renderEarnings()}
            {activeTab === 'sessions' && renderSessions()}
            {activeTab === 'fans' && renderFans()}
            {activeTab === 'performance' && renderPerformance()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;