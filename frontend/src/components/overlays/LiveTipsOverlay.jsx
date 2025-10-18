import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Coins } from 'lucide-react';
import * as Ably from 'ably';

const LiveTipsOverlay = ({ channel }) => {
  const [tips, setTips] = useState([]);
  const [displayedTips, setDisplayedTips] = useState([]);
  const [connectionState, setConnectionState] = useState('connecting'); // connecting, connected, disconnected, suspended
  const tipQueueRef = useRef([]);
  const processingRef = useRef(false);
  const ablyClientRef = useRef(null);
  const ablyChannelRef = useRef(null);
  const seenTipIdsRef = useRef(new Set()); // Idempotency: track seen tip IDs

  useEffect(() => {
    if (!channel) return;

    const initializeAbly = async () => {
      try {
        const backend = import.meta.env.VITE_BACKEND_URL;

        // Initialize Ably client with authUrl (handles token refresh automatically)
        ablyClientRef.current = new Ably.Realtime({
          authUrl: `${backend}/api/v1/realtime/ably/token`,
          authMethod: 'POST',
          authHeaders: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
          },
          disconnectedRetryTimeout: 3000,
          useBinaryProtocol: true, // Smaller payloads for better performance
          closeOnUnload: true,
          autoConnect: true
        });

        // Log connection state changes and update UI
        ablyClientRef.current.connection.on((stateChange) => {
          console.log('[Ably]', stateChange.current, stateChange.reason || '');
          setConnectionState(stateChange.current);
        });

        // Subscribe to stream channel for tip events
        ablyChannelRef.current = ablyClientRef.current.channels.get(`stream:${channel}`);

        ablyChannelRef.current.subscribe('tip:new', (message) => {
          console.log('New tip received via Ably:', message.data);

          const tipData = message.data || {};
          const tipId = tipData.tipId || `tip_${Date.now()}`;

          // Idempotency: skip if already seen
          if (seenTipIdsRef.current.has(tipId)) {
            console.log('[Ably] Duplicate tip ignored:', tipId);
            return;
          }

          seenTipIdsRef.current.add(tipId);

          // Limit seen IDs to last 1000 to prevent memory leak
          if (seenTipIdsRef.current.size > 1000) {
            const idsArray = Array.from(seenTipIdsRef.current);
            seenTipIdsRef.current = new Set(idsArray.slice(-500)); // Keep last 500
          }

          const tip = {
            id: tipId,
            username: tipData.fromUsername || 'Anonymous',
            amount: tipData.amountTokens || 0,
            message: tipData.message || null,
            timestamp: Date.now()
          };

          // Add to queue
          tipQueueRef.current.push(tip);

          // Process queue if not already processing
          if (!processingRef.current) {
            processNextTip();
          }
        });

        console.log(`Subscribed to Ably channel: stream:${channel}`);
      } catch (error) {
        console.error('Ably initialization error:', error);
      }
    };

    initializeAbly();

    return () => {
      // Cleanup Ably subscription
      if (ablyChannelRef.current) {
        ablyChannelRef.current.unsubscribe();
      }
      if (ablyClientRef.current) {
        ablyClientRef.current.close();
      }
    };
  }, [channel]);

  const processNextTip = () => {
    if (tipQueueRef.current.length === 0) {
      processingRef.current = false;
      return;
    }

    processingRef.current = true;
    const nextTip = tipQueueRef.current.shift();

    // Add to displayed tips
    setDisplayedTips(prev => [...prev, nextTip]);

    // Remove after animation completes (5 seconds)
    setTimeout(() => {
      setDisplayedTips(prev => prev.filter(t => t.id !== nextTip.id));

      // Process next tip after a brief delay
      setTimeout(() => {
        processNextTip();
      }, 500);
    }, 5000);
  };

  return (
    <div className="fixed top-20 left-4 right-4 z-40 pointer-events-none">
      {/* Reconnection Banner */}
      <AnimatePresence>
        {(connectionState === 'connecting' || connectionState === 'suspended' || connectionState === 'disconnected') && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-2 max-w-sm"
          >
            <div className="bg-yellow-500/90 backdrop-blur-sm text-black px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 pointer-events-auto">
              <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
              <span>
                {connectionState === 'connecting' && 'Connecting to live updates...'}
                {connectionState === 'suspended' && 'Reconnecting...'}
                {connectionState === 'disconnected' && 'Connection lost. Retrying...'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-sm space-y-2">
        <AnimatePresence>
          {displayedTips.map((tip) => (
            <motion.div
              key={tip.id}
              initial={{ x: -100, opacity: 0, scale: 0.8 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 100, opacity: 0, scale: 0.8 }}
              transition={{
                type: 'spring',
                damping: 25,
                stiffness: 300,
                exit: { duration: 0.3 }
              }}
              className="relative"
            >
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-2xl blur-xl" />

              {/* Tip Card */}
              <div className="relative bg-gradient-to-r from-pink-500 to-purple-500 p-0.5 rounded-2xl shadow-2xl">
                <div className="bg-gray-900/95 backdrop-blur-sm rounded-2xl p-4">
                  <div className="flex items-start space-x-3">
                    {/* Heart Icon */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.2, 1] }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center flex-shrink-0"
                    >
                      <Heart className="w-5 h-5 text-white" fill="currentColor" />
                    </motion.div>

                    {/* Tip Content */}
                    <div className="flex-1 min-w-0">
                      {/* Username and Amount */}
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-bold text-white truncate">
                          {tip.username}
                        </p>
                        <div className="flex items-center space-x-1 bg-yellow-500/20 px-2 py-1 rounded-full">
                          <Coins className="w-4 h-4 text-yellow-400" />
                          <span className="text-sm font-bold text-yellow-400">
                            {tip.amount}
                          </span>
                        </div>
                      </div>

                      {/* Message */}
                      {tip.message && (
                        <p className="text-sm text-gray-300 line-clamp-2">
                          {tip.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sparkles Animation */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1.5, delay: 0.3 }}
                className="absolute inset-0 pointer-events-none"
              >
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{
                      x: '50%',
                      y: '50%',
                      scale: 0
                    }}
                    animate={{
                      x: `${50 + Math.cos((i * Math.PI * 2) / 8) * 50}%`,
                      y: `${50 + Math.sin((i * Math.PI * 2) / 8) * 50}%`,
                      scale: [0, 1, 0],
                      opacity: [0, 1, 0]
                    }}
                    transition={{
                      duration: 1,
                      delay: 0.3 + (i * 0.05)
                    }}
                    className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                    style={{
                      boxShadow: '0 0 10px rgba(250, 204, 21, 0.5)'
                    }}
                  />
                ))}
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LiveTipsOverlay;
