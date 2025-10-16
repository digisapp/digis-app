import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  PhotoIcon,
  VideoCameraIcon,
  PlusIcon,
  SparklesIcon,
  EyeIcon,
  HeartIcon,
  ShareIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  PlayIcon,
  PauseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowsPointingOutIcon,
  CurrencyDollarIcon,
  ClockIcon,
  FireIcon,
  MusicalNoteIcon,
  SpeakerWaveIcon,
  SignalIcon,
  ShoppingBagIcon,
  CameraIcon,
  ChevronDownIcon,
  Squares2X2Icon,
  InformationCircleIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid, StarIcon, LockClosedIcon } from '@heroicons/react/24/solid';
import ContentUploadModal from './ContentUploadModal';
import toast from 'react-hot-toast';

const ModernContentGallery = ({
  photos = [],
  videos = [],
  audios = [],
  streams = [],
  shopProducts = [],
  digitals = [],
  onAddContent,
  onEditContent,
  onDeleteContent,
  onViewDetails,
  onPurchaseContent,
  userPurchases = [],
  analytics = {},
  onAnalyticsUpdate,
  onAddDigital,
  user,
  onUpdateProfile
}) => {
  const [activeTab, setActiveTab] = useState('photos');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [contentAnalytics, setContentAnalytics] = useState({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadContentType, setUploadContentType] = useState('photo');
  const [showMobileTabMenu, setShowMobileTabMenu] = useState(false);
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [aboutData, setAboutData] = useState({
    bio: user?.bio || '',
    whatIOffer: user?.whatIOffer || '',
    availability: user?.availability || ''
  });
  const scrollRef = useRef(null);
  const intervalRef = useRef(null);

  // Combine all content with type tags
  const getAllContent = () => {
    const taggedPhotos = photos.map(p => ({ ...p, type: 'photo' }));
    const taggedVideos = videos.map(v => ({ ...v, type: 'video' }));
    const taggedAudios = audios.map(a => ({ ...a, type: 'audio' }));
    const taggedStreams = streams.map(s => ({ ...s, type: 'stream' }));
    const taggedShopProducts = shopProducts.map(p => ({ ...p, type: 'product' }));
    const taggedDigitals = digitals.map(d => ({ ...d, type: 'digital' }));
    
    switch(activeTab) {
      case 'about':
        return []; // About tab doesn't show media content
      case 'videos':
        return taggedVideos;
      case 'streams':
        return taggedStreams;
      case 'shop':
        return taggedShopProducts;
      case 'digitals':
        return taggedDigitals;
      case 'photos':
        return taggedPhotos;
      default:
        return taggedPhotos;
    }
  };

  const currentContent = getAllContent();
  const currentItem = currentContent[selectedIndex] || {};

  // Initialize analytics on mount
  useEffect(() => {
    // Load saved analytics from localStorage
    const savedAnalytics = localStorage.getItem('contentGalleryAnalytics');
    if (savedAnalytics) {
      setContentAnalytics(JSON.parse(savedAnalytics));
    }
  }, []);

  // Save analytics to localStorage whenever it changes
  useEffect(() => {
    if (Object.keys(contentAnalytics).length > 0) {
      localStorage.setItem('contentGalleryAnalytics', JSON.stringify(contentAnalytics));
    }
  }, [contentAnalytics]);

  // Separate effect for onAnalyticsUpdate to prevent infinite loops
  useEffect(() => {
    if (Object.keys(contentAnalytics).length > 0 && onAnalyticsUpdate) {
      onAnalyticsUpdate(contentAnalytics);
    }
  }, [contentAnalytics]); // Removed onAnalyticsUpdate from deps to prevent infinite loop

  // Track content view
  const trackView = useCallback((item) => {
    if (!item || !item.id) return;
    
    setContentAnalytics(prev => {
      const itemAnalytics = prev[item.id] || {
        views: 0,
        likes: 0,
        shares: 0,
        purchases: 0,
        lastViewed: null,
        totalViewTime: 0,
        avgEngagement: 0
      };
      
      return {
        ...prev,
        [item.id]: {
          ...itemAnalytics,
          views: itemAnalytics.views + 1,
          lastViewed: new Date().toISOString()
        }
      };
    });
  }, []);

  // Track content interaction
  const trackInteraction = useCallback((item, type) => {
    if (!item || !item.id) return;
    
    setContentAnalytics(prev => {
      const itemAnalytics = prev[item.id] || {
        views: 0,
        likes: 0,
        shares: 0,
        purchases: 0,
        lastViewed: null,
        totalViewTime: 0,
        avgEngagement: 0
      };
      
      const updates = { ...itemAnalytics };
      
      switch(type) {
        case 'like':
          updates.likes = itemAnalytics.likes + 1;
          break;
        case 'share':
          updates.shares = itemAnalytics.shares + 1;
          break;
        case 'purchase':
          updates.purchases = itemAnalytics.purchases + 1;
          break;
      }
      
      // Calculate engagement score
      updates.avgEngagement = Math.round(
        ((updates.likes * 2) + (updates.shares * 3) + (updates.purchases * 5)) / 
        Math.max(updates.views, 1) * 100
      );
      
      return {
        ...prev,
        [item.id]: updates
      };
    });
  }, []);

  // Track view on item change
  useEffect(() => {
    if (currentItem && currentItem.id) {
      trackView(currentItem);
    }
  }, [currentItem, trackView]);

  // Get analytics for an item
  const getItemAnalytics = (itemId) => {
    return contentAnalytics[itemId] || {
      views: Math.floor(Math.random() * 5000),
      likes: Math.floor(Math.random() * 500),
      shares: Math.floor(Math.random() * 100),
      purchases: 0,
      avgEngagement: Math.floor(Math.random() * 100)
    };
  };

  // Calculate total analytics
  const calculateTotalAnalytics = () => {
    const allItems = getAllContent();
    let totalViews = 0;
    let totalLikes = 0;
    let totalShares = 0;
    let totalPurchases = 0;
    let totalRevenue = 0;
    
    allItems.forEach(item => {
      const itemAnalytics = getItemAnalytics(item.id);
      totalViews += itemAnalytics.views;
      totalLikes += itemAnalytics.likes;
      totalShares += itemAnalytics.shares;
      totalPurchases += itemAnalytics.purchases;
      
      if (item.ppv_price && itemAnalytics.purchases) {
        totalRevenue += item.ppv_price * itemAnalytics.purchases;
      }
    });
    
    return {
      totalViews,
      totalLikes,
      totalShares,
      totalPurchases,
      totalRevenue,
      avgEngagement: allItems.length > 0 
        ? Math.round((totalLikes + totalShares * 2) / Math.max(totalViews, 1) * 100)
        : 0
    };
  };

  // Check if content is purchased or unlocked
  const isContentUnlocked = (item) => {
    if (!item.is_premium && !item.ppv_price) return true;
    return userPurchases.includes(item.id);
  };

  // Handle content click - either view or purchase
  const handleContentClick = (item) => {
    if (isContentUnlocked(item)) {
      if (onViewDetails) {
        onViewDetails(item);
      }
    } else {
      if (onPurchaseContent) {
        onPurchaseContent(item);
        trackInteraction(item, 'purchase');
      }
    }
  };

  // Auto-play carousel
  useEffect(() => {
    if (isPlaying && currentContent.length > 1) {
      intervalRef.current = setInterval(() => {
        setSelectedIndex((prev) => (prev + 1) % currentContent.length);
      }, 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, currentContent.length]);

  const tabs = [
    { id: 'photos', label: 'Photos', icon: PhotoIcon, count: photos.length, color: 'from-purple-500 to-pink-500' },
    { id: 'videos', label: 'Videos', icon: VideoCameraIcon, count: videos.length, color: 'from-blue-500 to-cyan-500' },
    { id: 'streams', label: 'Streams', icon: SignalIcon, count: streams.length, color: 'from-indigo-500 to-purple-500' },
    { id: 'about', label: 'About', icon: InformationCircleIcon, count: 0, color: 'from-indigo-500 to-blue-500' },
    { id: 'digitals', label: 'Digitals', icon: CameraIcon, count: digitals.length, color: 'from-teal-500 to-cyan-500' },
    { id: 'shop', label: 'Shop', icon: ShoppingBagIcon, count: shopProducts.length, color: 'from-green-500 to-emerald-500' }
  ];

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSelectedIndex(0);
    setIsPlaying(true);
  };

  const handleThumbnailClick = (index) => {
    setSelectedIndex(index);
    setIsPlaying(false);
  };

  const handlePrevious = () => {
    setSelectedIndex((prev) => (prev - 1 + currentContent.length) % currentContent.length);
    setIsPlaying(false);
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev + 1) % currentContent.length);
    setIsPlaying(false);
  };

  // Smooth scroll to selected thumbnail
  useEffect(() => {
    if (scrollRef.current) {
      const thumbnail = scrollRef.current.children[selectedIndex];
      if (thumbnail) {
        thumbnail.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  return (
    <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-3xl overflow-hidden shadow-2xl">
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500 rounded-full filter blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-pink-500 rounded-full filter blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500 rounded-full filter blur-3xl animate-pulse delay-2000" />
      </div>

      {/* Glass Container */}
      <div className="relative backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 rounded-2xl sm:rounded-3xl p-4 sm:p-6">
        
        {/* Header with Tabs - Responsive Design */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          {/* Mobile Tab Selector and Add Button - Shows on small screens */}
          <div className="sm:hidden w-full flex items-center gap-2">
            <button
              onClick={() => setShowMobileTabMenu(!showMobileTabMenu)}
              className="flex-1 px-4 py-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Squares2X2Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <span className="font-medium text-gray-900 dark:text-white">
                  {tabs.find(t => t.id === activeTab)?.label || 'All'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r ${tabs.find(t => t.id === activeTab)?.color || 'from-purple-500 to-pink-500'} text-white`}>
                  {tabs.find(t => t.id === activeTab)?.count || 0}
                </span>
              </div>
              <ChevronDownIcon className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${showMobileTabMenu ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Mobile Add/Edit Button */}
            {activeTab !== 'about' ? (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (activeTab === 'digitals' && onAddDigital) {
                    onAddDigital();
                  } else if (onAddContent) {
                    onAddContent(activeTab);
                  }
                }}
                className="px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium shadow-lg flex items-center gap-1"
              >
                <PlusIcon className="w-5 h-5" />
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsEditingAbout(true)}
                className="px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium shadow-lg flex items-center gap-1"
              >
                <PencilIcon className="w-5 h-5" />
              </motion.button>
            )}
            
            {/* Mobile Dropdown Menu */}
            <AnimatePresence>
              {showMobileTabMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute left-4 right-4 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl z-50 overflow-hidden"
                >
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        handleTabChange(tab.id);
                        setShowMobileTabMenu(false);
                      }}
                      className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        activeTab === tab.id ? 'bg-gray-50 dark:bg-gray-700' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <tab.icon className={`w-5 h-5 ${
                          activeTab === tab.id
                            ? 'text-transparent bg-clip-text bg-gradient-to-r ' + tab.color
                            : 'text-gray-600 dark:text-gray-400'
                        }`} />
                        <span className={`font-medium ${
                          activeTab === tab.id
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {tab.label}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        activeTab === tab.id
                          ? 'bg-gradient-to-r ' + tab.color + ' text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Desktop Tabs Container - Hidden on mobile */}
          <div className="hidden sm:flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 lg:pb-0">
            {tabs.map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`relative px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl transition-all duration-300 flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-800 shadow-xl'
                    : 'hover:bg-white/50 dark:hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center gap-1 sm:gap-2">
                  <tab.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${
                    activeTab === tab.id
                      ? 'text-transparent bg-clip-text bg-gradient-to-r ' + tab.color
                      : 'text-gray-600 dark:text-gray-400'
                  }`} />
                  <span className={`font-medium text-sm sm:text-base ${
                    activeTab === tab.id
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-400'
                  } ${tab.count === 0 ? 'hidden sm:inline' : ''}`}>
                    {tab.label}
                  </span>
                  <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r ' + tab.color + ' text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {tab.count}
                  </span>
                </div>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${tab.color}`}
                  />
                )}
              </motion.button>
            ))}
          </div>

          {/* Desktop Add Content/Edit About Button - Hidden on mobile */}
          <div className="hidden sm:flex items-center justify-end lg:justify-center">
            {activeTab !== 'about' ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (activeTab === 'digitals' && onAddDigital) {
                    onAddDigital();
                  } else if (onAddContent) {
                    // Always use onAddContent callback, passing the active tab
                    onAddContent(activeTab);
                  }
                }}
                className="px-3 sm:px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-1 sm:gap-2 text-sm sm:text-base whitespace-nowrap"
              >
                <PlusIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">
                  {activeTab === 'shop' ? 'Add Product' : activeTab === 'digitals' ? 'Add Digital' : 'Add Content'}
                </span>
                <span className="sm:hidden">Add</span>
              </motion.button>
            ) : (
              !isEditingAbout && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsEditingAbout(true)}
                  className="px-3 sm:px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-1 sm:gap-2 text-sm sm:text-base whitespace-nowrap"
                >
                  <PencilIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Edit About</span>
                  <span className="sm:hidden">Edit</span>
                </motion.button>
              )
            )}
          </div>
        </div>

        {activeTab === 'about' ? (
          /* About Tab Content */
          <div className="p-6 md:p-8 space-y-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Your Profile</h2>
              {isEditingAbout && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsEditingAbout(false);
                      setAboutData({
                        bio: user?.bio || '',
                        whatIOffer: user?.whatIOffer || '',
                        availability: user?.availability || ''
                      });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5" />
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        if (onUpdateProfile) {
                          await onUpdateProfile(aboutData);
                        }
                        toast.success('Profile updated successfully!');
                        setIsEditingAbout(false);
                      } catch (error) {
                        console.error('Error updating profile:', error);
                        toast.error('Failed to update profile');
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <CheckIcon className="w-5 h-5" />
                    Save Changes
                  </button>
                </div>
              )}
            </div>

            {/* Bio Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">About Me</h3>
              {isEditingAbout ? (
                <textarea
                  value={aboutData.bio}
                  onChange={(e) => setAboutData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell your fans about yourself..."
                  className="w-full p-4 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-200 dark:border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none resize-none"
                  rows={6}
                />
              ) : (
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {aboutData.bio || "No bio added yet. Click 'Edit Profile' to add one."}
                </p>
              )}
            </div>

            {/* What I Offer Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">What I Offer</h3>
              {isEditingAbout ? (
                <textarea
                  value={aboutData.whatIOffer}
                  onChange={(e) => setAboutData(prev => ({ ...prev, whatIOffer: e.target.value }))}
                  placeholder="Describe the services and content you offer to fans..."
                  className="w-full p-4 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-200 dark:border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none resize-none"
                  rows={4}
                />
              ) : (
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {aboutData.whatIOffer || "Describe what you offer to your fans. Click 'Edit Profile' to add details."}
                </p>
              )}
            </div>

            {/* Availability Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Availability</h3>
              {isEditingAbout ? (
                <textarea
                  value={aboutData.availability}
                  onChange={(e) => setAboutData(prev => ({ ...prev, availability: e.target.value }))}
                  placeholder="Let fans know when you're typically available (e.g., Monday-Friday 9AM-6PM EST)..."
                  className="w-full p-4 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-200 dark:border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none resize-none"
                  rows={3}
                />
              ) : (
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {aboutData.availability || "Add your availability schedule. Click 'Edit Profile' to add details."}
                </p>
              )}
            </div>

          </div>
        ) : currentContent.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20">
            <div className="p-6 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 mb-6">
              {activeTab === 'videos' ? (
                <VideoCameraIcon className="w-16 h-16 text-gray-400" />
              ) : activeTab === 'audios' ? (
                <SpeakerWaveIcon className="w-16 h-16 text-gray-400" />
              ) : activeTab === 'streams' ? (
                <SignalIcon className="w-16 h-16 text-gray-400" />
              ) : activeTab === 'digitals' ? (
                <CameraIcon className="w-16 h-16 text-gray-400" />
              ) : activeTab === 'shop' ? (
                <ShoppingBagIcon className="w-16 h-16 text-gray-400" />
              ) : (
                <PhotoIcon className="w-16 h-16 text-gray-400" />
              )}
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              No {activeTab === 'all' ? 'content' : activeTab} yet
            </h3>
          </div>
        ) : (
          <>
            {/* Grid Display */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {currentContent.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative aspect-[4/5] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:shadow-xl transition-shadow"
                  onClick={() => handleContentClick(item)}
                >
                  {item.type === 'video' || item.type === 'audio' || item.type === 'stream' ? (
                    <>
                      <img
                        src={currentItem.thumbnail_url || '/video-placeholder.jpg'}
                        alt={currentItem.title || 'Video'}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          className="w-24 h-24 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center cursor-pointer"
                        >
                          {currentItem.type === 'audio' ? (
                            <MusicalNoteIcon className="w-12 h-12 text-white" />
                          ) : currentItem.type === 'stream' ? (
                            <SignalIcon className="w-12 h-12 text-white" />
                          ) : (
                            <PlayIcon className="w-12 h-12 text-white ml-1" />
                          )}
                        </motion.div>
                      </div>
                    </>
                  ) : (
                    <>
                      <img
                        src={currentItem.url || currentItem.image_url || currentItem.thumbnail_url || '/placeholder.jpg'}
                        alt={currentItem.title || currentItem.name || 'Content'}
                        className={`w-full h-full object-contain bg-black ${!isContentUnlocked(currentItem) ? 'filter blur-xl' : ''}`}
                      />
                      {!isContentUnlocked(currentItem) && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="text-center"
                          >
                            <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                              <LockClosedIcon className="w-10 h-10 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Premium Content</h3>
                            {currentItem.ppv_price && (
                              <div className="flex items-center justify-center gap-2 mb-4">
                                <CurrencyDollarIcon className="w-6 h-6 text-yellow-400" />
                                <span className="text-3xl font-bold text-yellow-400">{currentItem.ppv_price}</span>
                                <span className="text-white">tokens</span>
                              </div>
                            )}
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleContentClick(currentItem)}
                              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-semibold shadow-xl hover:shadow-2xl transition-all"
                            >
                              Unlock Now
                            </motion.button>
                          </motion.div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Simple Title Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                    <h3 className="text-lg font-semibold text-white">
                      {currentItem.title || currentItem.name || 'Untitled'}
                    </h3>
                  </div>

                  {/* Premium/PPV Badge */}
                  {(currentItem.is_premium || currentItem.ppv_price) && (
                    <div className="absolute top-4 right-4">
                      {currentItem.ppv_price ? (
                        <div className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full shadow-lg flex items-center gap-2">
                          <CurrencyDollarIcon className="w-5 h-5 text-white" />
                          <span className="text-white font-bold">{currentItem.ppv_price} tokens</span>
                        </div>
                      ) : (
                        <div className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-lg flex items-center gap-2">
                          <StarIcon className="w-5 h-5 text-white" />
                          <span className="text-white font-bold">Premium</span>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Navigation Arrows - These should be outside the grid, inside the content section */}
            <div className="relative mt-6">
              {/* Film Strip - moved here */}
              <button
                onClick={handlePrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/20 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 hover:bg-white/30 transition-all duration-300"
              >
                <ChevronLeftIcon className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/20 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 hover:bg-white/30 transition-all duration-300"
              >
                <ChevronRightIcon className="w-6 h-6 text-white" />
              </button>

              {/* Progress Bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  initial={{ width: '0%' }}
                  animate={{ width: `${((selectedIndex + 1) / currentContent.length) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Film Strip */}
            <div className="relative">
              <div
                ref={scrollRef}
                className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
                style={{ scrollBehavior: 'smooth' }}
              >
                {currentContent.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleThumbnailClick(index)}
                    onMouseEnter={() => setHoveredItem(index)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={`relative flex-shrink-0 w-32 h-20 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ${
                      index === selectedIndex
                        ? 'ring-2 ring-purple-500 scale-105'
                        : 'hover:scale-105'
                    }`}
                  >
                    {item.type === 'video' || item.type === 'audio' || item.type === 'stream' ? (
                      <>
                        <img
                          src={item.thumbnail_url || '/video-placeholder.jpg'}
                          alt={item.title || 'Video'}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center">
                            {item.type === 'audio' ? (
                              <MusicalNoteIcon className="w-4 h-4 text-white" />
                            ) : item.type === 'stream' ? (
                              <SignalIcon className="w-4 h-4 text-white" />
                            ) : (
                              <PlayIcon className="w-4 h-4 text-white" />
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <img
                          src={item.url || item.image_url || item.thumbnail_url || '/placeholder.jpg'}
                          alt={item.title || item.name || 'Item'}
                          className={`w-full h-full object-cover ${!isContentUnlocked(item) ? 'filter blur-sm' : ''}`}
                        />
                        {!isContentUnlocked(item) && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <LockClosedIcon className="w-6 h-6 text-white" />
                          </div>
                        )}
                      </>
                    )}

                    {/* Hover Overlay */}
                    <AnimatePresence>
                      {hoveredItem === index && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 bg-black/60 flex items-center justify-center"
                        >
                          <p className="text-white text-xs font-medium text-center px-2">
                            {item.title || item.name || 'Untitled'}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Type Badge */}
                    <div className={`absolute top-1 left-1 px-2 py-0.5 rounded-full text-xs font-bold text-white ${
                      item.type === 'video' ? 'bg-blue-500' :
                      item.type === 'audio' ? 'bg-rose-500' :
                      item.type === 'stream' ? 'bg-indigo-500' :
                      item.type === 'product' ? 'bg-green-500' :
                      'bg-purple-500'
                    }`}>
                      {item.type === 'video' ? '🎬' :
                       item.type === 'audio' ? '🎵' :
                       item.type === 'stream' ? '📡' :
                       item.type === 'product' ? '🛍️' :
                       '📸'}
                    </div>

                    {(item.is_premium || item.ppv_price) && (
                      <div className="absolute top-1 right-1">
                        {item.ppv_price ? (
                          <div className="px-2 py-0.5 bg-yellow-500 rounded-full flex items-center gap-1">
                            <span className="text-xs font-bold text-white">{item.ppv_price}</span>
                          </div>
                        ) : (
                          <StarIcon className="w-4 h-4 text-yellow-400" />
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Analytics Dashboard */}
            <AnimatePresence>
              {showAnalytics ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6 space-y-4"
                >
                  {/* Main Analytics Stats */}
                  <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Content Performance Analytics</h3>
                    
                    {(() => {
                      const totalStats = calculateTotalAnalytics();
                      const itemAnalytics = currentItem.id ? getItemAnalytics(currentItem.id) : null;
                      
                      return (
                        <>
                          {/* Total Stats */}
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2">
                                <EyeIcon className="w-5 h-5 text-blue-500" />
                                <span className="text-xs text-green-500">+12%</span>
                              </div>
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {totalStats.totalViews.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">Total Views</p>
                            </div>
                            
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2">
                                <HeartSolid className="w-5 h-5 text-red-500" />
                                <span className="text-xs text-green-500">+8%</span>
                              </div>
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {totalStats.totalLikes.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">Total Likes</p>
                            </div>
                            
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2">
                                <ShareIcon className="w-5 h-5 text-purple-500" />
                                <span className="text-xs text-green-500">+25%</span>
                              </div>
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {totalStats.totalShares.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">Total Shares</p>
                            </div>
                            
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2">
                                <CurrencyDollarIcon className="w-5 h-5 text-green-500" />
                                <span className="text-xs text-green-500">+30%</span>
                              </div>
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {totalStats.totalRevenue.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">Revenue (tokens)</p>
                            </div>
                            
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2">
                                <ArrowTrendingUpIcon className="w-5 h-5 text-indigo-500" />
                                <span className="text-xs text-green-500">+{totalStats.avgEngagement}%</span>
                              </div>
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {totalStats.avgEngagement}%
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">Engagement</p>
                            </div>
                          </div>
                          
                          {/* Current Item Analytics */}
                          {itemAnalytics && (
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                Current Item: {currentItem.title || currentItem.name || 'Untitled'}
                              </h4>
                              <div className="grid grid-cols-4 gap-3">
                                <div className="text-center">
                                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                                    {itemAnalytics.views}
                                  </p>
                                  <p className="text-xs text-gray-500">Views</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                                    {itemAnalytics.likes}
                                  </p>
                                  <p className="text-xs text-gray-500">Likes</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                                    {itemAnalytics.shares}
                                  </p>
                                  <p className="text-xs text-gray-500">Shares</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                                    {itemAnalytics.avgEngagement}%
                                  </p>
                                  <p className="text-xs text-gray-500">Engagement</p>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Top Performing Content */}
                          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                              Top Performing Content
                            </h4>
                            <div className="space-y-2">
                              {currentContent.slice(0, 3).map((item, index) => {
                                const stats = getItemAnalytics(item.id);
                                return (
                                  <div key={item.id || index} className="flex items-center justify-between p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                      <span className="text-lg font-bold text-gray-500">#{index + 1}</span>
                                      <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                          {item.title || item.name || 'Untitled'}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {item.type} • {stats.views} views
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-bold text-green-600">{stats.avgEngagement}%</p>
                                      <p className="text-xs text-gray-500">engagement</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="flex gap-3">
                    <button className="flex-1 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-medium hover:bg-purple-200 dark:hover:bg-purple-900/40 transition-colors">
                      Export Analytics
                    </button>
                    <button 
                      onClick={() => {
                        setContentAnalytics({});
                        localStorage.removeItem('contentGalleryAnalytics');
                        toast.success('Analytics reset successfully');
                      }}
                      className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
                    >
                      Reset Analytics
                    </button>
                  </div>
                </motion.div>
              ) : (
                /* Simple Analytics Bar */
                <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl">
                  <div className="grid grid-cols-4 gap-4">
                    {(() => {
                      const totalStats = calculateTotalAnalytics();
                      return (
                        <>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-2 mb-1">
                              <FireIcon className="w-5 h-5 text-orange-500" />
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {currentContent.filter(item => item.is_premium || item.ppv_price).length}
                              </p>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Premium</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-2 mb-1">
                              <EyeIcon className="w-5 h-5 text-blue-500" />
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {totalStats.totalViews.toLocaleString()}
                              </p>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Total Views</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-2 mb-1">
                              <HeartSolid className="w-5 h-5 text-red-500" />
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {totalStats.totalLikes.toLocaleString()}
                              </p>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Total Likes</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-2 mb-1">
                              <ArrowTrendingUpIcon className="w-5 h-5 text-green-500" />
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {totalStats.avgEngagement}%
                              </p>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Engagement</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Content Upload Modal */}
      <ContentUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        contentType={uploadContentType}
        onUpload={async (newContent) => {
          // Handle the uploaded content
          if (onAddContent) {
            // Call the parent's add content handler with the new content
            await onAddContent(uploadContentType + 's', newContent);
          }
          
          // Track analytics for the new content
          trackInteraction(newContent, 'upload');

          // Close the modal
          setShowUploadModal(false);

          // Show success message
          toast.success(`${uploadContentType.charAt(0).toUpperCase() + uploadContentType.slice(1)} uploaded successfully!`);
        }}
      />
    </div>
  );
};

export default ModernContentGallery;