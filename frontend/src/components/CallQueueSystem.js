import React, { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserGroupIcon,
  ClockIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PhoneIcon,
  VideoCameraIcon,
  StarIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { 
  PhoneIcon as PhoneIconSolid, 
  VideoCameraIcon as VideoCameraIconSolid 
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';
import PropTypes from 'prop-types';

const CallQueueSystem = memo(({ user, isCreator = false, creatorId = null }) => {
  const [queueData, setQueueData] = useState({
    position: null,
    totalInQueue: 0,
    estimatedWait: 0,
    status: 'waiting' // waiting, called, expired, cancelled
  });
  const [creatorQueue, setCreatorQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ws, setWs] = useState(null);

  // WebSocket connection for real-time queue updates
  useEffect(() => {
    if (!user) return;

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('🔗 Queue WebSocket connected');
      setWs(websocket);
      
      // Subscribe to queue updates
      websocket.send(JSON.stringify({
        type: 'subscribe_queue',
        userId: user.id,
        creatorId: creatorId,
        isCreator: isCreator
      }));
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'queue_update':
            if (isCreator) {
              setCreatorQueue(message.data.queue || []);
            } else {
              setQueueData(prev => ({
                ...prev,
                position: message.data.position,
                totalInQueue: message.data.totalInQueue,
                estimatedWait: message.data.estimatedWait
              }));
            }
            break;
            
          case 'queue_called':
            if (!isCreator && message.data.fanId === user.id) {
              setQueueData(prev => ({ ...prev, status: 'called' }));
              // toast.success('You\'re being called! Get ready!');
            }
            break;
            
          case 'queue_position_changed':
            if (!isCreator) {
              setQueueData(prev => ({
                ...prev,
                position: message.data.newPosition,
                estimatedWait: message.data.estimatedWait
              }));
              
              if (message.data.newPosition <= 3) {
                toast.info(`You're #${message.data.newPosition} in queue - almost your turn!`);
              }
            }
            break;
        }
      } catch (error) {
        console.error('Error parsing queue WebSocket message:', error);
      }
    };

    websocket.onclose = () => {
      console.log('🔌 Queue WebSocket disconnected');
      setWs(null);
    };

    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, [user, creatorId, isCreator]);

  // Join queue
  const joinQueue = useCallback(async (creatorId, sessionType, estimatedDuration = 10) => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/join-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          creatorId,
          sessionType,
          estimatedDuration
        })
      });

      const data = await response.json();

      if (response.ok) {
        setQueueData({
          position: data.position,
          totalInQueue: data.totalInQueue,
          estimatedWait: data.estimatedWait,
          status: 'waiting'
        });

        // toast.success(`Joined queue! You're #${data.position} in line`);
      } else {
        throw new Error(data.message || 'Failed to join queue');
      }
    } catch (error) {
      console.error('Error joining queue:', error);
      toast.error(error.message || 'Failed to join queue');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Leave queue
  const leaveQueue = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/leave-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });

      if (response.ok) {
        setQueueData({
          position: null,
          totalInQueue: 0,
          estimatedWait: 0,
          status: 'waiting'
        });

        // toast.success('Left queue successfully');
      } else {
        throw new Error('Failed to leave queue');
      }
    } catch (error) {
      console.error('Error leaving queue:', error);
      toast.error('Failed to leave queue');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Call next person in queue (creator only)
  const callNext = useCallback(async () => {
    if (!isCreator || !user) return;

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/call-next`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // toast.success(`Calling ${data.fanUsername}!`);
      } else {
        throw new Error('Failed to call next person');
      }
    } catch (error) {
      console.error('Error calling next person:', error);
      toast.error('Failed to call next person');
    } finally {
      setLoading(false);
    }
  }, [isCreator, user]);

  // Skip or remove person from queue (creator only)
  const skipUser = useCallback(async (queueId, reason = 'No reason provided') => {
    if (!isCreator || !user) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/skip-queue-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ queueId, reason })
      });

      if (response.ok) {
        // toast.success('User skipped');
      } else {
        throw new Error('Failed to skip user');
      }
    } catch (error) {
      console.error('Error skipping user:', error);
      toast.error('Failed to skip user');
    }
  }, [isCreator, user]);

  const formatWaitTime = (minutes) => {
    if (minutes < 1) return 'Less than 1 minute';
    if (minutes < 60) return `${Math.round(minutes)} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const getSessionTypeIcon = (sessionType) => {
    return sessionType === 'video' ? VideoCameraIconSolid : PhoneIconSolid;
  };

  const getSessionTypeColor = (sessionType) => {
    return sessionType === 'video' ? 'blue' : 'green';
  };

  // Fan Queue Display (when in queue)
  if (!isCreator && queueData.position) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200"
        role="region"
        aria-label="Queue status"
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserGroupIcon className="w-8 h-8 text-blue-600" />
          </div>
          
          <h3 className="text-xl font-semibold text-gray-900 mb-2">You're in Queue!</h3>
          
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg" role="status" aria-live="polite">
              <span className="text-sm text-blue-700">Position in queue:</span>
              <span className="text-lg font-bold text-blue-900">#{queueData.position}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">People ahead:</span>
              <span className="font-semibold text-gray-900">{queueData.position - 1}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg" role="status" aria-live="polite">
              <span className="text-sm text-yellow-700">Estimated wait:</span>
              <span className="font-semibold text-yellow-900">
                {formatWaitTime(queueData.estimatedWait)}
              </span>
            </div>
          </div>

          {queueData.status === 'called' && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg" role="alert" aria-live="assertive">
              <CheckCircleIcon className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-green-900 font-semibold">You're being called!</p>
              <p className="text-sm text-green-700">Get ready for your call</p>
            </div>
          )}

          <button
            onClick={leaveQueue}
            disabled={loading}
            className="w-full px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            aria-label="Leave the queue"
            onKeyDown={(e) => e.key === 'Enter' && leaveQueue()}
          >
            {loading ? 'Leaving...' : 'Leave Queue'}
          </button>
        </div>
      </motion.div>
    );
  }

  // Creator Queue Management (when creator)
  if (isCreator) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Call Queue</h3>
            <p className="text-sm text-gray-600">
              {creatorQueue.length} {creatorQueue.length === 1 ? 'person' : 'people'} waiting
            </p>
          </div>
          
          {creatorQueue.length > 0 && (
            <button
              onClick={callNext}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              aria-label="Call next person in queue"
              onKeyDown={(e) => e.key === 'Enter' && callNext()}
            >
              <PhoneIconSolid className="w-4 h-4" />
              Call Next
            </button>
          )}
        </div>

        {creatorQueue.length === 0 ? (
          <div className="text-center py-8">
            <UserGroupIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No one in queue</p>
            <p className="text-sm text-gray-500">Fans will appear here when they join your queue</p>
          </div>
        ) : (
          <div className="space-y-3" role="list" aria-label="People in queue">
            {creatorQueue.map((queueItem, index) => {
              const SessionIcon = getSessionTypeIcon(queueItem.sessionType);
              const colorClass = getSessionTypeColor(queueItem.sessionType);
              
              return (
                <motion.div
                  key={queueItem.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 border-2 rounded-xl ${
                    index === 0 
                      ? `border-${colorClass}-500 bg-${colorClass}-50` 
                      : 'border-gray-200 bg-white'
                  }`}
                  role="listitem"
                  aria-label={`${queueItem.fanUsername} is number ${index + 1} in queue`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                          {queueItem.fanProfilePicUrl ? (
                            <img
                              src={queueItem.fanProfilePicUrl}
                              alt={queueItem.fanUsername}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            queueItem.fanUsername?.charAt(0)?.toUpperCase() || 'F'
                          )}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 bg-${colorClass}-600 rounded-full flex items-center justify-center`}>
                          <SessionIcon className="w-3 h-3 text-white" />
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          @{queueItem.fanUsername}
                        </h4>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>#{index + 1} in queue</span>
                          <span>•</span>
                          <span>{queueItem.estimatedDuration}min</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <CurrencyDollarIcon className="w-3 h-3" />
                            {queueItem.estimatedCost} tokens
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {queueItem.fanTier !== 'newcomer' && (
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          queueItem.fanTier === 'vip' ? 'bg-purple-100 text-purple-800' :
                          queueItem.fanTier === 'regular' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          <StarIcon className="w-3 h-3 inline mr-1" />
                          {queueItem.fanTier.toUpperCase()}
                        </div>
                      )}
                      
                      <button
                        onClick={() => skipUser(queueItem.id, 'Skipped by creator')}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                        title="Skip this user"
                        aria-label={`Skip ${queueItem.fanUsername} in queue`}
                        onKeyDown={(e) => e.key === 'Enter' && skipUser(queueItem.id, 'Skipped by creator')}
                      >
                        <XMarkIcon className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </div>

                  {queueItem.waitTime && (
                    <div className="mt-2 text-xs text-gray-500">
                      Waiting for {formatWaitTime(queueItem.waitTime)}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Not in queue and not a creator - show join queue option
  return null;
});

CallQueueSystem.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    uid: PropTypes.string
  }),
  isCreator: PropTypes.bool,
  creatorId: PropTypes.string
};

CallQueueSystem.defaultProps = {
  isCreator: false,
  creatorId: null
};

// Hook for joining queue from other components
export const useCallQueue = (user) => {
  const joinQueue = useCallback(async (creatorId, sessionType, estimatedDuration = 10) => {
    if (!user) {
      toast.error('Please sign in to join queue');
      return false;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/join-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          creatorId,
          sessionType,
          estimatedDuration
        })
      });

      const data = await response.json();

      if (response.ok) {
        // toast.success(`Joined queue! You're #${data.position} in line`);
        return {
          success: true,
          position: data.position,
          estimatedWait: data.estimatedWait
        };
      } else {
        throw new Error(data.message || 'Failed to join queue');
      }
    } catch (error) {
      console.error('Error joining queue:', error);
      toast.error(error.message || 'Failed to join queue');
      return { success: false, error: error.message };
    }
  }, [user]);

  return { joinQueue };
};

export default CallQueueSystem;