import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayCircleIcon,
  PhotoIcon,
  MusicalNoteIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  FolderIcon,
  VideoCameraIcon,
  AcademicCapIcon,
  SparklesIcon,
  ClockIcon,
  UserIcon,
  HeartIcon,
  BookmarkIcon,
  ShareIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  LockClosedIcon,
  CloudArrowDownIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import {
  PlayIcon,
  StarIcon as StarIconSolid,
  HeartIcon as HeartIconSolid
} from '@heroicons/react/24/solid';
import Card from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const MyCollections = ({ user, isCreator = false }) => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('photos');
  const [sortBy, setSortBy] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContent, setSelectedContent] = useState(null);
  const [showContentViewer, setShowContentViewer] = useState(false);
  const [filterCreator, setFilterCreator] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // grid, list
  const [downloadProgress, setDownloadProgress] = useState({});
  const [favorites, setFavorites] = useState([]);
  const [showStats, setShowStats] = useState(false);

  // Collection categories with mobile labels
  const categories = [
    { id: 'photos', label: 'Photos', mobileLabel: 'Photos', icon: PhotoIcon, count: 0 },
    { id: 'videos', label: 'Videos', mobileLabel: 'Videos', icon: VideoCameraIcon, count: 0 },
    { id: 'streams', label: 'Streams', mobileLabel: 'Streams', icon: PlayCircleIcon, count: 0 },
    { id: 'classes', label: 'Classes', mobileLabel: 'Classes', icon: StarIcon, count: 0 }
  ];

  // Fetch purchased content
  useEffect(() => {
    fetchCollections();
  }, [user]);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const authToken = await getAuthToken();
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/content/purchased`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Map the purchases to match our expected format
        const mappedContent = (data.purchases || []).map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          type: item.content_type === 'picture' ? 'photo' : item.content_type,
          fileUrl: item.content_url,
          thumbnailUrl: item.thumbnail_url,
          creatorId: item.creator_id,
          creatorName: item.creator_name,
          creatorUsername: item.creator_username,
          purchaseDate: item.purchased_at,
          price: item.price,
          viewCount: item.views || 0,
          likeCount: item.likes || 0,
          downloadable: item.is_downloadable || false,
          downloaded: false
        }));
        setCollections(mappedContent);
        updateCategoryCounts(mappedContent);
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
      // Silently log error without showing toast
    } finally {
      setLoading(false);
    }
  };

  const updateCategoryCounts = (content) => {
    const counts = {
      all: content.length,
      videos: content.filter(c => c.type === 'video').length,
      photos: content.filter(c => c.type === 'photo').length,
      audio: content.filter(c => c.type === 'audio').length,
      classes: content.filter(c => c.type === 'class').length,
      streams: content.filter(c => c.type === 'stream').length,
      favorites: favorites.length
    };

    categories.forEach(cat => {
      cat.count = counts[cat.id] || 0;
    });
  };

  // Filter and sort content
  const filteredContent = collections.filter(item => {
    const matchesTab = activeTab === 'all' || 
                       (activeTab === 'favorites' && favorites.includes(item.id)) ||
                       item.type === activeTab.replace('s', ''); // Remove plural 's'
    
    const matchesSearch = searchQuery === '' || 
                         item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.creatorName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCreator = filterCreator === '' || item.creatorId === filterCreator;
    
    return matchesTab && matchesSearch && matchesCreator;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return new Date(b.purchaseDate) - new Date(a.purchaseDate);
      case 'oldest':
        return new Date(a.purchaseDate) - new Date(b.purchaseDate);
      case 'name':
        return a.title.localeCompare(b.title);
      case 'creator':
        return a.creatorName.localeCompare(b.creatorName);
      case 'mostViewed':
        return (b.viewCount || 0) - (a.viewCount || 0);
      default:
        return 0;
    }
  });

  // Get unique creators for filter
  const uniqueCreators = [...new Set(collections.map(c => c.creatorId))]
    .map(id => {
      const creator = collections.find(c => c.creatorId === id);
      return { id, name: creator?.creatorName, username: creator?.creatorUsername };
    });

  // Handle content actions
  const handleView = async (content) => {
    setSelectedContent(content);
    setShowContentViewer(true);
    
    // Track view
    try {
      const authToken = await getAuthToken();
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/content/view/${content.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  };

  const handleDownload = async (content) => {
    if (!content.downloadable) {
      toast.error('This content is not available for download');
      return;
    }

    setDownloadProgress({ ...downloadProgress, [content.id]: 0 });

    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/content/download/${content.id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();

        // Use the signed URL from backend to download
        const a = document.createElement('a');
        a.href = data.downloadUrl;
        a.download = data.filename || `${content.title}.${content.fileExtension || 'mp4'}`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        toast.success('Download started!');

        // Update local state
        const updatedContent = collections.map(c =>
          c.id === content.id ? { ...c, downloaded: true } : c
        );
        setCollections(updatedContent);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Download failed');
      }
    } catch (error) {
      console.error('Error downloading content:', error);
      toast.error('Download failed');
    } finally {
      setDownloadProgress({ ...downloadProgress, [content.id]: undefined });
    }
  };

  const toggleFavorite = (contentId) => {
    if (favorites.includes(contentId)) {
      setFavorites(favorites.filter(id => id !== contentId));
      toast.success('Removed from favorites');
    } else {
      setFavorites([...favorites, contentId]);
      toast.success('Added to favorites');
    }
  };

  const handleShare = (content) => {
    const shareUrl = `${window.location.origin}/content/${content.id}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Share link copied to clipboard!');
  };

  // Content statistics for creators
  const calculateStats = () => {
    const totalSpent = collections.reduce((sum, c) => sum + (c.purchasePrice || 0), 0);
    const totalViews = collections.reduce((sum, c) => sum + (c.viewCount || 0), 0);
    const avgPrice = collections.length > 0 ? totalSpent / collections.length : 0;
    
    return {
      totalContent: collections.length,
      totalSpent,
      totalViews,
      avgPrice,
      favoriteCreator: uniqueCreators.sort((a, b) => 
        collections.filter(c => c.creatorId === b.id).length - 
        collections.filter(c => c.creatorId === a.id).length
      )[0]?.name || 'N/A'
    };
  };

  const stats = calculateStats();

  // Content type icon
  const getContentIcon = (type) => {
    switch (type) {
      case 'video': return <VideoCameraIcon className="w-5 h-5" />;
      case 'photo': return <PhotoIcon className="w-5 h-5" />;
      case 'audio': return <MusicalNoteIcon className="w-5 h-5" />;
      case 'class': return <AcademicCapIcon className="w-5 h-5" />;
      case 'stream': return <PlayCircleIcon className="w-5 h-5" />;
      case 'bundle': return <SparklesIcon className="w-5 h-5" />;
      default: return <DocumentTextIcon className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 md:py-8 pb-20 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-4 md:mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Collections
              </h1>
            </div>
            
            {/* Stats Button for Creators */}
            {isCreator && (
              <Button
                onClick={() => setShowStats(!showStats)}
                variant="secondary"
                size="sm"
                icon={<ChartBarIcon className="w-4 h-4" />}
              >
                {showStats ? 'Hide Stats' : 'View Stats'}
              </Button>
            )}
          </div>

          {/* Statistics Panel */}
          {showStats && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 shadow-sm"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Content</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.totalContent}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Spent</p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.totalSpent} tokens
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Views</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.totalViews}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Avg. Price</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {Math.round(stats.avgPrice)} tokens
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Favorite Creator</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white truncate">
                    {stats.favoriteCreator}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>


        {/* Category Tabs - Mobile Optimized */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-2 mb-4 md:mb-6">
          <div className="grid grid-cols-4 md:flex md:gap-2 gap-2">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setActiveTab(category.id)}
                className={`
                  relative
                  flex flex-col md:flex-row items-center justify-center
                  gap-0.5 md:gap-2
                  px-1 md:px-4 py-2 md:py-2
                  rounded-lg
                  transition-all
                  min-h-[56px] md:min-h-0
                  ${
                  activeTab === category.id
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg transform scale-105'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                }`}
                aria-label={category.label}
              >
                <category.icon className="w-5 h-5 md:w-4 md:h-4 flex-shrink-0" strokeWidth={activeTab === category.id ? 2 : 1.5} />
                <span className="text-[10px] md:text-sm font-medium leading-tight">
                  <span className="md:hidden">{category.mobileLabel}</span>
                  <span className="hidden md:inline">{category.label}</span>
                </span>
                {category.count > 0 && (
                  <span className={`
                    md:ml-1
                    inline-flex items-center justify-center
                    min-w-[16px] h-4 px-1 md:px-1.5
                    text-[10px] md:text-xs rounded-full
                    font-bold
                    ${
                    activeTab === category.id
                      ? 'bg-white text-purple-600'
                      : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200'
                  }`}>
                    {category.count > 99 ? '99+' : category.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Grid/List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : filteredContent.length === 0 ? (
          <Card className="text-center py-12">
            <FolderIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No content found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchQuery 
                ? "Try adjusting your search or filters"
                : "Start building your collection by purchasing content from creators"}
            </p>
          </Card>
        ) : (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6"
            : "space-y-3 md:space-y-4"
          }>
            {filteredContent.map(content => (
              <motion.div
                key={content.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={viewMode === 'grid' ? '' : 'w-full'}
              >
                <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                  {viewMode === 'grid' ? (
                    // Grid View
                    <>
                      {/* Thumbnail */}
                      <div className="relative aspect-video bg-gray-100 dark:bg-gray-700">
                        {content.thumbnail ? (
                          <img 
                            src={content.thumbnail} 
                            alt={content.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-6xl">
                            {content.emoji || '📦'}
                          </div>
                        )}
                        
                        {/* Type Badge */}
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                          {getContentIcon(content.type)}
                          <span className="capitalize">{content.type}</span>
                        </div>

                        {/* Duration/Count */}
                        {content.duration && (
                          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded text-xs">
                            {content.duration}
                          </div>
                        )}
                        {content.photoCount && (
                          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded text-xs">
                            {content.photoCount} photos
                          </div>
                        )}

                        {/* Downloaded Badge */}
                        {content.downloaded && (
                          <div className="absolute top-2 right-2">
                            <CheckCircleIcon className="w-6 h-6 text-green-500 bg-white rounded-full" />
                          </div>
                        )}
                      </div>

                      {/* Content Info */}
                      <div className="p-3 md:p-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
                          {content.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          by {content.creatorName}
                        </p>
                        
                        {/* Stats */}
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
                          <span className="flex items-center gap-1">
                            <EyeIcon className="w-3 h-3" />
                            {content.viewCount || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            {new Date(content.purchaseDate).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleView(content)}
                            size="sm"
                            className="flex-1"
                            icon={<PlayIcon className="w-4 h-4" />}
                          >
                            View
                          </Button>
                          <button
                            onClick={() => toggleFavorite(content.id)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            {favorites.includes(content.id) ? (
                              <HeartIconSolid className="w-4 h-4 text-red-500" />
                            ) : (
                              <HeartIcon className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                          {content.downloadable && (
                            <button
                              onClick={() => handleDownload(content)}
                              disabled={downloadProgress[content.id] !== undefined}
                              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              {downloadProgress[content.id] !== undefined ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                              ) : (
                                <ArrowDownTrayIcon className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleShare(content)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <ShareIcon className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    // List View
                    <div className="flex gap-3 md:gap-4 p-3 md:p-4">
                      {/* Thumbnail */}
                      <div className="w-24 h-16 md:w-32 md:h-20 flex-shrink-0 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                        {content.thumbnail ? (
                          <img 
                            src={content.thumbnail} 
                            alt={content.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-3xl">
                            {content.emoji || '📦'}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {content.title}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              by {content.creatorName} • {content.creatorUsername}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getContentIcon(content.type)}
                            {content.downloaded && (
                              <CheckCircleIcon className="w-5 h-5 text-green-500" />
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        {content.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                            {content.description}
                          </p>
                        )}

                        {/* Stats and Actions */}
                        <div className="flex items-center justify-between">
                          <div className="hidden md:flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <EyeIcon className="w-4 h-4" />
                              {content.viewCount || 0} views
                            </span>
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="w-4 h-4" />
                              {new Date(content.purchaseDate).toLocaleDateString()}
                            </span>
                            {content.duration && (
                              <span className="flex items-center gap-1">
                                <ClockIcon className="w-4 h-4" />
                                {content.duration}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <CurrencyDollarIcon className="w-4 h-4" />
                              {content.purchasePrice} tokens
                            </span>
                          </div>

                          <div className="flex items-center gap-1 md:gap-2">
                            <Button
                              onClick={() => handleView(content)}
                              size="sm"
                              variant="primary"
                              icon={<PlayIcon className="w-4 h-4" />}
                            >
                              View
                            </Button>
                            <button
                              onClick={() => toggleFavorite(content.id)}
                              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              {favorites.includes(content.id) ? (
                                <HeartIconSolid className="w-5 h-5 text-red-500" />
                              ) : (
                                <HeartIcon className="w-5 h-5 text-gray-400" />
                              )}
                            </button>
                            {content.downloadable && (
                              <button
                                onClick={() => handleDownload(content)}
                                disabled={downloadProgress[content.id] !== undefined}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              >
                                {downloadProgress[content.id] !== undefined ? (
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                                ) : (
                                  <ArrowDownTrayIcon className="w-5 h-5 text-gray-400" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handleShare(content)}
                              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              <ShareIcon className="w-5 h-5 text-gray-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Content Viewer Modal */}
      <AnimatePresence>
        {showContentViewer && selectedContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setShowContentViewer(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Viewer Header */}
              <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedContent.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    by {selectedContent.creatorName}
                  </p>
                </div>
                <button
                  onClick={() => setShowContentViewer(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content Display */}
              <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                {selectedContent.type === 'video' && (
                  <video
                    controls
                    className="w-full rounded-lg"
                    src={selectedContent.contentUrl}
                  />
                )}
                {selectedContent.type === 'photo' && (
                  <img
                    src={selectedContent.contentUrl}
                    alt={selectedContent.title}
                    className="w-full rounded-lg"
                  />
                )}
                {selectedContent.type === 'audio' && (
                  <audio
                    controls
                    className="w-full"
                    src={selectedContent.contentUrl}
                  />
                )}
                {selectedContent.description && (
                  <p className="mt-4 text-gray-600 dark:text-gray-400">
                    {selectedContent.description}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyCollections;