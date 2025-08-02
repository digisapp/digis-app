import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  UserGroupIcon,
  SparklesIcon,
  HeartIcon as HeartIconSolid,
  HeartIcon,
  ChevronDownIcon,
  VideoCameraIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  GiftIcon,
  CurrencyDollarIcon,
  LanguageIcon,
  XMarkIcon,
  Squares2X2Icon,
  ListBulletIcon,
  BarsArrowUpIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/solid';
import MobileLandingPage from '../mobile/MobileLandingPage';
import MobileCreatorCard from '../mobile/MobileCreatorCard';

const ExplorePage = ({ 
  onCreatorSelect, 
  onStartVideoCall, 
  onStartVoiceCall, 
  onScheduleSession, 
  onTipCreator, 
  onSendMessage, 
  onMakeOffer,
  ...props 
}) => {
  const navigate = useNavigate();
  const observerRef = useRef();
  const loadMoreRef = useRef();
  
  // State management
  const [creators, setCreators] = useState([]);
  const [filteredCreators, setFilteredCreators] = useState([]);
  const [savedCreators, setSavedCreators] = useState(() => {
    const saved = localStorage.getItem('savedCreators');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [showQuickView, setShowQuickView] = useState(false);
  const [quickViewCreator, setQuickViewCreator] = useState(null);
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Categories
  const categories = [
    { id: 'all', label: 'All', icon: SparklesIcon },
    { id: 'fitness', label: 'Fitness', icon: () => <span>💪</span> },
    { id: 'wellness', label: 'Wellness', icon: () => <span>🧘</span> },
    { id: 'fashion', label: 'Fashion', icon: () => <span>👗</span> },
    { id: 'business', label: 'Business', icon: () => <span>💼</span> },
    { id: 'creative', label: 'Creative', icon: () => <span>🎨</span> },
    { id: 'cooking', label: 'Cooking', icon: () => <span>👨‍🍳</span> },
    { id: 'tech', label: 'Tech', icon: () => <span>💻</span> },
    { id: 'music', label: 'Music', icon: () => <span>🎵</span> },
    { id: 'gaming', label: 'Gaming', icon: () => <span>🎮</span> },
    { id: 'other', label: 'Other', icon: () => <span>✨</span> }
  ];
  
  // Languages
  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' }
  ];

  // Fetch creators
  useEffect(() => {
    fetchCreators();
  }, []);
  
  // Infinite scroll setup
  useEffect(() => {
    if (!loadMoreRef.current) return;
    
    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    };
    
    observerRef.current = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoadingMore) {
        loadMoreCreators();
      }
    }, options);
    
    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore]);

  useEffect(() => {
    filterAndSortCreators();
  }, [creators, searchTerm, selectedCategory, sortBy]);

  const fetchCreators = async (pageNum = 1) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setIsLoadingMore(true);
      
      // Try to fetch from API first
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/public/creators?limit=20&page=${pageNum}`);
        if (response.ok) {
          const data = await response.json();
          if (data.creators && data.creators.length > 0) {
            // Map API response to expected format
            const apiCreators = data.creators.map(creator => ({
              id: creator.uid || creator.id,
              username: creator.username,
              displayName: creator.full_name || creator.username,
              avatar: creator.profile_pic_url,
              category: creator.industry_type?.toLowerCase() || 'other',
              bio: creator.bio || '',
              isOnline: creator.is_online || false,
              followers: creator.follower_count || 0,
              pricePerMin: creator.stream_price || 5,
              videoPrice: creator.video_price || creator.videoPrice || 8,
              voicePrice: creator.voice_price || creator.voicePrice || 6,
              totalSessions: creator.total_sessions || 0,
              state: creator.state,
              country: creator.country,
              specialties: creator.specialties || generateRandomSpecialties(creator.category),
              languages: creator.languages || generateRandomLanguages(),
              responseTime: creator.response_time || '< 1 hour'
            }));
            
            if (pageNum === 1) {
              setCreators(apiCreators);
            } else {
              setCreators(prev => [...prev, ...apiCreators]);
            }
            
            setHasMore(apiCreators.length === 20);
            return;
          }
        }
      } catch (apiError) {
        console.log('API fetch failed, using mock data:', apiError);
      }

      // Fallback to mock data if API fails
      const mockCreators = [
        {
          id: 1,
          username: 'FitnessGuru_Alex',
          displayName: 'Alex Martinez',
          avatar: null,
          category: 'fitness',
          bio: 'Certified personal trainer helping you achieve your fitness goals',
          isOnline: true,
          followers: 12500,
          pricePerMin: 3,
          specialties: ['Personal Training', 'Nutrition', 'HIIT'],
          totalSessions: 1240,
          languages: ['en', 'es'],
          responseTime: '< 30 min'
        },
        {
          id: 2,
          username: 'YogaMaster_Sophia',
          displayName: 'Sophia Chen',
          avatar: null,
          category: 'wellness',
          bio: 'Yoga instructor and meditation guide for inner peace',
          isOnline: true,
          followers: 8900,
          pricePerMin: 2,
          specialties: ['Yoga', 'Meditation', 'Mindfulness'],
          totalSessions: 892,
          languages: ['en', 'zh', 'ja'],
          responseTime: '< 1 hour'
        },
        {
          id: 3,
          username: 'StyleIcon_Emma',
          displayName: 'Emma Thompson',
          avatar: null,
          category: 'fashion',
          bio: 'Fashion stylist helping you find your unique style',
          isOnline: false,
          followers: 15600,
          pricePerMin: 4,
          specialties: ['Fashion Styling', 'Color Analysis', 'Wardrobe Planning'],
          totalSessions: 623,
          languages: ['en', 'fr', 'it'],
          responseTime: '< 2 hours'
        },
        {
          id: 4,
          username: 'BizCoach_Marcus',
          displayName: 'Marcus Johnson',
          avatar: null,
          category: 'business',
          bio: 'Business consultant and startup mentor',
          isOnline: true,
          followers: 22100,
          pricePerMin: 6,
          specialties: ['Business Strategy', 'Leadership', 'Entrepreneurship'],
          totalSessions: 1567,
          languages: ['en', 'de'],
          responseTime: '< 30 min'
        },
        {
          id: 5,
          username: 'Chef_Isabella',
          displayName: 'Isabella Rodriguez',
          avatar: null,
          category: 'cooking',
          bio: 'Professional chef specializing in Italian cuisine',
          isOnline: true,
          followers: 9800,
          pricePerMin: 3,
          specialties: ['Italian Cuisine', 'Baking', 'Healthy Cooking'],
          totalSessions: 734,
          languages: ['en', 'it', 'es'],
          responseTime: '< 1 hour'
        },
        {
          id: 6,
          username: 'TechMentor_David',
          displayName: 'David Kim',
          avatar: null,
          category: 'tech',
          bio: 'Senior software engineer mentoring the next generation',
          isOnline: true,
          followers: 31200,
          pricePerMin: 5,
          specialties: ['Software Development', 'AI/ML', 'Career Guidance'],
          totalSessions: 2134,
          languages: ['en', 'ko', 'zh'],
          responseTime: '< 30 min'
        }
      ];
      
      if (pageNum === 1) {
        setCreators(mockCreators);
      } else {
        // For mock data, just show no more results
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error fetching creators:', error);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };
  
  const loadMoreCreators = () => {
    if (!isLoadingMore && hasMore) {
      setPage(prev => prev + 1);
      fetchCreators(page + 1);
    }
  };
  
  // Helper functions
  const generateRandomSpecialties = (category) => {
    const specialtiesMap = {
      fitness: ['Personal Training', 'Nutrition', 'HIIT', 'Yoga', 'CrossFit'],
      wellness: ['Meditation', 'Mindfulness', 'Stress Management', 'Life Coaching'],
      fashion: ['Style Consulting', 'Wardrobe Planning', 'Personal Shopping', 'Trend Analysis'],
      business: ['Strategy', 'Leadership', 'Marketing', 'Finance', 'Startups'],
      creative: ['Design', 'Photography', 'Writing', 'Art Direction'],
      cooking: ['Healthy Recipes', 'Baking', 'International Cuisine', 'Meal Prep'],
      tech: ['Web Development', 'Mobile Apps', 'AI/ML', 'Cloud Computing'],
      music: ['Vocals', 'Guitar', 'Piano', 'Music Production'],
      gaming: ['Strategy Games', 'FPS', 'Game Design', 'Streaming']
    };
    
    const specs = specialtiesMap[category] || ['Consulting', 'Training', 'Mentoring'];
    return specs.slice(0, 3);
  };
  
  const generateRandomLanguages = () => {
    const allLangs = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'];
    const count = Math.floor(Math.random() * 3) + 1;
    const langs = ['en']; // Always include English
    
    while (langs.length < count && langs.length < allLangs.length) {
      const lang = allLangs[Math.floor(Math.random() * allLangs.length)];
      if (!langs.includes(lang)) {
        langs.push(lang);
      }
    }
    
    return langs;
  };
  
  const toggleSaveCreator = (creatorId) => {
    const newSaved = savedCreators.includes(creatorId)
      ? savedCreators.filter(id => id !== creatorId)
      : [...savedCreators, creatorId];
    
    setSavedCreators(newSaved);
    localStorage.setItem('savedCreators', JSON.stringify(newSaved));
    
    // toast.success(
    //   savedCreators.includes(creatorId) 
    //     ? 'Removed from favorites' 
    //     : 'Added to favorites'
    // );
  };

  const filterAndSortCreators = () => {
    let filtered = [...creators];

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(creator => creator.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(creator =>
        creator.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        creator.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        creator.bio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (creator.specialties && creator.specialties.some(s => s.toLowerCase().includes(searchTerm.toLowerCase())))
      );
    }
    
    // Filter by languages
    if (selectedLanguages.length > 0) {
      filtered = filtered.filter(creator => {
        if (!creator.languages) return false;
        return selectedLanguages.some(lang => creator.languages.includes(lang));
      });
    }

    // Sort
    switch (sortBy) {
      case 'popular':
        filtered.sort((a, b) => b.followers - a.followers);
        break;
      case 'rating':
        // Sort by followers as a proxy for rating
        filtered.sort((a, b) => b.followers - a.followers);
        break;
      case 'online':
        filtered.sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));
        break;
      case 'price-low':
        filtered.sort((a, b) => a.pricePerMin - b.pricePerMin);
        break;
      case 'price-high':
        filtered.sort((a, b) => b.pricePerMin - a.pricePerMin);
        break;
      default:
        break;
    }

    setFilteredCreators(filtered);
  };

  // Skeleton loader component
  const CreatorCardSkeleton = () => (
    <div className="animate-pulse">
      <div className="bg-gray-200 rounded-[1.5rem] h-[380px] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-gray-300 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="bg-gray-300 rounded-xl p-3 space-y-2">
            <div className="h-6 bg-gray-400 rounded w-3/4" />
            <div className="h-4 bg-gray-400 rounded w-1/2" />
            <div className="h-3 bg-gray-400 rounded w-full" />
            <div className="grid grid-cols-4 gap-2 mt-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-10 bg-gray-400 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  
  const CreatorCard = ({ creator, onStartVideoCall, onStartVoiceCall, onTipCreator, onSendMessage }) => {
    const isSaved = savedCreators.includes(creator.id);
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmType, setConfirmType] = useState('');
    const [confirmData, setConfirmData] = useState(null);
    
    const handleCardClick = () => {
      setQuickViewCreator(creator);
      setShowQuickView(true);
    };
    
    const handleActionClick = (e, type, callback, rate) => {
      e.stopPropagation();
      setConfirmType(type);
      setConfirmData({ callback, rate });
      setShowConfirm(true);
    };
    
    const handleConfirm = () => {
      if (confirmData?.callback) {
        confirmData.callback(creator);
      }
      setShowConfirm(false);
    };
    
    const handleCancel = () => {
      setShowConfirm(false);
      setConfirmType('');
      setConfirmData(null);
    };

    return (
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2 }}
        className="group cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
          {/* Image Section */}
          <div className="relative aspect-[3/4] overflow-hidden">
            {creator.avatar ? (
              <img 
                src={creator.avatar} 
                alt={creator.displayName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-3xl font-bold">
                  {creator.displayName.charAt(0)}
                </div>
              </div>
            )}
            
            {/* Status Badges */}
            <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
              {creator.isOnline && (
                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                  Online
                </span>
              )}
              
              {/* Save Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSaveCreator(creator.id);
                }}
                className="bg-white/90 backdrop-blur-sm p-2 rounded-full hover:bg-white transition-colors"
              >
                {isSaved ? (
                  <HeartIconSolid className="w-4 h-4 text-red-500" />
                ) : (
                  <HeartIcon className="w-4 h-4 text-gray-600" />
                )}
              </button>
            </div>
            
            {/* Price Badge */}
            <div className="absolute bottom-3 left-3">
              <div className="bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium">
                ${creator.pricePerMin}/min
              </div>
            </div>
          </div>
          
          {/* Content Section */}
          <div className="p-4">
            {/* Creator Info */}
            <div className="mb-3">
              <h3 className="font-semibold text-gray-900 text-lg">{creator.displayName}</h3>
              <p className="text-sm text-gray-500">@{creator.username}</p>
              {(creator.state || creator.country) && (
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {[creator.state, creator.country].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
            
            
            {/* Specialties */}
            {creator.specialties && creator.specialties.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {creator.specialties.slice(0, 2).map((specialty, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full"
                  >
                    {specialty}
                  </span>
                ))}
                {creator.specialties.length > 2 && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                    +{creator.specialties.length - 2}
                  </span>
                )}
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={(e) => handleActionClick(e, 'video', onStartVideoCall, creator.videoPrice || creator.pricePerMin)}
                className="flex items-center justify-center gap-1.5 px-2 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                <VideoCameraIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Video</span>
              </button>
              <button
                onClick={(e) => handleActionClick(e, 'voice', onStartVoiceCall, creator.voicePrice || creator.pricePerMin)}
                className="flex items-center justify-center gap-1.5 px-2 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium"
              >
                <PhoneIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Voice</span>
              </button>
              <button
                onClick={(e) => handleActionClick(e, 'message', onSendMessage, 0)}
                className="flex items-center justify-center gap-1.5 px-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Message</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Confirmation Dialog */}
        <AnimatePresence>
          {showConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-white rounded-lg p-6 max-w-sm w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold mb-4">
                  {confirmType === 'video' && 'Start Video Call?'}
                  {confirmType === 'voice' && 'Start Voice Call?'}
                  {confirmType === 'message' && 'Send Message?'}
                </h3>
                
                {confirmData?.rate > 0 && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Session Rate:</p>
                    <p className="text-2xl font-bold text-purple-600">${confirmData.rate}/min</p>
                    <p className="text-xs text-gray-500 mt-1">Minimum 5 minutes</p>
                  </div>
                )}
                
                {confirmType === 'message' && (
                  <p className="text-sm text-gray-600 mb-4">Start a conversation with {creator.displayName}</p>
                )}
                
                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  >
                    Confirm
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };


  // Simplified Quick View Modal
  const QuickViewModal = ({ creator, isOpen, onClose }) => {
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmationType, setConfirmationType] = useState('');
    const [confirmationData, setConfirmationData] = useState(null);

    if (!isOpen || !creator) return null;

    const handleActionClick = (type, callback, rate) => {
      setConfirmationType(type);
      setConfirmationData({ callback, rate });
      setShowConfirmation(true);
    };

    const handleConfirm = () => {
      if (confirmationData?.callback) {
        onClose();
        confirmationData.callback(creator);
      }
      setShowConfirmation(false);
    };

    const handleCancel = () => {
      setShowConfirmation(false);
      setConfirmationType('');
      setConfirmationData(null);
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden"
        >
          {/* Header Image */}
          <div className="relative h-48 bg-gradient-to-br from-purple-100 to-pink-100">
            {creator.avatar ? (
              <img 
                src={creator.avatar} 
                alt={creator.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-3xl font-bold">
                  {creator.displayName.charAt(0)}
                </div>
              </div>
            )}
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-2 rounded-full hover:bg-white transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-600" />
            </button>
            
            {/* Online Status */}
            {creator.isOnline && (
              <div className="absolute bottom-4 left-4 bg-green-500 text-white text-sm px-3 py-1 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                Online Now
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Creator Info */}
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{creator.displayName}</h2>
              <p className="text-gray-500 mb-2">@{creator.username}</p>
              {creator.bio && (
                <p className="text-gray-600 text-sm mb-3">{creator.bio}</p>
              )}
              
              {/* Stats */}
              <div className="flex items-center gap-4 text-sm">
                <div className="text-gray-500">
                  {creator.followers?.toLocaleString()} followers
                </div>
                <div className="text-gray-500">
                  {creator.totalSessions?.toLocaleString()} sessions
                </div>
              </div>
            </div>

            {/* Specialties */}
            {creator.specialties && creator.specialties.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Specialties</h3>
                <div className="flex flex-wrap gap-2">
                  {creator.specialties.map((specialty, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {creator.languages && creator.languages.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Languages</h3>
                <div className="flex gap-2">
                  {creator.languages.map((lang) => {
                    const language = languages.find(l => l.code === lang);
                    return language ? (
                      <span key={lang} className="text-sm">
                        {language.flag} {language.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}


            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleActionClick('video', onStartVideoCall, creator.videoPrice || creator.pricePerMin)}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                <VideoCameraIcon className="w-5 h-5" />
                Video Call
              </button>
              <button
                onClick={() => handleActionClick('voice', onStartVoiceCall, creator.voicePrice || creator.pricePerMin)}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium"
              >
                <PhoneIcon className="w-5 h-5" />
                Voice Call
              </button>
              <button
                onClick={() => handleActionClick('message', onSendMessage, 0)}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <ChatBubbleLeftRightIcon className="w-5 h-5" />
                Message
              </button>
              <button
                onClick={() => handleActionClick('schedule', onScheduleSession, creator.pricePerMin)}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <CalendarDaysIcon className="w-5 h-5" />
                Schedule
              </button>
              <button
                onClick={() => handleActionClick('tip', onTipCreator, 0)}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
              >
                <GiftIcon className="w-5 h-5" />
                Send Tip
              </button>
              <button
                onClick={() => handleActionClick('offer', onMakeOffer, 0)}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
              >
                <CurrencyDollarIcon className="w-5 h-5" />
                Make Offer
              </button>
            </div>
          </div>
        </motion.div>

        {/* Confirmation Dialog */}
        <AnimatePresence>
          {showConfirmation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-white rounded-lg p-6 max-w-sm w-full mx-4"
              >
                <h3 className="text-lg font-semibold mb-4">
                  {confirmationType === 'video' && 'Start Video Call?'}
                  {confirmationType === 'voice' && 'Start Voice Call?'}
                  {confirmationType === 'message' && 'Send Message?'}
                  {confirmationType === 'schedule' && 'Schedule Session?'}
                  {confirmationType === 'tip' && 'Send Tip?'}
                  {confirmationType === 'offer' && 'Make an Offer?'}
                </h3>
                
                {confirmationData?.rate > 0 && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Session Rate:</p>
                    <p className="text-2xl font-bold text-purple-600">${confirmationData.rate}/min</p>
                    <p className="text-xs text-gray-500 mt-1">Minimum 5 minutes</p>
                  </div>
                )}
                
                {confirmationType === 'message' && (
                  <p className="text-sm text-gray-600 mb-4">Start a conversation with {creator.displayName}</p>
                )}
                
                {confirmationType === 'tip' && (
                  <p className="text-sm text-gray-600 mb-4">Choose tip amount on the next screen</p>
                )}
                
                {confirmationType === 'offer' && (
                  <p className="text-sm text-gray-600 mb-4">Create a custom offer for {creator.displayName}</p>
                )}
                
                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  >
                    Confirm
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Mobile version
  if (isMobile) {
    const mobileCategories = categories.map(cat => ({
      id: cat.id,
      name: cat.label,
      icon: null // We'll use emoji for now
    }));

    const featuredCreators = filteredCreators
      .filter(c => c.isOnline)
      .slice(0, 5)
      .map(c => ({
        ...c,
        profilePicture: c.avatar,
        isLive: c.isOnline,
        isVerified: c.followers >= 10000,
        tags: c.specialties || []
      }));

    const trendingCreators = filteredCreators
      .sort((a, b) => b.followers - a.followers)
      .slice(0, 10)
      .map(c => ({
        ...c,
        profilePicture: c.avatar,
        isLive: c.isOnline,
        isVerified: c.followers >= 10000,
        tags: c.specialties || []
      }));

    return (
      <div className="min-h-screen bg-gray-50">
        <MobileLandingPage
          featuredCreators={featuredCreators}
          trendingCreators={trendingCreators}
          categories={mobileCategories}
          onCreatorSelect={onCreatorSelect}
          onCategorySelect={(category) => setSelectedCategory(category.id)}
          onSearch={(query) => setSearchTerm(query)}
          isLoading={loading}
        />
        
        {/* All Creators Section */}
        {filteredCreators.length > 0 && (
          <section className="px-4 pb-24">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <UserGroupIcon className="w-5 h-5 text-purple-500" />
              All Creators
            </h2>
            
            <div className="space-y-4">
              {filteredCreators.map((creator, index) => (
                <MobileCreatorCard
                  key={creator.id || creator.uid || index}
                  creator={{
                    ...creator,
                    profilePicture: creator.avatar,
                    isLive: creator.isOnline,
                    isVerified: creator.followers >= 10000,
                    tags: creator.specialties || []
                  }}
                  variant="default"
                  onSelect={() => onCreatorSelect?.(creator)}
                  onMessage={() => onStartVideoCall?.()}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // Desktop version
  return (
    <div className="min-h-screen bg-white">
      {/* Header - Clean and minimal */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <SparklesIcon className="w-6 h-6 text-purple-600" />
                Explore Creators
              </h1>
              <span className="text-sm text-gray-500">Connect with amazing creators</span>
            </div>
            
            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-purple-100 text-purple-600' 
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Squares2X2Icon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-purple-100 text-purple-600' 
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <BarsArrowUpIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search and Filters Row */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search creators by name or specialty..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                <AdjustmentsHorizontalIcon className="w-4 h-4" />
                Filters
                {(selectedLanguages.length > 0 || selectedCategory !== 'all') && (
                  <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {selectedLanguages.length + (selectedCategory !== 'all' ? 1 : 0)}
                  </span>
                )}
              </button>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm font-medium"
              >
                <option value="popular">Most Popular</option>
                <option value="rating">Most Followed</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="online">Online Now</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Filters Sidebar */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category Filter */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Categories</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {categories.map((category) => (
                      <label key={category.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="category"
                          checked={selectedCategory === category.id}
                          onChange={() => setSelectedCategory(category.id)}
                          className="text-purple-600 focus:ring-purple-500"
                        />
                        <span>{category.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Language Filter */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Languages</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {languages.map((lang) => (
                      <label key={lang.code} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedLanguages.includes(lang.code)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLanguages([...selectedLanguages, lang.code]);
                            } else {
                              setSelectedLanguages(selectedLanguages.filter(l => l !== lang.code));
                            }
                          }}
                          className="text-purple-600 rounded focus:ring-purple-500"
                        />
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <CreatorCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredCreators.length === 0 ? (
          /* No Results */
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <UserGroupIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No creators found</h3>
            <p className="text-gray-500 mb-4">Try adjusting your filters or search criteria</p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSelectedLanguages([]);
                setSearchTerm('');
                setSortBy('popular');
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          /* Creator Cards Grid/List */
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 'space-y-4'}>
            {filteredCreators.map((creator) => (
              <CreatorCard
                key={creator.id}
                creator={creator}
                onStartVideoCall={onStartVideoCall}
                onStartVoiceCall={onStartVoiceCall}
                onTipCreator={onTipCreator}
                onSendMessage={onSendMessage}
              />
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && !loading && (
          <div ref={loadMoreRef} className="mt-8 text-center">
            {isLoadingMore ? (
              <div className="inline-flex items-center gap-2 text-gray-500">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading more creators...
              </div>
            ) : (
              <button
                onClick={loadMoreCreators}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Load More
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick View Modal */}
      <QuickViewModal
        creator={quickViewCreator}
        isOpen={showQuickView}
        onClose={() => {
          setShowQuickView(false);
          setQuickViewCreator(null);
        }}
      />
    </div>
  );
}

export default ExplorePage;