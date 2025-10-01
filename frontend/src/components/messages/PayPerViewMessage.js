import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LockClosedIcon,
  PhotoIcon,
  VideoCameraIcon,
  MicrophoneIcon,
  DocumentIcon,
  EyeIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { PlayIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { getAuthToken } from '../../utils/supabase-auth';

const PayPerViewMessage = ({
  message,
  isOwn,
  onUnlock,
  userTokenBalance = 0
}) => {
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(message.is_unlocked || false);
  const [showPreview, setShowPreview] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(message.unlocked_url || null);
  
  // Determine content type and icon
  const getContentInfo = () => {
    switch (message.content_type) {
      case 'image':
        return {
          icon: PhotoIcon,
          label: 'Photo',
          color: 'from-purple-500 to-pink-500',
          bgColor: 'bg-purple-50 dark:bg-purple-900/20'
        };
      case 'video':
        return {
          icon: VideoCameraIcon,
          label: 'Video',
          color: 'from-blue-500 to-purple-500',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          duration: message.duration
        };
      case 'audio':
        return {
          icon: MicrophoneIcon,
          label: 'Audio',
          color: 'from-green-500 to-teal-500',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          duration: message.duration
        };
      default:
        return {
          icon: DocumentIcon,
          label: 'File',
          color: 'from-gray-500 to-gray-600',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20'
        };
    }
  };
  
  const contentInfo = getContentInfo();
  const ContentIcon = contentInfo.icon;
  
  // Handle unlock purchase
  const handleUnlock = async () => {
    if (isUnlocked || isOwn) return;
    
    // Check if user has enough tokens
    if (userTokenBalance < message.price) {
      toast.error(`Insufficient tokens. You need ${message.price} tokens to unlock this content.`);
      return;
    }
    
    setIsUnlocking(true);
    
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/messages/ppv/unlock`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message_id: message.id,
            price: message.price
          })
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setMediaUrl(data.content_url);
        setIsUnlocked(true);
        onUnlock?.(message.id, data.content_url);
        
        // Show success animation
        toast.success(
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5" />
            <span>Content unlocked! {message.price} tokens sent to creator</span>
          </div>
        );
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to unlock content');
      }
    } catch (error) {
      console.error('Error unlocking content:', error);
      toast.error(error.message || 'Failed to unlock content');
    } finally {
      setIsUnlocking(false);
    }
  };
  
  // Render unlocked content
  const renderUnlockedContent = () => {
    switch (message.content_type) {
      case 'image':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-lg overflow-hidden max-w-sm cursor-pointer"
            onClick={() => window.open(mediaUrl, '_blank')}
          >
            <img 
              src={mediaUrl} 
              alt="Premium content"
              className="w-full h-auto hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 rounded-full flex items-center gap-1">
              <CheckCircleIcon className="w-4 h-4 text-green-400" />
              <span className="text-xs text-white">Unlocked</span>
            </div>
          </motion.div>
        );
        
      case 'video':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-lg overflow-hidden max-w-sm bg-black"
          >
            <video 
              controls 
              src={mediaUrl}
              className="w-full h-auto"
              poster={message.thumbnail_url}
            >
              Your browser does not support video playback
            </video>
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 rounded-full flex items-center gap-1">
              <CheckCircleIcon className="w-4 h-4 text-green-400" />
              <span className="text-xs text-white">Unlocked</span>
            </div>
          </motion.div>
        );
        
      case 'audio':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg"
          >
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <MicrophoneIcon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <audio 
                controls 
                src={mediaUrl}
                className="w-full"
              >
                Your browser does not support audio playback
              </audio>
            </div>
            <CheckCircleIcon className="w-5 h-5 text-green-500" />
          </motion.div>
        );
        
      default:
        return (
          <a 
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-gray-500/10 to-gray-600/10 rounded-lg hover:from-gray-500/20 hover:to-gray-600/20 transition-colors"
          >
            <DocumentIcon className="w-8 h-8 text-gray-600" />
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">
                {message.file_name || 'Download file'}
              </p>
              <p className="text-sm text-gray-500">Click to download</p>
            </div>
            <CheckCircleIcon className="w-5 h-5 text-green-500" />
          </a>
        );
    }
  };
  
  // Render locked content preview
  const renderLockedContent = () => {
    return (
      <motion.div
        className={`relative ${contentInfo.bgColor} rounded-2xl overflow-hidden`}
        whileHover={{ scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        {/* Blurred background preview */}
        {message.thumbnail_url && (
          <div className="absolute inset-0">
            <img 
              src={message.thumbnail_url} 
              alt="Preview"
              className="w-full h-full object-cover filter blur-2xl opacity-50"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        )}
        
        {/* Content */}
        <div className="relative p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 bg-gradient-to-r ${contentInfo.color} rounded-full flex items-center justify-center shadow-lg`}>
                <ContentIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  Premium {contentInfo.label}
                </p>
                {contentInfo.duration && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Duration: {contentInfo.duration}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
              <SparklesIcon className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-bold text-yellow-800 dark:text-yellow-300">
                {message.price} tokens
              </span>
            </div>
          </div>
          
          {/* Preview area */}
          <div className="relative h-48 bg-white/10 dark:bg-black/20 rounded-lg mb-4 flex items-center justify-center backdrop-blur-sm">
            {message.thumbnail_url ? (
              <>
                <img 
                  src={message.thumbnail_url} 
                  alt="Preview"
                  className="absolute inset-0 w-full h-full object-cover rounded-lg opacity-30"
                />
                <div className="relative z-10 text-center">
                  <LockClosedIcon className="w-12 h-12 text-white mx-auto mb-2" />
                  <p className="text-white font-medium">Tap to unlock</p>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className={`w-20 h-20 bg-gradient-to-r ${contentInfo.color} rounded-full flex items-center justify-center mx-auto mb-3`}>
                  <ContentIcon className="w-10 h-10 text-white" />
                </div>
                <LockClosedIcon className="w-8 h-8 text-gray-400 mx-auto" />
              </div>
            )}
            
            {/* Play button for video */}
            {message.content_type === 'video' && message.thumbnail_url && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <PlayIcon className="w-8 h-8 text-white ml-1" />
                </div>
              </div>
            )}
          </div>
          
          {/* Description */}
          {message.description && (
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              {message.description}
            </p>
          )}
          
          {/* Unlock button */}
          <button
            onClick={handleUnlock}
            disabled={isUnlocking || userTokenBalance < message.price}
            className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              userTokenBalance < message.price
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                : isUnlocking
                ? 'bg-gray-400 cursor-wait'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
            }`}
          >
            {isUnlocking ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Unlocking...
              </>
            ) : userTokenBalance < message.price ? (
              <>
                <XMarkIcon className="w-5 h-5" />
                Insufficient Tokens ({userTokenBalance}/{message.price})
              </>
            ) : (
              <>
                <EyeIcon className="w-5 h-5" />
                Unlock for {message.price} tokens
              </>
            )}
          </button>
          
          {/* Stats */}
          {message.unlock_count > 0 && (
            <div className="mt-3 text-center">
              <p className="text-xs text-gray-500">
                <span className="font-semibold">{message.unlock_count}</span> fans unlocked this
              </p>
            </div>
          )}
        </div>
      </motion.div>
    );
  };
  
  return (
    <div className={`${isOwn ? 'flex justify-end' : 'flex justify-start'}`}>
      <div className="max-w-sm">
        {isUnlocked || isOwn ? renderUnlockedContent() : renderLockedContent()}
        
        {/* Creator view - show earnings */}
        {isOwn && message.unlock_count > 0 && (
          <div className="mt-2 px-3 py-1 bg-green-50 dark:bg-green-900/20 rounded-lg inline-flex items-center gap-2">
            <CurrencyDollarIcon className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700 dark:text-green-300">
              Earned: {message.price * message.unlock_count} tokens from {message.unlock_count} unlocks
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayPerViewMessage;