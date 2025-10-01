import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getAuthToken } from '../../utils/auth-helpers';
import { 
  PhoneIcon, 
  VideoCameraIcon, 
  ClockIcon,
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
  CalendarIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';

const CallManagementPage = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [callRequests, setCallRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    accepted: 0,
    declined: 0,
    completed: 0
  });

  useEffect(() => {
    fetchCallRequests();
    fetchStats();
  }, [activeTab]);

  const fetchCallRequests = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/sessions/requests?status=${activeTab}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCallRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching call requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/sessions/stats`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/sessions/requests/${requestId}/accept`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        fetchCallRequests();
        fetchStats();
      }
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  };

  const handleDeclineRequest = async (requestId) => {
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/sessions/requests/${requestId}/decline`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        fetchCallRequests();
        fetchStats();
      }
    } catch (error) {
      console.error('Error declining request:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const tabs = [
    { id: 'pending', label: 'Pending', count: stats.pending, color: 'yellow' },
    { id: 'accepted', label: 'Accepted', count: stats.accepted, color: 'green' },
    { id: 'declined', label: 'Declined', count: stats.declined, color: 'red' },
    { id: 'completed', label: 'Completed', count: stats.completed, color: 'blue' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 p-4 md:pt-24 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Call Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your incoming call requests and session history
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {tabs.map((tab) => (
            <motion.div
              key={tab.id}
              whileHover={{ scale: 1.02 }}
              className={`bg-white dark:bg-gray-800 p-4 rounded-xl border ${
                activeTab === tab.id 
                  ? 'border-purple-500 ring-2 ring-purple-500 ring-opacity-50' 
                  : 'border-gray-200 dark:border-gray-700'
              } cursor-pointer transition-all`}
              onClick={() => setActiveTab(tab.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {tab.label}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {tab.count}
                  </p>
                </div>
                <div className={`p-3 rounded-lg bg-${tab.color}-100 dark:bg-${tab.color}-900/20`}>
                  {tab.id === 'pending' && <ClockIcon className={`w-6 h-6 text-${tab.color}-600 dark:text-${tab.color}-400`} />}
                  {tab.id === 'accepted' && <CheckCircleIcon className={`w-6 h-6 text-${tab.color}-600 dark:text-${tab.color}-400`} />}
                  {tab.id === 'declined' && <XCircleIcon className={`w-6 h-6 text-${tab.color}-600 dark:text-${tab.color}-400`} />}
                  {tab.id === 'completed' && <PhoneIcon className={`w-6 h-6 text-${tab.color}-600 dark:text-${tab.color}-400`} />}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${activeTab === tab.id
                      ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }
                  `}
                >
                  <span className="flex items-center gap-2">
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`
                        px-2 py-0.5 text-xs rounded-full
                        ${activeTab === tab.id
                          ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }
                      `}>
                        {tab.count}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {/* Call Requests List */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
              </div>
            ) : callRequests.length === 0 ? (
              <div className="text-center py-12">
                <PhoneIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No {activeTab} call requests
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {callRequests.map((request) => (
                  <motion.div
                    key={request.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        {/* User Avatar */}
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                          {request.fanName?.[0]?.toUpperCase() || 'U'}
                        </div>

                        {/* Request Details */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {request.fanName || 'User'}
                            </h3>
                            {request.callType === 'video' ? (
                              <VideoCameraIcon className="w-5 h-5 text-blue-500" />
                            ) : (
                              <PhoneIcon className="w-5 h-5 text-green-500" />
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <ClockIcon className="w-4 h-4" />
                              {request.duration || 15} minutes
                            </span>
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="w-4 h-4" />
                              {formatDate(request.requestedAt || request.createdAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <CurrencyDollarIcon className="w-4 h-4" />
                              {request.estimatedEarnings || request.rate * (request.duration || 15)} tokens
                            </span>
                          </div>

                          {request.message && (
                            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded p-2">
                              "{request.message}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {activeTab === 'pending' && (
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleAcceptRequest(request.id)}
                            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-2"
                          >
                            <CheckCircleIcon className="w-5 h-5" />
                            Accept
                          </button>
                          <button
                            onClick={() => handleDeclineRequest(request.id)}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2"
                          >
                            <XCircleIcon className="w-5 h-5" />
                            Decline
                          </button>
                        </div>
                      )}

                      {activeTab === 'accepted' && (
                        <button className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center gap-2">
                          <ArrowRightIcon className="w-5 h-5" />
                          Start Call
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        {activeTab === 'pending' && callRequests.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                You have {stats.pending} pending call request{stats.pending !== 1 ? 's' : ''}. 
                Responding quickly increases your acceptance rate and earnings.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallManagementPage;