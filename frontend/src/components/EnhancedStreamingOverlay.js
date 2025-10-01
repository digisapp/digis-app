import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  SparklesIcon, 
  HeartIcon,
  FireIcon,
  StarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  TrophyIcon
} from '@heroicons/react/24/solid';
import { 
  PencilIcon
} from '@heroicons/react/24/outline';
import StreamReactionsBar from './StreamReactionsBar';
import StreamQualitySelector from './StreamQualitySelector';
import StreamMilestones from './StreamMilestones';
import StreamQuickShare from './StreamQuickShare';
import socketService from '../services/socket';

const EnhancedStreamingOverlay = ({
  user,
  isCreator,
  streamStats,
  streamGoal,
  onGoalUpdate,
  onGoalEdit,
  onEndStream,
  isStreamEnding,
  streamTitle = 'Live Stream',
  streamerName = 'Creator',
  streamUrl = window.location.href,
  className = ''
}) => {
  const [giftAnimations, setGiftAnimations] = useState([]);
  const [tipAnimations, setTipAnimations] = useState([]);
  const [viewerReactions, setViewerReactions] = useState([]);
  const [newFollower, setNewFollower] = useState(null);
  const [milestone] = useState(null);
  const [displayDuration, setDisplayDuration] = useState(0);
  const durationRef = useRef(streamStats?.duration || 0);

  // Define animation functions with useCallback to avoid dependency issues
  const addGiftAnimation = useCallback((giftData) => {
    setGiftAnimations(prev => [...prev, giftData]);
    setTimeout(() => {
      setGiftAnimations(prev => prev.filter(g => g.id !== giftData.id));
    }, 5000);
  }, []);

  const addTipAnimation = useCallback((tipData) => {
    setTipAnimations(prev => [...prev, tipData]);
    setTimeout(() => {
      setTipAnimations(prev => prev.filter(t => t.id !== tipData.id));
    }, 6000);

    // Update stream goal
    if (streamGoal && onGoalUpdate) {
      onGoalUpdate(streamGoal.currentAmount + tipData.amount);
    }
  }, [streamGoal, onGoalUpdate]);

  const addViewerReaction = useCallback((reaction) => {
    const reactionData = {
      id: Date.now(),
      emoji: reaction,
      x: Math.random() * 80 + 10, // Random position between 10% and 90%
    };
    setViewerReactions(prev => [...prev, reactionData]);
    setTimeout(() => {
      setViewerReactions(prev => prev.filter(r => r.id !== reactionData.id));
    }, 3000);
  }, []);

  // Update duration display independently to avoid glitches
  useEffect(() => {
    durationRef.current = streamStats?.duration || 0;
    setDisplayDuration(durationRef.current);
    
    const durationInterval = setInterval(() => {
      durationRef.current += 1;
      setDisplayDuration(durationRef.current);
    }, 1000);
    
    return () => clearInterval(durationInterval);
  }, [streamStats?.duration]);

  // Listen for real-time events from socket
  useEffect(() => {
    if (!isCreator) return;

    // Listen for real gift events
    const handleGiftReceived = (data) => {
      const giftData = {
        id: Date.now(),
        emoji: data.emoji || '🎁',
        sender: data.sender || 'Anonymous',
        value: data.totalValue || data.amount || 0
      };
      addGiftAnimation(giftData);
    };

    // Listen for real tip events
    const handleTipReceived = (data) => {
      const tipData = {
        id: Date.now(),
        amount: data.amount || 0,
        sender: data.sender || 'Anonymous',
        message: data.message || 'Tip received!'
      };
      addTipAnimation(tipData);
    };

    // Listen for viewer reactions
    const handleReaction = (data) => {
      if (data.reaction) {
        addViewerReaction(data.reaction);
      }
    };

    // Listen for new followers
    const handleNewFollower = (data) => {
      setNewFollower({
        name: data.followerName || data.name || 'New Follower',
        timestamp: Date.now()
      });
    };

    // Register socket listeners
    socketService.on('gift-received', handleGiftReceived);
    socketService.on('tip-received', handleTipReceived);
    socketService.on('viewer-reaction', handleReaction);
    socketService.on('new-follower', handleNewFollower);

    return () => {
      // Clean up socket listeners
      socketService.off('gift-received', handleGiftReceived);
      socketService.off('tip-received', handleTipReceived);
      socketService.off('viewer-reaction', handleReaction);
      socketService.off('new-follower', handleNewFollower);
    };
  }, [isCreator, addGiftAnimation, addTipAnimation, addViewerReaction]);


  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      {/* Top Gradient for Better Visibility */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />
      
      {/* Bottom Gradient for Controls */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

      {/* Enhanced Stream Goal Progress - Top Right Corner */}
      {streamGoal?.isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 right-4 w-[320px] max-w-[90%] pointer-events-auto z-40"
        >
          <motion.div 
            className="relative bg-gradient-to-r from-gray-900/95 via-purple-900/95 to-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-purple-500/20 p-4 overflow-hidden"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            {/* Animated background */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-purple-600/10 animate-gradient-x" />
            
            {/* Content */}
            <div className="relative">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <motion.div 
                    className="relative"
                    animate={{ 
                      rotate: streamGoal.currentAmount >= streamGoal.goalAmount ? 360 : 0,
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: streamGoal.currentAmount >= streamGoal.goalAmount ? Infinity : 0,
                      ease: "linear"
                    }}
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                      <TrophyIcon className="w-5 h-5 text-white" />
                    </div>
                    {streamGoal.currentAmount >= streamGoal.goalAmount && (
                      <motion.div
                        className="absolute -top-1 -right-1"
                        animate={{ scale: [1, 1.5, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      >
                        <SparklesIcon className="w-4 h-4 text-yellow-400 drop-shadow-lg" />
                      </motion.div>
                    )}
                  </motion.div>
                  
                  <div className="flex-1">
                    <h3 className="text-white font-bold text-sm leading-tight">
                      {streamGoal.description || 'Stream Goal'}
                    </h3>
                    <p className="text-purple-300 text-xs">
                      {streamGoal.currentAmount.toLocaleString()} / {streamGoal.goalAmount.toLocaleString()} tokens
                    </p>
                  </div>
                </div>
                
                {/* Live indicator */}
                <div className="flex items-center gap-2">
                  {(streamGoal.currentAmount / streamGoal.goalAmount) >= 0.75 && (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="text-2xl"
                    >
                      🔥
                    </motion.div>
                  )}
                  
                  {/* Edit button for creator */}
                  {isCreator && onGoalEdit && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={onGoalEdit}
                      className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors backdrop-blur-sm"
                      title="Edit Goal"
                    >
                      <PencilIcon className="w-4 h-4 text-white/70" />
                    </motion.button>
                  )}
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="relative">
                <div className="relative h-6 bg-black/40 rounded-full overflow-hidden backdrop-blur-sm">
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 opacity-20"
                    animate={{ x: ["0%", "100%", "0%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  />
                  
                  <motion.div
                    className={`h-full relative overflow-hidden ${
                      streamGoal.currentAmount >= streamGoal.goalAmount 
                        ? 'bg-gradient-to-r from-green-400 via-emerald-400 to-green-500'
                        : 'bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((streamGoal.currentAmount / streamGoal.goalAmount) * 100, 100)}%` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  >
                    {/* Animated shine */}
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
                      animate={{ x: ["-200%", "200%"] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                    />
                  </motion.div>
                  
                  {/* Percentage */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white font-bold text-sm drop-shadow-lg">
                      {Math.round((streamGoal.currentAmount / streamGoal.goalAmount) * 100)}%
                    </span>
                  </div>
                </div>
                
                {/* Goal reached celebration */}
                {streamGoal.currentAmount >= streamGoal.goalAmount && (
                  <motion.div
                    initial={{ scale: 0, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    className="absolute -bottom-2 right-0 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg"
                  >
                    ✨ Goal Reached!
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Viewer Reactions - Bottom Left */}
      <div className="absolute bottom-20 left-4 flex flex-col gap-2">
        <AnimatePresence>
          {viewerReactions.map(reaction => (
            <motion.div
              key={reaction.id}
              initial={{ scale: 0, x: -50 }}
              animate={{ scale: 1, x: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              className="text-3xl"
              style={{ left: `${reaction.x}%` }}
            >
              {reaction.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Gift Animations - Center */}
      <AnimatePresence>
        {giftAnimations.map(gift => (
          <motion.div
            key={gift.id}
            initial={{ scale: 0, y: 50 }}
            animate={{ 
              scale: [0, 1.2, 1],
              y: [50, -30, -150],
              rotate: [0, 90, 180]
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 2.5, ease: "easeOut" }}
            className="absolute bottom-1/2 left-1/2 transform -translate-x-1/2 pointer-events-none"
          >
            <div className="text-center">
              <div className="text-6xl mb-2">{gift.emoji}</div>
              <div className="bg-black/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-bold">
                {gift.sender}
              </div>
              <div className="text-yellow-400 font-bold mt-1">
                +{gift.value} tokens
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Tip Alerts - Right Side */}
      <div className="absolute top-24 right-4 w-80 space-y-3 pointer-events-none">
        <AnimatePresence>
          {tipAnimations.map(tip => (
            <motion.div
              key={tip.id}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 shadow-2xl border border-gray-700/50"
            >
              <div className="flex items-center gap-3">
                <div className="bg-green-500/20 p-2 rounded-full">
                  <CurrencyDollarIcon className="w-6 h-6 text-green-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold">{tip.sender}</span>
                    <span className="text-white text-xl font-bold">${tip.amount}</span>
                  </div>
                  <p className="text-white/90 text-sm">{tip.message}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* New Follower Alert - Top Center */}
      <AnimatePresence>
        {newFollower && (
          <motion.div
            key={newFollower.timestamp}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute top-20 left-1/2 transform -translate-x-1/2 pointer-events-none"
            onAnimationComplete={() => {
              setTimeout(() => setNewFollower(null), 3000);
            }}
          >
            <div className="bg-gray-900/90 backdrop-blur-sm text-white px-6 py-3 rounded-full shadow-2xl border border-gray-700/50 flex items-center gap-3">
              <HeartIcon className="w-6 h-6 animate-pulse" />
              <span className="font-bold">{newFollower.name} just followed!</span>
              <SparklesIcon className="w-6 h-6 animate-pulse" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Interactive Stream Reactions Bar - Bottom Center */}
      {!isCreator && (
        <StreamReactionsBar 
          onReaction={(emoji) => addViewerReaction(emoji)}
          className="pointer-events-auto"
        />
      )}

      {/* Stream Quality Selector - Bottom Right */}
      <div className="absolute bottom-6 right-4 pointer-events-auto">
        <StreamQualitySelector 
          currentQuality="auto"
          onQualityChange={(quality) => console.log('Quality changed:', quality)}
        />
      </div>

      {/* Quick Share Button - Top Right */}
      <div className="absolute top-20 right-4 pointer-events-auto">
        <StreamQuickShare
          streamTitle={streamTitle}
          streamerName={streamerName}
          streamUrl={streamUrl}
          onCreateClip={() => console.log('Creating clip...')}
        />
      </div>

      {/* Stream Milestones - Shows celebrations */}
      <StreamMilestones
        viewerCount={streamStats?.viewers || 0}
        tipAmount={streamStats?.tips || 0}
      />

      {/* Milestone Celebration */}
      <AnimatePresence>
        {milestone && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            exit={{ scale: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: 3 }}
                className="text-8xl mb-4"
              >
                🎉
              </motion.div>
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-2xl font-bold px-8 py-4 rounded-full shadow-2xl">
                {milestone}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Particles Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/30 rounded-full"
            initial={{ 
              x: Math.random() * window.innerWidth,
              y: window.innerHeight + 20
            }}
            animate={{ 
              y: -20,
              x: Math.random() * window.innerWidth
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              delay: Math.random() * 10
            }}
          />
        ))}
      </div>
    </div>
  );
};

// Helper function
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default EnhancedStreamingOverlay;