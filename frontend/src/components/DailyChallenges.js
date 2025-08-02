import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAuthToken } from '../utils/auth-helpers';

const DailyChallenges = ({ user, onChallengeComplete, className = '' }) => {
  const [challenges, setChallenges] = useState({ daily: [], weekly: [] });
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('daily');
  const [showReward, setShowReward] = useState(null);

  useEffect(() => {
    if (user) {
      fetchChallenges();
    }
  }, [user]);

  const fetchChallenges = async () => {
    try {
      const response = await fetch('/api/challenges/available', {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setChallenges(data.challenges);
      }
    } catch (error) {
      console.error('Failed to fetch challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateChallengeProgress = async (challengeId, increment = 1, metadata = {}) => {
    try {
      const response = await fetch('/api/challenges/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          challengeId,
          progressIncrement: increment,
          metadata
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update local state
        setChallenges(prev => {
          const updated = { ...prev };
          [selectedTab].forEach(type => {
            updated[type] = updated[type].map(challenge =>
              challenge.id === challengeId
                ? { ...challenge, ...data.challenge }
                : challenge
            );
          });
          return updated;
        });

        // Show reward animation if completed
        if (data.challenge.completed && data.tokensEarned > 0) {
          setShowReward({
            challenge: data.challenge,
            tokensEarned: data.tokensEarned
          });
          setTimeout(() => setShowReward(null), 3000);
          
          if (onChallengeComplete) {
            onChallengeComplete(data.challenge, data.tokensEarned);
          }
        }

        return data;
      }
    } catch (error) {
      console.error('Failed to update challenge progress:', error);
    }
  };

  const getProgressPercentage = (challenge) => {
    if (typeof challenge.target === 'object') {
      // Handle complex targets (like social challenges)
      const keys = Object.keys(challenge.target);
      const percentages = keys.map(key => 
        Math.min((challenge.progress[key] || 0) / challenge.target[key] * 100, 100)
      );
      return Math.min(...percentages);
    }
    return Math.min((challenge.progress / challenge.target) * 100, 100);
  };

  const formatTarget = (target) => {
    if (typeof target === 'object') {
      return Object.entries(target)
        .map(([key, value]) => `${value} ${key}`)
        .join(', ');
    }
    return target.toString();
  };

  const formatProgress = (challenge) => {
    if (typeof challenge.target === 'object') {
      return Object.entries(challenge.target)
        .map(([key, value]) => `${challenge.progress[key] || 0}/${value} ${key}`)
        .join(', ');
    }
    return `${challenge.progress}/${challenge.target}`;
  };

  const getChallengeIcon = (challenge) => {
    const iconMap = {
      login: '🌅',
      stream_watch: '📺',
      chat_messages: '💬',
      tip_amount: '💰',
      profile_visits: '🔍',
      total_watch_time: '⏰',
      unique_creators: '🌟',
      total_spending: '💎',
      social_interaction: '🦋',
      login_streak: '🔥'
    };
    return iconMap[challenge.type] || challenge.icon || '🎯';
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-lg overflow-hidden ${className}`}>
      {/* Reward Animation */}
      <AnimatePresence>
        {showReward && (
          <motion.div
            initial={{ opacity: 0, scale: 0, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0, y: -50 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <motion.div
              animate={{ 
                rotate: [0, 5, -5, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                repeat: Infinity,
                duration: 2,
                ease: "easeInOut"
              }}
              className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-8 text-white text-center shadow-2xl max-w-sm mx-4"
            >
              <div className="text-6xl mb-4">🎉</div>
              <div className="text-2xl font-bold mb-2">Challenge Complete!</div>
              <div className="text-lg mb-2">{showReward.challenge.title}</div>
              <div className="text-3xl font-bold">
                +{showReward.tokensEarned} tokens!
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white">
        <h2 className="text-2xl font-bold mb-4">Daily Challenges</h2>
        
        {/* Tabs */}
        <div className="flex bg-white/10 rounded-lg p-1">
          {['daily', 'weekly'].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                selectedTab === tab
                  ? 'bg-white text-purple-600 shadow-md'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className="ml-2 text-xs">
                ({challenges[tab]?.length || 0})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Challenges List */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {challenges[selectedTab]?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-4">🎯</div>
                <div>No {selectedTab} challenges available</div>
                <div className="text-sm mt-2">Check back tomorrow for new challenges!</div>
              </div>
            ) : (
              <div className="space-y-4">
                {challenges[selectedTab]?.map((challenge, index) => {
                  const progressPercentage = getProgressPercentage(challenge);
                  const isCompleted = challenge.completed || challenge.status === 'completed';
                  
                  return (
                    <motion.div
                      key={challenge.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`relative bg-gradient-to-r ${
                        isCompleted
                          ? 'from-green-50 to-green-100 border-green-200'
                          : 'from-gray-50 to-white border-gray-200'
                      } border rounded-xl p-4 overflow-hidden`}
                    >
                      {/* Background Pattern */}
                      <div className="absolute inset-0 opacity-5">
                        <div className="h-full w-full" style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000' fill-opacity='0.1'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3C/g%3E%3C/svg%3E")`
                        }}></div>
                      </div>

                      <div className="relative flex items-start gap-4">
                        {/* Challenge Icon */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                          isCompleted 
                            ? 'bg-green-200 text-green-800' 
                            : 'bg-purple-100 text-purple-600'
                        }`}>
                          {isCompleted ? '✅' : getChallengeIcon(challenge)}
                        </div>

                        {/* Challenge Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className={`font-semibold ${
                                isCompleted ? 'text-green-800' : 'text-gray-900'
                              }`}>
                                {challenge.title}
                              </h3>
                              <p className="text-sm text-gray-600 mt-1">
                                {challenge.description}
                              </p>
                            </div>
                            
                            {/* Reward Badge */}
                            <div className="flex flex-col items-end">
                              <div className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full mb-1">
                                +{challenge.reward?.tokens || 0} tokens
                              </div>
                              {challenge.reward?.points > 0 && (
                                <div className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                                  +{challenge.reward.points} XP
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-3">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">
                                Progress: {formatProgress(challenge)}
                              </span>
                              <span className={`font-medium ${
                                isCompleted ? 'text-green-600' : 'text-gray-900'
                              }`}>
                                {Math.round(progressPercentage)}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <motion.div
                                className={`h-2 rounded-full ${
                                  isCompleted
                                    ? 'bg-gradient-to-r from-green-400 to-green-600'
                                    : 'bg-gradient-to-r from-purple-400 to-blue-500'
                                }`}
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercentage}%` }}
                                transition={{ duration: 0.8, delay: index * 0.1 }}
                              />
                            </div>
                          </div>

                          {/* Challenge Type Badge */}
                          <div className="flex items-center justify-between">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              selectedTab === 'daily'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {selectedTab === 'daily' ? '📅 Daily' : '📊 Weekly'}
                            </span>
                            
                            {isCompleted && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="text-green-600 font-medium text-sm"
                              >
                                ✨ Completed!
                              </motion.div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Completion Overlay */}
                      {isCompleted && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 bg-green-500/10 backdrop-blur-[1px] rounded-xl"
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Summary Stats */}
      {(challenges.daily?.length > 0 || challenges.weekly?.length > 0) && (
        <div className="border-t bg-gray-50 p-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {challenges.daily?.filter(c => c.completed).length || 0}
              </div>
              <div className="text-sm text-gray-600">Daily Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {challenges.weekly?.filter(c => c.completed).length || 0}
              </div>
              <div className="text-sm text-gray-600">Weekly Completed</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyChallenges;