import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GiftIcon, 
  SparklesIcon,
  FireIcon,
  TrophyIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { HeartIcon, StarIcon } from '@heroicons/react/24/solid';
import soundManager from '../utils/soundManager';
import toast from 'react-hot-toast';

// Updated gift catalog with new gifts
const GIFT_CATALOG = [
  { id: 'rose', name: 'Rose', emoji: '🌹', cost: 200, rarity: 'common', animation: 'floating-roses' },
  { id: 'bouquet', name: 'Bouquet', emoji: '💐', cost: 500, rarity: 'common', animation: 'flower-burst' },
  { id: 'cake', name: 'Cake', emoji: '🎂', cost: 1000, rarity: 'rare', animation: 'birthday-celebration' },
  { id: 'shopping', name: 'Shopping Bag', emoji: '🛍️', cost: 1500, rarity: 'rare', animation: 'shopping-spree' },
  { id: 'gold', name: 'Gold Bar', emoji: '🪙', cost: 2000, rarity: 'epic', animation: 'gold-rain' },
  { id: 'purse', name: 'Designer Purse', emoji: '👛', cost: 3500, rarity: 'epic', animation: 'luxury-shine' },
  { id: 'diamond', name: 'Diamond', emoji: '💎', cost: 5000, rarity: 'legendary', animation: 'diamond-sparkle' },
  { id: 'car', name: 'Sports Car', emoji: '🚗', cost: 7000, rarity: 'legendary', animation: 'car-drive' },
  { id: 'castle', name: 'Castle', emoji: '🏰', cost: 10000, rarity: 'mythic', animation: 'castle-build' },
  { id: 'rocket', name: 'Rocket', emoji: '🚀', cost: 25000, rarity: 'mythic', animation: 'rocket-launch' }
];

const StreamingGiftDisplay = ({ 
  user,
  channel,
  isCreator,
  onSendGift,
  onSendTip,
  streamStats = {},
  className = ''
}) => {
  const [showGiftMenu, setShowGiftMenu] = useState(false);
  const [recentGifts, setRecentGifts] = useState([]);
  const [topGifters, setTopGifters] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.5);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [activeAnimation, setActiveAnimation] = useState(null);
  const [creatorReaction, setCreatorReaction] = useState(null);
  const tickerRef = useRef(null);
  const animationTimeoutRef = useRef(null);

  // Initialize sound manager
  useEffect(() => {
    soundManager.setVolume(soundVolume);
    if (soundEnabled) {
      soundManager.enable();
    } else {
      soundManager.disable();
    }
  }, [soundVolume, soundEnabled]);

  // Handle receiving a gift
  const handleGiftReceived = (giftData) => {
    // Add to recent gifts
    setRecentGifts(prev => [giftData, ...prev].slice(0, 10));
    
    // Play sound based on gift rarity
    const gift = GIFT_CATALOG.find(g => g.id === giftData.giftId);
    if (gift) {
      soundManager.playGiftSound(gift.rarity);
      
      // Trigger animation for luxury gifts
      if (['legendary', 'mythic'].includes(gift.rarity)) {
        triggerLuxuryAnimation(gift);
      }
    }
    
    // Update top gifters
    updateTopGifters(giftData);
  };

  // Handle receiving a tip
  const handleTipReceived = (tipData) => {
    // Add to recent gifts as a tip
    setRecentGifts(prev => [{
      ...tipData,
      type: 'tip',
      emoji: '💰',
      name: `$${(tipData.amount * 0.05).toFixed(2)} Tip`
    }, ...prev].slice(0, 10));
    
    // Play tip sound
    soundManager.playTipSound(tipData.amount);
    
    // Update top gifters
    updateTopGifters(tipData);
  };

  // Trigger luxury gift animations
  const triggerLuxuryAnimation = (gift) => {
    setActiveAnimation(gift.animation);
    
    // Clear previous timeout
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    
    // Auto-hide animation after duration
    const duration = gift.rarity === 'mythic' ? 10000 : 5000;
    animationTimeoutRef.current = setTimeout(() => {
      setActiveAnimation(null);
    }, duration);
  };

  // Update top gifters leaderboard
  const updateTopGifters = (giftData) => {
    setTopGifters(prev => {
      const updated = [...prev];
      const existingIndex = updated.findIndex(g => g.userId === giftData.senderId);
      
      if (existingIndex >= 0) {
        updated[existingIndex].totalValue += giftData.amount || giftData.cost;
        updated[existingIndex].giftCount += 1;
      } else {
        updated.push({
          userId: giftData.senderId,
          userName: giftData.senderName,
          userAvatar: giftData.senderAvatar,
          totalValue: giftData.amount || giftData.cost,
          giftCount: 1
        });
      }
      
      // Sort by total value and keep top 5
      return updated.sort((a, b) => b.totalValue - a.totalValue).slice(0, 5);
    });
  };

  // Gift carousel navigation
  const nextCarousel = () => {
    setCarouselIndex((prev) => (prev + 4) % GIFT_CATALOG.length);
  };

  const prevCarousel = () => {
    setCarouselIndex((prev) => (prev - 4 + GIFT_CATALOG.length) % GIFT_CATALOG.length);
  };

  // Get visible gifts in carousel
  const visibleGifts = GIFT_CATALOG.slice(carouselIndex, carouselIndex + 4);

  // Creator quick reactions
  const CREATOR_REACTIONS = ['❤️', '😍', '🙏', '🎉', '🔥', '💯'];

  const sendCreatorReaction = (emoji) => {
    setCreatorReaction(emoji);
    setTimeout(() => setCreatorReaction(null), 3000);
    
    // Emit reaction via socket
    if (window.socket) {
      window.socket.emit('creator_reaction', {
        channel,
        reaction: emoji
      });
    }
  };

  return (
    <div className={`streaming-gift-display ${className}`}>
      {/* Floating Gift Button with Pulse Animation */}
      {!isCreator && (
        <motion.button
          className="fixed bottom-24 right-6 z-50 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full p-4 shadow-xl"
          animate={{
            scale: [1, 1.1, 1],
            boxShadow: [
              '0 0 0 0 rgba(168, 85, 247, 0.4)',
              '0 0 0 20px rgba(168, 85, 247, 0)',
              '0 0 0 0 rgba(168, 85, 247, 0)'
            ]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: 'loop'
          }}
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowGiftMenu(true)}
        >
          <GiftIcon className="w-8 h-8" />
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center animate-bounce">
            {GIFT_CATALOG.length}
          </span>
        </motion.button>
      )}

      {/* Gift Carousel at Bottom */}
      {!isCreator && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40 bg-black/80 backdrop-blur-sm rounded-full px-6 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={prevCarousel}
              className="text-white/70 hover:text-white transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            
            <div className="flex gap-3">
              {visibleGifts.map((gift) => (
                <motion.button
                  key={gift.id}
                  whileHover={{ scale: 1.2, y: -5 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    onSendGift?.(gift);
                    handleGiftReceived({
                      giftId: gift.id,
                      ...gift,
                      senderId: user?.id,
                      senderName: user?.displayName || 'Anonymous',
                      timestamp: Date.now()
                    });
                  }}
                  className="relative group"
                >
                  <div className="text-3xl">{gift.emoji}</div>
                  <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {gift.name} • {gift.cost} tokens
                  </div>
                </motion.button>
              ))}
            </div>
            
            <button
              onClick={nextCarousel}
              className="text-white/70 hover:text-white transition-colors"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Recent Gifts Ticker */}
      <div className="fixed top-20 left-0 right-0 z-30 overflow-hidden h-10">
        <div 
          ref={tickerRef}
          className="flex gap-4 animate-scroll-left"
          style={{
            animation: 'scroll-left 20s linear infinite'
          }}
        >
          {recentGifts.concat(recentGifts).map((gift, index) => (
            <div
              key={`${gift.timestamp}-${index}`}
              className="flex items-center gap-2 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full whitespace-nowrap"
            >
              <span className="text-lg">{gift.emoji}</span>
              <span className="text-sm font-medium">{gift.senderName}</span>
              <span className="text-xs opacity-70">sent {gift.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gift Leaderboard */}
      <div className="fixed top-32 right-4 z-30 bg-black/80 backdrop-blur-sm rounded-lg p-4 min-w-[200px]">
        <div className="flex items-center gap-2 mb-3">
          <TrophyIcon className="w-5 h-5 text-yellow-400" />
          <h3 className="text-white font-semibold">Top Gifters</h3>
        </div>
        <div className="space-y-2">
          {topGifters.map((gifter, index) => (
            <div key={gifter.userId} className="flex items-center gap-2 text-white">
              <span className="text-lg">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
              </span>
              <img 
                src={gifter.userAvatar || '/default-avatar.png'} 
                alt={gifter.userName}
                className="w-6 h-6 rounded-full"
              />
              <span className="text-sm flex-1 truncate">{gifter.userName}</span>
              <span className="text-xs text-yellow-400">{gifter.totalValue}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Creator Quick Reactions */}
      {isCreator && (
        <div className="fixed bottom-4 left-4 z-40 bg-black/80 backdrop-blur-sm rounded-full px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm mr-2">React:</span>
            {CREATOR_REACTIONS.map((emoji) => (
              <motion.button
                key={emoji}
                whileHover={{ scale: 1.3 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => sendCreatorReaction(emoji)}
                className="text-2xl hover:bg-white/10 rounded p-1 transition-colors"
              >
                {emoji}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Sound Controls for Creator */}
      {isCreator && (
        <div className="fixed top-20 left-4 z-30 bg-black/80 backdrop-blur-sm rounded-lg p-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="text-white hover:text-purple-400 transition-colors"
            >
              {soundEnabled ? (
                <SpeakerWaveIcon className="w-5 h-5" />
              ) : (
                <SpeakerXMarkIcon className="w-5 h-5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={soundVolume * 100}
              onChange={(e) => setSoundVolume(e.target.value / 100)}
              className="w-24 accent-purple-500"
              disabled={!soundEnabled}
            />
          </div>
        </div>
      )}

      {/* Creator Reaction Display */}
      <AnimatePresence>
        {creatorReaction && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 text-8xl"
          >
            {creatorReaction}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Luxury Gift Animations */}
      <AnimatePresence>
        {activeAnimation && (
          <GiftAnimation type={activeAnimation} />
        )}
      </AnimatePresence>

      <style jsx>{`
        @keyframes scroll-left {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
};

// Gift Animation Component
const GiftAnimation = ({ type }) => {
  const animations = {
    'flower-burst': (
      <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
        <motion.div
          className="absolute"
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.5, 1.2] }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative">
            {/* Center bouquet */}
            <motion.div
              className="text-[120px] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 1, repeat: 2 }}
            >
              💐
            </motion.div>
            {/* Bursting flowers in circle */}
            {['🌸', '🌺', '🌻', '🌷', '🌹', '🌼', '🌵', '🌾'].map((flower, i) => {
              const angle = (i * 45) * Math.PI / 180;
              const distance = 200;
              return (
                <motion.div
                  key={i}
                  className="absolute text-5xl"
                  initial={{ 
                    x: 0, 
                    y: 0,
                    opacity: 0
                  }}
                  animate={{
                    x: Math.cos(angle) * distance,
                    y: Math.sin(angle) * distance,
                    opacity: [0, 1, 1, 0],
                    rotate: 360,
                    scale: [0, 1.2, 1, 0.5]
                  }}
                  transition={{
                    duration: 2,
                    delay: i * 0.05,
                    ease: "easeOut"
                  }}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  {flower}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
        {/* Petal particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={`petal-${i}`}
            className="absolute text-2xl"
            initial={{
              x: window.innerWidth / 2,
              y: window.innerHeight / 2,
              opacity: 0
            }}
            animate={{
              x: window.innerWidth / 2 + (Math.random() - 0.5) * 600,
              y: window.innerHeight / 2 + (Math.random() - 0.5) * 400,
              opacity: [0, 1, 0],
              rotate: Math.random() * 720
            }}
            transition={{
              duration: 3,
              delay: 0.5 + i * 0.05,
              ease: "easeOut"
            }}
          >
            🌸
          </motion.div>
        ))}
      </div>
    ),
    'shopping-spree': (
      <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
        {/* Main shopping bag bounce */}
        <motion.div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[150px]"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ 
            scale: [0, 1.3, 1], 
            rotate: [180, 0],
            y: [0, -20, 0]
          }}
          transition={{ 
            duration: 1,
            y: {
              duration: 2,
              repeat: 2,
              ease: "easeInOut"
            }
          }}
        >
          🛍️
        </motion.div>
        {/* Cascading shopping items */}
        {['👗', '👠', '👜', '💄', '💍', '🎁', '👔', '⌚'].map((item, i) => (
          <motion.div
            key={i}
            className="absolute text-4xl"
            initial={{
              x: Math.random() * window.innerWidth,
              y: -100,
              rotate: Math.random() * 360
            }}
            animate={{
              y: window.innerHeight + 100,
              rotate: Math.random() * 720,
              x: `${Math.random() * 200 - 100}px`
            }}
            transition={{
              duration: 2 + Math.random(),
              delay: i * 0.2,
              ease: "easeIn"
            }}
          >
            {item}
          </motion.div>
        ))}
        {/* Price tags floating */}
        {['SALE', '50%', 'VIP', 'LUXURY'].map((tag, i) => (
          <motion.div
            key={`tag-${i}`}
            className="absolute bg-pink-500 text-white px-3 py-1 rounded-full font-bold"
            initial={{
              x: window.innerWidth / 2 + (i - 1.5) * 100,
              y: window.innerHeight / 2,
              opacity: 0,
              scale: 0
            }}
            animate={{
              y: window.innerHeight / 2 - 100,
              opacity: [0, 1, 1, 0],
              scale: [0, 1.2, 1, 0],
              rotate: [0, 10, -10, 0]
            }}
            transition={{
              duration: 2,
              delay: 0.5 + i * 0.1
            }}
          >
            {tag}
          </motion.div>
        ))}
      </div>
    ),
    'gold-rain': (
      <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
        {/* Central gold bar */}
        <motion.div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[180px]"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: [0, 1.2, 1],
            opacity: 1,
            rotate: [0, 360]
          }}
          transition={{ duration: 1 }}
          style={{
            filter: 'drop-shadow(0 0 30px gold)'
          }}
        >
          🪙
        </motion.div>
        {/* Golden rain effect */}
        {[...Array(40)].map((_, i) => {
          const isGold = i % 3 === 0;
          const emoji = isGold ? '🪙' : '✨';
          return (
            <motion.div
              key={i}
              className={`absolute ${isGold ? 'text-5xl' : 'text-3xl'}`}
              initial={{
                x: Math.random() * window.innerWidth,
                y: -50,
                rotate: 0,
                opacity: 1
              }}
              animate={{
                y: window.innerHeight + 50,
                rotate: 360,
                scale: isGold ? [1, 1.2, 1] : [1, 0.8, 1],
                opacity: [1, 1, 0.3]
              }}
              transition={{
                duration: isGold ? 2.5 : 3,
                delay: i * 0.05,
                ease: "easeIn",
                rotate: {
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear"
                }
              }}
              style={{
                filter: isGold ? 'drop-shadow(0 0 10px gold)' : 'none'
              }}
            >
              {emoji}
            </motion.div>
          );
        })}
        {/* Gold text effect */}
        <motion.div
          className="absolute top-1/3 left-1/2 transform -translate-x-1/2 text-6xl font-bold text-yellow-400"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ 
            opacity: [0, 1, 1, 0],
            scale: [0, 1.5, 1, 0]
          }}
          transition={{ 
            duration: 2,
            delay: 0.5
          }}
          style={{
            textShadow: '0 0 20px gold, 0 0 40px gold',
            fontFamily: 'serif'
          }}
        >
          GOLDEN!
        </motion.div>
      </div>
    ),
    'luxury-shine': (
      <div className="fixed inset-0 z-[100] pointer-events-none">
        {/* Central purse with shine effect */}
        <motion.div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        >
          <motion.div
            className="text-[160px] relative"
            initial={{ scale: 0, rotate: -45 }}
            animate={{ 
              scale: [0, 1.1, 1],
              rotate: [-45, 0]
            }}
            transition={{ duration: 1 }}
          >
            👛
            {/* Shine sweep effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-60"
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{
                duration: 1,
                delay: 0.5,
                repeat: 3,
                ease: "easeInOut"
              }}
              style={{
                mixBlendMode: 'screen'
              }}
            />
          </motion.div>
        </motion.div>
        {/* Luxury sparkles in spiral pattern */}
        {[...Array(30)].map((_, i) => {
          const angle = (i * 12) * Math.PI / 180;
          const radius = i * 15;
          const sparkle = ['💎', '✨', '⭐', '💫'][i % 4];
          return (
            <motion.div
              key={i}
              className="absolute text-3xl"
              initial={{
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
                opacity: 0,
                scale: 0
              }}
              animate={{
                x: window.innerWidth / 2 + Math.cos(angle * i * 0.1) * radius,
                y: window.innerHeight / 2 + Math.sin(angle * i * 0.1) * radius,
                opacity: [0, 1, 0.8, 0],
                scale: [0, 1, 0.5],
                rotate: 360
              }}
              transition={{
                duration: 2.5,
                delay: i * 0.03,
                ease: "easeOut"
              }}
            >
              {sparkle}
            </motion.div>
          );
        })}
        {/* Luxury brand text */}
        <motion.div
          className="absolute top-2/3 left-1/2 transform -translate-x-1/2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ 
            opacity: [0, 1, 1, 0],
            y: [20, 0, 0, -20]
          }}
          transition={{ duration: 2, delay: 0.5 }}
        >
          <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent"
               style={{ letterSpacing: '0.2em' }}>
            LUXURY
          </div>
        </motion.div>
        {/* Floating diamonds around */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={`diamond-${i}`}
            className="absolute text-4xl"
            initial={{
              x: window.innerWidth / 2,
              y: window.innerHeight / 2
            }}
            animate={{
              x: window.innerWidth / 2 + Math.cos((i * 45) * Math.PI / 180) * 250,
              y: window.innerHeight / 2 + Math.sin((i * 45) * Math.PI / 180) * 250,
              scale: [0, 1, 1.2, 1],
              rotate: [0, 180, 360]
            }}
            transition={{
              duration: 2,
              delay: 1 + i * 0.1,
              ease: "easeOut"
            }}
          >
            💎
          </motion.div>
        ))}
      </div>
    ),
    'diamond-sparkle': (
      <div className="fixed inset-0 z-[100] pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-4xl"
            initial={{
              x: Math.random() * window.innerWidth,
              y: -50,
              rotate: 0
            }}
            animate={{
              y: window.innerHeight + 50,
              rotate: 360,
              scale: [1, 1.5, 1]
            }}
            transition={{
              duration: 3,
              delay: i * 0.1,
              ease: "easeInOut"
            }}
          >
            💎
          </motion.div>
        ))}
      </div>
    ),
    'rocket-launch': (
      <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
        <motion.div
          className="text-[200px]"
          initial={{ y: window.innerHeight, x: 0, rotate: -45 }}
          animate={{ 
            y: -300,
            x: 100,
            rotate: -45
          }}
          transition={{ duration: 5, ease: "easeOut" }}
        >
          🚀
        </motion.div>
        <motion.div
          className="absolute bottom-0 left-1/2 transform -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          <div className="text-white text-4xl font-bold">BLAST OFF!</div>
        </motion.div>
      </div>
    ),
    'castle-build': (
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 z-[100] pointer-events-none">
        <motion.div
          className="text-[300px]"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 2, ease: "backOut" }}
        >
          🏰
        </motion.div>
      </div>
    ),
    'car-drive': (
      <motion.div
        className="fixed bottom-20 z-[100] pointer-events-none text-[100px]"
        initial={{ x: -200 }}
        animate={{ x: window.innerWidth + 200 }}
        transition={{ duration: 3, ease: "linear" }}
      >
        🚗
      </motion.div>
    ),
    'birthday-celebration': (
      <div className="fixed inset-0 z-[100] pointer-events-none">
        <motion.div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[150px]"
          initial={{ scale: 0, rotate: 0 }}
          animate={{ scale: [0, 1.2, 1], rotate: [0, 10, -10, 0] }}
          transition={{ duration: 1 }}
        >
          🎂
        </motion.div>
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-2xl"
            initial={{
              x: window.innerWidth / 2,
              y: window.innerHeight / 2
            }}
            animate={{
              x: window.innerWidth / 2 + (Math.random() - 0.5) * 400,
              y: window.innerHeight / 2 + (Math.random() - 0.5) * 400,
              scale: [0, 1, 0]
            }}
            transition={{
              duration: 2,
              delay: i * 0.05
            }}
          >
            🎉
          </motion.div>
        ))}
      </div>
    ),
    'floating-roses': (
      <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-5xl"
            initial={{
              x: Math.random() * window.innerWidth,
              y: window.innerHeight + 100,
              rotate: Math.random() * 360
            }}
            animate={{
              y: -100,
              x: `${Math.random() * 200 - 100}px`,
              rotate: Math.random() * 720
            }}
            transition={{
              duration: 4 + Math.random() * 2,
              delay: i * 0.2,
              ease: "easeOut"
            }}
          >
            🌹
          </motion.div>
        ))}
      </div>
    )
  };

  return animations[type] || null;
};

export default StreamingGiftDisplay;