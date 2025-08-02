import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrophyIcon,
  GiftIcon,
  HeartIcon,
  UserPlusIcon,
  CurrencyDollarIcon,
  BoltIcon,
  FireIcon,
  SparklesIcon,
  StarIcon
} from '@heroicons/react/24/solid';
import { ChartBarIcon } from '@heroicons/react/24/outline';

const CustomizableOverlays = ({
  activeOverlays,
  streamStats,
  quickActions,
  className = ''
}) => {
  const [alerts, setAlerts] = useState([]);
  const [activePoll, setActivePoll] = useState(null);
  const [hypeTrainActive, setHypeTrainActive] = useState(false);

  // Generate mock alerts
  useEffect(() => {
    if (!activeOverlays.alerts) return;

    const generateAlert = () => {
      const alertTypes = [
        {
          type: 'follow',
          icon: UserPlusIcon,
          color: 'from-purple-600 to-pink-600',
          message: (user) => `${user} just followed!`,
          animation: 'bounce'
        },
        {
          type: 'subscription',
          icon: StarIcon,
          color: 'from-yellow-500 to-orange-500',
          message: (user, data) => `${user} subscribed for ${data.months} months!`,
          animation: 'shake'
        },
        {
          type: 'gift',
          icon: GiftIcon,
          color: 'from-pink-500 to-red-500',
          message: (user, data) => `${user} sent ${data.gift}!`,
          animation: 'spin'
        },
        {
          type: 'tip',
          icon: CurrencyDollarIcon,
          color: 'from-green-500 to-emerald-500',
          message: (user, data) => `${user} tipped $${data.amount}!`,
          animation: 'pulse'
        }
      ];

      const randomType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
      const newAlert = {
        id: Date.now(),
        ...randomType,
        user: `User${Math.floor(Math.random() * 1000)}`,
        data: {
          months: Math.floor(Math.random() * 12) + 1,
          gift: ['🎁 Diamond', '💎 Crown', '🚀 Rocket', '🌹 Rose'][Math.floor(Math.random() * 4)],
          amount: Math.floor(Math.random() * 100) + 5
        }
      };

      setAlerts(prev => [...prev, newAlert]);
      
      // Remove alert after 5 seconds
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== newAlert.id));
      }, 5000);
    };

    // Generate an alert every 10-20 seconds
    const interval = setInterval(() => {
      if (Math.random() > 0.5) generateAlert();
    }, 15000);

    return () => clearInterval(interval);
  }, [activeOverlays.alerts]);

  // Update active poll
  useEffect(() => {
    if (quickActions?.polls?.length > 0) {
      const latestPoll = quickActions.polls[quickActions.polls.length - 1];
      if (Date.now() - latestPoll.startTime < latestPoll.duration * 1000) {
        setActivePoll(latestPoll);
      }
    }
  }, [quickActions]);

  // Update hype train
  useEffect(() => {
    if (quickActions?.hypeTrain) {
      const hypeTrain = quickActions.hypeTrain;
      if (Date.now() - hypeTrain.startTime < hypeTrain.duration * 1000) {
        setHypeTrainActive(true);
      } else {
        setHypeTrainActive(false);
      }
    }
  }, [quickActions]);

  const getAlertAnimation = (animation) => {
    switch (animation) {
      case 'bounce':
        return {
          initial: { y: -100, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          exit: { y: 100, opacity: 0 }
        };
      case 'shake':
        return {
          initial: { x: 0, opacity: 0 },
          animate: { x: [0, -10, 10, -10, 10, 0], opacity: 1 },
          exit: { opacity: 0 }
        };
      case 'spin':
        return {
          initial: { rotate: -180, scale: 0, opacity: 0 },
          animate: { rotate: 0, scale: 1, opacity: 1 },
          exit: { rotate: 180, scale: 0, opacity: 0 }
        };
      case 'pulse':
        return {
          initial: { scale: 0, opacity: 0 },
          animate: { scale: [1, 1.2, 1], opacity: 1 },
          exit: { scale: 0, opacity: 0 }
        };
      default:
        return {};
    }
  };

  return (
    <div className={`pointer-events-none ${className}`}>
      {/* Stream Goal Progress */}
      {activeOverlays.goals && streamStats && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute top-4 left-1/2 transform -translate-x-1/2 w-96 max-w-[90%]"
        >
          <div className="bg-gray-900/90 backdrop-blur-sm rounded-xl p-4 shadow-2xl border border-purple-500/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrophyIcon className="w-5 h-5 text-yellow-400" />
                <span className="text-white font-semibold">Stream Goal</span>
              </div>
              <span className="text-sm text-gray-300">
                {streamStats.revenue || 0} / 500 tokens
              </span>
            </div>
            
            <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-pink-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((streamStats.revenue || 0) / 500 * 100, 100)}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
              <div className="absolute inset-0 bg-white/10 animate-pulse" />
            </div>
            
            {streamStats.revenue >= 500 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1"
              >
                <SparklesIcon className="w-3 h-3" />
                GOAL REACHED!
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {/* Alert Notifications */}
      {activeOverlays.alerts && (
        <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <AnimatePresence>
            {alerts.map(alert => {
              const Icon = alert.icon;
              const animation = getAlertAnimation(alert.animation);
              
              return (
                <motion.div
                  key={alert.id}
                  {...animation}
                  transition={{ duration: 0.5 }}
                  className="mb-4"
                >
                  <div className={`bg-gradient-to-r ${alert.color} p-6 rounded-2xl shadow-2xl flex flex-col items-center text-white`}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="mb-3"
                    >
                      <Icon className="w-12 h-12" />
                    </motion.div>
                    <p className="text-xl font-bold text-center">
                      {alert.message(alert.user, alert.data)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Active Poll */}
      {activeOverlays.polls && activePoll && (
        <motion.div
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -100, opacity: 0 }}
          className="absolute bottom-20 left-4 w-80 pointer-events-auto"
        >
          <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl p-4 shadow-2xl border border-blue-500/30">
            <div className="flex items-center gap-2 mb-3">
              <ChartBarIcon className="w-5 h-5 text-blue-400" />
              <span className="text-white font-semibold">Poll</span>
              <span className="text-xs text-gray-400 ml-auto">
                {Math.max(0, Math.floor((activePoll.duration * 1000 - (Date.now() - activePoll.startTime)) / 1000))}s
              </span>
            </div>
            
            <p className="text-white mb-3">{activePoll.question}</p>
            
            <div className="space-y-2">
              {activePoll.options.map((option, index) => {
                const votes = Object.values(activePoll.votes || {}).filter(v => v === index).length;
                const totalVotes = Object.keys(activePoll.votes || {}).length;
                const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                
                return (
                  <div key={index} className="relative">
                    <div className="bg-gray-800 rounded-lg p-2 px-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">{option}</span>
                        <span className="text-sm text-gray-400">{percentage.toFixed(0)}%</span>
                      </div>
                    </div>
                    <motion.div
                      className="absolute inset-0 bg-blue-500/20 rounded-lg"
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Hype Train */}
      {hypeTrainActive && quickActions?.hypeTrain && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="absolute bottom-4 right-4 w-96 max-w-[90%] pointer-events-auto"
        >
          <div className="bg-gradient-to-r from-purple-900/95 to-pink-900/95 backdrop-blur-sm rounded-xl p-4 shadow-2xl border border-purple-500/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <BoltIcon className="w-6 h-6 text-yellow-400" />
                </motion.div>
                <span className="text-white font-bold text-lg">HYPE TRAIN!</span>
              </div>
              <span className="text-sm text-gray-300">
                {Math.max(0, Math.floor((quickActions.hypeTrain.duration * 1000 - (Date.now() - quickActions.hypeTrain.startTime)) / 1000))}s
              </span>
            </div>
            
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-300">Progress</span>
                <span className="text-white font-semibold">
                  {quickActions.hypeTrain.current || 0} / {quickActions.hypeTrain.goal} tokens
                </span>
              </div>
              <div className="relative h-6 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-yellow-400 to-orange-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(((quickActions.hypeTrain.current || 0) / quickActions.hypeTrain.goal) * 100, 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ x: [-300, 300] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="text-2xl"
                  >
                    🚂
                  </motion.div>
                </div>
              </div>
            </div>
            
            {quickActions.hypeTrain.rewards && (
              <p className="text-sm text-gray-300">
                <span className="text-yellow-400">Reward:</span> {quickActions.hypeTrain.rewards}
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Spotlight Viewer */}
      {quickActions?.spotlightViewer && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="absolute top-24 right-4"
        >
          <div className="bg-gradient-to-r from-yellow-600/95 to-orange-600/95 backdrop-blur-sm rounded-xl p-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <SparklesIcon className="w-8 h-8 text-white animate-pulse" />
              <div>
                <p className="text-white/80 text-sm">Viewer Spotlight</p>
                <p className="text-white font-bold text-lg">{quickActions.spotlightViewer}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Particle Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-purple-400/30 rounded-full"
            initial={{ 
              x: Math.random() * window.innerWidth,
              y: window.innerHeight + 20,
              scale: Math.random() * 0.5 + 0.5
            }}
            animate={{ 
              y: -20,
              x: Math.random() * window.innerWidth
            }}
            transition={{
              duration: Math.random() * 20 + 10,
              repeat: Infinity,
              delay: Math.random() * 10,
              ease: "linear"
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default CustomizableOverlays;