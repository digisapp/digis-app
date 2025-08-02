import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserPlusIcon, 
  VideoCameraIcon, 
  MicrophoneIcon,
  XMarkIcon,
  CheckIcon,
  UsersIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import Button from './ui/Button';
import Card from './ui/Card';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const CoHostManager = ({
  user,
  isCreator,
  channel,
  isStreaming,
  onCoHostAccepted,
  onCoHostRemoved,
  maxCoHosts = 3
}) => {
  const [coHostRequests, setCoHostRequests] = useState([]);
  const [activeCoHosts, setActiveCoHosts] = useState([]);
  const [showRequestPanel, setShowRequestPanel] = useState(false);
  const [canRequestCoHost, setCanRequestCoHost] = useState(true);
  const [requestStatus, setRequestStatus] = useState(null); // null, 'pending', 'accepted', 'rejected'

  // Mock data for demo - replace with real WebSocket/API calls
  useEffect(() => {
    if (isCreator && isStreaming) {
      // Simulate incoming co-host requests
      const mockRequests = [
        {
          id: '1',
          userId: 'user1',
          name: 'CreatorAlex',
          type: 'creator',
          avatar: '🎨',
          followers: 5420,
          requestTime: new Date(Date.now() - 60000),
          message: "Hey! Would love to join and talk about our collab!"
        },
        {
          id: '2', 
          userId: 'user2',
          name: 'SuperFan2024',
          type: 'fan',
          avatar: '🌟',
          tokenBalance: 1500,
          requestTime: new Date(Date.now() - 120000),
          message: "Big fan! Can I ask you some questions?"
        }
      ];

      setTimeout(() => {
        setCoHostRequests(mockRequests);
      }, 5000);
    }
  }, [isCreator, isStreaming]);

  // Request to join as co-host (for viewers)
  const requestCoHost = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/streaming/co-host-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          streamId: channel,
          message: "I'd like to join as a co-host!"
        })
      });

      if (response.ok) {
        setRequestStatus('pending');
        setCanRequestCoHost(false);
        // toast.success('Co-host request sent!');
      }
    } catch (error) {
      console.error('Error requesting co-host:', error);
      toast.error('Failed to send co-host request');
    }
  };

  // Accept co-host request (for creators)
  const acceptCoHost = async (request) => {
    if (activeCoHosts.length >= maxCoHosts) {
      toast.error(`Maximum ${maxCoHosts} co-hosts allowed`);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/streaming/co-host-accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          streamId: channel,
          requestId: request.id,
          userId: request.userId
        })
      });

      if (response.ok) {
        // Add to active co-hosts
        setActiveCoHosts(prev => [...prev, {
          ...request,
          joinedAt: new Date()
        }]);
        
        // Remove from requests
        setCoHostRequests(prev => prev.filter(r => r.id !== request.id));
        
        // Notify parent component
        onCoHostAccepted?.(request);
        
        // toast.success(`${request.name} joined as co-host!`);
      }
    } catch (error) {
      console.error('Error accepting co-host:', error);
      toast.error('Failed to accept co-host');
    }
  };

  // Reject co-host request
  const rejectCoHost = async (request) => {
    try {
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/streaming/co-host-reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          streamId: channel,
          requestId: request.id
        })
      });

      setCoHostRequests(prev => prev.filter(r => r.id !== request.id));
      toast.info('Co-host request declined');
    } catch (error) {
      console.error('Error rejecting co-host:', error);
    }
  };

  // Remove active co-host
  const removeCoHost = async (coHost) => {
    try {
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/streaming/co-host-remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          streamId: channel,
          userId: coHost.userId
        })
      });

      setActiveCoHosts(prev => prev.filter(c => c.id !== coHost.id));
      onCoHostRemoved?.(coHost);
      toast.info(`${coHost.name} removed from co-hosts`);
    } catch (error) {
      console.error('Error removing co-host:', error);
      toast.error('Failed to remove co-host');
    }
  };

  // Viewer UI - Request to join button
  if (!isCreator && isStreaming) {
    return (
      <div className="fixed bottom-24 left-4 z-40">
        <AnimatePresence>
          {canRequestCoHost && requestStatus !== 'pending' && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
            >
              <Button
                onClick={requestCoHost}
                variant="primary"
                size="lg"
                icon={<UserPlusIcon className="w-5 h-5" />}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg"
              >
                Request to Join Stream
              </Button>
            </motion.div>
          )}
          
          {requestStatus === 'pending' && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-full flex items-center gap-2"
            >
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="text-sm">Request pending...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Creator UI - Manage co-hosts
  if (!isCreator || !isStreaming) return null;

  return (
    <>
      {/* Co-Host Request Button/Badge */}
      <div className="fixed top-24 right-4 z-40">
        <Button
          onClick={() => setShowRequestPanel(true)}
          variant="secondary"
          size="sm"
          className="relative bg-gradient-to-r from-purple-500 to-pink-500 text-white"
        >
          <UsersIcon className="w-5 h-5 mr-2" />
          Co-Hosts ({activeCoHosts.length}/{maxCoHosts})
          {coHostRequests.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
              {coHostRequests.length}
            </span>
          )}
        </Button>
      </div>

      {/* Active Co-Hosts Display */}
      {activeCoHosts.length > 0 && (
        <div className="fixed top-36 right-4 z-30 space-y-2">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-1">Active Co-Hosts</div>
          {activeCoHosts.map((coHost) => (
            <motion.div
              key={coHost.id}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-black/60 backdrop-blur-sm rounded-lg p-2 flex items-center gap-2"
            >
              <div className="text-2xl">{coHost.avatar}</div>
              <div className="flex-1">
                <div className="text-white text-sm font-medium">{coHost.name}</div>
                <div className="text-white/60 text-xs">
                  {coHost.type === 'creator' ? 'Creator' : 'Fan'}
                </div>
              </div>
              <button
                onClick={() => removeCoHost(coHost)}
                className="text-red-400 hover:text-red-300 p-1"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Co-Host Management Panel */}
      <AnimatePresence>
        {showRequestPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowRequestPanel(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-neutral-900 rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <UsersIcon className="w-8 h-8 text-purple-500" />
                  Co-Host Management
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowRequestPanel(false)}
                  icon={<XMarkIcon className="w-5 h-5" />}
                />
              </div>

              {/* Active Co-Hosts */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-yellow-500" />
                  Active Co-Hosts ({activeCoHosts.length}/{maxCoHosts})
                </h4>
                {activeCoHosts.length === 0 ? (
                  <p className="text-neutral-500 text-sm">No active co-hosts</p>
                ) : (
                  <div className="space-y-2">
                    {activeCoHosts.map((coHost) => (
                      <div
                        key={coHost.id}
                        className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-3xl">{coHost.avatar}</div>
                          <div>
                            <div className="font-medium">{coHost.name}</div>
                            <div className="text-sm text-neutral-600 dark:text-neutral-400">
                              {coHost.type === 'creator' ? `Creator • ${coHost.followers} followers` : `Fan • ${coHost.tokenBalance} tokens`}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeCoHost(coHost)}
                          className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Requests */}
              <div className="flex-1 overflow-y-auto">
                <h4 className="font-semibold mb-3">
                  Pending Requests ({coHostRequests.length})
                </h4>
                {coHostRequests.length === 0 ? (
                  <div className="text-center py-12 text-neutral-500">
                    <UserPlusIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No pending co-host requests</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {coHostRequests.map((request) => (
                      <motion.div
                        key={request.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="text-3xl">{request.avatar}</div>
                              <div>
                                <h5 className="font-semibold">{request.name}</h5>
                                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                  {request.type === 'creator' ? 
                                    `Creator • ${request.followers} followers` : 
                                    `Fan • ${request.tokenBalance} tokens`
                                  }
                                </p>
                              </div>
                            </div>
                            
                            <p className="text-sm mb-2">{request.message}</p>
                            
                            <p className="text-xs text-neutral-500">
                              Requested {new Date(request.requestTime).toLocaleTimeString()}
                            </p>
                          </div>

                          <div className="flex gap-2 ml-4">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => rejectCoHost(request)}
                              icon={<XMarkIcon className="w-4 h-4" />}
                              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              Decline
                            </Button>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => acceptCoHost(request)}
                              icon={<CheckIcon className="w-4 h-4" />}
                              disabled={activeCoHosts.length >= maxCoHosts}
                            >
                              Accept
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  <strong>Note:</strong> Co-hosts can speak and appear on video during your stream. 
                  They'll be visible to all viewers. Maximum {maxCoHosts} co-hosts allowed.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CoHostManager;