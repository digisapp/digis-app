import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClockIcon, 
  EyeIcon, 
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import recentlyViewedService from '../utils/recentlyViewedService';
import EnhancedCreatorCard from './EnhancedCreatorCard';
import SkeletonLoader, { CreatorCardSkeleton } from './ui/SkeletonLoader';

const RecentlyViewedCreators = ({ 
  onCreatorClick, 
  onTipCreator, 
  user, 
  className = "",
  showHeader = true,
  maxItems = 5,
  compact = false
}) => {
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const scrollContainerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Load recently viewed creators
  useEffect(() => {
    try {
      setLoading(true);
      const creators = recentlyViewedService.getRecentlyViewed();
      setRecentlyViewed(creators.slice(0, maxItems));
      setError(null);
    } catch (err) {
      console.error('Error loading recently viewed creators:', err);
      setError('Failed to load recently viewed creators');
    } finally {
      setLoading(false);
    }
  }, [maxItems]);

  // Listen for updates to recently viewed
  useEffect(() => {
    const handleUpdate = (event) => {
      const { recentlyViewed: updated } = event.detail;
      setRecentlyViewed(updated.slice(0, maxItems));
    };

    window.addEventListener('recentlyViewedUpdated', handleUpdate);
    return () => window.removeEventListener('recentlyViewedUpdated', handleUpdate);
  }, [maxItems]);

  // Update scroll buttons
  const updateScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth
    );
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollButtons);
      updateScrollButtons(); // Initial check
      
      return () => container.removeEventListener('scroll', updateScrollButtons);
    }
  }, [recentlyViewed]);

  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -300, behavior: 'smooth' });
  };

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 300, behavior: 'smooth' });
  };

  const handleRemoveCreator = (creatorId, event) => {
    event.stopPropagation();
    recentlyViewedService.removeCreator(creatorId);
  };

  const handleClearAll = () => {
    recentlyViewedService.clearAll();
  };

  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className={className}>
        {showHeader && (
          <div className="flex items-center justify-between mb-6">
            <SkeletonLoader className="h-6 w-40" />
            <SkeletonLoader className="h-4 w-24" />
          </div>
        )}
        <div className={compact ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6'}>
          {Array.from({ length: Math.min(maxItems, 5) }, (_, i) => (
            <SkeletonLoader 
              key={i} 
              variant={compact ? "message" : "creator"} 
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl ${className}`}>
        <div className="flex items-center gap-3">
          <XMarkIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-red-800 dark:text-red-200">
              Unable to load recently viewed
            </h3>
            <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (recentlyViewed.length === 0) {
    return (
      <div className={`p-8 text-center bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl ${className}`}>
        <EyeIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No recent views yet
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Creators you view will appear here for quick access
        </p>
      </div>
    );
  }

  // Compact view for sidebars/mobile
  if (compact) {
    return (
      <div className={className}>
        {showHeader && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-gray-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Recently Viewed
              </h3>
              <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full text-xs font-medium">
                {recentlyViewed.length}
              </span>
            </div>
            {recentlyViewed.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
                aria-label="Clear all recently viewed"
              >
                Clear all
              </button>
            )}
          </div>
        )}
        
        <div className="space-y-3">
          <AnimatePresence>
            {recentlyViewed.map((creator) => (
              <motion.div
                key={creator.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => onCreatorClick?.(creator)}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-purple-400 to-pink-400">
                    {creator.profilePicUrl ? (
                      <img 
                        src={creator.profilePicUrl} 
                        alt={creator.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-bold">
                        {creator.username?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  {creator.isOnline && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      @{creator.username}
                    </p>
                    <button
                      onClick={(e) => handleRemoveCreator(creator.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                      aria-label="Remove from recently viewed"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {creator.category || 'Creator'}
                    </p>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 flex-shrink-0">
                      {formatRelativeTime(creator.viewedAt)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Full card view
  return (
    <div className={className}>
      {showHeader && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ClockIcon className="w-6 h-6 text-purple-500" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Recently Viewed Creators
            </h2>
            <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-3 py-1 rounded-full text-sm font-medium">
              {recentlyViewed.length}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleClearAll}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium flex items-center gap-1"
              aria-label="Clear all recently viewed"
            >
              <TrashIcon className="w-4 h-4" />
              Clear all
            </button>
            
            {/* Scroll Controls */}
            <div className="flex gap-2">
              <button
                onClick={scrollLeft}
                disabled={!canScrollLeft}
                className="p-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                aria-label="Scroll left"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <button
                onClick={scrollRight}
                disabled={!canScrollRight}
                className="p-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                aria-label="Scroll right"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div 
        ref={scrollContainerRef}
        className="flex gap-6 overflow-x-auto scrollbar-hide pb-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <AnimatePresence>
          {recentlyViewed.map((creator, index) => (
            <motion.div
              key={creator.id}
              layout
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="flex-shrink-0 w-72 relative group"
            >
              <div className="relative">
                <EnhancedCreatorCard
                  creator={{
                    ...creator,
                    // Ensure all required fields are present
                    isFollowing: false,
                    isPremium: false
                  }}
                  onJoinSession={(creator, serviceType) => {
                    onCreatorClick?.(creator, serviceType);
                  }}
                  onTip={onTipCreator}
                  onMessage={(creator) => onCreatorClick?.(creator, 'message')}
                  isAuthenticated={!!user}
                  currentUserId={user?.uid}
                />
                
                {/* Remove Button */}
                <motion.button
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  onClick={(e) => handleRemoveCreator(creator.id, e)}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 shadow-lg"
                  aria-label="Remove from recently viewed"
                >
                  <XMarkIcon className="w-4 h-4" />
                </motion.button>

                {/* View Time Badge */}
                <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm">
                  {formatRelativeTime(creator.viewedAt)}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RecentlyViewedCreators;