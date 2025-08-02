import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ModernCreatorCard from '../components/ModernCreatorCard';
import ModernTokenPurchase from '../components/ModernTokenPurchase';
import ModernSearch from '../components/ModernSearch';
import ModernCreatorGallery from '../components/ModernCreatorGallery';
import { haptic, playSound, confetti } from '../utils/modernUI';

// Mock data
const mockCreators = [
  {
    id: 1,
    username: 'sarahjohnson',
    bio: 'Digital Artist & UI/UX Designer | Creating beautiful experiences',
    profile_pic_url: null,
    videoPrice: 15,
    voicePrice: 10,
    streamPrice: 8,
    messagePrice: 3,
    isLive: true,
    followers: 1250,
    totalSessions: 342,
  },
  {
    id: 2,
    username: 'mikechen',
    bio: 'Music Producer | Teaching electronic music production',
    profile_pic_url: null,
    videoPrice: 20,
    voicePrice: 12,
    streamPrice: 10,
    messagePrice: 5,
    isLive: false,
    followers: 890,
    totalSessions: 215,
  },
  {
    id: 3,
    username: 'alexfitness',
    bio: 'Personal Trainer | Transform your body and mind',
    profile_pic_url: null,
    videoPrice: 12,
    voicePrice: 8,
    streamPrice: 6,
    messagePrice: 2,
    isLive: true,
    followers: 2100,
    totalSessions: 567,
  },
  {
    id: 4,
    username: 'emilycodes',
    bio: 'Full Stack Developer | Learn to code with me',
    profile_pic_url: null,
    videoPrice: 25,
    voicePrice: 15,
    streamPrice: 12,
    messagePrice: 5,
    isLive: false,
    followers: 3200,
    totalSessions: 892,
  },
];

const ModernUIDemo = () => {
  const [showTokenPurchase, setShowTokenPurchase] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [galleryView, setGalleryView] = useState('grid');

  const handleFeatureClick = (feature) => {
    haptic.medium();
    playSound('click');
    
    switch (feature) {
      case 'tokens':
        setShowTokenPurchase(true);
        break;
      case 'search':
        setShowSearch(true);
        break;
      case 'confetti':
        confetti({ particleCount: 200, spread: 70 });
        break;
      default:
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16 px-4"
      >
        <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
          Modern UI Components
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Experience the next generation of UI with React 18, glass morphism, and delightful micro-interactions
        </p>
      </motion.div>

      {/* Features Grid */}
      <div className="container mx-auto px-4 mb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleFeatureClick('tokens')}
            className="p-8 rounded-2xl glass-light dark:glass-dark shadow-xl hover:shadow-2xl transition-all duration-300 text-center"
          >
            <div className="text-4xl mb-4">💎</div>
            <h3 className="text-xl font-bold mb-2">Token Purchase</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Optimistic updates & smooth animations
            </p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleFeatureClick('search')}
            className="p-8 rounded-2xl glass-light dark:glass-dark shadow-xl hover:shadow-2xl transition-all duration-300 text-center"
          >
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-xl font-bold mb-2">AI-Powered Search</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Smart suggestions & instant results
            </p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleFeatureClick('confetti')}
            className="p-8 rounded-2xl glass-light dark:glass-dark shadow-xl hover:shadow-2xl transition-all duration-300 text-center"
          >
            <div className="text-4xl mb-4">🎉</div>
            <h3 className="text-xl font-bold mb-2">Micro-interactions</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Haptic feedback & celebrations
            </p>
          </motion.button>
        </div>
      </div>

      {/* Modern Features List */}
      <div className="container mx-auto px-4 mb-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="p-8 rounded-3xl glass-colored shadow-2xl"
        >
          <h2 className="text-2xl font-bold mb-6">✨ What's New</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: '⚡', title: 'React 18 Concurrent Features', desc: 'useTransition & useDeferredValue for smooth UX' },
              { icon: '🌊', title: 'Glass Morphism', desc: 'Beautiful blur effects with backdrop-filter' },
              { icon: '📱', title: 'Haptic Feedback', desc: 'Physical feedback on mobile devices' },
              { icon: '🎬', title: 'Progressive Images', desc: 'Blur-up loading for better perceived performance' },
              { icon: '👆', title: 'Swipe Gestures', desc: 'Native-like interactions on mobile' },
              { icon: '🎯', title: 'Optimistic Updates', desc: 'Instant feedback before server response' },
              { icon: '🔄', title: 'Scroll Snap', desc: 'Smooth, predictable scrolling' },
              { icon: '🎨', title: 'Modern Animations', desc: 'GPU-accelerated Framer Motion' },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex gap-4"
              >
                <div className="text-2xl">{feature.icon}</div>
                <div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Gallery View Selector */}
      <div className="container mx-auto px-4 mb-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Creator Gallery</h2>
          <div className="flex gap-2">
            {['grid', 'carousel', 'stack'].map((view) => (
              <motion.button
                key={view}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  haptic.light();
                  setGalleryView(view);
                }}
                className={`
                  px-4 py-2 rounded-lg capitalize
                  ${galleryView === view 
                    ? 'bg-purple-500 text-white' 
                    : 'bg-gray-200 dark:bg-gray-800'
                  }
                `}
              >
                {view}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Creator Gallery */}
      <div className="container mx-auto px-4 pb-16">
        <ModernCreatorGallery 
          creators={mockCreators}
          viewMode={galleryView}
        />
      </div>

      {/* Single Card Demo */}
      <div className="container mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold mb-8 text-center">Interactive Creator Card</h2>
        <div className="max-w-sm mx-auto">
          <ModernCreatorCard
            creator={mockCreators[0]}
            showTipButton
            onJoinSession={(type) => {
              confetti({ y: 0.6 });
              console.log('Joining session:', type);
            }}
          />
        </div>
      </div>

      {/* Modals */}
      <ModernTokenPurchase 
        isOpen={showTokenPurchase}
        onClose={() => setShowTokenPurchase(false)}
      />
      
      <ModernSearch
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
      />

      {/* Keyboard shortcut hint */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="fixed bottom-4 right-4 p-4 rounded-xl glass-light dark:glass-dark shadow-xl"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Press <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">⌘K</kbd> to search
        </p>
      </motion.div>
    </div>
  );
};

export default ModernUIDemo;