// components/chat/ConversationList.jsx
// Conversation list sidebar component
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { SearchIcon, MessageSquarePlusIcon } from 'lucide-react';
import { useConversations, useUnreadCount } from '../../hooks/messaging';
import { formatDistanceToNow } from 'date-fns';

/**
 * ConversationList - Sidebar showing all conversations
 *
 * @param {string} activeConversationId - Currently selected conversation ID
 * @param {Function} onSelectConversation - Callback when conversation is selected
 * @param {Function} onNewMessage - Callback when "New Message" is clicked
 */
export default function ConversationList({
  activeConversationId,
  onSelectConversation,
  onNewMessage
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const { conversations, loading, error } = useConversations();
  const { unreadCount } = useUnreadCount();

  // Filter conversations by search query
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const otherUser = conv.otherUser;
    const query = searchQuery.toLowerCase();
    return (
      otherUser?.display_name?.toLowerCase().includes(query) ||
      otherUser?.username?.toLowerCase().includes(query) ||
      conv.lastMessage?.content?.toLowerCase().includes(query)
    );
  });

  // Format last message preview
  const formatLastMessage = (message) => {
    if (!message) return 'No messages yet';

    if (message.media_url) {
      if (message.media_type === 'image') return '📷 Photo';
      if (message.media_type === 'video') return '🎥 Video';
      return '📎 File';
    }

    return message.content || 'Message';
  };

  return (
    <div className="w-full lg:w-96 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Messages
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-purple-600 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </h2>

          {/* New message button */}
          {onNewMessage && (
            <button
              onClick={onNewMessage}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              title="New message"
            >
              <MessageSquarePlusIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          )}
        </div>

        {/* Search input */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          /* Loading state */
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          /* Error state */
          <div className="text-center py-12 px-4">
            <p className="text-red-600 dark:text-red-400 mb-2">Failed to load conversations</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          /* Empty state */
          <div className="text-center py-12 px-4">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600"
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {searchQuery ? 'No results found' : 'No conversations yet'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchQuery
                ? 'Try a different search term'
                : 'Start a conversation by sending a message to a creator'}
            </p>
          </div>
        ) : (
          /* Conversations */
          <div>
            {filteredConversations.map((conversation) => {
              const otherUser = conversation.otherUser;
              const lastMessage = conversation.lastMessage;
              const isActive = conversation.id === activeConversationId;

              return (
                <motion.button
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation)}
                  whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                  className={`w-full px-4 py-3 flex items-start gap-3 border-b border-gray-100 dark:border-gray-700 transition-colors ${
                    isActive
                      ? 'bg-purple-50 dark:bg-purple-900/20 border-l-4 border-l-purple-600'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {/* Avatar with online indicator */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={otherUser?.profile_pic_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.username}`}
                      alt={otherUser?.display_name || otherUser?.username}
                      className="w-12 h-12 rounded-full"
                    />
                    {otherUser?.is_online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full" />
                    )}
                  </div>

                  {/* Conversation info */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className={`font-semibold truncate ${
                        isActive
                          ? 'text-purple-900 dark:text-purple-100'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {otherUser?.display_name || otherUser?.username}
                      </h4>
                      {lastMessage?.created_at && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                          {formatDistanceToNow(new Date(lastMessage.created_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${
                        isActive
                          ? 'text-purple-700 dark:text-purple-300'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {formatLastMessage(lastMessage)}
                      </p>

                      {/* Unread indicator */}
                      {conversation.unreadCount > 0 && (
                        <span className="flex-shrink-0 ml-2 px-2 py-0.5 text-xs bg-purple-600 text-white rounded-full font-semibold">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
