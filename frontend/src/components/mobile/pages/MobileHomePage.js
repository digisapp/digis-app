import React, { useState, useEffect, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { SparklesIcon, FireIcon, TrophyIcon, BellIcon } from '@heroicons/react/24/solid';
import MobileCreatorCard from '../MobileCreatorCard';
import MobileVirtualList from '../MobileVirtualList';
import MobileLoadingScreen from '../MobileLoadingScreen';
import { useMobileUI } from '../MobileUIProvider';
import { queueManager } from '../MobileOfflineQueue';

const MobileHomePage = memo(({ user, navigateTo }) => {
  const [creators, setCreators] = useState([]);
  const [featuredCreators, setFeaturedCreators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const { triggerHaptic } = useMobileUI();

  const categories = [
    { id: 'all', name: 'All', icon: SparklesIcon },
    { id: 'live', name: 'Live Now', icon: FireIcon },
    { id: 'trending', name: 'Trending', icon: TrophyIcon },
    { id: 'new', name: 'New', icon: BellIcon }
  ];

  useEffect(() => {
    fetchCreators();
  }, [activeCategory]);

  const fetchCreators = async (append = false) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/creators?category=${activeCategory}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch creators');
      
      const data = await response.json();
      
      if (append) {
        setCreators(prev => [...prev, ...data.creators]);
      } else {
        setCreators(data.creators || []);
        setFeaturedCreators(data.featured || []);
      }
      
      setHasMore(data.hasMore || false);
    } catch (error) {
      console.error('Error fetching creators:', error);
      
      // Add to offline queue if network error
      if (!navigator.onLine) {
        queueManager.addToQueue({
          type: 'fetch_creators',
          endpoint: '/api/creators',
          method: 'GET',
          data: { category: activeCategory }
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatorSelect = useCallback((creator) => {
    triggerHaptic('light');
    navigateTo('creator', { creatorId: creator.id, creator });
  }, [navigateTo, triggerHaptic]);

  const handleCategorySelect = useCallback((category) => {
    if (category.id === activeCategory) return;
    triggerHaptic('light');
    setActiveCategory(category.id);
    setIsLoading(true);
  }, [activeCategory, triggerHaptic]);

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    await fetchCreators();
  }, [activeCategory]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    await fetchCreators(true);
  }, [hasMore, isLoading]);

  const renderCreator = useCallback((creator, index) => (
    <MobileCreatorCard
      key={creator.id}
      creator={creator}
      onSelect={handleCreatorSelect}
      variant="default"
    />
  ), [handleCreatorSelect]);

  if (isLoading && creators.length === 0) {
    return <MobileLoadingScreen variant="creators" />;
  }

  return (
    <div className="mobile-home-page">
      {/* Hero Section */}
      <motion.div 
        className="mobile-hero"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="mobile-hero-title">
          Welcome back, {user?.displayName?.split(' ')[0]}!
        </h1>
        <p className="mobile-hero-subtitle">
          Discover amazing creators and connect instantly
        </p>
      </motion.div>

      {/* Categories */}
      <div className="mobile-categories">
        <div className="mobile-categories-scroll">
          {categories.map((category) => (
            <motion.button
              key={category.id}
              onClick={() => handleCategorySelect(category)}
              className={`mobile-category-chip ${activeCategory === category.id ? 'active' : ''}`}
              whileTap={{ scale: 0.95 }}
            >
              <category.icon className="w-4 h-4" />
              <span>{category.name}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Featured Creators (Horizontal Scroll) */}
      {featuredCreators.length > 0 && (
        <div className="mobile-featured-section">
          <h2 className="text-lg font-semibold text-gray-900 px-5 mb-4">Featured Creators</h2>
          <div className="mobile-featured-scroll">
            {featuredCreators.map((creator, index) => (
              <motion.div
                key={creator.id}
                className="mobile-featured-card-wrapper"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <MobileCreatorCard
                  creator={creator}
                  onSelect={handleCreatorSelect}
                  variant="featured"
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* All Creators (Virtual List) */}
      <div className="mobile-creators-section">
        <h2 className="text-lg font-semibold text-gray-900 px-5 mb-4">
          {activeCategory === 'all' ? 'All Creators' : categories.find(c => c.id === activeCategory)?.name}
        </h2>
        
        <div className="mobile-virtual-list-wrapper">
          <MobileVirtualList
            items={creators}
            renderItem={renderCreator}
            onItemClick={handleCreatorSelect}
            loadMore={loadMore}
            hasMore={hasMore}
            isLoading={isLoading}
            onRefresh={handleRefresh}
            itemHeight={200}
            emptyComponent={
              <div className="mobile-empty-state">
                <SparklesIcon className="w-16 h-16 text-gray-300" />
                <p className="text-gray-500 mt-4">No creators found</p>
                <button 
                  onClick={handleRefresh}
                  className="mobile-button-primary mt-4"
                >
                  Refresh
                </button>
              </div>
            }
          />
        </div>
      </div>

      <style jsx>{`
        .mobile-home-page {
          min-height: 100vh;
          background: #f9fafb;
          padding-bottom: 80px;
        }

        .mobile-hero {
          padding: 30px 20px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .mobile-hero-title {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 8px;
        }

        .mobile-hero-subtitle {
          font-size: 16px;
          opacity: 0.9;
        }

        .mobile-categories {
          padding: 20px 0;
          background: white;
          border-bottom: 1px solid #e5e7eb;
        }

        .mobile-categories-scroll {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding: 0 20px;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .mobile-categories-scroll::-webkit-scrollbar {
          display: none;
        }

        .mobile-category-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: #f3f4f6;
          border: 2px solid transparent;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          color: #6b7280;
          white-space: nowrap;
          transition: all 0.2s;
        }

        .mobile-category-chip.active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .mobile-featured-section {
          padding: 20px 0;
          background: white;
          margin-bottom: 10px;
        }


        .mobile-featured-scroll {
          display: flex;
          gap: 15px;
          overflow-x: auto;
          padding: 0 20px;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .mobile-featured-scroll::-webkit-scrollbar {
          display: none;
        }

        .mobile-featured-card-wrapper {
          flex: 0 0 280px;
        }

        .mobile-creators-section {
          background: white;
          padding: 20px 0;
          min-height: 400px;
        }

        .mobile-virtual-list-wrapper {
          height: calc(100vh - 400px);
          min-height: 400px;
        }

        .mobile-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
        }

        .mobile-button-primary {
          padding: 12px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
});

MobileHomePage.displayName = 'MobileHomePage';

export default MobileHomePage;