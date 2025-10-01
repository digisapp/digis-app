import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrophyIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  XMarkIcon,
  SparklesIcon
} from '@heroicons/react/24/solid';
import Button from './ui/Button';
import toast from 'react-hot-toast';

const StreamGoalEditor = ({
  currentGoal,
  onUpdateGoal,
  onClose,
  isVisible
}) => {
  const [currentLevel, setCurrentLevel] = useState(currentGoal?.currentLevel || 1);
  const [goals, setGoals] = useState({
    level1: {
      amount: currentGoal?.level1?.amount || 5000,
      description: currentGoal?.level1?.description || 'Level 1 Goal'
    },
    level2: {
      amount: currentGoal?.level2?.amount || 10000,
      description: currentGoal?.level2?.description || 'Level 2 Goal'
    },
    level3: {
      amount: currentGoal?.level3?.amount || 25000,
      description: currentGoal?.level3?.description || 'Level 3 Goal'
    }
  });
  const [showCelebration, setShowCelebration] = useState(false);
  
  useEffect(() => {
    // Check if goal was just reached
    if (currentGoal?.currentAmount >= currentGoal?.goalAmount && currentGoal?.goalAmount > 0 && !currentGoal?.celebrated) {
      setShowCelebration(true);
      // Auto-hide celebration after 5 seconds
      setTimeout(() => setShowCelebration(false), 5000);
    }
  }, [currentGoal]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate all goal amounts
    if (goals.level1.amount < 100 || goals.level2.amount < 100 || goals.level3.amount < 100) {
      toast.error('All goals must be at least 100 tokens');
      return;
    }
    
    if (goals.level2.amount <= goals.level1.amount) {
      toast.error('Level 2 goal must be higher than Level 1');
      return;
    }
    
    if (goals.level3.amount <= goals.level2.amount) {
      toast.error('Level 3 goal must be higher than Level 2');
      return;
    }

    const currentLevelKey = `level${currentLevel}`;
    onUpdateGoal({
      ...currentGoal,
      currentLevel,
      level1: goals.level1,
      level2: goals.level2,
      level3: goals.level3,
      goalAmount: goals[currentLevelKey].amount,
      description: goals[currentLevelKey].description,
      celebrated: false // Reset celebration flag for new goal
    });
    
    // toast.success('Goals updated successfully!');
    onClose();
  };

  const updateGoalForLevel = (level, field, value) => {
    setGoals(prev => ({
      ...prev,
      [`level${level}`]: {
        ...prev[`level${level}`],
        [field]: value
      }
    }));
  };

  return (
    <>
      {/* Goal Editor Modal */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-600/20 rounded-lg">
                    <TrophyIcon className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Edit Goals</h2>
                    <p className="text-sm text-gray-400">Set up to 3 goal levels for your stream</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Current Progress */}
              {currentGoal && (
                <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Current Progress</span>
                    <span className="text-sm font-bold text-white">
                      {Math.round((currentGoal.currentAmount / currentGoal.goalAmount) * 100)}%
                    </span>
                  </div>
                  <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      initial={{ width: 0 }}
                      animate={{ 
                        width: `${Math.min((currentGoal.currentAmount / currentGoal.goalAmount) * 100, 100)}%` 
                      }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">
                      {currentGoal.currentAmount.toLocaleString()} tokens raised
                    </span>
                    <span className="text-xs text-gray-500">
                      Goal: {currentGoal.goalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Current Active Level */}
                <div className="bg-purple-600/20 rounded-lg p-3">
                  <p className="text-sm text-purple-300 mb-2">Currently Active Goal</p>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setCurrentLevel(level)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          currentLevel === level
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        Level {level}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Goal Levels */}
                <div className="space-y-4">
                  {[1, 2, 3].map((level) => (
                    <div
                      key={level}
                      className={`border rounded-lg p-4 transition-all ${
                        currentLevel === level
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-gray-700 bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-white flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                            level === 1 ? 'bg-green-600' :
                            level === 2 ? 'bg-blue-600' :
                            'bg-purple-600'
                          }`}>
                            {level}
                          </span>
                          Level {level} Goal
                        </h4>
                        {currentLevel === level && (
                          <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            Description
                          </label>
                          <input
                            type="text"
                            value={goals[`level${level}`].description}
                            onChange={(e) => updateGoalForLevel(level, 'description', e.target.value)}
                            placeholder={`Level ${level} goal description`}
                            className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            maxLength={50}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            Amount (tokens)
                          </label>
                          <div className="relative">
                            <CurrencyDollarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                              type="number"
                              value={goals[`level${level}`].amount}
                              onChange={(e) => updateGoalForLevel(level, 'amount', Math.max(100, parseInt(e.target.value) || 0))}
                              min="100"
                              step="100"
                              className="w-full bg-gray-700 text-white pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                              ≈ ${(goals[`level${level}`].amount * 0.05).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onClose}
                    fullWidth
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                  >
                    Update Goal
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Goal Reached Celebration */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              {/* Confetti Effect */}
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-3 h-3 bg-gradient-to-br from-purple-400 to-pink-400"
                    style={{
                      left: '50%',
                      top: '50%',
                      borderRadius: Math.random() > 0.5 ? '50%' : '0%'
                    }}
                    initial={{ x: 0, y: 0, scale: 0 }}
                    animate={{
                      x: (Math.random() - 0.5) * 400,
                      y: (Math.random() - 0.5) * 400,
                      scale: [0, 1, 0],
                      rotate: Math.random() * 720
                    }}
                    transition={{
                      duration: 2,
                      delay: i * 0.05,
                      ease: "easeOut"
                    }}
                  />
                ))}
              </div>

              {/* Main Content */}
              <motion.div
                animate={{ rotate: [0, -5, 5, -5, 5, 0] }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="relative z-10"
              >
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-1 rounded-full mb-6 inline-block">
                  <div className="bg-gray-900 rounded-full p-6">
                    <TrophyIcon className="w-20 h-20 text-yellow-400" />
                  </div>
                </div>
                
                <h1 className="text-5xl font-bold text-white mb-4">
                  GOAL REACHED!
                </h1>
                
                <div className="flex items-center justify-center gap-2 text-3xl text-yellow-400 mb-4">
                  <SparklesIcon className="w-8 h-8" />
                  <span className="font-bold">{currentGoal?.goalAmount.toLocaleString()}</span>
                  <span className="text-white">tokens</span>
                  <SparklesIcon className="w-8 h-8" />
                </div>
                
                <p className="text-xl text-gray-300">
                  Amazing job, Level {currentGoal?.currentLevel || 1} - {currentGoal?.description || 'Goal'} achieved! 🎉
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default StreamGoalEditor;