import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useContent } from '../contexts/ContentContext';
import { 
  VideoCameraIcon,
  SignalIcon,
  PencilIcon,
  ChartBarIcon,
  PlusIcon,
  PlayIcon,
  EyeIcon,
  ShareIcon,
  TrashIcon,
  XMarkIcon,
  ArrowUpIcon,
  MagnifyingGlassIcon,
  HeartIcon,
  ChatBubbleLeftIcon,
  SparklesIcon,
  FireIcon,
  ArrowTrendingUpIcon,
  CurrencyDollarIcon,
  PhotoIcon,
  MusicalNoteIcon,
  DocumentTextIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const ContentManagement = ({ user, onGoLive, onContentUpdate }) => {
  const { addCreatorContent, getCreatorContent } = useContent();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all', 'video', 'live', 'scheduled'
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'popular', 'engagement'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContent, setSelectedContent] = useState(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'list'
  const [contentPrice, setContentPrice] = useState('');
  const [contentTitle, setContentTitle] = useState('');
  const [contentDescription, setContentDescription] = useState('');
  const [contentCategory, setContentCategory] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadType, setUploadType] = useState('video'); // 'video', 'photo', 'audio', 'post'
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Initialize content items from context only - no demo data
  const [contentItems, setContentItems] = useState(() => {
    return user?.uid ? getCreatorContent(user.uid) : [];
  });
  
  // Calculate real stats from actual content
  const calculateStats = () => {
    const totalVideos = contentItems.filter(item => item.type === 'video').length;
    const totalViews = contentItems.reduce((sum, item) => sum + (item.views || 0), 0);
    const totalLiveStreams = contentItems.filter(item => item.type === 'live').length;
    const totalLikes = contentItems.reduce((sum, item) => sum + (item.likes || 0), 0);
    const avgEngagement = contentItems.length > 0 
      ? Math.round(contentItems.reduce((sum, item) => sum + (item.engagement || 0), 0) / contentItems.length)
      : 0;

    return [
      { 
        label: 'Total Videos', 
        value: totalVideos.toString(), 
        change: '', 
        icon: VideoCameraIcon,
        color: 'text-blue-600', 
        bgColor: 'bg-blue-100',
        gradient: 'from-blue-400 to-cyan-500'
      },
      { 
        label: 'Total Views', 
        value: totalViews > 999 ? `${(totalViews / 1000).toFixed(1)}K` : totalViews.toString(), 
        change: '', 
        icon: EyeIcon,
        color: 'text-green-600', 
        bgColor: 'bg-green-100',
        gradient: 'from-green-400 to-emerald-500'
      },
      { 
        label: 'Live Streams', 
        value: totalLiveStreams.toString(), 
        change: '', 
        icon: SignalIcon,
        color: 'text-red-600', 
        bgColor: 'bg-red-100',
        gradient: 'from-red-400 to-pink-500'
      },
      { 
        label: 'Engagement Rate', 
        value: `${avgEngagement}%`, 
        change: '', 
        icon: HeartIcon,
        color: 'text-purple-600', 
        bgColor: 'bg-purple-100',
        gradient: 'from-purple-400 to-pink-500'
      }
    ];
  };

  const contentStats = calculateStats();

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Handle drag over
  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  // Handle drag leave
  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  // Handle file drop
  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Handle content upload
  const handleContentUpload = async () => {
    if (!contentTitle || !contentPrice) {
      alert('Please provide a title and price for your content');
      return;
    }

    setUploading(true);
    
    // Simulate upload delay
    setTimeout(() => {
      const newContent = {
        id: contentItems.length + 1,
        title: contentTitle,
        description: contentDescription,
        type: uploadType,
        views: 0,
        likes: 0,
        comments: 0,
        duration: uploadType === 'live' ? 'Scheduled' : '0:00',
        thumbnail: uploadType === 'video' ? '🎬' : uploadType === 'live' ? '📡' : '📱',
        publishedAt: 'Just now',
        earnings: 0,
        engagement: 0,
        status: uploadType === 'live' ? 'scheduled' : 'published',
        price: parseInt(contentPrice)
      };

      // Add to content items
      const updatedContent = [newContent, ...contentItems];
      setContentItems(updatedContent);
      
      // Update context
      if (user?.uid) {
        addCreatorContent(user.uid, updatedContent);
      }
      
      // Call parent callback if provided
      if (onContentUpdate) {
        onContentUpdate(updatedContent);
      }

      // Reset form
      setShowUploadModal(false);
      setContentTitle('');
      setContentDescription('');
      setContentPrice('');
      setSelectedFile(null);
      setUploadType('video');
      setUploading(false);

      // Show success message
      alert('Content uploaded successfully! It will appear in your profile and All Content folder.');
    }, 2000);
  };

  // Filter and sort content
  const filteredContent = contentItems
    .filter(item => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.views - a.views;
        case 'engagement':
          return b.engagement - a.engagement;
        default: // 'recent'
          return b.id - a.id;
      }
    });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              Content Studio
              <SparklesIcon className="w-8 h-8 text-purple-500" />
            </h1>
            <p className="text-gray-600 mt-1">Create, manage, and analyze your content</p>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => setShowUploadModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl hover:from-blue-600 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-2 font-medium">
              <ArrowUpIcon className="w-5 h-5" />
              Post Content
            </button>
          </div>
        </div>

        {/* Content Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {contentStats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group"
              whileHover={{ y: -5 }}
            >
              {/* Background gradient on hover */}
              <div className={`absolute inset-0 bg-gradient-to-r ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    {stat.change}
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-sm text-gray-600 mt-1 font-medium">{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2">
              <div className="flex bg-gray-100 rounded-xl p-1">
                {['all', 'video', 'live', 'scheduled'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filterType === type
                        ? 'bg-white text-purple-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <option value="recent">Most Recent</option>
                <option value="popular">Most Popular</option>
                <option value="engagement">Best Engagement</option>
              </select>

              {/* View Mode Toggle */}
              <div className="flex bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg ${
                    viewMode === 'grid'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Grid view"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg ${
                    viewMode === 'list'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="List view"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Grid/List */}
        {filteredContent.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
            <VideoCameraIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No content yet</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || filterType !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Start sharing your creativity with your audience'}
            </p>
            {!searchQuery && filterType === 'all' && (
              <button 
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-lg transition-all font-medium"
              >
                <ArrowUpIcon className="w-5 h-5" />
                Post Your First Content
              </button>
            )}
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
            : "space-y-4"
          }>
            {filteredContent.map((content, index) => (
              viewMode === 'grid' ? (
                <motion.div
                  key={content.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
                  whileHover={{ y: -5 }}
                >
                  {/* Thumbnail */}
                  <div className="relative h-48 bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center overflow-hidden">
                    <span className="text-6xl group-hover:scale-110 transition-transform duration-300">{content.thumbnail}</span>
                    
                    {/* Overlay with stats on hover */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <button className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium transform scale-90 group-hover:scale-100 transition-transform duration-300 flex items-center gap-2">
                        <PlayIcon className="w-5 h-5" />
                        Preview
                      </button>
                    </div>
                    
                    {/* Status badges */}
                    <div className="absolute top-3 left-3 flex gap-2">
                      {content.type === 'live' && (
                        <div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                          LIVE
                        </div>
                      )}
                      {content.type === 'scheduled' && (
                        <div className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                          SCHEDULED
                        </div>
                      )}
                      {content.engagement >= 80 && (
                        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                          <FireIcon className="w-3 h-3" />
                          HOT
                        </div>
                      )}
                    </div>

                    {/* Duration badge */}
                    {content.duration !== 'Live' && content.duration !== 'Scheduled' && (
                      <div className="absolute bottom-3 right-3 bg-black bg-opacity-80 backdrop-blur text-white px-2 py-1 rounded-lg text-xs font-medium">
                        {content.duration}
                      </div>
                    )}
                  </div>

                  {/* Content info */}
                  <div className="p-5">
                    <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                      {content.title}
                    </h3>
                    
                    <p className="text-sm text-gray-500 mb-3">{content.publishedAt}</p>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mb-4 text-sm">
                      <div className="flex items-center gap-1 text-gray-600">
                        <EyeIcon className="w-4 h-4" />
                        <span>{content.views.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-600">
                        <HeartIcon className="w-4 h-4" />
                        <span>{content.likes}</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-600">
                        <ChatBubbleLeftIcon className="w-4 h-4" />
                        <span>{content.comments}</span>
                      </div>
                    </div>

                    {/* Price, Earnings and engagement */}
                    <div className="space-y-3 mb-4">
                      {/* Price Badge */}
                      <div className="flex items-center justify-center p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                        <div className="text-center">
                          <p className="text-xs text-gray-600 font-medium">Price</p>
                          <p className="text-2xl font-bold text-green-600">{content.price || 0} tokens</p>
                        </div>
                      </div>
                      
                      {/* Earnings and Engagement */}
                      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                        <div>
                          <p className="text-xs text-gray-600">Earnings</p>
                          <p className="font-bold text-purple-600">{content.earnings} tokens</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-600">Engagement</p>
                          <p className="font-bold text-pink-600">{content.engagement}%</p>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1">
                        <PencilIcon className="w-4 h-4" />
                        Edit
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedContent(content);
                          setShowStatsModal(true);
                        }}
                        className="flex-1 px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
                      >
                        <ChartBarIcon className="w-4 h-4" />
                        Stats
                      </button>
                      <button className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
                        <ShareIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                // List View
                <motion.div
                  key={content.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-xl shadow-sm p-6 hover:shadow-lg transition-all duration-300 flex items-center gap-6"
                >
                  {/* Thumbnail */}
                  <div className="relative w-32 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-3xl">{content.thumbnail}</span>
                    {content.type === 'live' && (
                      <div className="absolute -top-2 -right-2 bg-red-600 text-white px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        LIVE
                      </div>
                    )}
                  </div>

                  {/* Content Details */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg mb-1">{content.title}</h3>
                        <p className="text-sm text-gray-500">{content.publishedAt}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {content.engagement >= 80 && (
                          <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            <FireIcon className="w-3 h-3" />
                            HOT
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <EyeIcon className="w-4 h-4" />
                        <span>{content.views.toLocaleString()} views</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <HeartIcon className="w-4 h-4" />
                        <span>{content.likes} likes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ChatBubbleLeftIcon className="w-4 h-4" />
                        <span>{content.comments} comments</span>
                      </div>
                      <div className="flex items-center gap-1 text-purple-600 font-medium">
                        <ArrowTrendingUpIcon className="w-4 h-4" />
                        <span>{content.engagement}% engagement</span>
                      </div>
                    </div>
                  </div>

                  {/* Earnings */}
                  <div className="text-right">
                    <p className="text-sm text-gray-500 mb-1">Earnings</p>
                    <p className="text-xl font-bold text-purple-600">{content.earnings} tokens</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedContent(content);
                        setShowStatsModal(true);
                      }}
                      className="p-2 text-purple-600 hover:text-purple-900 hover:bg-purple-100 rounded-lg transition-colors"
                    >
                      <ChartBarIcon className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                      <ShareIcon className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-lg transition-colors">
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              )
            ))}
          </div>
        )}

        {/* Stats Modal */}
        <AnimatePresence>
          {showStatsModal && selectedContent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowStatsModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Content Analytics</h3>
                    <p className="text-gray-600">{selectedContent.title}</p>
                  </div>
                  <button
                    onClick={() => setShowStatsModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-xl">
                    <EyeIcon className="w-8 h-8 text-blue-600 mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{selectedContent.views.toLocaleString()}</p>
                    <p className="text-sm text-gray-600">Total Views</p>
                  </div>
                  <div className="bg-gradient-to-br from-pink-50 to-red-50 p-4 rounded-xl">
                    <HeartIcon className="w-8 h-8 text-pink-600 mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{selectedContent.likes}</p>
                    <p className="text-sm text-gray-600">Likes</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-4 rounded-xl">
                    <ChatBubbleLeftIcon className="w-8 h-8 text-purple-600 mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{selectedContent.comments}</p>
                    <p className="text-sm text-gray-600">Comments</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl">
                    <ArrowTrendingUpIcon className="w-8 h-8 text-green-600 mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{selectedContent.engagement}%</p>
                    <p className="text-sm text-gray-600">Engagement</p>
                  </div>
                </div>

                {/* Earnings Section */}
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-xl mb-8">
                  <h4 className="text-lg font-bold text-gray-900 mb-4">Earnings Breakdown</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Views Revenue</span>
                      <span className="font-bold text-gray-900">{Math.round(selectedContent.earnings * 0.6)} tokens</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Engagement Bonus</span>
                      <span className="font-bold text-gray-900">{Math.round(selectedContent.earnings * 0.3)} tokens</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Tips & Donations</span>
                      <span className="font-bold text-gray-900">{Math.round(selectedContent.earnings * 0.1)} tokens</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between items-center">
                      <span className="font-bold text-gray-900">Total Earnings</span>
                      <span className="text-2xl font-bold text-orange-600">{selectedContent.earnings} tokens</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium">
                    View Detailed Analytics
                  </button>
                  <button className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium">
                    Download Report
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Modal */}
        <AnimatePresence>
          {showUploadModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowUploadModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Post Content</h3>
                    <p className="text-gray-600">Share your creativity with your audience</p>
                  </div>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Content Details */}
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Content Title
                    </label>
                    <input
                      type="text"
                      value={contentTitle}
                      onChange={(e) => setContentTitle(e.target.value)}
                      placeholder="Enter a catchy title for your content"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={contentDescription}
                      onChange={(e) => setContentDescription(e.target.value)}
                      placeholder="Describe what your content is about..."
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={contentCategory}
                      onChange={(e) => setContentCategory(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Select a category</option>
                      <option value="education">Education</option>
                      <option value="entertainment">Entertainment</option>
                      <option value="fitness">Fitness & Health</option>
                      <option value="lifestyle">Lifestyle</option>
                      <option value="music">Music</option>
                      <option value="gaming">Gaming</option>
                      <option value="cooking">Cooking</option>
                      <option value="art">Art & Design</option>
                      <option value="technology">Technology</option>
                      <option value="business">Business</option>
                      <option value="travel">Travel</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Content Type Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Content Type
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button
                      type="button"
                      onClick={() => setUploadType('video')}
                      className={`border-2 rounded-xl p-4 text-center transition-all ${
                        uploadType === 'video' 
                          ? 'border-purple-500 bg-purple-50 shadow-md' 
                          : 'border-gray-300 hover:border-purple-300 bg-white'
                      }`}
                    >
                      <VideoCameraIcon className={`w-8 h-8 mx-auto mb-2 ${
                        uploadType === 'video' ? 'text-purple-600' : 'text-gray-600'
                      }`} />
                      <span className={`text-sm font-medium ${
                        uploadType === 'video' ? 'text-purple-900' : 'text-gray-700'
                      }`}>Video</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setUploadType('photo')}
                      className={`border-2 rounded-xl p-4 text-center transition-all ${
                        uploadType === 'photo' 
                          ? 'border-pink-500 bg-pink-50 shadow-md' 
                          : 'border-gray-300 hover:border-pink-300 bg-white'
                      }`}
                    >
                      <PhotoIcon className={`w-8 h-8 mx-auto mb-2 ${
                        uploadType === 'photo' ? 'text-pink-600' : 'text-gray-600'
                      }`} />
                      <span className={`text-sm font-medium ${
                        uploadType === 'photo' ? 'text-pink-900' : 'text-gray-700'
                      }`}>Photo</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setUploadType('audio')}
                      className={`border-2 rounded-xl p-4 text-center transition-all ${
                        uploadType === 'audio' 
                          ? 'border-blue-500 bg-blue-50 shadow-md' 
                          : 'border-gray-300 hover:border-blue-300 bg-white'
                      }`}
                    >
                      <MusicalNoteIcon className={`w-8 h-8 mx-auto mb-2 ${
                        uploadType === 'audio' ? 'text-blue-600' : 'text-gray-600'
                      }`} />
                      <span className={`text-sm font-medium ${
                        uploadType === 'audio' ? 'text-blue-900' : 'text-gray-700'
                      }`}>Audio</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setUploadType('post')}
                      className={`border-2 rounded-xl p-4 text-center transition-all ${
                        uploadType === 'post' 
                          ? 'border-green-500 bg-green-50 shadow-md' 
                          : 'border-gray-300 hover:border-green-300 bg-white'
                      }`}
                    >
                      <DocumentTextIcon className={`w-8 h-8 mx-auto mb-2 ${
                        uploadType === 'post' ? 'text-green-600' : 'text-gray-600'
                      }`} />
                      <span className={`text-sm font-medium ${
                        uploadType === 'post' ? 'text-green-900' : 'text-gray-700'
                      }`}>Post</span>
                    </button>
                  </div>
                </div>

                {/* Upload Area */}
                <div className="mb-6">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    accept={uploadType === 'video' ? 'video/*' : uploadType === 'photo' ? 'image/*' : uploadType === 'audio' ? 'audio/*' : '*/*'}
                    className="hidden"
                  />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                      isDragging ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-purple-500 bg-gray-50'
                    }`}
                  >
                    {selectedFile ? (
                      <div className="space-y-2">
                        <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <p className="text-xl font-semibold text-gray-900">{selectedFile.name}</p>
                        <p className="text-gray-500">
                          Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                          }}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <>
                        <ArrowUpIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-xl font-semibold text-gray-700 mb-2">
                          {isDragging ? 'Drop your file here' : 'Drag and drop your file here'}
                        </p>
                        <p className="text-gray-500 mb-4">or</p>
                        <button 
                          type="button"
                          className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium"
                        >
                          Browse Files
                        </button>
                        <p className="text-sm text-gray-500 mt-4">
                          {uploadType === 'video' ? 'Supported formats: MP4, MOV, AVI (Max 5GB)' :
                           uploadType === 'photo' ? 'Supported formats: JPG, PNG, GIF (Max 50MB)' :
                           uploadType === 'audio' ? 'Supported formats: MP3, WAV, M4A (Max 100MB)' :
                           'All file types supported (Max 5GB)'}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Content Pricing */}
                <div className="mt-6 p-6 bg-purple-50 rounded-xl border border-purple-200">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CurrencyDollarIcon className="w-5 h-5 text-purple-600" />
                    Content Pricing
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Set Content Price (in tokens)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={contentPrice}
                          onChange={(e) => setContentPrice(e.target.value)}
                          placeholder="e.g., 100"
                          className="w-full px-4 py-2 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          min="0"
                          step="10"
                        />
                        <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm font-medium">
                          tokens
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        This content will appear in your profile's content section
                      </p>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-purple-700 bg-purple-100 p-3 rounded-lg">
                      <SparklesIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        Set an attractive price to encourage more fans to purchase your exclusive content. 
                        You can always adjust the price later.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Upload Button */}
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setContentTitle('');
                      setContentDescription('');
                      setContentPrice('');
                      setSelectedFile(null);
                    }}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleContentUpload()}
                    disabled={!contentTitle || !contentPrice || uploading}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <ArrowUpIcon className="w-5 h-5" />
                        Post Content
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ContentManagement;