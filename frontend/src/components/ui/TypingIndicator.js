import React from 'react';
import { motion } from 'framer-motion';

const TypingIndicator = ({ 
  users = [], 
  maxDisplay = 3,
  className = '' 
}) => {
  if (users.length === 0) return null;

  const displayUsers = users.slice(0, maxDisplay);
  const extraCount = users.length - maxDisplay;

  const getTypingText = () => {
    if (users.length === 1) {
      return `${displayUsers[0]} is typing`;
    } else if (users.length === 2) {
      return `${displayUsers[0]} and ${displayUsers[1]} are typing`;
    } else if (users.length > maxDisplay) {
      return `${displayUsers.join(', ')} and ${extraCount} more are typing`;
    } else {
      return `${displayUsers.join(', ')} are typing`;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className={`flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 ${className}`}
    >
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full"
            animate={{
              y: [0, -5, 0],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.1,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
      <span>{getTypingText()}</span>
    </motion.div>
  );
};

export default TypingIndicator;