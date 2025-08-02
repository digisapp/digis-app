import React, { useState, useEffect, useCallback } from 'react';
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
  QueueListIcon
} from '@heroicons/react/24/outline';
import { BellAlertIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import socketService from '../services/socket';
import { getAuthToken } from '../utils/auth-helpers';

const AdminDashboard = ({ user, className = '' }) => {
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('pending');
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [bulkSelection, setBulkSelection] = useState([]);
  const [showNotification, setShowNotification] = useState(false);
  const [newApplications, setNewApplications] = useState([]);
  const [queuedApplications, setQueuedApplications] = useState([]);

  const tabs = {
    pending: { label: 'Pending', color: 'orange', icon: ClockIcon },
    queued: { label: 'Queued', color: 'blue', icon: QueueListIcon },
    approved: { label: 'Approved', color: 'green', icon: CheckCircleIcon },
    rejected: { label: 'Rejected', color: 'red', icon: XCircleIcon }
  };

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/creator-applications?status=${selectedTab}&limit=50`, {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setApplications(data.applications);
      } else if (response.status === 403) {
        console.error('Admin access required');
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedTab]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/stats/creator-applications', {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchApplications();
      fetchStats();
    }
  }, [user, selectedTab, fetchApplications, fetchStats]);

  // Real-time notifications for new creator applications
  useEffect(() => {
    const handleNewApplication = (data) => {
      setNewApplications(prev => [...prev, data]);
      setShowNotification(true);
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
            <p className="text-sm text-gray-600">{data.displayName} has applied to become a creator</p>
          </div>
          <button
            onClick={() => {
              toast.dismiss(t.id);
              setSelectedTab('pending');
              fetchApplications();
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
      
      // Refresh applications if on pending tab
      if (selectedTab === 'pending') {
        fetchApplications();
      }
      fetchStats();
    };

    // Join admin room for real-time updates
    socketService.socket?.emit('join_admin_room');
    socketService.socket?.on('new_creator_application', handleNewApplication);

    return () => {
      socketService.socket?.off('new_creator_application', handleNewApplication);
      socketService.socket?.emit('leave_admin_room');
    };
  }, [selectedTab, fetchApplications, fetchStats]);

  const handleApproveApplication = async (applicationId, reviewNotes = '') => {
    try {
      const response = await fetch(`/api/admin/creator-applications/${applicationId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ reviewNotes })
      });

      if (response.ok) {
        fetchApplications();
        fetchStats();
        setSelectedApplication(null);
      }
    } catch (error) {
      console.error('Failed to approve application:', error);
    }
  };

  const handleRejectApplication = async (applicationId, reason, reviewNotes = '') => {
    try {
      const response = await fetch(`/api/admin/creator-applications/${applicationId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ reason, reviewNotes })
      });

      if (response.ok) {
        fetchApplications();
        fetchStats();
        setSelectedApplication(null);
        // toast.success('Application rejected');
      }
    } catch (error) {
      console.error('Failed to reject application:', error);
      toast.error('Failed to reject application');
    }
  };

  const handleQueueApplication = async (applicationId, notes = '') => {
    try {
      const response = await fetch(`/api/admin/creator-applications/${applicationId}/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ notes })
      });

      if (response.ok) {
        setQueuedApplications(prev => [...prev, applicationId]);
        // toast.success('Application queued for later review');
        fetchApplications();
        fetchStats();
      }
    } catch (error) {
      console.error('Failed to queue application:', error);
      toast.error('Failed to queue application');
    }
  };

  const handleBulkApprove = async () => {
    if (bulkSelection.length === 0) return;

    try {
      const response = await fetch('/api/admin/creator-applications/bulk-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ 
          applicationIds: bulkSelection,
          reviewNotes: 'Bulk approved by admin'
        })
      });

      if (response.ok) {
        fetchApplications();
        fetchStats();
        setBulkSelection([]);
      }
    } catch (error) {
      console.error('Failed to bulk approve:', error);
    }
  };

  const toggleBulkSelection = (applicationId) => {
    setBulkSelection(prev => 
      prev.includes(applicationId)
        ? prev.filter(id => id !== applicationId)
        : [...prev, applicationId]
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && applications.length === 0) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                  <div className="h-3 bg-gray-100 rounded w-48"></div>
                </div>
                <div className="h-8 bg-gray-200 rounded w-20"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white">
        <h2 className="text-2xl font-bold mb-4">Creator Applications Admin</h2>
        
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.pending || 0}</div>
            <div className="text-sm text-white/80">Pending</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.approved || 0}</div>
            <div className="text-sm text-white/80">Approved</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.thisWeek || 0}</div>
            <div className="text-sm text-white/80">This Week</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{Math.round(stats.avgReviewTimeDays || 0)}</div>
            <div className="text-sm text-white/80">Avg Days</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white/10 rounded-lg p-1">
          {Object.entries(tabs).map(([key, tab]) => (
            <button
              key={key}
              onClick={() => {
                setSelectedTab(key);
                setBulkSelection([]);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                selectedTab === key
                  ? 'bg-white text-purple-600 shadow-md'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
              <span className="ml-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                {stats[key] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedTab === 'pending' && bulkSelection.length > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-blue-800">
              {bulkSelection.length} application{bulkSelection.length > 1 ? 's' : ''} selected
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleBulkApprove}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
              >
                Bulk Approve ({bulkSelection.length})
              </button>
              <button
                onClick={() => setBulkSelection([])}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Applications List */}
      <div className="p-6">
        {applications.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="mb-4">
              {React.createElement(tabs[selectedTab].icon, { className: "h-16 w-16 mx-auto text-gray-400" })}
            </div>
            <div>No {selectedTab} applications found</div>
            <div className="text-sm mt-2">Applications will appear here when users apply to become creators</div>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app, index) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`border rounded-xl p-4 transition-all ${
                  bulkSelection.includes(app.id)
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Bulk Selection Checkbox */}
                  {selectedTab === 'pending' && (
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={bulkSelection.includes(app.id)}
                        onChange={() => toggleBulkSelection(app.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {/* User Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-400 to-blue-500 flex items-center justify-center text-white font-bold">
                    {app.profilePic ? (
                      <img src={app.profilePic} alt={app.username} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      app.username?.charAt(0)?.toUpperCase() || 'U'
                    )}
                  </div>

                  {/* Application Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{app.username}</h3>
                        <p className="text-sm text-gray-600">{app.email}</p>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm text-gray-500">
                          {formatDate(app.submittedAt)}
                        </div>
                        {app.reviewedAt && (
                          <div className="text-xs text-gray-400">
                            Reviewed: {formatDate(app.reviewedAt)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bio Preview */}
                    <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                      {app.bio}
                    </p>

                    {/* Specialties */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {app.specialties?.slice(0, 3).map((specialty, i) => (
                        <span key={i} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                          {specialty}
                        </span>
                      ))}
                      {app.specialties?.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          +{app.specialties.length - 3} more
                        </span>
                      )}
                    </div>

                    {/* User Stats */}
                    <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                      <div>
                        <span className="font-medium">Spent:</span> ${app.userStats?.totalSpent || 0}
                      </div>
                      <div>
                        <span className="font-medium">Fan:</span> {
                          app.userStats?.memberSince 
                            ? new Date(app.userStats.memberSince).toLocaleDateString()
                            : 'N/A'
                        }
                      </div>
                      <div>
                        <span className="font-medium">Last Active:</span> {
                          app.userStats?.lastActive 
                            ? new Date(app.userStats.lastActive).toLocaleDateString()
                            : 'N/A'
                        }
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="flex gap-4 text-sm text-gray-600 mb-3">
                      <span>📹 Video: ${app.pricing?.videoCall || 30}/min</span>
                      <span>🎙️ Voice: ${app.pricing?.voiceCall || 20}/min</span>
                      <span>📡 Stream: ${app.pricing?.privateStream || 50}/min</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedApplication(app)}
                        className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm rounded-lg transition-colors"
                      >
                        View Details
                      </button>
                      
                      {selectedTab === 'pending' && (
                        <div className="flex gap-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleApproveApplication(app.id, 'Application meets all requirements')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-all shadow-sm"
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                            Approve
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleQueueApplication(app.id, 'Queued for later review')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-all shadow-sm"
                          >
                            <QueueListIcon className="h-4 w-4" />
                            Queue
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleRejectApplication(app.id, 'Application needs improvement', '')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-all shadow-sm"
                          >
                            <XCircleIcon className="h-4 w-4" />
                            Decline
                          </motion.button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Application Detail Modal */}
      <AnimatePresence>
        {selectedApplication && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && setSelectedApplication(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold">Application Details</h3>
                  <button
                    onClick={() => setSelectedApplication(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                {/* Detailed Application View */}
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-2">Bio</h4>
                    <p className="text-gray-700">{selectedApplication.bio}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Experience</h4>
                    <p className="text-gray-700">{selectedApplication.experience || 'Not provided'}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Social Media</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(selectedApplication.socialMedia || {}).map(([platform, handle]) => (
                        handle && (
                          <div key={platform}>
                            <strong className="capitalize">{platform}:</strong> {handle}
                          </div>
                        )
                      ))}
                    </div>
                  </div>

                  {selectedTab === 'pending' && (
                    <div className="flex gap-3 pt-4 border-t">
                      <button
                        onClick={() => handleApproveApplication(selectedApplication.id)}
                        className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                      >
                        ✅ Approve Application
                      </button>
                      <button
                        onClick={() => handleRejectApplication(selectedApplication.id, 'Application requires more information')}
                        className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                      >
                        ❌ Reject Application
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;