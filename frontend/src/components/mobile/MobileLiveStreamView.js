import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMobileUI } from './MobileUIProvider';
import {
  XMarkIcon,
  ChatBubbleLeftRightIcon,
  HeartIcon,
  GiftIcon,
  ShareIcon,
  UserGroupIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  FireIcon,
  StarIcon,
  CurrencyDollarIcon,
  PhotoIcon,
  ShoppingBagIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';

const MobileLiveStreamView = ({ 
  streamData,
  creator,
  user,
  onClose,
  onSendGift,
  onSendTip
}) => {
  const { triggerHaptic, openBottomSheet } = useMobileUI();
  const [isChatExpanded, setIsChatExpanded] = useState(true);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewerCount, setViewerCount] = useState(streamData?.viewers || 0);
  const [streamDuration, setStreamDuration] = useState('00:00');
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [reactionQueue, setReactionQueue] = useState([]);
  
  const videoRef = useRef(null);
  const chatInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const heartTimeoutRef = useRef(null);

  // Mock initial messages
  useEffect(() => {
    const initialMessages = [
      { id: 1, user: 'Sarah', message: 'Love this stream! 💜', type: 'chat', timestamp: new Date() },
      { id: 2, user: 'Mike', message: 'joined the stream', type: 'system', timestamp: new Date() },
      { id: 3, user: 'Emma', message: 'sent a gift 🎁', type: 'gift', timestamp: new Date() },
      { id: 4, user: 'Alex', message: 'Amazing content!', type: 'chat', timestamp: new Date() },
      { id: 5, user: 'Jordan', message: 'tipped 50 tokens', type: 'tip', timestamp: new Date() }
    ];
    setMessages(initialMessages);
  }, []);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update stream duration
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setStreamDuration(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Simulate viewer count changes
  useEffect(() => {
    const interval = setInterval(() => {
      setViewerCount(prev => {
        const change = Math.random() > 0.5 ? 1 : -1;
        const newCount = prev + (Math.floor(Math.random() * 5) * change);
        return Math.max(1, newCount);
      });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = useCallback(() => {
    if (!newMessage.trim()) return;
    
    triggerHaptic('light');
    const message = {
      id: Date.now(),
      user: user?.displayName || 'You',
      message: newMessage,
      type: 'chat',
      timestamp: new Date(),
      isOwn: true
    };
    
    setMessages(prev => [...prev, message]);
    setNewMessage('');
    
    // Simulate response
    setTimeout(() => {
      const responses = [
        'Great point!',
        'Totally agree 👍',
        'Love it!',
        '🔥🔥🔥',
        'So true!',
        'Amazing!'
      ];
      const randomResponse = {
        id: Date.now() + 1,
        user: `User${Math.floor(Math.random() * 100)}`,
        message: responses[Math.floor(Math.random() * responses.length)],
        type: 'chat',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, randomResponse]);
    }, 2000 + Math.random() * 3000);
  }, [newMessage, user, triggerHaptic]);

  const handleSendReaction = useCallback((type) => {
    triggerHaptic('medium');
    
    // Add to reaction queue for animation
    const reaction = {
      id: Date.now(),
      type,
      x: Math.random() * 80 + 10, // Random position 10-90%
    };
    setReactionQueue(prev => [...prev, reaction]);
    
    // Remove reaction after animation
    setTimeout(() => {
      setReactionQueue(prev => prev.filter(r => r.id !== reaction.id));
    }, 3000);
    
    // Add to chat
    const message = {
      id: Date.now(),
      user: user?.displayName || 'You',
      message: `sent ${type}`,
      type: 'reaction',
      timestamp: new Date(),
      isOwn: true
    };
    setMessages(prev => [...prev, message]);
  }, [user, triggerHaptic]);

  const handleToggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newMuted = !prev;
      if (videoRef.current) {
        videoRef.current.muted = newMuted;
      }
      return newMuted;
    });
    triggerHaptic('light');
  }, [triggerHaptic]);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (!isFullscreen && videoRef.current) {
        if (videoRef.current.requestFullscreen) {
          await videoRef.current.requestFullscreen();
        } else if (videoRef.current.webkitRequestFullscreen) {
          await videoRef.current.webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
    triggerHaptic('medium');
  }, [isFullscreen, triggerHaptic]);

  const handleShowGifts = useCallback(() => {
    triggerHaptic('medium');
    openBottomSheet({
      title: 'Send a Gift',
      content: (
        <div className="grid grid-cols-3 gap-3 p-4">
          {[
            { emoji: '🌹', name: 'Rose', price: 10 },
            { emoji: '💎', name: 'Diamond', price: 100 },
            { emoji: '🎁', name: 'Gift Box', price: 50 },
            { emoji: '❤️', name: 'Heart', price: 5 },
            { emoji: '🌟', name: 'Star', price: 25 },
            { emoji: '🚗', name: 'Car', price: 500 }
          ].map(gift => (
            <button
              key={gift.name}
              onClick={() => {
                onSendGift?.(gift);
                const message = {
                  id: Date.now(),
                  user: user?.displayName || 'You',
                  message: `sent ${gift.emoji} ${gift.name}`,
                  type: 'gift',
                  timestamp: new Date(),
                  isOwn: true
                };
                setMessages(prev => [...prev, message]);
              }}
              className="bg-white border-2 border-purple-200 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-purple-400 transition-colors"
            >
              <div className="text-3xl">{gift.emoji}</div>
              <div className="text-xs font-medium">{gift.name}</div>
              <div className="text-xs text-purple-600 font-bold">{gift.price} tokens</div>
            </button>
          ))}
        </div>
      )
    });
  }, [openBottomSheet, onSendGift, user, triggerHaptic]);

  const MessageItem = ({ msg }) => {
    const isSystem = msg.type === 'system';
    const isGift = msg.type === 'gift';
    const isTip = msg.type === 'tip';
    const isReaction = msg.type === 'reaction';
    const isOwn = msg.isOwn;

    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={`mb-2 ${isOwn ? 'text-right' : ''}`}
      >
        {isSystem ? (
          <div className="text-center text-xs text-gray-400 italic">
            <span className="font-semibold">{msg.user}</span> {msg.message}
          </div>
        ) : isGift || isTip || isReaction ? (
          <div className={`inline-block bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-xs ${isOwn ? 'ml-auto' : ''}`}>
            <span className="font-semibold">{msg.user}</span> {msg.message}
          </div>
        ) : (
          <div className={`inline-block max-w-[70%] ${isOwn ? 'ml-auto' : ''}`}>
            <div className={`px-3 py-2 rounded-2xl ${
              isOwn 
                ? 'bg-purple-600 text-white' 
                : 'bg-white/90 backdrop-blur-sm text-gray-800'
            }`}>
              {!isOwn && (
                <div className="text-xs font-semibold mb-1 opacity-70">{msg.user}</div>
              )}
              <div className="text-sm">{msg.message}</div>
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Video Player */}
      <div className="relative h-full">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          autoPlay
          playsInline
          muted={isMuted}
          controls={false}
        >
          <source src={streamData?.streamUrl || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'} type="application/x-mpegURL" />
        </video>

        {/* Floating Reactions Animation */}
        <AnimatePresence>
          {reactionQueue.map(reaction => (
            <motion.div
              key={reaction.id}
              className="absolute bottom-20 pointer-events-none text-4xl"
              style={{ left: `${reaction.x}%` }}
              initial={{ y: 0, opacity: 1, scale: 0.5 }}
              animate={{ 
                y: -300, 
                opacity: 0,
                scale: [0.5, 1.5, 1],
                rotate: [0, -15, 15, -15, 0]
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 3, ease: "easeOut" }}
            >
              {reaction.type}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start" style={{ paddingTop: 'env(safe-area-inset-top, 20px)' }}>
          <div className="flex items-center gap-3">
            {/* Creator Info */}
            <div className="bg-black/40 backdrop-blur-md rounded-full px-3 py-2 flex items-center gap-2">
              <img
                src={creator?.avatarUrl || '/api/placeholder/32/32'}
                alt={creator?.displayName}
                className="w-8 h-8 rounded-full object-cover"
              />
              <div>
                <div className="text-white text-sm font-semibold">{creator?.displayName || 'Creator'}</div>
                <div className="flex items-center gap-2">
                  <div className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span className="font-bold">LIVE</span>
                  </div>
                  <div className="text-white/80 text-xs">{streamDuration}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Viewer Count */}
            <div className="bg-black/40 backdrop-blur-md rounded-full px-3 py-2 flex items-center gap-1">
              <UserGroupIcon className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-semibold">{viewerCount.toLocaleString()}</span>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="bg-black/40 backdrop-blur-md rounded-full p-2 min-w-[40px] min-h-[40px] flex items-center justify-center"
            >
              <XMarkIcon className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Chat Section */}
        <motion.div
          className="absolute bottom-0 left-0 right-0"
          initial={{ y: 0 }}
          animate={{ y: isChatExpanded ? 0 : 300 }}
          transition={{ type: 'spring', damping: 25 }}
        >
          {/* Chat Toggle */}
          <button
            onClick={() => setIsChatExpanded(!isChatExpanded)}
            className="w-full bg-black/20 backdrop-blur-sm py-2"
          >
            <div className="w-12 h-1 bg-white/50 rounded-full mx-auto" />
          </button>

          {/* Chat Container */}
          <div className="bg-black/40 backdrop-blur-md" style={{ height: '40vh' }}>
            {/* Chat Messages */}
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto px-4 py-2">
                {messages.map(msg => (
                  <MessageItem key={msg.id} msg={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Reactions */}
              <div className="px-4 py-2 flex gap-2 overflow-x-auto">
                {['❤️', '🔥', '👏', '😍', '🎉', '💯'].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleSendReaction(emoji)}
                    className="bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 text-xl hover:bg-white/20 transition-colors flex-shrink-0"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Chat Input */}
              <div className="p-3 border-t border-white/10">
                <div className="flex gap-2">
                  <button
                    onClick={handleShowGifts}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-full p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  >
                    <GiftIcon className="w-5 h-5 text-white" />
                  </button>
                  
                  <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-full flex items-center px-4">
                    <input
                      ref={chatInputRef}
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 bg-transparent text-white placeholder-white/50 text-sm outline-none"
                    />
                  </div>
                  
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="bg-purple-600 rounded-full p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50"
                  >
                    <PaperAirplaneIcon className="w-5 h-5 text-white -rotate-45" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Side Action Buttons */}
        <div className="absolute right-4 bottom-1/2 transform translate-y-1/2 flex flex-col gap-3">
          <motion.button
            onClick={handleToggleMute}
            className="bg-black/40 backdrop-blur-md rounded-full p-3 min-w-[48px] min-h-[48px] flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            {isMuted ? (
              <SpeakerXMarkIcon className="w-6 h-6 text-white" />
            ) : (
              <SpeakerWaveIcon className="w-6 h-6 text-white" />
            )}
          </motion.button>

          <motion.button
            onClick={handleToggleFullscreen}
            className="bg-black/40 backdrop-blur-md rounded-full p-3 min-w-[48px] min-h-[48px] flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            {isFullscreen ? (
              <ArrowsPointingInIcon className="w-6 h-6 text-white" />
            ) : (
              <ArrowsPointingOutIcon className="w-6 h-6 text-white" />
            )}
          </motion.button>

          <motion.button
            onClick={() => {
              triggerHaptic('medium');
              if (navigator.share) {
                navigator.share({
                  title: `${creator?.displayName} is live!`,
                  text: `Watch ${creator?.displayName}'s live stream on Digis`,
                  url: window.location.href
                });
              }
            }}
            className="bg-black/40 backdrop-blur-md rounded-full p-3 min-w-[48px] min-h-[48px] flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            <ShareIcon className="w-6 h-6 text-white" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default MobileLiveStreamView;