import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { SparklesIcon, FireIcon, TrophyIcon, BellIcon } from '@heroicons/react/24/solid';
import MobileCreatorCard from '../MobileCreatorCard';
import MobileVirtualList from '../MobileVirtualList';
import { MobileSkeleton, MobileErrorState, MobileEmptyState } from '../MobileUIStates';
import { useMobileUI } from '../MobileUIProvider';
import { useApi, api, offlineQueue } from '../../../utils/mobileApi';
import '../../../styles/mobile-theme.css';

const MobileHomePageOptimized = memo(({ user, navigateTo }) => {
  const [creators, setCreators] = useState([]);
  const [featuredCreators, setFeaturedCreators] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const { triggerHaptic } = useMobileUI();
  const { request, loading, error, setError } = useApi();
  
  // Refs for infinite scroll
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);
  const isLoadingMore = useRef(false);
  const categoryScrollRef = useRef(null);
  
  // Respect reduced motion with SSR guard
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
  const animationProps = prefersReducedMotion ? {} : {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 }
  };

  const categories = useMemo(() => [
    { id: 'all', name: 'All', icon: SparklesIcon },
    { id: 'live', name: 'Live Now', icon: FireIcon },
    { id: 'trending', name: 'Trending', icon: TrophyIcon },
    { id: 'new', name: 'New', icon: BellIcon }
  ], []);

  // Fetch creators with new API client
  const fetchCreators = useCallback(async (append = false, category = activeCategory, pageNum = 1) => {
    try {
      const data = await request(api.creators.list(category, pageNum));
      
      if (append) {
        setCreators(prev => [...prev, ...(data.creators || [])]);
      } else {
        setCreators(data.creators || []);
        setFeaturedCreators(data.featured || []);
      }
      
      setHasMore(data.hasMore || false);
      setPage(pageNum);
    } catch (err) {
      // Offline queue integration
      if (!navigator.onLine) {
        offlineQueue.add({
          path: api.creators.list(category, pageNum),
          options: { method: 'GET' }
        });
      }
    }
  }, [activeCategory, request]);

  // Initial load
  useEffect(() => {
    fetchCreators(false, activeCategory, 1);
  }, [activeCategory]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current) return;
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loading && !isLoadingMore.current) {
          isLoadingMore.current = true;
          fetchCreators(true, activeCategory, page + 1).finally(() => {
            isLoadingMore.current = false;
          });
        }
      },
      { rootMargin: '100px' }
    );
    
    observerRef.current.observe(loadMoreRef.current);
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, page, activeCategory, fetchCreators]);

  // Memoized handler for creator selection
  const handleCreatorSelect = useCallback((creator) => {
    triggerHaptic('light');
    navigateTo('creator', { creatorId: creator.id, creator });
  }, [navigateTo, triggerHaptic]);

  // Category selection with scroll into view
  const handleCategorySelect = useCallback((category) => {
    if (category.id === activeCategory) return;
    
    triggerHaptic('light');
    setActiveCategory(category.id);
    setCreators([]);
    setPage(1);
    
    // Scroll selected chip into view
    if (categoryScrollRef.current) {
      const chip = categoryScrollRef.current.querySelector(`[data-category="${category.id}"]`);
      chip?.scrollIntoView({ inline: 'center', behavior: 'smooth' });
    }
  }, [activeCategory, triggerHaptic]);

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setError(null);
    await fetchCreators(false, activeCategory, 1);
  }, [activeCategory, fetchCreators, setError]);

  // Memoized creator renderer
  const renderCreator = useCallback((creator, index) => (
    <MobileCreatorCard
      key={creator.id}
      creator={creator}
      onSelect={handleCreatorSelect}
      variant="default"
      loading="lazy"
    />
  ), [handleCreatorSelect]);

  // Memoized filtered/displayed name
  const displayName = useMemo(() => 
    user?.displayName?.split(' ')[0] || 'there',
    [user?.displayName]
  );

  // Loading state with skeleton
  if (loading && creators.length === 0) {
    return (
      <div className="mobile-page">
        <MobileSkeleton count={5} type="list" />
      </div>
    );
  }

  // Error state
  if (error && creators.length === 0) {
    return (
      <div className="mobile-page">
        <MobileErrorState 
          error={error}
          onRetry={handleRefresh}
        />
      </div>
    );
  }

  return (
    <div className="mobile-page">
      {/* Hero Section */}
      <motion.div 
        className="mobile-hero"
        {...animationProps}
      >
        <h1 className="mobile-hero-title">
          Welcome back, {displayName}!
        </h1>
        <p className="mobile-hero-subtitle">
          Discover amazing creators and connect instantly
        </p>
      </motion.div>

      {/* Categories with scroll position memory */}
      <div className="mobile-categories" ref={categoryScrollRef}>
        <div className="mobile-categories-scroll mobile-scrollbar-hide">
          {categories.map((category) => (
            <motion.button
              key={category.id}
              data-category={category.id}
              onClick={() => handleCategorySelect(category)}
              className={`mobile-category-chip mobile-touchable ${
                activeCategory === category.id ? 'active' : ''
              }`}
              whileTap={!prefersReducedMotion ? { scale: 0.95 } : {}}
              aria-label={`Filter by ${category.name}`}
              aria-pressed={activeCategory === category.id}
              type="button"
            >
              <category.icon className="w-4 h-4" aria-hidden="true" />
              <span>{category.name}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Featured Creators with lazy loading */}
      {featuredCreators.length > 0 && (
        <section className="mobile-featured-section" aria-label="Featured creators">
          <h2 className="text-lg font-semibold text-gray-900 px-5 mb-4">Featured Creators</h2>
          <div className="mobile-featured-scroll mobile-scrollbar-hide">
            {featuredCreators.map((creator, index) => (
              <motion.div
                key={creator.id}
                className="mobile-featured-card-wrapper"
                {...(!prefersReducedMotion && {
                  initial: { opacity: 0, x: 20 },
                  animate: { opacity: 1, x: 0 },
                  transition: { delay: index * 0.05 }
                })}
              >
                <MobileCreatorCard
                  creator={creator}
                  onSelect={handleCreatorSelect}
                  variant="featured"
                  loading="lazy"
                />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* All Creators with virtual list */}
      <section className="mobile-creators-section" aria-label="All creators">
        <h2 className="text-lg font-semibold text-gray-900 px-5 mb-4">
          {activeCategory === 'all' 
            ? 'All Creators' 
            : categories.find(c => c.id === activeCategory)?.name}
        </h2>
        
        {creators.length === 0 ? (
          <MobileEmptyState
            icon={SparklesIcon}
            title="No creators found"
            message="Try a different category or check back later"
            action={handleRefresh}
            actionLabel="Refresh"
          />
        ) : (
          <div className="mobile-creators-list">
            <MobileVirtualList
              items={creators}
              renderItem={renderCreator}
              onItemClick={handleCreatorSelect}
              hasMore={hasMore}
              isLoading={loading}
              onRefresh={handleRefresh}
              itemHeight={200}
            />
            
            {/* Sentinel for infinite scroll */}
            <div 
              ref={loadMoreRef} 
              className="mobile-load-more-sentinel"
              aria-hidden="true"
            />
            
            {loading && <MobileSkeleton count={2} type="list" />}
          </div>
        )}
      </section>

      <style jsx>{`
        .mobile-hero {
          padding: 30px 20px 20px;
          background: var(--brand-gradient);
          color: white;
        }

        .mobile-hero-title {
          font-size: var(--font-size-3xl);
          font-weight: var(--font-weight-bold);
          margin-bottom: var(--spacing-sm);
        }

        .mobile-hero-subtitle {
          font-size: var(--font-size-base);
          opacity: 0.9;
        }

        .mobile-categories {
          padding: var(--spacing-xl) 0;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--bg-tertiary);
        }

        .mobile-categories-scroll {
          display: flex;
          gap: var(--spacing-md);
          overflow-x: auto;
          padding: 0 var(--spacing-xl);
        }

        .mobile-category-chip {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-lg);
          background: var(--bg-tertiary);
          border: 2px solid transparent;
          border-radius: var(--radius-2xl);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--fg-secondary);
          white-space: nowrap;
          transition: all var(--transition-base);
        }

        .mobile-category-chip.active {
          background: var(--brand-gradient);
          color: white;
        }

        .mobile-category-chip:focus-visible {
          outline: 2px solid var(--brand-primary);
          outline-offset: 2px;
        }

        .mobile-featured-section {
          padding: var(--spacing-xl) 0;
          background: var(--bg-secondary);
          margin-bottom: var(--spacing-md);
        }


        .mobile-featured-scroll {
          display: flex;
          gap: var(--spacing-lg);
          overflow-x: auto;
          padding: 0 var(--spacing-xl);
        }

        .mobile-featured-card-wrapper {
          flex: 0 0 280px;
        }

        .mobile-creators-section {
          background: var(--bg-secondary);
          padding: var(--spacing-xl) 0;
          min-height: 400px;
        }

        .mobile-creators-list {
          position: relative;
        }

        .mobile-load-more-sentinel {
          height: 1px;
          margin-top: var(--spacing-xl);
        }
      `}</style>
    </div>
  );
});

MobileHomePageOptimized.displayName = 'MobileHomePageOptimized';

export default MobileHomePageOptimized;