/**
 * Stream gifts overlay component
 * @module components/StreamGifts
 */

import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  GiftIcon,
  HeartIcon,
  SparklesIcon,
  FireIcon,
  CakeIcon,
  StarIcon,
  BoltIcon,
  RocketLaunchIcon,
  CrownIcon,
  TrophyIcon
} from '@heroicons/react/24/solid';

/**
 * Virtual gifts catalog
 */
const GIFT_CATALOG = [
  { id: 'heart', name: 'Heart', icon: HeartIcon, value: 1, color: 'text-red-500', emoji: '❤️' },
  { id: 'star', name: 'Star', icon: StarIcon, value: 5, color: 'text-yellow-500', emoji: '⭐' },
  { id: 'fire', name: 'Fire', icon: FireIcon, value: 10, color: 'text-orange-500', emoji: '🔥' },
  { id: 'cake', name: 'Cake', icon: CakeIcon, value: 25, color: 'text-pink-500', emoji: '🎂' },
  { id: 'sparkles', name: 'Sparkles', icon: SparklesIcon, value: 50, color: 'text-purple-500', emoji: '✨' },
  { id: 'bolt', name: 'Lightning', icon: BoltIcon, value: 100, color: 'text-blue-500', emoji: '⚡' },
  { id: 'rocket', name: 'Rocket', icon: RocketLaunchIcon, value: 250, color: 'text-indigo-500', emoji: '🚀' },
  { id: 'crown', name: 'Crown', icon: CrownIcon, value: 500, color: 'text-yellow-400', emoji: '👑' },
  { id: 'trophy', name: 'Trophy', icon: TrophyIcon, value: 1000, color: 'text-amber-500', emoji: '🏆' }
];

/**
 * Displays gift animations and selection panel
 */
const StreamGifts = memo(({
  isViewer,
  onSendGift,
  recentGifts = [],
  userBalance = 0
}) => {
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [selectedGift, setSelectedGift] = useState(null);
  const [giftMessage, setGiftMessage] = useState('');
  const [animatingGifts, setAnimatingGifts] = useState([]);
  const [comboGifts, setComboGifts] = useState({});

  /**
   * Add gift to animation queue
   */
  useEffect(() => {
    if (recentGifts.length === 0) return;

    const latestGift = recentGifts[0];
    const giftData = GIFT_CATALOG.find(g => g.id === latestGift.giftId);
    
    if (!giftData) return;

    // Create animation gift
    const animGift = {
      id: Date.now() + Math.random(),
      ...latestGift,
      ...giftData,
      x: Math.random() * 80 + 10, // Random X position (10-90%)
      duration: 3000 + Math.random() * 2000 // 3-5 seconds
    };

    setAnimatingGifts(prev => [...prev, animGift]);

    // Check for combo
    const comboKey = `${latestGift.senderId}-${latestGift.giftId}`;
    setComboGifts(prev => ({
      ...prev,
      [comboKey]: (prev[comboKey] || 0) + 1
    }));

    // Remove after animation
    setTimeout(() => {
      setAnimatingGifts(prev => prev.filter(g => g.id !== animGift.id));
    }, animGift.duration);

    // Clear combo after delay
    setTimeout(() => {
      setComboGifts(prev => {
        const newCombos = { ...prev };
        delete newCombos[comboKey];
        return newCombos;
      });
    }, 5000);
  }, [recentGifts]);

  /**
   * Send gift handler
   */
  const handleSendGift = () => {
    if (!selectedGift) return;

    if (userBalance < selectedGift.value) {
      toast.error('Insufficient balance');
      return;
    }

    onSendGift?.(selectedGift, giftMessage);
    setShowGiftPanel(false);
    setSelectedGift(null);
    setGiftMessage('');
  };

  /**
   * Gift animation component
   */
  const GiftAnimation = ({ gift }) => {
    const Icon = gift.icon;
    const combo = comboGifts[`${gift.senderId}-${gift.giftId}`];

    return (
      <motion.div
        initial={{ y: window.innerHeight, opacity: 0, scale: 0.5 }}
        animate={{ 
          y: -200, 
          opacity: [0, 1, 1, 0],
          scale: [0.5, 1.2, 1, 1]
        }}
        transition={{ 
          duration: gift.duration / 1000,
          ease: 'easeOut'
        }}
        style={{ left: `${gift.x}%` }}
        className="absolute pointer-events-none"
      >
        <div className="relative">
          {/* Gift icon with glow effect */}
          <div className={`relative ${gift.color}`}>
            <div className="absolute inset-0 blur-xl opacity-50">
              <Icon className="w-16 h-16" />
            </div>
            <Icon className="w-16 h-16 relative animate-bounce" />
          </div>

          {/* Sender name */}
          <div className="mt-2 text-center">
            <p className="text-white font-bold text-sm drop-shadow-lg">
              {gift.senderName}
            </p>
            {giftMessage && (
              <p className="text-gray-300 text-xs mt-1 max-w-[150px]">
                {gift.message}
              </p>
            )}
          </div>

          {/* Combo indicator */}
          {combo > 1 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.5, 1] }}
              className="absolute -top-4 -right-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold rounded-full w-8 h-8 flex items-center justify-center text-sm"
            >
              x{combo}
            </motion.div>
          )}

          {/* Sparkle effects */}
          {gift.value >= 100 && (
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0],
                    x: Math.random() * 100 - 50,
                    y: Math.random() * 100 - 50
                  }}
                  transition={{
                    duration: 1,
                    delay: i * 0.1,
                    repeat: Infinity,
                    repeatDelay: 1
                  }}
                  className="absolute top-1/2 left-1/2"
                >
                  <SparklesIcon className="w-4 h-4 text-yellow-300" />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <>
      {/* Gift animations overlay */}
      <div className="fixed inset-0 pointer-events-none z-30">
        <AnimatePresence>
          {animatingGifts.map(gift => (
            <GiftAnimation key={gift.id} gift={gift} />
          ))}
        </AnimatePresence>
      </div>

      {/* Gift button for viewers */}
      {isViewer && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowGiftPanel(true)}
          className="fixed bottom-24 right-4 p-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full shadow-lg z-20"
        >
          <GiftIcon className="w-6 h-6" />
        </motion.button>
      )}

      {/* Gift selection panel */}
      <AnimatePresence>
        {showGiftPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
            >
              <h2 className="text-white text-xl font-bold mb-4">Send a Gift</h2>

              {/* Balance display */}
              <div className="bg-gray-700 rounded-lg p-3 mb-4">
                <p className="text-gray-400 text-sm">Your Balance</p>
                <p className="text-white text-2xl font-bold">{userBalance} tokens</p>
              </div>

              {/* Gift grid */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {GIFT_CATALOG.map(gift => {
                  const Icon = gift.icon;
                  const canAfford = userBalance >= gift.value;
                  
                  return (
                    <motion.button
                      key={gift.id}
                      whileHover={canAfford ? { scale: 1.05 } : {}}
                      whileTap={canAfford ? { scale: 0.95 } : {}}
                      onClick={() => canAfford && setSelectedGift(gift)}
                      disabled={!canAfford}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        selectedGift?.id === gift.id
                          ? 'border-purple-500 bg-purple-500/20'
                          : canAfford
                          ? 'border-gray-600 bg-gray-700 hover:border-gray-500'
                          : 'border-gray-700 bg-gray-800 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className={`${gift.color} mb-2`}>
                        <Icon className="w-8 h-8 mx-auto" />
                      </div>
                      <p className="text-white text-sm font-medium">{gift.name}</p>
                      <p className={`text-xs mt-1 ${
                        canAfford ? 'text-gray-400' : 'text-red-400'
                      }`}>
                        {gift.value} tokens
                      </p>
                    </motion.button>
                  );
                })}
              </div>

              {/* Selected gift details */}
              {selectedGift && (
                <div className="bg-gray-700 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{selectedGift.emoji}</span>
                      <div>
                        <p className="text-white font-medium">{selectedGift.name}</p>
                        <p className="text-gray-400 text-sm">{selectedGift.value} tokens</p>
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm">
                      Balance after: {userBalance - selectedGift.value} tokens
                    </p>
                  </div>
                </div>
              )}

              {/* Message input */}
              <input
                type="text"
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                placeholder="Add a message (optional)"
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
                maxLength={100}
              />

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowGiftPanel(false)}
                  className="flex-1 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendGift}
                  disabled={!selectedGift}
                  className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                    selectedGift
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Send Gift
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

StreamGifts.displayName = 'StreamGifts';

export default StreamGifts;