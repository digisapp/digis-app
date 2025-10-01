import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HeartIcon,
  FireIcon,
  StarIcon,
  FaceSmileIcon,
  HandThumbsUpIcon,
  SparklesIcon,
  BoltIcon,
  GiftIcon
} from '@heroicons/react/24/outline';
import { retryWebSocketSend, createWebSocketSender } from '../utils/retryUtils';

const LiveReactionsSystem = ({ 
  websocket, 
  channelId, 
  user,
  containerRef,
  showReactionBar = true,
  position = 'bottom' // 'bottom', 'side', 'overlay'
}) => {
  const [reactions, setReactions] = useState([]);
  const [reactionCounts, setReactionCounts] = useState(new Map());
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState(null);
  const [reactionBurst, setReactionBurst] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [sendErrors, setSendErrors] = useState([]);
  
  const reactionBarRef = useRef(null);
  const floatingContainerRef = useRef(null);
  const burstTimeoutRef = useRef(null);
  const wsMessageHandlerRef = useRef(null);
  const wsSenderRef = useRef(null);

  // Predefined reaction sets
  const basicReactions = [
    { emoji: '❤️', name: 'love', color: '#ef4444', sound: 'heart' },
    { emoji: '🔥', name: 'fire', color: '#f97316', sound: 'fire' },
    { emoji: '👍', name: 'like', color: '#3b82f6', sound: 'like' },
    { emoji: '😂', name: 'laugh', color: '#eab308', sound: 'laugh' },
    { emoji: '😮', name: 'wow', color: '#8b5cf6', sound: 'wow' },
    { emoji: '💎', name: 'gem', color: '#06b6d4', sound: 'gem' },
    { emoji: '⭐', name: 'star', color: '#f59e0b', sound: 'star' },
    { emoji: '⚡', name: 'energy', color: '#10b981', sound: 'energy' }
  ];

  const premiumReactions = [
    { emoji: '👑', name: 'crown', color: '#d4af37', sound: 'crown', premium: true },
    { emoji: '💖', name: 'super_love', color: '#ec4899', sound: 'super_love', premium: true },
    { emoji: '🚀', name: 'rocket', color: '#6366f1', sound: 'rocket', premium: true },
    { emoji: '🎉', name: 'party', color: '#10b981', sound: 'party', premium: true },
    { emoji: '🌟', name: 'sparkle', color: '#f59e0b', sound: 'sparkle', premium: true },
    { emoji: '💫', name: 'dizzy', color: '#8b5cf6', sound: 'dizzy', premium: true }
  ];

  const allReactions = [...basicReactions, ...premiumReactions];

  // Create WebSocket sender with retry
  useEffect(() => {
    if (websocket) {
      wsSenderRef.current = createWebSocketSender(websocket, {
        maxRetries: 5,
        initialDelay: 500,
        onRetry: (error, attempt, delay) => {
          console.warn(`[LiveReactions] WebSocket send retry ${attempt}, waiting ${delay}ms...`, error);
          setSendErrors(prev => [...prev, {
            timestamp: Date.now(),
            error: error.message,
            attempt
          }].slice(-5)); // Keep last 5 errors
        }
      });
    }
  }, [websocket]);

  useEffect(() => {
    if (websocket) {
      setupWebSocketListeners();
      updateConnectionStatus();
      
      // Monitor connection status
      const interval = setInterval(updateConnectionStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [websocket]);

  useEffect(() => {
    // Clean up old floating reactions periodically
    const cleanup = setInterval(() => {
      setFloatingReactions(prev => 
        prev.filter(reaction => Date.now() - reaction.timestamp < 6000)
      );
    }, 1000);

    return () => clearInterval(cleanup);
  }, []);

  const updateConnectionStatus = () => {
    if (!websocket) {
      setConnectionStatus('disconnected');
      return;
    }

    switch (websocket.readyState) {
      case WebSocket.CONNECTING:
        setConnectionStatus('connecting');
        break;
      case WebSocket.OPEN:
        setConnectionStatus('connected');
        break;
      case WebSocket.CLOSING:
        setConnectionStatus('closing');
        break;
      case WebSocket.CLOSED:
        setConnectionStatus('disconnected');
        break;
      default:
        setConnectionStatus('unknown');
    }
  };

  const setupWebSocketListeners = () => {
    // Remove old listener if exists
    if (wsMessageHandlerRef.current) {
      websocket.removeEventListener('message', wsMessageHandlerRef.current);
    }

    // Create new listener
    wsMessageHandlerRef.current = handleWebSocketMessage;
    websocket.addEventListener('message', wsMessageHandlerRef.current);

    // Connection state listeners
    websocket.addEventListener('open', updateConnectionStatus);
    websocket.addEventListener('close', updateConnectionStatus);
    websocket.addEventListener('error', (error) => {
      console.error('[LiveReactions] WebSocket error:', error);
      updateConnectionStatus();
    });
  };

  const handleWebSocketMessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'reaction_sent':
          if (data.channelId === channelId) {
            handleReactionReceived(data);
          }
          break;
        case 'reaction_burst':
          if (data.channelId === channelId) {
            handleReactionBurst(data);
          }
          break;
        case 'reaction_combo':
          if (data.channelId === channelId) {
            handleReactionCombo(data);
          }
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('[LiveReactions] Error parsing WebSocket message:', error);
    }
  };

  const handleReactionReceived = (reactionData) => {
    const { reaction, senderId, senderUsername } = reactionData;
    
    // Update reaction counts
    setReactionCounts(prev => {
      const updated = new Map(prev);
      updated.set(reaction, (updated.get(reaction) || 0) + 1);
      return updated;
    });

    // Add to recent reactions list
    setReactions(prev => [{
      id: `reaction_${Date.now()}_${Math.random()}`,
      emoji: reaction,
      senderId,
      senderUsername,
      timestamp: Date.now(),
      ...reactionData
    }, ...prev.slice(0, 49)]); // Keep last 50 reactions

    // Create floating reaction
    createFloatingReaction(reaction, senderId === user?.uid);
    
    // Play sound effect (if enabled)
    playReactionSound(reaction);
  };

  const handleReactionBurst = (burstData) => {
    const { reaction, count, senderId } = burstData;
    
    // Create multiple floating reactions
    for (let i = 0; i < Math.min(count, 10); i++) {
      setTimeout(() => {
        createFloatingReaction(reaction, senderId === user?.uid, true);
      }, i * 100);
    }

    // Show burst effect
    setReactionBurst({
      emoji: reaction,
      count,
      timestamp: Date.now()
    });

    setTimeout(() => setReactionBurst(null), 2000);
  };

  const handleReactionCombo = (comboData) => {
    const { reactions: comboReactions, multiplier } = comboData;
    
    // Create special combo effect
    comboReactions.forEach((reaction, index) => {
      setTimeout(() => {
        createFloatingReaction(reaction, false, false, multiplier);
      }, index * 150);
    });
  };

  const sendReaction = async (reactionEmoji, count = 1) => {
    if (!wsSenderRef.current || !channelId) {
      console.warn('[LiveReactions] Cannot send reaction: WebSocket not ready');
      return;
    }

    const reactionData = {
      type: 'send_reaction',
      channelId,
      reaction: reactionEmoji,
      count,
      targetType: 'stream',
      timestamp: Date.now()
    };

    try {
      await wsSenderRef.current(reactionData);
      
      // Clear send errors on success
      setSendErrors([]);
      
      // Immediate local feedback
      createFloatingReaction(reactionEmoji, true);
      
      // Update local count immediately
      setReactionCounts(prev => {
        const updated = new Map(prev);
        updated.set(reactionEmoji, (updated.get(reactionEmoji) || 0) + count);
        return updated;
      });
    } catch (error) {
      console.error('[LiveReactions] Failed to send reaction:', error);
      
      // Show error feedback to user
      setSendErrors(prev => [...prev, {
        timestamp: Date.now(),
        error: 'Failed to send reaction. Retrying...',
        emoji: reactionEmoji
      }].slice(-5));
    }
  };

  const sendReactionBurst = async (reactionEmoji, count = 5) => {
    if (!wsSenderRef.current || !channelId) {
      console.warn('[LiveReactions] Cannot send burst: WebSocket not ready');
      return;
    }

    const burstData = {
      type: 'send_reaction_burst',
      channelId,
      reaction: reactionEmoji,
      count,
      targetType: 'stream'
    };

    try {
      await wsSenderRef.current(burstData);
      setSendErrors([]);
    } catch (error) {
      console.error('[LiveReactions] Failed to send reaction burst:', error);
      setSendErrors(prev => [...prev, {
        timestamp: Date.now(),
        error: 'Failed to send reaction burst. Retrying...',
        emoji: reactionEmoji
      }].slice(-5));
    }
  };

  const createFloatingReaction = (emoji, isOwnReaction = false, isBurst = false, multiplier = 1) => {
    const container = floatingContainerRef.current || document.body;
    const containerRect = container.getBoundingClientRect();
    
    const floatingReaction = {
      id: `floating_${Date.now()}_${Math.random()}`,
      emoji,
      isOwnReaction,
      isBurst,
      multiplier,
      timestamp: Date.now(),
      startX: Math.random() * (containerRect.width - 60) + 30,
      startY: containerRect.height - 100,
      targetY: -100,
      rotation: (Math.random() - 0.5) * 60, // Random rotation
      scale: isBurst ? 1.5 : multiplier > 1 ? 1.2 : 1,
      duration: isBurst ? 4000 : 3000
    };

    setFloatingReactions(prev => [...prev, floatingReaction]);

    // Remove after animation
    setTimeout(() => {
      setFloatingReactions(prev => 
        prev.filter(r => r.id !== floatingReaction.id)
      );
    }, floatingReaction.duration);
  };

  const playReactionSound = (emoji) => {
    // Placeholder for sound effects
    // In a real implementation, you'd play different sounds for different reactions
    if (typeof Audio !== 'undefined') {
      // const audio = new Audio(`/sounds/reaction_${reactionType}.mp3`);
      // audio.volume = 0.3;
      // audio.play().catch(() => {}); // Ignore errors
    }
  };

  const handleQuickReaction = async (reaction) => {
    await sendReaction(reaction.emoji);
    setSelectedReaction(reaction);
    
    // Clear selection after animation
    setTimeout(() => setSelectedReaction(null), 500);
  };

  const handleLongPressReaction = async (reaction) => {
    // Long press for burst reaction
    await sendReactionBurst(reaction.emoji, 5);
  };

  const getTopReactions = (limit = 6) => {
    return Array.from(reactionCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([emoji, count]) => ({ emoji, count }));
  };

  const getConnectionStatusIndicator = () => {
    const statusConfig = {
      connected: { color: 'bg-green-500', text: 'Connected' },
      connecting: { color: 'bg-yellow-500', text: 'Connecting...' },
      disconnected: { color: 'bg-red-500', text: 'Disconnected' },
      closing: { color: 'bg-orange-500', text: 'Closing...' },
      unknown: { color: 'bg-gray-500', text: 'Unknown' }
    };

    const config = statusConfig[connectionStatus] || statusConfig.unknown;

    return (
      <div className="flex items-center gap-2 text-xs">
        <div className={`w-2 h-2 rounded-full ${config.color} ${connectionStatus === 'connected' ? 'animate-pulse' : ''}`} />
        <span className="text-gray-600">{config.text}</span>
      </div>
    );
  };

  if (!showReactionBar) {
    return (
      <div 
        ref={floatingContainerRef}
        className="fixed inset-0 pointer-events-none z-50"
        style={{ zIndex: 9999 }}
      >
        <FloatingReactions reactions={floatingReactions} />
        {reactionBurst && <ReactionBurst burst={reactionBurst} />}
      </div>
    );
  }

  return (
    <>
      {/* Floating Reactions Container */}
      <div 
        ref={floatingContainerRef}
        className="fixed inset-0 pointer-events-none z-50"
        style={{ zIndex: 9999 }}
      >
        <FloatingReactions reactions={floatingReactions} />
        {reactionBurst && <ReactionBurst burst={reactionBurst} />}
      </div>

      {/* Reaction Bar */}
      <motion.div
        ref={reactionBarRef}
        className={`bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-4 ${
          position === 'side' 
            ? 'fixed right-4 top-1/2 transform -translate-y-1/2 flex-col w-16' 
            : position === 'overlay'
            ? 'absolute bottom-4 left-4 right-4'
            : 'w-full'
        }`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Top Reactions Summary */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Live Reactions</span>
            {getConnectionStatusIndicator()}
          </div>
          
          <div className="flex items-center gap-1">
            {getTopReactions(3).map(({ emoji, count }, index) => (
              <div 
                key={emoji}
                className="flex items-center gap-1 bg-gray-100 rounded-full px-2 py-1 text-xs"
              >
                <span>{emoji}</span>
                <span className="text-gray-600">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Error Messages */}
        <AnimatePresence>
          {sendErrors.length > 0 && (
            <motion.div
              className="mb-4 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {sendErrors[sendErrors.length - 1].error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Reactions */}
        <div className={`flex ${position === 'side' ? 'flex-col' : ''} gap-2 mb-4`}>
          {basicReactions.map((reaction) => (
            <motion.button
              key={reaction.name}
              onClick={() => handleQuickReaction(reaction)}
              onMouseDown={() => {
                // Long press detection
                burstTimeoutRef.current = setTimeout(() => {
                  handleLongPressReaction(reaction);
                }, 500);
              }}
              onMouseUp={() => {
                if (burstTimeoutRef.current) {
                  clearTimeout(burstTimeoutRef.current);
                }
              }}
              onMouseLeave={() => {
                if (burstTimeoutRef.current) {
                  clearTimeout(burstTimeoutRef.current);
                }
              }}
              className={`relative p-3 rounded-xl transition-all text-2xl ${
                selectedReaction?.name === reaction.name
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white scale-110'
                  : 'bg-gray-100 hover:bg-gray-200 hover:scale-110'
              } ${connectionStatus !== 'connected' ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{
                background: selectedReaction?.name === reaction.name 
                  ? `linear-gradient(135deg, ${reaction.color}, ${reaction.color}cc)` 
                  : undefined
              }}
              whileHover={{ scale: connectionStatus === 'connected' ? 1.1 : 1 }}
              whileTap={{ scale: connectionStatus === 'connected' ? 0.9 : 1 }}
              title={`${reaction.name} (hold for burst)`}
              disabled={connectionStatus !== 'connected'}
            >
              {reaction.emoji}
              
              {/* Reaction count bubble */}
              {reactionCounts.has(reaction.emoji) && reactionCounts.get(reaction.emoji) > 0 && (
                <motion.div
                  className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  {reactionCounts.get(reaction.emoji)}
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>

        {/* More Reactions Button */}
        <motion.button
          onClick={() => setShowReactionPicker(!showReactionPicker)}
          className={`w-full p-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:from-purple-700 hover:to-blue-700 transition-all ${
            connectionStatus !== 'connected' ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          whileHover={{ scale: connectionStatus === 'connected' ? 1.02 : 1 }}
          whileTap={{ scale: connectionStatus === 'connected' ? 0.98 : 1 }}
          disabled={connectionStatus !== 'connected'}
        >
          <FaceSmileIcon className="w-5 h-5" />
          More Reactions
        </motion.button>

        {/* Extended Reaction Picker */}
        <AnimatePresence>
          {showReactionPicker && (
            <motion.div
              className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-2xl shadow-xl border border-gray-200 p-4 max-h-64 overflow-y-auto"
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div className="grid grid-cols-4 gap-3">
                {allReactions.map((reaction) => (
                  <motion.button
                    key={reaction.name}
                    onClick={() => {
                      handleQuickReaction(reaction);
                      setShowReactionPicker(false);
                    }}
                    className={`relative p-3 rounded-xl transition-all text-2xl ${
                      reaction.premium
                        ? 'bg-gradient-to-r from-amber-100 to-yellow-100 border border-amber-300'
                        : 'bg-gray-100 hover:bg-gray-200'
                    } ${connectionStatus !== 'connected' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    whileHover={{ scale: connectionStatus === 'connected' ? 1.1 : 1 }}
                    whileTap={{ scale: connectionStatus === 'connected' ? 0.9 : 1 }}
                    title={reaction.name}
                    disabled={connectionStatus !== 'connected'}
                  >
                    {reaction.emoji}
                    
                    {reaction.premium && (
                      <div className="absolute -top-1 -right-1 bg-gradient-to-r from-amber-400 to-yellow-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                        ✨
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
};

// Floating Reactions Component
const FloatingReactions = ({ reactions }) => {
  return (
    <AnimatePresence>
      {reactions.map((reaction) => (
        <motion.div
          key={reaction.id}
          className={`absolute text-4xl pointer-events-none select-none ${
            reaction.isOwnReaction ? 'z-50' : 'z-40'
          }`}
          style={{
            left: reaction.startX,
            fontSize: `${reaction.scale * 2}rem`,
            filter: reaction.isOwnReaction ? 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.6))' : 'none'
          }}
          initial={{
            y: reaction.startY,
            x: 0,
            opacity: 1,
            scale: 0,
            rotate: 0
          }}
          animate={{
            y: reaction.targetY,
            x: (Math.random() - 0.5) * 100,
            opacity: [1, 1, 0],
            scale: [0, reaction.scale, reaction.scale * 0.8],
            rotate: reaction.rotation
          }}
          exit={{
            opacity: 0,
            scale: 0
          }}
          transition={{
            duration: reaction.duration / 1000,
            ease: 'easeOut',
            opacity: {
              times: [0, 0.8, 1],
              duration: reaction.duration / 1000
            }
          }}
        >
          {reaction.emoji}
          
          {reaction.multiplier > 1 && (
            <span className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
              x{reaction.multiplier}
            </span>
          )}
        </motion.div>
      ))}
    </AnimatePresence>
  );
};

// Reaction Burst Component
const ReactionBurst = ({ burst }) => {
  if (!burst) return null;

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="text-8xl"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ 
          scale: [0, 1.5, 1.2], 
          rotate: [0, 360, 720],
          y: [0, -20, 0]
        }}
        transition={{
          duration: 2,
          ease: 'easeOut',
          times: [0, 0.6, 1]
        }}
      >
        {burst.emoji}
      </motion.div>
      
      <motion.div
        className="absolute text-3xl font-bold text-white bg-purple-500 rounded-full w-16 h-16 flex items-center justify-center"
        initial={{ scale: 0, y: 50 }}
        animate={{ scale: [0, 1, 0.8], y: [50, 0, -10] }}
        transition={{
          duration: 1.5,
          ease: 'easeOut',
          delay: 0.3
        }}
      >
        x{burst.count}
      </motion.div>
    </motion.div>
  );
};

export default LiveReactionsSystem;