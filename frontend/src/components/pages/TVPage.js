import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../utils/supabase-auth';
import {
  PlayIcon,
  UserGroupIcon,
  SparklesIcon,
  FireIcon,
  HeartIcon,
  EyeIcon,
  ChatBubbleLeftRightIcon,
  SignalIcon,
  ClockIcon,
  GiftIcon,
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
  XMarkIcon
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartSolid,
  StarIcon as StarSolid
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import TVSubscriptionModal from '../TVSubscriptionModal';

const TVPage = ({ user, onJoinStream, onGoLive, tokenBalance, onTokenPurchase }) => {
  const [liveStreams, setLiveStreams] = useState([]);
  const [filteredStreams, setFilteredStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredStream, setHoveredStream] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [isTrialAvailable, setIsTrialAvailable] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(!!user);
  
  // New states for enhanced features
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [showReplays, setShowReplays] = useState(false);
  const [streamQueue, setStreamQueue] = useState([]);
  const [likedStreams, setLikedStreams] = useState([]);
  const [showTheaterMode, setShowTheaterMode] = useState(false);
  const [theaterStream, setTheaterStream] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Categories configuration
  const categories = [
    { id: 'all', label: 'All', icon: SparklesIcon },
    { id: 'gaming', label: 'Gaming', icon: VideoCameraIcon },
    { id: 'music', label: 'Music', icon: MusicalNoteIcon },
    { id: 'cooking', label: 'Cooking', icon: BeakerIcon },
    { id: 'fitness', label: 'Fitness', icon: FireIcon },
    { id: 'art', label: 'Art', icon: PaintBrushIcon },
    { id: 'education', label: 'Education', icon: AcademicCapIcon },
    { id: 'talk', label: 'Talk Shows', icon: MicrophoneIcon },
    { id: 'business', label: 'Business', icon: ChartBarIcon }
  ];

  // Force white background for this page
  useEffect(() => {
    // Store original background
    const originalBodyBg = document.body.style.backgroundColor;
    const originalHtmlBg = document.documentElement.style.backgroundColor;
    
    // Force white background
    document.body.style.backgroundColor = 'white';
    document.documentElement.style.backgroundColor = 'white';
    
    // Add class to override dark mode
    document.body.classList.add('tv-page-white-bg');
    
    // Create and inject CSS override
    const style = document.createElement('style');
    style.textContent = `
      body.tv-page-white-bg {
        background-color: white !important;
      }
      .tv-page-white-bg .bg-gray-900,
      .tv-page-white-bg .dark\\:bg-gray-900 {
        background-color: white !important;
      }
    `;
    document.head.appendChild(style);
    
    // Cleanup on unmount
    return () => {
      document.body.style.backgroundColor = originalBodyBg;
      document.documentElement.style.backgroundColor = originalHtmlBg;
      document.body.classList.remove('tv-page-white-bg');
      document.head.removeChild(style);
    };
  }, []);

  // Mock data for live streams
  const mockLiveStreams = [
    {
      id: 1,
      creatorId: 'creator1',
      creatorName: 'Alex Gaming',
      creatorAvatar: null,
      title: '🎮 Epic Fortnite Tournament - Road to Victory!',
      category: 'gaming',
      thumbnail: null,
      viewers: 1234,
      duration: '2:45:30',
      tags: ['gaming', 'fortnite', 'tournament'],
      isLive: true,
      isFree: true,
      likes: 892,
      tips: 45,
      streamStarted: new Date(Date.now() - 2.75 * 60 * 60 * 1000),
      language: 'English',
      goal: { current: 4500, target: 5000, description: 'New Gaming Setup' },
      series: 'Tournament Tuesdays'
    },
    {
      id: 2,
      creatorId: 'creator2',
      creatorName: 'Maya Music',
      creatorAvatar: null,
      title: '🎵 Acoustic Guitar Session - Chill Vibes Only',
      category: 'music',
      thumbnail: null,
      viewers: 856,
      duration: '1:15:20',
      tags: ['music', 'guitar', 'acoustic', 'chill'],
      isLive: true,
      isFree: true,
      likes: 623,
      tips: 32,
      streamStarted: new Date(Date.now() - 1.25 * 60 * 60 * 1000)
    },
    {
      id: 3,
      creatorId: 'creator3',
      creatorName: 'Chef Roberto',
      creatorAvatar: null,
      title: '🍳 Italian Pasta Masterclass - From Scratch!',
      category: 'cooking',
      thumbnail: null,
      viewers: 742,
      duration: '0:45:15',
      tags: ['cooking', 'italian', 'pasta', 'tutorial'],
      isLive: true,
      isFree: true,
      likes: 412,
      tips: 28,
      streamStarted: new Date(Date.now() - 0.75 * 60 * 60 * 1000)
    },
    {
      id: 4,
      creatorId: 'creator4',
      creatorName: 'FitLife Emma',
      creatorAvatar: null,
      title: '💪 Morning HIIT Workout - Burn & Build',
      category: 'fitness',
      thumbnail: null,
      viewers: 567,
      duration: '0:30:45',
      tags: ['fitness', 'workout', 'hiit', 'morning'],
      isLive: true,
      isFree: true,
      likes: 334,
      tips: 19,
      streamStarted: new Date(Date.now() - 0.5 * 60 * 60 * 1000)
    },
    {
      id: 5,
      creatorId: 'creator5',
      creatorName: 'Art with Sophie',
      creatorAvatar: null,
      title: '🎨 Digital Art Tutorial - Character Design',
      category: 'art',
      thumbnail: null,
      viewers: 423,
      duration: '1:30:00',
      tags: ['art', 'digital', 'tutorial', 'design'],
      isLive: true,
      isFree: true,
      likes: 289,
      tips: 15,
      streamStarted: new Date(Date.now() - 1.5 * 60 * 60 * 1000)
    },
    {
      id: 6,
      creatorId: 'creator6',
      creatorName: 'Professor Tech',
      creatorAvatar: null,
      title: '📚 JavaScript Fundamentals - Live Coding Session',
      category: 'education',
      thumbnail: null,
      viewers: 892,
      duration: '2:00:00',
      tags: ['coding', 'javascript', 'programming', 'tutorial'],
      isLive: true,
      isFree: true,
      likes: 567,
      tips: 42,
      streamStarted: new Date(Date.now() - 2 * 60 * 60 * 1000)
    },
    {
      id: 7,
      creatorId: 'creator7',
      creatorName: 'Sarah Talks',
      creatorAvatar: null,
      title: '☕ Morning Coffee Chat - Life Updates & Q&A',
      category: 'talk',
      thumbnail: null,
      viewers: 234,
      duration: '0:20:30',
      tags: ['chat', 'lifestyle', 'qa', 'morning'],
      isLive: true,
      isFree: true,
      likes: 156,
      tips: 8,
      streamStarted: new Date(Date.now() - 0.34 * 60 * 60 * 1000)
    },
    {
      id: 8,
      creatorId: 'creator8',
      creatorName: 'Business Boss',
      creatorAvatar: null,
      title: '💼 Startup Strategies - Scale Your Business',
      category: 'business',
      thumbnail: null,
      viewers: 345,
      duration: '1:45:00',
      tags: ['business', 'startup', 'entrepreneur', 'strategy'],
      isLive: true,
      isFree: true,
      likes: 223,
      tips: 25,
      streamStarted: new Date(Date.now() - 1.75 * 60 * 60 * 1000)
    }
  ];

  // Add upcoming streams mock data
  const mockUpcomingStreams = [
    {
      id: 101,
      creatorId: 'creator1',
      creatorName: 'Alex Gaming',
      title: '🎮 24 Hour Gaming Marathon',
      category: 'gaming',
      scheduledTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
      description: 'Join me for an epic 24-hour gaming marathon featuring multiple games!',
      language: 'English'
    },
    {
      id: 102,
      creatorId: 'creator2',
      creatorName: 'Maya Music',
      title: '🎵 Friday Night Jazz Session',
      category: 'music',
      scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      description: 'Relaxing jazz covers and originals',
      language: 'English'
    },
    {
      id: 103,
      creatorId: 'creator3',
      creatorName: 'Chef Roberto',
      title: '🍕 Pizza Making Masterclass',
      category: 'cooking',
      scheduledTime: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
      description: 'Learn to make authentic Italian pizza from scratch',
      language: 'English'
    },
    {
      id: 104,
      creatorId: 'creator4',
      creatorName: 'FitLife Emma',
      title: '💪 Sunday Morning Yoga Flow',
      category: 'fitness',
      scheduledTime: new Date(Date.now() + 48 * 60 * 60 * 1000), // 2 days from now
      description: 'Start your day with energizing yoga',
      language: 'English'
    },
    {
      id: 105,
      creatorId: 'creator5',
      creatorName: 'Art with Sophie',
      title: '🎨 Watercolor Landscapes',
      category: 'art',
      scheduledTime: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
      description: 'Paint beautiful landscapes with watercolors',
      language: 'English'
    },
    {
      id: 106,
      creatorId: 'creator6',
      creatorName: 'Professor Tech',
      title: '🚀 Build a Web App in 2 Hours',
      category: 'education',
      scheduledTime: new Date(Date.now() + 72 * 60 * 60 * 1000), // 3 days from now
      description: 'Complete web application tutorial',
      language: 'English'
    }
  ];

  // Add replay/VOD mock data
  const mockReplays = [
    {
      id: 201,
      creatorId: 'creator3',
      creatorName: 'Chef Roberto',
      title: '🍳 Italian Cooking Masterclass',
      category: 'cooking',
      recordedDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      duration: '1:45:00',
      views: 3456,
      likes: 892,
      language: 'English'
    },
    {
      id: 202,
      creatorId: 'creator1',
      creatorName: 'Alex Gaming',
      title: '🎮 Speedrun World Record Attempt',
      category: 'gaming',
      recordedDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
      duration: '3:22:45',
      views: 12543,
      likes: 2341,
      language: 'English'
    },
    {
      id: 203,
      creatorId: 'creator2',
      creatorName: 'Maya Music',
      title: '🎸 Rock Classics Cover Session',
      category: 'music',
      recordedDate: new Date(Date.now() - 72 * 60 * 60 * 1000),
      duration: '2:15:30',
      views: 8765,
      likes: 1654,
      language: 'English'
    },
    {
      id: 204,
      creatorId: 'creator4',
      creatorName: 'FitLife Emma',
      title: '🔥 30-Day Fitness Challenge Finale',
      category: 'fitness',
      recordedDate: new Date(Date.now() - 96 * 60 * 60 * 1000),
      duration: '1:30:00',
      views: 5432,
      likes: 987,
      language: 'English'
    },
    {
      id: 205,
      creatorId: 'creator5',
      creatorName: 'Art with Sophie',
      title: '✨ Digital Art Tips & Tricks',
      category: 'art',
      recordedDate: new Date(Date.now() - 120 * 60 * 60 * 1000),
      duration: '2:00:15',
      views: 4321,
      likes: 765,
      language: 'English'
    },
    {
      id: 206,
      creatorId: 'creator6',
      creatorName: 'Professor Tech',
      title: '📱 React Native App Development',
      category: 'education',
      recordedDate: new Date(Date.now() - 144 * 60 * 60 * 1000),
      duration: '4:15:00',
      views: 9876,
      likes: 2134,
      language: 'English'
    },
    {
      id: 207,
      creatorId: 'creator7',
      creatorName: 'Sarah Talks',
      title: '💫 Life Coaching Q&A Session',
      category: 'talk',
      recordedDate: new Date(Date.now() - 168 * 60 * 60 * 1000),
      duration: '1:45:30',
      views: 2345,
      likes: 456,
      language: 'English'
    },
    {
      id: 208,
      creatorId: 'creator8',
      creatorName: 'Business Boss',
      title: '💰 Investment Strategies 2024',
      category: 'business',
      recordedDate: new Date(Date.now() - 192 * 60 * 60 * 1000),
      duration: '2:30:00',
      views: 6789,
      likes: 1234,
      language: 'English'
    }
  ];

  // Update all mock streams to include language
  mockLiveStreams.forEach((stream, index) => {
    if (!stream.language) {
      stream.language = ['English', 'Spanish', 'French', 'Japanese', 'Korean'][index % 5];
    }
    if (!stream.goal && index % 3 === 0) {
      stream.goal = {
        current: Math.floor(Math.random() * 8000),
        target: 10000,
        description: ['New Equipment', 'Charity Stream', 'Community Goal'][index % 3]
      };
    }
    if (!stream.series && index % 2 === 0) {
      stream.series = ['Weekly Series', 'Daily Show', 'Special Event'][index % 3];
    }
  });

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
  }, [liveStreams, selectedCategory, searchQuery]);

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
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tv-subscription/status`, {
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
        
        if (!data.hasAccess) {
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
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tv-subscription/start-trial`, {
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
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tv-subscription/subscribe`, {
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

  const fetchLiveStreams = async () => {
    try {
      setLoading(true);
      // In production, fetch from API
      // const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/streams/live/free`);
      // const data = await response.json();
      
      // Using mock data for now
      setLiveStreams(mockLiveStreams);
    } catch (error) {
      console.error('Error fetching live streams:', error);
      toast.error('Failed to load live streams');
    } finally {
      setLoading(false);
    }
  };


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
    
    // In production, this would navigate to the stream or open in modal
    if (onJoinStream) {
      onJoinStream(stream);
    } else {
      // toast.success(`Joining ${stream.creatorName}'s stream...`);
      // In the app's navigation system, this would trigger a view change
      // For now, we'll just show the toast
    }
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

  const toggleTheaterMode = (stream) => {
    setShowTheaterMode(true);
    setTheaterStream(stream);
  };


  console.log('TVPage render state:', {
    checkingSubscription,
    hasAccess,
    loading,
    liveStreams: liveStreams.length,
    filteredStreams: filteredStreams.length
  });

  // Loading state
  if (checkingSubscription) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl text-gray-800">Checking subscription status...</p>
        </div>
      </div>
    );
  }

  // Show main content - subscription modal only appears when clicking a stream
  const showSubscriptionOverlay = false; // Removed automatic overlay

  return (
    <div className="min-h-screen bg-white relative">
        {/* Subscription Banner */}
      {subscription && subscription.subscription_type === 'trial' && (
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white py-2 px-4 text-center">
          <p className="text-sm font-medium">
            🎉 You&apos;re on a free trial! {subscription.trial_days_remaining || 0} days remaining
          </p>
        </div>
      )}

      {/* Header - Matching Explore Creators Style */}
      <div className="relative bg-gradient-to-r from-purple-600 via-purple-600 to-pink-600 text-white overflow-hidden">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col gap-6">
            {/* Title */}
            <div>
              <motion.h1 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-5xl font-bold flex items-center gap-3 mb-3"
              >
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                  <TvIcon className="w-10 h-10" />
                </motion.div>
                Digis TV
                <motion.div 
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex items-center gap-2 px-3 py-1 bg-red-600/20 backdrop-blur-sm border border-red-400/30 rounded-full"
                >
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">LIVE</span>
                </motion.div>
              </motion.h1>
            </div>
            
            {/* Search Bar and Filters - Responsive layout */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Search Bar - Matching Explore style */}
              <motion.div 
                className="relative w-full max-w-md md:w-96"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/70" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search streams, creators, tags..."
                  className="w-full pl-12 pr-4 py-3 bg-white/15 backdrop-blur-md border-2 border-white/20 rounded-2xl text-white placeholder-white/70 focus:ring-4 focus:ring-white/30 focus:border-white/40 focus:bg-white/20 transition-all shadow-lg"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </motion.div>

              {/* Category Filters Button */}
              <motion.button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-3 bg-white/15 backdrop-blur-md border-2 border-white/20 rounded-2xl text-white font-medium focus:ring-4 focus:ring-white/30 hover:bg-white/20 transition-all shadow-lg flex items-center gap-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <AdjustmentsHorizontalIcon className="w-5 h-5" />
                Categories
                {selectedCategory !== 'all' && (
                  <span className="bg-white/30 text-xs px-2 py-0.5 rounded-full">
                    1
                  </span>
                )}
              </motion.button>

              {/* View Mode Toggle */}
              <motion.div
                className="flex items-center bg-white/15 backdrop-blur-md border-2 border-white/20 rounded-2xl p-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <button
                  onClick={() => {
                    setShowUpcoming(false);
                    setShowReplays(false);
                  }}
                  className={`px-3 py-2 rounded-xl transition-all ${
                    !showUpcoming && !showReplays 
                      ? 'bg-white/30 text-white' 
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Live
                </button>
                <button
                  onClick={() => {
                    setShowUpcoming(true);
                    setShowReplays(false);
                  }}
                  className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1 ${
                    showUpcoming 
                      ? 'bg-white/30 text-white' 
                      : 'text-white/70 hover:text-white'
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
                  className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1 ${
                    showReplays 
                      ? 'bg-white/30 text-white' 
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  Replays
                </button>
              </motion.div>

              {/* Queue Indicator */}
              {streamQueue.length > 0 && (
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative p-2.5 bg-white/15 backdrop-blur-md border-2 border-white/20 rounded-2xl transition-colors hover:bg-white/20"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <QueueListIcon className="w-5 h-5 text-white" />
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-xs rounded-full flex items-center justify-center font-semibold"
                  >
                    {streamQueue.length}
                  </motion.span>
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content with Sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-6">
          {/* Filters Sidebar */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-80 flex-shrink-0"
              >
                <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-4">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <FunnelIcon className="w-5 h-5 text-purple-600" />
                      Categories
                    </h3>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="text-gray-400 hover:text-gray-600"
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
                              : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
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
                      className="w-full mt-4 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
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
            {/* Upcoming Streams Section */}
        {showUpcoming && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-gray-900 mb-2">Upcoming Streams</h2>
              <p className="text-gray-600">Don't miss out on these scheduled live events</p>
            </div>
            
            {mockUpcomingStreams.length === 0 ? (
              <div className="text-center py-16">
                <ClockIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Upcoming Streams</h3>
                <p className="text-gray-500">Check back later for scheduled content</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockUpcomingStreams.map((stream, index) => (
                  <motion.div
                    key={stream.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -5 }}
                    className="group"
                  >
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl transition-all">
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
                        <h3 className="font-bold text-gray-900 text-lg mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                          {stream.title}
                        </h3>
                        <p className="text-gray-600 font-medium mb-3">{stream.creatorName}</p>
                        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{stream.description}</p>
                        
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
                            <ShareIcon className="w-5 h-5 text-gray-600" />
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

        {/* Replays/VOD Section */}
        {showReplays && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-gray-900 mb-2">Stream Replays</h2>
              <p className="text-gray-600">Catch up on streams you missed</p>
            </div>
            
            {mockReplays.length === 0 ? (
              <div className="text-center py-16">
                <ArrowPathIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Replays Available</h3>
                <p className="text-gray-500">Past streams will appear here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {mockReplays.map((replay, index) => (
                  <motion.div
                    key={replay.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -5 }}
                    onClick={() => {
                      if (!hasAccess) {
                        setShowSubscriptionModal(true);
                      } else {
                        // toast.success(`Playing ${replay.title}`);
                      }
                    }}
                    className="cursor-pointer group"
                  >
                    <div className="bg-white rounded-xl overflow-hidden border border-gray-200 hover:shadow-xl transition-all">
                      <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <motion.div
                            whileHover={{ scale: 1.1 }}
                            className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center"
                          >
                            <PlayIcon className="w-8 h-8 text-white ml-1" />
                          </motion.div>
                        </div>
                        {/* Duration badge */}
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-xs text-white font-medium">
                          {replay.duration}
                        </div>
                        {/* Views overlay */}
                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-xs text-white flex items-center gap-1">
                          <EyeIcon className="w-3 h-3" />
                          {replay.views.toLocaleString()}
                        </div>
                      </div>
                      
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-purple-600 transition-colors">
                          {replay.title}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1 font-medium">{replay.creatorName}</p>
                        
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-gray-500">
                            {new Date(replay.recordedDate).toLocaleDateString()}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <HeartIcon className="w-3 h-3" />
                            {replay.likes}
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

        {/* Live Streams Section - Only show if not viewing replays or upcoming */}
        {!showReplays && !showUpcoming && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <SignalIcon className="w-6 h-6 text-red-600" />
              Live Now
            </h2>
            {filteredStreams.length === 0 ? (
              <div className="text-center py-16">
                <TvIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Live Streams</h3>
                <p className="text-gray-500">Check back later for live content</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  onDoubleClick={() => toggleTheaterMode(stream)}
                  className="cursor-pointer group"
                >
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:ring-2 hover:ring-purple-500 transition-all border border-gray-200">
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
                                <PlayIcon className="w-8 h-8 text-gray-900" />
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
                          {formatViewers(stream.viewers)}
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
                                onClick={(e) => handleLikeStream(e, stream.id)}
                                className={`p-2 ${likedStreams.includes(stream.id) ? 'bg-red-600' : 'bg-gray-900/50'} backdrop-blur-sm rounded-lg hover:bg-red-600 transition-colors`}
                              >
                                <HeartIcon className="w-4 h-4 text-white" />
                              </button>
                              <button
                                onClick={(e) => handleTipStream(e, stream)}
                                className="p-2 bg-gray-900/50 backdrop-blur-sm rounded-lg hover:bg-green-600 transition-colors"
                              >
                                <GiftIcon className="w-4 h-4 text-white" />
                              </button>
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
                        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                          {stream.title}
                        </h3>
                        
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                              <UserGroupIcon className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm text-gray-700">{stream.creatorName}</span>
                          </div>
                          <div className="px-2 py-1 rounded text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                            {stream.category}
                          </div>
                        </div>

                        {/* Progress Bar for Goals */}
                        {stream.goal && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
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

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <HeartIcon className="w-3 h-3" />
                            {stream.likes}
                          </div>
                          <div className="flex items-center gap-1">
                            <GiftIcon className="w-3 h-3" />
                            {stream.tips} tips
                          </div>
                          <div className="flex items-center gap-1">
                            <ChatBubbleLeftRightIcon className="w-3 h-3" />
                            Live chat
                          </div>
                        </div>
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
        
      {/* Stream Queue (Fixed Position) */}
        {streamQueue.length > 0 && (
          <motion.div
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            className="fixed right-4 top-24 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-h-96 overflow-y-auto z-30"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <QueueListIcon className="w-5 h-5 text-purple-600" />
                Watch Queue ({streamQueue.length})
              </h3>
              <button 
                onClick={() => setStreamQueue([])}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
            <div className="space-y-2">
              {streamQueue.map((stream, index) => (
                <div key={stream.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                  <span className="text-xs text-gray-500">{index + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">{stream.title}</p>
                    <p className="text-xs text-gray-600">{stream.creatorName}</p>
                  </div>
                  <button
                    onClick={() => setStreamQueue(streamQueue.filter(s => s.id !== stream.id))}
                    className="text-gray-400 hover:text-gray-600"
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


      {/* Theater Mode Modal */}
      <AnimatePresence>
        {showTheaterMode && theaterStream && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-8"
            onClick={() => {
              setShowTheaterMode(false);
              setTheaterStream(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-xl overflow-hidden max-w-6xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative aspect-video bg-gradient-to-br from-purple-600 to-pink-600">
                <div className="absolute inset-0 flex items-center justify-center">
                  <PlayIcon className="w-24 h-24 text-white/50" />
                </div>
                <button
                  onClick={() => {
                    setShowTheaterMode(false);
                    setTheaterStream(null);
                  }}
                  className="absolute top-4 right-4 p-2 bg-gray-900/50 rounded-lg hover:bg-gray-900/70 transition-colors"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{theaterStream.title}</h2>
                <p className="text-gray-600">{theaterStream.creatorName}</p>
                <div className="flex items-center gap-6 mt-4">
                  <button 
                    onClick={() => handleStreamClick(theaterStream)}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Join Stream
                  </button>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <EyeIcon className="w-4 h-4" />
                      {formatViewers(theaterStream.viewers)} viewers
                    </span>
                    <span className="flex items-center gap-1">
                      <ClockIcon className="w-4 h-4" />
                      {formatDuration(theaterStream.duration)}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Subscription Modal */}
      <TVSubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        isTrialAvailable={isTrialAvailable}
        tokenBalance={tokenBalance || 0}
        onStartTrial={handleStartTrial}
        onSubscribe={handleSubscribe}
        onTokenPurchase={onTokenPurchase}
      />
    </div>
  );
}

export default TVPage;