import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import Button from './ui/Button';
import Card from './ui/Card';
import Badge from './ui/Badge';
import Modal from './ui/Modal';
import CollaborationAnalytics from './CollaborationAnalytics';

const CollaborationCard = ({ collaboration, userId, isCreator, onStatusUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  const isHost = collaboration.userRole === 'host';
  const canStart = collaboration.status === 'confirmed' && isHost;
  const canEnd = collaboration.status === 'active' && isHost;
  const canRespond = collaboration.status === 'pending' && collaboration.userStatus === 'invited';
  const canCancel = (collaboration.status === 'pending' || collaboration.status === 'confirmed') && isHost;

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
      confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      active: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
      completed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
  };

  const getSessionTypeIcon = (type) => {
    const icons = {
      video: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      voice: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      ),
      stream: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m0 0v12a1 1 0 01-1 1H8a1 1 0 01-1-1V4m0 0H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2" />
        </svg>
      )
    };
    return icons[type] || icons.video;
  };

  const handleResponse = async (response) => {
    try {
      setActionLoading(response);
      const result = await api.post(`/api/collaborations/${collaboration.id}/respond`, {
        response
      });
      
      if (result.data.success) {
        onStatusUpdate();
      }
    } catch (error) {
      console.error('Error responding to collaboration:', error);
    } finally {
      setActionLoading('');
    }
  };

  const handleStartSession = async () => {
    try {
      setActionLoading('start');
      const result = await api.post(`/api/collaborations/${collaboration.id}/start`);
      
      if (result.data.success) {
        onStatusUpdate();
        // Optionally redirect to the session/call interface
      }
    } catch (error) {
      console.error('Error starting collaboration:', error);
    } finally {
      setActionLoading('');
    }
  };

  const handleEndSession = async () => {
    try {
      setActionLoading('end');
      const result = await api.post(`/api/collaborations/${collaboration.id}/end`);
      
      if (result.data.success) {
        onStatusUpdate();
      }
    } catch (error) {
      console.error('Error ending collaboration:', error);
    } finally {
      setActionLoading('');
    }
  };

  const handleCancel = async () => {
    const reason = prompt('Please provide a reason for cancellation (optional):');
    
    try {
      setActionLoading('cancel');
      const result = await api.post(`/api/collaborations/${collaboration.id}/cancel`, {
        reason
      });
      
      if (result.data.success) {
        onStatusUpdate();
      }
    } catch (error) {
      console.error('Error cancelling collaboration:', error);
    } finally {
      setActionLoading('');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not scheduled';
    return new Date(dateString).toLocaleString();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between space-y-4 lg:space-y-0">
            {/* Main Content */}
            <div className="flex-1 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {collaboration.title}
                    </h3>
                    <Badge className={getStatusColor(collaboration.status)}>
                      {collaboration.status}
                    </Badge>
                    {collaboration.userRole === 'host' && (
                      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300">
                        Host
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-gray-600 dark:text-gray-400">
                    {collaboration.description}
                  </p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center space-x-2">
                  {getSessionTypeIcon(collaboration.sessionType)}
                  <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {collaboration.sessionType}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {formatCurrency(collaboration.pricePerMinute)}/min
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Max {collaboration.maxDuration}min
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {collaboration.totalParticipants} participants
                  </span>
                </div>
              </div>

              {/* Participants */}
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Participants</h4>
                <div className="flex flex-wrap gap-2">
                  {collaboration.participants.map((participant) => (
                    <div
                      key={participant.userId}
                      className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-800 px-3 py-1 rounded-full text-sm"
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white ${
                        participant.role === 'host' 
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500' 
                          : 'bg-gradient-to-r from-blue-500 to-teal-500'
                      }`}>
                        {participant.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-gray-900 dark:text-white">
                        {participant.username}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        ({participant.revenuePercentage}%)
                      </span>
                      {participant.status !== 'accepted' && (
                        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300 text-xs px-1">
                          {participant.status}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Schedule */}
              {collaboration.scheduledFor && (
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Scheduled for: {formatDate(collaboration.scheduledFor)}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col space-y-2 lg:ml-6">
              {canRespond && (
                <div className="flex space-x-2">
                  <Button
                    onClick={() => handleResponse('accept')}
                    loading={actionLoading === 'accept'}
                    className="bg-green-600 text-white px-4 py-2 text-sm"
                  >
                    Accept
                  </Button>
                  <Button
                    onClick={() => handleResponse('decline')}
                    loading={actionLoading === 'decline'}
                    variant="secondary"
                    className="px-4 py-2 text-sm"
                  >
                    Decline
                  </Button>
                </div>
              )}
              
              {canStart && (
                <Button
                  onClick={handleStartSession}
                  loading={actionLoading === 'start'}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 text-sm"
                >
                  Start Session
                </Button>
              )}
              
              {canEnd && (
                <Button
                  onClick={handleEndSession}
                  loading={actionLoading === 'end'}
                  className="bg-red-600 text-white px-6 py-2 text-sm"
                >
                  End Session
                </Button>
              )}
              
              {canCancel && (
                <Button
                  onClick={handleCancel}
                  loading={actionLoading === 'cancel'}
                  variant="secondary"
                  className="px-4 py-2 text-sm text-red-600 hover:text-red-800"
                >
                  Cancel
                </Button>
              )}
              
              {collaboration.status === 'completed' && (
                <Button
                  onClick={() => setShowAnalytics(true)}
                  variant="secondary"
                  className="px-4 py-2 text-sm"
                >
                  View Analytics
                </Button>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Analytics Modal */}
      {showAnalytics && (
        <Modal
          isOpen={showAnalytics}
          onClose={() => setShowAnalytics(false)}
          title="Collaboration Analytics"
          size="lg"
        >
          <CollaborationAnalytics
            collaborationId={collaboration.id}
            onClose={() => setShowAnalytics(false)}
          />
        </Modal>
      )}
    </>
  );
};

export default CollaborationCard;