import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { TrophyIcon, SparklesIcon, FireIcon } from '@heroicons/react/24/solid';

const StreamMilestones = ({ viewerCount, tipAmount, className = '' }) => {
  const [currentMilestone, setCurrentMilestone] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const achievedMilestonesRef = useRef(new Set());
  const lastTipAmountRef = useRef(0);

  // Define milestones
  const viewerMilestones = [
    { count: 50, label: '50 Viewers!', icon: '🎉', color: 'from-blue-400 to-cyan-400' },
    { count: 100, label: '100 Viewers!', icon: '🚀', color: 'from-purple-400 to-pink-400' },
    { count: 500, label: '500 Viewers!', icon: '🔥', color: 'from-orange-400 to-red-400' },
    { count: 1000, label: '1K Viewers!', icon: '👑', color: 'from-yellow-400 to-amber-400' },
  ];

  // Check for viewer milestones
  useEffect(() => {
    const milestone = viewerMilestones.find(m => 
      viewerCount >= m.count && !achievedMilestonesRef.current.has(`viewer-${m.count}`)
    );

    if (milestone) {
      achievedMilestonesRef.current.add(`viewer-${milestone.count}`);
      celebrateMilestone(milestone);
    }
  }, [viewerCount]);

  // Check for big tips
  useEffect(() => {
    if (tipAmount > lastTipAmountRef.current) {
      const tipDifference = tipAmount - lastTipAmountRef.current;
      
      // Celebrate big tips (100+ tokens)
      if (tipDifference >= 100) {
        const tipMilestone = {
          label: tipDifference >= 500 ? 'MEGA TIP!' : 'BIG TIP!',
          icon: tipDifference >= 500 ? '💎' : '💰',
          color: tipDifference >= 500 ? 'from-purple-400 to-pink-400' : 'from-green-400 to-emerald-400',
          isTip: true,
          amount: tipDifference
        };
        celebrateMilestone(tipMilestone, true);
      }
      
      lastTipAmountRef.current = tipAmount;
    }
  }, [tipAmount]);

  const celebrateMilestone = (milestone, playSound = true) => {
    setCurrentMilestone(milestone);
    setShowCelebration(true);

    // Trigger confetti
    if (milestone.isTip) {
      // Special confetti for tips
      const colors = milestone.amount >= 500 
        ? ['#FFD700', '#FFA500', '#FF6347'] // Gold colors for mega tips
        : ['#10B981', '#34D399', '#6EE7B7']; // Green colors for big tips

      confetti({
        particleCount: milestone.amount >= 500 ? 200 : 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: colors,
        ticks: 300,
        gravity: 0.8,
        scalar: 1.2,
        shapes: ['circle', 'square'],
        disableForReducedMotion: true
      });

      // Extra burst for mega tips
      if (milestone.amount >= 500) {
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: colors
          });
          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: colors
          });
        }, 250);
      }
    } else {
      // Standard confetti for viewer milestones
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B'],
        ticks: 200,
        gravity: 1,
        scalar: 1,
        shapes: ['circle', 'square'],
        disableForReducedMotion: true
      });
    }

    // Play sound effect (in production, you'd play actual audio)
    if (playSound) {
      // Play celebration sound
      console.log('Playing celebration sound for:', milestone.label);
    }

    // Hide celebration after delay
    setTimeout(() => {
      setShowCelebration(false);
      setTimeout(() => setCurrentMilestone(null), 500);
    }, milestone.isTip ? 4000 : 3000);
  };

  return (
    <AnimatePresence>
      {showCelebration && currentMilestone && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ 
            type: "spring",
            stiffness: 260,
            damping: 20
          }}
          className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 ${className}`}
        >
          <div className="relative">
            {/* Glow effect */}
            <div className={`absolute inset-0 bg-gradient-to-r ${currentMilestone.color} blur-3xl opacity-70 animate-pulse`} />
            
            {/* Main celebration box */}
            <motion.div
              animate={{ 
                scale: [1, 1.05, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className={`relative bg-gradient-to-r ${currentMilestone.color} p-1 rounded-2xl shadow-2xl`}
            >
              <div className="bg-gray-900/90 backdrop-blur-xl rounded-2xl p-6 min-w-[300px]">
                {/* Icon */}
                <motion.div
                  animate={{ 
                    rotate: 360,
                    scale: [1, 1.2, 1]
                  }}
                  transition={{ 
                    rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                    scale: { duration: 1, repeat: Infinity }
                  }}
                  className="text-6xl text-center mb-4"
                >
                  {currentMilestone.icon}
                </motion.div>
                
                {/* Text */}
                <div className="text-center">
                  <h3 className="text-3xl font-bold text-white mb-2">
                    {currentMilestone.label}
                  </h3>
                  
                  {currentMilestone.amount && (
                    <p className="text-xl text-yellow-400 font-bold">
                      +{currentMilestone.amount} tokens
                    </p>
                  )}
                  
                  {!currentMilestone.isTip && (
                    <p className="text-gray-300 text-sm mt-2">
                      Amazing milestone reached!
                    </p>
                  )}
                </div>
                
                {/* Animated sparkles */}
                <div className="absolute -top-4 -right-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  >
                    <SparklesIcon className="w-8 h-8 text-yellow-400" />
                  </motion.div>
                </div>
                
                <div className="absolute -bottom-4 -left-4">
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  >
                    <SparklesIcon className="w-6 h-6 text-pink-400" />
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StreamMilestones;