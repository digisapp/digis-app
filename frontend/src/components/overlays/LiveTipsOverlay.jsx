import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Coins } from 'lucide-react';

const LiveTipsOverlay = ({ socket, channel }) => {
  const [tips, setTips] = useState([]);
  const [displayedTips, setDisplayedTips] = useState([]);
  const tipQueueRef = useRef([]);
  const processingRef = useRef(false);

  useEffect(() => {
    if (!socket || !channel) return;

    const handleNewTip = (tipData) => {
      console.log('New tip received:', tipData);

      const tip = {
        id: tipData.tipId || Date.now(),
        username: tipData.fromUsername || 'Anonymous',
        amount: tipData.amountTokens || 0,
        message: tipData.message || null,
        timestamp: Date.now()
      };

      // Add to queue
      tipQueueRef.current.push(tip);

      // Process queue if not already processing
      if (!processingRef.current) {
        processNextTip();
      }
    };

    // Listen for new tips on this channel
    socket.on(`tip:new:${channel}`, handleNewTip);

    return () => {
      socket.off(`tip:new:${channel}`, handleNewTip);
    };
  }, [socket, channel]);

  const processNextTip = () => {
    if (tipQueueRef.current.length === 0) {
      processingRef.current = false;
      return;
    }

    processingRef.current = true;
    const nextTip = tipQueueRef.current.shift();

    // Add to displayed tips
    setDisplayedTips(prev => [...prev, nextTip]);

    // Remove after animation completes (5 seconds)
    setTimeout(() => {
      setDisplayedTips(prev => prev.filter(t => t.id !== nextTip.id));

      // Process next tip after a brief delay
      setTimeout(() => {
        processNextTip();
      }, 500);
    }, 5000);
  };

  return (
    <div className="fixed top-20 left-4 right-4 z-40 pointer-events-none">
      <div className="max-w-sm space-y-2">
        <AnimatePresence>
          {displayedTips.map((tip) => (
            <motion.div
              key={tip.id}
              initial={{ x: -100, opacity: 0, scale: 0.8 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 100, opacity: 0, scale: 0.8 }}
              transition={{
                type: 'spring',
                damping: 25,
                stiffness: 300,
                exit: { duration: 0.3 }
              }}
              className="relative"
            >
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-2xl blur-xl" />

              {/* Tip Card */}
              <div className="relative bg-gradient-to-r from-pink-500 to-purple-500 p-0.5 rounded-2xl shadow-2xl">
                <div className="bg-gray-900/95 backdrop-blur-sm rounded-2xl p-4">
                  <div className="flex items-start space-x-3">
                    {/* Heart Icon */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.2, 1] }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center flex-shrink-0"
                    >
                      <Heart className="w-5 h-5 text-white" fill="currentColor" />
                    </motion.div>

                    {/* Tip Content */}
                    <div className="flex-1 min-w-0">
                      {/* Username and Amount */}
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-bold text-white truncate">
                          {tip.username}
                        </p>
                        <div className="flex items-center space-x-1 bg-yellow-500/20 px-2 py-1 rounded-full">
                          <Coins className="w-4 h-4 text-yellow-400" />
                          <span className="text-sm font-bold text-yellow-400">
                            {tip.amount}
                          </span>
                        </div>
                      </div>

                      {/* Message */}
                      {tip.message && (
                        <p className="text-sm text-gray-300 line-clamp-2">
                          {tip.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sparkles Animation */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1.5, delay: 0.3 }}
                className="absolute inset-0 pointer-events-none"
              >
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{
                      x: '50%',
                      y: '50%',
                      scale: 0
                    }}
                    animate={{
                      x: `${50 + Math.cos((i * Math.PI * 2) / 8) * 50}%`,
                      y: `${50 + Math.sin((i * Math.PI * 2) / 8) * 50}%`,
                      scale: [0, 1, 0],
                      opacity: [0, 1, 0]
                    }}
                    transition={{
                      duration: 1,
                      delay: 0.3 + (i * 0.05)
                    }}
                    className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                    style={{
                      boxShadow: '0 0 10px rgba(250, 204, 21, 0.5)'
                    }}
                  />
                ))}
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LiveTipsOverlay;
