import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import { getAuthToken } from '../utils/auth-helpers';
import socketService from '../utils/socket';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  ChartBarIcon,
  ClockIcon,
  CheckIcon,
  XMarkIcon,
  UserGroupIcon,
  FireIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';

const InteractiveLivePolls = ({ 
  channel, 
  isCreator = false, 
  user 
}) => {
  const [activePolls, setActivePolls] = useState([]);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [newPoll, setNewPoll] = useState({
    question: '',
    options: ['', ''],
    duration: 60
  });
  const [votedPolls, setVotedPolls] = useState(new Set());

  useEffect(() => {
    if (!channel) return;
    
    // Socket listeners for real-time poll updates
    const handlePollCreated = (data) => {
      addPoll(data.poll);
    };
    
    const handlePollUpdate = (data) => {
      updatePollResults(data.pollId, data.votes, data.totalVotes);
    };
    
    const handlePollEnded = (data) => {
      closePoll(data.pollId);
    };
    
    socketService.on('poll-created', handlePollCreated);
    socketService.on('poll-update', handlePollUpdate);
    socketService.on('poll-ended', handlePollEnded);
    
    return () => {
      socketService.off('poll-created', handlePollCreated);
      socketService.off('poll-update', handlePollUpdate);
      socketService.off('poll-ended', handlePollEnded);
    };
  }, [channel]);

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
  };

  const createPoll = async () => {
    if (!newPoll.question.trim() || newPoll.options.some(opt => !opt.trim())) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/stream-features/poll`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            channel,
            question: newPoll.question.trim(),
            options: newPoll.options.filter(opt => opt.trim()).map(opt => opt.trim()),
            duration: newPoll.duration
          })
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setShowCreatePoll(false);
        setNewPoll({ question: '', options: ['', ''], duration: 60 });
        toast.success('Poll created!');
      } else {
        throw new Error('Failed to create poll');
      }
    } catch (error) {
      console.error('Error creating poll:', error);
      toast.error('Failed to create poll');
    }

    // Form reset already handled in try block
  };

  const votePoll = async (pollId, optionIndex) => {
    if (votedPolls.has(pollId)) {
      toast.error('You have already voted on this poll');
      return;
    }

    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/stream-features/poll/${pollId}/vote`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            optionIndex
          })
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setVotedPolls(prev => new Set([...prev, pollId]));
        toast.success('Vote submitted!');
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to vote');
      }
    } catch (error) {
      console.error('Error voting:', error);
      toast.error(error.message || 'Failed to submit vote');
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
          </div>
          
          {isCreator && (
            <motion.button
              onClick={() => setShowCreatePoll(true)}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Create new poll"
              onKeyDown={(e) => e.key === 'Enter' && setShowCreatePoll(true)}
            >
              <PlusIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Create Poll</span>
            </motion.button>
          )}
        </div>
      </div>

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
                  onKeyDown={(e) => e.key === 'Enter' && setShowCreatePoll(false)}
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
                          onKeyDown={(e) => e.key === 'Enter' && removePollOption(index)}
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
                    onKeyDown={(e) => e.key === 'Enter' && addPollOption()}
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
                  disabled={!newPoll.question.trim() || newPoll.options.some(opt => !opt.trim())}
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
        {activePolls.length === 0 ? (
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
                          whileHover={!hasVoted && !isExpired ? { scale: 1.02 } : {}}
                        >
                          <button
                            onClick={() => votePoll(poll.pollId, option.id)}
                            disabled={hasVoted || isExpired}
                            className={`w-full text-left p-3 rounded-lg border-2 transition-all relative overflow-hidden ${
                              hasVoted || isExpired
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
                            aria-disabled={hasVoted || isExpired}
                            onKeyDown={(e) => e.key === 'Enter' && !hasVoted && !isExpired && votePoll(poll.pollId, option.id)}
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
  user: PropTypes.object.isRequired
};

InteractiveLivePolls.defaultProps = {
  isCreator: false
};

// Export enhanced version with retry logic
export { default } from './InteractiveLivePollsEnhanced';
export { default as InteractiveLivePollsOriginal } from './InteractiveLivePolls';