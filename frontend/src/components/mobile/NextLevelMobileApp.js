import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HomeIcon, 
  VideoCameraIcon, 
  ChatBubbleLeftRightIcon, 
  WalletIcon,
  UserCircleIcon,
  SparklesIcon,
  BellIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  CameraIcon,
  MicrophoneIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';
import { 
  HomeIcon as HomeIconSolid,
  VideoCameraIcon as VideoCameraIconSolid,
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid,
  WalletIcon as WalletIconSolid,
  UserCircleIcon as UserCircleIconSolid
} from '@heroicons/react/24/solid';

// Import existing components
import EnhancedCreatorCard from '../EnhancedCreatorCard';
import MobileOptimizedAuth from './MobileOptimizedAuth';
import MobileProfile from './MobileProfile';
import MobileMessages from './MobileMessages';
import MobileOnboarding from './MobileOnboarding';
import MobileCreatorDashboard from './MobileCreatorDashboard';
import Wallet from '../Wallet';
// Lazy load heavy components for better performance
const MobileVideoStream = lazy(() => import('./MobileVideoStream'));
const GoLiveSetup = lazy(() => import('../GoLiveSetup'));
const TokenPurchase = lazy(() => import('../TokenPurchase'));
const LiveChat = lazy(() => import('../LiveChat'));

// Import styles
import '../../styles/next-level-mobile.css';
import '../../styles/mobile-nav-override.css';

const NextLevelMobileApp = ({ user, logout }) => {
  // Check if user is a creator - memoized for performance
  const isCreator = useMemo(() => {
    return Boolean(
      user && (
        user.is_creator === true ||
        user.role === 'creator' ||
        user.role === 'admin' ||
        user.creator_type ||
        user.is_super_admin === true
      )
    );
  }, [user]);
  
  console.log('🚀 NextLevelMobileApp Debug:', {
    user,
    isCreator,
    user_is_creator: user?.is_creator,
    user_role: user?.role,
    user_creator_type: user?.creator_type,
    user_is_super_admin: user?.is_super_admin,
    defaultTab: isCreator ? 'dashboard' : 'home'
  });
  
  // Default to dashboard for creators, home for fans - using initializer function
  const [activeTab, setActiveTab] = useState(() => isCreator ? 'dashboard' : 'home');
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [creators, setCreators] = useState([]);
  const [isNavHidden, setIsNavHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const tickingRef = useRef(false);
  const mountedRef = useRef(true);
  const creatorsAbortRef = useRef(null);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showGoLiveSetup, setShowGoLiveSetup] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('digis_onboarding_completed');
  });
  
  const scrollContainerRef = useRef(null);
  const pullDistance = useRef(0);
  const startY = useRef(0);

  // Spring animations - temporarily disabled
  // const fabRotation = useSpring(0);
  // const fabScale = useSpring(1);
  // const pullToRefreshY = useSpring(-100);

  // Auto-hide navigation on scroll with optimized performance
  useEffect(() => {
    const handleScroll = () => {
      if (!tickingRef.current && mountedRef.current) {
        tickingRef.current = true;
        requestAnimationFrame(() => {
          if (!mountedRef.current) return;
          const currentScrollY = window.scrollY;
          if (currentScrollY > lastScrollYRef.current && currentScrollY > 100) {
            setIsNavHidden(true);
          } else {
            setIsNavHidden(false);
          }
          lastScrollYRef.current = currentScrollY;
          tickingRef.current = false;
        });
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Pull to refresh functionality
  const handleTouchStart = (e) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (window.scrollY === 0 && startY.current) {
      const currentY = e.touches[0].clientY;
      pullDistance.current = Math.max(0, currentY - startY.current);
      
      if (pullDistance.current > 0) {
        // pullToRefreshY.set(Math.min(pullDistance.current / 2, 80));
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance.current > 80) {
      setRefreshing(true);
      await refreshContent();
      setRefreshing(false);
    }
    
    pullDistance.current = 0;
    startY.current = 0;
    // pullToRefreshY.set(-100);
  };

  const refreshContent = async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    await fetchCreators();
  };

  // Fetch creators with abort controller for cleanup
  const fetchCreators = useCallback(async () => {
    try {
      // Cancel any in-flight request
      if (creatorsAbortRef.current) {
        creatorsAbortRef.current.abort();
      }
      
      const controller = new AbortController();
      creatorsAbortRef.current = controller;
      
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/creators`,
        { signal: controller.signal }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (mountedRef.current) {
        setCreators(data);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching creators:', error);
      }
    }
  }, []);

  // Fetch creators on mount with cleanup
  useEffect(() => {
    mountedRef.current = true;
    fetchCreators();
    
    return () => {
      mountedRef.current = false;
      if (creatorsAbortRef.current) {
        creatorsAbortRef.current.abort();
      }
    };
  }, [fetchCreators]);

  // Toggle FAB menu
  const toggleFabMenu = () => {
    setShowFabMenu(!showFabMenu);
    // fabRotation.set(showFabMenu ? 0 : 45);
    // fabScale.set(showFabMenu ? 1 : 0.9);
  };

  // Haptic feedback (using Vibration API)
  const hapticFeedback = (type = 'light') => {
    if ('vibrate' in navigator) {
      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(20);
          break;
        case 'heavy':
          navigator.vibrate(30);
          break;
        default:
          navigator.vibrate(10);
      }
    }
  };

  // Handle tab change
  const handleTabChange = (tab) => {
    hapticFeedback('light');
    setActiveTab(tab);
  };

  // Handle creator selection
  const handleCreatorSelect = (creator) => {
    hapticFeedback('medium');
    setSelectedCreator(creator);
    setShowVideoCall(true);
  };

  // Handle Go Live
  const handleGoLive = async (config) => {
    console.log('Going live with config:', config);
    setShowGoLiveSetup(false);
    // TODO: Implement actual streaming logic
    // For now, just show a success message
    alert('You are now live! 🎉');
  };

  // Handle Go Live button click
  const handleShowGoLive = () => {
    hapticFeedback('medium');
    setShowGoLiveSetup(true);
    setShowFabMenu(false);
  };

  // Navigation items - memoized for performance
  const navItems = useMemo(() => isCreator ? [
    { id: 'dashboard', label: 'Dashboard', icon: HomeIcon, iconSolid: HomeIconSolid },
    { id: 'messages', label: 'Messages', icon: ChatBubbleLeftRightIcon, iconSolid: ChatBubbleLeftRightIconSolid },
    { id: 'wallet', label: 'Earnings', icon: WalletIcon, iconSolid: WalletIconSolid },
    { id: 'discover', label: 'Discover', icon: MagnifyingGlassIcon, iconSolid: MagnifyingGlassIcon },
    { id: 'profile', label: 'Profile', icon: UserCircleIcon, iconSolid: UserCircleIconSolid }
  ] : [
    { id: 'home', label: 'Home', icon: HomeIcon, iconSolid: HomeIconSolid },
    { id: 'discover', label: 'Discover', icon: MagnifyingGlassIcon, iconSolid: MagnifyingGlassIcon },
    { id: 'messages', label: 'Messages', icon: ChatBubbleLeftRightIcon, iconSolid: ChatBubbleLeftRightIconSolid },
    { id: 'wallet', label: 'Wallet', icon: WalletIcon, iconSolid: WalletIconSolid },
    { id: 'profile', label: 'Profile', icon: UserCircleIcon, iconSolid: UserCircleIconSolid }
  ], [isCreator]);

  // Render content based on active tab
  const renderContent = () => {
    console.log('🎨 Rendering content for tab:', activeTab, 'isCreator:', isCreator);
    switch (activeTab) {
      case 'home':
        return (
          <div className="mobile-safe-area">
            {/* Hero Section */}
            <div className="mobile-glass-card p-6 mb-6">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                Welcome back!
              </h1>
              <p className="text-gray-600">Connect with your favorite creators</p>
            </div>

            {/* Live Now Section */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4 px-4">🔴 Live Now</h2>
              <div className="overflow-x-auto px-4 -mx-4">
                <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
                  {creators.filter(c => c.is_live).map((creator) => (
                    <motion.div
                      key={creator.id}
                      whileTap={{ scale: 0.95 }}
                      className="mobile-creator-card-next"
                      style={{ width: '280px' }}
                      onClick={() => handleCreatorSelect(creator)}
                    >
                      <div className="mobile-card-image-container">
                        <img 
                          src={creator.profile_pic_url || '/api/placeholder/400/300'} 
                          alt={creator.username}
                          className="mobile-card-image"
                        />
                        <div className="mobile-card-live-badge">
                          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                          LIVE
                        </div>
                      </div>
                      <div className="mobile-card-content">
                        <div className="mobile-card-header">
                          <img 
                            src={creator.profile_pic_url || '/api/placeholder/100/100'} 
                            alt={creator.username}
                            className="mobile-card-avatar"
                          />
                          <div className="mobile-card-info">
                            <h3 className="mobile-card-name">{creator.username}</h3>
                            <div className="mobile-card-status">
                              <span className="mobile-status-dot"></span>
                              {creator.viewer_count || 0} watching
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">{creator.bio}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Featured Creators */}
            <div className="px-4">
              <h2 className="text-xl font-semibold mb-4">Featured Creators</h2>
              <div className="space-y-4">
                {creators.filter(c => !c.is_live).slice(0, 5).map((creator) => (
                  <motion.div
                    key={creator.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleCreatorSelect(creator)}
                  >
                    <EnhancedCreatorCard creator={creator} />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'discover':
        return (
          <div className="mobile-safe-area">
            <div className="px-4">
              <h1 className="text-2xl font-bold mb-6">Discover</h1>
              
              {/* Search Bar */}
              <div className="relative mb-6">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search creators..."
                  className="mobile-input-next pl-12"
                />
              </div>

              {/* Categories */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {['Gaming', 'Music', 'Art', 'Fitness', 'Comedy', 'Education'].map((category) => (
                  <motion.button
                    key={category}
                    whileTap={{ scale: 0.95 }}
                    className="mobile-glass-card p-4 text-center"
                    onClick={() => hapticFeedback('light')}
                  >
                    <SparklesIcon className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                    <span className="font-medium">{category}</span>
                  </motion.button>
                ))}
              </div>

              {/* All Creators Grid */}
              <div className="grid grid-cols-2 gap-4">
                {creators.map((creator) => (
                  <motion.div
                    key={creator.id}
                    whileTap={{ scale: 0.95 }}
                    className="mobile-glass-card p-4"
                    onClick={() => handleCreatorSelect(creator)}
                  >
                    <img 
                      src={creator.profile_pic_url || '/api/placeholder/150/150'} 
                      alt={creator.username}
                      className="w-full aspect-square object-cover rounded-lg mb-3"
                    />
                    <h3 className="font-semibold truncate">{creator.username}</h3>
                    <p className="text-sm text-gray-600">${creator.price_per_min}/min</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'messages':
        return <MobileMessages user={user} />;

      case 'wallet':
        return (
          <div className="mobile-safe-area">
            <Wallet user={user} />
            {!user?.creator_profile && (
              <div className="px-4 mt-6">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="mobile-button-next"
                  onClick={() => hapticFeedback('medium')}
                >
                  Buy More Tokens
                </motion.button>
              </div>
            )}
          </div>
        );

      case 'dashboard':
        console.log('📱 Dashboard case hit, isCreator:', isCreator);
        // Show creator dashboard for creators
        if (isCreator) {
          console.log('✅ Rendering MobileCreatorDashboard');
          return (
            <div className="w-full min-h-screen bg-gray-50">
              <div className="p-4">
                <h1 className="text-2xl font-bold text-purple-600 mb-4">Creator Dashboard</h1>
                <p className="text-gray-600 mb-4">Welcome back, {user?.username || user?.email}!</p>
                <div className="bg-white rounded-lg p-4 shadow-md mb-4">
                  <p className="text-sm text-gray-500">Debug Info:</p>
                  <p className="text-xs">is_creator: {String(user?.is_creator)}</p>
                  <p className="text-xs">role: {user?.role}</p>
                  <p className="text-xs">email: {user?.email}</p>
                </div>
              </div>
              <MobileCreatorDashboard 
                user={user}
                tokenBalance={user?.token_balance || 0}
                onNavigate={(tab) => setActiveTab(tab)}
                onShowGoLive={() => setShowGoLiveSetup(true)}
                onShowAvailability={() => setActiveTab('profile')}
                onShowEarnings={() => setActiveTab('wallet')}
                onShowSettings={() => setActiveTab('profile')}
                onShowContent={() => setActiveTab('profile')}
                onShowMessages={() => setActiveTab('messages')}
              />
            </div>
          );
        }
        // Fall through to profile for non-creators
        console.log('❌ Not a creator, showing profile instead');
        return <MobileProfile user={user} isCreator={false} logout={logout} />;
        
      case 'profile':
        return <MobileProfile user={user} isCreator={isCreator} logout={logout} />;

      default:
        return null;
    }
  };

  if (!user) {
    return <MobileOptimizedAuth />;
  }

  if (showOnboarding) {
    return (
      <MobileOnboarding 
        onComplete={() => {
          localStorage.setItem('digis_onboarding_completed', 'true');
          setShowOnboarding(false);
        }}
      />
    );
  }

  return (
    <div 
      className="min-h-screen bg-gray-50"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to Refresh Indicator */}
      <motion.div 
        className={`mobile-pull-to-refresh ${refreshing ? 'visible refreshing' : ''}`}
        // style={{ y: pullToRefreshY }}
      >
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </motion.div>

      {/* Main Content */}
      <div ref={scrollContainerRef} className="pb-20">
        {renderContent()}
      </div>

      {/* Floating Action Button */}
      <div className="mobile-fab-container">
        <AnimatePresence>
          {showFabMenu && (
            <motion.div 
              className="mobile-fab-menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.button
                className="mobile-fab-menu-item haptic-light bg-gradient-to-r from-red-500 to-pink-500"
                onClick={handleShowGoLive}
                whileTap={{ scale: 0.9 }}
              >
                <SparklesIcon className="w-6 h-6 text-white" />
              </motion.button>
              <motion.button
                className="mobile-fab-menu-item haptic-light"
                onClick={() => {
                  hapticFeedback('light');
                  console.log('Take photo');
                }}
                whileTap={{ scale: 0.9 }}
              >
                <CameraIcon className="w-6 h-6 text-purple-600" />
              </motion.button>
              <motion.button
                className="mobile-fab-menu-item haptic-light"
                onClick={() => {
                  hapticFeedback('light');
                  console.log('Create post');
                }}
                whileTap={{ scale: 0.9 }}
              >
                <PhotoIcon className="w-6 h-6 text-purple-600" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
        
        <motion.button
          className={`mobile-fab haptic-medium ${showFabMenu ? 'expanded' : ''}`}
          onClick={toggleFabMenu}
          // style={{ rotate: fabRotation, scale: fabScale }}
          whileTap={{ scale: 0.9 }}
        >
          <motion.div
            animate={{ rotate: showFabMenu ? 45 : 0 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <PlusIcon className="w-6 h-6 text-white" />
          </motion.div>
        </motion.button>
      </div>

      {/* Bottom Navigation */}
      <nav className={`mobile-nav-next ${isNavHidden ? 'hidden' : ''}`}>
        {navItems.map((item) => {
          const Icon = activeTab === item.id ? item.iconSolid : item.icon;
          return (
            <button
              key={item.id}
              className={`mobile-nav-item haptic-light ${activeTab === item.id ? 'active' : ''}`}
              aria-label={item.label}
              role="tab"
              aria-current={activeTab === item.id ? 'page' : undefined}
              aria-selected={activeTab === item.id}
              onClick={() => handleTabChange(item.id)}
            >
              <Icon className="mobile-nav-icon" />
              <span className="mobile-nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Video Call Modal */}
      <AnimatePresence>
        {showVideoCall && selectedCreator && (
          <motion.div
            className="mobile-video-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Suspense fallback={
              <div className="mobile-modal-fallback flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent mx-auto mb-4" />
                  <p className="text-gray-600">Loading video stream...</p>
                </div>
              </div>
            }>
              <MobileVideoStream
                creator={selectedCreator}
                user={user}
                token="temp-token" // TODO: Generate from backend
                channel={`video_${selectedCreator.id}_${Date.now()}`}
                onEnd={() => {
                  setShowVideoCall(false);
                  setSelectedCreator(null);
                }}
              />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Go Live Setup Modal */}
      <AnimatePresence>
        {showGoLiveSetup && (
          <Suspense fallback={
            <div className="mobile-modal-fallback flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent mx-auto mb-4" />
                <p className="text-gray-600">Preparing stream setup...</p>
              </div>
            </div>
          }>
            <GoLiveSetup
              user={user}
              onGoLive={handleGoLive}
              onCancel={() => setShowGoLiveSetup(false)}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Notifications */}
      <AnimatePresence>
        {notifications.length > 0 && (
          <motion.div
            className="mobile-toast visible"
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
          >
            <BellIcon className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium">{notifications[0]}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NextLevelMobileApp;