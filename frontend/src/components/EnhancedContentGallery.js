import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhotoIcon,
  VideoCameraIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SignalIcon,
  ShoppingBagIcon,
  CameraIcon,
  PlayIcon,
  MusicalNoteIcon,
  LockClosedIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  CloudArrowUpIcon,
  EyeIcon,
  CurrencyDollarIcon,
  HeartIcon,
  ChatBubbleLeftIcon,
  ArrowTrendingUpIcon,
  GiftIcon,
  ClockIcon,
  TagIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { getAuthToken } from '../utils/supabase-auth';

const EnhancedContentGallery = ({
  photos = [],
  videos = [],
  streams = [],
  shopProducts = [],
  digitals = [],
  offers = [],
  onAddContent,
  onViewDetails,
  onPurchaseContent,
  userPurchases = [],
  onAddDigital,
  user,
  onUpdateProfile,
  onDeleteContent,
  onEditContent,
  onAddProduct,
  onAddOffer,
  onUpdateOffer,
  onDeleteOffer
}) => {
  const [activeTab, setActiveTab] = useState('photos');
  const [currentPage, setCurrentPage] = useState(0);
  
  // New states for enhanced features
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  
  // Offer modal state
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  
  // Upload form state
  const [uploadData, setUploadData] = useState({
    title: '',
    description: '',
    price: '',
    isPremium: false,
    category: '',
    file: null
  });
  
  // Offer form state
  const [offerData, setOfferData] = useState({
    title: '',
    description: '',
    category: 'General',
    priceTokens: '',
    deliveryTime: '24 hours',
    maxQuantity: ''
  });
  
  const scrollRef = useRef(null);
  
  // Different items per page based on content type
  const getItemsPerPage = () => {
    if (activeTab === 'streams') return 2;
    if (activeTab === 'videos') return 6;
    return 4;
  };
  
  const itemsPerPage = getItemsPerPage();

  // Get content for current tab
  const getAllContent = () => {
    let content = [];
    switch(activeTab) {
      case 'offers':
        return [];  // Offers have special rendering
      case 'videos':
        content = videos.map(v => ({ ...v, type: 'video' }));
        break;
      case 'streams':
        content = streams.map(s => ({ ...s, type: 'stream' }));
        break;
      case 'shop':
        content = shopProducts.map(p => ({ ...p, type: 'product' }));
        break;
      case 'digitals':
        content = digitals.map(d => ({ ...d, type: 'digital' }));
        break;
      case 'photos':
      default:
        content = photos.map(p => ({ ...p, type: 'photo' }));
    }
    
    // Apply search filter
    if (searchQuery) {
      content = content.filter(item => 
        (item.title || item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return content;
  };

  const currentContent = getAllContent();
  
  // Add upload card as first item if user is the creator
  const isCreator = user?.is_creator === true;
  const contentWithUploadCard = isCreator && activeTab !== 'about' && !isManageMode ? 
    [{ type: 'upload_card', id: 'upload_card' }, ...currentContent] : 
    currentContent;
  
  // Check if we're on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  
  const totalPages = Math.ceil(contentWithUploadCard.length / itemsPerPage);
  const displayedContent = isMobile 
    ? contentWithUploadCard
    : contentWithUploadCard.slice(
        currentPage * itemsPerPage,
        (currentPage + 1) * itemsPerPage
      );

  const isContentUnlocked = (item) => {
    if (!item.is_premium && !item.ppv_price) return true;
    return userPurchases.includes(item.id);
  };

  const handleContentClick = (item) => {
    if (isManageMode) {
      toggleItemSelection(item.id);
    } else if (isContentUnlocked(item)) {
      if (onViewDetails) onViewDetails(item);
    } else {
      if (onPurchaseContent) onPurchaseContent(item);
    }
  };

  const toggleItemSelection = (itemId) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    
    const confirmed = window.confirm(`Delete ${selectedItems.size} items?`);
    if (!confirmed) return;
    
    try {
      // Delete each selected item
      for (const itemId of selectedItems) {
        const item = currentContent.find(c => c.id === itemId);
        if (item && onDeleteContent) {
          await onDeleteContent(item);
        }
      }
      
      toast.success(`Deleted ${selectedItems.size} items`);
      setSelectedItems(new Set());
      setIsManageMode(false);
    } catch (error) {
      toast.error('Failed to delete some items');
    }
  };

  const handleUploadSubmit = async () => {
    if (!uploadData.file) {
      toast.error('Please select a file');
      return;
    }
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', uploadData.file);
    formData.append('title', uploadData.title);
    formData.append('description', uploadData.description);
    formData.append('price', uploadData.price || '0');
    formData.append('is_premium', uploadData.isPremium);
    formData.append('category', uploadData.category);
    formData.append('type', activeTab.slice(0, -1)); // Remove 's' from photos/videos
    
    try {
      const authToken = await getAuthToken();
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/content/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`
        },
        body: formData
      });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (response.ok) {
        const result = await response.json();
        toast.success('Content uploaded successfully!');
        
        // Call the onAddContent callback if provided
        if (onAddContent) {
          onAddContent(activeTab, result.content);
        }
        
        // Reset form and close modal
        setUploadData({
          title: '',
          description: '',
          price: '',
          isPremium: false,
          category: '',
          file: null
        });
        setShowUploadModal(false);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload content');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type based on active tab
      const validTypes = {
        photos: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        videos: ['video/mp4', 'video/quicktime', 'video/x-m4v'],
        audios: ['audio/mpeg', 'audio/wav', 'audio/ogg']
      };
      
      const tabValidTypes = validTypes[activeTab] || validTypes.photos;
      if (!tabValidTypes.includes(file.type)) {
        toast.error(`Invalid file type for ${activeTab}`);
        return;
      }
      
      // Check file size (max 100MB)
      if (file.size > 100 * 1024 * 1024) {
        toast.error('File size must be less than 100MB');
        return;
      }
      
      setUploadData(prev => ({ ...prev, file }));
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const tabs = [
    { id: 'photos', label: 'Photos', icon: PhotoIcon, count: photos.length },
    { id: 'videos', label: 'Videos', icon: VideoCameraIcon, count: videos.length },
    { id: 'streams', label: 'Streams', icon: SignalIcon, count: streams.length },
    { id: 'offers', label: 'Offers', icon: GiftIcon, count: offers.length },
    { id: 'digitals', label: 'Digitals', icon: CameraIcon, count: digitals.length },
    { id: 'shop', label: 'Shop', icon: ShoppingBagIcon, count: shopProducts.length }
  ];

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setCurrentPage(0);
    setSelectedItems(new Set());
    setIsManageMode(false);
    setSearchQuery('');
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6">
      {/* Header with Search and Actions */}
      <div className="mb-4 space-y-3">
        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setIsManageMode(!isManageMode)}
                className={`p-2 rounded-lg transition-colors ${
                  isManageMode 
                    ? 'bg-purple-500 text-white' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                title={isManageMode ? 'Exit manage mode' : 'Manage content'}
              >
                {isManageMode ? (
                  <CheckIcon className="w-5 h-5" />
                ) : (
                  <AdjustmentsHorizontalIcon className="w-5 h-5" />
                )}
              </button>
              
              {isManageMode && selectedItems.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center gap-2"
                >
                  <TrashIcon className="w-5 h-5" />
                  Delete ({selectedItems.size})
                </button>
              )}
            </div>
          </div>
        
        {/* Selected items count */}
        {isManageMode && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedItems.size > 0 
              ? `${selectedItems.size} item${selectedItems.size > 1 ? 's' : ''} selected`
              : 'Select items to manage'}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="relative mb-6">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitScrollbar: { display: 'none' }, WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden', transform: 'translate3d(0, 0, 0)' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap flex-shrink-0 will-change-transform ${
                activeTab === tab.id
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              style={{ isolation: 'isolate' }}
            >
              <tab.icon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">{tab.label}</span>
              {tab.count > 0 && (
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-xs bg-white/20 font-bold">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="absolute left-0 top-0 bottom-2 w-4 bg-gradient-to-r from-white dark:from-gray-900 to-transparent pointer-events-none sm:hidden"></div>
        <div className="absolute right-0 top-0 bottom-2 w-4 bg-gradient-to-l from-white dark:from-gray-900 to-transparent pointer-events-none sm:hidden"></div>
      </div>

      {/* Content Display */}
      {activeTab === 'offers' ? (
        /* Offers Section */
        <div className="space-y-4">
          {/* Offers Grid with Upload Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Upload Card for Creators */}
            {isCreator && (
              <button
                onClick={() => {
                  setEditingOffer(null);
                  setOfferData({
                    title: '',
                    description: '',
                    category: 'General',
                    priceTokens: '',
                    deliveryTime: '24 hours',
                    maxQuantity: ''
                  });
                  setShowOfferModal(true);
                }}
                className="group relative bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-lg p-8 flex flex-col items-center justify-center hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-lg transition-all min-h-[240px]"
              >
                <div className="p-4 bg-white dark:bg-gray-800 rounded-full shadow-lg mb-4 group-hover:scale-110 transition-transform">
                  <PlusIcon className="w-8 h-8 text-purple-500" />
                </div>
                <span className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Create Offer</span>
                <span className="text-sm text-gray-600 dark:text-gray-400 text-center">Add a new service or product</span>
              </button>
            )}
            
            {/* Existing Offers */}
            {offers.map((offer) => (
                <div key={offer.id} className="relative group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-all">
                  {/* Hover Analytics Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-xs font-medium text-gray-300 mb-1">
                            <EyeIcon className="w-3 h-3" />
                            VIEWS
                          </div>
                          <div className="text-lg font-bold">
                            {offer.viewCount || 0}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-xs font-medium text-gray-300 mb-1">
                            <CurrencyDollarIcon className="w-3 h-3" />
                            EARNINGS
                          </div>
                          <div className="text-lg font-bold text-green-400">
                            ${((offer.purchaseCount || 0) * (offer.priceTokens || 0) * 0.05).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-white/20">
                        <div className="text-xs">
                          <span className="text-gray-400">Sold:</span>
                          <span className="ml-1 font-medium">{offer.purchaseCount || 0}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-gray-400">Conv:</span>
                          <span className="ml-1 font-medium">
                            {offer.viewCount > 0 ? ((offer.purchaseCount || 0) / offer.viewCount * 100).toFixed(1) : '0'}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Original Content */}
                  <div className="relative z-20">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">
                          {offer.category === 'Social Media' ? '📱' :
                           offer.category === 'Content Creation' ? '🎨' :
                           offer.category === 'Collaboration' ? '🤝' :
                           offer.category === 'Custom Request' ? '✨' :
                           offer.category === 'Exclusive Content' ? '🔐' :
                           offer.category === 'Shoutout' ? '📢' :
                           offer.category === 'Review/Feedback' ? '💬' : '📦'}
                        </span>
                        <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-1 rounded-full">
                          {offer.category}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setEditingOffer(offer);
                            setOfferData({
                              title: offer.title,
                              description: offer.description,
                              category: offer.category,
                              priceTokens: offer.priceTokens,
                              deliveryTime: offer.deliveryTime,
                              maxQuantity: offer.maxQuantity || ''
                            });
                            setShowOfferModal(true);
                          }}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded relative z-30"
                        >
                          <PencilIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Delete this offer?')) {
                              if (onDeleteOffer) onDeleteOffer(offer.id);
                            }
                          }}
                          className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded relative z-30"
                        >
                          <TrashIcon className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                    
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{offer.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{offer.description}</p>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-semibold">
                        <CurrencyDollarIcon className="w-4 h-4" />
                        {offer.priceTokens} tokens
                      </div>
                      <div className="flex items-center gap-1 text-gray-500">
                        <ClockIcon className="w-4 h-4" />
                        {offer.deliveryTime}
                      </div>
                    </div>
                    
                    {offer.maxQuantity && (
                      <div className="mt-2 text-xs text-gray-500">
                        Max: {offer.maxQuantity} orders
                      </div>
                    )}
                    
                    {(offer.purchaseCount > 0 || !offer.active) && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between text-xs">
                          {offer.purchaseCount > 0 && (
                            <span className="text-green-600 dark:text-green-400">
                              {offer.purchaseCount} sold
                            </span>
                          )}
                          <span className={`${offer.active ? 'text-green-500' : 'text-gray-500'} ml-auto`}>
                            {offer.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : currentContent.length === 0 && !isCreator ? (
        /* Empty State for non-creators */
        <div className="flex flex-col items-center justify-center py-20">
          <div className="p-6 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
            <PhotoIcon className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No {activeTab} yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {searchQuery ? 'No results found' : `Add your first ${activeTab === 'photos' ? 'photo' : activeTab.slice(0, -1)}`}
          </p>
        </div>
      ) : (
        /* Content Carousel */
        <div className="relative">
          {/* Navigation Buttons - Only show on desktop */}
          {currentPage > 0 && (
            <button
              onClick={handlePrevious}
              className="hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-shadow"
            >
              <ChevronLeftIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
          )}
          
          {currentPage < totalPages - 1 && (
            <button
              onClick={handleNext}
              className="hidden sm:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-shadow"
            >
              <ChevronRightIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
          )}

          {/* Content Grid */}
          <div className={`
            flex sm:grid gap-4 overflow-x-auto scrollbar-hide pb-2 sm:pb-0
            ${activeTab === 'streams' 
              ? 'sm:grid-cols-1 lg:grid-cols-2'
              : 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
            }
          `}>
            <AnimatePresence mode="wait">
              {displayedContent.map((item, index) => {
                // Upload Card
                if (item.type === 'upload_card') {
                  return (
                    <motion.div
                      key={`${currentPage}-${index}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                      className={`relative bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg hover:border-purple-400 dark:hover:border-purple-600 transition-all group flex-shrink-0
                        ${activeTab === 'streams' 
                          ? 'w-[280px] sm:w-full aspect-video'
                          : activeTab === 'videos'
                          ? 'w-[150px] sm:w-full aspect-[9/16]'
                          : 'w-[180px] sm:w-full aspect-[4/5]'
                      }`}
                      onClick={() => {
                        if (activeTab === 'shop') {
                          // For shop products, use the shop modal
                          if (onAddProduct) {
                            onAddProduct();
                          }
                        } else {
                          // For other content types, use the upload modal
                          setUploadType(activeTab);
                          setShowUploadModal(true);
                        }
                      }}
                    >
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                        <div className="w-16 h-16 rounded-full bg-purple-200 dark:bg-purple-800/50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                          <PlusIcon className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                        </div>
                        <p className="text-purple-700 dark:text-purple-300 font-semibold text-center">
                          Add {activeTab === 'photos' ? 'Photo' : 
                                activeTab === 'videos' ? 'Video' : 
                                activeTab === 'streams' ? 'Stream' : 
                                activeTab === 'digitals' ? 'Digital' : 
                                activeTab === 'shop' ? 'Product' : 'Content'}
                        </p>
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 text-center">
                          Click to upload
                        </p>
                      </div>
                    </motion.div>
                  );
                }
                
                // Regular Content
                const isSelected = selectedItems.has(item.id);
                return (
                  <motion.div
                    key={`${currentPage}-${index}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className={`relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow flex-shrink-0 group
                      ${activeTab === 'streams' 
                        ? 'w-[280px] sm:w-full aspect-video'
                        : activeTab === 'videos'
                        ? 'w-[150px] sm:w-full aspect-[9/16]'
                        : 'w-[180px] sm:w-full aspect-[4/5]'
                      }
                      ${isSelected ? 'ring-2 ring-purple-500' : ''}
                    `}
                    onClick={() => handleContentClick(item)}
                  >
                    {/* Selection Checkbox */}
                    {isManageMode && (
                      <div className="absolute top-2 left-2 z-20">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          isSelected 
                            ? 'bg-purple-500 border-purple-500' 
                            : 'bg-white/80 border-gray-400'
                        }`}>
                          {isSelected && <CheckIcon className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                    )}

                    {/* Analytics Overlay - Shows on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 p-3 flex flex-col justify-end">
                      <div className="space-y-2">
                        <p className="text-white font-semibold truncate">
                          {item.title || item.name || 'Untitled'}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-white/80">
                          <span className="flex items-center gap-1">
                            <EyeIcon className="w-3 h-3" />
                            {item.views || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <HeartIcon className="w-3 h-3" />
                            {item.likes || 0}
                          </span>
                          {(item.ppv_price || item.price) > 0 && (
                            <span className="flex items-center gap-1">
                              <CurrencyDollarIcon className="w-3 h-3" />
                              {item.ppv_price || item.price} tokens
                            </span>
                          )}
                        </div>
                        {item.earnings && (
                          <div className="flex items-center gap-1 text-green-400 text-xs">
                            <ArrowTrendingUpIcon className="w-3 h-3" />
                            Earned: {item.earnings} tokens
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Image/Thumbnail */}
                    <img
                      src={item.url || item.image_url || item.thumbnail_url || '/placeholder.jpg'}
                      alt={item.title || item.name || 'Content'}
                      className={`w-full h-full object-cover ${!isContentUnlocked(item) ? 'filter blur-lg' : ''}`}
                    />

                    {/* Hover Actions - Edit and Delete buttons for creators */}
                    {isCreator && !isManageMode && (
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        {onEditContent && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditContent(item);
                            }}
                            className="p-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors"
                            title="Edit"
                          >
                            <PencilIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                          </button>
                        )}
                        {onDeleteContent && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete this ${item.type}?`)) {
                                onDeleteContent(item);
                              }
                            }}
                            className="p-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Video/Audio/Stream Overlay */}
                    {(item.type === 'video' || item.type === 'audio' || item.type === 'stream') && (
                      <>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                            {item.type === 'audio' ? (
                              <MusicalNoteIcon className="w-6 h-6 text-white" />
                            ) : item.type === 'stream' ? (
                              <SignalIcon className="w-6 h-6 text-white" />
                            ) : (
                              <PlayIcon className="w-6 h-6 text-white ml-0.5" />
                            )}
                          </div>
                        </div>
                        
                        {item.type === 'stream' && (
                          <>
                            {item.is_live && (
                              <div className="absolute top-3 left-3 px-2 py-1 bg-red-500 rounded text-white text-xs font-bold flex items-center gap-1">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                LIVE
                              </div>
                            )}
                            {item.viewer_count && (
                              <div className="absolute top-3 right-3 px-2 py-1 bg-black/50 backdrop-blur-sm rounded text-white text-xs font-medium">
                                {item.viewer_count.toLocaleString()} viewers
                              </div>
                            )}
                          </>
                        )}
                        
                        {item.duration && !item.is_live && (
                          <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/50 backdrop-blur-sm rounded text-white text-xs font-medium">
                            {item.duration}
                          </div>
                        )}
                      </>
                    )}

                    {/* Locked Content Overlay */}
                    {!isContentUnlocked(item) && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <LockClosedIcon className="w-8 h-8 text-white" />
                      </div>
                    )}

                    {/* Premium Badge */}
                    {(item.is_premium || item.ppv_price) && (
                      <div className="absolute top-2 right-2">
                        <div className="px-2 py-1 bg-yellow-500 rounded-full">
                          <StarIcon className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Page Indicators - Only show on desktop */}
          {totalPages > 1 && (
            <div className="hidden sm:flex justify-center mt-4 gap-2">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentPage
                      ? 'w-8 bg-purple-500'
                      : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadData({
            title: '',
            description: '',
            price: '',
            isPremium: false,
            category: '',
            file: null
          });
        }}
        title={`Upload ${activeTab === 'photos' ? 'Photo' : activeTab === 'videos' ? 'Video' : 'Content'}`}
      >
        <div className="space-y-4">
          {/* File Upload Area */}
          <div 
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-purple-500 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={
                activeTab === 'photos' ? 'image/*' :
                activeTab === 'videos' ? 'video/*' :
                activeTab === 'audios' ? 'audio/*' : '*'
              }
              onChange={handleFileSelect}
              className="hidden"
            />
            {uploadData.file ? (
              <div>
                <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">{uploadData.file.name}</p>
                <p className="text-xs text-gray-500 mt-1">Click to change</p>
              </div>
            ) : (
              <div>
                <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Click to browse or drag and drop</p>
                <p className="text-xs text-gray-500 mt-1">Max size: 100MB</p>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              type="text"
              value={uploadData.title}
              onChange={(e) => setUploadData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              placeholder="Enter title..."
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={uploadData.description}
              onChange={(e) => setUploadData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              rows={3}
              placeholder="Describe your content..."
            />
          </div>

          {/* Token Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Token Price</label>
            <input
              type="number"
              value={uploadData.price}
              onChange={(e) => setUploadData(prev => ({ ...prev, price: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              placeholder="0 for free"
              min="0"
            />
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div>
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-purple-500 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowUploadModal(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUploadSubmit}
              disabled={!uploadData.file || isUploading}
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Offer Modal */}
      <Modal
        isOpen={showOfferModal}
        onClose={() => {
          setShowOfferModal(false);
          setEditingOffer(null);
          setOfferData({
            title: '',
            description: '',
            category: 'General',
            priceTokens: '',
            deliveryTime: '24 hours',
            maxQuantity: ''
          });
        }}
        title={editingOffer ? 'Edit Offer' : 'Create New Offer'}
      >
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Offer Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={offerData.title}
              onChange={(e) => setOfferData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              placeholder="e.g., Personalized Video Message"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={offerData.description}
              onChange={(e) => setOfferData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              rows={4}
              placeholder="Describe what you're offering..."
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={offerData.category}
              onChange={(e) => setOfferData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="General">📦 General</option>
              <option value="Social Media">📱 Social Media</option>
              <option value="Content Creation">🎨 Content Creation</option>
              <option value="Collaboration">🤝 Collaboration</option>
              <option value="Custom Request">✨ Custom Request</option>
              <option value="Exclusive Content">🔐 Exclusive Content</option>
              <option value="Shoutout">📢 Shoutout</option>
              <option value="Review/Feedback">💬 Review/Feedback</option>
            </select>
          </div>

          {/* Price and Delivery */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Price (tokens) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={offerData.priceTokens}
                onChange={(e) => setOfferData(prev => ({ ...prev, priceTokens: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                placeholder="100"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Delivery Time <span className="text-red-500">*</span>
              </label>
              <select
                value={offerData.deliveryTime}
                onChange={(e) => setOfferData(prev => ({ ...prev, deliveryTime: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              >
                <option value="Instant">Instant</option>
                <option value="24 hours">24 hours</option>
                <option value="48 hours">48 hours</option>
                <option value="3 days">3 days</option>
                <option value="1 week">1 week</option>
                <option value="2 weeks">2 weeks</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
          </div>

          {/* Max Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Max Quantity <span className="text-xs text-gray-500">(optional)</span>
            </label>
            <input
              type="number"
              value={offerData.maxQuantity}
              onChange={(e) => setOfferData(prev => ({ ...prev, maxQuantity: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              placeholder="Unlimited"
              min="1"
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty for unlimited orders</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                setShowOfferModal(false);
                setEditingOffer(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                // Validate required fields
                if (!offerData.title || !offerData.description || !offerData.priceTokens) {
                  toast.error('Please fill in all required fields');
                  return;
                }

                try {
                  if (editingOffer) {
                    // Update existing offer
                    if (onUpdateOffer) {
                      await onUpdateOffer(editingOffer.id, offerData);
                      toast.success('Offer updated successfully!');
                    }
                  } else {
                    // Create new offer
                    if (onAddOffer) {
                      await onAddOffer(offerData);
                      toast.success('Offer created successfully!');
                    }
                  }
                  
                  setShowOfferModal(false);
                  setEditingOffer(null);
                  setOfferData({
                    title: '',
                    description: '',
                    category: 'General',
                    priceTokens: '',
                    deliveryTime: '24 hours',
                    maxQuantity: ''
                  });
                } catch (error) {
                  toast.error('Failed to save offer');
                }
              }}
              disabled={!offerData.title || !offerData.description || !offerData.priceTokens}
            >
              {editingOffer ? 'Update Offer' : 'Create Offer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default EnhancedContentGallery;