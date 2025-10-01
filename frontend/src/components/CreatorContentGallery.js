import React, { useState, useEffect } from 'react';
// import { motion, AnimatePresence } from 'framer-motion'; // Removed to eliminate animations
import { useContent } from '../hooks/useContent';
import {
  PlayCircleIcon,
  PhotoIcon,
  MicrophoneIcon,
  ShoppingCartIcon,
  EyeIcon,
  HeartIcon,
  ClockIcon,
  FireIcon,
  SparklesIcon,
  LockClosedIcon,
  CheckCircleIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  TagIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import {
  PlayIcon,
  StarIcon as StarIconSolid
} from '@heroicons/react/24/solid';
import Card from './ui/Card';
import Button from './ui/Button';
import toast from 'react-hot-toast';

const CreatorContentGallery = ({ 
  creatorId, 
  creatorName,
  onPurchase,
  userTokenBalance,
  purchasedContent = []
}) => {
  const { getCreatorContent } = useContent();
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [selectedContent, setSelectedContent] = useState(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contentItems, setContentItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Load content data from context and API
  useEffect(() => {
    setLoading(true);
    
    // Get content from context
    const creatorContent = creatorId ? getCreatorContent(creatorId) : [];
    
    // Simulate API call for additional content
    setTimeout(() => {
      // Combine creator's uploaded content with default shop items
      const defaultContent = [
        {
          id: 1000,
          type: 'video',
          title: 'Exclusive Dance Tutorial',
          description: 'Learn my signature moves in this step-by-step tutorial',
          thumbnail: '💃',
          duration: '15:30',
          price: 250,
          views: 12500,
          likes: 1850,
          preview: 'https://example.com/preview1.mp4',
          tags: ['dance', 'tutorial', 'exclusive'],
          releaseDate: '2024-01-15',
          purchases: 856,
          featured: true
        },
        {
          id: 2,
          type: 'photo',
          title: 'Behind the Scenes Photoshoot',
          description: 'Exclusive photos from my latest photoshoot',
          thumbnail: '📸',
          photoCount: 25,
          price: 150,
          views: 8900,
          likes: 1200,
          tags: ['photos', 'exclusive', 'behind-the-scenes'],
          releaseDate: '2024-01-12',
          purchases: 634,
          bundle: true
        },
        {
          id: 3,
          type: 'video',
          title: 'Personal Q&A Session',
          description: 'Answering your most asked questions',
          thumbnail: '🎤',
          duration: '45:00',
          price: 500,
          views: 6700,
          likes: 980,
          tags: ['q&a', 'personal', 'exclusive'],
          releaseDate: '2024-01-10',
          purchases: 423,
          premium: true
        },
        {
          id: 4,
          type: 'audio',
          title: 'Meditation & Relaxation Guide',
          description: 'My personal meditation routine for stress relief',
          thumbnail: '🧘‍♀️',
          duration: '20:00',
          price: 100,
          views: 4500,
          likes: 670,
          tags: ['meditation', 'wellness', 'audio'],
          releaseDate: '2024-01-08',
          purchases: 892
        },
        {
          id: 5,
          type: 'post',
          title: 'My Journey to Success',
          description: 'An in-depth blog post about my career journey',
          thumbnail: '📝',
          wordCount: 3500,
          price: 50,
          views: 3200,
          likes: 450,
          tags: ['blog', 'personal', 'inspiring'],
          releaseDate: '2024-01-05',
          purchases: 567
        },
        {
          id: 6,
          type: 'video',
          title: 'Cooking My Favorite Recipe',
          description: 'Step-by-step cooking tutorial of my signature dish',
          thumbnail: '👨‍🍳',
          duration: '25:00',
          price: 200,
          views: 9800,
          likes: 1450,
          tags: ['cooking', 'tutorial', 'lifestyle'],
          releaseDate: '2024-01-03',
          purchases: 723,
          trending: true
        }
      ];
      
      // Merge creator uploaded content with default content
      // Ensure uploaded content has all required fields
      const formattedCreatorContent = creatorContent.map(item => ({
        ...item,
        tags: item.tags || [],
        releaseDate: item.publishedAt || new Date().toISOString(),
        purchases: item.purchases || 0,
        preview: item.preview || ''
      }));
      
      // Combine and set all content
      setContentItems([...formattedCreatorContent, ...defaultContent]);
      setLoading(false);
    }, 1000);
  }, [creatorId, getCreatorContent]);

  // Filter content
  const filteredContent = contentItems.filter(item => {
    const matchesFilter = activeFilter === 'all' || item.type === activeFilter;
    const matchesSearch = searchQuery === '' || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  // Sort content
  const sortedContent = [...filteredContent].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.releaseDate) - new Date(a.releaseDate);
      case 'price-low':
        return a.price - b.price;
      case 'price-high':
        return b.price - a.price;
      case 'popular':
      default:
        return b.purchases - a.purchases;
    }
  });

  const isPurchased = (contentId) => {
    return purchasedContent.includes(contentId);
  };

  const getContentIcon = (type) => {
    switch (type) {
      case 'video':
        return PlayCircleIcon;
      case 'photo':
        return PhotoIcon;
      case 'audio':
        return MicrophoneIcon;
      default:
        return PhotoIcon;
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const handlePurchase = async (content) => {
    if (userTokenBalance < content.price) {
      toast.error('Insufficient tokens. Please purchase more tokens.');
      return;
    }

    try {
      await onPurchase(content);
      setShowPurchaseModal(false);
      // toast.success(`Successfully purchased "${content.title}"!`);
    } catch (error) {
      toast.error('Purchase failed. Please try again.');
    }
  };

  const ContentCard = ({ content }) => {
    const Icon = getContentIcon(content.type);
    const purchased = isPurchased(content.id);

    return (
      <div
        className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer group hover:-translate-y-1"
        onClick={() => {
          setSelectedContent(content);
          setShowPurchaseModal(true);
        }}
      >
        {/* Thumbnail */}
        <div className="relative h-48 bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center overflow-hidden">
          <span className="text-6xl group-hover:scale-110 transition-transform duration-300">
            {content.thumbnail}
          </span>

          {/* Overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300" />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-2">
            {content.featured && (
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                <StarIcon className="w-3 h-3" />
                Featured
              </div>
            )}
            {content.trending && (
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                <FireIcon className="w-3 h-3" />
                Trending
              </div>
            )}
            {content.premium && (
              <div className="bg-black text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                <SparklesIcon className="w-3 h-3" />
                Premium
              </div>
            )}
            {content.bundle && (
              <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                Bundle
              </div>
            )}
          </div>

          {/* Type Badge */}
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full flex items-center gap-1">
            <Icon className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-medium text-gray-800 capitalize">{content.type}</span>
          </div>

          {/* Duration/Count */}
          {content.duration && (
            <div className="absolute bottom-3 right-3 bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
              <ClockIcon className="w-3 h-3" />
              {content.duration}
            </div>
          )}
          {content.photoCount && (
            <div className="absolute bottom-3 right-3 bg-black/70 text-white px-2 py-1 rounded text-xs">
              {content.photoCount} photos
            </div>
          )}

          {/* Play Button */}
          {content.type === 'video' && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-white/90 rounded-full p-4">
                <PlayIcon className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          )}

          {/* Lock/Check Overlay */}
          {purchased ? (
            <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
              <CheckCircleIcon className="w-12 h-12 text-green-600" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
              <LockClosedIcon className="w-8 h-8 text-white drop-shadow-lg" />
            </div>
          )}
        </div>

        {/* Content Info */}
        <div className="p-5">
          <h3 className="font-bold text-gray-900 mb-1 line-clamp-1 group-hover:text-purple-600 transition-colors">
            {content.title}
          </h3>
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{content.description}</p>

          {/* Stats */}
          <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
            <div className="flex items-center gap-1">
              <EyeIcon className="w-4 h-4" />
              {formatNumber(content.views)}
            </div>
            <div className="flex items-center gap-1">
              <HeartIcon className="w-4 h-4" />
              {formatNumber(content.likes)}
            </div>
          </div>

          {/* Price and Purchase Info */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            {purchased ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircleIcon className="w-5 h-5" />
                <span className="font-medium">Owned</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <TagIcon className="w-5 h-5 text-purple-600" />
                <span className="text-2xl font-bold text-gray-900">{content.price}</span>
                <span className="text-sm text-gray-500">tokens</span>
              </div>
            )}
            <div className="text-xs text-gray-500">
              {formatNumber(content.purchases)} purchases
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCartIcon className="w-7 h-7 text-purple-600" />
            Creator Shop
          </h2>
          <p className="text-gray-600 mt-1">Exclusive content from {creatorName}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <SparklesIcon className="w-5 h-5 text-purple-600" />
          <span>{contentItems.length} items available</span>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-1">
              {['all', 'video', 'photo', 'audio', 'post'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeFilter === filter
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="popular">Most Popular</option>
              <option value="newest">Newest First</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Content Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden animate-pulse">
              <div className="h-48 bg-gray-200" />
              <div className="p-5 space-y-3">
                <div className="h-5 bg-gray-200 rounded" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedContent.length === 0 ? (
        <Card className="p-16 text-center">
          <PhotoIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No content found</h3>
          <p className="text-gray-600">
            {searchQuery || activeFilter !== 'all' 
              ? 'Try adjusting your filters or search query' 
              : 'This creator hasn\'t uploaded any content yet'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedContent.map((content) => (
            <ContentCard key={content.id} content={content} />
          ))}
        </div>
      )}

      {/* Purchase Modal */}
      {showPurchaseModal && selectedContent && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPurchaseModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{selectedContent.title}</h3>
                    <p className="text-gray-600 mt-1">{selectedContent.description}</p>
                  </div>
                  <button
                    onClick={() => setShowPurchaseModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6 text-gray-500" />
                  </button>
                </div>

                {/* Preview */}
                <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl h-64 flex items-center justify-center mb-6">
                  <span className="text-8xl">{selectedContent.thumbnail}</span>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <Card className="p-4 text-center">
                    <EyeIcon className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                    <p className="text-xl font-bold">{formatNumber(selectedContent.views)}</p>
                    <p className="text-sm text-gray-600">Views</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <HeartIcon className="w-6 h-6 text-pink-600 mx-auto mb-2" />
                    <p className="text-xl font-bold">{formatNumber(selectedContent.likes)}</p>
                    <p className="text-sm text-gray-600">Likes</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <ShoppingCartIcon className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                    <p className="text-xl font-bold">{formatNumber(selectedContent.purchases)}</p>
                    <p className="text-sm text-gray-600">Sold</p>
                  </Card>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedContent.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Purchase Section */}
                {isPurchased(selectedContent.id) ? (
                  <Card className="p-6 bg-green-50 border-green-200">
                    <div className="flex items-center gap-3 text-green-700">
                      <CheckCircleIcon className="w-8 h-8" />
                      <div>
                        <p className="font-bold text-lg">You own this content!</p>
                        <p className="text-sm">Access it anytime from your library</p>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <>
                    <Card className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 mb-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Price</p>
                          <p className="text-3xl font-bold text-gray-900">
                            {selectedContent.price} tokens
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Your Balance</p>
                          <p className={`text-xl font-bold ${
                            userTokenBalance >= selectedContent.price ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {userTokenBalance} tokens
                          </p>
                        </div>
                      </div>

                      {userTokenBalance < selectedContent.price && (
                        <div className="bg-red-100 border border-red-200 rounded-lg p-3 mb-4">
                          <p className="text-sm text-red-700">
                            You need {selectedContent.price - userTokenBalance} more tokens to purchase this content
                          </p>
                        </div>
                      )}

                      <Button
                        onClick={() => handlePurchase(selectedContent)}
                        disabled={userTokenBalance < selectedContent.price}
                        className="w-full"
                        size="lg"
                      >
                        <ShoppingCartIcon className="w-5 h-5 mr-2" />
                        Purchase Now
                      </Button>
                    </Card>

                    <p className="text-xs text-center text-gray-500">
                      By purchasing, you agree to our content terms and conditions
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default CreatorContentGallery;