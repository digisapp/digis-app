import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebounce } from 'use-debounce';
import { getAuthToken } from '../utils/auth-helpers';

const EnhancedCreatorDiscovery = ({ user, onClose, isModal = true }) => {
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 300);
  const [activeTab, setActiveTab] = useState('featured');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filters, setFilters] = useState({
    minRating: '',
    maxPrice: '',
    isOnline: false,
    verificationLevel: 'all'
  });
  const [sortBy, setSortBy] = useState('relevance');
  const [categories, setCategories] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const searchInputRef = useRef(null);

  // Creator categories
  const categoryIcons = {
    gaming: '🎮',
    music: '🎵',
    art: '🎨',
    model: '👗',
    fitness: '💪',
    education: '📚',
    entertainment: '🎭',
    lifestyle: '✨',
    business: '💼'
  };

  // Discovery tabs
  const discoveryTabs = [
    { id: 'featured', label: 'Featured', icon: '⭐' },
    { id: 'trending', label: 'Trending', icon: '🔥' },
    { id: 'recommendations', label: 'For You', icon: '💫' },
    { id: 'search', label: 'Search', icon: '🔍' }
  ];

  // Sort options
  const sortOptions = [
    { value: 'relevance', label: 'Most Relevant' },
    { value: 'rating', label: 'Highest Rated' },
    { value: 'subscribers', label: 'Most Popular' },
    { value: 'price_low', label: 'Price: Low to High' },
    { value: 'price_high', label: 'Price: High to Low' },
    { value: 'newest', label: 'Newest First' }
  ];

  const loadCategories = useCallback(async () => {
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/discovery/categories`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('❌ Error loading categories:', error);
    }
  }, [user]);

  const loadCreators = useCallback(async () => {
    setLoading(true);
    try {
      const authToken = await getAuthToken();
      let url = `${import.meta.env.VITE_BACKEND_URL}/discovery/`;
      let params = new URLSearchParams();

      // Set endpoint based on tab
      switch (activeTab) {
        case 'featured':
          url += 'featured';
          break;
        case 'trending':
          url += 'trending';
          break;
        case 'recommendations':
          url += 'recommendations';
          break;
        case 'search':
          url += 'search';
          params.append('q', debouncedQuery);
          break;
        default:
          url += 'featured';
      }

      // Add common parameters
      params.append('limit', '20');
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (filters.minRating) params.append('minRating', filters.minRating);
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
      if (filters.isOnline) params.append('isOnline', 'true');
      if (filters.verificationLevel !== 'all') params.append('verificationLevel', filters.verificationLevel);
      if (sortBy !== 'relevance') params.append('sortBy', sortBy);

      const response = await fetch(`${url}?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCreators(data.creators || []);
      }
    } catch (error) {
      console.error('❌ Error loading creators:', error);
    } finally {
      setLoading(false);
    }
  }, [user, activeTab, debouncedQuery, selectedCategory, filters, sortBy]);

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Load creators based on active tab and filters
  useEffect(() => {
    if (activeTab === 'search' && !debouncedQuery) {
      setCreators([]);
      return;
    }
    loadCreators();
  }, [loadCreators, activeTab, debouncedQuery]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'search') {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      minRating: '',
      maxPrice: '',
      isOnline: false,
      verificationLevel: 'all'
    });
    setSelectedCategory('all');
    setSortBy('relevance');
  };

  const getCreatorColorStyle = (creator) => {
    if (creator.colorCode?.includes('gradient')) {
      return { background: creator.colorCode };
    }
    return { color: creator.colorCode || '#333' };
  };

  const getVerificationBadge = (creator) => {
    const level = creator.verificationLevel;
    const badges = {
      basic: { icon: '✓', color: '#28a745', text: 'Verified' },
      premium: { icon: '⭐', color: '#ffc107', text: 'Premium' },
      elite: { icon: '👑', color: '#6f42c1', text: 'Elite' }
    };
    
    return badges[level] || null;
  };

  const CreatorCard = ({ creator, index }) => {
    const badge = getVerificationBadge(creator);
    const pricing = creator.creatorProfile?.pricing || {};
    const analytics = creator.creatorProfile?.analytics || {};
    const minPrice = Math.min(
      pricing.privateStream || Infinity,
      pricing.videoCall || Infinity,
      pricing.phoneCall || Infinity
    );

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="creator-card"
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          border: '1px solid #e1e5e9',
          position: 'relative',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        whileHover={{ y: -5, boxShadow: '0 8px 25px rgba(0,0,0,0.15)' }}
      >
        {/* Online indicator */}
        {creator.isOnline && (
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '12px',
            height: '12px',
            backgroundColor: '#28a745',
            borderRadius: '50%',
            border: '2px solid white',
            animation: 'pulse 2s infinite'
          }} />
        )}

        {/* Profile section */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: '#f0f0f0',
            backgroundImage: creator.profilePicture ? `url(${creator.profilePicture})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            marginRight: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            color: '#666'
          }}>
            {!creator.profilePicture && '👤'}
          </div>
          
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <h4 style={{ 
                margin: 0, 
                fontSize: '16px', 
                fontWeight: 'bold',
                ...getCreatorColorStyle(creator)
              }}>
                {creator.displayName}
              </h4>
              
              {badge && (
                <span style={{
                  marginLeft: '8px',
                  backgroundColor: badge.color,
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}>
                  {badge.icon} {badge.text}
                </span>
              )}
            </div>
            
            <div style={{ fontSize: '14px', color: '#666' }}>
              {creator.username}
            </div>
          </div>
        </div>

        {/* Categories */}
        {creator.creatorProfile?.categories?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {creator.creatorProfile.categories.slice(0, 3).map(category => (
              <span
                key={category}
                style={{
                  backgroundColor: '#f8f9fa',
                  color: '#666',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '500'
                }}
              >
                {categoryIcons[category] || '📌'} {category}
              </span>
            ))}
          </div>
        )}

        {/* Bio */}
        {creator.bio && (
          <p style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            color: '#333',
            lineHeight: '1.4',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {creator.bio}
          </p>
        )}

        {/* Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '12px',
          marginBottom: '16px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
              {analytics.totalSubscribers || 0}
            </div>
            <div style={{ fontSize: '11px', color: '#666' }}>Subscribers</div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
              {analytics.averageRating ? analytics.averageRating.toFixed(1) : 'N/A'}
            </div>
            <div style={{ fontSize: '11px', color: '#666' }}>Rating</div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
              {minPrice !== Infinity ? `${minPrice}` : 'N/A'}
            </div>
            <div style={{ fontSize: '11px', color: '#666' }}>Min Price</div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={{
            flex: 1,
            padding: '10px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}>
            View Profile
          </button>
          
          <button style={{
            padding: '10px 12px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer'
          }}>
            💬
          </button>
          
          {creator.isOnline && (
            <button style={{
              padding: '10px 12px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer'
            }}>
              🔴
            </button>
          )}
        </div>

        {/* Special indicators */}
        {activeTab === 'trending' && creator.trendingScore && (
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            backgroundColor: '#ff6b6b',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '10px',
            fontWeight: 'bold'
          }}>
            🔥 Trending
          </div>
        )}

        {activeTab === 'recommendations' && creator.recommendationReason && (
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            backgroundColor: '#9c5bff',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '10px',
            fontWeight: 'bold'
          }}>
            💫 {creator.recommendationReason}
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div style={{
      position: isModal ? 'fixed' : 'relative',
      top: isModal ? 0 : 'auto',
      left: isModal ? 0 : 'auto',
      right: isModal ? 0 : 'auto',
      bottom: isModal ? 0 : 'auto',
      backgroundColor: isModal ? 'rgba(0,0,0,0.5)' : 'transparent',
      zIndex: isModal ? 1000 : 'auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isModal ? '20px' : '0'
    }}
    onClick={isModal ? onClose : undefined}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        style={{
          backgroundColor: '#fff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: isModal ? '1200px' : '100%',
          maxHeight: isModal ? '90vh' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: isModal ? '0 20px 60px rgba(0,0,0,0.3)' : 'none'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e1e5e9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
            🌟 Discover Creators
          </h2>
          
          {isModal && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
                padding: '4px'
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Navigation tabs */}
        <div style={{
          padding: '0 24px',
          borderBottom: '1px solid #e1e5e9',
          display: 'flex',
          gap: '8px'
        }}>
          {discoveryTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                padding: '12px 16px',
                border: 'none',
                backgroundColor: activeTab === tab.id ? '#007bff' : 'transparent',
                color: activeTab === tab.id ? 'white' : '#666',
                borderRadius: '12px 12px 0 0',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search bar (visible when search tab is active) */}
        {activeTab === 'search' && (
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #e1e5e9' }}>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search creators by name, category, or specialty..."
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e1e5e9',
                borderRadius: '12px',
                fontSize: '16px',
                outline: 'none'
              }}
            />
          </div>
        )}

        {/* Filters and sorting */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e1e5e9',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #e1e5e9',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {categoryIcons[category.id]} {category.name} ({category.creatorCount})
              </option>
            ))}
          </select>

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #e1e5e9',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: '8px 12px',
              backgroundColor: showFilters ? '#007bff' : '#f8f9fa',
              color: showFilters ? 'white' : '#333',
              border: '1px solid #e1e5e9',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            🔧 Filters
          </button>

          {/* Clear filters */}
          <button
            onClick={clearFilters}
            style={{
              padding: '8px 12px',
              backgroundColor: 'transparent',
              color: '#dc3545',
              border: '1px solid #dc3545',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Clear
          </button>
        </div>

        {/* Advanced filters (collapsible) */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              style={{
                overflow: 'hidden',
                borderBottom: '1px solid #e1e5e9'
              }}
            >
              <div style={{
                padding: '16px 24px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px'
              }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Min Rating
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={filters.minRating}
                    onChange={(e) => handleFilterChange('minRating', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #e1e5e9',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Max Price (tokens)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={filters.maxPrice}
                    onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #e1e5e9',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Verification Level
                  </label>
                  <select
                    value={filters.verificationLevel}
                    onChange={(e) => handleFilterChange('verificationLevel', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #e1e5e9',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="all">All Levels</option>
                    <option value="basic">✓ Verified</option>
                    <option value="premium">⭐ Premium</option>
                    <option value="elite">👑 Elite</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="online-filter"
                    checked={filters.isOnline}
                    onChange={(e) => handleFilterChange('isOnline', e.target.checked)}
                  />
                  <label htmlFor="online-filter" style={{ fontSize: '14px', fontWeight: '500' }}>
                    🟢 Online Only
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <div style={{
          flex: 1,
          padding: '24px',
          overflowY: 'auto'
        }}>
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #007bff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <div style={{ color: '#666', fontSize: '16px' }}>
                Discovering amazing creators...
              </div>
            </div>
          ) : creators.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '20px'
            }}>
              {creators.map((creator, index) => (
                <CreatorCard key={creator.uid} creator={creator} index={index} />
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#666'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
              <div style={{ fontSize: '18px', marginBottom: '8px' }}>
                {activeTab === 'search' ? 'No creators found' : 'No creators available'}
              </div>
              <div style={{ fontSize: '14px' }}>
                {activeTab === 'search' 
                  ? 'Try adjusting your search or filters'
                  : 'Check back later for new discoveries'
                }
              </div>
            </div>
          )}
        </div>
      </motion.div>
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default EnhancedCreatorDiscovery;