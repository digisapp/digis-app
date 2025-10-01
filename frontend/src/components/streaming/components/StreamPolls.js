/**
 * Stream polls component for interactive voting
 * @module components/StreamPolls
 */

import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ChartBarIcon,
  PlusIcon,
  XMarkIcon,
  ClockIcon,
  CheckCircleIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';

/**
 * Interactive polls for live streams
 */
const StreamPolls = memo(({
  streamId,
  isCreator,
  user,
  onCreatePoll,
  onVote,
  onEndPoll,
  activePoll = null,
  pollHistory = []
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollDuration, setPollDuration] = useState(60); // seconds
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  /**
   * Update timer for active poll
   */
  useEffect(() => {
    if (!activePoll || !activePoll.endsAt) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, 
        Math.floor((new Date(activePoll.endsAt) - new Date()) / 1000)
      );
      setTimeRemaining(remaining);

      if (remaining === 0 && isCreator) {
        onEndPoll?.(activePoll.id);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activePoll, isCreator, onEndPoll]);

  /**
   * Check if user has voted
   */
  useEffect(() => {
    if (activePoll && activePoll.votes) {
      const userVote = activePoll.votes.find(v => v.userId === user.id);
      if (userVote) {
        setHasVoted(true);
        setSelectedOption(userVote.optionIndex);
      } else {
        setHasVoted(false);
        setSelectedOption(null);
      }
    }
  }, [activePoll, user.id]);

  /**
   * Format time remaining
   */
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Add poll option
   */
  const addOption = () => {
    if (pollOptions.length < 6) {
      setPollOptions([...pollOptions, '']);
    }
  };

  /**
   * Remove poll option
   */
  const removeOption = (index) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  /**
   * Update poll option
   */
  const updateOption = (index, value) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  /**
   * Create poll
   */
  const handleCreatePoll = () => {
    const validOptions = pollOptions.filter(opt => opt.trim());
    
    if (!pollQuestion.trim() || validOptions.length < 2) {
      toast.error('Please enter a question and at least 2 options');
      return;
    }

    onCreatePoll?.({
      question: pollQuestion,
      options: validOptions,
      duration: pollDuration
    });

    setShowCreateModal(false);
    setPollQuestion('');
    setPollOptions(['', '']);
    setPollDuration(60);
  };

  /**
   * Submit vote
   */
  const handleVote = (optionIndex) => {
    if (hasVoted) return;
    
    setSelectedOption(optionIndex);
    onVote?.(activePoll.id, optionIndex);
    setHasVoted(true);
  };

  /**
   * Calculate vote percentages
   */
  const getVotePercentage = (optionIndex) => {
    if (!activePoll || !activePoll.votes || activePoll.votes.length === 0) {
      return 0;
    }
    
    const optionVotes = activePoll.votes.filter(v => v.optionIndex === optionIndex).length;
    return Math.round((optionVotes / activePoll.votes.length) * 100);
  };

  /**
   * Get total votes for option
   */
  const getVoteCount = (optionIndex) => {
    if (!activePoll || !activePoll.votes) return 0;
    return activePoll.votes.filter(v => v.optionIndex === optionIndex).length;
  };

  /**
   * Active poll display
   */
  const ActivePoll = () => {
    if (!activePoll) return null;

    const totalVotes = activePoll.votes?.length || 0;
    const showResults = hasVoted || isCreator || timeRemaining === 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-gray-800 rounded-xl p-4 border border-gray-700"
      >
        {/* Poll header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg">{activePoll.question}</h3>
          <div className="flex items-center gap-2">
            {timeRemaining > 0 ? (
              <div className="flex items-center gap-1 text-sm">
                <ClockIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400">{formatTime(timeRemaining)}</span>
              </div>
            ) : (
              <span className="text-gray-400 text-sm">Poll ended</span>
            )}
            {isCreator && timeRemaining > 0 && (
              <button
                onClick={() => onEndPoll?.(activePoll.id)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <XMarkIcon className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Poll options */}
        <div className="space-y-2 mb-4">
          {activePoll.options.map((option, index) => {
            const percentage = getVotePercentage(index);
            const voteCount = getVoteCount(index);
            const isSelected = selectedOption === index;
            const canVote = !hasVoted && timeRemaining > 0 && !isCreator;

            return (
              <motion.button
                key={index}
                whileHover={canVote ? { scale: 1.02 } : {}}
                whileTap={canVote ? { scale: 0.98 } : {}}
                onClick={() => canVote && handleVote(index)}
                disabled={!canVote}
                className={`w-full relative overflow-hidden rounded-lg transition-all ${
                  canVote
                    ? 'hover:bg-gray-700 cursor-pointer'
                    : 'cursor-default'
                }`}
              >
                <div className="relative z-10 flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <CheckCircleSolidIcon className="w-5 h-5 text-green-400" />
                    )}
                    <span className="text-white">{option}</span>
                  </div>
                  {showResults && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm">{voteCount} votes</span>
                      <span className="text-white font-semibold">{percentage}%</span>
                    </div>
                  )}
                </div>
                
                {/* Progress bar */}
                {showResults && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={`absolute inset-0 ${
                      isSelected
                        ? 'bg-gradient-to-r from-green-500/20 to-green-400/20'
                        : 'bg-gradient-to-r from-purple-500/20 to-pink-500/20'
                    }`}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Poll footer */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-gray-400">
            <UserGroupIcon className="w-4 h-4" />
            <span>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</span>
          </div>
          {hasVoted && timeRemaining > 0 && (
            <span className="text-green-400 flex items-center gap-1">
              <CheckCircleIcon className="w-4 h-4" />
              Vote submitted
            </span>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <>
      {/* Active poll or create button */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          {activePoll ? (
            <ActivePoll key="active-poll" />
          ) : isCreator ? (
            <motion.div
              key="create-poll"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <ChartBarIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">No active poll</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold flex items-center gap-2 mx-auto"
              >
                <PlusIcon className="w-5 h-5" />
                Create Poll
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="no-poll"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <ChartBarIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No active poll</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Poll history button */}
        {isCreator && pollHistory.length > 0 && (
          <button
            onClick={() => setShowHistoryModal(true)}
            className="mt-4 text-purple-400 hover:text-purple-300 text-sm"
          >
            View poll history ({pollHistory.length})
          </button>
        )}
      </div>

      {/* Create poll modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-gray-800 rounded-xl p-6 max-w-md w-full"
            >
              <h2 className="text-white text-xl font-bold mb-4">Create Poll</h2>

              {/* Question input */}
              <input
                type="text"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Enter your question"
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
                maxLength={200}
              />

              {/* Options */}
              <div className="space-y-2 mb-4">
                {pollOptions.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      maxLength={100}
                    />
                    {pollOptions.length > 2 && (
                      <button
                        onClick={() => removeOption(index)}
                        className="p-2 hover:bg-gray-700 rounded-lg"
                      >
                        <XMarkIcon className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                ))}
                
                {pollOptions.length < 6 && (
                  <button
                    onClick={addOption}
                    className="w-full py-2 border border-dashed border-gray-600 text-gray-400 rounded-lg hover:border-gray-500 hover:text-gray-300"
                  >
                    <PlusIcon className="w-4 h-4 inline mr-1" />
                    Add option
                  </button>
                )}
              </div>

              {/* Duration selector */}
              <div className="mb-4">
                <label className="text-gray-400 text-sm mb-2 block">Duration</label>
                <select
                  value={pollDuration}
                  onChange={(e) => setPollDuration(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none"
                >
                  <option value="30">30 seconds</option>
                  <option value="60">1 minute</option>
                  <option value="120">2 minutes</option>
                  <option value="300">5 minutes</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePoll}
                  className="flex-1 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold"
                >
                  Create Poll
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

StreamPolls.displayName = 'StreamPolls';

export default StreamPolls;