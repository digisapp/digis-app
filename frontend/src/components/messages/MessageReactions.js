import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';

const MessageReactions = ({ messageId, onReaction, position = 'left', currentReactions = [] }) => {
  const [showCustomEmoji, setShowCustomEmoji] = useState(false);
  const [customEmoji, setCustomEmoji] = useState('');
  
  const popularReactions = [
    { emoji: '❤️', name: 'heart' },
    { emoji: '👍', name: 'thumbs-up' },
    { emoji: '😂', name: 'laugh' },
    { emoji: '😮', name: 'wow' },
    { emoji: '😢', name: 'sad' },
    { emoji: '😡', name: 'angry' },
    { emoji: '🔥', name: 'fire' },
    { emoji: '💯', name: 'perfect' },
    { emoji: '🎉', name: 'party' },
    { emoji: '💎', name: 'gem' },
    { emoji: '🙏', name: 'pray' },
    { emoji: '👏', name: 'clap' }
  ];
  
  const handleReaction = (emoji) => {
    onReaction(messageId, emoji);
  };
  
  const handleCustomEmoji = () => {
    if (customEmoji.trim()) {
      handleReaction(customEmoji.trim());
      setCustomEmoji('');
      setShowCustomEmoji(false);
    }
  };
  
  // Check if user has already reacted with this emoji
  const hasReacted = (emoji) => {
    return currentReactions.some(r => r.emoji === emoji && r.isOwn);
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      className={`absolute bottom-full mb-2 ${
        position === 'left' ? 'left-0' : 'right-0'
      } z-20`}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3">
        {/* Quick reactions grid */}
        <div className="grid grid-cols-6 gap-1 mb-2">
          {popularReactions.map((reaction) => (
            <motion.button
              key={reaction.name}
              onClick={() => handleReaction(reaction.emoji)}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-2xl relative ${
                hasReacted(reaction.emoji) ? 'bg-purple-100 dark:bg-purple-900/30' : ''
              }`}
              title={reaction.name}
            >
              {reaction.emoji}
              {hasReacted(reaction.emoji) && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-600 rounded-full" />
              )}
            </motion.button>
          ))}
        </div>
        
        {/* Custom emoji input */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
          {showCustomEmoji ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customEmoji}
                onChange={(e) => setCustomEmoji(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleCustomEmoji();
                }}
                placeholder="Type emoji..."
                className="flex-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
                maxLength={2}
              />
              <button
                onClick={handleCustomEmoji}
                className="p-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setShowCustomEmoji(false);
                  setCustomEmoji('');
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <XMarkIcon className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomEmoji(true)}
              className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              + Add custom reaction
            </button>
          )}
        </div>
        
        {/* Current reactions summary */}
        {currentReactions.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
            <p className="text-xs text-gray-500 mb-1">Current reactions:</p>
            <div className="flex flex-wrap gap-1">
              {currentReactions.map((reaction, index) => (
                <span 
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs"
                >
                  <span>{reaction.emoji}</span>
                  <span className="text-gray-600 dark:text-gray-400">{reaction.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MessageReactions;