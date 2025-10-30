import React, { useState, useEffect, useMemo, useCallback, useRef, startTransition } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  UserGroupIcon,
  SparklesIcon,
  StarIcon as StarIconSolid,
  ChevronDownIcon,
  VideoCameraIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  GiftIcon,
  CurrencyDollarIcon,
  LanguageIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  BarsArrowUpIcon,
  UserPlusIcon
} from '@heroicons/react/24/solid';
import { StarIcon } from '@heroicons/react/24/outline';
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import { normalizeCreator } from '../../utils/normalizeCreator';
import { isSelf } from '../../utils/creatorFilters';
import MobileLandingPage from '../mobile/MobileLandingPage';
import MobileCreatorCard from '../mobile/MobileCreatorCard';
import CreatorCard from '../CreatorCard';
import LiquidGlass from '../ui/LiquidGlass';
import { addBreadcrumb } from '../../lib/sentry.client';
import { getAuthToken } from '../../utils/supabase-auth';
import { useAuth } from '../../contexts/AuthContext';

// Helper to slugify display names as a last-resort fallback
const slugify = (s = '') =>
  s
    .normalize?.('NFKD')
    .replace(/[^\w\s.-]/g, '')    // strip emojis/punctuation except . _ -
    .trim()
    .replace(/\s+/g, '-')         // spaces -> dashes
    .toLowerCase();

// Derive a safe handle from creator data with multiple fallbacks
const deriveHandle = (c) => {
  const candidate =
    c?.username ||
    c?.slug ||
    c?.creator_handle ||
    c?.user?.username ||
    c?.profile?.username ||
    slugify(c?.displayName || c?.name || '');

  return (candidate || '').toLowerCase();
};

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
  const [searchParams, setSearchParams] = useSearchParams();
  const observerRef = useRef();
  const loadMoreRef = useRef();
  const controllerRef = useRef(null);

  // Auth state - gate data fetches behind auth resolution to prevent API hammering during bootstrap
  const { authLoading, roleResolved } = useAuth();
  const authReady = !authLoading && roleResolved;

  // State management
  const [creators, setCreators] = useState([]);
  const [filteredCreators, setFilteredCreators] = useState([]);
  const [liveCreators, setLiveCreators] = useState([]);
  const [savedCreators, setSavedCreators] = useState(() => {
    const saved = localStorage.getItem('savedCreators');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Filters - Initialize selectedCategory and showFollowing from URL params
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(() => {
    const categoryFromUrl = searchParams.get('category');
    return categoryFromUrl || 'all';
  });
  const [showFollowing, setShowFollowing] = useState(() => {
    return searchParams.get('following') === '1';
  });
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortBy, setSortBy] = useState('popular'); // 'popular', 'newest', 'price-low', 'price-high'

  // UI State
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  // QuickView removed - using CallConfirmationModal directly from creator cards
  // const [showQuickView, setShowQuickView] = useState(false);
  // const [quickViewCreator, setQuickViewCreator] = useState(null);
  
  // Mobile detection - responsive design instead of separate mobile view
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Handle URL parameter changes for category filtering and following filter
  useEffect(() => {
    const categoryFromUrl = searchParams.get('category');
    const followingFromUrl = searchParams.get('following') === '1';

    if (categoryFromUrl) {
      // Check if the category exists in our categories list
      const categoryExists = categories.some(cat => cat.id === categoryFromUrl);
      if (categoryExists) {
        setSelectedCategory(categoryFromUrl);
      } else {
        // If category doesn't exist, default to 'all'
        setSelectedCategory('all');
        searchParams.delete('category');
        setSearchParams(searchParams);
      }
    } else {
      setSelectedCategory('all');
    }

    setShowFollowing(followingFromUrl);
  }, [searchParams]);

  // Categories - matches the categories available in creator profiles
  const categories = [
    { id: 'all', label: 'All', icon: SparklesIcon },
    { id: 'Gaming', label: 'Gaming', icon: () => <span>🎮</span> },
    { id: 'Music', label: 'Music', icon: () => <span>🎵</span> },
    { id: 'Art', label: 'Art', icon: () => <span>🎨</span> },
    { id: 'Model', label: 'Model', icon: () => <span>👗</span> },
    { id: 'Fitness', label: 'Fitness', icon: () => <span>💪</span> },
    { id: 'Cooking', label: 'Cooking', icon: () => <span>👨‍🍳</span> },
    { id: 'Dance', label: 'Dance', icon: () => <span>💃</span> },
    { id: 'Comedy', label: 'Comedy', icon: () => <span>😄</span> },
    { id: 'Education', label: 'Education', icon: () => <span>📚</span> },
    { id: 'Lifestyle', label: 'Lifestyle', icon: () => <span>✨</span> },
    { id: 'Fashion', label: 'Fashion', icon: () => <span>👗</span> },
    { id: 'Tech', label: 'Tech', icon: () => <span>💻</span> },
    { id: 'Sports', label: 'Sports', icon: () => <span>⚽</span> },
    { id: 'Travel', label: 'Travel', icon: () => <span>✈️</span> },
    { id: 'Photography', label: 'Photography', icon: () => <span>📷</span> },
    { id: 'Crafts', label: 'Crafts', icon: () => <span>🎨</span> },
    { id: 'Beauty', label: 'Beauty', icon: () => <span>💄</span> },
    { id: 'Business', label: 'Business', icon: () => <span>💼</span> },
    { id: 'Meditation', label: 'Meditation', icon: () => <span>🧘</span> },
    { id: 'ASMR', label: 'ASMR', icon: () => <span>🎧</span> },
    { id: 'Wellness', label: 'Wellness', icon: () => <span>🌿</span> },
    { id: 'other', label: 'Other', icon: () => <span>🌟</span> }
  ];
  
  // Languages
  const languages = [
    'English', 'Spanish', 'French', 'German', 'Italian',
    'Portuguese', 'Russian', 'Japanese', 'Korean', 'Chinese',
    'Arabic', 'Hindi', 'Dutch', 'Swedish', 'Polish'
  ];

  // Debounced search function
  const debouncedSearch = useCallback((value) => {
    const timeoutId = setTimeout(() => {
      setSearchTerm(value);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, []);

  // Fetch creators from API with pagination, filters, and retry logic
  const fetchCreators = useCallback(async (pageNum = 1, append = false, isRetry = false) => {
    // Abort previous request to prevent overlapping calls
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      if (!isRetry) {
        setIsLoadingMore(append);
        setLoading(!append);
        setError(null);
      }
      
      // Build query parameters
      const params = new URLSearchParams({
        page: pageNum,
        limit: 20,
        category: selectedCategory,
        sortBy: sortBy,
        onlineOnly: false
      });

      // IMPORTANT: Pass excludeUserId to prevent self-discovery at API level
      const currentUserId = props.currentUserId || props.user?.id;
      if (currentUserId) {
        params.append('excludeUserId', currentUserId);
      }

      // Add following filter if enabled
      if (showFollowing) {
        params.append('following', '1');
      }

      // Add selected languages
      if (selectedLanguages.length > 0) {
        params.append('languages', selectedLanguages.join(','));
      }

      // Fetch real creators from database with retry logic
      const backendUrl = import.meta.env.VITE_BACKEND_URL ||
        (window.location.hostname === 'localhost' ? 'http://localhost:3005' : `http://${window.location.hostname}:3005`);

      // Get auth token for authenticated requests
      const authToken = await getAuthToken();
      const headers = {
        'Content-Type': 'application/json'
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetchWithRetry(
        `${backendUrl}/users/creators?${params.toString()}`,
        {
          method: 'GET',
          headers,
          signal: controller.signal,
          retries: 3,
          retryDelay: 1000
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Only show real creators, no fallback data
        if (!data.creators || data.creators.length === 0) {
          if (pageNum === 1) {
            setCreators([]);
          }
          setHasMore(false);
          return;
        }
        
        // Use normalized creator data
        const transformedCreators = data.creators.map(normalizeCreator).filter(Boolean);

        console.log('Fetched creators from API:', transformedCreators.length, 'creators');
        console.log('Sample creator data:', transformedCreators[0]);

        // Observability: Track data quality for missing handles
        if (transformedCreators.length > 0) {
          const creatorsWithoutHandle = transformedCreators.filter(c =>
            !c.username && !c.slug && !c.creator_handle
          );

          if (creatorsWithoutHandle.length > 0) {
            const percentage = Math.round((creatorsWithoutHandle.length / transformedCreators.length) * 100);
            addBreadcrumb('explore_creators_missing_handles', {
              total: transformedCreators.length,
              missing: creatorsWithoutHandle.length,
              percentage: `${percentage}%`,
              page: pageNum,
              category: 'data_quality'
            });
          }
        }

        if (pageNum === 1) {
          setCreators(transformedCreators);
        } else {
          setCreators(prev => [...prev, ...transformedCreators]);
        }
        
        setHasMore(data.hasMore || transformedCreators.length === 20);
        setPage(pageNum);
      } else {
        // API error - show empty state instead of mock data
        console.error('Failed to fetch creators:', response.status);
        if (pageNum === 1) {
          setCreators([]);
        }
        setHasMore(false);

        // User-facing error on 500
        if (response.status >= 500) {
          setError(`Server error (${response.status}). Please try again later.`);
          toast.error('Server error. Please try again later.');
        } else {
          toast.error('Failed to load creators. Please try again.');
        }
      }
    } catch (error) {
      // Ignore AbortError from cancelled requests
      if (error.name === 'AbortError') {
        console.log('Request cancelled:', pageNum);
        return;
      }

      console.error('Error fetching creators:', error);

      // Show empty state instead of mock data
      if (pageNum === 1) {
        setCreators([]);
      }
      setHasMore(false);

      // Auto-retry logic with exponential backoff + jitter (max 3 retries)
      if (!isRetry && retryCount < 3) {
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        const jitter = Math.floor(Math.random() * 250); // Add jitter to avoid thundering herd
        const finalDelay = retryDelay + jitter;
        console.log(`Retry ${retryCount + 1}/3 in ${finalDelay}ms...`);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchCreators(pageNum, append, true);
        }, finalDelay);
      } else if (retryCount >= 3) {
        console.error('Max retries reached, stopping retry loop');
        setError('Failed to load creators. Please refresh the page.');
        toast.error('Unable to load creators. Please refresh the page.');
      }
    } finally {
      if (!isRetry) {
        setLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [selectedCategory, selectedLanguages, sortBy, showFollowing, retryCount]);


  // Fetch live creators
  const fetchLiveCreators = useCallback(async () => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL ||
        (window.location.hostname === 'localhost' ? 'http://localhost:3005' : `http://${window.location.hostname}:3005`);
      const response = await fetch(`${backendUrl}/streaming/public/streams/live`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.streams && data.streams.length > 0) {
          // Transform stream data to creator format for display
          const liveCreatorsList = data.streams.map(stream => ({
            id: stream.creator_id,
            username: stream.creator_username,
            display_name: stream.creator_name,
            profile_pic_url: stream.creator_avatar,
            is_live: true,
            stream_title: stream.title,
            viewer_count: stream.viewer_count,
            category: stream.category,
            is_free: stream.is_free,
            stream_id: stream.id
          }));
          setLiveCreators(liveCreatorsList);
        } else {
          setLiveCreators([]);
        }
      }
    } catch (error) {
      console.error('Error fetching live creators:', error);
    }
  }, []);

  // Initial load with retry mechanism - GATED behind auth resolution
  useEffect(() => {
    // Don't fetch until auth is ready - prevents API hammering during bootstrap
    if (!authReady) {
      console.log('⏳ ExplorePage: Waiting for auth to resolve before fetching creators');
      return;
    }

    console.log('✅ ExplorePage: Auth ready, fetching creators');

    // Immediately start loading creators (no delay)
    fetchCreators(1, false, false);
    fetchLiveCreators();

    // Refresh live creators every 30 seconds
    const interval = setInterval(fetchLiveCreators, 30000);
    return () => clearInterval(interval);
  }, [authReady]); // Only fetch when auth is ready

  // Refetch when filters change (including following toggle)
  useEffect(() => {
    // Reset retry count when filters change
    setRetryCount(0);
    setError(null);
    fetchCreators(1, false);
  }, [selectedCategory, sortBy, showFollowing]);

  // Filter and sort creators
  const filterAndSortCreators = useCallback(() => {
    let filtered = [...creators];

    // IMPORTANT: Filter out the logged-in user's own creator card
    // Creators should not see themselves in the Explore page
    const currentUserId = props.currentUserId || props.user?.id;
    const currentUsername = props.user?.username;
    if (currentUserId || currentUsername) {
      filtered = filtered.filter(creator => !isSelf(creator, currentUserId, currentUsername));
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(creator =>
        creator.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        creator.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        creator.bio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        creator.specialties?.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Category filter - check if creator's interests include the selected category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(creator => {
        // Check both interests and specialties for backward compatibility
        const creatorCategories = creator.interests || creator.specialties || [];
        return creatorCategories.some(cat =>
          cat.toLowerCase() === selectedCategory.toLowerCase()
        );
      });
    }

    // Language filter
    if (selectedLanguages.length > 0) {
      filtered = filtered.filter(creator =>
        creator.languages?.some(lang => selectedLanguages.includes(lang))
      );
    }

    // Apply sorting based on sortBy state
    switch(sortBy) {
      case 'newest':
        filtered.sort((a, b) => {
          // If we have createdAt, use it; otherwise sort by ID
          const aTime = a.createdAt || 0;
          const bTime = b.createdAt || 0;
          return bTime - aTime;
        });
        break;
      case 'price-low':
        filtered.sort((a, b) => (a.videoPrice || 0) - (b.videoPrice || 0));
        break;
      case 'price-high':
        filtered.sort((a, b) => (b.videoPrice || 0) - (a.videoPrice || 0));
        break;
      case 'popular':
      default:
        // Priority sorting: Live > Online > Popularity
        filtered.sort((a, b) => {
          if (a.isLive && !b.isLive) return -1;
          if (!a.isLive && b.isLive) return 1;

          if (!a.isLive && !b.isLive) {
            if (a.isOnline && !b.isOnline) return -1;
            if (!a.isOnline && b.isOnline) return 1;
          }

          const aPopularity = (a.followerCount || 0) + (a.totalSessions || 0) + ((a.rating || 0) * 10);
          const bPopularity = (b.followerCount || 0) + (b.totalSessions || 0) + ((b.rating || 0) * 10);
          return bPopularity - aPopularity;
        });
        break;
    }

    setFilteredCreators(filtered);
  }, [creators, searchTerm, selectedCategory, selectedLanguages, sortBy, props.currentUserId, props.user?.id]);

  // Apply filters when dependencies change
  useEffect(() => {
    console.log('Creators state updated:', creators.length, 'creators');
    if (creators.length > 0) {
      console.log('Applying filters to creators');
      filterAndSortCreators();
    } else if (!loading) {
      console.log('No creators and not loading, clearing filtered list');
      setFilteredCreators([]);
    }
  }, [creators, searchTerm, selectedCategory, selectedLanguages, loading]);

  // Toggle save creator
  const toggleSaveCreator = (creatorId) => {
    setSavedCreators(prev => {
      const newSaved = prev.includes(creatorId) 
        ? prev.filter(id => id !== creatorId)
        : [...prev, creatorId];
      
      localStorage.setItem('savedCreators', JSON.stringify(newSaved));
      toast.success(prev.includes(creatorId) ? 'Removed from saved' : 'Added to saved');
      return newSaved;
    });
  };

  // Load more creators
  const loadMoreCreators = () => {
    if (!isLoadingMore && hasMore) {
      fetchCreators(page + 1, true);
    }
  };

  // Close sort menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showSortMenu && !e.target.closest('.sort-menu-container')) {
        setShowSortMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSortMenu]);

  // Infinite scroll
  useEffect(() => {
    if (!hasMore || isLoadingMore) return;
    
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          loadMoreCreators();
        }
      },
      { threshold: 0.1 }
    );
    
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    
    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [hasMore, isLoadingMore, page]);

  // Skeleton loader component
  const CreatorCardSkeleton = () => (
    <div className="animate-pulse">
      <div className="bg-gray-200 dark:bg-gray-700 rounded-[1.5rem] h-[380px] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-gray-300 dark:from-gray-600 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="bg-gray-300 dark:bg-gray-600 rounded-xl p-3 space-y-2">
            <div className="h-5 bg-gray-400 dark:bg-gray-500 rounded w-3/4" />
            <div className="h-4 bg-gray-400 dark:bg-gray-500 rounded w-1/2" />
            <div className="flex gap-2 mt-3">
              <div className="h-8 bg-gray-400 dark:bg-gray-500 rounded flex-1" />
              <div className="h-8 bg-gray-400 dark:bg-gray-500 rounded flex-1" />
              <div className="h-8 bg-gray-400 dark:bg-gray-500 rounded flex-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  
  // Inline CreatorCard replaced with CreatorCardEnhanced component - removed
  // All old CreatorCard code has been removed - using CreatorCardEnhanced instead

  // QuickViewModal removed - using CallConfirmationModal directly from creator cards
  // The confirmation modal is now handled within CreatorCardEnhanced

  // Return mobile landing page for non-logged-in mobile users
  if (isMobile && !props.user) {
    return <MobileLandingPage onLogin={props.onLogin} />;
  }

  // Main render
  return (
    <div className={`min-h-screen ${isMobile ? 'bg-gradient-to-br from-purple-50 via-white to-pink-50' : 'bg-gray-50 dark:bg-gray-900'}`}>
      {/* Filters Bar */}
      <LiquidGlass className="sticky top-0 z-40 shadow-sm content-below-nav" intensity="medium">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-5 md:py-6">

          {/* Search and Filters Row */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative min-w-0">
              <input
                type="search"
                inputMode="search"
                enterKeyHint="search"
                placeholder="Search creators..."
                defaultValue={searchTerm}
                onChange={(e) => debouncedSearch(e.target.value)}
                className="w-full h-10 pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-xs sm:text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                aria-label="Search creators"
              />
              <MagnifyingGlassIcon className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>

            {/* Following Toggle Button - Icon Only */}
            <button
              onClick={() => {
                const newValue = !showFollowing;
                setShowFollowing(newValue);
                // Update URL params
                const newParams = new URLSearchParams(searchParams);
                if (newValue) {
                  newParams.set('following', '1');
                } else {
                  newParams.delete('following');
                }
                setSearchParams(newParams, { replace: true });
              }}
              className={`h-10 w-10 flex items-center justify-center border rounded-lg transition-all ${
                showFollowing
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              aria-pressed={showFollowing}
              aria-label={showFollowing ? 'Show all creators' : 'Show only creators you follow'}
              title={showFollowing ? 'Show all creators' : 'Show only creators you follow'}
            >
              <UserPlusIcon className="w-5 h-5" />
            </button>

            {/* Filter Buttons */}
            <div className="flex gap-1 sm:gap-2 relative">
              {/* Sort Button */}
              <div className="relative sort-menu-container">
                <button
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className="h-10 w-10 flex items-center justify-center border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
                  title="Sort by"
                >
                  <BarsArrowUpIcon className="w-5 h-5" />
                </button>

                {/* Sort Dropdown Menu */}
                {showSortMenu && (
                  <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50">
                    <button
                      onClick={() => { setSortBy('popular'); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${sortBy === 'popular' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-medium' : 'text-gray-700 dark:text-gray-300'} first:rounded-t-lg`}
                    >
                      Popular
                    </button>
                    <button
                      onClick={() => { setSortBy('newest'); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${sortBy === 'newest' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                    >
                      Newest
                    </button>
                    <button
                      onClick={() => { setSortBy('price-low'); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${sortBy === 'price-low' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                    >
                      Price: Low to High
                    </button>
                    <button
                      onClick={() => { setSortBy('price-high'); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${sortBy === 'price-high' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-medium' : 'text-gray-700 dark:text-gray-300'} last:rounded-b-lg`}
                    >
                      Price: High to Low
                    </button>
                  </div>
                )}
              </div>

              {/* Filter Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="h-10 w-10 relative flex items-center justify-center border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
                title="Filters"
              >
                <AdjustmentsHorizontalIcon className="w-5 h-5" />
                {(selectedLanguages.length > 0 || selectedCategory !== 'all') && (
                  <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-medium">
                    {selectedLanguages.length + (selectedCategory !== 'all' ? 1 : 0)}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Expanded Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-4 pb-3 border-t border-gray-200 dark:border-gray-700 mt-3">
                  {/* Categories */}
                  <div className="mb-5">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Categories</h3>
                    <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategory(cat.id);
                            // Update URL params when category is selected
                            if (cat.id === 'all') {
                              searchParams.delete('category');
                            } else {
                              searchParams.set('category', cat.id);
                            }
                            setSearchParams(searchParams);
                          }}
                          className={`flex items-center justify-center sm:justify-start gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                            selectedCategory === cat.id
                              ? 'bg-purple-600 text-white shadow-md hover:bg-purple-700'
                              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-purple-300 dark:hover:border-purple-500'
                          }`}
                        >
                          {typeof cat.icon === 'function' ? <cat.icon /> : <cat.icon className="w-4 h-4" />}
                          <span className="truncate">{cat.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Languages */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Languages</h3>
                    <div className="flex flex-wrap gap-2">
                      {languages.map(lang => (
                        <button
                          key={lang}
                          onClick={() => {
                            setSelectedLanguages(prev =>
                              prev.includes(lang)
                                ? prev.filter(l => l !== lang)
                                : [...prev, lang]
                            );
                          }}
                          className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                            selectedLanguages.includes(lang)
                              ? 'bg-purple-600 text-white shadow-md hover:bg-purple-700'
                              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-purple-300 dark:hover:border-purple-500'
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </LiquidGlass>

      {/* Live Now Section */}
      {liveCreators.length > 0 && (
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-800 dark:to-pink-800">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">Live Now</h2>
                </div>
                <span className="text-white/80 text-sm">
                  {liveCreators.length} creator{liveCreators.length !== 1 ? 's' : ''} streaming
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchTerm('');
                  // Scroll to main content
                  document.getElementById('main-content')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-white/80 hover:text-white text-sm font-medium transition-colors"
              >
                View All
              </button>
            </div>
            
            {/* Horizontal scrollable list of live creators */}
            <div className="overflow-x-auto pb-2 -mx-3 px-3">
              <div className="flex gap-3 sm:gap-4" style={{ minWidth: 'max-content' }}>
                {liveCreators.map((creator) => (
                  <motion.div
                    key={creator.id}
                    whileHover={{ scale: 1.05 }}
                    className="bg-white dark:bg-gray-800 rounded-xl p-3 cursor-pointer shadow-md hover:shadow-lg transition-shadow w-48 sm:w-56"
                    onClick={() => {
                      if (onCreatorSelect) {
                        onCreatorSelect(creator);
                      } else {
                        startTransition(() => {
                          navigate(`/stream/${creator.username}`);
                        });
                      }
                    }}
                  >
                    <div className="relative mb-2">
                      <img
                        src={creator.profile_pic_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.username}`}
                        alt={creator.display_name}
                        className="w-full h-32 sm:h-40 object-cover rounded-lg"
                      />
                      <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                        LIVE
                      </div>
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 text-white px-2 py-1 rounded text-xs">
                        <UserGroupIcon className="w-3 h-3" />
                        {creator.viewer_count}
                      </div>
                      {creator.category && (
                        <div className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-xs">
                          {creator.category}
                        </div>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {creator.display_name || creator.username}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {creator.stream_title || 'Live Stream'}
                    </p>
                    {creator.is_free === false && (
                      <div className="mt-2 flex items-center gap-1">
                        <CurrencyDollarIcon className="w-3 h-3 text-purple-600" />
                        <span className="text-xs text-purple-600 font-medium">Premium Stream</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error ? (
          /* Error State */
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
              <XMarkIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Unable to load creators
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              {error}
            </p>
            <button
              onClick={() => {
                setError(null);
                setRetryCount(0);
                fetchCreators(1, false);
              }}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : loading && filteredCreators.length === 0 ? (
          /* Loading Skeleton */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <CreatorCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredCreators.length === 0 ? (
          /* No Results */
          <div className="text-center py-12">
            <UserGroupIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {showFollowing ? "You're not following any creators yet" : "No creators found"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {showFollowing
                ? "Explore and tap the Follow button on creator cards to see them here"
                : searchTerm || selectedCategory !== 'all' || selectedLanguages.length > 0
                ? 'Try adjusting your filters or search terms'
                : 'No creators have registered yet. Check back later or become a creator yourself!'}
            </p>
            {(searchTerm || selectedCategory !== 'all' || selectedLanguages.length > 0 || showFollowing) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setSelectedLanguages([]);
                  setShowFollowing(false);
                  // Clear URL parameters
                  const newParams = new URLSearchParams(searchParams);
                  newParams.delete('category');
                  newParams.delete('following');
                  setSearchParams(newParams);
                  // Refetch creators after clearing filters
                  fetchCreators(1);
                }}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                {showFollowing ? 'Explore All Creators' : 'Clear all filters'}
              </button>
            )}
          </div>
        ) : (
          /* Creator Cards Grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4">
            {filteredCreators.map((creator, index) => {
              // Normalize creator handle before passing to card
              const handle = deriveHandle(creator);
              const normalized = {
                ...creator,
                // Ensure CreatorCard always finds one of these
                username: handle || undefined,
                slug: creator?.slug || undefined,
                specialties: creator.specialties || creator.tags || (creator.creator_type ? [creator.creator_type] : ['General']),
                languages: creator.languages || ['English']
              };

              return isMobile ? (
                <CreatorCard
                  key={creator.id || handle || `creator-${index}`}
                  creator={normalized}
                  onSelect={() => {
                    if (onCreatorSelect) {
                      onCreatorSelect(creator);
                    } else {
                      const identifier = creator.username || creator.id || creator.supabase_id;
                      if (identifier) {
                        startTransition(() => {
                          navigate(`/creator/${identifier}`);
                        });
                      }
                    }
                  }}
                  onCall={(creator) => onStartVoiceCall && onStartVoiceCall(creator)}
                  onMessage={(creator) => onSendMessage && onSendMessage(creator)}
                  variant="default"
                />
              ) : (
                <CreatorCard
                  key={creator.id || handle || `creator-${index}`}
                  creator={normalized}
                  onJoinSession={(serviceType, confirmationData) => {
                  console.log('ExplorePage onJoinSession:', serviceType, confirmationData);
                  
                  // The confirmation modal has already been shown and accepted
                  // Now we can proceed with the actual call/message
                  if (serviceType === 'video' && onStartVideoCall) {
                    console.log('Video call request accepted for:', creator.username);
                    // Pass the session data from confirmation
                    onStartVideoCall(creator, confirmationData);
                  } else if (serviceType === 'voice' && onStartVoiceCall) {
                    console.log('Voice call request accepted for:', creator.username);
                    onStartVoiceCall(creator, confirmationData);
                  } else if (serviceType === 'message' && onSendMessage) {
                    console.log('Message request accepted for:', creator.username);
                    onSendMessage(creator, confirmationData);
                  } else {
                    console.warn('No handler for service type:', serviceType);
                  }
                }}
                onTip={onTipCreator}
                onMessage={onSendMessage}
                isSaved={savedCreators.includes(creator.id)}
                onToggleSave={(creatorId) => toggleSaveCreator(creatorId)}
                onCardClick={() => {
                  if (onCreatorSelect) {
                    onCreatorSelect(creator);
                  } else {
                    // Use username or fallback to id
                    const identifier = creator.username || creator.id || creator.supabase_id;
                    if (identifier) {
                      console.log('Navigating to creator:', identifier, creator);
                      startTransition(() => {
                        navigate(`/creator/${identifier}`);
                      });
                    } else {
                      console.error('No identifier found for creator:', creator);
                    }
                  }
                }}
                isLazyLoaded={true}
                currentUserId={props.currentUserId || props.user?.id}
                tokenBalance={props.tokenBalance || 0}
              />
              );
            })}
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

      {/* Quick View Modal removed - confirmation handled in CreatorCardEnhanced */}
    </div>
  );
};

export default ExplorePage;