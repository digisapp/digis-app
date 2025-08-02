import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GiftIcon,
  SparklesIcon,
  FireIcon,
  HeartIcon,
  StarIcon,
  CurrencyDollarIcon,
  ChatBubbleLeftIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const StreamMonetization = ({ streamId, creatorName, tokenBalance, onTokenPurchase }) => {
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showSuperChatModal, setShowSuperChatModal] = useState(false);
  const [selectedGift, setSelectedGift] = useState(null);
  const [superChatMessage, setSuperChatMessage] = useState('');
  const [superChatAmount, setSuperChatAmount] = useState(10);

  // Virtual gifts configuration
  const virtualGifts = [
    { id: 'heart', name: 'Heart', icon: HeartSolid, cost: 5, animation: 'float', color: 'red' },
    { id: 'star', name: 'Star', icon: StarIcon, cost: 10, animation: 'spin', color: 'yellow' },
    { id: 'fire', name: 'Fire', icon: FireIcon, cost: 20, animation: 'bounce', color: 'orange' },
    { id: 'sparkles', name: 'Sparkles', icon: SparklesIcon, cost: 50, animation: 'explode', color: 'purple' },
    { id: 'diamond', name: 'Diamond', icon: '💎', cost: 100, animation: 'shine', color: 'blue', isEmoji: true },
    { id: 'rocket', name: 'Rocket', icon: '🚀', cost: 200, animation: 'launch', color: 'red', isEmoji: true },
    { id: 'crown', name: 'Crown', icon: '👑', cost: 500, animation: 'rotate', color: 'gold', isEmoji: true },
    { id: 'unicorn', name: 'Unicorn', icon: '🦄', cost: 1000, animation: 'rainbow', color: 'pink', isEmoji: true }
  ];

  const handleSendGift = async (gift) => {
    if (tokenBalance < gift.cost) {
      toast.error('Insufficient tokens!');
      if (onTokenPurchase) {
        onTokenPurchase();
      }
      return;
    }

    // In production, this would make an API call
    try {
      // Simulate sending gift
      // toast.success(`Sent ${gift.name} to ${creatorName}!`);
      setSelectedGift(gift);
      
      // Show animation
      setTimeout(() => {
        setSelectedGift(null);
      }, 3000);
      
      setShowGiftModal(false);
    } catch (error) {
      toast.error('Failed to send gift');
    }
  };

  const handleSendSuperChat = async () => {
    if (!superChatMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (tokenBalance < superChatAmount) {
      toast.error('Insufficient tokens!');
      if (onTokenPurchase) {
        onTokenPurchase();
      }
      return;
    }

    try {
      // In production, this would make an API call
      // toast.success('Super Chat sent!');
      setSuperChatMessage('');
      setSuperChatAmount(10);
      setShowSuperChatModal(false);
    } catch (error) {
      toast.error('Failed to send Super Chat');
    }
  };

  return (
    <>
      {/* Quick Action Buttons */}
      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowGiftModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <GiftIcon className="w-5 h-5" />
          <span>Send Gift</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowSuperChatModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <CurrencyDollarIcon className="w-5 h-5" />
          <span>Super Chat</span>
        </motion.button>
      </div>

      {/* Animated Gift Display */}
      <AnimatePresence>
        {selectedGift && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed inset-0 pointer-events-none flex items-center justify-center z-50"
          >
            <motion.div
              animate={{
                y: selectedGift.animation === 'float' ? [-20, 20] : 0,
                rotate: selectedGift.animation === 'spin' ? 360 : 0,
                scale: selectedGift.animation === 'bounce' ? [1, 1.5, 1] : 1,
              }}
              transition={{
                duration: 2,
                repeat: selectedGift.animation === 'float' ? Infinity : 0,
                repeatType: "reverse"
              }}
              className="text-8xl"
            >
              {selectedGift.isEmoji ? (
                <span>{selectedGift.icon}</span>
              ) : (
                <selectedGift.icon className={`w-32 h-32 text-${selectedGift.color}-500`} />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gift Modal */}
      <AnimatePresence>
        {showGiftModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowGiftModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl p-6 max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Send a Virtual Gift</h3>
              
              <div className="grid grid-cols-4 gap-4 mb-6">
                {virtualGifts.map((gift) => (
                  <motion.button
                    key={gift.id}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleSendGift(gift)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    {gift.isEmoji ? (
                      <span className="text-4xl">{gift.icon}</span>
                    ) : (
                      <gift.icon className={`w-8 h-8 text-${gift.color}-500`} />
                    )}
                    <span className="text-sm font-medium">{gift.name}</span>
                    <span className="text-xs text-gray-600">{gift.cost} tokens</span>
                  </motion.button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-sm text-gray-600">
                  Balance: <span className="font-semibold">{tokenBalance} tokens</span>
                </p>
                <button
                  onClick={() => setShowGiftModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Super Chat Modal */}
      <AnimatePresence>
        {showSuperChatModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowSuperChatModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <ChatBubbleLeftIcon className="w-6 h-6 text-green-600" />
                Super Chat
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Message
                  </label>
                  <textarea
                    value={superChatMessage}
                    onChange={(e) => setSuperChatMessage(e.target.value)}
                    placeholder="Write your message..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    rows={3}
                    maxLength={200}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {superChatMessage.length}/200 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Token Amount
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 50, 100, 500].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setSuperChatAmount(amount)}
                        className={`py-2 px-4 rounded-lg transition-colors ${
                          superChatAmount === amount
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        {amount}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    value={superChatAmount}
                    onChange={(e) => setSuperChatAmount(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    min="1"
                  />
                </div>

                <div className={`p-4 rounded-lg ${
                  superChatAmount >= 100 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                  superChatAmount >= 50 ? 'bg-green-500' :
                  'bg-gray-200'
                }`}>
                  <p className={`text-sm font-medium ${
                    superChatAmount >= 50 ? 'text-white' : 'text-gray-700'
                  }`}>
                    Preview: Your message will be highlighted for {
                      superChatAmount >= 100 ? '5 minutes' :
                      superChatAmount >= 50 ? '2 minutes' :
                      '30 seconds'
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <p className="text-sm text-gray-600">
                  Total: <span className="font-semibold">{superChatAmount} tokens</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSuperChatModal(false)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendSuperChat}
                    disabled={tokenBalance < superChatAmount}
                    className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default StreamMonetization;