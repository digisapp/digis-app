// components/chat/ChatWindow.jsx
// Main chat window component
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneIcon, VideoIcon, MoreVerticalIcon, ArrowLeftIcon } from 'lucide-react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import { useMessages, useTypingIndicator } from '../../hooks/messaging';
import { useAuth } from '../../contexts/AuthContext';

/**
 * ChatWindow - Main chat interface
 *
 * @param {Object} conversation - The conversation object
 * @param {Function} onBack - Callback when back button is clicked (mobile)
 * @param {Function} onVideoCall - Callback to start video call
 * @param {Function} onVoiceCall - Callback to start voice call
 */
export default function ChatWindow({
  conversation,
  onBack,
  onVideoCall,
  onVoiceCall
}) {
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Get messages for this conversation
  const { messages, loading, loadMore, hasMore } = useMessages(conversation?.id);

  // Typing indicator
  const { typingUsers, setTyping, isTyping } = useTypingIndicator(conversation?.id);

  // Determine who the other user is
  const otherUser = conversation?.otherUser;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [messages, autoScroll]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle scroll to detect if user scrolled up
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setAutoScroll(isAtBottom);

    // Load more messages when scrolled to top
    if (scrollTop < 100 && hasMore && !loading) {
      loadMore();
    }
  };

  // No conversation selected
  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <svg
            className="w-24 h-24 mx-auto mb-4 text-gray-300 dark:text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
          <p className="text-sm">Choose a conversation from the sidebar to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 h-full">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back button (mobile) */}
            {onBack && (
              <button
                onClick={onBack}
                className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
            )}

            {/* User avatar */}
            <img
              src={otherUser?.profile_pic_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.username}`}
              alt={otherUser?.display_name || otherUser?.username}
              className="w-10 h-10 rounded-full"
            />

            {/* User info */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {otherUser?.display_name || otherUser?.username}
              </h3>
              {isTyping ? (
                <p className="text-sm text-purple-600 dark:text-purple-400">
                  typing...
                </p>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  @{otherUser?.username}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {onVoiceCall && (
              <button
                onClick={() => onVoiceCall(otherUser)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                title="Voice call"
              >
                <PhoneIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            )}

            {onVideoCall && (
              <button
                onClick={() => onVideoCall(otherUser)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                title="Video call"
              >
                <VideoIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            )}

            <button
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              title="More options"
            >
              <MoreVerticalIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6 bg-gray-50 dark:bg-gray-900"
      >
        {/* Loading indicator */}
        {loading && messages.length === 0 && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Load more indicator */}
        {hasMore && !loading && messages.length > 0 && (
          <div className="text-center py-4">
            <button
              onClick={loadMore}
              className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
            >
              Load older messages
            </button>
          </div>
        )}

        {/* Messages */}
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwnMessage={message.sender_id === user?.id}
              sender={message.sender_id === user?.id ? user : otherUser}
            />
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 mb-4"
          >
            <img
              src={otherUser?.profile_pic_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.username}`}
              alt={otherUser?.display_name}
              className="w-8 h-8 rounded-full"
            />
            <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl px-4 py-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}

        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {!autoScroll && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={scrollToBottom}
          className="absolute bottom-24 right-8 p-3 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </motion.button>
      )}

      {/* Message input */}
      <MessageInput
        recipientId={otherUser?.id}
        tokenCost={otherUser?.message_price || 0}
        isPremium={otherUser?.is_creator || false}
        onSent={scrollToBottom}
      />
    </div>
  );
}
