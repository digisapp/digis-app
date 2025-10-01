import React, { useState, useEffect, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../hooks/useTheme';
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
import { fetchWithRetry, fetchJSONWithRetry } from '../utils/fetchWithRetry';
import toast from 'react-hot-toast';
import socketService from '../utils/socket';

// Memoized Gift Card Component
const GiftCard = memo(({ 
  gift, 
  isSelected, 
  canAfford, 
  onClick, 
  getRarityColor, 
  getRarityGlow, 
  animations 
}) => {
  return (
    <motion.div
      whileHover={animations ? { scale: 1.05 } : {}}
      whileTap={animations ? { scale: 0.95 } : {}}
      onClick={() => canAfford && onClick(gift)}
      className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all ${
        isSelected 
          ? 'ring-2 ring-blue-500 ring-offset-2' 
          : ''
      } ${getRarityColor(gift.rarity)} ${
        canAfford ? 'hover:shadow-lg' : 'opacity-50 cursor-not-allowed'
      }`}
      style={{
        boxShadow: getRarityGlow(gift.rarity)
      }}
      role="button"
      aria-label={`Send ${gift.name} gift for ${gift.cost} tokens`}
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && canAfford && onClick(gift)}
    >
      <div className="text-center">
        <div className="text-4xl mb-2">{gift.emoji}</div>
        <p className="font-medium text-sm">{gift.name}</p>
        <p className="text-xs text-gray-600 mt-1">{gift.cost} tokens</p>
      </div>
      {!canAfford && (
        <div className="absolute inset-0 bg-gray-100 bg-opacity-50 rounded-lg flex items-center justify-center">
          <p className="text-xs font-medium text-gray-600">Not enough tokens</p>
        </div>
      )}
    </motion.div>
  );
});

GiftCard.displayName = 'GiftCard';

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
  // Props validation
  if (!user?.id || !channel) {
    console.error('Missing required props:', { user, channel });
    if (isOpen) {
      toast.error('Invalid user or session');
      onClose?.();
    }
    return null;
  }

  const { animations } = useTheme();
  const [activeTab, setActiveTab] = useState('gifts');
  const [selectedGift, setSelectedGift] = useState(null);
  const [tipAmount, setTipAmount] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [userTokens, setUserTokens] = useState(0);
  const [recentGifts, setRecentGifts] = useState([]);
  const [giftAnimations, setGiftAnimations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [giftCatalog, setGiftCatalog] = useState({ basic: [], premium: [], luxury: [] });

  // Quick tip amounts
  const quickTips = [
    { amount: 1, label: '$1' },
    { amount: 5, label: '$5' },
    { amount: 10, label: '$10' },
    { amount: 25, label: '$25' },
    { amount: 50, label: '$50' },
    { amount: 100, label: '$100' },
  ];

  // Fetch user tokens
  const fetchUserTokens = useCallback(async () => {
    try {
      const authToken = await getAuthToken();
      const data = await fetchJSONWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/api/tokens/balance`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      setUserTokens(data.balance);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      toast.error('Failed to load token balance');
    }
  }, []);

  // Fetch gift catalog from backend
  const fetchGiftCatalog = useCallback(async () => {
    try {
      const authToken = await getAuthToken();
      const data = await fetchJSONWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/api/tokens/catalog`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      
      // Organize gifts by rarity
      const organized = {
        basic: data.filter(g => g.rarity === 'common'),
        premium: data.filter(g => g.rarity === 'rare' || g.rarity === 'epic'),
        luxury: data.filter(g => g.rarity === 'legendary' || g.rarity === 'mythic'),
      };
      
      setGiftCatalog(organized);
    } catch (error) {
      console.error('Error fetching gift catalog:', error);
      toast.error('Failed to load gifts catalog');
      
      // Fallback to default catalog
      const defaultCatalog = {
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
      setGiftCatalog(defaultCatalog);
    }
  }, []);

  useEffect(() => {
    if (user && isOpen) {
      fetchUserTokens();
      fetchGiftCatalog();
    }
  }, [user, isOpen, fetchUserTokens, fetchGiftCatalog]);

  const handleGiftSelect = useCallback((gift) => {
    setSelectedGift(gift);
  }, []);

  const sendGift = async () => {
    if (!selectedGift || userTokens < selectedGift.cost) return;

    setLoading(true);
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/api/stream-features/gift`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            channel,
            creatorId: targetCreator?.id || targetCreator?.supabase_id,
            giftType: selectedGift.id,
            quantity: 1
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Update local state
        setUserTokens(prev => prev - selectedGift.cost);
        setRecentGifts(prev => [
          { ...selectedGift, timestamp: Date.now() }, 
          ...prev.slice(0, 9)
        ]);
        
        // Trigger gift animation
        triggerGiftAnimation(selectedGift);
        
        // Emit socket event for real-time notification
        socketService.emit('gift_sent', {
          channel,
          gift: { ...selectedGift, message: giftMessage },
          sender: { 
            id: user.id, 
            name: user.displayName || user.email?.split('@')[0],
            avatar: user.photoURL
          },
          recipient: targetCreator
        });
        
        // Notify parent component
        onSendGift?.({ 
          ...selectedGift, 
          message: giftMessage,
          sender: {
            id: user.id,
            name: user.displayName || user.email?.split('@')[0],
            avatar: user.photoURL
          }
        });
        
        // Reset form
        setSelectedGift(null);
        setGiftMessage('');
        
        toast.success(`Sent ${selectedGift.name}!`, { icon: selectedGift.emoji });
        
        // Close modal
        onClose();
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send gift');
      }
    } catch (error) {
      console.error('Error sending gift:', error);
      toast.error(error.message || 'Failed to send gift. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendTip = async () => {
    const amount = parseFloat(tipAmount);
    if (!amount || amount <= 0) return;

    setLoading(true);
    try {
      const authToken = await getAuthToken();
      const tokenAmount = Math.ceil(amount / 0.05); // Convert USD to tokens ($0.05 per token)
      
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/api/stream-features/tip`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            channel,
            creatorId: targetCreator?.id || targetCreator?.supabase_id,
            amount: tokenAmount,
            message: giftMessage
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Update token balance
        setUserTokens(prev => prev - tokenAmount);
        
        // Emit socket event for real-time notification
        socketService.emit('tip_sent', {
          channel,
          amount,
          tokenAmount,
          message: giftMessage,
          sender: {
            id: user.id,
            name: user.displayName || user.email?.split('@')[0],
            avatar: user.photoURL
          },
          recipient: targetCreator
        });
        
        // Notify parent component
        onSendTip?.({ 
          amount, 
          tokenAmount,
          message: giftMessage,
          sender: {
            id: user.id,
            name: user.displayName || user.email?.split('@')[0],
            avatar: user.photoURL
          }
        });
        
        // Reset form
        setTipAmount('');
        setGiftMessage('');
        
        toast.success(`Sent ${amount} tokens to ${targetCreator?.displayName || 'creator'}!`, { icon: '🎉' });
        
        // Close modal
        onClose();
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send tip');
      }
    } catch (error) {
      console.error('Error sending tip:', error);
      toast.error(error.message || 'Failed to send tip. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const triggerGiftAnimation = useCallback((gift) => {
    // Limit to 5 concurrent animations for performance
    if (giftAnimations.length >= 5) return;
    
    const animationId = Date.now();
    setGiftAnimations(prev => [
      ...prev, 
      { 
        id: animationId, 
        emoji: gift.emoji, 
        rarity: gift.rarity 
      }
    ].slice(-5));

    // Remove animation after completion
    setTimeout(() => {
      setGiftAnimations(prev => prev.filter(anim => anim.id !== animationId));
    }, 3000);
  }, [giftAnimations.length]);

  const getRarityColor = useCallback((rarity) => {
    switch (rarity) {
      case 'common': return 'border-gray-300 bg-gray-50';
      case 'rare': return 'border-blue-300 bg-blue-50';
      case 'epic': return 'border-purple-300 bg-purple-50';
      case 'legendary': return 'border-yellow-300 bg-yellow-50';
      case 'mythic': return 'border-red-300 bg-red-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  }, []);

  const getRarityGlow = useCallback((rarity) => {
    switch (rarity) {
      case 'legendary': return animations ? '0 0 20px rgba(251, 191, 36, 0.3)' : 'none';
      case 'mythic': return animations ? '0 0 30px rgba(239, 68, 68, 0.4)' : 'none';
      default: return 'none';
    }
  }, [animations]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-2">
          <GiftIcon className="w-6 h-6 text-purple-500" />
          <span>Send Virtual Gift</span>
        </div>
      }
      className="max-w-4xl"
    >
      <div className="p-6">
        {/* User Token Balance */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center px-4 py-2 bg-purple-100 rounded-full">
            <SparklesIcon className="w-5 h-5 text-purple-600 mr-2" />
            <span className="font-medium text-purple-900">
              {userTokens.toLocaleString()} tokens
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b mb-6">
          <button
            onClick={() => setActiveTab('gifts')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'gifts'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            role="tab"
            aria-selected={activeTab === 'gifts'}
            aria-controls="gifts-panel"
          >
            <GiftIcon className="w-4 h-4 inline mr-2" />
            Virtual Gifts
          </button>
          <button
            onClick={() => setActiveTab('tips')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'tips'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            role="tab"
            aria-selected={activeTab === 'tips'}
            aria-controls="tips-panel"
          >
            <CurrencyDollarIcon className="w-4 h-4 inline mr-2" />
            Send Tip
          </button>
        </div>

        {/* Content Panels */}
        <AnimatePresence mode="wait">
          {activeTab === 'gifts' ? (
            <motion.div
              key="gifts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              id="gifts-panel"
              role="tabpanel"
              aria-labelledby="gifts-tab"
            >
              {/* Gift Categories */}
              <div className="space-y-6">
                {/* Basic Gifts */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Basic Gifts</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {giftCatalog.basic.map(gift => (
                      <GiftCard
                        key={gift.id}
                        gift={gift}
                        isSelected={selectedGift?.id === gift.id}
                        canAfford={userTokens >= gift.cost}
                        onClick={handleGiftSelect}
                        getRarityColor={getRarityColor}
                        getRarityGlow={getRarityGlow}
                        animations={animations}
                      />
                    ))}
                  </div>
                </div>

                {/* Premium Gifts */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Premium Gifts</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {giftCatalog.premium.map(gift => (
                      <GiftCard
                        key={gift.id}
                        gift={gift}
                        isSelected={selectedGift?.id === gift.id}
                        canAfford={userTokens >= gift.cost}
                        onClick={handleGiftSelect}
                        getRarityColor={getRarityColor}
                        getRarityGlow={getRarityGlow}
                        animations={animations}
                      />
                    ))}
                  </div>
                </div>

                {/* Luxury Gifts */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Luxury Gifts</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {giftCatalog.luxury.map(gift => (
                      <GiftCard
                        key={gift.id}
                        gift={gift}
                        isSelected={selectedGift?.id === gift.id}
                        canAfford={userTokens >= gift.cost}
                        onClick={handleGiftSelect}
                        getRarityColor={getRarityColor}
                        getRarityGlow={getRarityGlow}
                        animations={animations}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Gift Message */}
              {selectedGift && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-6"
                >
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Add a message (optional):
                    </p>
                    <Input
                      value={giftMessage}
                      onChange={(e) => setGiftMessage(e.target.value)}
                      placeholder="Your message here..."
                      maxLength={100}
                      className="mb-4"
                    />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">
                          Sending: <span className="font-medium">{selectedGift.emoji} {selectedGift.name}</span>
                        </p>
                        <p className="text-sm text-gray-600">
                          Cost: <span className="font-medium">{selectedGift.cost} tokens</span>
                        </p>
                      </div>
                      <Button
                        onClick={sendGift}
                        disabled={loading || userTokens < selectedGift.cost}
                        loading={loading}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        Send Gift
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="tips"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              id="tips-panel"
              role="tabpanel"
              aria-labelledby="tips-tab"
            >
              {/* Quick Tip Amounts */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {quickTips.map(({ amount, label }) => (
                  <Button
                    key={amount}
                    onClick={() => setTipAmount(amount.toString())}
                    variant={tipAmount === amount.toString() ? 'primary' : 'outline'}
                    className="py-3"
                  >
                    {label}
                  </Button>
                ))}
              </div>

              {/* Custom Amount */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Amount
                </label>
                <div className="relative">
                  <CurrencyDollarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="number"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="pl-10"
                  />
                </div>
                {tipAmount && (
                  <p className="text-sm text-gray-600 mt-1">
                    ≈ {Math.ceil(parseFloat(tipAmount) / 0.05)} tokens
                  </p>
                )}
              </div>

              {/* Tip Message */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add a message (optional):
                </label>
                <Input
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                  placeholder="Great stream! Keep it up!"
                  maxLength={100}
                />
              </div>

              {/* Send Tip Button */}
              <Button
                onClick={sendTip}
                disabled={loading || !tipAmount || parseFloat(tipAmount) <= 0}
                loading={loading}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                Send ${tipAmount || '0'} Tip
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent Gifts */}
        {recentGifts.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Gifts</h3>
            <div className="flex flex-wrap gap-2">
              {recentGifts.map((gift, index) => (
                <motion.div
                  key={`${gift.id}-${gift.timestamp}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="text-2xl"
                  title={gift.name}
                >
                  {gift.emoji}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Gift Animations Overlay */}
      <AnimatePresence>
        {giftAnimations.map((anim) => (
          <motion.div
            key={anim.id}
            initial={{ 
              opacity: 0, 
              scale: 0.5, 
              x: Math.random() * 200 - 100,
              y: 100 
            }}
            animate={{ 
              opacity: [0, 1, 1, 0], 
              scale: [0.5, 1.2, 1, 0.8],
              y: [-100, -200, -300, -400]
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3, ease: 'easeOut' }}
            className="fixed pointer-events-none text-6xl"
            style={{
              left: '50%',
              bottom: '50%',
              transform: 'translateX(-50%)',
              filter: anim.rarity === 'mythic' ? 'drop-shadow(0 0 20px rgba(239, 68, 68, 0.6))' : 
                     anim.rarity === 'legendary' ? 'drop-shadow(0 0 15px rgba(251, 191, 36, 0.6))' : 
                     'none'
            }}
          >
            {anim.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </Modal>
  );
};

export default VirtualGifts;