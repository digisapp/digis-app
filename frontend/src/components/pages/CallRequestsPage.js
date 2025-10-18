import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhoneIcon,
  VideoCameraIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  BellIcon,
  SparklesIcon,
  ChartBarIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  CurrencyDollarIcon,
  StarIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import { getAuthToken } from '../../utils/supabase-auth';
import toast from 'react-hot-toast';
import Container from '../ui/Container';

const CallRequestsPage = ({ user }) => {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, video, voice
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, amount
  const [processingRequest, setProcessingRequest] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({
    pendingRequests: 0,
    acceptedWeek: 0,
    totalWeekTokens: 0,
    acceptedMonth: 0,
    totalMonthTokens: 0
  });

  // Mock data for demonstration
  const mockRequests = [
    {
      id: 1,
      fan: {
        id: 'fan1',
        name: 'Sarah Johnson',
        avatar: null,
        username: '@sarahj',
        memberSince: '2024-01-15',
        totalSpent: 5000,
        callHistory: 3,
        rating: 4.8
      },
      type: 'video',
      duration: 30,
      scheduled_date: '2024-03-25',
      scheduled_time: '14:00',
      message: "Hi! I'd love to discuss my fitness journey with you and get some personalized advice.",
      offering_tokens: 500,
      status: 'pending',
      created_at: new Date(Date.now() - 3600000),
      urgency: 'normal'
    },
    {
      id: 2,
      fan: {
        id: 'fan2',
        name: 'Michael Chen',
        avatar: null,
        username: '@mchen',
        memberSince: '2023-11-20',
        totalSpent: 12000,
        callHistory: 8,
        rating: 5.0
      },
      type: 'voice',
      duration: 15,
      scheduled_date: '2024-03-25',
      scheduled_time: '16:30',
      message: "Quick question about the workout plan you mentioned in your last stream!",
      offering_tokens: 250,
      status: 'pending',
      created_at: new Date(Date.now() - 7200000),
      urgency: 'high'
    },
    {
      id: 3,
      fan: {
        id: 'fan3',
        name: 'Emma Wilson',
        avatar: null,
        username: '@emmaw',
        memberSince: '2024-02-01',
        totalSpent: 3000,
        callHistory: 2,
        rating: 4.5
      },
      type: 'video',
      duration: 45,
      scheduled_date: '2024-03-26',
      scheduled_time: '10:00',
      message: "Would love to get your advice on starting my own fitness content creation journey.",
      offering_tokens: 750,
      status: 'pending',
      created_at: new Date(Date.now() - 10800000),
      urgency: 'low'
    }
  ];

  useEffect(() => {
    fetchCallRequests();
    calculateStats();
  }, [activeTab, filterType, sortBy]);

  const fetchCallRequests = async () => {
    try {
      setIsLoading(true);
      const authToken = await getAuthToken();
      
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/sessions/requests?status=${activeTab}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Transform the real API data to match component structure
        const transformedRequests = (data.requests || []).map(req => ({
          id: req.id,
          fan: {
            id: req.fan_id,
            name: req.fan_username || 'User',
            avatar: req.fan_profile_pic,
            username: `@${req.fan_username || 'user'}`,
            memberSince: req.created_at,
            totalSpent: 0, // This would need a separate API call
            callHistory: 0, // This would need a separate API call
            rating: 0 // This would need a separate API call
          },
          type: req.type || (req.request_type === 'session_invite' ? 'video' : 'voice'),
          duration: req.duration_minutes || req.estimated_duration || 30,
          scheduled_date: req.scheduled_date,
          scheduled_time: req.scheduled_time,
          message: req.message || '',
          offering_tokens: (req.price_per_minute || req.rate_per_min || 10) * (req.duration_minutes || req.estimated_duration || 30),
          status: req.status,
          created_at: req.created_at,
          urgency: 'normal',
          expires_at: req.expires_at,
          request_type: req.request_type
        }));
        
        // Apply local filtering based on type
        let filtered = transformedRequests;
        if (filterType !== 'all') {
          filtered = transformedRequests.filter(r => r.type === filterType);
        }
        
        // Apply sorting
        filtered = sortRequests(filtered);
        setRequests(filtered);
      } else {
        // No requests found or error
        setRequests([]);
      }
    } catch (error) {
      console.error('Error fetching call requests:', error);
      setRequests([]);
      toast.error('Failed to load call requests');
    } finally {
      setIsLoading(false);
    }
  };

  const sortRequests = (requestsToSort) => {
    const sorted = [...requestsToSort];
    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      case 'amount':
        return sorted.sort((a, b) => b.offering_tokens - a.offering_tokens);
      default:
        return sorted;
    }
  };

  const calculateStats = () => {
    const pending = requests.filter(r => r.status === 'pending');
    
    // Calculate week stats (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const acceptedWeek = requests.filter(r => 
      r.status === 'accepted' && 
      new Date(r.accepted_at) >= weekAgo
    );
    const totalWeekTokens = acceptedWeek.reduce((sum, r) => sum + r.offering_tokens, 0);
    
    // Calculate month stats (last 30 days)
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const acceptedMonth = requests.filter(r => 
      r.status === 'accepted' && 
      new Date(r.accepted_at) >= monthAgo
    );
    const totalMonthTokens = acceptedMonth.reduce((sum, r) => sum + r.offering_tokens, 0);
    
    setStats({
      pendingRequests: pending.length,
      acceptedWeek: acceptedWeek.length,
      totalWeekTokens,
      acceptedMonth: acceptedMonth.length,
      totalMonthTokens
    });
  };

  const handleAcceptRequest = async (request) => {
    try {
      setProcessingRequest(request.id);
      const authToken = await getAuthToken();
      
      const endpoint = request.request_type === 'session_invite'
        ? `/sessions/invites/${request.id}/accept`
        : `/sessions/requests/${request.id}/accept`;
      
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}${endpoint}`,
        {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        toast.success('Call request accepted!');
        // Refresh the list
        await fetchCallRequests();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to accept request');
      }
    } catch (error) {
      console.error('Error accepting request:', error);
      toast.error('Failed to accept request');
    } finally {
      setProcessingRequest(null);
    }
  };
  
  const handleDeclineRequest = async (request) => {
    try {
      setProcessingRequest(request.id);
      const authToken = await getAuthToken();
      
      const endpoint = request.request_type === 'session_invite'
        ? `/sessions/invites/${request.id}/decline`
        : `/sessions/requests/${request.id}/decline`;
      
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}${endpoint}`,
        {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason: 'Not available' })
        }
      );
      
      if (response.ok) {
        toast.success('Call request declined');
        // Refresh the list
        await fetchCallRequests();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to decline request');
      }
    } catch (error) {
      console.error('Error declining request:', error);
      toast.error('Failed to decline request');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRescheduleRequest = async (request, newDate, newTime) => {
    try {
      setProcessingRequest(request.id);
      const authToken = await getAuthToken();
      
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/sessions/requests/${request.id}/reschedule`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            new_date: newDate,
            new_time: newTime,
            message: 'Creator suggested a new time'
          })
        }
      );

      if (response.ok) {
        toast.success('Reschedule request sent to fan');
        fetchCallRequests();
      } else {
        throw new Error('Failed to reschedule');
      }
    } catch (error) {
      toast.error('Failed to send reschedule request');
    } finally {
      setProcessingRequest(null);
    }
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = 
      request.fan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.fan.username.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || request.type === filterType;
    
    return matchesSearch && matchesType;
  });

  const getUrgencyColor = (urgency) => {
    switch(urgency) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'normal': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'accepted': return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'declined': return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'pending': return <ClockIcon className="w-5 h-5 text-yellow-500" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Container className="py-6 md:py-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Call Requests
              </h1>
            </div>
            <button
              onClick={fetchCallRequests}
              className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-all"
              disabled={isLoading}
            >
              <ArrowPathIcon className={`w-6 h-6 text-purple-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-4 shadow-md text-white"
          >
            <div className="flex items-center justify-between mb-2">
              <ClockIcon className="w-8 h-8" />
              <span className="text-2xl font-bold">{stats.pendingRequests}</span>
            </div>
            <p className="text-sm">Pending</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md"
          >
            <div className="flex items-center justify-between mb-2">
              <CheckCircleIcon className="w-8 h-8 text-green-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.acceptedWeek}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Week</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-4 shadow-md text-white"
          >
            <div className="flex items-center justify-between mb-2">
              <CurrencyDollarIcon className="w-8 h-8" />
              <span className="text-2xl font-bold">{stats.totalWeekTokens}</span>
            </div>
            <p className="text-sm">Total Week</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md"
          >
            <div className="flex items-center justify-between mb-2">
              <CheckCircleIcon className="w-8 h-8 text-blue-500" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.acceptedMonth}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Month</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl p-4 shadow-md text-white"
          >
            <div className="flex items-center justify-between mb-2">
              <CurrencyDollarIcon className="w-8 h-8" />
              <span className="text-2xl font-bold">{stats.totalMonthTokens}</span>
            </div>
            <p className="text-sm">Total Month</p>
          </motion.div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Tabs */}
            <div className="flex gap-2">
              {['pending', 'accepted', 'declined', 'all'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === 'pending' && stats.pendingRequests > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                      {stats.pendingRequests}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by fan name or username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Filter Type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Types</option>
              <option value="video">Video Calls</option>
              <option value="voice">Voice Calls</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="amount">Highest Tokens</option>
            </select>
          </div>
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-12 text-center">
              <BellIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No call requests found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchTerm ? 'Try adjusting your search filters' : 'New requests will appear here'}
              </p>
            </div>
          ) : (
            filteredRequests.map((request, index) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-all"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    {/* Left Section - Fan Info */}
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {request.fan.name.charAt(0)}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {request.fan.name}
                          </h3>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {request.fan.username}
                          </span>
                          {request.fan.rating >= 4.5 && (
                            <CheckBadgeIcon className="w-5 h-5 text-blue-500" title="Top Fan" />
                          )}
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${getUrgencyColor(request.urgency)}`}>
                            {request.urgency} priority
                          </span>
                        </div>

                        <p className="text-gray-600 dark:text-gray-400 mb-3">
                          {request.message}
                        </p>

                        <div className="flex items-center gap-6 text-sm">
                          <div className="flex items-center gap-1">
                            {request.type === 'video' ? (
                              <VideoCameraIcon className="w-4 h-4 text-purple-500" />
                            ) : (
                              <PhoneIcon className="w-4 h-4 text-blue-500" />
                            )}
                            <span className="text-gray-700 dark:text-gray-300">
                              {request.type === 'video' ? 'Video' : 'Voice'} Call
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <ClockIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700 dark:text-gray-300">
                              {request.duration} minutes
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <CalendarIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700 dark:text-gray-300">
                              {new Date(request.scheduled_date).toLocaleDateString()} at {request.scheduled_time}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <CurrencyDollarIcon className="w-4 h-4 text-green-500" />
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              {request.offering_tokens} tokens
                            </span>
                          </div>
                        </div>

                        {/* Fan Stats */}
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <StarIcon className="w-3 h-3" />
                            {request.fan.rating} rating
                          </div>
                          <div className="text-xs text-gray-500">
                            {request.fan.callHistory} previous calls
                          </div>
                          <div className="text-xs text-gray-500">
                            {request.fan.totalSpent} tokens spent
                          </div>
                          <div className="text-xs text-gray-500">
                            Member since {new Date(request.fan.memberSince).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Section - Actions */}
                    <div className="flex flex-col items-end gap-2 ml-4">
                      {getStatusIcon(request.status)}
                      
                      {request.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleAcceptRequest(request)}
                            disabled={processingRequest === request.id}
                            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50"
                          >
                            {processingRequest === request.id ? (
                              <ArrowPathIcon className="w-5 h-5 animate-spin" />
                            ) : (
                              'Accept'
                            )}
                          </button>
                          
                          <button
                            onClick={() => {
                              setSelectedRequest(request);
                              setShowDetailsModal(true);
                            }}
                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                          >
                            View Details
                          </button>
                          
                          <button
                            onClick={() => handleDeclineRequest(request)}
                            disabled={processingRequest === request.id}
                            className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition-all"
                          >
                            Decline
                          </button>
                        </>
                      )}
                      
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {new Date(request.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Details Modal */}
        <AnimatePresence>
          {showDetailsModal && selectedRequest && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowDetailsModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Call Request Details
                    </h2>
                    <button
                      onClick={() => setShowDetailsModal(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <XMarkIcon className="w-6 h-6 text-gray-500" />
                    </button>
                  </div>

                  {/* Add detailed view of the selected request here */}
                  <div className="space-y-6">
                    {/* Fan Profile Section */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Fan Profile</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Name</p>
                          <p className="font-medium">{selectedRequest.fan.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Username</p>
                          <p className="font-medium">{selectedRequest.fan.username}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Member Since</p>
                          <p className="font-medium">{new Date(selectedRequest.fan.memberSince).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Total Spent</p>
                          <p className="font-medium">{selectedRequest.fan.totalSpent} tokens</p>
                        </div>
                      </div>
                    </div>

                    {/* Call Details */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Call Details</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Type</span>
                          <span className="font-medium">{selectedRequest.type === 'video' ? 'Video Call' : 'Voice Call'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Duration</span>
                          <span className="font-medium">{selectedRequest.duration} minutes</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Scheduled</span>
                          <span className="font-medium">
                            {new Date(selectedRequest.scheduled_date).toLocaleDateString()} at {selectedRequest.scheduled_time}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Offering</span>
                          <span className="font-bold text-green-600">{selectedRequest.offering_tokens} tokens</span>
                        </div>
                      </div>
                    </div>

                    {/* Message */}
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Message from Fan</h3>
                      <p className="text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        {selectedRequest.message}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => handleAcceptRequest(selectedRequest)}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                      >
                        Accept Request
                      </button>
                      <button
                        onClick={() => setShowDetailsModal(false)}
                        className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Container>
    </div>
  );
};

export default CallRequestsPage;