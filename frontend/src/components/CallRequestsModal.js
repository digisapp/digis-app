import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  VideoCameraIcon,
  PhoneIcon,
  ClockIcon,
  CalendarIcon,
  UserIcon,
  CheckIcon,
  XCircleIcon,
  SparklesIcon,
  BellIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { getAuthToken } from '../utils/supabase-auth';
import toast from 'react-hot-toast';
import Button from './ui/Button';

const CallRequestsModal = ({ isOpen, onClose, user, onRequestAccepted, setCurrentView }) => {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [processingRequest, setProcessingRequest] = useState(null);

  useEffect(() => {
    if (isOpen && user) {
      fetchCallRequests();
    }
  }, [isOpen, user, activeTab]);

  const fetchCallRequests = async () => {
    try {
      setIsLoading(true);
      const authToken = await getAuthToken();
      
      // Fetch private call requests
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/sessions/requests?status=${activeTab}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      } else {
        throw new Error('Failed to fetch requests');
      }
    } catch (error) {
      console.error('Error fetching call requests:', error);
      toast.error('Failed to load call requests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptRequest = async (request) => {
    try {
      setProcessingRequest(request.id);
      const authToken = await getAuthToken();
      
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/sessions/requests/${request.id}/accept`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            scheduled_date: request.scheduled_date,
            scheduled_time: request.scheduled_time
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success('Call request accepted and added to calendar!');
        
        // Notify parent component to refresh calendar
        if (onRequestAccepted) {
          onRequestAccepted(data.session);
        }
        
        // Refresh requests list
        fetchCallRequests();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to accept request');
      }
    } catch (error) {
      console.error('Error accepting request:', error);
      toast.error(error.message || 'Failed to accept call request');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleDeclineRequest = async (request) => {
    try {
      setProcessingRequest(request.id);
      const authToken = await getAuthToken();
      
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/sessions/requests/${request.id}/decline`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            reason: 'Not available at this time'
          })
        }
      );

      if (response.ok) {
        toast.success('Call request declined');
        fetchCallRequests();
      } else {
        throw new Error('Failed to decline request');
      }
    } catch (error) {
      console.error('Error declining request:', error);
      toast.error('Failed to decline call request');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleCancelAcceptedCall = async (request) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled call? The fan will be notified.')) {
      return;
    }

    try {
      setProcessingRequest(request.id);
      const authToken = await getAuthToken();
      
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/sessions/requests/${request.id}/cancel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            reason: 'Creator unavailable for scheduled time'
          })
        }
      );

      if (response.ok) {
        toast.success('Call cancelled successfully');
        fetchCallRequests();
        // Notify parent to refresh calendar
        if (onRequestAccepted) {
          onRequestAccepted(null);
        }
      } else {
        throw new Error('Failed to cancel call');
      }
    } catch (error) {
      console.error('Error cancelling call:', error);
      toast.error('Failed to cancel call');
    } finally {
      setProcessingRequest(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'accepted':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'declined':
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'expired':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const formatDate = (date, time) => {
    if (!date) return 'Immediate';
    const dateObj = new Date(`${date} ${time || '00:00'}`);
    return dateObj.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - only below navigation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 top-20 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Modal Content - positioned below nav */}
          <div className="fixed inset-0 top-20 flex items-start justify-center z-50 pointer-events-none pt-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[75vh] flex flex-col pointer-events-auto"
                >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-t-2xl flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <BellIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Call Requests</h2>
                  <p className="text-purple-100">Manage incoming call invitations</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onClose();
                    // Navigate to full page
                    if (setCurrentView) {
                      setCurrentView('call-requests');
                    }
                  }}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition-colors"
                >
                  View All
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mt-6">
              {['pending', 'accepted', 'all'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-white text-purple-600 shadow-lg'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === 'pending' && requests.filter(r => r.status === 'pending').length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                      {requests.filter(r => r.status === 'pending').length}
                    </span>
                  )}
                </button>
              ))}
            </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <ArrowPathIcon className="w-8 h-8 text-purple-600 animate-spin" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12">
                <BellIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No {activeTab === 'all' ? '' : activeTab} requests
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Call requests from fans will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <motion.div
                    key={request.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        {/* Type Icon */}
                        <div className={`p-3 rounded-lg ${
                          request.type === 'video' 
                            ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                            : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {request.type === 'video' ? (
                            <VideoCameraIcon className="w-6 h-6" />
                          ) : (
                            <PhoneIcon className="w-6 h-6" />
                          )}
                        </div>

                        {/* Request Details */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              {request.type === 'video' ? 'Video' : 'Voice'} Call Request
                            </h4>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(request.status)}`}>
                              {request.status}
                            </span>
                          </div>

                          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                            <div className="flex items-center gap-2">
                              <UserIcon className="w-4 h-4" />
                              <span>From: <strong>{request.fan_username || 'Unknown'}</strong></span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="w-4 h-4" />
                              <span>
                                {formatDate(request.scheduled_date, request.scheduled_time)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <ClockIcon className="w-4 h-4" />
                              <span>Duration: {request.duration_minutes || request.estimated_duration || 10} minutes</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <SparklesIcon className="w-4 h-4 text-yellow-500" />
                              <span>
                                Rate: {request.price_per_minute || request.rate_per_min} tokens/min
                                ({(request.price_per_minute || request.rate_per_min) * (request.duration_minutes || request.estimated_duration || 10)} tokens total)
                              </span>
                            </div>

                            {request.message && (
                              <div className="mt-2 p-2 bg-white dark:bg-gray-600 rounded-lg">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Message:</p>
                                <p className="text-gray-700 dark:text-gray-200">{request.message}</p>
                              </div>
                            )}

                            {request.expires_at && request.status === 'pending' && (
                              <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                                <ExclamationTriangleIcon className="w-4 h-4" />
                                <span className="text-xs">
                                  Expires: {new Date(request.expires_at).toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      {request.status === 'pending' && (
                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            onClick={() => handleAcceptRequest(request)}
                            disabled={processingRequest === request.id}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2"
                          >
                            {processingRequest === request.id ? (
                              <ArrowPathIcon className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <CheckIcon className="w-4 h-4 mr-1" />
                                Accept
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => handleDeclineRequest(request)}
                            disabled={processingRequest === request.id}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2"
                          >
                            {processingRequest === request.id ? (
                              <ArrowPathIcon className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <XCircleIcon className="w-4 h-4 mr-1" />
                                Decline
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                      
                      {request.status === 'accepted' && (
                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            onClick={() => handleCancelAcceptedCall(request)}
                            disabled={processingRequest === request.id}
                            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2"
                          >
                            {processingRequest === request.id ? (
                              <ArrowPathIcon className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <XCircleIcon className="w-4 h-4 mr-1" />
                                Cancel Call
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
              </div>

              {/* Refresh Button */}
              <div className="absolute bottom-6 right-6">
            <button
              onClick={fetchCallRequests}
              className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg transition-colors"
              title="Refresh requests"
            >
              <ArrowPathIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CallRequestsModal;