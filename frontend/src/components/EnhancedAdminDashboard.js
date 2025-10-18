import React, { useState, useEffect, useCallback, memo, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BellIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserGroupIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  QueueListIcon,
  ArrowTrendingUpIcon,
  CurrencyDollarIcon,
  ShieldExclamationIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  Cog6ToothIcon,
  DocumentMagnifyingGlassIcon,
  BoltIcon,
  CalendarIcon,
  MapPinIcon,
  TagIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { BellAlertIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import socketService from '../services/socketServiceWrapper';
import { getAuthToken } from '../utils/auth-helpers';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import PropTypes from 'prop-types';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { FixedSizeList as List } from 'react-window';
import debounce from 'lodash/debounce';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

// Lazy load heavy components
const AdminUserManagement = lazy(() => import('./AdminUserManagement'));

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

// Number formatting utility
const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const EnhancedAdminDashboard = memo(({ user, className = '' }) => {
  // State Management
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [bulkSelection, setBulkSelection] = useState([]);
  const [showNotification, setShowNotification] = useState(false);
  const [newApplications, setNewApplications] = useState([]);
  const [activeView, setActiveView] = useState('dashboard');
  
  // Enhanced State for new features
  const [analyticsData, setAnalyticsData] = useState({
    revenue: [],
    growth: [],
    performance: [],
    conversions: []
  });
  const [filters, setFilters] = useState({
    dateRange: 'week',
    location: 'all',
    specialty: 'all',
    status: 'all',
    search: ''
  });
  const [savedFilters, setSavedFilters] = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [reportedContent, setReportedContent] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [exportLoading, setExportLoading] = useState(false);

  const tabs = {
    overview: { label: 'Overview', color: 'purple', icon: ChartBarIcon },
    pending: { label: 'Pending', color: 'orange', icon: ClockIcon },
    queued: { label: 'Queued', color: 'blue', icon: QueueListIcon },
    approved: { label: 'Approved', color: 'green', icon: CheckCircleIcon },
    rejected: { label: 'Rejected', color: 'red', icon: XCircleIcon },
    moderation: { label: 'Moderation', color: 'yellow', icon: ShieldExclamationIcon }
  };

  // Fetch Analytics Data
  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await fetchWithRetry('/api/admin/analytics/dashboard', {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      }, 3, 1000, 10000);
      
      const data = await response.json();
      setAnalyticsData(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  }, []);

  // Fetch Applications with Pagination
  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        status: filters.status === 'all' ? '' : filters.status,
        page,
        limit: 50,
        search: filters.search,
        location: filters.location,
        specialty: filters.specialty,
        dateRange: filters.dateRange
      });

      const response = await fetchWithRetry(`/admin/creator-applications?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      }, 3, 1000, 10000);
      
      const data = await response.json();
      setApplications(data.applications);
      setTotalPages(Math.ceil(data.total / 50));
    } catch (error) {
      console.error('Failed to fetch applications:', error);
      toast.error('Failed to fetch applications');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  // Fetch Activity Feed
  const fetchActivityFeed = useCallback(async () => {
    try {
      const response = await fetchWithRetry('/api/admin/activity-feed', {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      }, 3, 1000, 10000);
      
      const data = await response.json();
      setActivityFeed(data.activities);
    } catch (error) {
      console.error('Failed to fetch activity feed:', error);
    }
  }, []);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    try {
      const response = await fetchWithRetry('/api/admin/audit-logs', {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      }, 3, 1000, 10000);
      
      const data = await response.json();
      setAuditLogs(data.logs);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    }
  }, []);

  // Fetch Reported Content
  const fetchReportedContent = useCallback(async () => {
    try {
      const response = await fetchWithRetry('/api/admin/moderation/reports', {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      }, 3, 1000, 10000);
      
      const data = await response.json();
      setReportedContent(data.reports);
    } catch (error) {
      console.error('Failed to fetch reported content:', error);
    }
  }, []);

  // Debounced Search
  const debouncedSearch = useMemo(
    () => debounce((searchTerm) => {
      setFilters(prev => ({ ...prev, search: searchTerm }));
      setPage(1);
    }, 300),
    []
  );

  // Export Data Function
  const handleExportData = async (format = 'csv') => {
    setExportLoading(true);
    try {
      const response = await fetchWithRetry(`/admin/export/${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          type: selectedTab,
          filters,
          selection: bulkSelection
        })
      }, 3, 1000, 10000);
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admin-export-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`Data exported successfully as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data');
    } finally {
      setExportLoading(false);
    }
  };

  // Save Filter Preset
  const saveFilterPreset = () => {
    const presetName = prompt('Enter a name for this filter preset:');
    if (presetName) {
      const preset = { name: presetName, filters: { ...filters } };
      setSavedFilters(prev => [...prev, preset]);
      localStorage.setItem('adminFilterPresets', JSON.stringify([...savedFilters, preset]));
      toast.success('Filter preset saved');
    }
  };

  // Load saved filter presets on mount
  useEffect(() => {
    const savedPresets = localStorage.getItem('adminFilterPresets');
    if (savedPresets) {
      setSavedFilters(JSON.parse(savedPresets));
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    if (user) {
      fetchApplications();
      fetchAnalytics();
      fetchActivityFeed();
      
      if (selectedTab === 'moderation') {
        fetchReportedContent();
      }
    }
  }, [user, selectedTab, filters, page]);

  // Real-time WebSocket connections
  useEffect(() => {
    const handleNewApplication = (data) => {
      setNewApplications(prev => [...prev, data]);
      setActivityFeed(prev => [{
        type: 'new_application',
        message: `${data.displayName} applied to become a creator`,
        timestamp: new Date(),
        ...data
      }, ...prev.slice(0, 49)]);
      
      toast.custom((t) => (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-white rounded-lg shadow-xl p-4 flex items-center gap-3 max-w-md"
        >
          <div className="p-2 bg-purple-100 rounded-full">
            <BellAlertIcon className="h-6 w-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900">New Creator Application</h4>
            <p className="text-sm text-gray-600">{data.displayName} has applied</p>
          </div>
          <button
            onClick={() => {
              toast.dismiss(t.id);
              setSelectedTab('pending');
            }}
            className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
          >
            View
          </button>
        </motion.div>
      ), {
        duration: 10000,
        position: 'top-right'
      });
      
      fetchApplications();
      fetchAnalytics();
    };

    const handleRealtimeUpdate = (data) => {
      // Update relevant data based on event type
      if (data.type === 'stats_update') {
        setStats(data.stats);
      } else if (data.type === 'activity') {
        setActivityFeed(prev => [data, ...prev.slice(0, 49)]);
      }
    };

    if (socketService.socket?.connected) {
      socketService.socket.emit('join_admin_room');
    }
    
    socketService.socket?.on('new_creator_application', handleNewApplication);
    socketService.socket?.on('admin_realtime_update', handleRealtimeUpdate);

    return () => {
      socketService.socket?.off('new_creator_application', handleNewApplication);
      socketService.socket?.off('admin_realtime_update', handleRealtimeUpdate);
      if (socketService.socket?.connected) {
        socketService.socket.emit('leave_admin_room');
      }
    };
  }, [selectedTab]);

  // Risk Score Calculator
  const calculateRiskScore = (application) => {
    let score = 0;
    
    // Check various risk factors
    if (!application.bio || application.bio.length < 50) score += 20;
    if (!application.socialMedia?.instagram && !application.socialMedia?.twitter) score += 15;
    if (application.userStats?.totalSpent < 100) score += 10;
    if (!application.experience) score += 25;
    if (application.specialties?.length < 2) score += 10;
    
    // Check positive factors
    if (application.userStats?.totalSpent > 1000) score -= 20;
    if (application.userStats?.memberSince && 
        new Date(application.userStats.memberSince) < subDays(new Date(), 180)) score -= 15;
    
    return Math.max(0, Math.min(100, score));
  };

  // Render Analytics Charts - Mobile Responsive
  const renderAnalytics = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 p-4 sm:p-6">
      {/* Revenue Chart */}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
          <CurrencyDollarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
          Revenue Trends
        </h3>
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <ResponsiveContainer width="100%" height={180} minWidth={280}>
            <LineChart data={analyticsData.revenue} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatNumber(value)} />
              <Tooltip formatter={(value) => formatNumber(value)} />
              <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Growth Chart */}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
          <ArrowTrendingUpIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          User Growth
        </h3>
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <ResponsiveContainer width="100%" height={180} minWidth={280}>
            <AreaChart data={analyticsData.growth} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatNumber(value)} />
              <Tooltip formatter={(value) => formatNumber(value)} />
              <Area type="monotone" dataKey="users" fill="#3b82f6" stroke="#3b82f6" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
          <FunnelIcon className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
          Application Conversion
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={[
                { name: 'Approved', value: stats.approved || 0 },
                { name: 'Pending', value: stats.pending || 0 },
                { name: 'Rejected', value: stats.rejected || 0 }
              ]}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
              outerRadius={60}
              fill="#8884d8"
              dataKey="value"
            >
              {COLORS.map((color, index) => (
                <Cell key={`cell-${index}`} fill={color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-3 mt-2 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-purple-500 rounded"></span> Approved</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded"></span> Pending</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded"></span> Rejected</span>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 col-span-1 lg:col-span-2 xl:col-span-3">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Creator Performance Metrics</h3>
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <ResponsiveContainer width="100%" height={200} minWidth={400}>
            <BarChart data={analyticsData.performance} margin={{ top: 5, right: 10, left: -10, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="creator" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatNumber(value)} />
              <Tooltip formatter={(value) => formatNumber(value)} />
              <Legend iconSize={12} wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="earnings" fill="#8b5cf6" />
              <Bar dataKey="sessions" fill="#3b82f6" />
              <Bar dataKey="rating" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  // Loading Skeleton Component
  const LoadingSkeleton = () => (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  );

  // Stats Loading Skeleton
  const StatsLoadingSkeleton = () => (
    <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-white/10 backdrop-blur rounded-lg p-4 sm:p-3 animate-pulse">
          <div className="h-8 bg-white/20 rounded w-20 mb-2"></div>
          <div className="h-4 bg-white/20 rounded w-24"></div>
        </div>
      ))}
    </div>
  );

  // Render Activity Feed
  const renderActivityFeed = () => (
    <div className="bg-white rounded-xl shadow-lg p-6 max-h-96 overflow-y-auto">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <BoltIcon className="h-5 w-5 text-yellow-600" />
        Live Activity Feed
      </h3>
      <div className="space-y-3">
        {activityFeed.map((activity, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
          >
            <div className="p-2 bg-purple-100 rounded-full">
              <UserGroupIcon className="h-4 w-4 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-900">{activity.message}</p>
              <p className="text-xs text-gray-500">
                {format(new Date(activity.timestamp), 'MMM dd, HH:mm')}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  // Render Advanced Filters
  const renderAdvancedFilters = () => (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FunnelIcon className="h-5 w-5 text-purple-600" />
          Advanced Filters
        </h3>
        <div className="flex gap-2">
          <button
            onClick={saveFilterPreset}
            className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-lg hover:bg-purple-200"
          >
            Save Preset
          </button>
          {savedFilters.length > 0 && (
            <select
              onChange={(e) => {
                const preset = savedFilters[parseInt(e.target.value)];
                if (preset) setFilters(preset.filters);
              }}
              className="px-3 py-1 border rounded-lg text-sm"
            >
              <option value="">Load Preset...</option>
              {savedFilters.map((preset, index) => (
                <option key={index} value={index}>{preset.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            onChange={(e) => debouncedSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Date Range */}
        <select
          value={filters.dateRange}
          onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
          <option value="all">All Time</option>
        </select>

        {/* Location */}
        <select
          value={filters.location}
          onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="all">All Locations</option>
          <option value="us">United States</option>
          <option value="uk">United Kingdom</option>
          <option value="ca">Canada</option>
          <option value="au">Australia</option>
          <option value="other">Other</option>
        </select>

        {/* Specialty */}
        <select
          value={filters.specialty}
          onChange={(e) => setFilters(prev => ({ ...prev, specialty: e.target.value }))}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="all">All Specialties</option>
          <option value="fitness">Fitness</option>
          <option value="education">Education</option>
          <option value="entertainment">Entertainment</option>
          <option value="lifestyle">Lifestyle</option>
          <option value="business">Business</option>
        </select>

        {/* Status */}
        <select
          value={filters.status}
          onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="queued">Queued</option>
        </select>
      </div>

      {/* Active Filters Display */}
      {Object.entries(filters).some(([key, value]) => value !== 'all' && value !== '') && (
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(filters).map(([key, value]) => {
            if (value === 'all' || value === '') return null;
            return (
              <span
                key={key}
                className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full flex items-center gap-1"
              >
                {key}: {value}
                <button
                  onClick={() => setFilters(prev => ({ ...prev, [key]: key === 'search' ? '' : 'all' }))}
                  className="ml-1 text-purple-900 hover:text-purple-600"
                >
                  ×
                </button>
              </span>
            );
          })}
          <button
            onClick={() => setFilters({
              dateRange: 'week',
              location: 'all',
              specialty: 'all',
              status: 'all',
              search: ''
            })}
            className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-full hover:bg-gray-300"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );

  // Render Application with Risk Score
  const renderApplicationCard = (app) => {
    const riskScore = calculateRiskScore(app);
    const riskColor = riskScore < 30 ? 'green' : riskScore < 60 ? 'yellow' : 'red';
    
    return (
      <motion.div
        key={app.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`border rounded-xl p-4 transition-all ${
          bulkSelection.includes(app.id)
            ? 'border-blue-300 bg-blue-50'
            : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
        }`}
      >
        <div className="flex items-start gap-4">
          {/* Selection Checkbox */}
          {selectedTab === 'pending' && (
            <input
              type="checkbox"
              checked={bulkSelection.includes(app.id)}
              onChange={() => toggleBulkSelection(app.id)}
              className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
          )}

          {/* User Avatar with Risk Indicator */}
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-400 to-blue-500 flex items-center justify-center text-white font-bold">
              {app.profilePic ? (
                <img src={app.profilePic} alt={app.username} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                app.username?.charAt(0)?.toUpperCase() || 'U'
              )}
            </div>
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-${riskColor}-500 border-2 border-white`} 
                 title={`Risk Score: ${riskScore}%`} />
          </div>

          {/* Application Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-gray-900">{app.username}</h3>
                <p className="text-sm text-gray-600">{app.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-1 rounded-full bg-${riskColor}-100 text-${riskColor}-800`}>
                    Risk: {riskScore}%
                  </span>
                  {app.location && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPinIcon className="h-3 w-3" />
                      {app.location}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm text-gray-500">
                  {format(new Date(app.submittedAt), 'MMM dd, HH:mm')}
                </div>
                {app.reviewedAt && (
                  <div className="text-xs text-gray-400">
                    Reviewed: {format(new Date(app.reviewedAt), 'MMM dd')}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-2 text-xs bg-gray-50 rounded-lg p-2 mb-3">
              <div>
                <span className="text-gray-500">Spent:</span>
                <span className="ml-1 font-medium">${app.userStats?.totalSpent || 0}</span>
              </div>
              <div>
                <span className="text-gray-500">Since:</span>
                <span className="ml-1 font-medium">
                  {app.userStats?.memberSince 
                    ? format(new Date(app.userStats.memberSince), 'MMM yyyy')
                    : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Sessions:</span>
                <span className="ml-1 font-medium">{app.userStats?.sessionCount || 0}</span>
              </div>
              <div>
                <span className="text-gray-500">Rating:</span>
                <span className="ml-1 font-medium">{app.userStats?.avgRating || 'N/A'}</span>
              </div>
            </div>

            {/* Specialties */}
            <div className="flex flex-wrap gap-1 mb-3">
              {app.specialties?.slice(0, 3).map((specialty, i) => (
                <span key={i} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                  {specialty}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedApplication(app)}
                className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm rounded-lg"
              >
                View Details
              </button>
              
              {selectedTab === 'pending' && (
                <>
                  <button
                    onClick={() => handleApproveApplication(app.id)}
                    className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleQueueApplication(app.id)}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg"
                  >
                    Queue
                  </button>
                  <button
                    onClick={() => handleRejectApplication(app.id)}
                    className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // Virtualized List for Performance
  const Row = ({ index, style }) => (
    <div style={style}>
      {renderApplicationCard(applications[index])}
    </div>
  );

  const toggleBulkSelection = (applicationId) => {
    setBulkSelection(prev => 
      prev.includes(applicationId)
        ? prev.filter(id => id !== applicationId)
        : [...prev, applicationId]
    );
  };

  const handleApproveApplication = async (applicationId, reviewNotes = '') => {
    try {
      await fetchWithRetry(`/admin/creator-applications/${applicationId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ reviewNotes })
      }, 3, 1000, 10000);
      
      toast.success('Application approved successfully');
      fetchApplications();
      fetchAnalytics();
      setSelectedApplication(null);
      
      // Log audit action
      logAuditAction('approve_application', { applicationId });
    } catch (error) {
      console.error('Failed to approve application:', error);
      toast.error('Failed to approve application');
    }
  };

  const handleRejectApplication = async (applicationId, reason = '') => {
    try {
      await fetchWithRetry(`/admin/creator-applications/${applicationId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ reason })
      }, 3, 1000, 10000);
      
      toast.success('Application rejected');
      fetchApplications();
      fetchAnalytics();
      setSelectedApplication(null);
      
      // Log audit action
      logAuditAction('reject_application', { applicationId, reason });
    } catch (error) {
      console.error('Failed to reject application:', error);
      toast.error('Failed to reject application');
    }
  };

  const handleQueueApplication = async (applicationId, notes = '') => {
    try {
      await fetchWithRetry(`/admin/creator-applications/${applicationId}/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ notes })
      }, 3, 1000, 10000);
      
      toast.success('Application queued for later review');
      fetchApplications();
      setSelectedApplication(null);
      
      // Log audit action
      logAuditAction('queue_application', { applicationId, notes });
    } catch (error) {
      console.error('Failed to queue application:', error);
      toast.error('Failed to queue application');
    }
  };

  const logAuditAction = async (action, details) => {
    try {
      await fetchWithRetry('/api/admin/audit-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ action, details, timestamp: new Date() })
      }, 3, 1000, 10000);
    } catch (error) {
      console.error('Failed to log audit action:', error);
    }
  };

  return (
    <div className={`bg-gray-50 min-h-screen ${className}`}>
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 p-6 text-white">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => fetchApplications()}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              title="Refresh Data"
            >
              <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => handleExportData('csv')}
              disabled={exportLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              Export
            </button>
          </div>
        </div>

        {/* Main Navigation - Mobile Optimized */}
        <div className="flex gap-1 sm:gap-2 mb-6 overflow-x-auto scrollbar-hide">
          {[
            { view: 'dashboard', icon: ChartBarIcon, label: 'Dashboard' },
            { view: 'applications', icon: QueueListIcon, label: 'Applications' },
            { view: 'users', icon: UserGroupIcon, label: 'Users' },
            { view: 'moderation', icon: ShieldExclamationIcon, label: 'Moderation' },
            { view: 'audit', icon: DocumentMagnifyingGlassIcon, label: 'Audit' }
          ].map(({ view, icon: Icon, label }) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={`
                flex flex-col sm:flex-row items-center justify-center
                gap-0.5 sm:gap-2
                px-2 sm:px-3 py-2
                rounded-lg font-medium transition-colors whitespace-nowrap
                min-w-[60px] sm:min-w-0
                ${
                  activeView === view
                    ? 'bg-white text-purple-600 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }
              `}
              title={label}
            >
              <Icon className="h-5 w-5 sm:h-5 sm:w-5" />
              <span className="text-[10px] sm:text-sm mt-0.5 sm:mt-0 block sm:hidden">
                {label.slice(0, 4)}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Stats Overview - Mobile Optimized with Loading Skeleton */}
        {loading ? (
          <StatsLoadingSkeleton />
        ) : (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 sm:p-3">
              <div className="text-2xl font-bold">{formatNumber(stats.totalUsers || 0)}</div>
              <div className="text-sm text-white/80">Total Users</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 sm:p-3">
              <div className="text-2xl font-bold">{formatNumber(stats.activeCreators || 0)}</div>
              <div className="text-sm text-white/80">Active Creators</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 sm:p-3">
              <div className="text-2xl font-bold">${formatNumber(stats.revenue?.today || 0)}</div>
              <div className="text-sm text-white/80">Today's Revenue</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 sm:p-3">
              <div className="text-2xl font-bold">{formatNumber(stats.pending || 0)}</div>
              <div className="text-sm text-white/80">Pending Apps</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 sm:p-3">
              <div className="text-2xl font-bold">{formatNumber(stats.activeSessions || 0)}</div>
              <div className="text-sm text-white/80">Active Sessions</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 sm:p-3">
              <div className="text-2xl font-bold">{formatNumber(stats.reports || 0)}</div>
              <div className="text-sm text-white/80">Open Reports</div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="p-6">
        {activeView === 'dashboard' && (
          <>
            {renderAnalytics()}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              <div className="lg:col-span-2">
                {renderAdvancedFilters()}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Recent Applications</h3>
                  <div className="space-y-4">
                    {applications.slice(0, 5).map(app => renderApplicationCard(app))}
                  </div>
                </div>
              </div>
              <div>
                {renderActivityFeed()}
              </div>
            </div>
          </>
        )}

        {activeView === 'applications' && (
          <>
            {renderAdvancedFilters()}
            
            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-lg mb-6 p-1">
              <div className="flex" role="tablist">
                {Object.entries(tabs).map(([key, tab]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedTab(key);
                      setFilters(prev => ({ ...prev, status: key === 'overview' ? 'all' : key }));
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                      selectedTab === key
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    {stats[key] !== undefined && (
                      <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                        selectedTab === key ? 'bg-white/20' : 'bg-gray-200'
                      }`}>
                        {stats[key]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk Actions */}
            {bulkSelection.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-blue-800">
                    {bulkSelection.length} application{bulkSelection.length > 1 ? 's' : ''} selected
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        for (const id of bulkSelection) {
                          await handleApproveApplication(id);
                        }
                        setBulkSelection([]);
                      }}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg"
                    >
                      Bulk Approve
                    </button>
                    <button
                      onClick={() => handleExportData('csv')}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg"
                    >
                      Export Selected
                    </button>
                    <button
                      onClick={() => setBulkSelection([])}
                      className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-lg"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Applications List with Virtualization */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              {applications.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <DocumentMagnifyingGlassIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <div className="text-lg">No applications found</div>
                  <div className="text-sm mt-2">Try adjusting your filters</div>
                </div>
              ) : (
                <>
                  {applications.length > 100 ? (
                    <List
                      height={600}
                      itemCount={applications.length}
                      itemSize={150}
                      width="100%"
                    >
                      {Row}
                    </List>
                  ) : (
                    <div className="space-y-4">
                      {applications.map(app => renderApplicationCard(app))}
                    </div>
                  )}
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 border rounded-lg disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1 border rounded-lg disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {activeView === 'users' && <AdminUserManagement />}

        {activeView === 'moderation' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <ShieldExclamationIcon className="h-7 w-7 text-yellow-600" />
              Content Moderation
            </h2>
            <div className="space-y-4">
              {reportedContent.map((report, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{report.contentType}</h3>
                      <p className="text-sm text-gray-600">{report.reason}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Reported by {report.reporter} • {format(new Date(report.timestamp), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600">
                        Remove Content
                      </button>
                      <button className="px-3 py-1 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600">
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'audit' && (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
              <DocumentMagnifyingGlassIcon className="h-6 w-6 sm:h-7 sm:w-7 text-purple-600" />
              Audit Logs
            </h2>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="min-w-[600px] w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-sm sm:text-base">Action</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-sm sm:text-base">User</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-sm sm:text-base hidden sm:table-cell">Details</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-sm sm:text-base">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-sm">{log.action}</td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-sm">{log.user}</td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600 hidden sm:table-cell">
                        <div className="max-w-xs truncate">{JSON.stringify(log.details)}</div>
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-500">
                        {format(new Date(log.timestamp), 'MMM dd, HH:mm')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

EnhancedAdminDashboard.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.string
  }),
  className: PropTypes.string
};

EnhancedAdminDashboard.displayName = 'EnhancedAdminDashboard';

export default EnhancedAdminDashboard;