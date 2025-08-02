import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { 
  GiftIcon, 
  HeartIcon, 
  SparklesIcon,
  StarIcon,
  FireIcon,
  BoltIcon,
  TrophyIcon,
  CurrencyDollarIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import Button from './ui/Button';
import Modal from './ui/Modal';
import Input from './ui/Input';
import Card from './ui/Card';
import Tooltip from './ui/Tooltip';
import { getAuthToken } from '../utils/auth-helpers';

const VirtualGifts = ({ 
  user, 
  channel, 
  isOpen, 
  onClose, 
  onSendGift, 
  onSendTip,
  targetCreator = null,
  className = '' 
}) => {
  const { animations } = useTheme();
  const [activeTab, setActiveTab] = useState('gifts');
  const [selectedGift, setSelectedGift] = useState(null);
  const [tipAmount, setTipAmount] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [userTokens, setUserTokens] = useState(0);
  const [recentGifts, setRecentGifts] = useState([]);
  const [giftAnimations, setGiftAnimations] = useState([]);
  const [loading, setLoading] = useState(false);

  // Miami Beach Virtual Gifts Catalog
  const giftCatalog = {
    basic: [
      { id: 'heart', name: 'Heart', emoji: '❤️', cost: 5, rarity: 'common' },
      { id: 'thumbs-up', name: 'Thumbs Up', emoji: '👍', cost: 10, rarity: 'common' },
      { id: 'clap', name: 'Clap', emoji: '👏', cost: 15, rarity: 'common' },
      { id: 'fire', name: 'Fire', emoji: '🔥', cost: 20, rarity: 'common' },
      { id: 'star', name: 'Star', emoji: '⭐', cost: 25, rarity: 'common' },
      { id: 'cake', name: 'Cake', emoji: '🎂', cost: 30, rarity: 'common' },
    ],
    premium: [
      { id: 'diamond', name: 'Diamond', emoji: '💎', cost: 50, rarity: 'rare' },
      { id: 'ring', name: 'Ring', emoji: '💍', cost: 75, rarity: 'rare' },
      { id: 'crown', name: 'Crown', emoji: '👑', cost: 100, rarity: 'rare' },
      { id: 'gold-bar', name: 'Gold Bar', emoji: '🥇', cost: 150, rarity: 'rare' },
      { id: 'trophy', name: 'Trophy', emoji: '🏆', cost: 200, rarity: 'epic' },
      { id: 'rocket', name: 'Rocket', emoji: '🚀', cost: 250, rarity: 'epic' },
    ],
    luxury: [
      { id: 'champagne', name: 'Champagne', emoji: '🍾', cost: 300, rarity: 'legendary' },
      { id: 'sports-car', name: 'Sports Car', emoji: '🏎️', cost: 500, rarity: 'legendary' },
      { id: 'yacht', name: 'Yacht', emoji: '🛥️', cost: 750, rarity: 'legendary' },
      { id: 'mansion', name: 'Mansion', emoji: '🏰', cost: 1000, rarity: 'mythic' },
      { id: 'private-jet', name: 'Private Jet', emoji: '✈️', cost: 1500, rarity: 'mythic' },
      { id: 'island', name: 'Private Island', emoji: '🏝️', cost: 2500, rarity: 'mythic' },
    ]
  };

  // Quick tip amounts
  const quickTips = [
    { amount: 1, label: '$1' },
    { amount: 5, label: '$5' },
    { amount: 10, label: '$10' },
    { amount: 25, label: '$25' },
    { amount: 50, label: '$50' },
    { amount: 100, label: '$100' },
  ];

  useEffect(() => {
    if (user) {
      fetchUserTokens();
    }
  }, [user]);

  const fetchUserTokens = async () => {
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tokens/balance`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserTokens(data.balance);
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
    }
  };

  const handleGiftSelect = (gift) => {
    setSelectedGift(gift);
  };

  const sendGift = async () => {
    if (!selectedGift || userTokens < selectedGift.cost) return;

    setLoading(true);
    try {
      const giftData = {
        giftId: selectedGift.id,
        giftName: selectedGift.name,
        giftEmoji: selectedGift.emoji,
        cost: selectedGift.cost,
        message: giftMessage,
        targetCreator: targetCreator?.id,
        timestamp: Date.now(),
        sender: {
          id: user.id,
          name: user.displayName || user.email.split('@')[0],
          avatar: user.photoURL
        }
      };

      // Send gift through backend
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/gifts/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          ...giftData,
          channel,
        }),
      });

      if (response.ok) {
        // Update local state
        setUserTokens(prev => prev - selectedGift.cost);
        setRecentGifts(prev => [giftData, ...prev.slice(0, 9)]);
        
        // Trigger gift animation
        triggerGiftAnimation(selectedGift);
        
        // Notify parent component
        onSendGift?.(giftData);
        
        // Reset form
        setSelectedGift(null);
        setGiftMessage('');
        
        // Close modal
        onClose();
      } else {
        throw new Error('Failed to send gift');
      }
    } catch (error) {
      console.error('Error sending gift:', error);
      alert('Failed to send gift. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendTip = async () => {
    const amount = parseFloat(tipAmount);
    if (!amount || amount <= 0) return;

    setLoading(true);
    try {
      const tipData = {
        amount,
        message: giftMessage,
        targetCreator: targetCreator?.id,
        timestamp: Date.now(),
        sender: {
          id: user.id,
          name: user.displayName || user.email.split('@')[0],
          avatar: user.photoURL
        }
      };

      // Send tip through backend
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tips/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          ...tipData,
          channel,
        }),
      });

      if (response.ok) {
        // Notify parent component
        onSendTip?.(tipData);
        
        // Reset form
        setTipAmount('');
        setGiftMessage('');
        
        // Close modal
        onClose();
      } else {
        throw new Error('Failed to send tip');
      }
    } catch (error) {
      console.error('Error sending tip:', error);
      alert('Failed to send tip. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const triggerGiftAnimation = (gift) => {
    const animationId = Date.now();
    setGiftAnimations(prev => [...prev, { 
      id: animationId, 
      emoji: gift.emoji, 
      rarity: gift.rarity 
    }]);

    // Remove animation after completion
    setTimeout(() => {
      setGiftAnimations(prev => prev.filter(anim => anim.id !== animationId));
    }, 3000);
  };

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'common': return 'border-gray-300 bg-gray-50';
      case 'rare': return 'border-blue-300 bg-blue-50';
      case 'epic': return 'border-purple-300 bg-purple-50';
      case 'legendary': return 'border-yellow-300 bg-yellow-50';
      case 'mythic': return 'border-red-300 bg-red-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  const getRarityGlow = (rarity) => {
    switch (rarity) {
      case 'rare': return 'shadow-blue-500/25';
      case 'epic': return 'shadow-purple-500/25';
      case 'legendary': return 'shadow-yellow-500/25';
      case 'mythic': return 'shadow-red-500/25';
      default: return '';
    }
  };

  const GiftCard = ({ gift }) => {
    const isSelected = selectedGift?.id === gift.id;
    const canAfford = userTokens >= gift.cost;

    return (
      <motion.div
        whileHover={animations ? { scale: 1.05 } : {}}
        whileTap={animations ? { scale: 0.95 } : {}}
        onClick={() => canAfford && handleGiftSelect(gift)}
        className={`
          relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
          ${isSelected ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : getRarityColor(gift.rarity)}
          ${canAfford ? 'hover:shadow-lg' : 'opacity-50 cursor-not-allowed'}
          ${getRarityGlow(gift.rarity)}
        `}
      >
        <div className="text-center">
          <div className="text-3xl mb-2">{gift.emoji}</div>
          <h4 className="font-semibold text-sm mb-1">{gift.name}</h4>
          <div className="flex items-center justify-center gap-1 text-xs text-primary-600">
            <CurrencyDollarIcon className="w-3 h-3" />
            <span>{gift.cost}</span>
          </div>
        </div>
        
        {!canAfford && (
          <div className="absolute inset-0 bg-black/20 rounded-xl flex items-center justify-center">
            <span className="text-xs font-semibold text-red-600 bg-white/90 px-2 py-1 rounded">
              Insufficient Tokens
            </span>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Send Gifts & Tips"
        size="lg"
        className={className}
      >
        <div className="space-y-6">
          {/* User Balance */}
          <div className="flex items-center justify-between p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
            <div className="flex items-center gap-2">
              <CurrencyDollarIcon className="w-5 h-5 text-primary-600" />
              <span className="font-semibold">Your Balance:</span>
            </div>
            <span className="font-bold text-primary-600">{userTokens.toLocaleString()} tokens</span>
          </div>

          {/* Target Creator */}
          {targetCreator && (
            <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary-400 to-secondary-400 flex items-center justify-center text-white font-semibold">
                {targetCreator.name?.[0]?.toUpperCase() || 'C'}
              </div>
              <div>
                <h4 className="font-semibold">Sending to {targetCreator.name}</h4>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Show your appreciation!
                </p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
            <button
              onClick={() => setActiveTab('gifts')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'gifts'
                  ? 'bg-white dark:bg-neutral-700 text-primary-600 shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <GiftIcon className="w-4 h-4 inline mr-2" />
              Virtual Gifts
            </button>
            <button
              onClick={() => setActiveTab('tips')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'tips'
                  ? 'bg-white dark:bg-neutral-700 text-primary-600 shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <CurrencyDollarIcon className="w-4 h-4 inline mr-2" />
              Cash Tips
            </button>
          </div>

          {/* Content */}
          {activeTab === 'gifts' ? (
            <div className="space-y-6">
              {/* Gift Categories */}
              {Object.entries(giftCatalog).map(([category, gifts]) => (
                <div key={category}>
                  <h3 className="font-semibold text-lg mb-3 capitalize flex items-center gap-2">
                    {category === 'basic' && <HeartIcon className="w-5 h-5" />}
                    {category === 'premium' && <StarIcon className="w-5 h-5" />}
                    {category === 'luxury' && <SparklesIcon className="w-5 h-5" />}
                    {category} Gifts
                  </h3>
                  <div className="grid grid-cols-5 gap-3">
                    {gifts.map((gift) => (
                      <GiftCard key={gift.id} gift={gift} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Selected Gift Preview */}
              {selectedGift && (
                <Card className="border-primary-200 bg-primary-50/50 dark:bg-primary-900/10">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{selectedGift.emoji}</div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">{selectedGift.name}</h4>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                        Cost: {selectedGift.cost} tokens
                      </p>
                      
                      <Input
                        value={giftMessage}
                        onChange={(e) => setGiftMessage(e.target.value)}
                        placeholder="Add a message (optional)"
                        maxLength={100}
                        className="mb-4"
                      />
                      
                      <div className="flex gap-2">
                        <Button
                          onClick={sendGift}
                          loading={loading}
                          disabled={userTokens < selectedGift.cost}
                          className="flex-1"
                        >
                          Send Gift ({selectedGift.cost} tokens)
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setSelectedGift(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Quick Tip Amounts */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Quick Tips</h3>
                <div className="grid grid-cols-3 gap-3">
                  {quickTips.map((tip) => (
                    <Button
                      key={tip.amount}
                      variant="outline"
                      onClick={() => setTipAmount(tip.amount.toString())}
                      className="h-12"
                    >
                      {tip.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom Amount */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Custom Amount</h3>
                <Input
                  type="number"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  placeholder="Enter amount ($)"
                  min="1"
                  step="0.01"
                />
              </div>

              {/* Tip Message */}
              <div>
                <Input
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                  placeholder="Add a message (optional)"
                  maxLength={100}
                />
              </div>

              {/* Send Tip */}
              <Button
                onClick={sendTip}
                loading={loading}
                disabled={!tipAmount || parseFloat(tipAmount) <= 0}
                fullWidth
                size="lg"
              >
                Send ${tipAmount || '0'} Tip
              </Button>
            </div>
          )}

          {/* Recent Gifts */}
          {recentGifts.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-3">Recent Gifts</h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {recentGifts.map((gift, index) => (
                  <div
                    key={index}
                    className="flex-shrink-0 p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-center min-w-[60px]"
                  >
                    <div className="text-lg">{gift.giftEmoji}</div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-400">
                      {gift.cost}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Gift Animations Overlay */}
      <AnimatePresence>
        {giftAnimations.map((animation) => (
          <motion.div
            key={animation.id}
            initial={{ opacity: 0, scale: 0.5, y: 0 }}
            animate={{ 
              opacity: [0, 1, 1, 0], 
              scale: [0.5, 1.2, 1, 0.8], 
              y: -200,
              rotate: [0, 10, -10, 0]
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3, ease: "easeOut" }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
            style={{
              fontSize: '4rem',
              filter: animation.rarity === 'legendary' || animation.rarity === 'mythic' 
                ? 'drop-shadow(0 0 20px rgba(255, 215, 0, 0.8))' 
                : 'none'
            }}
          >
            {animation.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </>
  );
};

export default VirtualGifts;