import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const MessageComposeModal = ({
  isOpen,
  onClose,
  creator,
  tokenCost,
  tokenBalance = 0,
  onMessageSent
}) => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const maxChars = 500;

  // Get card position if available (SSR safe)
  const cardPosition = typeof window !== 'undefined' ? window.modalPosition : null;

  // Calculate if close to limit for color change
  const isNearLimit = charCount / maxChars > 0.9;

  const handleMessageChange = (e) => {
    const text = e.target.value;
    if (text.length <= maxChars) {
      setMessage(text);
      setCharCount(text.length);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please write a message');
      return;
    }

    if (tokenBalance < tokenCost) {
      toast.error('Insufficient tokens');
      return;
    }

    setIsSending(true);

    try {
      const token = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientId: creator.supabase_id || creator.id,
          message: message.trim(),
          isPaid: true,
          tokenCost
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Message sent! ${tokenCost} tokens deducted`);
        
        // Call the success callback
        if (onMessageSent) {
          onMessageSent(data);
        }
        
        // Close the modal
        onClose();
        
        // Reset message
        setMessage('');
        setCharCount(0);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10001]"
            onClick={onClose}
          />
          
          {/* Enhanced Simplified Modal - Positioned over card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 30 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed z-[10002] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: '420px',
              maxWidth: '90vw'
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-title"
          >
            {/* Glass morphism container */}
            <div className="relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_70px_-15px_rgba(139,92,246,0.3)] border border-white/20 dark:border-gray-700/30 overflow-hidden">
              {/* Gradient accent top border */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500"></div>
              
              {/* Floating orbs for ambiance */}
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-pink-500/20 rounded-full blur-3xl"></div>
              
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 rounded-xl transition-all hover:rotate-90 duration-200 z-10 group"
                aria-label="Close message modal"
              >
                <XMarkIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
              </button>
              
              {/* Body with padding */}
              <div className="p-6 relative">
                {/* Mini avatar and name at top */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="relative">
                    <img
                      src={creator.avatar || creator.profile_pic_url || `https://ui-avatars.com/api/?name=${creator.username}&background=8B5CF6&color=fff`}
                      alt={creator.username}
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-purple-500/30 cursor-pointer hover:ring-4 hover:ring-purple-500/50 transition-all"
                      width={32}
                      height={32}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/${creator.username}`);
                        onClose();
                      }}
                    />
                    {creator.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {creator.displayName || creator.username}
                  </span>
                </div>
                
                {/* Enhanced Message Input */}
                <div className="relative group">
                  <textarea
                    value={message}
                    onChange={handleMessageChange}
                    placeholder="Write something amazing..."
                    className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none h-32 text-gray-900 dark:text-white bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm text-sm placeholder-gray-400 transition-all focus:bg-white dark:focus:bg-gray-800"
                    disabled={isSending}
                    autoFocus
                  />
                  
                  {/* Character count - appears on typing */}
                  {message.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute bottom-2 right-2 text-xs"
                      aria-live="polite"
                      style={{ color: isNearLimit ? '#ef4444' : '#9ca3af' }}
                    >
                      {charCount}/{maxChars}
                    </motion.div>
                  )}
                </div>
                
                {/* Cost indicator */}
                <div className="text-center mt-3 text-sm text-gray-500 dark:text-gray-400">
                  <span>{tokenCost} tokens per message</span>
                </div>

                {/* Enhanced Send Button */}
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || isSending || tokenBalance < tokenCost}
                  className={`w-full mt-4 py-3 px-6 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2.5 relative overflow-hidden group ${
                    message.trim() && !isSending && tokenBalance >= tokenCost
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg hover:shadow-xl hover:from-purple-700 hover:to-pink-700 transform hover:-translate-y-0.5'
                      : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-60'
                  }`}
                >
                  {/* Button shimmer animation on hover */}
                  {message.trim() && !isSending && tokenBalance >= tokenCost && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[length:200%_100%] group-hover:animate-shimmer"></div>
                  )}
                  
                  <div className="relative flex items-center gap-2">
                    {isSending ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Message</span>
                        <PaperAirplaneIcon className="w-4 h-4 rotate-45 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                      </>
                    )}
                  </div>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default MessageComposeModal;