import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  VideoCameraIcon,
  PhotoIcon,
  MicrophoneIcon,
  DocumentTextIcon,
  FolderIcon,
  CloudArrowUpIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  EyeIcon,
  HeartIcon,
  ChatBubbleLeftIcon,
  ShareIcon,
  TrashIcon,
  PencilIcon,
  ChartBarIcon,
  PlayIcon,
  PauseIcon,
  ClockIcon,
  CalendarIcon,
  SparklesIcon,
  FireIcon,
  ArrowTrendingUpIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import {
  StarIcon,
  PlayCircleIcon
} from '@heroicons/react/24/solid';
import Card from './ui/Card';
import Button from './ui/Button';
import toast from 'react-hot-toast';

const EnhancedContentStudio = ({ user }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedContentType, setSelectedContentType] = useState('video');
  const [contentPrice, setContentPrice] = useState('');

  // Content categories
  const categories = [
    { id: 'all', label: 'All Content', icon: FolderIcon, count: 42 },
    { id: 'videos', label: 'Videos', icon: VideoCameraIcon, count: 28 },
    { id: 'photos', label: 'Photos', icon: PhotoIcon, count: 8 },
    { id: 'audio', label: 'Audio', icon: MicrophoneIcon, count: 4 },
    { id: 'posts', label: 'Posts', icon: DocumentTextIcon, count: 2 }
  ];

  // Mock content data
  const contentItems = [
    {
      id: 1,
      title: 'Morning Yoga Flow',
      type: 'video',
      thumbnail: '🧘‍♀️',
      duration: '25:30',
      views: 3420,
      likes: 456,
      comments: 78,
      earnings: 5670,
      uploadDate: '2024-01-10',
      status: 'published',
      engagement: 92,
      trending: true
    },
    {
      id: 2,
      title: 'Behind the Scenes Photoshoot',
      type: 'photo',
      thumbnail: '📸',
      views: 1890,
      likes: 234,
      comments: 45,
      earnings: 2340,
      uploadDate: '2024-01-08',
      status: 'published',
      engagement: 78
    },
    {
      id: 3,
      title: 'Podcast Episode #15',
      type: 'audio',
      thumbnail: '🎙️',
      duration: '45:00',
      views: 890,
      likes: 123,
      comments: 34,
      earnings: 1230,
      uploadDate: '2024-01-05',
      status: 'published',
      engagement: 65
    },
    {
      id: 4,
      title: 'Dance Tutorial',
      type: 'video',
      thumbnail: '💃',
      duration: '15:45',
      views: 5670,
      likes: 789,
      comments: 123,
      earnings: 8900,
      uploadDate: '2024-01-03',
      status: 'published',
      engagement: 95,
      trending: true
    },
    {
      id: 5,
      title: 'New Year Special',
      type: 'video',
      thumbnail: '🎊',
      duration: '30:00',
      views: 2340,
      likes: 345,
      comments: 67,
      earnings: 3450,
      uploadDate: '2024-01-01',
      status: 'scheduled',
      engagement: 88
    }
  ];

  // Filter content
  const filteredContent = contentItems.filter(item => {
    if (activeTab !== 'all' && !item.type.includes(activeTab.slice(0, -1))) return false;
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Sort content
  const sortedContent = [...filteredContent].sort((a, b) => {
    switch (sortBy) {
      case 'popular':
        return b.views - a.views;
      case 'earnings':
        return b.earnings - a.earnings;
      case 'engagement':
        return b.engagement - a.engagement;
      default:
        return new Date(b.uploadDate) - new Date(a.uploadDate);
    }
  });

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'published':
        return 'text-green-600 bg-green-50';
      case 'scheduled':
        return 'text-blue-600 bg-blue-50';
      case 'draft':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const handleUpload = () => {
    setIsUploading(true);
    setUploadProgress(0);
    
    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setShowUploadModal(false);
          // toast.success('Content uploaded successfully!');
          return 100;
        }
        return prev + 10;
      });
    }, 500);
  };

  const renderContentCard = (item) => (
    <motion.div
      key={item.id}
      whileHover={{ y: -4 }}
      className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer"
      onClick={() => {
        setSelectedContent(item);
        setShowDetailsModal(true);
      }}
    >
      {/* Thumbnail */}
      <div className="relative h-48 bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
        <span className="text-6xl">{item.thumbnail}</span>
        
        {/* Status Badge */}
        <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </div>

        {/* Trending Badge */}
        {item.trending && (
          <div className="absolute top-3 right-3 bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <FireIcon className="w-3 h-3" />
            Trending
          </div>
        )}

        {/* Duration */}
        {item.duration && (
          <div className="absolute bottom-3 right-3 bg-black/70 text-white px-2 py-1 rounded text-xs">
            {item.duration}
          </div>
        )}

        {/* Play Button Overlay */}
        {item.type === 'video' && (
          <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
            <PlayCircleIcon className="w-16 h-16 text-white drop-shadow-lg" />
          </div>
        )}
      </div>

      {/* Content Info */}
      <div className="p-5">
        <h3 className="font-bold text-gray-900 mb-2 line-clamp-1">{item.title}</h3>
        
        <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
          <span className="flex items-center gap-1">
            <EyeIcon className="w-4 h-4" />
            {formatNumber(item.views)}
          </span>
          <span className="flex items-center gap-1">
            <HeartIcon className="w-4 h-4" />
            {formatNumber(item.likes)}
          </span>
          <span className="flex items-center gap-1">
            <ChatBubbleLeftIcon className="w-4 h-4" />
            {formatNumber(item.comments)}
          </span>
        </div>

        {/* Earnings & Engagement */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-3">
          <div>
            <p className="text-xs text-gray-500">Earnings</p>
            <p className="font-bold text-purple-600">{item.earnings} tokens</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Engagement</p>
            <p className="font-bold text-pink-600">{item.engagement}%</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // toast.success('Edit mode coming soon!');
            }}
            className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
          >
            <PencilIcon className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(`https://digis.app/content/${item.id}`);
              // toast.success('Share link copied!');
            }}
            className="flex-1 px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
          >
            <ShareIcon className="w-4 h-4" />
            Share
          </button>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl">
                <SparklesIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Content Studio</h1>
                <p className="text-sm text-gray-600">Create and manage your content</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
              >
                <CloudArrowUpIcon className="w-5 h-5" />
                Post Content
              </button>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-purple-100">Total Content</p>
              <p className="text-2xl font-bold">42</p>
            </div>
            <div>
              <p className="text-sm text-purple-100">Total Views</p>
              <p className="text-2xl font-bold">124.5K</p>
            </div>
            <div>
              <p className="text-sm text-purple-100">Total Earnings</p>
              <p className="text-2xl font-bold">89.3K tokens</p>
            </div>
            <div>
              <p className="text-sm text-purple-100">Avg. Engagement</p>
              <p className="text-2xl font-bold">78%</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex">
          {/* Sidebar */}
          <div className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
            <div className="space-y-1">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setActiveTab(category.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === category.id
                      ? 'bg-purple-50 text-purple-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <category.icon className="w-5 h-5" />
                  <span className="flex-1 text-left font-medium">{category.label}</span>
                  <span className="text-sm text-gray-500">{category.count}</span>
                </button>
              ))}
            </div>

            {/* Quick Stats */}
            <div className="mt-8 space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Quick Stats</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">This Month</span>
                  <span className="text-sm font-bold text-gray-900">+23%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full" style={{ width: '73%' }} />
                </div>
              </div>

              <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowTrendingUpIcon className="w-5 h-5 text-purple-600" />
                  <p className="font-semibold text-purple-900">Top Performer</p>
                </div>
                <p className="text-sm text-purple-700">Dance Tutorial</p>
                <p className="text-xs text-purple-600 mt-1">8.9K tokens earned</p>
              </Card>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Search and Filters */}
            <div className="flex gap-4 mb-6">
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
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="recent">Most Recent</option>
                <option value="popular">Most Popular</option>
                <option value="earnings">Highest Earnings</option>
                <option value="engagement">Best Engagement</option>
              </select>
            </div>

            {/* Content Grid */}
            {sortedContent.length === 0 ? (
              <div className="text-center py-16">
                <FolderIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No content found</h3>
                <p className="text-gray-600 mb-6">
                  {searchQuery ? 'Try adjusting your search' : 'Start creating amazing content'}
                </p>
                <Button onClick={() => setShowUploadModal(true)}>
                  <PlusIcon className="w-5 h-5 mr-1" />
                  Upload Your First Content
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {sortedContent.map(renderContentCard)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4"
            onClick={() => !isUploading && setShowUploadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Post Content</h2>
                <button
                  onClick={() => !isUploading && setShowUploadModal(false)}
                  disabled={isUploading}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              {!isUploading ? (
                <>
                  {/* Content Type Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Select Content Type</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <button 
                        onClick={() => setSelectedContentType('video')}
                        className={`p-4 border-2 rounded-xl transition-colors text-center ${
                          selectedContentType === 'video' 
                            ? 'border-purple-500 bg-purple-50' 
                            : 'border-gray-200 hover:border-purple-500'
                        }`}
                      >
                        <VideoCameraIcon className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                        <p className="font-medium">Video</p>
                      </button>
                      <button 
                        onClick={() => setSelectedContentType('photo')}
                        className={`p-4 border-2 rounded-xl transition-colors text-center ${
                          selectedContentType === 'photo' 
                            ? 'border-pink-500 bg-pink-50' 
                            : 'border-gray-200 hover:border-pink-500'
                        }`}
                      >
                        <PhotoIcon className="w-8 h-8 text-pink-600 mx-auto mb-2" />
                        <p className="font-medium">Photo</p>
                      </button>
                      <button 
                        onClick={() => setSelectedContentType('audio')}
                        className={`p-4 border-2 rounded-xl transition-colors text-center ${
                          selectedContentType === 'audio' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-blue-500'
                        }`}
                      >
                        <MicrophoneIcon className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                        <p className="font-medium">Audio</p>
                      </button>
                      <button 
                        onClick={() => setSelectedContentType('post')}
                        className={`p-4 border-2 rounded-xl transition-colors text-center ${
                          selectedContentType === 'post' 
                            ? 'border-green-500 bg-green-50' 
                            : 'border-gray-200 hover:border-green-500'
                        }`}
                      >
                        <DocumentTextIcon className="w-8 h-8 text-green-600 mx-auto mb-2" />
                        <p className="font-medium">Post</p>
                      </button>
                    </div>
                  </div>

                  {/* Upload Area */}
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-purple-500 transition-colors cursor-pointer bg-gray-50"
                    onClick={handleUpload}
                  >
                    <CloudArrowUpIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-xl font-semibold text-gray-700 mb-2">Drop files here or click to browse</p>
                    <p className="text-sm text-gray-500">Support for MP4, JPG, PNG, MP3, and more</p>
                    <p className="text-xs text-gray-400 mt-2">Max file size: 500MB</p>
                  </div>

                  {/* Upload Settings */}
                  <div className="mt-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                      <input
                        type="text"
                        placeholder="Enter content title..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                      <textarea
                        placeholder="Describe your content..."
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Price (Tokens)
                        <span className="text-gray-500 text-xs ml-1">Set how many tokens fans need to access this content</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          value={contentPrice}
                          onChange={(e) => setContentPrice(e.target.value)}
                          placeholder="e.g., 50"
                          className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-600">
                          💰
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Leave empty for free content</p>
                    </div>
                    <div className="flex items-center justify-between pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowUploadModal(false);
                          setContentPrice('');
                          setSelectedContentType('video');
                        }}
                        className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleUpload}
                        className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all"
                      >
                        Upload Content
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* Upload Progress */
                <div className="py-8">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Uploading...</span>
                      <span className="text-sm text-gray-500">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full"
                      />
                    </div>
                  </div>
                  <p className="text-center text-gray-600">Please don't close this window</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4"
            onClick={() => setShowDetailsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{selectedContent.title}</h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Content Preview */}
              <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl h-64 flex items-center justify-center mb-6">
                <span className="text-8xl">{selectedContent.thumbnail}</span>
              </div>

              {/* Analytics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="p-4 text-center">
                  <EyeIcon className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{formatNumber(selectedContent.views)}</p>
                  <p className="text-sm text-gray-600">Views</p>
                </Card>
                <Card className="p-4 text-center">
                  <HeartIcon className="w-8 h-8 text-pink-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{formatNumber(selectedContent.likes)}</p>
                  <p className="text-sm text-gray-600">Likes</p>
                </Card>
                <Card className="p-4 text-center">
                  <ChatBubbleLeftIcon className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{formatNumber(selectedContent.comments)}</p>
                  <p className="text-sm text-gray-600">Comments</p>
                </Card>
                <Card className="p-4 text-center">
                  <ChartBarIcon className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{selectedContent.engagement}%</p>
                  <p className="text-sm text-gray-600">Engagement</p>
                </Card>
              </div>

              {/* Earnings Breakdown */}
              <Card className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Earnings Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">View Revenue</span>
                    <span className="font-bold">{Math.round(selectedContent.earnings * 0.6)} tokens</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Engagement Bonus</span>
                    <span className="font-bold">{Math.round(selectedContent.earnings * 0.3)} tokens</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tips & Gifts</span>
                    <span className="font-bold">{Math.round(selectedContent.earnings * 0.1)} tokens</span>
                  </div>
                  <div className="pt-3 border-t border-purple-200 flex justify-between">
                    <span className="font-bold text-gray-900">Total Earnings</span>
                    <span className="text-xl font-bold text-purple-600">{selectedContent.earnings} tokens</span>
                  </div>
                </div>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1">
                  <PencilIcon className="w-5 h-5 mr-1" />
                  Edit Content
                </Button>
                <Button variant="secondary" className="flex-1">
                  <ShareIcon className="w-5 h-5 mr-1" />
                  Share
                </Button>
                <Button variant="secondary" className="flex-1">
                  <ChartBarIcon className="w-5 h-5 mr-1" />
                  View Full Analytics
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EnhancedContentStudio;