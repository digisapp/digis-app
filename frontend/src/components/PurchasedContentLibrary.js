import React, { useState, useEffect } from 'react';
// import { motion, AnimatePresence } from 'framer-motion'; // Removed to eliminate animations
import {
  PlayCircleIcon,
  PhotoIcon,
  MicrophoneIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  SparklesIcon,
  FolderOpenIcon,
  ClockIcon,
  UserIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import {
  PlayIcon,
  CheckCircleIcon
} from '@heroicons/react/24/solid';
import Card from './ui/Card';
import Button from './ui/Button';
import toast from 'react-hot-toast';

const PurchasedContentLibrary = ({ user, onContentView }) => {
  const [purchasedContent, setPurchasedContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContent, setSelectedContent] = useState(null);
  const [showContentViewer, setShowContentViewer] = useState(false);

  // Mock purchased content data
  useEffect(() => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setPurchasedContent([
        {
          id: 1,
          contentId: 101,
          type: 'video',
          title: 'Exclusive Dance Tutorial',
          creatorName: 'DanceMaster',
          creatorUsername: '@dancemaster',
          thumbnail: '💃',
          duration: '15:30',
          purchaseDate: '2024-01-20',
          purchasePrice: 250,
          viewCount: 5,
          lastViewed: '2024-01-21',
          downloadable: true,
          contentUrl: 'https://example.com/content/video1.mp4'
        },
        {
          id: 2,
          contentId: 102,
          type: 'photo',
          title: 'Behind the Scenes Photoshoot',
          creatorName: 'PhotoPro',
          creatorUsername: '@photopro',
          thumbnail: '📸',
          photoCount: 25,
          purchaseDate: '2024-01-18',
          purchasePrice: 150,
          viewCount: 12,
          lastViewed: '2024-01-19',
          downloadable: true,
          contentUrl: 'https://example.com/content/photos.zip'
        },
        {
          id: 3,
          contentId: 103,
          type: 'audio',
          title: 'Meditation & Relaxation Guide',
          creatorName: 'ZenMaster',
          creatorUsername: '@zenmaster',
          thumbnail: '🧘‍♀️',
          duration: '20:00',
          purchaseDate: '2024-01-15',
          purchasePrice: 100,
          viewCount: 8,
          lastViewed: '2024-01-20',
          downloadable: true,
          contentUrl: 'https://example.com/content/audio1.mp3'
        },
        {
          id: 4,
          contentId: 104,
          type: 'video',
          title: 'Personal Q&A Session',
          creatorName: 'LifeCoach',
          creatorUsername: '@lifecoach',
          thumbnail: '🎤',
          duration: '45:00',
          purchaseDate: '2024-01-10',
          purchasePrice: 500,
          viewCount: 3,
          lastViewed: '2024-01-15',
          downloadable: false,
          contentUrl: 'https://example.com/content/video2.mp4'
        },
        {
          id: 5,
          contentId: 105,
          type: 'post',
          title: 'My Journey to Success',
          creatorName: 'Motivator',
          creatorUsername: '@motivator',
          thumbnail: '📝',
          wordCount: 3500,
          purchaseDate: '2024-01-05',
          purchasePrice: 50,
          viewCount: 15,
          lastViewed: '2024-01-21',
          downloadable: true,
          contentUrl: 'https://example.com/content/post1.pdf'
        }
      ]);
      setLoading(false);
    }, 1000);
  }, [user]);

  // Filter and sort content
  const filteredContent = purchasedContent.filter(item => {
    const matchesFilter = filterType === 'all' || item.type === filterType;
    const matchesSearch = searchQuery === '' || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.creatorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.creatorUsername.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const sortedContent = [...filteredContent].sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return new Date(b.purchaseDate) - new Date(a.purchaseDate);
      case 'viewed':
        return new Date(b.lastViewed) - new Date(a.lastViewed);
      case 'creator':
        return a.creatorName.localeCompare(b.creatorName);
      case 'price':
        return b.purchasePrice - a.purchasePrice;
      default:
        return 0;
    }
  });

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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const handleView = (content) => {
    setSelectedContent(content);
    setShowContentViewer(true);
    
    // Update view count
    setPurchasedContent(prev => 
      prev.map(item => 
        item.id === content.id 
          ? { ...item, viewCount: item.viewCount + 1, lastViewed: new Date().toISOString() }
          : item
      )
    );

    if (onContentView) {
      onContentView(content);
    }
  };

  const handleDownload = (content) => {
    if (!content.downloadable) {
      toast.error('This content is not available for download');
      return;
    }
    
    // Simulate download
    // toast.success(`Downloading "${content.title}"...`);
    // In production, you would trigger actual download here
  };

  const ContentCard = ({ content }) => {
    const Icon = getContentIcon(content.type);

    return (
      <div
        className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden hover:-translate-y-1"
      >
        {/* Thumbnail */}
        <div 
          className="relative h-48 bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center overflow-hidden cursor-pointer group"
          onClick={() => handleView(content)}
        >
          <span className="text-6xl group-hover:scale-110 transition-transform duration-300">
            {content.thumbnail}
          </span>

          {/* Overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300" />

          {/* Type Badge */}
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full flex items-center gap-1">
            <Icon className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-medium text-gray-800 capitalize">{content.type}</span>
          </div>

          {/* Owned Badge */}
          <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full flex items-center gap-1">
            <CheckCircleIcon className="w-4 h-4" />
            <span className="text-xs font-bold">Owned</span>
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
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-white/90 rounded-full p-4">
              <PlayIcon className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Content Info */}
        <div className="p-5">
          <h3 className="font-bold text-gray-900 mb-1 line-clamp-1">{content.title}</h3>
          
          {/* Creator Info */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm text-gray-600">{content.creatorName}</span>
            <span className="text-xs text-gray-400">{content.creatorUsername}</span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div className="flex items-center gap-1 text-gray-600">
              <CalendarIcon className="w-4 h-4" />
              <span>{formatDate(content.purchaseDate)}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-600">
              <EyeIcon className="w-4 h-4" />
              <span>{content.viewCount} views</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={() => handleView(content)}
              variant="primary"
              size="sm"
              className="flex-1"
            >
              <EyeIcon className="w-4 h-4 mr-1" />
              View
            </Button>
            {content.downloadable && (
              <Button
                onClick={() => handleDownload(content)}
                variant="secondary"
                size="sm"
                className="flex-1"
              >
                <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
                Download
              </Button>
            )}
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
            <FolderOpenIcon className="w-7 h-7 text-purple-600" />
            My Content Library
          </h2>
          <p className="text-gray-600 mt-1">Access all your purchased content</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <SparklesIcon className="w-5 h-5 text-purple-600" />
          <span className="font-medium">{purchasedContent.length} items</span>
          <span className="text-gray-500">•</span>
          <span className="text-gray-600">
            {purchasedContent.reduce((sum, item) => sum + item.purchasePrice, 0)} tokens spent
          </span>
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
              placeholder="Search by title or creator..."
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
                  onClick={() => setFilterType(filter)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    filterType === filter
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
              <option value="recent">Recently Purchased</option>
              <option value="viewed">Recently Viewed</option>
              <option value="creator">By Creator</option>
              <option value="price">By Price</option>
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
                <div className="h-8 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedContent.length === 0 ? (
        <Card className="p-16 text-center">
          <FolderOpenIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No content found</h3>
          <p className="text-gray-600">
            {searchQuery || filterType !== 'all' 
              ? 'Try adjusting your filters or search query' 
              : 'You haven\'t purchased any content yet'}
          </p>
          <Button
            onClick={() => {/* Navigate to explore */}}
            className="mt-4"
          >
            Explore Content
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedContent.map((content) => (
            <ContentCard key={content.id} content={content} />
          ))}
        </div>
      )}

      {/* Content Viewer Modal */}
      {showContentViewer && selectedContent && (
        <div
          className="fixed inset-0 bg-black flex items-center justify-center z-50"
          onClick={() => setShowContentViewer(false)}
        >
          <div
            className="relative w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
              {/* Close Button */}
              <button
                onClick={() => setShowContentViewer(false)}
                className="absolute top-4 right-4 z-10 p-2 bg-white/10 backdrop-blur rounded-full hover:bg-white/20 transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-white" />
              </button>

              {/* Content Display */}
              {selectedContent.type === 'video' ? (
                <video
                  controls
                  autoPlay
                  className="max-w-full max-h-full rounded-lg"
                  src={selectedContent.contentUrl}
                />
              ) : selectedContent.type === 'photo' ? (
                <div className="max-w-4xl max-h-full overflow-auto p-4">
                  <img
                    src={selectedContent.contentUrl}
                    alt={selectedContent.title}
                    className="w-full h-auto rounded-lg"
                  />
                </div>
              ) : selectedContent.type === 'audio' ? (
                <div className="bg-white rounded-lg p-8 max-w-md">
                  <div className="text-center mb-6">
                    <span className="text-8xl">{selectedContent.thumbnail}</span>
                    <h3 className="text-xl font-bold mt-4">{selectedContent.title}</h3>
                    <p className="text-gray-600">{selectedContent.creatorName}</p>
                  </div>
                  <audio
                    controls
                    autoPlay
                    className="w-full"
                    src={selectedContent.contentUrl}
                  />
                </div>
              ) : (
                <div className="bg-white rounded-lg p-8 max-w-4xl max-h-full overflow-auto">
                  <h2 className="text-2xl font-bold mb-4">{selectedContent.title}</h2>
                  <p className="text-gray-600 mb-4">By {selectedContent.creatorName}</p>
                  <div className="prose max-w-none">
                    {/* Content would be rendered here */}
                    <p>Blog post content would be displayed here...</p>
                  </div>
                </div>
              )}

              {/* Content Info Bar */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-white">
                <h3 className="text-xl font-bold mb-1">{selectedContent.title}</h3>
                <p className="text-sm opacity-80">
                  By {selectedContent.creatorName} • Viewed {selectedContent.viewCount} times
                </p>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default PurchasedContentLibrary;