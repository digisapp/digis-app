import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  FlagIcon,
  EyeSlashIcon,
  UserMinusIcon,
  ClockIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XMarkIcon,
  MegaphoneIcon,
  ChatBubbleLeftRightIcon,
  VideoCameraSlashIcon,
  MicrophoneIcon
} from '@heroicons/react/24/outline';
import {
  ShieldCheckIcon as ShieldCheckIconSolid,
  ExclamationTriangleIcon as ExclamationTriangleIconSolid
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const CreatorProtectionSystem = ({ user, isCreator = false }) => {
  const [protectionSettings, setProtectionSettings] = useState({
    autoModeration: true,
    profanityFilter: true,
    requireApproval: false,
    blockAnonymous: false,
    minimumAccountAge: 0, // days
    restrictNewUsers: false,
    allowScreenshots: true,
    allowRecording: true,
    timeoutDuration: 5, // minutes
    maxWarnings: 3
  });

  const [blockedUsers, setBlockedUsers] = useState([]);
  const [reportHistory, setReportHistory] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [moderationLogs, setModerationLogs] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch protection data
  const fetchProtectionData = useCallback(async () => {
    if (!user || !isCreator) return;

    try {
      const [settingsRes, blockedRes, reportsRes, warningsRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_BACKEND_URL}/users/protection-settings`, {
          headers: { 'Authorization': `Bearer ${await getAuthToken()}` }
        }),
        fetch(`${import.meta.env.VITE_BACKEND_URL}/users/blocked-users`, {
          headers: { 'Authorization': `Bearer ${await getAuthToken()}` }
        }),
        fetch(`${import.meta.env.VITE_BACKEND_URL}/users/reports`, {
          headers: { 'Authorization': `Bearer ${await getAuthToken()}` }
        }),
        fetch(`${import.meta.env.VITE_BACKEND_URL}/users/warnings`, {
          headers: { 'Authorization': `Bearer ${await getAuthToken()}` }
        })
      ]);

      const [settings, blocked, reports, warningsList] = await Promise.all([
        settingsRes.json(),
        blockedRes.json(),
        reportsRes.json(),
        warningsRes.json()
      ]);

      if (settings.success) setProtectionSettings(settings.settings);
      if (blocked.success) setBlockedUsers(blocked.blockedUsers);
      if (reports.success) setReportHistory(reports.reports);
      if (warningsList.success) setWarnings(warningsList.warnings);
    } catch (error) {
      console.error('Error fetching protection data:', error);
    }
  }, [user, isCreator]);

  // Initialize
  useEffect(() => {
    if (user && isCreator) {
      fetchProtectionData();
    }
  }, [user, isCreator, fetchProtectionData]);

  // Update protection settings
  const updateProtectionSettings = async (newSettings) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/protection-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify(newSettings)
      });

      if (response.ok) {
        setProtectionSettings(newSettings);
        // toast.success('Protection settings updated');
      } else {
        throw new Error('Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating protection settings:', error);
      toast.error('Failed to update protection settings');
    }
  };

  // Block user
  const blockUser = async (targetUserId, reason = '') => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/block-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ targetUserId, reason })
      });

      if (response.ok) {
        fetchProtectionData(); // Refresh data
        // toast.success('User blocked successfully');
      } else {
        throw new Error('Failed to block user');
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Failed to block user');
    }
  };

  // Unblock user
  const unblockUser = async (targetUserId) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/unblock-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ targetUserId })
      });

      if (response.ok) {
        fetchProtectionData(); // Refresh data
        // toast.success('User unblocked successfully');
      } else {
        throw new Error('Failed to unblock user');
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
      toast.error('Failed to unblock user');
    }
  };

  // Report user
  const reportUser = async () => {
    if (!selectedUser || !reportReason) return;

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/report-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          targetUserId: selectedUser.userId,
          reason: reportReason,
          details: reportDetails
        })
      });

      if (response.ok) {
        setShowReportModal(false);
        setSelectedUser(null);
        setReportReason('');
        setReportDetails('');
        fetchProtectionData(); // Refresh data
        // toast.success('Report submitted successfully');
      } else {
        throw new Error('Failed to submit report');
      }
    } catch (error) {
      console.error('Error reporting user:', error);
      toast.error('Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  // Give warning to user
  const giveWarning = async (targetUserId, reason) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/give-warning`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ targetUserId, reason })
      });

      if (response.ok) {
        // toast.success('Warning issued successfully');
        fetchProtectionData(); // Refresh data
      } else {
        throw new Error('Failed to issue warning');
      }
    } catch (error) {
      console.error('Error giving warning:', error);
      toast.error('Failed to issue warning');
    }
  };

  // Timeout user (temporary restriction)
  const timeoutUser = async (targetUserId, duration = 5) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/timeout-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ targetUserId, duration })
      });

      if (response.ok) {
        // toast.success(`User timed out for ${duration} minutes`);
      } else {
        throw new Error('Failed to timeout user');
      }
    } catch (error) {
      console.error('Error timing out user:', error);
      toast.error('Failed to timeout user');
    }
  };

  const ProtectionToggle = ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <h4 className="font-medium text-gray-900">{label}</h4>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-green-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );

  const BlockedUserCard = ({ blockedUser }) => (
    <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
          <UserMinusIcon className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h4 className="font-medium text-gray-900">@{blockedUser.username}</h4>
          <p className="text-sm text-gray-600">
            Blocked {new Date(blockedUser.blockedAt).toLocaleDateString()}
          </p>
          {blockedUser.reason && (
            <p className="text-xs text-gray-500">Reason: {blockedUser.reason}</p>
          )}
        </div>
      </div>
      <button
        onClick={() => unblockUser(blockedUser.userId)}
        className="px-3 py-1 text-sm bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
      >
        Unblock
      </button>
    </div>
  );

  const ReportCard = ({ report }) => {
    const getStatusColor = (status) => {
      const colors = {
        pending: 'yellow',
        investigating: 'blue',
        resolved: 'green',
        dismissed: 'gray'
      };
      return colors[status] || 'gray';
    };

    return (
      <div className="p-4 bg-white border border-gray-200 rounded-lg">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <FlagIcon className="w-5 h-5 text-red-600" />
            <span className="font-medium text-gray-900">Report #{report.id}</span>
          </div>
          <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${getStatusColor(report.status)}-100 text-${getStatusColor(report.status)}-800`}>
            {report.status}
          </span>
        </div>
        
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-gray-600">User:</span>
            <span className="ml-2 font-medium">@{report.targetUsername}</span>
          </div>
          <div>
            <span className="text-gray-600">Reason:</span>
            <span className="ml-2">{report.reason}</span>
          </div>
          {report.details && (
            <div>
              <span className="text-gray-600">Details:</span>
              <p className="ml-2 mt-1 text-gray-700">{report.details}</p>
            </div>
          )}
          <div className="text-gray-500 text-xs">
            Reported on {new Date(report.createdAt).toLocaleString()}
          </div>
        </div>
      </div>
    );
  };

  const WarningCard = ({ warning }) => (
    <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
      <ExclamationTriangleIconSolid className="w-5 h-5 text-yellow-600" />
      <div className="flex-1">
        <p className="font-medium text-yellow-900">@{warning.targetUsername}</p>
        <p className="text-sm text-yellow-700">{warning.reason}</p>
        <p className="text-xs text-yellow-600">
          {new Date(warning.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );

  if (!isCreator) {
    return (
      <div className="text-center py-8">
        <ShieldCheckIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Creator protection features are only available for creators</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldCheckIconSolid className="w-8 h-8 text-green-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Creator Protection</h2>
          <p className="text-gray-600">Manage your safety and content moderation settings</p>
        </div>
      </div>

      {/* Protection Settings */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Protection Settings</h3>
        
        <div className="space-y-4">
          <ProtectionToggle
            label="Auto Moderation"
            description="Automatically detect and filter inappropriate content"
            checked={protectionSettings.autoModeration}
            onChange={(checked) => updateProtectionSettings({ ...protectionSettings, autoModeration: checked })}
          />
          
          <ProtectionToggle
            label="Profanity Filter"
            description="Block messages containing inappropriate language"
            checked={protectionSettings.profanityFilter}
            onChange={(checked) => updateProtectionSettings({ ...protectionSettings, profanityFilter: checked })}
          />
          
          <ProtectionToggle
            label="Require Approval"
            description="Manually approve new users before they can interact"
            checked={protectionSettings.requireApproval}
            onChange={(checked) => updateProtectionSettings({ ...protectionSettings, requireApproval: checked })}
          />
          
          <ProtectionToggle
            label="Block Anonymous Users"
            description="Only allow verified users to interact with you"
            checked={protectionSettings.blockAnonymous}
            onChange={(checked) => updateProtectionSettings({ ...protectionSettings, blockAnonymous: checked })}
          />
          
          <ProtectionToggle
            label="Restrict New Users"
            description="Limit interactions from newly created accounts"
            checked={protectionSettings.restrictNewUsers}
            onChange={(checked) => updateProtectionSettings({ ...protectionSettings, restrictNewUsers: checked })}
          />

          {/* Advanced Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Account Age (days)
              </label>
              <input
                type="number"
                min="0"
                max="365"
                value={protectionSettings.minimumAccountAge}
                onChange={(e) => updateProtectionSettings({
                  ...protectionSettings,
                  minimumAccountAge: parseInt(e.target.value) || 0
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timeout Duration (minutes)
              </label>
              <select
                value={protectionSettings.timeoutDuration}
                onChange={(e) => updateProtectionSettings({
                  ...protectionSettings,
                  timeoutDuration: parseInt(e.target.value)
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value={1}>1 minute</option>
                <option value={5}>5 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => setShowReportModal(true)}
            className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FlagIcon className="w-6 h-6 text-red-600" />
            <span className="text-sm font-medium">Report User</span>
          </button>
          
          <button className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <NoSymbolIcon className="w-6 h-6 text-orange-600" />
            <span className="text-sm font-medium">Block User</span>
          </button>
          
          <button className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <ClockIcon className="w-6 h-6 text-yellow-600" />
            <span className="text-sm font-medium">Timeout User</span>
          </button>
          
          <button className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <ExclamationTriangleIcon className="w-6 h-6 text-blue-600" />
            <span className="text-sm font-medium">Give Warning</span>
          </button>
        </div>
      </div>

      {/* Blocked Users */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Blocked Users ({blockedUsers.length})
        </h3>
        
        {blockedUsers.length > 0 ? (
          <div className="space-y-3">
            {blockedUsers.map(blockedUser => (
              <BlockedUserCard key={blockedUser.id} blockedUser={blockedUser} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <NoSymbolIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No blocked users</p>
          </div>
        )}
      </div>

      {/* Recent Reports */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Reports ({reportHistory.length})
        </h3>
        
        {reportHistory.length > 0 ? (
          <div className="space-y-4">
            {reportHistory.slice(0, 5).map(report => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FlagIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No reports submitted</p>
          </div>
        )}
      </div>

      {/* Recent Warnings */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Warnings ({warnings.length})
        </h3>
        
        {warnings.length > 0 ? (
          <div className="space-y-3">
            {warnings.slice(0, 5).map(warning => (
              <WarningCard key={warning.id} warning={warning} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <ExclamationTriangleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No warnings issued</p>
          </div>
        )}
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowReportModal(false)}
          >
            <motion.div
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Report User</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason for report *
                    </label>
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select a reason...</option>
                      <option value="harassment">Harassment or bullying</option>
                      <option value="inappropriate_content">Inappropriate content</option>
                      <option value="spam">Spam or unwanted content</option>
                      <option value="impersonation">Impersonation</option>
                      <option value="threatening_behavior">Threatening behavior</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Additional details (optional)
                    </label>
                    <textarea
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="Provide any additional context or details..."
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={reportUser}
                    disabled={!reportReason || loading}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Quick action components for use in other parts of the app
export const QuickBlockButton = ({ user, targetUserId, onSuccess }) => {
  const handleBlock = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/block-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ targetUserId })
      });

      if (response.ok) {
        // toast.success('User blocked');
        onSuccess?.();
      }
    } catch (error) {
      toast.error('Failed to block user');
    }
  };

  return (
    <button
      onClick={handleBlock}
      className="p-1 text-red-600 hover:bg-red-50 rounded-full transition-colors"
      title="Block user"
    >
      <NoSymbolIcon className="w-4 h-4" />
    </button>
  );
};

export const QuickReportButton = ({ user, targetUserId, onSuccess }) => {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');

  const handleReport = async () => {
    if (!reason) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/report-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ targetUserId, reason })
      });

      if (response.ok) {
        setShowModal(false);
        setReason('');
        // toast.success('Report submitted');
        onSuccess?.();
      }
    } catch (error) {
      toast.error('Failed to submit report');
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="p-1 text-red-600 hover:bg-red-50 rounded-full transition-colors"
        title="Report user"
      >
        <FlagIcon className="w-4 h-4" />
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 w-full max-w-sm">
            <h3 className="font-semibold mb-3">Report User</h3>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2 border rounded mb-3"
            >
              <option value="">Select reason...</option>
              <option value="harassment">Harassment</option>
              <option value="inappropriate">Inappropriate content</option>
              <option value="spam">Spam</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 p-2 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                disabled={!reason}
                className="flex-1 p-2 bg-red-600 text-white rounded disabled:opacity-50"
              >
                Report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CreatorProtectionSystem;