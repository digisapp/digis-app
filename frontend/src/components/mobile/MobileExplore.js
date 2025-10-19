import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { getDefaultAvatarUrl } from '../../utils/avatarHelpers';
import { isSelf } from '../../utils/creatorFilters';
import MobileCreatorCard from './MobileCreatorCard';
import { apiClient } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  StarIcon,
  HeartIcon,
  EyeIcon,
  VideoCameraIcon,
  SparklesIcon,
  FireIcon,
  TrophyIcon,
  XMarkIcon,
  CheckIcon,
  MapPinIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  FunnelIcon,
  ArrowTrendingUpIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { UserGroupIcon as UserGroupIconSolid, PhotoIcon as PhotoIconSolid } from '@heroicons/react/24/solid';

const MobileExplore = ({ user, onNavigate, onCreatorSelect }) => {
  const navigate = useNavigate();

  // Auth state - gate data fetches behind auth resolution to prevent API hammering during bootstrap
  const { authLoading, roleResolved } = useAuth();
  const authReady = !authLoading && roleResolved;

  // Pull to refresh states
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const mountedRef = useRef(true);
  const creatorsAbortRef = useRef(null);
  const pageRef = useRef(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [showCategories, setShowCategories] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all', 'trending', 'new', 'popular'
  const [error, setError] = useState(null);
  
  const [filters, setFilters] = useState({
    priceRange: 'all',
    location: '',
    verified: false,
    online: false,
    hasContent: false
  });

  // Creators data from API
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filter buttons like on mobile fan dashboard
  const filterButtons = [
    { id: 'trending', label: 'Trending', icon: FireIcon, color: 'text-red-500' },
    { id: 'new', label: 'New', icon: StarIcon, color: 'text-yellow-500' },
    { id: 'popular', label: 'Popular', icon: TrophyIcon, color: 'text-purple-500' }
  ];

  const categories = [
    { id: 'all', name: 'All', icon: SparklesIcon },
    { id: 'Lifestyle', name: 'Lifestyle', icon: HeartIcon },
    { id: 'Model', name: 'Model', icon: StarIcon },
    { id: 'Art', name: 'Art', icon: SparklesIcon },
    { id: 'Gaming', name: 'Gaming', icon: TrophyIcon },
    { id: 'Music', name: 'Music', icon: SparklesIcon },
    { id: 'Fashion', name: 'Fashion', icon: SparklesIcon },
    { id: 'Fitness', name: 'Fitness', icon: HeartIcon },
    { id: 'Food', name: 'Food & Cooking', icon: SparklesIcon },
    { id: 'Travel', name: 'Travel', icon: SparklesIcon },
    { id: 'Education', name: 'Education', icon: SparklesIcon },
    { id: 'Comedy', name: 'Comedy', icon: SparklesIcon },
    { id: 'Sports', name: 'Sports', icon: TrophyIcon },
    { id: 'Tech', name: 'Technology', icon: SparklesIcon },
    { id: 'Beauty', name: 'Beauty', icon: SparklesIcon },
    { id: 'Wellness', name: 'Wellness', icon: SparklesIcon },
    { id: 'ASMR', name: 'ASMR', icon: SparklesIcon }
  ];


  const priceRanges = [
    { id: 'all', name: 'All Prices' },
    { id: 'free', name: 'Free' },
    { id: 'budget', name: 'Budget (< 10 tokens)' },
    { id: 'mid', name: 'Mid (10-50 tokens)' },
    { id: 'premium', name: 'Premium (50+ tokens)' }
  ];

  // Fetch creators from API with abort controller
  const fetchCreators = useCallback(async (pageNum = 1, append = false) => {
    // Create controller outside try block so it's accessible in catch
    let controller = null;

    try {
      // Cancel any in-flight request
      if (creatorsAbortRef.current) {
        creatorsAbortRef.current.abort();
      }

      controller = new AbortController();
      creatorsAbortRef.current = controller;

      setLoadingMore(append);
      setLoading(!append);
      setError(null);

      // IMPORTANT: Pass excludeUserId to prevent self-discovery at API level
      const params = {
        page: pageNum,
        limit: 20,
        category: selectedCategory
      };

      if (user?.id) {
        params.excludeUserId = user.id;
      }

      const { data } = await apiClient.get('/api/users/creators', {
        params,
        signal: controller.signal
      });

        if (data.creators && data.creators.length > 0) {
          const formattedCreators = data.creators.map(creator => ({
            id: creator.id || creator.uid || creator.user_id,
            name: creator.display_name || creator.displayName || creator.username || 'Unknown',
            username: creator.username || creator.display_name?.toLowerCase().replace(/\s+/g, '') || 'unknown',
            avatar: creator.profile_pic_url || creator.profilePicUrl || creator.avatar_url || getDefaultAvatarUrl(creator.display_name || creator.username || 'User', 150),
            banner: creator.cover_image_url || creator.banner_url || getDefaultAvatarUrl(creator.display_name || creator.username || 'User', 400),
            category: creator.creator_type || creator.category || 'other',
            bio: creator.bio || 'No bio available',
            isVerified: creator.is_verified || creator.isVerified || false,
            isOnline: creator.is_online || creator.isOnline || false,
            isPremium: creator.is_premium || creator.isPremium || false,
            followers: creator.follower_count || creator.followers_count || Math.floor(Math.random() * 10000),
            contentCount: creator.content_count || 0,
            messagePrice: creator.message_price || creator.messagePrice || creator.text_message_price || 5,
            callPrice: creator.voice_price || creator.voicePrice || creator.voice_rate || 30,
            videoCallPrice: creator.video_price || creator.videoPrice || creator.video_rate || 50,
            location: creator.location || creator.city || '',
            tags: creator.tags || []
          }));

          if (mountedRef.current) {
            if (append) {
              setCreators(prev => [...prev, ...formattedCreators]);
            } else {
              setCreators(formattedCreators);
            }
          }
        }

        if (mountedRef.current) {
          setHasMore(data.hasMore !== false);
          setPage(pageNum);
          pageRef.current = pageNum;
        }

        // Clear the abort controller reference after successful completion
        if (creatorsAbortRef.current === controller) {
          creatorsAbortRef.current = null;
        }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching creators:', error);
        // Set user-facing error message
        if (mountedRef.current) {
          setError('Failed to load creators. Please try again.');
        }
      }
      // Clear the abort controller reference on error
      if (creatorsAbortRef.current === controller) {
        creatorsAbortRef.current = null;
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [selectedCategory]);

  // Load creators on mount and when category changes with cleanup - GATED behind auth resolution
  useEffect(() => {
    // Don't fetch until auth is ready - prevents API hammering during bootstrap
    if (!authReady) {
      console.log('⏳ MobileExplore: Waiting for auth to resolve before fetching creators');
      return;
    }

    console.log('✅ MobileExplore: Auth ready, fetching creators');

    mountedRef.current = true;
    fetchCreators(1, false);

    return () => {
      mountedRef.current = false;
      if (creatorsAbortRef.current) {
        creatorsAbortRef.current.abort();
      }
    };
  }, [selectedCategory, fetchCreators, authReady]); // Only fetch when auth is ready

  // Filter creators based on search and filters
  const filteredCreators = creators.filter(creator => {
    // IMPORTANT: Filter out the logged-in user's own creator card
    // Creators should not see themselves in the Explore page
    const currentUserId = user?.id;
    const currentUsername = user?.username;
    if (isSelf(creator, currentUserId, currentUsername)) {
      return false;
    }

    const matchesSearch = searchQuery === '' ||
                         creator.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         creator.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         creator.bio?.toLowerCase().includes(searchQuery.toLowerCase());

    // More flexible category matching
    const matchesCategory = selectedCategory === 'all' ||
                           creator.category === selectedCategory ||
                           creator.category?.toLowerCase() === selectedCategory.toLowerCase();

    const matchesFilters =
      (!filters.verified || creator.isVerified) &&
      (!filters.online || creator.isOnline) &&
      (!filters.hasContent || creator.contentCount > 0);

    return matchesSearch && matchesCategory && matchesFilters;
  });

  // Apply sorting based on selected filter
  const sortedCreators = [...filteredCreators].sort((a, b) => {
    switch (selectedFilter) {
      case 'trending':
        // Sort by followers + content count (trending = most popular currently)
        return (b.followers + b.contentCount) - (a.followers + a.contentCount);
      case 'new':
        // New creators - could be based on join date, for now use reverse order
        return 0; // Keep original order for now (would need created_at field)
      case 'popular':
        // Sort by followers
        return b.followers - a.followers;
      default:
        return 0; // Keep original order
    }
  });

  const handleCreatorClick = (creator) => {
    // Haptic feedback on tap
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    // Navigate to creator's public profile page using vanity URL
    navigate(`/${creator.username}`);
  };

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCreators(1, false);
    setRefreshing(false);
  }, [fetchCreators]);

  // Touch handlers for pull-to-refresh
  const handleTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e) => {
    const touchY = e.touches[0].clientY;
    const diff = touchY - touchStartY.current;
    
    if (diff > 0 && window.scrollY === 0) {
      isPulling.current = true;
      setPullDistance(Math.min(diff * 0.5, 80));
      
      if (diff > 80 && !refreshing) {
        if ('vibrate' in navigator) {
          navigator.vibrate(10);
        }
      }
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(() => {
    if (isPulling.current && pullDistance > 60 && !refreshing) {
      handleRefresh();
    }
    isPulling.current = false;
    setPullDistance(0);
  }, [pullDistance, refreshing, handleRefresh]);

  // Infinite scroll handler with throttling - using refs to avoid dependency issues
  const fetchCreatorsRef = useRef(fetchCreators);
  fetchCreatorsRef.current = fetchCreators;

  const handleScroll = useCallback(() => {
    if (!mountedRef.current) return;

    const scrollHeight = document.documentElement.scrollHeight;
    const scrollTop = document.documentElement.scrollTop;
    const clientHeight = document.documentElement.clientHeight;

    if (scrollTop + clientHeight >= scrollHeight - 100 && !loadingMore && hasMore) {
      fetchCreatorsRef.current(pageRef.current + 1, true);
    }
  }, [loadingMore, hasMore]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 pb-4"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to Refresh Indicator */}
      <motion.div
        className="fixed top-0 left-0 right-0 flex justify-center items-center bg-purple-600 z-40"
        style={{
          height: pullDistance,
          opacity: pullDistance / 80
        }}
      >
        <div className="flex items-center space-x-2">
          {refreshing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              <span className="text-white text-sm">Refreshing...</span>
            </>
          ) : (
            <>
              <motion.div
                animate={{ rotate: pullDistance * 3 }}
                className="text-white"
              >
                ↓
              </motion.div>
              <span className="text-white text-sm">
                {pullDistance > 60 ? 'Release to refresh' : 'Pull to refresh'}
              </span>
            </>
          )}
        </div>
      </motion.div>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white" style={{ paddingTop: 'env(safe-area-inset-top, 20px)' }}>
        <div className="px-4 py-4">
          {/* Search Bar and Category Filter */}
          <div className="flex space-x-2 mb-4 items-center">
            {/* Search Bar with "Explore Creators" placeholder */}
            <div className="flex-1 relative min-w-0">
              <input
                type="search"
                placeholder="Explore Creators"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-10 pr-3 py-3 border border-white/20 rounded-lg focus:ring-2 focus:ring-white/40 focus:border-white/40 text-sm bg-white/20 backdrop-blur-sm text-white placeholder-white/70"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/70" />
            </div>

            {/* Category Dropdown */}
            <div className="relative z-50">
              <button
                onClick={() => setShowCategories(!showCategories)}
                className="flex items-center space-x-1 px-3 py-2.5 bg-white/20 backdrop-blur-sm rounded-lg text-white hover:bg-white/30 transition-colors"
              >
                <span className="text-sm font-medium whitespace-nowrap">
                  {categories.find(c => c.id === selectedCategory)?.name || 'All'}
                </span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${showCategories ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Dropdown Menu - Positioned outside header */}
      <AnimatePresence>
        {showCategories && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setShowCategories(false)}
            />

            {/* Dropdown Menu */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-4 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto"
              style={{ top: '140px' }}
            >
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setShowCategories(false);
                  }}
                  className={`w-full px-4 py-3 text-left flex items-center space-x-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    selectedCategory === category.id ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <category.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{category.name}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Filter Buttons - Trending, New, Popular */}
      <div className="px-4 mt-4">
        <div className="flex space-x-2 overflow-x-auto scrollbar-hide pb-2 scroll-smooth">
          {filterButtons.map((filter) => (
            <motion.button
              key={filter.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setSelectedFilter(filter.id);
                // Haptic feedback
                if ('vibrate' in navigator) {
                  navigator.vibrate(10);
                }
              }}
              className={`flex-shrink-0 rounded-xl px-4 py-3 shadow-md border flex items-center space-x-2 hover:shadow-lg transition-all active:scale-95 ${
                selectedFilter === filter.id
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-transparent'
                  : 'bg-white border-gray-100 text-gray-700 active:bg-gray-50'
              }`}
            >
              <filter.icon className={`w-5 h-5 ${selectedFilter === filter.id ? 'text-white' : filter.color}`} strokeWidth={2} />
              <span className="text-sm font-semibold">{filter.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Creators Grid/List */}
      <div className="px-4 mt-6">
        {error ? (
          /* Error State */
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <XMarkIcon className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Unable to load creators
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto px-4">
              {error}
            </p>
            <button
              onClick={() => {
                setError(null);
                fetchCreators(1, false);
              }}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold"
            >
              Try Again
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading creators...</p>
            </div>
          </div>
        ) : sortedCreators.length === 0 && !loading ? (
          <div className="text-center py-12">
            <UserGroupIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No creators found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-3">
            {sortedCreators.map((creator) => (
              <MobileCreatorCard
                key={creator.id}
                creator={creator}
                variant="grid"
                onSelect={() => handleCreatorClick(creator)}
                onVideoCall={(c) => {
                  if ('vibrate' in navigator) {
                    navigator.vibrate(10);
                  }
                  // Open video call modal/page
                  onCreatorSelect?.(c);
                  if (onNavigate) {
                    onNavigate('videoCall');
                  }
                }}
                onMessage={(c) => {
                  if ('vibrate' in navigator) {
                    navigator.vibrate(10);
                  }
                  // Open messages modal/page
                  onCreatorSelect?.(c);
                  if (onNavigate) {
                    onNavigate('messages');
                  }
                }}
                onTip={(c) => {
                  if ('vibrate' in navigator) {
                    navigator.vibrate(10);
                  }
                  // Open tip modal/page
                  onCreatorSelect?.(c);
                  if (onNavigate) {
                    onNavigate('tip');
                  }
                }}
                onSaveCreator={(c, isSaved) => console.log('Save:', c, isSaved)}
                showPricing={false}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedCreators.map((creator) => (
              <MobileCreatorCard
                key={creator.id}
                creator={creator}
                variant="compact"
                onSelect={() => handleCreatorClick(creator)}
                onVideoCall={(c) => {
                  if ('vibrate' in navigator) {
                    navigator.vibrate(10);
                  }
                  onCreatorSelect?.(c);
                  onNavigate('videoCall');
                }}
                onMessage={(c) => {
                  if ('vibrate' in navigator) {
                    navigator.vibrate(10);
                  }
                  onCreatorSelect?.(c);
                  onNavigate('messages');
                }}
                onTip={(c) => {
                  if ('vibrate' in navigator) {
                    navigator.vibrate(10);
                  }
                  console.log('Tip:', c);
                  // TODO: Navigate to tip modal or handle tipping
                }}
                onSaveCreator={(c, isSaved) => console.log('Save:', c, isSaved)}
                showPricing={false}
              />
            ))}
          </div>
        )}

        {/* Loading More Indicator */}
        {loadingMore && (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent" />
          </div>
        )}
      </div>

      {/* Removed Filter Modal */}
      <AnimatePresence>
        {false && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end"
            onClick={() => setShowFilters(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white rounded-t-3xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="p-1 hover:bg-gray-100 rounded-lg"
                  >
                    <XMarkIcon className="w-6 h-6 text-gray-500" />
                  </button>
                </div>

                {/* Price Range */}
                <div className="mb-6">
                  <h3 className="font-medium text-gray-900 mb-3">Price Range</h3>
                  <div className="space-y-2">
                    {priceRanges.map((range) => (
                      <label
                        key={range.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                      >
                        <span className="text-sm text-gray-700">{range.name}</span>
                        <input
                          type="radio"
                          name="priceRange"
                          value={range.id}
                          checked={filters.priceRange === range.id}
                          onChange={(e) => setFilters({ ...filters, priceRange: e.target.value })}
                          className="text-purple-600 focus:ring-purple-500"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Toggle Filters */}
                <div className="mb-6">
                  <h3 className="font-medium text-gray-900 mb-3">Show Only</h3>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <CheckIcon className="w-5 h-5 text-blue-500" />
                        <span className="text-sm text-gray-700">Verified Creators</span>
                      </div>
                      <button
                        onClick={() => setFilters({ ...filters, verified: !filters.verified })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          filters.verified ? 'bg-purple-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            filters.verified ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>

                    <label className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                        </div>
                        <span className="text-sm text-gray-700">Online Now</span>
                      </div>
                      <button
                        onClick={() => setFilters({ ...filters, online: !filters.online })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          filters.online ? 'bg-purple-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            filters.online ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>

                    <label className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <VideoCameraIcon className="w-5 h-5 text-purple-500" />
                        <span className="text-sm text-gray-700">Has Content</span>
                      </div>
                      <button
                        onClick={() => setFilters({ ...filters, hasContent: !filters.hasContent })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          filters.hasContent ? 'bg-purple-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            filters.hasContent ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setFilters({
                        priceRange: 'all',
                        location: '',
                        verified: false,
                        online: false,
                        hasContent: false
                      });
                    }}
                    className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

MobileExplore.propTypes = {
  user: PropTypes.object,
  onNavigate: PropTypes.func,
  onCreatorSelect: PropTypes.func,
  onTokenPurchase: PropTypes.func,
  onStartVideoCall: PropTypes.func,
  onStartVoiceCall: PropTypes.func
};

export default MobileExplore;