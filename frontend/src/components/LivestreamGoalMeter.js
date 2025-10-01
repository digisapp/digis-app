import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrophyIcon, SparklesIcon, FireIcon, BoltIcon } from '@heroicons/react/24/solid';
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

const LivestreamGoalMeter = ({ 
  currentAmount = 0, 
  goalAmount = 10000, 
  isCreator = false,
  onGoalUpdate,
  streamId,
  user,
  className = ''
}) => {
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newGoalAmount, setNewGoalAmount] = useState(goalAmount);
  const [showCelebration, setShowCelebration] = useState(false);
  const [previousAmount, setPreviousAmount] = useState(currentAmount);

  const progressPercentage = Math.min((currentAmount / goalAmount) * 100, 100);
  const isGoalReached = currentAmount >= goalAmount;
  const remainingAmount = Math.max(goalAmount - currentAmount, 0);

  // Trigger celebration animation when goal is reached
  useEffect(() => {
    if (!isGoalReached && currentAmount >= goalAmount && previousAmount < goalAmount) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);
    }
    setPreviousAmount(currentAmount);
  }, [currentAmount, goalAmount, isGoalReached, previousAmount]);

  const handleGoalUpdate = async () => {
    if (!isCreator || !onGoalUpdate) return;
    
    try {
      await onGoalUpdate(newGoalAmount);
      setIsEditingGoal(false);
    } catch (error) {
      console.error('Failed to update goal:', error);
    }
  };

  const formatTokens = (amount) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toLocaleString();
  };

  const getProgressColor = () => {
    if (isGoalReached) return 'from-green-400 to-green-600';
    if (progressPercentage >= 75) return 'from-yellow-400 to-orange-500';
    if (progressPercentage >= 50) return 'from-blue-400 to-blue-600';
    return 'from-purple-400 to-purple-600';
  };

  const getCelebrationEmojis = () => {
    const emojis = ['🎉', '🎊', '🥳', '🎈', '✨', '🎆', '🏆', '💎'];
    return Array.from({ length: 8 }, (_, i) => emojis[i % emojis.length]);
  };

  return (
    <div className={`relative bg-gradient-to-br from-purple-900/20 to-pink-900/20 backdrop-blur-md rounded-3xl p-6 border border-purple-400/30 shadow-2xl ${className}`}>
      {/* Celebration Animation */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
          >
            <div className="text-6xl font-bold text-white drop-shadow-lg">
              GOAL REACHED! 🎉
            </div>
            {getCelebrationEmojis().map((emoji, index) => (
              <motion.div
                key={index}
                initial={{ 
                  opacity: 0,
                  scale: 0,
                  x: 0,
                  y: 0,
                  rotate: 0
                }}
                animate={{ 
                  opacity: [0, 1, 1, 0],
                  scale: [0, 1.5, 1, 0],
                  x: [(Math.random() - 0.5) * 200],
                  y: [(Math.random() - 0.5) * 200],
                  rotate: [0, 360]
                }}
                transition={{ 
                  duration: 3,
                  delay: index * 0.1,
                  ease: "easeOut"
                }}
                className="absolute text-4xl"
                style={{
                  left: '50%',
                  top: '50%',
                }}
              >
                {emoji}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <motion.div 
            className="relative"
            animate={{ rotate: isGoalReached ? 360 : 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg">
              <TrophyIcon className="w-7 h-7 text-white" />
            </div>
            {isGoalReached && (
              <motion.div
                className="absolute -top-1 -right-1"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <SparklesIcon className="w-5 h-5 text-yellow-400" />
              </motion.div>
            )}
          </motion.div>
          <div>
            <h3 className="text-white font-bold text-xl flex items-center gap-2">
              Stream Goal
              {progressPercentage >= 75 && <FireIcon className="w-5 h-5 text-orange-400 animate-pulse" />}
            </h3>
            <p className="text-purple-200 text-sm font-medium">
              {isGoalReached ? (
                <span className="flex items-center gap-1">
                  <BoltIcon className="w-4 h-4 text-yellow-400" />
                  Goal Achieved! Amazing!
                </span>
              ) : (
                `${formatTokens(remainingAmount)} tokens to go`
              )}
            </p>
          </div>
        </div>

        {isCreator && (
          <div className="flex items-center gap-2">
            {isEditingGoal ? (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2"
              >
                <input
                  type="number"
                  value={newGoalAmount}
                  onChange={(e) => setNewGoalAmount(parseInt(e.target.value) || 0)}
                  className="w-28 px-3 py-2 rounded-lg bg-black/30 text-white border border-purple-400/50 text-sm font-medium focus:outline-none focus:border-purple-400 transition-colors"
                  placeholder="Goal"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleGoalUpdate}
                  className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors shadow-lg"
                >
                  <CheckIcon className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setIsEditingGoal(false);
                    setNewGoalAmount(goalAmount);
                  }}
                  className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-lg"
                >
                  <XMarkIcon className="w-4 h-4" />
                </motion.button>
              </motion.div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsEditingGoal(true)}
                className="px-4 py-2 bg-purple-600/30 hover:bg-purple-600/40 text-white rounded-lg transition-all border border-purple-400/30 font-medium flex items-center gap-2 shadow-lg"
              >
                <PencilIcon className="w-4 h-4" />
                Edit
              </motion.button>
            )}
          </div>
        )}
      </div>

      {/* Progress Bar Container */}
      <div className="relative mb-6">
        {/* Background glow effect */}
        <div className="absolute inset-0 blur-xl opacity-50">
          <div className={`h-full bg-gradient-to-r ${getProgressColor()} rounded-full`} />
        </div>
        
        {/* Main Progress Bar */}
        <div className="relative w-full h-12 bg-black/40 rounded-full overflow-hidden border border-purple-400/30 shadow-inner">
          <motion.div
            className={`h-full bg-gradient-to-r ${getProgressColor()} relative overflow-hidden shadow-lg`}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          >
            {/* Animated pattern */}
            <div className="absolute inset-0 opacity-30">
              <motion.div
                className="h-full w-full"
                style={{
                  backgroundImage: `repeating-linear-gradient(
                    45deg,
                    transparent,
                    transparent 10px,
                    rgba(255,255,255,0.1) 10px,
                    rgba(255,255,255,0.1) 20px
                  )`
                }}
                animate={{ x: [0, 28] }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            </div>
            
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ 
                duration: 3,
                repeat: Infinity,
                repeatDelay: 1,
                ease: "easeInOut"
              }}
            />
            
            {/* Edge glow */}
            <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-white/40 to-transparent" />
          </motion.div>
        </div>

        {/* Progress Text Overlay */}
        <div className="absolute inset-0 flex items-center justify-between px-4">
          <span className="text-white font-bold text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {formatTokens(currentAmount)}
          </span>
          <motion.span 
            className="text-white/90 font-medium text-xs"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {Math.round(progressPercentage)}%
          </motion.span>
          <span className="text-white/70 font-medium text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {formatTokens(goalAmount)}
          </span>
        </div>
      </div>

      {/* Goal Stats */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div 
          className="text-center bg-black/20 rounded-xl p-3 border border-purple-400/20"
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <motion.div 
            className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {Math.round(progressPercentage)}%
          </motion.div>
          <div className="text-purple-200/80 text-xs font-medium mt-1">Progress</div>
        </motion.div>
        
        <motion.div 
          className="text-center bg-black/20 rounded-xl p-3 border border-purple-400/20"
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="text-2xl font-bold text-green-400">
            {formatTokens(currentAmount)}
          </div>
          <div className="text-purple-200/80 text-xs font-medium mt-1">Collected</div>
        </motion.div>
        
        <motion.div 
          className="text-center bg-black/20 rounded-xl p-3 border border-purple-400/20"
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="text-2xl font-bold text-amber-400">
            {formatTokens(remainingAmount)}
          </div>
          <div className="text-purple-200/80 text-xs font-medium mt-1">Remaining</div>
        </motion.div>
      </div>

      {/* Recent Tips Display */}
      {isGoalReached && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-green-500/20 rounded-lg border border-green-500/30"
        >
          <div className="text-center">
            <div className="text-green-400 font-semibold mb-1">🎊 Congratulations! 🎊</div>
            <div className="text-white/90 text-sm">
              You've reached your stream goal! Keep the momentum going!
            </div>
          </div>
        </motion.div>
      )}

      {/* Milestone Markers */}
      <div className="absolute top-[88px] left-6 right-6 h-12 pointer-events-none">
        {[25, 50, 75].map((milestone) => {
          const position = (milestone / 100) * 100;
          const isPassed = progressPercentage >= milestone;
          
          return (
            <motion.div
              key={milestone}
              className="absolute top-0"
              style={{ left: `${position}%` }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: isPassed ? [1, 1.3, 1] : 1,
                opacity: 1
              }}
              transition={{ duration: 0.5, delay: milestone * 0.01 }}
            >
              <div className="relative">
                <div className={`w-1 h-12 ${
                  isPassed 
                    ? 'bg-gradient-to-b from-yellow-400 to-yellow-600' 
                    : 'bg-white/20'
                } rounded-full transform -translate-x-1/2`} />
                
                <div className={`absolute -bottom-6 left-1/2 transform -translate-x-1/2 ${
                  isPassed ? 'text-yellow-400' : 'text-purple-300/50'
                }`}>
                  <div className="text-xs font-bold">{milestone}%</div>
                  {isPassed && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.2, 1] }}
                      className="text-lg mt-1"
                    >
                      ✨
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default LivestreamGoalMeter;