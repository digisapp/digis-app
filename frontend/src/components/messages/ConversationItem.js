import React from 'react';
import { motion } from 'framer-motion';
import {
  StarIcon,
  MapPinIcon,
  ArchiveBoxIcon
} from '@heroicons/react/24/outline';
import {
  StarIcon as StarIconSolid,
  MapPinIcon as MapPinIconSolid
} from '@heroicons/react/24/solid';
import { formatTimestamp } from '../../utils/dateHelpers';
import { useNavigate } from 'react-router-dom';

const ConversationItem = ({
  conversation,
  isSelected,
  isBulkSelected,
  bulkActionMode,
  onSelect,
  onSelectForBulk,
  onPin,
  onArchive,
  onToggleVIP,
  isCreator,
  user
}) => {
  const navigate = useNavigate();
  
  const handleNameClick = (e) => {
    e.stopPropagation(); // Prevent conversation selection
    const participant = conversation.participant;
    if (participant) {
      // Navigate to appropriate profile page
      if (participant.is_creator || participant.isCreator) {
        navigate(`/creator/${participant.username || participant.id}`);
      } else {
        navigate(`/profile/${participant.username || participant.id}`);
      }
    }
  };
  
  return (
    <motion.div
      whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
      onClick={onSelect}
      className={`
        group relative flex items-center p-4 cursor-pointer transition-all
        ${isSelected ? 'bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-600' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}
        ${isBulkSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
      `}
    >
      {/* Bulk selection checkbox */}
      {bulkActionMode && (
        <div className="mr-3">
          <input
            type="checkbox"
            checked={isBulkSelected}
            onChange={onSelectForBulk}
            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      
      {/* Avatar */}
      <div className="relative flex-shrink-0 mr-3">
        {conversation.participant?.avatar ? (
          <img 
            src={conversation.participant.avatar} 
            alt={conversation.participant.name}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold">
            {conversation.participant?.name?.charAt(0) || '?'}
          </div>
        )}
        {conversation.participant?.isOnline && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h3 
              className="font-semibold text-gray-900 dark:text-white truncate cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
              onClick={handleNameClick}
            >
              {conversation.participant?.name || 'Unknown'}
            </h3>
            {conversation.isPinned && (
              <MapPinIconSolid className="w-4 h-4 text-gray-400" />
            )}
            {isCreator && conversation.participant?.isVIP && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                VIP
              </span>
            )}
            {conversation.participant?.tier && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">
                {conversation.participant.tier}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatTimestamp(conversation.lastMessage?.timestamp)}
          </span>
        </div>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
          {conversation.lastMessage?.sender === user?.uid && 'You: '}
          {conversation.lastMessage?.content || 'No messages yet'}
        </p>
        
        {isCreator && (conversation.totalSpent > 0 || conversation.sessionCount > 0) && (
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            {conversation.totalSpent > 0 && (
              <span>${conversation.totalSpent.toLocaleString()}</span>
            )}
            {conversation.sessionCount > 0 && (
              <span>{conversation.sessionCount} sessions</span>
            )}
          </div>
        )}
      </div>
      
      {/* Unread indicator */}
      {conversation.unreadCount > 0 && !bulkActionMode && (
        <div className="ml-2 flex-shrink-0">
          <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-600 text-white text-xs font-semibold rounded-full">
            {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
          </span>
        </div>
      )}
      
      {/* Actions */}
      {!bulkActionMode && (
        <div className="ml-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isCreator && (
            <button
              onClick={onToggleVIP}
              className={`p-1 rounded transition-colors ${
                conversation.participant?.isVIP
                  ? 'text-yellow-500 hover:bg-yellow-50'
                  : 'text-gray-400 hover:bg-gray-200'
              }`}
              title={conversation.participant?.isVIP ? 'Remove from VIPs' : 'Add to VIPs'}
            >
              {conversation.participant?.isVIP ? (
                <StarIconSolid className="w-4 h-4" />
              ) : (
                <StarIcon className="w-4 h-4" />
              )}
            </button>
          )}
          <button
            onClick={onPin}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            title={conversation.isPinned ? 'Unpin' : 'Pin'}
          >
            <MapPinIcon className={`w-4 h-4 ${conversation.isPinned ? 'text-purple-600' : 'text-gray-400'}`} />
          </button>
          <button
            onClick={onArchive}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            title="Archive"
          >
            <ArchiveBoxIcon className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default ConversationItem;