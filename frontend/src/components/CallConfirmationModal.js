import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  VideoCameraIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const CallConfirmationModal = ({
  isOpen,
  onClose,
  creator,
  serviceType, // 'video', 'voice', or 'message'
  tokenBalance = 0,
  onConfirm,
  viewMode = 'card' // 'card', 'compact', or 'grid'
}) => {
  const navigate = useNavigate();
  const [isRequesting, setIsRequesting] = useState(false);
  
  // Get card position if available
  const cardPosition = typeof window !== 'undefined' ? window.modalPosition : null;
  
  // Determine modal size based on view mode
  const getModalStyles = () => {
    switch(viewMode) {
      case 'compact':
        return {
          width: cardPosition ? `${Math.min(cardPosition.width, 400)}px` : '400px',
          maxWidth: '400px',
          padding: 'p-2',
          textSize: 'text-xs',
          buttonPadding: 'py-1.5 px-2'
        };
      case 'grid':
        return {
          width: cardPosition ? `${Math.min(cardPosition.width, 280)}px` : '280px',
          maxWidth: '280px',
          padding: 'p-3',
          textSize: 'text-sm',
          buttonPadding: 'py-2 px-3'
        };
      case 'card':
      default:
        return {
          width: cardPosition ? `${Math.min(cardPosition.width, 240)}px` : '240px',
          maxWidth: '240px',
          padding: 'p-3',
          textSize: 'text-sm',
          buttonPadding: 'py-2 px-3'
        };
    }
  };
  
  const modalStyles = getModalStyles();

  if (!isOpen || !creator) return null;

  // Get pricing based on service type
  const getPrice = () => {
    switch (serviceType) {
      case 'video':
        return creator.video_price || creator.videoPrice || 150;
      case 'voice':
        return creator.voice_price || creator.voicePrice || 50;
      case 'message':
        return creator.message_price || creator.messagePrice || 50;
      default:
        return 100;
    }
  };

  const getServiceName = () => {
    switch (serviceType) {
      case 'video':
        return 'Video Call';
      case 'voice':
        return 'Voice Call';
      case 'message':
        return 'Message';
      default:
        return 'Service';
    }
  };

  const getServiceIcon = () => {
    switch (serviceType) {
      case 'video':
        return <VideoCameraIcon className="w-full h-full text-white" />;
      case 'voice':
        return <PhoneIcon className="w-full h-full text-white" />;
      case 'message':
        return <ChatBubbleLeftRightIcon className="w-full h-full text-white" />;
      default:
        return null;
    }
  };

  const price = getPrice();
  const canAfford = tokenBalance >= price;
  const isMessage = serviceType === 'message';

  const handleConfirm = async () => {
    if (!canAfford) {
      toast.error(`Insufficient tokens. You need ${price} tokens.`);
      return;
    }

    // For messages, just call onConfirm to trigger the message compose modal
    if (isMessage) {
      if (onConfirm) {
        onConfirm({
          creator,
          serviceType,
          price
        });
      }
      onClose();
      return;
    }

    // For video/voice calls, send the session request
    setIsRequesting(true);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/sessions/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          creatorId: creator.id || creator.uid,
          creatorUsername: creator.username,
          serviceType: serviceType,
          price: price
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`${getServiceName()} request sent! Waiting for ${creator.displayName || creator.username} to accept...`);
        
        // Call the onConfirm callback with session data
        if (onConfirm) {
          onConfirm({
            creator,
            serviceType,
            sessionId: data.sessionId,
            requestId: data.requestId
          });
        }
        
        onClose();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to send request');
      }
    } catch (error) {
      console.error('Error sending request:', error);
      toast.error('Failed to send request. Please try again.');
    } finally {
      setIsRequesting(false);
    }
  };

  if (!isOpen) return null;

  // Use React Portal to render modal at document body level
  return ReactDOM.createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]"
            onClick={onClose}
          />
          
          {/* Enhanced Glass Morphism Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 30 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed z-[10002]"
            style={{
              left: cardPosition?.centerX ? `${cardPosition.centerX}px` : '50%',
              top: cardPosition?.centerY ? `${cardPosition.centerY}px` : '50%',
              transform: 'translate(-50%, -50%)',
              width: viewMode === 'compact' ? '360px' : '320px',
              maxWidth: '90vw'
            }}
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
              >
                <XMarkIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
              </button>
              
              {/* Body with padding */}
              <div className="p-6 relative">
                {/* Service header with creator info */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="relative">
                    <img
                      src={creator.avatar || creator.profile_pic_url || `https://ui-avatars.com/api/?name=${creator.username}&background=8B5CF6&color=fff`}
                      alt={creator.username}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-500/30 cursor-pointer hover:ring-4 hover:ring-purple-500/50 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/profile/${creator.username}`);
                        onClose();
                      }}
                    />
                    {creator.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {creator.displayName || creator.username}
                    </p>
                  </div>
                </div>
                
                {/* Pricing info centered */}
                <div className="text-center mb-6">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {price} tokens
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {isMessage ? 'per message' : 'per minute'}
                  </p>
                </div>
                
                {/* Warning if insufficient tokens */}
                {!canAfford && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2 mb-4"
                  >
                    <p className="text-xs text-red-600 dark:text-red-400 text-center font-medium">
                      You need {price - tokenBalance} more tokens
                    </p>
                  </motion.div>
                )}
                
                {/* Enhanced Action Button */}
                <button
                  onClick={handleConfirm}
                  disabled={!canAfford || isRequesting}
                  className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2.5 relative overflow-hidden group ${
                    canAfford && !isRequesting
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-[0_10px_30px_-10px_rgba(139,92,246,0.5)] hover:shadow-[0_15px_35px_-10px_rgba(139,92,246,0.6)] transform hover:-translate-y-0.5'
                      : 'bg-gray-200/50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  }`}
                >
                  {/* Button gradient animation on hover */}
                  {canAfford && !isRequesting && (
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[length:200%_100%] animate-shimmer"></div>
                  )}
                  
                  <div className="relative flex items-center gap-2">
                    {isRequesting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Requesting...</span>
                      </>
                    ) : (
                      <span>{canAfford ? `Start ${getServiceName()}` : 'Insufficient Tokens'}</span>
                    )}
                  </div>
                </button>
                
                {/* Purchase tokens link if needed */}
                {!canAfford && (
                  <p className="text-center mt-3 text-xs text-gray-500 dark:text-gray-400">
                    <a href="/tokens" className="text-purple-600 dark:text-purple-400 hover:underline">
                      Purchase tokens
                    </a>
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CallConfirmationModal;