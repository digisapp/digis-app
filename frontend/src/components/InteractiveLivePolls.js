import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  websocket, 
  channelId, 
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
    if (websocket) {
      setupWebSocketListeners();
    }
  }, [websocket]);

  const setupWebSocketListeners = () => {
    websocket.addEventListener('message', handleWebSocketMessage);
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
      console.error('Error parsing poll WebSocket message:', error);
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
  };

  const createPoll = () => {
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

    websocket.send(JSON.stringify(pollData));
    
    // Reset form
    setNewPoll({
      question: '',
      options: ['', ''],
      duration: 60
    });
    setShowCreatePoll(false);
  };

  const votePoll = (pollId, optionId) => {
    if (votedPolls.has(pollId)) return;

    const voteData = {
      type: 'vote_poll',
      pollId,
      optionId
    };

    websocket.send(JSON.stringify(voteData));
    setVotedPolls(prev => new Set([...prev, pollId]));
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
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
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

export default InteractiveLivePolls;