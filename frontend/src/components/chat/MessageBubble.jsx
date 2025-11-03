// components/chat/MessageBubble.jsx
// Individual message bubble component
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckIcon, CheckCheckIcon, ImageIcon, VideoIcon, FileIcon } from 'lucide-react';
import { useMessageReactions, REACTIONS } from '../../hooks/messaging';
import { formatDistanceToNow } from 'date-fns';

/**
 * MessageBubble - Displays a single message
 *
 * @param {Object} message - The message object
 * @param {boolean} isOwnMessage - Whether the message is from the current user
 * @param {Object} sender - The sender user object
 */
export default function MessageBubble({ message, isOwnMessage, sender }) {
  const [showReactions, setShowReactions] = useState(false);
  const { addReaction } = useMessageReactions();

  const handleReaction = async (emoji) => {
    await addReaction(message.id, emoji);
    setShowReactions(false);
  };

  // Format timestamp
  const timeAgo = message.created_at
    ? formatDistanceToNow(new Date(message.created_at), { addSuffix: true })
    : '';

  // Message content based on type
  const renderContent = () => {
    // Media message
    if (message.media_url) {
      if (message.media_type === 'image') {
        return (
          <div className="rounded-lg overflow-hidden max-w-sm">
            <img
              src={message.media_url}
              alt="Shared image"
              className="w-full h-auto"
              loading="lazy"
            />
            {message.content && (
              <p className="mt-2 text-sm">{message.content}</p>
            )}
          </div>
        );
      }

      if (message.media_type === 'video') {
        return (
          <div className="rounded-lg overflow-hidden max-w-sm">
            <video
              src={message.media_url}
              controls
              className="w-full h-auto"
            />
            {message.content && (
              <p className="mt-2 text-sm">{message.content}</p>
            )}
          </div>
        );
      }

      // File download
      return (
        <a
          href={message.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <FileIcon className="w-5 h-5" />
          <span className="text-sm font-medium">Download file</span>
        </a>
      );
    }

    // Text message
    return (
      <p className="text-sm whitespace-pre-wrap break-words">
        {message.content}
      </p>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} mb-4`}
    >
      {/* Avatar */}
      {!isOwnMessage && (
        <img
          src={sender?.profile_pic_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sender?.username}`}
          alt={sender?.display_name || sender?.username}
          className="w-8 h-8 rounded-full flex-shrink-0"
        />
      )}

      {/* Message container */}
      <div className={`flex flex-col max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        {/* Sender name (only for received messages) */}
        {!isOwnMessage && (
          <span className="text-xs text-gray-600 dark:text-gray-400 mb-1 px-2">
            {sender?.display_name || sender?.username}
          </span>
        )}

        {/* Message bubble */}
        <div
          className={`relative group px-4 py-2 rounded-2xl ${
            isOwnMessage
              ? 'bg-purple-600 text-white rounded-tr-sm'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-tl-sm'
          }`}
          onMouseEnter={() => setShowReactions(true)}
          onMouseLeave={() => setShowReactions(false)}
        >
          {/* Premium badge */}
          {message.is_premium && message.tokens_spent > 0 && (
            <div className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
              {message.tokens_spent} 🪙
            </div>
          )}

          {renderContent()}

          {/* Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex gap-1 mt-2">
              {Object.entries(
                message.reactions.reduce((acc, r) => {
                  acc[r.reaction] = (acc[r.reaction] || 0) + 1;
                  return acc;
                }, {})
              ).map(([emoji, count]) => (
                <span
                  key={emoji}
                  className="text-xs bg-white dark:bg-gray-700 px-2 py-0.5 rounded-full"
                >
                  {emoji} {count}
                </span>
              ))}
            </div>
          )}

          {/* Reaction picker */}
          <AnimatePresence>
            {showReactions && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`absolute ${
                  isOwnMessage ? 'right-0' : 'left-0'
                } -top-10 bg-white dark:bg-gray-800 shadow-lg rounded-full px-2 py-1 flex gap-1 z-10`}
              >
                {REACTIONS.map(({ emoji, label }) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    className="hover:scale-125 transition-transform text-lg"
                    title={label}
                  >
                    {emoji}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Timestamp and read status */}
        <div className={`flex items-center gap-1 mt-1 px-2 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {timeAgo}
          </span>

          {/* Read receipt (only for own messages) */}
          {isOwnMessage && (
            <span className="text-gray-500 dark:text-gray-400">
              {message.is_read ? (
                <CheckCheckIcon className="w-3 h-3 text-blue-500" />
              ) : (
                <CheckIcon className="w-3 h-3" />
              )}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
