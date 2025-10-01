import React, { useState, useEffect, memo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import {
  PlusIcon,
  ChartBarIcon,
  ClockIcon,
  CheckIcon,
  XMarkIcon,
  UserGroupIcon,
  FireIcon,
  TrophyIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { retryWebSocketSend, createWebSocketSender, fetchWithRetry } from '../utils/retryUtils';

const InteractiveLivePolls = ({ 
  websocket, 
  channelId, 
  isCreator = false, 
  user,
  apiEndpoint = '/api/polls'
}) => {
  const [activePolls, setActivePolls] = useState([]);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [newPoll, setNewPoll] = useState({
    question: '',
    options: ['', ''],
    duration: 60
  });
  const [votedPolls, setVotedPolls] = useState(new Set());
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [sendErrors, setSendErrors] = useState([]);
  const [pollsLoading, setPollsLoading] = useState(true);
  
  const wsMessageHandlerRef = useRef(null);
  const wsSenderRef = useRef(null);
  const pollUpdateTimersRef = useRef(new Map());

  // Create WebSocket sender with retry
  useEffect(() => {
    if (websocket) {
      wsSenderRef.current = createWebSocketSender(websocket, {
        maxRetries: 5,
        initialDelay: 500,
        onRetry: (error, attempt, delay) => {
          console.warn(`[LivePolls] WebSocket send retry ${attempt}, waiting ${delay}ms...`, error);
          setSendErrors(prev => [...prev, {
            timestamp: Date.now(),
            error: error.message,
            attempt
          }].slice(-5)); // Keep last 5 errors
        }
      });
    }
  }, [websocket]);

  useEffect(() => {
    if (websocket && channelId) {
      setupWebSocketListeners();
      updateConnectionStatus();
      fetchActivePolls();
      
      // Monitor connection status
      const interval = setInterval(updateConnectionStatus, 5000);
      return () => {
        clearInterval(interval);
        // Clear all poll timers
        pollUpdateTimersRef.current.forEach(timer => clearInterval(timer));
        pollUpdateTimersRef.current.clear();
      };
    }
  }, [websocket, channelId]);

  // Setup poll expiration timers
  useEffect(() => {
    activePolls.forEach(poll => {
      if (poll.status === 'active' && poll.expiresAt) {
        const expiresAt = new Date(poll.expiresAt).getTime();
        const now = Date.now();
        
        if (expiresAt > now) {
          // Clear existing timer if any
          if (pollUpdateTimersRef.current.has(poll.pollId)) {
            clearInterval(pollUpdateTimersRef.current.get(poll.pollId));
          }
          
          // Set up new timer
          const timer = setInterval(() => {
            const timeRemaining = expiresAt - Date.now();
            if (timeRemaining <= 0) {
              // Poll expired
              closePoll(poll.pollId, poll.options, poll.totalVotes);
              clearInterval(timer);
              pollUpdateTimersRef.current.delete(poll.pollId);
            } else {
              // Force re-render to update time display
              setActivePolls(prev => [...prev]);
            }
          }, 1000);
          
          pollUpdateTimersRef.current.set(poll.pollId, timer);
        }
      }
    });

    // Clean up timers for removed polls
    pollUpdateTimersRef.current.forEach((timer, pollId) => {
      if (!activePolls.some(p => p.pollId === pollId)) {
        clearInterval(timer);
        pollUpdateTimersRef.current.delete(pollId);
      }
    });
  }, [activePolls]);

  const updateConnectionStatus = () => {
    if (!websocket) {
      setConnectionStatus('disconnected');
      return;
    }

    switch (websocket.readyState) {
      case WebSocket.CONNECTING:
        setConnectionStatus('connecting');
        break;
      case WebSocket.OPEN:
        setConnectionStatus('connected');
        break;
      case WebSocket.CLOSING:
        setConnectionStatus('closing');
        break;
      case WebSocket.CLOSED:
        setConnectionStatus('disconnected');
        break;
      default:
        setConnectionStatus('unknown');
    }
  };

  const setupWebSocketListeners = () => {
    // Remove old listener if exists
    if (wsMessageHandlerRef.current) {
      websocket.removeEventListener('message', wsMessageHandlerRef.current);
    }

    // Create new listener
    wsMessageHandlerRef.current = handleWebSocketMessage;
    websocket.addEventListener('message', wsMessageHandlerRef.current);

    // Connection state listeners
    websocket.addEventListener('open', updateConnectionStatus);
    websocket.addEventListener('close', updateConnectionStatus);
    websocket.addEventListener('error', (error) => {
      console.error('[LivePolls] WebSocket error:', error);
      updateConnectionStatus();
    });
  };

  const handleWebSocketMessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'poll_created':
          if (data.poll.channelId === channelId) {
            addPoll(data.poll);
          }
          break;
        case 'poll_updated':
          if (data.pollId) {
            updatePollResults(data.pollId, data.results, data.totalVotes);
          }
          break;
        case 'poll_closed':
          if (data.pollId) {
            closePoll(data.pollId, data.finalResults, data.totalVotes);
          }
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('[LivePolls] Error parsing WebSocket message:', error);
    }
  };

  const fetchActivePolls = async () => {
    setPollsLoading(true);
    try {
      const response = await fetchWithRetry(
        `${apiEndpoint}/stream/${channelId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user?.token}` // Assuming user has a token
          }
        },
        {
          maxRetries: 3,
          onRetry: (error, attempt) => {
            console.warn(`[LivePolls] Fetch polls retry ${attempt}`, error);
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.polls) {
          setActivePolls(data.polls);
          // Update voted polls set
          const voted = new Set(
            data.polls
              .filter(poll => poll.hasVoted)
              .map(poll => poll.pollId)
          );
          setVotedPolls(voted);
        }
      }
    } catch (error) {
      console.error('[LivePolls] Failed to fetch active polls:', error);
      setSendErrors(prev => [...prev, {
        timestamp: Date.now(),
        error: 'Failed to load polls. Please refresh.',
        type: 'fetch'
      }].slice(-5));
    } finally {
      setPollsLoading(false);
    }
  };

  const addPoll = (pollData) => {
    setActivePolls(prev => [pollData, ...prev]);
  };

  const updatePollResults = (pollId, results, totalVotes) => {
    setActivePolls(prev => prev.map(poll => 
      poll.pollId === pollId 
        ? { ...poll, options: results, totalVotes }
        : poll
    ));
  };

  const closePoll = (pollId, finalResults, totalVotes) => {
    setActivePolls(prev => prev.map(poll => 
      poll.pollId === pollId 
        ? { ...poll, status: 'closed', options: finalResults, totalVotes }
        : poll
    ));
    
    // Clear timer for this poll
    if (pollUpdateTimersRef.current.has(pollId)) {
      clearInterval(pollUpdateTimersRef.current.get(pollId));
      pollUpdateTimersRef.current.delete(pollId);
    }
  };

  const createPoll = async () => {
    if (!newPoll.question.trim() || newPoll.options.some(opt => !opt.trim())) {
      return;
    }

    const pollData = {
      type: 'create_poll',
      channelId,
      question: newPoll.question.trim(),
      options: newPoll.options.filter(opt => opt.trim()).map(opt => opt.trim()),
      duration: newPoll.duration * 1000 // Convert to milliseconds
    };

    try {
      await wsSenderRef.current(pollData);
      
      // Clear errors on success
      setSendErrors([]);
      
      // Reset form
      setNewPoll({
        question: '',
        options: ['', ''],
        duration: 60
      });
      setShowCreatePoll(false);
    } catch (error) {
      console.error('[LivePolls] Failed to create poll:', error);
      setSendErrors(prev => [...prev, {
        timestamp: Date.now(),
        error: 'Failed to create poll. Please try again.',
        type: 'create'
      }].slice(-5));
    }
  };

  const votePoll = async (pollId, optionId) => {
    if (votedPolls.has(pollId)) return;

    const voteData = {
      type: 'vote_poll',
      pollId,
      optionId
    };

    try {
      await wsSenderRef.current(voteData);
      
      // Optimistically update UI
      setVotedPolls(prev => new Set([...prev, pollId]));
      setSendErrors([]);
    } catch (error) {
      console.error('[LivePolls] Failed to vote:', error);
      
      // Revert optimistic update
      setVotedPolls(prev => {
        const newSet = new Set(prev);
        newSet.delete(pollId);
        return newSet;
      });
      
      setSendErrors(prev => [...prev, {
        timestamp: Date.now(),
        error: 'Failed to submit vote. Please try again.',
        type: 'vote'
      }].slice(-5));
    }
  };

  const addPollOption = () => {
    if (newPoll.options.length < 6) {
      setNewPoll(prev => ({
        ...prev,
        options: [...prev.options, '']
      }));
    }
  };

  const removePollOption = (index) => {
    if (newPoll.options.length > 2) {
      setNewPoll(prev => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index)
      }));
    }
  };

  const updatePollOption = (index, value) => {
    setNewPoll(prev => ({
      ...prev,
      options: prev.options.map((option, i) => i === index ? value : option)
    }));
  };

  const getTimeRemaining = (poll) => {
    if (poll.status === 'closed') return 'Closed';
    
    const now = new Date();
    const expiresAt = new Date(poll.expiresAt);
    const remaining = Math.max(0, expiresAt - now);
    
    if (remaining === 0) return 'Expired';
    
    const seconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const getOptionPercentage = (poll, option) => {
    if (!poll.totalVotes || poll.totalVotes === 0) return 0;
    return Math.round((option.votes / poll.totalVotes) * 100);
  };

  const getWinningOption = (poll) => {
    if (!poll.options || poll.options.length === 0) return null;
    return poll.options.reduce((max, option) => 
      option.votes > max.votes ? option : max
    );
  };

  const getConnectionStatusIndicator = () => {
    const statusConfig = {
      connected: { color: 'bg-green-500', text: 'Connected' },
      connecting: { color: 'bg-yellow-500', text: 'Connecting...' },
      disconnected: { color: 'bg-red-500', text: 'Disconnected' },
      closing: { color: 'bg-orange-500', text: 'Closing...' },
      unknown: { color: 'bg-gray-500', text: 'Unknown' }
    };

    const config = statusConfig[connectionStatus] || statusConfig.unknown;

    return (
      <div className="flex items-center gap-2 text-xs">
        <div className={`w-2 h-2 rounded-full ${config.color} ${connectionStatus === 'connected' ? 'animate-pulse' : ''}`} />
        <span className="text-white/80">{config.text}</span>
      </div>
    );
  };

  return (
    <motion.div
      className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ChartBarIcon className="w-6 h-6" />
            <div>
              <h3 className="font-bold text-lg">Live Polls</h3>
              <p className="text-white/80 text-sm">Interactive audience engagement</p>
            </div>
            {getConnectionStatusIndicator()}
          </div>
          
          {isCreator && (
            <motion.button
              onClick={() => setShowCreatePoll(true)}
              className={`flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-all ${
                connectionStatus !== 'connected' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              whileHover={{ scale: connectionStatus === 'connected' ? 1.05 : 1 }}
              whileTap={{ scale: connectionStatus === 'connected' ? 0.95 : 1 }}
              aria-label="Create new poll"
              disabled={connectionStatus !== 'connected'}
            >
              <PlusIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Create Poll</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Error Messages */}
      <AnimatePresence>
        {sendErrors.length > 0 && (
          <motion.div
            className="px-4 pt-4"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                {sendErrors[sendErrors.length - 1].error}
                {connectionStatus !== 'connected' && (
                  <p className="text-xs mt-1">Check your connection and try again.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Poll Modal */}
      <AnimatePresence>
        {showCreatePoll && isCreator && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl p-6 w-full max-w-md"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Create Poll</h3>
                <button
                  onClick={() => setShowCreatePoll(false)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Close create poll modal"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Poll Question */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Poll Question
                </label>
                <input
                  type="text"
                  value={newPoll.question}
                  onChange={(e) => setNewPoll(prev => ({ ...prev, question: e.target.value }))}
                  placeholder="What's your question?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  maxLength={200}
                />
              </div>

              {/* Poll Options */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Options
                </label>
                <div className="space-y-2">
                  {newPoll.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updatePollOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        maxLength={100}
                      />
                      {newPoll.options.length > 2 && (
                        <button
                          onClick={() => removePollOption(index)}
                          className="text-red-500 hover:text-red-700"
                          aria-label={`Remove option ${index + 1}`}
                        >
                          <XMarkIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                {newPoll.options.length < 6 && (
                  <button
                    onClick={addPollOption}
                    className="mt-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1"
                    aria-label="Add another option"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add Option
                  </button>
                )}
              </div>

              {/* Duration */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (seconds)
                </label>
                <select
                  value={newPoll.duration}
                  onChange={(e) => setNewPoll(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value={30}>30 seconds</option>
                  <option value={60}>1 minute</option>
                  <option value={120}>2 minutes</option>
                  <option value={300}>5 minutes</option>
                  <option value={600}>10 minutes</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreatePoll(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={createPoll}
                  disabled={!newPoll.question.trim() || newPoll.options.some(opt => !opt.trim()) || connectionStatus !== 'connected'}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Create Poll
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Polls */}
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto" role="region" aria-label="Active polls">
        {pollsLoading ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-3 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span>Loading polls...</span>
            </div>
          </div>
        ) : activePolls.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <ChartBarIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium mb-1">No active polls</p>
            <p className="text-sm">
              {isCreator 
                ? 'Create a poll to engage with your audience!' 
                : 'Waiting for the creator to start a poll...'
              }
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {activePolls.map((poll, index) => {
              const hasVoted = votedPolls.has(poll.pollId);
              const isExpired = poll.status === 'closed';
              const winningOption = getWinningOption(poll);
              const canVote = connectionStatus === 'connected' && !hasVoted && !isExpired;
              
              return (
                <motion.div
                  key={poll.pollId}
                  className={`border rounded-xl p-4 ${
                    isExpired ? 'border-gray-300 bg-gray-50' : 'border-indigo-200 bg-indigo-50'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  role="article"
                  aria-label={`Poll: ${poll.question}. ${poll.totalVotes || 0} votes. ${getTimeRemaining(poll)}`}
                >
                  {/* Poll Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 mb-2">{poll.question}</h4>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <UserGroupIcon className="w-4 h-4" />
                          <span>{poll.totalVotes || 0} votes</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ClockIcon className="w-4 h-4" />
                          <span>{getTimeRemaining(poll)}</span>
                        </div>
                        {isExpired && winningOption && (
                          <div className="flex items-center gap-1 text-yellow-600">
                            <TrophyIcon className="w-4 h-4" />
                            <span>Winner: {winningOption.text}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {poll.status === 'active' && (
                      <div className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Live
                      </div>
                    )}
                  </div>

                  {/* Poll Options */}
                  <div className="space-y-3">
                    {poll.options.map((option) => {
                      const percentage = getOptionPercentage(poll, option);
                      const isWinner = winningOption && option.id === winningOption.id && isExpired;
                      
                      return (
                        <motion.div
                          key={option.id}
                          className="relative"
                          whileHover={canVote ? { scale: 1.02 } : {}}
                        >
                          <button
                            onClick={() => votePoll(poll.pollId, option.id)}
                            disabled={!canVote}
                            className={`w-full text-left p-3 rounded-lg border-2 transition-all relative overflow-hidden ${
                              !canVote
                                ? 'cursor-default'
                                : 'hover:border-indigo-400 hover:bg-indigo-100 cursor-pointer'
                            } ${
                              isWinner
                                ? 'border-yellow-400 bg-yellow-50'
                                : hasVoted || isExpired
                                ? 'border-gray-300 bg-gray-100'
                                : 'border-gray-200 bg-white'
                            }`}
                            aria-label={`Vote for ${option.text} in poll: ${poll.question}. ${hasVoted ? `You voted for this option. ` : ''}${percentage}% of votes`}
                            aria-disabled={!canVote}
                          >
                            {/* Progress bar background */}
                            {(hasVoted || isExpired) && (
                              <motion.div
                                className={`absolute inset-0 ${
                                  isWinner ? 'bg-yellow-200' : 'bg-indigo-200'
                                } opacity-30`}
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.8, delay: 0.2 }}
                              />
                            )}
                            
                            {/* Option content */}
                            <div className="relative flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{option.text}</span>
                                {hasVoted && (
                                  <CheckIcon className="w-4 h-4 text-green-600" />
                                )}
                                {isWinner && (
                                  <TrophyIcon className="w-4 h-4 text-yellow-600" />
                                )}
                              </div>
                              
                              {(hasVoted || isExpired) && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-600">
                                    {option.votes} votes
                                  </span>
                                  <span className="font-bold text-indigo-600">
                                    {percentage}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Poll Footer */}
                  {isExpired && (
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>Poll ended</span>
                        <span>Final results shown above</span>
                      </div>
                    </div>
                  )}

                  {/* Connection warning */}
                  {connectionStatus !== 'connected' && !isExpired && (
                    <div className="mt-3 text-xs text-orange-600 flex items-center gap-1">
                      <ExclamationCircleIcon className="w-4 h-4" />
                      Connection lost. Votes may not be recorded.
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};

InteractiveLivePolls.propTypes = {
  websocket: PropTypes.object.isRequired,
  channelId: PropTypes.string.isRequired,
  isCreator: PropTypes.bool,
  user: PropTypes.object.isRequired,
  apiEndpoint: PropTypes.string
};

InteractiveLivePolls.defaultProps = {
  isCreator: false,
  apiEndpoint: '/api/polls'
};

export default memo(InteractiveLivePolls);