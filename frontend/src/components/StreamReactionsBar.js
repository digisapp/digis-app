import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const StreamReactionsBar = ({ onReaction, className = '' }) => {
  const [reactions, setReactions] = useState([]);
  const [showReactionsBar, setShowReactionsBar] = useState(true);
  const reactionsRef = useRef([]);
  const nextIdRef = useRef(0);

  // Available emoji reactions
  const availableReactions = ['❤️', '🔥', '😍', '👏', '✨', '💯'];

  // Add floating reaction
  const addReaction = (emoji) => {
    const id = nextIdRef.current++;
    const newReaction = {
      id,
      emoji,
      x: Math.random() * 60 - 30, // Random horizontal position (-30 to 30)
      rotation: Math.random() * 40 - 20, // Random rotation (-20 to 20)
      scale: 0.8 + Math.random() * 0.4, // Random scale (0.8 to 1.2)
    };

    setReactions(prev => [...prev, newReaction]);
    
    // Remove reaction after animation
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);

    // Notify parent component
    if (onReaction) {
      onReaction(emoji);
    }
  };

  // Handle rapid clicking for spam effect
  const handleReactionClick = (emoji) => {
    // Add multiple reactions for better visual effect
    for (let i = 0; i < 3; i++) {
      setTimeout(() => addReaction(emoji), i * 100);
    }
  };

  return (
    <>
      {/* Floating Reactions Container */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 pointer-events-none z-30">
        <AnimatePresence>
          {reactions.map((reaction) => (
            <motion.div
              key={reaction.id}
              initial={{ 
                opacity: 0, 
                y: 0, 
                x: reaction.x,
                scale: reaction.scale * 0.5,
                rotate: reaction.rotation
              }}
              animate={{ 
                opacity: [0, 1, 1, 0],
                y: -200,
                x: reaction.x + (Math.random() * 20 - 10),
                scale: [reaction.scale * 0.5, reaction.scale, reaction.scale * 0.8],
                rotate: reaction.rotation + (Math.random() * 20 - 10)
              }}
              exit={{ opacity: 0 }}
              transition={{ 
                duration: 3,
                ease: "easeOut",
                opacity: {
                  times: [0, 0.1, 0.8, 1],
                  duration: 3
                }
              }}
              className="absolute text-4xl"
              style={{
                textShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              {reaction.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Reactions Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 ${className}`}
      >
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-black/60 backdrop-blur-md rounded-full p-2 flex items-center gap-2 shadow-2xl border border-white/10"
        >
          <div className="px-2">
            <span className="text-white/60 text-sm font-medium">React:</span>
          </div>
          
          {availableReactions.map((emoji, index) => (
            <motion.button
              key={emoji}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                transition: { delay: index * 0.05 }
              }}
              onClick={() => handleReactionClick(emoji)}
              className="relative w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors group"
            >
              <span className="text-2xl transform group-hover:scale-110 transition-transform">
                {emoji}
              </span>
              
              {/* Pulse effect on hover */}
              <motion.div
                className="absolute inset-0 bg-white/20 rounded-full"
                initial={{ scale: 1, opacity: 0 }}
                whileHover={{ 
                  scale: [1, 1.3, 1.5],
                  opacity: [0, 0.3, 0],
                }}
                transition={{ 
                  duration: 0.6,
                  repeat: Infinity,
                }}
              />
            </motion.button>
          ))}
        </motion.div>
      </motion.div>
    </>
  );
};

export default StreamReactionsBar;