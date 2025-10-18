import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import {
  MapPinIcon,
  TicketIcon,
  SparklesIcon,
  GlobeAltIcon,
  SunIcon,
  StarIcon,
  CheckCircleIcon,
  LockClosedIcon,
  CalendarIcon,
  UserGroupIcon,
  CameraIcon,
  HeartIcon,
  BoltIcon,
  TrophyIcon,
  ChevronRightIcon,
  ArrowRightIcon,
  PlusIcon,
  XMarkIcon,
  PhotoIcon,
  CurrencyDollarIcon,
  ClockIcon,
  ShoppingBagIcon,
  GiftIcon,
  AcademicCapIcon,
  BuildingStorefrontIcon,
  ArrowTrendingUpIcon,
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  InformationCircleIcon,
  VideoCameraIcon,
  PlayCircleIcon,
  CloudArrowDownIcon
} from '@heroicons/react/24/outline';
import { CheckIcon, StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/supabase-auth';

// Constants
const CATEGORIES = [
  { id: 'all', label: 'All Rewards', icon: SparklesIcon, color: 'from-teal-500 to-cyan-600' },
  { id: 'recordings', label: 'Stream Recordings', icon: VideoCameraIcon, color: 'from-purple-500 to-pink-600' },
  { id: 'local', label: 'Local Experiences', icon: MapPinIcon, color: 'from-emerald-500 to-teal-600' },
  { id: 'domestic', label: 'Domestic Travel', icon: SunIcon, color: 'from-amber-500 to-yellow-600' },
  { id: 'international', label: 'International', icon: GlobeAltIcon, color: 'from-sky-500 to-blue-600' },
  { id: 'merchandise', label: 'Merchandise', icon: ShoppingBagIcon, color: 'from-rose-500 to-pink-600' },
  { id: 'vip', label: 'VIP Access', icon: StarIcon, color: 'from-violet-500 to-purple-600' },
  { id: 'digital', label: 'Digital Rewards', icon: GiftIcon, color: 'from-indigo-500 to-violet-600' }
];

const EnhancedRedeemTab = ({ walletData = {}, experiences = [], recordings = [], onRedeem, onPurchaseRecording, isAdmin = false, creatorId = null }) => {
  // State Management
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [hoveredExperience, setHoveredExperience] = useState(null);
  const [showAddRewardModal, setShowAddRewardModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedExperience, setSelectedExperience] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sortBy, setSortBy] = useState('featured'); // featured, price-low, price-high, newest
  const [creatorRecordings, setCreatorRecordings] = useState([]);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [newReward, setNewReward] = useState({
    title: '',
    bio: '',
    pictureBanner: '',
    location: '',
    redeemTokenCost: '',
    date: '',
    category: 'local',
    maxSlots: '',
    duration: '',
    details: []
  });
  
  // Computed Values
  const userBalance = useMemo(() => {
    return walletData.tokenBalance || walletData.tokens || 0;
  }, [walletData]);

  // Fetch creator recordings when category changes
  useEffect(() => {
    if (selectedCategory === 'recordings' && creatorId && creatorRecordings.length === 0) {
      fetchCreatorRecordings();
    }
  }, [selectedCategory, creatorId]);

  const fetchCreatorRecordings = async () => {
    if (!creatorId) return;
    
    setLoadingRecordings(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/recording/creator/${creatorId}/recordings`
      );
      
      if (response.ok) {
        const data = await response.json();
        setCreatorRecordings(data.recordings || []);
      }
    } catch (error) {
      console.error('Error fetching recordings:', error);
      toast.error('Failed to load recordings');
    } finally {
      setLoadingRecordings(false);
    }
  };

  // Handle recording purchase
  const handlePurchaseRecording = async (recording) => {
    if (userBalance < recording.token_price) {
      toast.error('Insufficient tokens!');
      return;
    }
    
    setIsProcessing(true);
    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/recording/recordings/${recording.id}/purchase`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        
        // Update user balance if onPurchaseRecording callback is provided
        if (onPurchaseRecording) {
          onPurchaseRecording(recording, data.fileUrl);
        }
        
        toast.success(
          <div>
            <p>Purchased recording!</p>
            <a 
              href={data.fileUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 underline"
            >
              Watch Now
            </a>
          </div>
        );
        
        // Close modal if open
        setShowDetailModal(false);
        setSelectedExperience(null);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to purchase recording');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error(error.message || 'Failed to purchase recording');
    } finally {
      setIsProcessing(false);
    }
  };

  // Memoized filtered and sorted experiences
  const processedExperiences = useMemo(() => {
    // Combine experiences and recordings based on category
    let items = [];
    
    if (selectedCategory === 'recordings') {
      items = creatorRecordings.map(rec => ({
        ...rec,
        category: 'recordings',
        isRecording: true,
        redeemTokenCost: rec.token_price
      }));
    } else if (selectedCategory === 'all') {
      items = [
        ...experiences,
        ...creatorRecordings.map(rec => ({
          ...rec,
          category: 'recordings',
          isRecording: true,
          redeemTokenCost: rec.token_price
        }))
      ];
    } else {
      items = experiences.filter(exp => exp.category === selectedCategory);
    }
    
    // Apply search filter
    let filtered = items.filter(item => {
      const matchesSearch = searchQuery.trim() === '' || 
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });

    // Sort experiences
    switch (sortBy) {
      case 'price-low':
        filtered.sort((a, b) => (a.redeemTokenCost || 0) - (b.redeemTokenCost || 0));
        break;
      case 'price-high':
        filtered.sort((a, b) => (b.redeemTokenCost || 0) - (a.redeemTokenCost || 0));
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        break;
      default: // featured
        // Keep original order or implement custom featured logic
        break;
    }

    return filtered;
  }, [experiences, selectedCategory, searchQuery, sortBy]);

  const qualifiedExperiences = useMemo(() => 
    processedExperiences.filter(exp => exp.available !== false),
    [processedExperiences]
  );

  const upcomingExperiences = useMemo(() => 
    processedExperiences.filter(exp => exp.available === false),
    [processedExperiences]
  );

  // Helper Functions
  const getExperienceIcon = useCallback((category) => {
    const categoryObj = CATEGORIES.find(cat => cat.id === category);
    return categoryObj ? categoryObj.icon : StarIcon;
  }, []);

  const getCategoryColor = useCallback((category) => {
    const categoryObj = CATEGORIES.find(cat => cat.id === category);
    return categoryObj ? categoryObj.color : 'from-gray-500 to-gray-600';
  }, []);

  const formatTokenAmount = useCallback((amount) => {
    return new Intl.NumberFormat('en-US').format(amount || 0);
  }, []);

  // Event Handlers
  const handleRedeem = useCallback(async (experience) => {
    if (userBalance < experience.redeemTokenCost) {
      toast.error('Insufficient tokens!');
      return;
    }

    setIsProcessing(true);
    const loadingToast = toast.loading('Processing redemption...');
    
    try {
      if (typeof onRedeem === 'function') {
        await onRedeem(experience);
        toast.dismiss(loadingToast);
        // toast.success(
        //   <div>
        //     <p className="font-semibold">Reward redeemed successfully!</p>
        //     <p className="text-sm">Check your email for details</p>
        //   </div>
        // );
        setShowDetailModal(false);
        setSelectedExperience(null);
      } else {
        throw new Error('Redeem function not provided');
      }
    } catch (error) {
      console.error('Redemption error:', error);
      toast.dismiss(loadingToast);
      toast.error(error.message || 'Failed to redeem reward. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [userBalance, onRedeem]);

  const handleAddReward = useCallback(async () => {
    const errors = [];
    if (!newReward.title.trim()) errors.push('Title is required');
    if (!newReward.bio.trim()) errors.push('Description is required');
    if (!newReward.redeemTokenCost || newReward.redeemTokenCost <= 0) {
      errors.push('Valid token cost is required');
    }

    if (errors.length > 0) {
      toast.error(errors.join(', '));
      return;
    }

    const loadingToast = toast.loading('Adding new reward...');
    
    try {
      // API call would go here
      // await addRewardAPI(newReward);
      
      toast.dismiss(loadingToast);
      // toast.success('Reward added successfully!');
      setShowAddRewardModal(false);
      setNewReward({
        title: '',
        bio: '',
        pictureBanner: '',
        location: '',
        redeemTokenCost: '',
        date: '',
        category: 'local',
        maxSlots: '',
        duration: '',
        details: []
      });
    } catch (error) {
      console.error('Add reward error:', error);
      toast.dismiss(loadingToast);
      toast.error(error.message || 'Failed to add reward');
    }
  }, [newReward]);

  const handleExperienceClick = useCallback((experience) => {
    setSelectedExperience(experience);
    setShowDetailModal(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setShowDetailModal(false);
    setSelectedExperience(null);
  }, []);

  // Keyboard Navigation
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (showDetailModal) handleModalClose();
        if (showAddRewardModal) setShowAddRewardModal(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showDetailModal, showAddRewardModal, handleModalClose]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Redeem Rewards</h1>
            <p className="text-gray-400">Use your tokens to unlock exclusive experiences and rewards</p>
          </div>
          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddRewardModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full font-semibold text-white shadow-lg hover:shadow-teal-500/25 transition-all"
              aria-label="Add new reward"
            >
              <PlusIcon className="w-5 h-5" />
              Add Reward
            </motion.button>
          )}
        </div>

        {/* Token Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-teal-500/20 to-cyan-500/20 rounded-2xl p-6 backdrop-blur-sm border border-white/10"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-gray-400 mb-1">Available Balance</p>
              <div className="flex items-center gap-3">
                <CurrencyDollarIcon className="w-8 h-8 text-yellow-400" />
                <span className="text-4xl font-bold text-white">{formatTokenAmount(userBalance)}</span>
                <span className="text-gray-400 text-2xl">tokens</span>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-gray-400 mb-1">Rewards Redeemed</p>
              <p className="text-2xl font-semibold text-white">{walletData.rewardsRedeemed || 0}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Bar and Sort */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search rewards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-teal-500 transition-colors"
              aria-label="Search rewards"
            />
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
          
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none px-12 py-4 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-white/10 text-white focus:outline-none focus:border-teal-500 transition-colors cursor-pointer"
              aria-label="Sort rewards"
            >
              <option value="featured">Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="newest">Newest First</option>
            </select>
            <FunnelIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map((category) => {
            const Icon = category.icon;
            const isActive = selectedCategory === category.id;
            
            return (
              <motion.button
                key={category.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r text-white shadow-lg'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                } ${isActive ? category.color : ''}`}
                aria-label={`Filter by ${category.label}`}
                aria-pressed={isActive}
              >
                <Icon className="w-5 h-5" />
                {category.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Available Rewards */}
      <section className="mb-12" aria-label="Available rewards">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <SparklesIcon className="w-6 h-6 text-teal-400" />
          Available Rewards
          {qualifiedExperiences.length > 0 && (
            <span className="text-sm font-normal text-gray-400">
              ({qualifiedExperiences.length} available)
            </span>
          )}
        </h2>
        
        {qualifiedExperiences.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 bg-gray-800/30 rounded-2xl"
          >
            <TrophyIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">No rewards available in this category</p>
            <p className="text-gray-500 text-sm">Try searching or selecting a different category</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {qualifiedExperiences.map((experience, index) => {
              const Icon = getExperienceIcon(experience.category);
              const isHovered = hoveredExperience === experience.id;
              const canRedeem = userBalance >= experience.redeemTokenCost;
              
              return (
                <motion.article
                  key={experience.id || index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  onHoverStart={() => setHoveredExperience(experience.id)}
                  onHoverEnd={() => setHoveredExperience(null)}
                  className="relative bg-gray-800/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/10 hover:border-teal-500/50 transition-all duration-300 cursor-pointer group"
                  onClick={() => handleExperienceClick(experience)}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleExperienceClick(experience);
                    }
                  }}
                  aria-label={`${experience.title} - ${experience.redeemTokenCost} tokens`}
                >
                  {/* Image */}
                  <div className="relative h-48 overflow-hidden bg-gray-900">
                    {experience.pictureBanner ? (
                      <img
                        src={experience.pictureBanner}
                        alt={experience.title}
                        className={`w-full h-full object-cover transition-transform duration-700 ${
                          isHovered ? 'scale-110' : 'scale-100'
                        }`}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                        <PhotoIcon className="w-16 h-16 text-gray-700" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent" />
                    
                    {/* Category Badge */}
                    <div className={`absolute top-4 left-4 px-3 py-1 rounded-full bg-gradient-to-r ${getCategoryColor(experience.category)} text-white text-sm font-medium flex items-center gap-1 shadow-lg`}>
                      <Icon className="w-4 h-4" />
                      {experience.category}
                    </div>
                    
                    {/* Token Cost */}
                    <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 shadow-lg">
                      <CurrencyDollarIcon className="w-5 h-5 text-yellow-400" />
                      <span className="text-white font-bold">{formatTokenAmount(experience.redeemTokenCost)}</span>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-teal-400 transition-colors">
                      {experience.title}
                    </h3>
                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                      {experience.bio}
                    </p>
                    
                    <div className="flex items-center justify-between text-sm mb-4">
                      <div className="flex items-center gap-4">
                        {experience.location && (
                          <div className="flex items-center gap-1 text-gray-400">
                            <MapPinIcon className="w-4 h-4" />
                            <span className="truncate max-w-[120px]">{experience.location}</span>
                          </div>
                        )}
                        {experience.date && (
                          <div className="flex items-center gap-1 text-gray-400">
                            <CalendarIcon className="w-4 h-4" />
                            <span>{new Date(experience.date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Redeem Button */}
                    <motion.button
                      whileHover={{ scale: canRedeem ? 1.05 : 1 }}
                      whileTap={{ scale: canRedeem ? 0.95 : 1 }}
                      className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                        canRedeem
                          ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg hover:shadow-teal-500/25'
                          : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canRedeem && !isProcessing) {
                          handleRedeem(experience);
                        }
                      }}
                      disabled={!canRedeem || isProcessing}
                      aria-label={canRedeem ? 'Redeem this reward' : 'Insufficient tokens'}
                    >
                      {canRedeem ? (
                        <>
                          <CheckCircleIcon className="w-5 h-5" />
                          Redeem Now
                        </>
                      ) : (
                        <>
                          <LockClosedIcon className="w-5 h-5" />
                          Insufficient Tokens
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>

      {/* Upcoming Rewards */}
      {upcomingExperiences.length > 0 && (
        <section aria-label="Upcoming rewards">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <ClockIcon className="w-6 h-6 text-yellow-400" />
            Coming Soon
            <span className="text-sm font-normal text-gray-400">
              ({upcomingExperiences.length} upcoming)
            </span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingExperiences.map((experience, index) => {
              const Icon = getExperienceIcon(experience.category);
              
              return (
                <motion.article
                  key={experience.id || index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative bg-gray-800/30 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/5"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-900/50 to-gray-800/50 z-10 pointer-events-none" />
                  
                  {/* Image */}
                  <div className="relative h-48 overflow-hidden opacity-50 bg-gray-900">
                    {experience.pictureBanner ? (
                      <img
                        src={experience.pictureBanner}
                        alt={experience.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                        <PhotoIcon className="w-16 h-16 text-gray-700" />
                      </div>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="relative p-6 z-20">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r ${getCategoryColor(experience.category)} text-white text-sm font-medium mb-3 opacity-75`}>
                      <Icon className="w-4 h-4" />
                      {experience.category}
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-2">{experience.title}</h3>
                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">{experience.bio}</p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CurrencyDollarIcon className="w-5 h-5 text-yellow-400" />
                        <span className="text-white font-bold">{formatTokenAmount(experience.redeemTokenCost)} tokens</span>
                      </div>
                      <span className="text-yellow-400 text-sm font-medium">Coming Soon</span>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </section>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedExperience && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleModalClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header Image */}
              <div className="relative h-64 overflow-hidden bg-gray-800">
                {selectedExperience.pictureBanner ? (
                  <img
                    src={selectedExperience.pictureBanner}
                    alt={selectedExperience.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                    <PhotoIcon className="w-24 h-24 text-gray-700" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent" />
                
                <button
                  onClick={handleModalClose}
                  className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors"
                  aria-label="Close modal"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
                
                {/* Category Badge */}
                <div className={`absolute bottom-4 left-6 px-4 py-2 rounded-full bg-gradient-to-r ${getCategoryColor(selectedExperience.category)} text-white font-medium flex items-center gap-2 shadow-lg`}>
                  {React.createElement(getExperienceIcon(selectedExperience.category), { className: "w-5 h-5" })}
                  {selectedExperience.category}
                </div>
              </div>
              
              {/* Modal Content */}
              <div className="p-6">
                <h2 id="modal-title" className="text-3xl font-bold text-white mb-4">
                  {selectedExperience.title}
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-400 mb-1">
                      <CurrencyDollarIcon className="w-5 h-5 text-yellow-400" />
                      <span className="text-sm">Token Cost</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{formatTokenAmount(selectedExperience.redeemTokenCost)}</p>
                  </div>
                  
                  {selectedExperience.location && (
                    <div className="bg-gray-800/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <MapPinIcon className="w-5 h-5" />
                        <span className="text-sm">Location</span>
                      </div>
                      <p className="text-lg font-semibold text-white">{selectedExperience.location}</p>
                    </div>
                  )}
                  
                  {selectedExperience.date && (
                    <div className="bg-gray-800/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <CalendarIcon className="w-5 h-5" />
                        <span className="text-sm">Date</span>
                      </div>
                      <p className="text-lg font-semibold text-white">
                        {new Date(selectedExperience.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  )}
                  
                  {selectedExperience.maxSlots && (
                    <div className="bg-gray-800/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <UserGroupIcon className="w-5 h-5" />
                        <span className="text-sm">Available Slots</span>
                      </div>
                      <p className="text-lg font-semibold text-white">{selectedExperience.maxSlots}</p>
                    </div>
                  )}
                </div>
                
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Description</h3>
                  <p className="text-gray-300 leading-relaxed">{selectedExperience.bio}</p>
                </div>
                
                {selectedExperience.details && selectedExperience.details.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-3">What's Included</h3>
                    <ul className="space-y-2">
                      {selectedExperience.details.map((detail, index) => (
                        <li key={index} className="flex items-start gap-2 text-gray-300">
                          <CheckIcon className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Balance Check */}
                {userBalance < selectedExperience.redeemTokenCost && (
                  <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <InformationCircleIcon className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-yellow-500 font-medium mb-1">Insufficient Tokens</p>
                        <p className="text-yellow-500/80 text-sm">
                          You need {formatTokenAmount(selectedExperience.redeemTokenCost - userBalance)} more tokens to redeem this reward.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex gap-4">
                  <motion.button
                    whileHover={{ scale: userBalance >= selectedExperience.redeemTokenCost ? 1.05 : 1 }}
                    whileTap={{ scale: userBalance >= selectedExperience.redeemTokenCost ? 0.95 : 1 }}
                    onClick={() => handleRedeem(selectedExperience)}
                    disabled={userBalance < selectedExperience.redeemTokenCost || isProcessing}
                    className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                      userBalance >= selectedExperience.redeemTokenCost && !isProcessing
                        ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg hover:shadow-teal-500/25'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <motion.div
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                        Processing...
                      </>
                    ) : userBalance >= selectedExperience.redeemTokenCost ? (
                      <>
                        <CheckCircleIcon className="w-5 h-5" />
                        Redeem Now
                      </>
                    ) : (
                      <>
                        <LockClosedIcon className="w-5 h-5" />
                        Insufficient Tokens
                      </>
                    )}
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleModalClose}
                    className="px-6 py-3 bg-gray-800 text-white rounded-xl font-semibold hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Reward Modal (Admin Only) */}
      <AnimatePresence>
        {showAddRewardModal && isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-reward-title"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 id="add-reward-title" className="text-2xl font-bold text-white">Add New Reward</h2>
                  <button
                    onClick={() => setShowAddRewardModal(false)}
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    aria-label="Close add reward modal"
                  >
                    <XMarkIcon className="w-6 h-6 text-gray-400" />
                  </button>
                </div>
                
                <form onSubmit={(e) => { e.preventDefault(); handleAddReward(); }} className="space-y-4">
                  <div>
                    <label htmlFor="reward-title" className="block text-sm font-medium text-gray-400 mb-2">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="reward-title"
                      type="text"
                      value={newReward.title}
                      onChange={(e) => setNewReward({ ...newReward, title: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Exclusive Meet & Greet"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="reward-description" className="block text-sm font-medium text-gray-400 mb-2">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="reward-description"
                      value={newReward.bio}
                      onChange={(e) => setNewReward({ ...newReward, bio: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                      placeholder="Describe the reward experience..."
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="reward-cost" className="block text-sm font-medium text-gray-400 mb-2">
                        Token Cost <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="reward-cost"
                        type="number"
                        min="1"
                        value={newReward.redeemTokenCost}
                        onChange={(e) => setNewReward({ ...newReward, redeemTokenCost: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="1000"
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="reward-category" className="block text-sm font-medium text-gray-400 mb-2">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="reward-category"
                        value={newReward.category}
                        onChange={(e) => setNewReward({ ...newReward, category: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      >
                        {CATEGORIES.slice(1).map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="reward-location" className="block text-sm font-medium text-gray-400 mb-2">
                        Location
                      </label>
                      <input
                        id="reward-location"
                        type="text"
                        value={newReward.location}
                        onChange={(e) => setNewReward({ ...newReward, location: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Los Angeles, CA"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="reward-date" className="block text-sm font-medium text-gray-400 mb-2">
                        Date
                      </label>
                      <input
                        id="reward-date"
                        type="date"
                        value={newReward.date}
                        onChange={(e) => setNewReward({ ...newReward, date: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="reward-slots" className="block text-sm font-medium text-gray-400 mb-2">
                        Available Slots
                      </label>
                      <input
                        id="reward-slots"
                        type="number"
                        min="1"
                        value={newReward.maxSlots}
                        onChange={(e) => setNewReward({ ...newReward, maxSlots: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="10"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="reward-duration" className="block text-sm font-medium text-gray-400 mb-2">
                        Duration
                      </label>
                      <input
                        id="reward-duration"
                        type="text"
                        value={newReward.duration}
                        onChange={(e) => setNewReward({ ...newReward, duration: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="3 days"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="reward-image" className="block text-sm font-medium text-gray-400 mb-2">
                      Banner Image URL
                    </label>
                    <input
                      id="reward-image"
                      type="url"
                      value={newReward.pictureBanner}
                      onChange={(e) => setNewReward({ ...newReward, pictureBanner: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                  
                  <div className="flex gap-4 mt-6">
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl font-semibold text-white shadow-lg hover:shadow-teal-500/25 transition-all"
                    >
                      Add Reward
                    </motion.button>
                    
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowAddRewardModal(false)}
                      className="px-6 py-3 bg-gray-800 text-white rounded-xl font-semibold hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </motion.button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// PropTypes for type checking
EnhancedRedeemTab.propTypes = {
  walletData: PropTypes.shape({
    tokenBalance: PropTypes.number,
    tokens: PropTypes.number,
    rewardsRedeemed: PropTypes.number
  }),
  experiences: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string,
    bio: PropTypes.string,
    redeemTokenCost: PropTypes.number,
    pictureBanner: PropTypes.string,
    location: PropTypes.string,
    date: PropTypes.string,
    category: PropTypes.string,
    available: PropTypes.bool,
    details: PropTypes.arrayOf(PropTypes.string),
    maxSlots: PropTypes.number,
    duration: PropTypes.string
  })),
  onRedeem: PropTypes.func,
  isAdmin: PropTypes.bool
};

export default EnhancedRedeemTab;