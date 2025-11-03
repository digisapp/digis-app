// components/chat/MessageInput.jsx
// Message input component with token cost display
import React, { useState, useRef } from 'react';
import { SendIcon, ImageIcon, SmileIcon, CoinsIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSendMessage, useMediaUpload, useTypingDetection } from '../../hooks/messaging';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

/**
 * MessageInput - Input field for sending messages
 *
 * @param {string} recipientId - The recipient user ID
 * @param {number} tokenCost - Cost in tokens to send a message
 * @param {boolean} isPremium - Whether this is a premium message
 * @param {Function} onSent - Callback after message is sent
 */
export default function MessageInput({
  recipientId,
  tokenCost = 0,
  isPremium = false,
  onSent
}) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef(null);

  const { sendMessage, sending } = useSendMessage();
  const { uploadMedia, uploading, progress } = useMediaUpload();

  // Typing indicator
  const handleTyping = useTypingDetection((isTyping) => {
    // This will be connected to typing indicator hook in ChatWindow
    console.log('Typing:', isTyping);
  });

  // Check if user has enough tokens
  const userBalance = user?.token_balance || 0;
  const hasEnoughTokens = !isPremium || userBalance >= tokenCost;

  const handleSend = async () => {
    if (!content.trim() || !recipientId) return;
    if (isPremium && !hasEnoughTokens) {
      toast.error(`Insufficient tokens. Need ${tokenCost}, have ${userBalance}.`);
      return;
    }

    const message = await sendMessage({
      recipientId,
      content: content.trim(),
      isPremium,
      messageType: 'text'
    });

    if (message) {
      setContent('');
      onSent?.(message);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 50MB.');
      return;
    }

    // Upload file
    const uploaded = await uploadMedia(file);

    if (uploaded) {
      // Send message with media
      const message = await sendMessage({
        recipientId,
        content: content.trim() || undefined,
        mediaUrl: uploaded.url,
        mediaType: uploaded.type,
        messageType: uploaded.type,
        isPremium
      });

      if (message) {
        setContent('');
        onSent?.(message);
      }
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      {/* Token cost indicator */}
      {isPremium && tokenCost > 0 && (
        <div className={`mb-3 flex items-center justify-between text-sm ${
          hasEnoughTokens ? 'text-gray-600 dark:text-gray-400' : 'text-red-600 dark:text-red-400'
        }`}>
          <div className="flex items-center gap-2">
            <CoinsIcon className="w-4 h-4" />
            <span>
              {tokenCost} tokens per message
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>Your balance: {userBalance} tokens</span>
            {!hasEnoughTokens && (
              <span className="text-xs bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-full">
                Insufficient
              </span>
            )}
          </div>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span>Uploading...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <motion.div
              className="bg-purple-600 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        {/* Media upload button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || sending}
          className="p-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors disabled:opacity-50"
          title="Attach image or video"
        >
          <ImageIcon className="w-5 h-5" />
        </button>

        {/* Text input */}
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            handleTyping(e.target.value);
          }}
          onKeyPress={handleKeyPress}
          placeholder={
            isPremium && !hasEnoughTokens
              ? `Not enough tokens (need ${tokenCost})`
              : 'Type a message...'
          }
          disabled={sending || uploading || (isPremium && !hasEnoughTokens)}
          className="flex-1 resize-none bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 max-h-32"
          rows={1}
          style={{
            minHeight: '40px',
            height: 'auto',
            maxHeight: '128px'
          }}
          onInput={(e) => {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!content.trim() || sending || uploading || (isPremium && !hasEnoughTokens)}
          className="p-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Send message"
        >
          {sending ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <SendIcon className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Character count (optional) */}
      {content.length > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-right">
          {content.length} characters
        </div>
      )}
    </div>
  );
}
