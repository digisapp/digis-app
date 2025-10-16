import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckIcon,
  ExclamationCircleIcon,
  EllipsisHorizontalIcon,
  TrashIcon,
  PencilIcon,
  ArrowUturnLeftIcon,
  ClipboardDocumentIcon,
  FaceSmileIcon
} from '@heroicons/react/24/outline';
import MessageReactions from './MessageReactions';
import { formatTimestamp } from '../../utils/dateHelpers';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const MessageItem = ({
  message,
  isOwn,
  isHighlighted,
  onReaction,
  onDelete,
  onEdit,
  onReply,
  user,
  isCreator
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const navigate = useNavigate();
  
  const handleProfileClick = (e) => {
    e.stopPropagation(); // Prevent triggering message actions
    const sender = message.sender || message.sender_details;
    if (sender) {
      // Navigate to appropriate profile page
      if (sender.is_creator || message.sender_is_creator) {
        navigate(`/${sender.username || sender.id || message.sender_id}`);
      } else {
        navigate(`/profile/${sender.username || sender.id || message.sender_id}`);
      }
    }
  };
  
  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content);
    toast.success('Message copied');
    setShowActions(false);
  };
  
  const handleEdit = () => {
    if (editedContent.trim() && editedContent !== message.content) {
      onEdit(message.id, editedContent);
      setIsEditing(false);
    }
  };
  
  const handleDelete = () => {
    if (window.confirm('Delete this message?')) {
      onDelete(message.id);
    }
    setShowActions(false);
  };
  
  const renderMessageContent = () => {
    switch (message.type) {
      case 'image':
        return (
          <div className="rounded-lg overflow-hidden max-w-sm">
            <img 
              src={message.attachment_url} 
              alt="Shared image"
              className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(message.attachment_url, '_blank')}
              loading="lazy"
            />
            {message.content && (
              <p className="mt-2 text-sm">{message.content}</p>
            )}
          </div>
        );
        
      case 'voice':
        return (
          <div className="flex items-center gap-3">
            <audio 
              controls 
              src={message.attachment_url}
              className="max-w-xs"
            >
              Your browser does not support audio playback
            </audio>
            <span className="text-xs opacity-75">{message.duration || '0:00'}</span>
          </div>
        );
        
      case 'video':
        return (
          <div className="rounded-lg overflow-hidden max-w-sm">
            <video 
              controls 
              src={message.attachment_url}
              className="w-full h-auto"
            >
              Your browser does not support video playback
            </video>
            {message.content && (
              <p className="mt-2 text-sm">{message.content}</p>
            )}
          </div>
        );
        
      case 'file':
        return (
          <a 
            href={message.attachment_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm">{message.file_name || 'Download file'}</span>
          </a>
        );
        
      default:
        if (isEditing) {
          return (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleEdit();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                className="flex-1 px-2 py-1 bg-transparent border-b border-white/50 focus:outline-none"
                autoFocus
              />
              <button onClick={handleEdit} className="p-1">
                <CheckIcon className="w-4 h-4" />
              </button>
              <button onClick={() => setIsEditing(false)} className="p-1">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          );
        }
        
        // Parse message for mentions and links
        const parseContent = (text) => {
          // Simple URL detection
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const parts = text.split(urlRegex);
          
          return parts.map((part, index) => {
            if (part.match(urlRegex)) {
              return (
                <a 
                  key={index}
                  href={part} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:no-underline"
                >
                  {part}
                </a>
              );
            }
            return part;
          });
        };
        
        return <p className="text-sm whitespace-pre-wrap break-words">{parseContent(message.content)}</p>;
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4 group`}
    >
      <div className={`max-w-xs lg:max-w-md ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* Reply context */}
        {message.reply_to && (
          <div className="text-xs text-gray-500 mb-1 px-2">
            <ArrowUturnLeftIcon className="w-3 h-3 inline mr-1" />
            Replying to: {message.reply_to.content.substring(0, 50)}...
          </div>
        )}
        
        {/* Sender name for non-own messages */}
        {!isOwn && (message.sender_name || message.sender_username) && (
          <div 
            className="text-xs text-gray-500 dark:text-gray-400 mb-1 px-2 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors inline-block"
            onClick={handleProfileClick}
          >
            {message.sender_name || message.sender_username || 'Unknown'}
          </div>
        )}
        
        {/* Message bubble */}
        <div className="relative">
          <motion.div
            animate={{ 
              backgroundColor: isHighlighted ? '#fbbf24' : undefined 
            }}
            transition={{ duration: 0.5 }}
            className={`px-4 py-2 rounded-2xl relative ${
              isOwn
                ? message.status === 'failed' 
                  ? 'bg-red-500 text-white'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            }`}
          >
            {renderMessageContent()}
            
            {/* Reactions */}
            {message.reactions && message.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {message.reactions.map((reaction, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full text-xs"
                  >
                    <span>{reaction.emoji}</span>
                    <span>{reaction.count}</span>
                  </span>
                ))}
              </div>
            )}
          </motion.div>
          
          {/* Action buttons */}
          <div className={`absolute top-0 ${isOwn ? 'right-full mr-2' : 'left-full ml-2'} 
            opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1`}>
            
            {/* React button */}
            <button
              onClick={() => setShowReactions(!showReactions)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              title="React"
            >
              <FaceSmileIcon className="w-4 h-4 text-gray-500" />
            </button>
            
            {/* Reply button */}
            <button
              onClick={() => onReply?.(message)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              title="Reply"
            >
              <ArrowUturnLeftIcon className="w-4 h-4 text-gray-500" />
            </button>
            
            {/* More actions */}
            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              >
                <EllipsisHorizontalIcon className="w-4 h-4 text-gray-500" />
              </button>
              
              <AnimatePresence>
                {showActions && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`absolute top-full mt-1 ${isOwn ? 'right-0' : 'left-0'} 
                      bg-white dark:bg-gray-800 rounded-lg shadow-lg z-10 py-1 min-w-[120px]`}
                  >
                    <button
                      onClick={handleCopyMessage}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left text-sm"
                    >
                      <ClipboardDocumentIcon className="w-4 h-4" />
                      Copy
                    </button>
                    
                    {isOwn && message.status === 'sent' && (
                      <>
                        <button
                          onClick={() => {
                            setIsEditing(true);
                            setShowActions(false);
                          }}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left text-sm"
                        >
                          <PencilIcon className="w-4 h-4" />
                          Edit
                        </button>
                        
                        <button
                          onClick={handleDelete}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left text-sm text-red-600"
                        >
                          <TrashIcon className="w-4 h-4" />
                          Delete
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          
          {/* Reactions picker */}
          <AnimatePresence>
            {showReactions && (
              <MessageReactions
                messageId={message.id}
                onReaction={(emoji) => {
                  onReaction(message.id, emoji);
                  setShowReactions(false);
                }}
                position={isOwn ? 'left' : 'right'}
              />
            )}
          </AnimatePresence>
        </div>
        
        {/* Message info */}
        <div className={`flex items-center gap-2 mt-1 px-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs text-gray-500">
            {formatTimestamp(message.timestamp)}
          </span>
          
          {message.edited_at && (
            <span className="text-xs text-gray-400">(edited)</span>
          )}
          
          {isOwn && (
            <>
              {message.status === 'sending' && (
                <span className="text-xs text-gray-400">Sending...</span>
              )}
              {message.status === 'sent' && message.isRead && (
                <CheckIcon className="w-3 h-3 text-blue-500" />
              )}
              {message.status === 'failed' && (
                <ExclamationCircleIcon className="w-3 h-3 text-red-500" />
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default MessageItem;