import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../utils/supabase-auth';
import Button from '../ui/Button';
import {
  PlayIcon,
  UserGroupIcon,
  SparklesIcon,
  FireIcon,
  EyeIcon,
  ChatBubbleLeftRightIcon,
  SignalIcon,
  ClockIcon,
  VideoCameraIcon,
  MicrophoneIcon,
  MusicalNoteIcon,
  PaintBrushIcon,
  AcademicCapIcon,
  BeakerIcon,
  ChartBarIcon,
  GlobeAltIcon,
  TvIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  ShareIcon,
  QueueListIcon,
  ArrowPathIcon,
  FlagIcon,
  LanguageIcon,
  BellIcon,
  PlusIcon,
  AdjustmentsHorizontalIcon,
  FunnelIcon,
  XMarkIcon,
  CheckBadgeIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ViewColumnsIcon,
  BookmarkIcon,
  ArrowTrendingUpIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import {
  StarIcon as StarSolid,
  CheckBadgeIcon as CheckBadgeSolid,
  CurrencyDollarIcon
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import StreamPreviewModal from '../StreamPreviewModal';
import TVSubscriptionModal from '../TVSubscriptionModal';
import VODPurchaseModal from '../VODPurchaseModal';
import DigisWatermark from '../DigisWatermark';
import Container from '../ui/Container';

const TVPage = ({ user, isCreator, onJoinStream, onGoLive, tokenBalance, onTokenPurchase }) => {
  // ✅ CRITICAL FIX: Move all useState hooks BEFORE useEffect
  // React error #310 occurs when hooks are in different order between renders
  const [liveStreams, setLiveStreams] = useState([]);
  const [filteredStreams, setFilteredStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredStream, setHoveredStream] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [isTrialAvailable, setIsTrialAvailable] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(!!user);
  const [isTrial, setIsTrial] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [trialEndDate, setTrialEndDate] = useState(null);
  const [trialExpired, setTrialExpired] = useState(false);
  
  // New states for enhanced features
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [showReplays, setShowReplays] = useState(false);
  const [streamQueue, setStreamQueue] = useState([]);
  const [likedStreams, setLikedStreams] = useState([]);
  const [showStreamPreview, setShowStreamPreview] = useState(false);
  const [previewStream, setPreviewStream] = useState(null);
  const [followedCreators, setFollowedCreators] = useState([]);
  const [subscribedCreators, setSubscribedCreators] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  
  // New enhanced states
  const [viewMode, setViewMode] = useState('list'); // Force list mode on mobile
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentlyWatched, setRecentlyWatched] = useState([]);
  const [trendingStreams, setTrendingStreams] = useState([]);
  const [savedFilters, setSavedFilters] = useState(null);
  const [viewerCounts, setViewerCounts] = useState({});
  const [upcomingStreams, setUpcomingStreams] = useState([]);
  const [replays, setReplays] = useState([]);
  const [showVODPurchase, setShowVODPurchase] = useState(false);
  const [selectedVOD, setSelectedVOD] = useState(null);
  const [vodAccess, setVodAccess] = useState({});

  // ✅ All useRef hooks after useState hooks
  const searchRef = useRef(null);

  // Categories configuration
  const categories = [
    { id: 'all', label: 'All', icon: SparklesIcon },
    { id: 'music', label: 'Music', icon: MusicalNoteIcon },
    { id: 'gaming', label: 'Gaming', icon: VideoCameraIcon },
    { id: 'news', label: 'News', icon: GlobeAltIcon },
    { id: 'sports', label: 'Sports', icon: FlagIcon },
    { id: 'learning', label: 'Learning', icon: AcademicCapIcon },
    { id: 'fashion-beauty', label: 'Fashion & Beauty', icon: SparklesIcon },
    { id: 'podcasts', label: 'Podcasts', icon: MicrophoneIcon },
    { id: 'cooking', label: 'Cooking', icon: BeakerIcon },
    { id: 'fitness', label: 'Fitness', icon: FireIcon },
    { id: 'art', label: 'Art', icon: PaintBrushIcon },
    { id: 'talk', label: 'Talk Shows', icon: MicrophoneIcon },
    { id: 'business', label: 'Business', icon: ChartBarIcon }
  ];

  // Dark mode now works properly - no forced white background needed

  // Popular search suggestions
  const popularSearches = [
    'gaming tournaments', 'music live', 'cooking show', 'fitness workout',
    'art tutorial', 'business tips', 'podcast interview', 'sports commentary'
  ];

  useEffect(() => {
    if (user) {
      checkSubscription();
    } else {
      setCheckingSubscription(false);
      setHasAccess(false);
      // Don't show modal automatically - only when clicking a stream
    }
  }, [user]);

  useEffect(() => {
    // Always fetch streams to show behind overlay
    fetchLiveStreams();
    fetchUpcomingStreams();
    fetchReplays();
    loadSavedPreferences();
    loadRecentlyWatched();

    // Set up real-time viewer count updates
    const interval = setInterval(() => {
      updateViewerCounts();
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let filtered = [...liveStreams];
    
    // Apply category filter
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(stream => stream.category === selectedCategory);
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(stream => 
        stream.title.toLowerCase().includes(query) ||
        stream.creatorName.toLowerCase().includes(query) ||
        stream.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    setFilteredStreams(filtered);
    
    // Set trending streams (top 5 by viewers)
    const trending = [...filtered].sort((a, b) => b.viewers - a.viewers).slice(0, 5);
    setTrendingStreams(trending);
  }, [liveStreams, selectedCategory, searchQuery]);
  
  // Save filter preferences to localStorage
  useEffect(() => {
    if (selectedCategory || viewMode) {
      localStorage.setItem('tvPagePreferences', JSON.stringify({
        category: selectedCategory,
        viewMode: viewMode
      }));
    }
  }, [selectedCategory, viewMode]);
  
  // Generate search suggestions
  useEffect(() => {
    if (searchQuery.length > 1) {
      const suggestions = popularSearches.filter(search =>
        search.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchSuggestions(suggestions);
    } else {
      setSearchSuggestions([]);
    }
  }, [searchQuery]);
  
  // Close search suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ✅ Mount beacon for diagnostics - placed AFTER all hooks
  useEffect(() => {
    console.info("[MOUNT] TVPage.js");
  }, []);

  const checkSubscription = async () => {
    console.log('Checking subscription for user:', user);
    if (!user) {
      console.log('No user, setting checkingSubscription to false');
      setCheckingSubscription(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/tv-subscription/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Subscription data:', data);
        setHasAccess(data.hasAccess);
        setSubscription(data.subscription);
        setIsTrialAvailable(data.isTrialAvailable);
        setIsTrial(data.isTrial || false);
        setTrialDaysRemaining(data.trialDaysRemaining || 0);
        setTrialEndDate(data.trialEndDate || null);
        setTrialExpired(data.trialExpired || false);
        
        // Show toast notification for creators on trial
        if (isCreator && data.isTrial && data.hasAccess) {
          // Check if we've already shown the notification this session
          const hasShownTrialNotification = sessionStorage.getItem('creatorTrialNotificationShown');
          if (!hasShownTrialNotification) {
            toast.success('Enjoy your Free Trial of Digis TV!', {
              duration: 5000,
              icon: '🎉',
              style: {
                background: '#10b981',
                color: '#fff',
              },
            });
            sessionStorage.setItem('creatorTrialNotificationShown', 'true');
          }
        }
        
        // Don't show subscription modal if user has trial access
        if (!data.hasAccess && !data.isTrial) {
          setShowSubscriptionModal(true);
        }
      } else {
        console.error('Failed to check subscription status:', response.status);
        setHasAccess(false);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      setHasAccess(false);
    } finally {
      console.log('Setting checkingSubscription to false');
      setCheckingSubscription(false);
    }
  };

  const handleStartTrial = async () => {
    if (!user) {
      toast.error('Please sign in to start your free trial');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/tv-subscription/start-trial`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      setSubscription(data.subscription);
      setHasAccess(true);
      setIsTrialAvailable(false);
      fetchLiveStreams();
    } else {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start trial');
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      toast.error('Please sign in to subscribe');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/tv-subscription/subscribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      setSubscription(data.subscription);
      setHasAccess(true);
      fetchLiveStreams();
      return data;
    } else {
      const error = await response.json();
      throw new Error(error.error || 'Failed to subscribe');
    }
  };

  const fetchUpcomingStreams = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/public/streams/upcoming`);
      if (response.ok) {
        const data = await response.json();
        // Transform the data to match the expected format
        const formattedStreams = (data.streams || []).map(stream => ({
          id: stream.id,
          creatorId: stream.creator_id,
          creatorName: stream.creator_name || stream.creator_username,
          title: stream.title,
          description: stream.description || '',
          scheduledTime: stream.scheduled_time || stream.start_time,
          category: stream.category || 'general',
          expectedDuration: stream.expected_duration || 60,
          tags: stream.tags || []
        }));
        setUpcomingStreams(formattedStreams);
      } else {
        setUpcomingStreams([]);
      }
    } catch (error) {
      console.error('Error fetching upcoming streams:', error);
      setUpcomingStreams([]);
    }
  };

  const fetchReplays = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/public/streams/replays`);
      if (response.ok) {
        const data = await response.json();
        // Transform the data to match the expected format
        const formattedReplays = (data.replays || []).map(replay => ({
          id: replay.id,
          creatorId: replay.creator_id,
          creatorName: replay.creator_name || replay.creator_username,
          title: replay.title,
          category: replay.category || 'general',
          recordedDate: replay.recorded_date || replay.created_at,
          duration: replay.duration || '0:00',
          duration_seconds: replay.duration_seconds,
          views: replay.view_count || 0,
          likes: replay.like_count || 0,
          language: replay.language || 'English',
          price_in_tokens: replay.price_in_tokens || 50,
          is_free: replay.is_free || false,
          thumbnail_url: replay.thumbnail_url,
          stream_title: replay.title,
          creator_name: replay.creator_name || replay.creator_username,
          creator_avatar: replay.creator_avatar,
          created_at: replay.created_at
        }));
        setReplays(formattedReplays);
      } else {
        setReplays([]);
      }
    } catch (error) {
      console.error('Error fetching VODs:', error);
      setReplays([]);
    }
  };

  const fetchLiveStreams = async () => {
    try {
      setLoading(true);
      
      // Fetch real streams from API
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/public/streams/live`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Map API response to expected format
        const apiStreams = (data.streams || []).map(stream => ({
          id: stream.id,
          creatorId: stream.creator_id,
          creatorName: stream.creator_name || stream.creator_username,
          creatorAvatar: stream.creator_avatar,
          title: stream.title,
          category: stream.category || 'other',
          thumbnail: stream.thumbnail,
          viewers: stream.viewer_count || 0,
          duration: formatStreamDuration(stream.started_at),
          tags: stream.tags || [],
          isLive: stream.is_live,
          isFree: stream.is_free !== false,
          likes: stream.likes || 0,
          tips: stream.tips || 0,
          streamStarted: new Date(stream.started_at),
          language: stream.language || 'English',
          goal: stream.goal,
          series: stream.series
        }));
        
        if (apiStreams.length > 0) {
          setLiveStreams(apiStreams);
        } else {
          // No live streams available
          setLiveStreams([]);
        }
      } else {
        // API error
        setLiveStreams([]);
      }
    } catch (error) {
      console.error('Error fetching live streams:', error);
      setLiveStreams([]);
    } finally {
      setLoading(false);
    }
  };
  
  const formatStreamDuration = (startedAt) => {
    if (!startedAt) return '0:00:00';
    
    const start = new Date(startedAt);
    const now = new Date();
    const diff = Math.floor((now - start) / 1000);
    
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Load saved preferences from localStorage
  const loadSavedPreferences = () => {
    try {
      const saved = localStorage.getItem('tvPagePreferences');
      if (saved) {
        const prefs = JSON.parse(saved);
        if (prefs.category) setSelectedCategory(prefs.category);
        if (prefs.viewMode) setViewMode(prefs.viewMode);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };
  
  // Load recently watched streams
  const loadRecentlyWatched = () => {
    try {
      const recent = localStorage.getItem('recentlyWatchedStreams');
      if (recent) {
        const parsed = JSON.parse(recent);
        // Filter out any mock data or invalid entries
        const validStreams = parsed.filter(stream => 
          stream && stream.id && !stream.creatorName?.includes('Alex Gaming')
        );
        setRecentlyWatched(validStreams);
        // Update localStorage with cleaned data
        if (validStreams.length !== parsed.length) {
          localStorage.setItem('recentlyWatchedStreams', JSON.stringify(validStreams));
        }
      }
    } catch (error) {
      console.error('Error loading recently watched:', error);
      // Clear corrupted data
      localStorage.removeItem('recentlyWatchedStreams');
      setRecentlyWatched([]);
    }
  };
  
  // Save to recently watched
  const addToRecentlyWatched = (stream) => {
    const updated = [stream, ...recentlyWatched.filter(s => s.id !== stream.id)].slice(0, 10);
    setRecentlyWatched(updated);
    localStorage.setItem('recentlyWatchedStreams', JSON.stringify(updated));
  };
  
  // Update viewer counts with simulated real-time data
  const updateViewerCounts = () => {
    setLiveStreams(prevStreams => 
      prevStreams.map(stream => ({
        ...stream,
        viewers: stream.viewers + Math.floor(Math.random() * 20) - 10 // Simulate fluctuation
      }))
    );
  };
  
  // Handle search with debouncing
  const handleSearch = useCallback((value) => {
    setSearchQuery(value);
    setShowSuggestions(value.length > 0);
  }, []);


  const formatDuration = (duration) => {
    const parts = duration.split(':');
    if (parts[0] === '0') {
      return `${parts[1]}:${parts[2]}`;
    }
    return duration;
  };

  const formatViewers = (count) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const handleStreamClick = (stream) => {
    // Check if user has access before joining stream
    if (!hasAccess) {
      setShowSubscriptionModal(true);
      return;
    }
    
    // Add to recently watched
    addToRecentlyWatched(stream);
    
    // Open the stream preview modal
    setPreviewStream(stream);
    setShowStreamPreview(true);
  };

  const handleLikeStream = (e, streamId) => {
    e.stopPropagation();
    const isLiked = likedStreams.includes(streamId);
    if (isLiked) {
      setLikedStreams(likedStreams.filter(id => id !== streamId));
      // toast.success('Removed from favorites');
    } else {
      setLikedStreams([...likedStreams, streamId]);
      // toast.success('Added to favorites');
    }
  };

  const handleTipStream = (e, stream) => {
    e.stopPropagation();
    // In production, this would open a tip modal
    // toast.success(`Opening tip modal for ${stream.creatorName}`);
  };

  const handleShareStream = (e, stream) => {
    e.stopPropagation();
    // In production, this would share the stream link
    navigator.clipboard.writeText(`https://digis.tv/stream/${stream.id}`);
    // toast.success('Stream link copied to clipboard!');
  };

  const handleAddToQueue = (e, stream) => {
    e.stopPropagation();
    if (streamQueue.find(s => s.id === stream.id)) {
      toast.info('Already in queue');
    } else {
      setStreamQueue([...streamQueue, stream]);
      // toast.success('Added to watch queue');
    }
  };

  const handleFollowCreator = (creatorId) => {
    if (followedCreators.includes(creatorId)) {
      setFollowedCreators(followedCreators.filter(id => id !== creatorId));
      toast.success('Unfollowed creator');
    } else {
      setFollowedCreators([...followedCreators, creatorId]);
      toast.success('Following creator!');
    }
  };

  const handleSubscribeCreator = (creatorId) => {
    if (subscribedCreators.includes(creatorId)) {
      toast.info('Already subscribed');
    } else {
      setSubscribedCreators([...subscribedCreators, creatorId]);
      toast.success('Subscribed successfully!');
    }
  };

  const handleViewFullStream = (stream) => {
    if (onJoinStream) {
      onJoinStream(stream);
    } else {
      toast.success(`Joining ${stream.creatorName}'s full stream...`);
    }
  };

  const handleVODClick = async (vod) => {
    // Check if user has access to this VOD
    if (!user) {
      toast.error('Please sign in to watch VODs');
      return;
    }

    // Check if we already have access info cached
    if (vodAccess[vod.id]?.has_access) {
      // User has access, play the VOD
      window.open(`/vod/watch/${vod.id}`, '_blank');
      return;
    }

    // Show purchase modal
    setSelectedVOD(vod);
    setShowVODPurchase(true);
  };

  const handleVODPurchaseSuccess = (data) => {
    // Update access cache
    setVodAccess(prev => ({
      ...prev,
      [selectedVOD.id]: { has_access: true, expires_at: data.purchase.expires_at }
    }));
    
    // Optionally open VOD player
    toast.success('Opening VOD player...');
    setTimeout(() => {
      window.open(`/vod/watch/${selectedVOD.id}`, '_blank');
    }, 1000);
  };


  console.log('TVPage render state:', {
    checkingSubscription,
    hasAccess,
    loading,
    liveStreams: liveStreams.length,
    filteredStreams: filteredStreams.length
  });
  
  // Loading Skeleton Component
  const StreamSkeleton = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden animate-pulse">
      <div className="aspect-video bg-gray-300 dark:bg-gray-700"></div>
      <div className="p-4">
        <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded mb-2"></div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-16"></div>
          <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-20"></div>
        </div>
      </div>
    </div>
  );

  // Loading state with skeletons
  if (checkingSubscription) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded w-48 mb-4 animate-pulse"></div>
            <div className="h-12 bg-gray-300 dark:bg-gray-700 rounded w-full max-w-md animate-pulse"></div>
          </div>
        </div>
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(9)].map((_, i) => <StreamSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  // Show main content - subscription modal only appears when clicking a stream
  const showSubscriptionOverlay = false; // Removed automatic overlay

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 relative">
        {/* Trial/Subscription Banner - Only show for non-creators */}
      {hasAccess && isTrial && !isCreator && (
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-4 text-center">
          <p className="text-sm font-medium">
            🎉 Welcome to your 60-day FREE trial of Digis TV! 
            <span className="font-bold ml-2">
              {trialDaysRemaining > 0 ? (
                <>{trialDaysRemaining} days remaining</>
              ) : (
                <>Trial ending soon!</>
              )}
            </span>
          </p>
        </div>
      )}
      
      {/* Paid Subscription Banner */}
      {hasAccess && !isTrial && subscription && subscription.subscription_type === 'monthly' && (
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white py-2 px-4 text-center">
          <p className="text-sm font-medium">
            ✨ Premium Subscriber • Auto-renews {new Date(subscription.end_date).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Clean Header - Hidden on mobile */}
      <div className="hidden md:block bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <Container className="py-6 md:py-8">
          <div className="w-full">
            {/* Search Bar and Filters - All on one row for desktop */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Enhanced Search Bar with "Explore TV" placeholder */}
              <div className="relative flex-1 min-w-[200px] max-w-2xl" ref={searchRef}>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Search TV"
                  className="w-full h-12 pl-10 pr-3 sm:pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                />
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setShowSuggestions(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}

                {/* Search Suggestions Dropdown */}
                <AnimatePresence>
                  {showSuggestions && (searchSuggestions.length > 0 || (!searchQuery && popularSearches.length > 0)) && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50"
                    >
                      <div className="p-2">
                        {!searchQuery && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 px-3 py-1">Popular searches</p>
                        )}
                        {(searchQuery ? searchSuggestions : popularSearches.slice(0, 5)).map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setSearchQuery(suggestion);
                              setShowSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm text-gray-700 dark:text-gray-300"
                          >
                            <MagnifyingGlassIcon className="inline w-4 h-4 mr-2 text-gray-400" />
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Filter buttons - on same row for desktop */}
              {/* Category Filters Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-all flex items-center gap-2"
              >
                <AdjustmentsHorizontalIcon className="w-5 h-5" />
                {selectedCategory !== 'all' && (
                  <span className="bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 text-xs px-2 py-0.5 rounded-full">
                    1
                  </span>
                )}
              </button>

              {/* Content Type Toggle */}
              <div className="flex items-center bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl p-1">
                <button
                  onClick={() => {
                    setShowUpcoming(false);
                    setShowReplays(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    !showUpcoming && !showReplays
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Live
                </button>
                <button
                  onClick={() => {
                    setShowUpcoming(true);
                    setShowReplays(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                    showUpcoming
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <ClockIcon className="w-4 h-4" />
                  Upcoming
                </button>
                <button
                  onClick={() => {
                    setShowReplays(true);
                    setShowUpcoming(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                    showReplays
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  VODs
                </button>
              </div>
              
              {/* View Mode Toggle - Hidden on mobile */}
              <div className="hidden sm:flex items-center gap-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  title="Grid View"
                >
                  <Squares2X2Icon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  title="List View"
                >
                  <ListBulletIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('compact')}
                  className={`p-2 rounded-lg transition-all ${
                    viewMode === 'compact'
                      ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  title="Compact View"
                >
                  <ViewColumnsIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Queue Indicator */}
              {streamQueue.length > 0 && (
                <button className="relative p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <QueueListIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-xs rounded-full flex items-center justify-center font-semibold">
                    {streamQueue.length}
                  </span>
                </button>
              )}
            </div>
          </div>
        </Container>
      </div>

      {/* Content with Sidebar */}
      <Container className="py-8">
        <div className="w-full">
          <div className="flex gap-6">
            {/* Filters Sidebar */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="hidden lg:block w-64 xl:w-80 flex-shrink-0"
                >
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 sticky top-4">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <FunnelIcon className="w-5 h-5 text-purple-600" />
                      Categories
                    </h3>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {/* Category Filter */}
                  <div className="space-y-2">
                    {categories.map(category => {
                      const Icon = category.icon;
                      return (
                        <button
                          key={category.id}
                          onClick={() => setSelectedCategory(category.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                            selectedCategory === category.id
                              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                              : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="font-medium">{category.label}</span>
                          {selectedCategory === category.id && (
                            <motion.div
                              layoutId="selectedCategory"
                              className="ml-auto w-2 h-2 bg-white rounded-full"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Reset Button */}
                  {selectedCategory !== 'all' && (
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className="w-full mt-4 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Main Content Area */}
          <div className="flex-1">
            {/* Trending Now Carousel - Only show on Live view */}
            {!showUpcoming && !showReplays && trendingStreams.length > 0 && (
              <div className="mb-8">
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <ArrowTrendingUpIcon className="w-6 h-6 text-orange-500" />
                    Trending Now
                  </h2>
                </div>
                
                <div className="relative">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {trendingStreams.slice(0, 3).map((stream, index) => {
                      const CategoryIcon = VideoCameraIcon;
                      const isHovered = hoveredStream === stream.id;
                      
                      return (
                        <motion.div
                          key={stream.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileHover={{ y: -5 }}
                          onHoverStart={() => setHoveredStream(stream.id)}
                          onHoverEnd={() => setHoveredStream(null)}
                          onClick={() => handleStreamClick(stream)}
                          className="cursor-pointer group"
                        >
                          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:ring-2 hover:ring-purple-500 transition-all border border-gray-200 dark:border-gray-700">
                            {/* Thumbnail with Live Indicator */}
                            <div className="relative aspect-video bg-gradient-to-br from-purple-600 to-pink-600 overflow-hidden">
                              {stream.thumbnail ? (
                                <img 
                                  src={stream.thumbnail} 
                                  alt={stream.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <CategoryIcon className="w-16 h-16 text-white/50" />
                                </div>
                              )}
                              
                              {/* Overlay on Hover */}
                              <AnimatePresence>
                                {isHovered && (
                                  <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-gray-900/20 flex items-center justify-center"
                                  >
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="bg-white rounded-full p-4"
                                    >
                                      <PlayIcon className="w-8 h-8 text-gray-900 dark:text-white" />
                                    </motion.div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {/* Trending Badge */}
                              <div className="absolute top-2 left-2 px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 z-10">
                                <FireIcon className="w-3 h-3" />
                                #{index + 1} Trending
                              </div>

                              {/* Live Badge */}
                              <div className="absolute top-2 left-32 px-2 py-1 bg-red-600 rounded text-xs font-bold flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                                LIVE
                              </div>

                              {/* Viewers Count */}
                              <div className="absolute top-2 right-2 px-2 py-1 bg-gray-900/50 rounded text-xs flex items-center gap-1 text-white">
                                <EyeIcon className="w-3 h-3" />
                                {formatViewers(stream.viewers || viewerCounts[stream.id] || stream.viewers)}
                              </div>

                              {/* Duration */}
                              <div className="absolute bottom-2 right-2 px-2 py-1 bg-gray-900/50 rounded text-xs text-white">
                                {formatDuration(stream.duration)}
                              </div>
                              
                              {/* Quick Actions Bar - Shows on Hover */}
                              <AnimatePresence>
                                {isHovered && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="absolute bottom-2 left-2 flex items-center gap-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={(e) => handleShareStream(e, stream)}
                                      className="p-2 bg-gray-900/50 backdrop-blur-sm rounded-lg hover:bg-blue-600 transition-colors"
                                    >
                                      <ShareIcon className="w-4 h-4 text-white" />
                                    </button>
                                    <button
                                      onClick={(e) => handleAddToQueue(e, stream)}
                                      className="p-2 bg-gray-900/50 backdrop-blur-sm rounded-lg hover:bg-purple-600 transition-colors"
                                    >
                                      <QueueListIcon className="w-4 h-4 text-white" />
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Stream Info */}
                            <div className="p-4">
                              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                {stream.title}
                              </h3>
                              
                              <div className="flex items-center mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                                    <UserGroupIcon className="w-4 h-4 text-white" />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm text-gray-700 dark:text-gray-300">{stream.creatorName}</span>
                                    {stream.creatorVerified && (
                                      <CheckBadgeSolid className="w-4 h-4 text-blue-500" title="Verified Creator" />
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Progress Bar for Goals */}
                              {stream.goal && (
                                <div className="mb-3">
                                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                                    <span>{stream.goal.description}</span>
                                    <span>${stream.goal.current} / ${stream.goal.target}</span>
                                  </div>
                                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${(stream.goal.current / stream.goal.target) * 100}%` }}
                                      transition={{ duration: 1, ease: "easeOut" }}
                                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                                    />
                                  </div>
                                </div>
                              )}

                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            
            {/* Recently Watched Section */}
            {!showUpcoming && !showReplays && recentlyWatched.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <ClockIcon className="w-5 h-5 text-gray-500" />
                  Continue Watching
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {recentlyWatched.slice(0, 5).map((stream) => (
                    <button
                      key={stream.id}
                      onClick={() => handleStreamClick(stream)}
                      className="flex-shrink-0 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">{stream.creatorName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Upcoming Streams Section */}
        {showUpcoming && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            
            {upcomingStreams.length === 0 ? (
              <div className="text-center py-16">
                <ClockIcon className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No Upcoming Streams</h3>
                <p className="text-gray-500 dark:text-gray-400">Check back later for scheduled content</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {upcomingStreams.map((stream, index) => (
                  <motion.div
                    key={stream.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -5 }}
                    className="group"
                  >
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all">
                      {/* Thumbnail placeholder */}
                      <div className="relative h-48 bg-gradient-to-br from-purple-500 to-pink-500 p-6">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ClockIcon className="w-20 h-20 text-white/20" />
                        </div>
                        <div className="relative z-10">
                          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1 inline-flex items-center">
                            <ClockIcon className="w-4 h-4 text-white mr-2" />
                            <span className="text-white text-sm font-medium">
                              {new Date(stream.scheduledTime).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="mt-2 text-white text-2xl font-bold">
                            {new Date(stream.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-5">
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2 line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {stream.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 font-medium mb-3">{stream.creatorName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">{stream.description}</p>
                        
                        <div className="flex gap-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                          >
                            <BellIcon className="w-4 h-4 inline mr-1" />
                            Set Reminder
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                          >
                            <ShareIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* VODs Section */}
        {showReplays && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            
            {replays.length === 0 ? (
              <div className="text-center py-16">
                <ArrowPathIcon className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No VODs Available</h3>
                <p className="text-gray-500 dark:text-gray-400">Past streams will appear here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {replays.map((replay, index) => (
                  <motion.div
                    key={replay.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -5 }}
                    onClick={() => handleVODClick(replay)}
                    className="cursor-pointer group"
                  >
                    <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all">
                      <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900">
                        <DigisWatermark position="bottom-right" size="small" opacity={0.5} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <motion.div
                            whileHover={{ scale: 1.1 }}
                            className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center"
                          >
                            <PlayIcon className="w-8 h-8 text-white ml-1" />
                          </motion.div>
                        </div>
                        {/* Duration badge */}
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-xs text-white font-medium">
                          {replay.duration}
                        </div>
                        {/* Views overlay */}
                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-xs text-white flex items-center gap-1">
                          <EyeIcon className="w-3 h-3" />
                          {replay.views.toLocaleString()}
                        </div>
                      </div>
                      
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {replay.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 font-medium">{replay.creatorName}</p>
                        
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(replay.recordedDate).toLocaleDateString()}
                          </span>
                          <div className="flex items-center gap-1">
                            {replay.is_free ? (
                              <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">
                                Free
                              </span>
                            ) : vodAccess[replay.id]?.has_access ? (
                              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                                Owned
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded flex items-center gap-1">
                                <LockClosedIcon className="w-3 h-3" />
                                {replay.price_in_tokens || 50} tokens
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Live Streams Section - Only show if not viewing VODs or upcoming */}
        {!showReplays && !showUpcoming && (
          <div>
            {filteredStreams.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-8">
                <TvIcon className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-2">Streams Coming Soon!</h3>
                <p className="text-gray-500 dark:text-gray-400">Stay tuned for exciting live content</p>
              </div>
            ) : (
              <div className={`
                ${viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : ''}
                ${viewMode === 'list' ? 'space-y-4' : ''}
                ${viewMode === 'compact' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3' : ''}
              `}>
                {filteredStreams.map((stream) => {
              const CategoryIcon = VideoCameraIcon; // Default icon for all streams
              const isHovered = hoveredStream === stream.id;
              
              return (
                <motion.div
                  key={stream.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -5 }}
                  onHoverStart={() => setHoveredStream(stream.id)}
                  onHoverEnd={() => setHoveredStream(null)}
                  onClick={() => handleStreamClick(stream)}
                  className="cursor-pointer group"
                >
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:ring-2 hover:ring-purple-500 transition-all border border-gray-200 dark:border-gray-700">
                      {/* Thumbnail with Live Indicator */}
                      <div className="relative aspect-video bg-gradient-to-br from-purple-600 to-pink-600 overflow-hidden">
                        {stream.thumbnail ? (
                          <img 
                            src={stream.thumbnail} 
                            alt={stream.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <CategoryIcon className="w-16 h-16 text-white/50" />
                          </div>
                        )}
                        
                        {/* Overlay on Hover */}
                        <AnimatePresence>
                          {isHovered && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 bg-gray-900/20 flex items-center justify-center"
                            >
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="bg-white rounded-full p-4"
                              >
                                <PlayIcon className="w-8 h-8 text-gray-900 dark:text-white" />
                              </motion.div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Live Badge */}
                        <div className="absolute top-2 left-2 px-2 py-1 bg-red-600 rounded text-xs font-bold flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                          LIVE
                        </div>


                        {/* Viewers Count */}
                        <div className="absolute top-2 right-2 px-2 py-1 bg-gray-900/50 rounded text-xs flex items-center gap-1 text-white">
                          <EyeIcon className="w-3 h-3" />
                          {formatViewers(stream.viewers || viewerCounts[stream.id] || stream.viewers)}
                        </div>

                        {/* Duration */}
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-gray-900/50 rounded text-xs text-white">
                          {formatDuration(stream.duration)}
                        </div>
                        
                        {/* Quick Actions Bar - Shows on Hover */}
                        <AnimatePresence>
                          {isHovered && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="absolute bottom-2 left-2 flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={(e) => handleShareStream(e, stream)}
                                className="p-2 bg-gray-900/50 backdrop-blur-sm rounded-lg hover:bg-blue-600 transition-colors"
                              >
                                <ShareIcon className="w-4 h-4 text-white" />
                              </button>
                              <button
                                onClick={(e) => handleAddToQueue(e, stream)}
                                className="p-2 bg-gray-900/50 backdrop-blur-sm rounded-lg hover:bg-purple-600 transition-colors"
                              >
                                <QueueListIcon className="w-4 h-4 text-white" />
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Stream Info */}
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {stream.title}
                        </h3>
                        
                        <div className="flex items-center mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                              <UserGroupIcon className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-gray-700 dark:text-gray-300">{stream.creatorName}</span>
                              {stream.creatorVerified && (
                                <CheckBadgeSolid className="w-4 h-4 text-blue-500" title="Verified Creator" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar for Goals */}
                        {stream.goal && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                              <span>{stream.goal.description}</span>
                              <span>${stream.goal.current} / ${stream.goal.target}</span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(stream.goal.current / stream.goal.target) * 100}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                              />
                            </div>
                          </div>
                        )}

                        {/* Series Badge */}
                        {stream.series && (
                          <div className="mb-3">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">
                              Series: {stream.series}
                            </span>
                          </div>
                        )}

                      </div>
                    </div>
                </motion.div>
              );
                })}
              </div>
            )}
          </div>
        )}
          </div>
        </div>
        </div>
      </Container>

      {/* Stream Queue (Fixed Position) */}
        {streamQueue.length > 0 && (
          <motion.div
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            className="fixed right-4 top-24 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 max-h-96 overflow-y-auto z-30"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <QueueListIcon className="w-5 h-5 text-purple-600" />
                Watch Queue ({streamQueue.length})
              </h3>
              <button 
                onClick={() => setStreamQueue([])}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Clear
              </button>
            </div>
            <div className="space-y-2">
              {streamQueue.map((stream, index) => (
                <div key={stream.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{index + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">{stream.title}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{stream.creatorName}</p>
                  </div>
                  <button
                    onClick={() => setStreamQueue(streamQueue.filter(s => s.id !== stream.id))}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

      {/* Floating Action Button for Going Live (for creators) */}
      {user?.isCreator && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            if (onGoLive) {
              onGoLive();
            } else {
              // toast.success('Opening stream setup...');
            }
          }}
          className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-2xl flex items-center justify-center group"
        >
          <VideoCameraIcon className="w-8 h-8 text-white" />
          <div className="absolute -top-12 right-0 px-3 py-2 bg-gray-800 rounded-lg text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
            Start Your Stream
          </div>
        </motion.button>
      )}


      {/* Stream Preview Modal */}
      <StreamPreviewModal
        isOpen={showStreamPreview}
        onClose={() => {
          setShowStreamPreview(false);
          setPreviewStream(null);
        }}
        stream={previewStream}
        user={user}
        onFollow={handleFollowCreator}
        onSubscribe={handleSubscribeCreator}
        onViewFullStream={handleViewFullStream}
        onLike={(streamId) => {
          const isLiked = likedStreams.includes(streamId);
          if (isLiked) {
            setLikedStreams(likedStreams.filter(id => id !== streamId));
          } else {
            setLikedStreams([...likedStreams, streamId]);
          }
        }}
        isFollowing={previewStream && followedCreators.includes(previewStream.creatorId)}
        isSubscribed={previewStream && subscribedCreators.includes(previewStream.creatorId)}
        isLiked={previewStream && likedStreams.includes(previewStream.id)}
      />

      {/* Full Subscription Modal */}
      <TVSubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        isTrialAvailable={isTrialAvailable}
        tokenBalance={tokenBalance || 0}
        onStartTrial={handleStartTrial}
        onSubscribe={handleSubscribe}
        onTokenPurchase={onTokenPurchase}
        trialExpired={trialExpired}
        user={user}
      />

      {/* VOD Purchase Modal */}
      <VODPurchaseModal
        isOpen={showVODPurchase}
        onClose={() => {
          setShowVODPurchase(false);
          setSelectedVOD(null);
        }}
        recording={selectedVOD}
        tokenBalance={tokenBalance || 0}
        onPurchaseSuccess={handleVODPurchaseSuccess}
        onTokenPurchase={onTokenPurchase}
      />
    </div>
  );
}

export default TVPage;