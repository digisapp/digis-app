import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMobileUI } from './MobileUIProvider';
import MobileCreatorCard from './MobileCreatorCard';
import MobileSkeletons from './MobileSkeletons';
import {
  SparklesIcon,
  VideoCameraIcon,
  HeartIcon,
  StarIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  FireIcon,
  TrophyIcon,
  UserGroupIcon
} from '@heroicons/react/24/solid';

const MobileLandingPage = ({ 
  featuredCreators = [], 
  trendingCreators = [],
  categories = [],
  onCreatorSelect,
  onCategorySelect,
  onSearch,
  isLoading = false
}) => {
  const { triggerHaptic } = useMobileUI();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Hero section animations
  const heroVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' }
    }
  };

  const handleCategorySelect = (category) => {
    setActiveCategory(category.id);
    triggerHaptic?.('light');
    onCategorySelect?.(category);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch?.(searchQuery);
      triggerHaptic?.('success');
    }
  };

  return (
    <div className="mobile-landing-container">
      {/* Hero Section */}
      <motion.section 
        className="mobile-hero-section"
        variants={heroVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="mobile-hero-content">
          <motion.h1 
            className="text-3xl font-bold text-white mb-2"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Connect with Creators
          </motion.h1>
          <motion.p 
            className="text-white/90 text-lg mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Live video calls, exclusive content & more
          </motion.p>
          
          {/* Search Bar */}
          <motion.form 
            onSubmit={handleSearch}
            className="relative"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <input
              type="search"
              placeholder="Search creators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className={`w-full px-5 py-4 pl-12 rounded-2xl bg-white/95 backdrop-blur-sm text-gray-900 placeholder-gray-500 shadow-lg transition-all ${
                isSearchFocused ? 'ring-4 ring-white/30' : ''
              }`}
            />
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            {searchQuery && (
              <motion.button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold"
                whileTap={{ scale: 0.95 }}
              >
                Search
              </motion.button>
            )}
          </motion.form>
        </div>
        
        {/* Hero Background Pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-blue-400/20 to-purple-400/20 rounded-full blur-3xl" />
        </div>
      </motion.section>

      {/* Stats Section */}
      <motion.section 
        className="mobile-stats-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <div className="mobile-stats-grid">
          {isLoading ? (
            <>
              <MobileSkeletons.StatCard />
              <MobileSkeletons.StatCard />
              <MobileSkeletons.StatCard />
            </>
          ) : (
            <>
              <div className="mobile-stat-card">
                <UserGroupIcon className="w-8 h-8 text-purple-500 mb-2" />
                <div className="text-2xl font-bold">10K+</div>
                <div className="text-sm text-gray-600">Active Creators</div>
              </div>
              <div className="mobile-stat-card">
                <VideoCameraIcon className="w-8 h-8 text-blue-500 mb-2" />
                <div className="text-2xl font-bold">50K+</div>
                <div className="text-sm text-gray-600">Live Sessions</div>
              </div>
              <div className="mobile-stat-card">
                <StarIcon className="w-8 h-8 text-yellow-500 mb-2" />
                <div className="text-2xl font-bold">4.9</div>
                <div className="text-sm text-gray-600">Avg Rating</div>
              </div>
            </>
          )}
        </div>
      </motion.section>

      {/* Categories */}
      <section className="px-4 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FireIcon className="w-5 h-5 text-orange-500" />
          Popular Categories
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-2 mobile-scrollbar-hide">
          <motion.button
            onClick={() => handleCategorySelect({ id: 'all', name: 'All' })}
            className={`mobile-category-chip ${activeCategory === 'all' ? 'active' : ''}`}
            whileTap={{ scale: 0.95 }}
          >
            All
          </motion.button>
          {categories.map((category) => (
            <motion.button
              key={category.id}
              onClick={() => handleCategorySelect(category)}
              className={`mobile-category-chip ${activeCategory === category.id ? 'active' : ''}`}
              whileTap={{ scale: 0.95 }}
            >
              {category.icon && <category.icon className="w-4 h-4 mr-1" />}
              {category.name}
            </motion.button>
          ))}
        </div>
      </section>

      {/* Featured Creators */}
      <section className="mb-8">
        <div className="px-4 mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-purple-500" />
            Featured Creators
          </h2>
        </div>
        
        <div className="mobile-horizontal-scroll">
          {isLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="mobile-featured-card-wrapper">
                  <MobileSkeletons.CreatorCard variant="featured" />
                </div>
              ))}
            </>
          ) : featuredCreators.length > 0 ? (
            featuredCreators.map((creator) => (
              <div key={creator.id} className="mobile-featured-card-wrapper">
                <MobileCreatorCard
                  creator={creator}
                  variant="featured"
                  onSelect={() => onCreatorSelect?.(creator)}
                />
              </div>
            ))
          ) : null}
        </div>
      </section>

      {/* Trending Now */}
      {trendingCreators.length > 0 && (
        <section className="px-4 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrophyIcon className="w-5 h-5 text-yellow-500" />
            Trending Now
          </h2>
          
          <div className="space-y-3">
            {trendingCreators.map((creator, index) => (
              <motion.div
                key={creator.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <MobileCreatorCard
                  creator={creator}
                  variant="compact"
                  onSelect={() => onCreatorSelect?.(creator)}
                />
              </motion.div>
            ))}
          </div>
          
          {trendingCreators.length >= 5 && (
            <motion.button
              className="w-full mt-4 py-3 text-purple-600 font-semibold flex items-center justify-center gap-2"
              whileTap={{ scale: 0.98 }}
              onClick={() => onCategorySelect?.({ id: 'trending', name: 'Trending' })}
            >
              View All Trending
              <ChevronRightIcon className="w-4 h-4" />
            </motion.button>
          )}
        </section>
      )}

      {/* Call to Action */}
      <section className="px-4 mb-8">
        <motion.div 
          className="mobile-cta-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <HeartIcon className="w-12 h-12 text-pink-500 mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Become a Creator
          </h3>
          <p className="text-gray-600 mb-4">
            Share your passion and connect with fans worldwide
          </p>
          <button className="mobile-button-primary">
            Start Creating
          </button>
        </motion.div>
      </section>
    </div>
  );
};

export default MobileLandingPage;