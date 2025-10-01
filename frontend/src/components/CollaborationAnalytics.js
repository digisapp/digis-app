import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import Card from './ui/Card';
import LoadingSpinner from './ui/LoadingSpinner';

const CollaborationAnalytics = ({ collaborationId, onClose }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [collaborationId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/collaborations/${collaborationId}/analytics`);
      
      if (response.data.success) {
        setAnalytics(response.data.analytics);
      }
    } catch (error) {
      console.error('Error fetching collaboration analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '0 minutes';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <LoadingSpinner />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">
          No analytics data available
        </p>
      </div>
    );
  }

  const { collaboration, session, participants, performance } = analytics;

  return (
    <div className="space-y-6">
      {/* Collaboration Overview */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Collaboration Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Title</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {collaboration.title}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Type</div>
            <div className="font-medium text-gray-900 dark:text-white capitalize">
              {collaboration.sessionType}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Status</div>
            <div className="font-medium text-gray-900 dark:text-white capitalize">
              {collaboration.status}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Created</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {formatDate(collaboration.createdAt)}
            </div>
          </div>
        </div>
      </Card>

      {/* Session Performance */}
      {session && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Session Performance
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {formatDuration(session.duration)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Duration
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {formatCurrency(session.totalRevenue)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Revenue
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {formatCurrency(session.revenuePerMinute)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Revenue/Minute
              </div>
            </div>
            
            {performance.durationVsPlanned && (
              <div className="text-center">
                <div className={`text-3xl font-bold mb-2 ${
                  performance.durationVsPlanned >= 100 ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {performance.durationVsPlanned.toFixed(0)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  vs Planned Duration
                </div>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Started</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {formatDate(session.startTime)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Ended</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {formatDate(session.endTime)}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Participant Earnings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Revenue Distribution
        </h3>
        <div className="space-y-3">
          {participants.earnings.map((participant) => (
            <motion.div
              key={participant.userId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                  participant.role === 'host'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                    : 'bg-gradient-to-r from-blue-500 to-teal-500'
                }`}>
                  {participant.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {participant.username}
                    {participant.role === 'host' && (
                      <span className="ml-2 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300 px-2 py-1 rounded-full">
                        Host
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {participant.revenuePercentage}% share
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-lg font-bold text-green-600">
                  {formatCurrency(participant.earnings)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Earnings
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Total Participants: {participants.count}
            </span>
            {participants.avgRevenueShare && (
              <span className="text-gray-600 dark:text-gray-400">
                Avg Share: {participants.avgRevenueShare.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Performance Insights */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Performance Insights
        </h3>
        
        <div className="space-y-4">
          <div className={`p-4 rounded-lg ${
            performance.isSuccessful 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
          }`}>
            <div className="flex items-center space-x-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                performance.isSuccessful ? 'bg-green-500' : 'bg-yellow-500'
              }`}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d={performance.isSuccessful ? "M5 13l4 4L19 7" : "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5l-6.928-12c-.77-.833-1.888-.833-2.658 0l-6.928 12c-.77.833.192 2.5 1.732 2.5z"} 
                  />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {performance.isSuccessful ? 'Successful Collaboration' : 'Incomplete Collaboration'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {performance.isSuccessful 
                    ? 'This collaboration was completed successfully'
                    : 'This collaboration was not completed as planned'
                  }
                </div>
              </div>
            </div>
          </div>
          
          {session && session.duration && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Duration Analysis
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  Session lasted {formatDuration(session.duration)}
                  {performance.durationVsPlanned && (
                    <span className="block">
                      ({performance.durationVsPlanned.toFixed(0)}% of planned duration)
                    </span>
                  )}
                </div>
              </div>
              
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="font-semibold text-green-900 dark:text-green-100 mb-1">
                  Revenue Analysis
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">
                  Generated {formatCurrency(session.totalRevenue)} total
                  <span className="block">
                    ({formatCurrency(session.revenuePerMinute)} per minute)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default CollaborationAnalytics;