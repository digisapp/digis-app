import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense, startTransition } from 'react';
import { createPortal } from 'react-dom';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './utils/supabase-auth.js';
import { subscribeToAuthChanges, clearAuthCache } from './utils/auth-helpers.js';
import { verifyUserRole, syncUserRole, clearRoleCache, ROLES } from './utils/roleVerification.js';
import EnhancedToaster, { customToast } from './components/ui/EnhancedToaster';
import toast from 'react-hot-toast';
import LiveStreamNotification from './components/LiveStreamNotification';
import { useMediaQuery } from './hooks/useMediaQuery';
import { BREAKPOINTS } from './constants/breakpoints';
// Core components (loaded immediately for auth flow)
import Auth from './components/Auth';
import HomePage from './components/HomePage';
import Skeleton from './components/ui/Skeleton';

// Lazy load heavy components for better performance
const VideoCall = lazy(() => import('./components/VideoCall'));
const EnhancedSchedule = lazy(() => import('./components/EnhancedSchedule'));
const FanEngagement = lazy(() => import('./components/FanEngagement'));
const StreamingLayout = lazy(() => import('./components/StreamingLayout'));
const StreamingDashboard = lazy(() => import('./components/StreamingDashboard'));
const EnhancedCreatorDiscovery = lazy(() => import('./components/EnhancedCreatorDiscovery'));

// Lazy load profile and settings pages
const ImprovedProfile = lazy(() => import('./components/ImprovedProfile'));
const PrivacySettings = lazy(() => import('./components/PrivacySettings'));
const Settings = lazy(() => import('./components/Settings'));

// Lazy load creator features
const CreatorPublicProfileEnhanced = lazy(() => import('./components/CreatorPublicProfileEnhanced'));
const PublicCreatorShop = lazy(() => import('./components/PublicCreatorShop'));
const CreatorApplication = lazy(() => import('./components/CreatorApplication'));
const CreatorKYCVerification = lazy(() => import('./components/CreatorKYCVerification'));
const PendingCreatorBanner = lazy(() => import('./components/PendingCreatorBanner'));

// Lazy load streaming components
const StreamingLoadingSkeleton = lazy(() => import('./components/StreamingLoadingSkeleton'));
const GoLiveSetup = lazy(() => import('./components/GoLiveSetup'));
const MobileGoLive = lazy(() => import('./components/mobile/MobileGoLive'));

// Lazy load interaction components
const TipModal = lazy(() => import('./components/TipModal'));
const FollowingSystem = lazy(() => import('./components/FollowingSystem'));
const WalletPage = lazy(() => import('./components/pages/WalletPage'));
const EnhancedAdminDashboard = lazy(() => import('./components/EnhancedAdminDashboard'));
import InstantChatWidget from './components/InstantChatWidget';
const DashboardRouter = lazy(() => import('./components/pages/DashboardRouter')); // Smart router for role-based dashboards
const ClassesPage = lazy(() => import('./components/pages/ClassesPage'));
const MessagesPage = lazy(() => import('./components/pages/MessagesPage'));
const ShopPage = lazy(() => import('./components/pages/ShopPage'));
const ShopManagementPage = lazy(() => import('./components/pages/ShopManagementPage'));
import { Navigation, NavigationProvider } from './components/navigation';
import PullToRefresh from './components/ui/PullToRefresh';
// REMOVED: NextLevelMobileApp, MobileErrorBoundary, MobileLoadingScreen - now using unified navigation system
// Lazy load rarely accessed pages and components
// REMOVED: const MobileApp = lazy(() => import('./components/mobile/MobileApp')); - using newer navigation system
const TermsOfService = lazy(() => import('./components/pages/TermsOfService'));
const PrivacyPolicy = lazy(() => import('./components/pages/PrivacyPolicy'));
const EnhancedNotificationBell = lazy(() => import('./components/EnhancedNotificationBell'));
const FileUpload = lazy(() => import('./components/FileUpload'));
const PictureInPicture = lazy(() => import('./components/PictureInPicture'));

// Keep essential UI components eager
import ErrorBoundary from './components/ui/ErrorBoundary';
import ErrorPage from './components/ErrorPage';
import ProtectedRoute from './components/ProtectedRoute';
import HydrationGate from './components/HydrationGate';

// Mobile components - lazy load for better initial bundle size
import { MobileUIProvider } from './components/mobile/MobileUIProvider';
// REMOVED: Old mobile component imports - now loaded via AppRoutes
// FloatingActionButton, MobileBottomSheet removed - not used in new navigation
// Mobile page components (MobileMessages, MobileCreatorDashboard, etc.) are now imported in AppRoutes.jsx
const MobileCreatorProfile = lazy(() => import('./components/mobile/MobileCreatorProfile'));
const MobileLandingPage = lazy(() => import('./components/mobile/MobileLandingPage'));
// Lazy load additional features and pages
const RecentlyViewedCreators = lazy(() => import('./components/RecentlyViewedCreators'));
const ImprovedTokenPurchase = lazy(() => import('./components/ImprovedTokenPurchase'));
const RealTimeNotifications = lazy(() => import('./components/RealTimeNotifications'));
const IncomingCallNotification = lazy(() => import('./components/IncomingCallNotification'));
const IncomingCallModal = lazy(() => import('./components/IncomingCallModal'));
const ExplorePage = lazy(() => import('./components/pages/ExplorePage'));
const TVPage = lazy(() => import('./components/pages/TVPage'));
const CallRequestsPage = lazy(() => import('./components/pages/CallRequestsPage'));
const CollectionsPage = lazy(() => import('./components/pages/CollectionsPage'));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));
const SchedulePage = lazy(() => import('./components/pages/SchedulePage'));
const FollowersSubscribersPage = lazy(() => import('./components/pages/FollowersSubscribersPage'));
const SupabaseTestPage = lazy(() => import('./components/SupabaseTestPage'));
const FanProfilePage = lazy(() => import('./components/pages/FanProfilePage'));

// Keep utility imports eager
import recentlyViewedService from './utils/recentlyViewedService';
import serviceWorkerManager from './utils/ServiceWorkerManager';
import agoraLoader from './utils/AgoraLoader';
// socketService is now managed by SocketContext
import { useNotifications } from './hooks/useSocket';
// Import hybrid store
import useHybridStore, { useCurrentView, useNavigationActions } from './stores/useHybridStore';
import useAuthStore from './stores/useAuthStore';
import { shallow } from 'zustand/shallow';
import { loadProfileCache, saveProfileCache, clearProfileCache } from './utils/profileCache';

// Import new context hooks
import { useAuth } from './contexts/AuthContext';
import { useDevice } from './contexts/DeviceContext';
import { useModal, MODALS } from './contexts/ModalContext';
import { useSocket } from './contexts/SocketContext';
import Modals from './components/modals/Modals';

// Import gradual route migration utilities
import AppRoutes from './routes/AppRoutes';
import useViewRouter from './routes/useViewRouter';
import { defaultPathFor } from './utils/routeHelpers';

// Import analytics bridge
import AuthAnalyticsBridge from './components/AuthAnalyticsBridge';

// Import call navigator
import CallNavigator from './components/CallNavigator';

// Import preloading utilities
import { preloadOnIdle } from './lib/preload';

// Import auth constants
import { LOGOUT_DEST } from './constants/auth';

// Import Sentry utilities
import { logLogoutOnce, resetLogoutBreadcrumb } from './utils/sentry';

// Constants
const FETCH_THROTTLE_MS = 5000; // 5 seconds between fetches

const App = () => {
  // Build stamp for tracking deployed version
  useEffect(() => {
    window.__DIGIS_BUILD__ = { commit: "b4b32aa", at: new Date().toISOString() };
    console.info("[DIGIS] build", window.__DIGIS_BUILD__);
  }, []);

  // Reset logout breadcrumb on app mount (handles browser restarts)
  useEffect(() => {
    resetLogoutBreadcrumb();
  }, []);

  // Get location for other uses
  const location = useLocation();
  const navigate = useNavigate();

  // Mount adapter hook to sync currentView ↔ URL (Phase 2: Gradual Route Migration)
  useViewRouter();

  // Device detection - now from DeviceContext (centralized)
  const { isMobile, isTablet, isMobilePortrait, isMobileLandscape, orientation } = useDevice();

  // Modal management - now from ModalContext (centralized)
  const { open: openModal, close: closeModal, isOpen: isModalOpen } = useModal();

  // Socket management - now from SocketContext (centralized)
  const {
    connected: websocketConnected,
    incomingCall: socketIncomingCall,
    clearIncomingCall,
    respondToCall: socketRespondToCall
  } = useSocket();

  // Authentication - now from AuthContext (centralized)
  const {
    user,
    profile,
    tokenBalance,
    authLoading,
    isCreator: authIsCreator,
    isAdmin: authIsAdmin,
    isAuthenticated,
    roleResolved,
    signOut: authSignOut,
    refreshProfile,
    fetchTokenBalance: authFetchTokenBalance,
    updateTokenBalance: authUpdateTokenBalance,
    setUser: authSetUser,
    setProfile: authSetProfile,
    setAuthLoading: authSetAuthLoading,
    error: authError  // Extract error from AuthContext
  } = useAuth();

  // SAFETY: Hard timeout to prevent infinite loading screen
  useEffect(() => {
    const MAX_LOADING_TIME = 30000; // 30 seconds max
    const timeoutId = setTimeout(() => {
      if (authLoading) {
        console.error('🚨 HARD TIMEOUT: Auth loading took >30s, forcing load complete');
        authSetAuthLoading(false);
      }
    }, MAX_LOADING_TIME);

    return () => clearTimeout(timeoutId);
  }, [authLoading, authSetAuthLoading]);

  // Still need notifications and some state from hybrid store
  const notifications = useHybridStore((state)=> state.notifications, shallow);

  // Get navigation state and actions from store BEFORE using them
  const currentView = useCurrentView();

  // Create a stable setCurrentView function using useCallback
  const setCurrentView = useCallback((view) => {
    useHybridStore.getState().setCurrentView(view);
  }, []);

  // Track last view with a ref to avoid re-render loops
  const lastViewRef = useRef(currentView);

  // Use AuthContext as SINGLE SOURCE OF TRUTH for creator/admin status
  const isCreator = authIsCreator;
  const isAdmin = authIsAdmin;

  // NO localStorage writes for roles - AuthContext is single source of truth
  // Role state is automatically managed by AuthContext

  // NOTE: URL ↔ view syncing now handled by useViewRouter adapter hook

  // Debug creator status for both mobile and desktop
  // CRITICAL: Only run in development to avoid production re-render loops
  useEffect(() => {
    // Skip in production to prevent excessive re-renders
    if (import.meta.env.MODE === 'production') return;

    // Skip if user is not logged in to prevent logging after logout
    if (!user) return;

    const deviceType = isMobile ? '📱 Mobile' : '🖥️ Desktop';
    console.log(`${deviceType} State Check:`, {
      user: user?.email,
      profile: profile?.email,
      isCreator,
      isAdmin,
      roleResolved,
      profile_is_creator: profile?.is_creator,
      profile_role: profile?.role
    });
  }, [isMobile, user, profile, isCreator, isAdmin, roleResolved]);
  
  // Get actions separately using store's getState to avoid subscriptions
  const store = useHybridStore;
  const setUser = useCallback((user) => store.getState().setUser(user), []);
  const setProfile = useCallback((profile) => store.getState().setProfile(profile), []);
  const updateTokenBalance = authUpdateTokenBalance; // Use auth context method
  const logout = useCallback(() => store.getState().logout(), []);
  const addNotification = useCallback((notif) => store.getState().addNotification(notif), []);
  const removeNotification = useCallback((id) => store.getState().removeNotification(id), []);
  const setActiveChannel = useCallback((channel) => store.getState().setActiveChannel(channel), []);
  const startStream = useCallback((stream) => store.getState().startStream(stream), []);
  const endStream = useCallback(() => store.getState().endStream(), []);

  // authLoading is now from AuthContext (no local state needed)
  const [channel, setChannel] = useState('');

  // View initialization is handled by AppRoutes based on AuthContext role
  // NO localStorage reads - AuthContext is single source of truth

  const [error, setError] = useState('');
  const [callType, setCallType] = useState('video');
  const [currentCreator, setCurrentCreator] = useState(null);

  // Public/Auth state
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [viewingCreator, setViewingCreator] = useState(null);
  
  // Debug showAuth changes
  useEffect(() => {
    // Skip in production to prevent excessive re-renders
    if (import.meta.env.MODE === 'production') return;
    console.log('🔴 showAuth changed to:', showAuth);
  }, [showAuth]);

  // Token balance is now managed in AuthContext
  // Note: Request throttling refs removed - handled in AuthContext

  // Notification state (kept separate from modal management)
  const [showStreamNotification, setShowStreamNotification] = useState(false);
  const [streamNotificationConfig, setStreamNotificationConfig] = useState(null);

  // Note: All modal states (token purchase, creator discovery, privacy settings,
  // creator application, go live setup, token tipping, availability calendar,
  // fan engagement) are now managed by ModalContext via useModal hook
  
  const [tippingRecipient, setTippingRecipient] = useState(null);
  const [token, setToken] = useState('');
  const [sessionUid] = useState('');
  const [chatToken] = useState('');
  const [sessionStats] = useState({
    totalSessions: 0,
    totalEarnings: 0,
    activeUsers: 0
  });
  const [streamConfig, setStreamConfig] = useState(null);
  
  // Shared content state for syncing between Content Studio and Gallery
  const [sharedContentData, setSharedContentData] = useState({
    photos: [],
    videos: [],
    audios: [],
    streams: [],
    posts: []
  });

  // Real-time state (from NewApp.js) - incomingCall now from SocketContext
  // websocketConnected is now from SocketContext
  // Keep local incomingCall for compatibility with existing code
  const [incomingCall, setIncomingCall] = useState(null);

  // Sync socket incoming call to local state for compatibility
  useEffect(() => {
    if (socketIncomingCall) {
      setIncomingCall(socketIncomingCall);
    }
  }, [socketIncomingCall]);

  const modalRef = useRef(null);
  
  // No view mode switching - admins are always admins
  const effectiveIsCreator = isCreator;
  const effectiveIsAdmin = isAdmin;

  // Note: fetchUserProfile and fetchTokenBalance are now handled by AuthContext
  // Use refreshProfile() from useAuth() hook to manually refresh profile
  // Use authFetchTokenBalance() from useAuth() hook to manually refresh balance
  const fetchTokenBalance = authFetchTokenBalance; // Alias for compatibility
  const fetchUserProfile = refreshProfile; // Alias for compatibility

  // Note: Focus management for modals is now handled in ModalContext

  // Note: Authentication initialization is now handled by AuthContext
  // The initAuth useEffect has been removed (~400 lines) - see AuthContext.jsx for auth logic
  
  // Force fetch profile on mobile if we have user but no profile or wrong creator status
  // DISABLED to prevent infinite loop on mobile homepage
  // Profile is already fetched during login in MobileLandingPage
  // useEffect(() => {
  //   if (isMobile && user) {
  //     // Always fetch profile on mobile when user changes or on mount
  //     if (!profile || !profile.id) {
  //       console.log('📱 Mobile: Fetching profile for user:', user?.email);
  //       fetchUserProfile(user);
  //     } else {
  //       // Check if we need to refresh based on mismatch
  //       const storedCreatorStatus = localStorage.getItem('userIsCreator') === 'true';
  //       const profileCreatorStatus = profile?.is_creator === true;
  //
  //       if (storedCreatorStatus !== profileCreatorStatus) {
  //         console.log('📱 Mobile creator status mismatch, refetching:', {
  //           stored: storedCreatorStatus,
  //           profile: profileCreatorStatus,
  //           userEmail: user?.email
  //         });
  //         fetchUserProfile(user);
  //       }
  //     }
  //   }
  // }, [isMobile, user?.id]); // Only depend on user.id to prevent loops

  // NOTE: Initial view redirects now handled by AppRoutes (see / route logic)

  // Ensure mobile creators see dashboard
  useEffect(() => {
    if (isMobile && user && profile) {
      // Removed automatic redirect - allow all users to access explore page
      // const isMobileCreator = profile?.is_creator === true || 
      //                        profile?.role === 'creator' || 
      //                        profile?.role === 'admin' ||
      //                        isCreator;
      // 
      // if (isMobileCreator && currentView === 'explore') {
      //   console.log('📱 Mobile creator detected - switching to dashboard view');
      //   setCurrentView('dashboard');
      // }
    }
  }, [isMobile, user, profile, isCreator, currentView]);

  // Service initialization (from NewApp.js)
  useEffect(() => {
    // Only initialize services when user is logged in
    if (!user) return;

    const initializeServices = async () => {

      // Initialize optional services with individual error handling
      try {
        // Initialize service worker for PWA capabilities
        // Temporarily disabled service worker to fix API request issues
        // if (serviceWorkerManager && typeof serviceWorkerManager.register === 'function') {
        //   await serviceWorkerManager.register();
        // }
      } catch (error) {
        console.log('Service worker registration skipped:', error.message);
      }

      try {
        // Preload Agora SDK for better video call performance
        if (agoraLoader && typeof agoraLoader.preloadSDK === 'function') {
          await agoraLoader.preloadSDK();
        }
      } catch (error) {
        console.log('Agora SDK preload skipped:', error.message);
      }
    };

    initializeServices();
  }, [user]);

  // Preload hot routes on idle for authenticated users
  useEffect(() => {
    if (user) {
      preloadOnIdle(() => Promise.all([
        import('./components/pages/MessagesPage'),
        import('./components/pages/DashboardRouter'),
        import('./components/pages/WalletPage'),
      ]));
    }
  }, [user]);

  // Note: Socket.io connection is now handled by SocketContext
  // See src/contexts/SocketContext.jsx for socket logic
  // Available via useSocket() hook: { connected, incomingCall, clearIncomingCall, respondToCall }

  // Note: Real-time balance updates are now handled by SocketContext
  // Balance updates are automatically reflected via AuthContext's updateTokenBalance

  // Real-time notifications
  useNotifications((notification) => {
    // Handle different notification types
    switch (notification.type) {
      case 'incoming_call':
        setIncomingCall(notification.data);
        break;
      case 'stream_started':
        // toast.success(`${notification.creatorName} just went live!`, {
        //   duration: 5000,
        //   icon: '🔴'
        // });
        break;
      case 'new_message':
        if (!window.location.pathname.includes('/messages')) {
          toast(notification.message, {
            duration: 4000,
            icon: '💬'
          });
        }
        break;
      default:
        // Generic notification
        toast(notification.message || 'New notification', {
          duration: 4000
        });
    }
  });

  // Handle tipping
  const handleTipCreator = useCallback((creator) => {
    openModal(MODALS.TOKEN_TIPPING, {
      creator,
      onTipSent: () => {
        fetchTokenBalance();
      }
    });
  }, [openModal, fetchTokenBalance]);

  // Unified Go Live handler - calls backend to create stream
  const openGoLive = useCallback(() => {
    console.log('🎬 Opening Go Live setup');
    console.log('📱 isMobile value:', isMobile);

    // Handler that calls backend API to start stream
    const handleGoLive = async (config) => {
      try {
        console.log('🔴 Calling backend to start stream with config:', config);

        // Get auth token
        const { supabase } = await import('./utils/supabase-auth');
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
          toast.error('Please sign in to go live');
          return;
        }

        // Call unified backend endpoint
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/streaming/go-live`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify(config)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to start stream');
        }

        const data = await response.json();
        console.log('✅ Stream created successfully:', data);

        // Store stream data for streaming view
        setStreamConfig({
          ...config,
          streamData: data.stream,
          agoraData: data.agora
        });

        // Navigate to streaming view
        setCurrentView('streaming');
        toast.success('Going live! 🎉');

      } catch (error) {
        console.error('❌ Failed to go live:', error);
        toast.error(error.message || 'Failed to start stream. Please try again.');
      }
    };

    if (isMobile) {
      console.log('📱 Mobile detected - opening mobile live stream modal');
      openModal(MODALS.MOBILE_LIVE_STREAM, {
        onGoLive: handleGoLive
      });
    } else {
      console.log('🖥️ Desktop detected - opening desktop go live setup modal');
      openModal(MODALS.GO_LIVE_SETUP, {
        onGoLive: handleGoLive
      });
    }
  }, [isMobile, openModal, setStreamConfig, setCurrentView]);

  // Handle video call
  const handleStartVideoCall = (creator) => {
    console.log('App.js handleStartVideoCall called with creator:', creator?.username);
    // Store creator info if needed for the call
    if (creator) {
      sessionStorage.setItem('callCreator', JSON.stringify(creator));
      setCurrentCreator(creator);
    }
    // Set the call type and show video call view
    setCallType('video');
    setCurrentView('videoCall');
    console.log('View changed to videoCall');
  };

  // Handle voice call
  const handleStartVoiceCall = (creator) => {
    console.log('App.js handleStartVoiceCall called with creator:', creator?.username);
    // Store creator info if needed for the call
    if (creator) {
      sessionStorage.setItem('callCreator', JSON.stringify(creator));
      setCurrentCreator(creator);
    }
    // Set the call type and show voice call view
    setCallType('voice');
    setCurrentView('voiceCall');
    console.log('View changed to voiceCall');
  };
  
  // Aliases for ExplorePage compatibility
  const startVideoCall = handleStartVideoCall;
  const startVoiceCall = handleStartVoiceCall;
  
  // Handle purchase
  const handlePurchase = useCallback((amount) => {
    openModal(isMobile ? MODALS.MOBILE_TOKEN_PURCHASE : MODALS.TOKEN_PURCHASE, {
      onSuccess: (tokensAdded) => {
        updateTokenBalance(tokensAdded);
      },
      onPurchaseSuccess: (tokensAdded) => {
        updateTokenBalance(tokensAdded);
        toast.success(`✅ ${tokensAdded} tokens added to your account!`);
      }
    });
  }, [isMobile, openModal, updateTokenBalance]);
  
  // Handle call creator
  const handleCallCreator = (creator) => {
    handleStartVideoCall(creator);
  };
  
  // Handle make offer
  const onMakeOffer = (creator) => {
    // TODO: Implement offer modal
    toast.info('Make Offer feature coming soon!');
  };

  // Clear error
  const clearError = () => setError('');

  // Navigation helper that uses React Router
  const navigateToView = (view) => {
    const viewToPath = {
      'dashboard': '/dashboard',
      'explore': '/explore',
      'profile': '/profile',
      'wallet': '/wallet',
      'messages': '/messages',
      'classes': '/classes',
      'tv': '/tv',
      'call-requests': '/call-requests',
      'streaming': '/streaming',
      'subscriptions': '/subscriptions',
      'following': '/following',
      'schedule': '/schedule',
      'videoCall': '/call/video',
      'voiceCall': '/call/voice',
      'admin': '/admin',
      'creator-studio': '/creator-studio',
      'content': '/content',
      'offers': '/offers'
    };

    const path = viewToPath[view] || '/';
    startTransition(() => {
      navigate(path);
    });
  };

  // Debug currentView changes
  useEffect(() => {
    // Skip in production to prevent excessive re-renders
    if (import.meta.env.MODE === 'production') return;
    console.log('currentView changed to:', currentView);
  }, [currentView]);

  // Removed the problematic URL sync effect to prevent infinite redirects

  // Removed the second URL sync effect to prevent infinite redirects

  // Handle sign out
  const handleSignOut = async () => {
    try {
      console.log('🔓 handleSignOut: Starting logout process...');

      // Log to Sentry for observability (dedupe guard prevents double-logging on rage-clicks)
      logLogoutOnce({
        user: user?.email,
        timestamp: new Date().toISOString()
      });

      // Use AuthContext signOut for clean logout
      const success = await authSignOut();

      if (success) {
        // Clear Zustand store
        logout();

        // NO localStorage clears needed - AuthContext handles all cleanup

        // Safety net: reset view state to prevent stale view rehydration
        setCurrentView('explore');

        // Navigate to public destination (no flickering, prevents back-button loops)
        console.log('✅ handleSignOut: Navigating to', LOGOUT_DEST);
        navigate(LOGOUT_DEST, { replace: true });

        toast.success('Successfully signed out');
      } else {
        throw new Error('Sign out failed');
      }
    } catch (error) {
      console.error('❌ Sign out error:', error);
      toast.error('Failed to sign out');

      // Force logout on error - use navigate instead of window.location
      clearProfileCache();
      logout();

      // NO localStorage clears needed - AuthContext handles all cleanup

      // Safety net: reset view state even on error
      setCurrentView('explore');

      navigate(LOGOUT_DEST, { replace: true });
    }
  };

  // Handle auth - Navigate to auth page with mode parameter
  const handleSignIn = () => {
    console.log('🔵 handleSignIn called - navigating to /auth?mode=signin');
    navigate('/auth?mode=signin');
  };

  const handleSignUp = () => {
    console.log('🔵 handleSignUp called - navigating to /auth?mode=signup');
    navigate('/auth?mode=signup');
  };

  const handleBackToLanding = () => {
    setViewingCreator(null);
  };

  const handleCreatorClick = (username) => {
    setViewingCreator(username);
  };

  const handleJoinPrivateSession = () => {
    setShowAuth(true);
  };

  // Auth state - For desktop only. Mobile users see MobileLandingPage directly.
  if (showAuth && !user && !isMobile) {
    console.log('🟢 Rendering desktop auth form');
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
        <div className="w-full h-full flex items-center justify-center">
          <div className="relative w-full max-w-screen-sm px-4">
            <Auth
              mode={authMode}
              onLogin={async (user) => {
                console.log('🖥️ Desktop Auth onLogin called with user:', user);
                console.log('🖥️ Desktop auth data received:', {
                  hasProfile: !!user.profile,
                  is_creator: user.is_creator,
                  role: user.role,
                  creator_type: user.creator_type,
                  email: user.email
                });

                // Reset logout breadcrumb flag on login (allows logging logout again later)
                resetLogoutBreadcrumb();

                // CRITICAL: Always define profileData first to avoid block-scope bugs
                let profileData = user.profile || user;

                // CRITICAL: Set profile FIRST, before setting user, to prevent role flip-flopping
                if (user.profile || user.is_creator !== undefined || user.role) {
                  console.log('🖥️ Desktop: Setting profile BEFORE user to prevent flip-flop:', {
                    is_creator: profileData.is_creator,
                    role: profileData.role,
                    creator_type: profileData.creator_type
                  });

                  // Set profile first (this updates isCreator in the store immediately)
                  setProfile(profileData);

                  // CRITICAL: Also update AuthContext to stop loading state
                  authSetProfile(profileData);

                  // Verify the store was updated
                  const storeState = useHybridStore.getState();
                  console.log('🖥️ Desktop: Store immediately after setProfile:', {
                    isCreator: storeState.isCreator,
                    isAdmin: storeState.isAdmin,
                    roleVerified: storeState.roleVerified
                  });
                }

                // Now set user (this triggers the app to render)
                setUser(user);

                // CRITICAL: Also update AuthContext to stop loading state
                authSetUser({
                  id: user.id,
                  email: user.email
                });

                // Wait for state to propagate (next tick)
                await new Promise(resolve => setTimeout(resolve, 0));

                // Close auth modal
                setShowAuth(false);

                // Let AuthContext resolve the role, then AppRoutes will handle navigation
                // DO NOT navigate here - prevents fan flash when user is actually a creator
                console.log('🖥️ Desktop: Auth complete, waiting for roleResolved before navigation');

                // Navigate to root and let AppRoutes redirect based on resolved role
                startTransition(() => {
                  navigate('/');
                });
              }}
              onModeSwitch={(mode) => setAuthMode(mode)}
              onBack={() => {
                console.log('🖥️ Auth onBack called');
                setShowAuth(false);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Loading state with modern skeleton - check AFTER auth modal
  if (authLoading) {
    // Mobile loading state - gradient background with logo
    if (isMobile) {
      return (
        <div className="min-h-screen flex flex-col items-center" style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          paddingTop: 'env(safe-area-inset-top, 20px)'
        }}>
          <div className="flex-1 flex items-start justify-center pt-8">
            <img
              src="/digis-logo-white.png"
              alt="Digis"
              className="w-32 h-32 object-contain"
            />
          </div>
        </div>
      );
    }
    
    // Desktop loading state with gradient
    return (
      <div className="min-h-screen bg-gradient-miami">
        <Skeleton.Navigation />
        <div className="container mx-auto py-8">
          <Skeleton.Grid items={6} columns={3} />
        </div>
      </div>
    );
  }

  // Handle creator profiles - accessible to both logged in and logged out users
  if (viewingCreator) {
    if (isMobile) {
      return (
        <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div></div>}>
        <MobileUIProvider>
          <MobileCreatorProfile
            creatorId={viewingCreator}
            creator={{ username: viewingCreator }}
            user={user}
            onBack={() => setViewingCreator(null)}
            onStartCall={(type) => {
              console.log('Starting call:', type);
              // Handle call start
            }}
            onSendMessage={() => {
              navigate('/messages');
              setViewingCreator(null);
            }}
            onSubscribe={(tier) => {
              console.log('Subscribe to tier:', tier);
              // Handle subscription
            }}
            onFollow={(following) => {
              console.log('Follow status:', following);
              // Handle follow
            }}
            onJoinStream={(streamData) => {
              console.log('Joining stream:', streamData);
              startTransition(() => {
                setCurrentView('streaming');
                setViewingCreator(null);
              });
              // You can pass stream data to the streaming view
              // setStreamingData(streamData);
            }}
          />
        </MobileUIProvider>
        </Suspense>
      );
    } else {
      return (
        <CreatorPublicProfileEnhanced
          user={user}
          username={viewingCreator}
          onAuthRequired={handleSignIn}
          onClose={() => setViewingCreator(null)}
        />
      );
    }
  }

  // Public routing - show HomePage or Auth based on route
  if (!user) {
    console.log('🏠 Showing public homepage - no user authenticated, showAuth:', showAuth, 'isMobile:', isMobile);

    // Check if this is a username route (for public creator profiles)
    const pathname = location.pathname;
    const isUsernameRoute = pathname !== '/' &&
                           pathname !== '/auth' &&
                           pathname !== '/explore' &&
                           pathname !== '/terms' &&
                           pathname !== '/privacy' &&
                           !pathname.startsWith('/creator/') &&
                           !pathname.includes('/shop');

    console.log('🔍 Checking route:', { pathname, isUsernameRoute, match: pathname.match(/^\/[^\/]+$/) });

    // If this is a username route, show the creator profile (mobile or desktop)
    if (isUsernameRoute && pathname.match(/^\/[^\/]+$/)) {
      const username = pathname.substring(1); // Remove leading slash
      console.log('👤 Detected username route:', username);

      if (isMobile) {
        return (
          <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div></div>}>
          <MobileUIProvider>
            <MobileCreatorProfile
              creatorId={username}
              creator={{ username: username }}
              user={user}
              onBack={() => navigate('/')}
              onStartCall={(type) => {
                console.log('Starting call:', type);
                setShowAuth(true);
              }}
              onSendMessage={() => {
                setShowAuth(true);
              }}
              onSubscribe={(tier) => {
                console.log('Subscribe to tier:', tier);
                setShowAuth(true);
              }}
              onFollow={(following) => {
                console.log('Follow status:', following);
                setShowAuth(true);
              }}
              onJoinStream={(streamData) => {
                console.log('Joining stream:', streamData);
                setShowAuth(true);
              }}
            />
          </MobileUIProvider>
          </Suspense>
        );
      }
      // Desktop will use the Routes below
    }

    // For mobile users, show the mobile landing page (sign-in focused)
    if (isMobile) {
      console.log('📱 Rendering mobile landing for unauthenticated user');
      return (
        <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div></div>}>
        <HydrationGate fallback={<div className="min-h-screen bg-white" />}>
        <MobileUIProvider>
          <MobileLandingPage
            onLogin={async (user) => {
              console.log('📱 MobileLandingPage onLogin called with user:', user);

              // Reset logout breadcrumb flag on login (allows logging logout again later)
              resetLogoutBreadcrumb();

              // CRITICAL: Always define profileData first to avoid block-scope bugs
              let profileData = user.profile || user;

              // CRITICAL: Set profile FIRST, before setting user, to prevent role flip-flopping
              if (user.profile || user.is_creator !== undefined || user.role) {
                console.log('📱 Mobile: Setting profile BEFORE user to prevent flip-flop:', {
                  is_creator: profileData.is_creator,
                  role: profileData.role,
                  email: profileData.email
                });

                // Set profile first (this updates isCreator in the store immediately)
                setProfile(profileData);

                // CRITICAL: Also update AuthContext to stop loading state
                authSetProfile(profileData);

                // Verify the store was updated
                const storeState = useHybridStore.getState();
                console.log('📱 Mobile: Store immediately after setProfile:', {
                  isCreator: storeState.isCreator,
                  isAdmin: storeState.isAdmin,
                  roleVerified: storeState.roleVerified
                });
              }

              // Now set user (this triggers the app to render)
              setUser(user);

              // CRITICAL: Also update AuthContext to stop loading state
              authSetUser({
                id: user.id,
                email: user.email
              });

              // Wait for state to propagate (next tick)
              await new Promise(resolve => setTimeout(resolve, 100));

              // Single source of truth: determine role from profileData (now safe with optional chaining!)
              const userRole = profileData?.role === 'admin' ? 'admin' :
                              profileData?.is_creator ? 'creator' : 'fan';
              const targetPath = defaultPathFor(userRole);

              console.log('📱 Mobile: Navigating based on canonical role:', {
                role: userRole,
                targetPath,
                profileData: { is_creator: profileData?.is_creator, role: profileData?.role }
              });

              // Do not navigate here; AppRoutes will redirect once roleResolved is true.
              // Removing navigate() prevents URL↔view tug-of-war with useViewRouter.
            }}
          />
        </MobileUIProvider>
        </HydrationGate>
        </Suspense>
      );
    }

    // Desktop routing
    console.log('📍 Desktop routing - rendering Routes with pathname:', location.pathname);

    // CRITICAL FIX: Atomic redirect gate - runs during render before effects
    // If someone lands on /?mode=signin, immediately redirect to /auth?mode=signin
    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');
    // Only redirect if we're on homepage "/" with mode param (prevents loops)
    if (mode && location.pathname === '/') {
      console.log(`🔧 ModeRedirectGate: /?mode=${mode} → /auth?mode=${mode}`);
      return <Navigate to={{ pathname: '/auth', search: `?mode=${mode}` }} replace />;
    }

    return (
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<Auth onLogin={async (user) => {
          console.log('🖥️ Desktop unauthenticated Auth onLogin called with user:', user);

          // Reset logout breadcrumb flag on login
          resetLogoutBreadcrumb();

          // Define profile data
          let profileData = user.profile || user;

          // Set profile first to prevent role flip-flopping
          if (user.profile || user.is_creator !== undefined || user.role) {
            console.log('🖥️ Desktop: Setting profile data:', {
              is_creator: profileData.is_creator,
              role: profileData.role,
              email: profileData.email
            });

            setProfile(profileData);
            authSetProfile(profileData);
          }

          // Set user
          setUser(user);
          authSetUser({
            id: user.id,
            email: user.email
          });

          // Wait for state to propagate
          await new Promise(resolve => setTimeout(resolve, 100));

          // Navigate based on role
          const userRole = profileData?.role === 'admin' ? 'admin' :
                          profileData?.is_creator ? 'creator' : 'fan';
          const targetPath = defaultPathFor(userRole);

          console.log('🖥️ Desktop: Navigating to:', targetPath);
          startTransition(() => {
            navigate(targetPath, { replace: true });
          });
        }} />} />
        <Route path="/explore" element={<HomePage />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/creator/:username" element={<CreatorPublicProfileEnhanced />} />
        <Route path="/u/:username" element={
          <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div></div>}>
            <FanProfilePage />
          </Suspense>
        } />
        <Route path="/:username/shop" element={<PublicCreatorShop />} />
        {/* Direct username route - must be last before catch-all */}
        <Route path="/:username" element={
          <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div></div>}>
            {(() => {
              const username = location.pathname.substring(1);
              console.log('🎯 Username route matched! Username:', username);
              return <CreatorPublicProfileEnhanced username={username} />;
            })()}
          </Suspense>
        } />
        <Route path="*" element={<HomePage />} />
      </Routes>
    );
  }

  // Handle creator viewing for recently viewed service
  const handleCreatorView = (creator) => {
    console.log('handleCreatorView called with:', creator);
    // Track in recently viewed
    recentlyViewedService.addCreator(creator);
    // Handle the original click logic
    const creatorUsername = creator.username || creator.id;
    console.log('Setting viewingCreator to:', creatorUsername);
    setViewingCreator(creatorUsername);
  };

  // Route guard - prevent legacy views from rendering when on routed pages
  const routedRoots = [
    '/dashboard', '/messages', '/wallet', '/tv', '/classes', '/explore', '/call',
    '/subscriptions', '/following', '/schedule', '/admin', '/content', '/analytics',
    '/collections', '/profile', '/settings', '/followers', '/subscribers',
    // 🔐 All live-related paths to prevent legacy renderer from double-mounting streaming UI
    '/streaming', '/stream', '/live', '/go-live', '/go-live-setup'
  ];

  // Helper to check if pathname is streaming-related
  const isStreamingPath = (pathname) =>
    pathname.startsWith('/streaming') ||
    pathname.startsWith('/live') ||
    pathname.startsWith('/go-live') ||
    pathname.startsWith('/stream');

  const isRoutedPage = routedRoots.some(p => location.pathname.startsWith(p)) || isStreamingPath(location.pathname);

  // Authenticated user layout
  console.log('👤 Showing authenticated layout for user:', user?.email, 'isCreator:', isCreator);
  console.log('📍 Route guard - isRoutedPage:', isRoutedPage, 'pathname:', location.pathname);

  // REMOVED: Old NextLevelMobileApp - now using unified NavigationProvider/AppRoutes for both mobile and desktop
  // Mobile and desktop now share the same navigation system with MobileNav/DesktopNav2025

  // Unified layout for both mobile and desktop continues below
  return (
    <ErrorBoundary>
      <Suspense fallback={<Skeleton className="h-screen" />}>
      <NavigationProvider
        user={user}
        badges={{
          messages: 0,
          notifications: notifications?.length || 0
        }}
        tokenBalance={tokenBalance}
        onGoLive={openGoLive}
      >
        {/* Sync auth state with analytics and error tracking */}
        <AuthAnalyticsBridge />

        {/* Auto-navigate to call page when creator accepts */}
        <CallNavigator />

        {/* Navigation Component - Outside main content for proper fixed positioning */}
        {user && (
          <Navigation
            onLogout={handleSignOut}
            onShowGoLive={openGoLive}
          />
        )}
        
        <div className={`min-h-screen ${isMobile ? '' : 'bg-gray-50 dark:bg-gray-900'} text-gray-900 dark:text-white transition-all duration-300`}>
          <EnhancedToaster />

          {/* All modals rendered via centralized Modals component */}
          <Modals
            user={user}
            tokenBalance={tokenBalance}
            onTokenUpdate={fetchTokenBalance}
            onNavigate={setCurrentView}
          />

      {/* Old header removed - Navigation component handles this now */}

      {/* Error Display - show both local and AuthContext errors */}
      {(error || authError) && (
        <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
          <div className="text-red-700 dark:text-red-400">
            <strong>⚠️ Error:</strong> {error || authError}
          </div>
          <button
            onClick={clearError}
            className="text-red-500 hover:text-red-700 ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Pending Creator Banner - Shows for users with pending creator applications */}
      <Suspense fallback={null}>
        <PendingCreatorBanner user={user} />
      </Suspense>

      {/* Main Content */}
      <PullToRefresh
        disabled={!isMobile} // Enable on mobile, disable on desktop
        onRefresh={async () => {
          await fetchTokenBalance();
          // toast.success('Content refreshed!');
        }}
        refreshMessage="Pull to refresh"
        releaseMessage="Release to refresh"
        refreshingMessage="Refreshing content..."
      >
        {/* URL-based routes for migrated screens (Phase 2: Gradual Route Migration) */}
        {/* Pages in AppRoutes have their own full-screen containers - rendered outside main wrapper */}
        <AppRoutes />

        {/* TEMPORARY: Legacy fallback for views NOT yet in AppRoutes */}
        {/* Wrap ONLY legacy views in main tag for consistent styling */}
        {/* Only render when NOT on a routed page to prevent double-rendering */}
        {!isRoutedPage && (
        <main className={isMobile ? '' : 'pt-28 p-6'}>
          {currentView === 'profile' ? (
          isMobile ? (
            <ImprovedProfile
              user={{...user, ...profile}} // Merge auth user with profile data
              isCreator={isCreator}
              onProfileUpdate={async () => {
                console.log('📱 Manual profile refresh triggered');
                await fetchUserProfile(user);
                toast.success('Profile refreshed!');
              }}
            />
          ) : (
            <ImprovedProfile 
              user={user} 
              isCreator={effectiveIsCreator}
              onProfileUpdate={() => fetchUserProfile(user)}
              setCurrentView={setCurrentView}
              setViewingCreator={setViewingCreator}
            />
          )
        ) : currentView === 'admin' && isAdmin ? (
          <EnhancedAdminDashboard user={user} />
        ) : currentView === 'streaming' ? (
          (() => {
            // 🚫 Hard guard: if URL is already a routed streaming page, don't double render
            if (isStreamingPath(location.pathname)) {
              console.log('⚠️ Streaming path detected in URL - blocking legacy render to prevent duplicate');
              return null;
            }

            // Extract creator username from URL if joining a stream
            const pathMatch = location.pathname.match(/^\/stream\/(.+)$/);
            const streamCreatorUsername = pathMatch ? pathMatch[1] : null;
            
            // If creator is going live (no username in URL)
            if (isCreator && !streamCreatorUsername) {
              return (
                <Suspense fallback={<StreamingLoadingSkeleton type="dashboard" />}>
                  <StreamingDashboard
                  user={user}
                  channel={channel}
                  token={token}
                  chatToken={chatToken}
                  uid={sessionUid}
                  isCreator={isCreator}
                  streamConfig={streamConfig}
                  onNavigate={(view) => setCurrentView(view)}
                  onSessionEnd={() => {
                    setChannel('');
                    setStreamConfig(null);
                    // Don't redirect - stay on streaming view
                  }}
                  onStreamSaved={(streamData) => {
                    // Add the saved stream to the shared content data
                    setSharedContentData(prev => ({
                      ...prev,
                      streams: [...(prev.streams || []), streamData]
                    }));
                    toast.success('Stream saved to your Gallery!');
                  }}
                  />
                </Suspense>
              );
            } else {
              // Fan or viewer joining a creator's stream
              return (
                <Suspense fallback={<StreamingLoadingSkeleton type="dashboard" />}>
                  <StreamingLayout
                  user={user}
                  channel={streamCreatorUsername || channel}
                  token={token}
                  chatToken={chatToken}
                  uid={sessionUid}
                  isCreator={false}
                  isHost={false}
                  isStreaming={true}
                  streamConfig={streamConfig}
                  targetCreator={streamCreatorUsername}
                  onSessionEnd={() => {
                    setChannel('');
                    setStreamConfig(null);
                    startTransition(() => {
                      navigate('/explore');
                    });
                  }}
                  />
                </Suspense>
              );
            }
          })()
        ) : currentView === 'tv' ? (
          <TVPage
            user={user}
            isCreator={isCreator}
            tokenBalance={tokenBalance}
            onTokenPurchase={() => openModal(MODALS.TOKEN_PURCHASE, {
              onSuccess: (tokensAdded) => updateTokenBalance(tokensAdded)
            })}
            onJoinStream={(stream) => {
              // Handle joining a stream
              handleCreatorView(stream.creatorId);
              // toast.success(`Joining ${stream.creatorName}'s stream...`);
            }}
            onShowGoLive={openGoLive}
          />
        ) : currentView === 'classes' ? (
          <ClassesPage 
            user={user}
            isCreator={isCreator}
            tokenBalance={tokenBalance}
            onTokenUpdate={fetchTokenBalance}
          />
        ) : currentView === 'shop' ? (
          <ShopPage
            user={user}
          />
        ) : currentView === 'wallet' ? (
          isMobile ? (
            <MobileWallet
              user={user}
              tokenBalance={tokenBalance}
              onNavigate={setCurrentView}
              onTokenPurchase={() => openModal(MODALS.MOBILE_TOKEN_PURCHASE, {
                onPurchaseSuccess: (tokensAdded) => {
                  updateTokenBalance(tokensAdded);
                  toast.success(`✅ ${tokensAdded} tokens added to your account!`);
                }
              })}
            />
          ) : (
            <WalletPage
              user={user}
              tokenBalance={tokenBalance}
              onTokenUpdate={fetchTokenBalance}
              onViewProfile={(username) => setViewingCreator(username)}
              onTokenPurchase={() => openModal(MODALS.TOKEN_PURCHASE, {
                onSuccess: (tokensAdded) => updateTokenBalance(tokensAdded)
              })}
              isCreator={user?.is_creator || isCreator}
              isAdmin={isAdmin}
            />
          )
        ) : currentView === 'collections' ? (
          <CollectionsPage />
        ) : currentView === 'analytics' ? (
          isMobile ? (
            <MobileAnalytics
              user={user}
              onNavigate={setCurrentView}
            />
          ) : (
            <AnalyticsDashboard 
              user={user}
              className=""
            />
          )
        ) : currentView === 'videoCall' ? (
          <VideoCall 
            user={user}
            onEndCall={() => setCurrentView('explore')}
          />
        ) : currentView === 'voiceCall' ? (
          <VideoCall 
            user={user}
            audioOnly={true}
            onEndCall={() => setCurrentView('explore')}
          />
        ) : currentView === 'offers' ? (
          // Offers are now managed in the Creator Dashboard
          <Navigate to="/dashboard" replace />
        ) : currentView === 'schedule' ? (
          isMobile ? (
            <MobileSchedule
              user={user}
              onNavigate={setCurrentView}
            />
          ) : (
            <SchedulePage 
              user={user}
              isCreator={isCreator}
            />
          )
        ) : currentView === 'profile' ? (
          isMobile ? (
            <ImprovedProfile
              user={user}
              isCreator={isCreator}
              onProfileUpdate={() => fetchUserProfile(user)}
            />
          ) : (
            <ImprovedProfile
              user={user}
              onShowTokenPurchase={() => openModal(MODALS.TOKEN_PURCHASE, {
                onSuccess: (tokensAdded) => updateTokenBalance(tokensAdded)
              })}
            />
          )
        ) : currentView === 'settings' ? (
          isMobile ? (
            <MobileSettingsPage
              user={user}
              navigateTo={setCurrentView}
            />
          ) : (
            <Settings
              user={user}
              onClose={() => setCurrentView('dashboard')}
            />
          )
        ) : currentView === 'content' ? (
          isMobile ? (
            <MobileContent
              user={user}
              onNavigate={setCurrentView}
            />
          ) : (
            <DashboardRouter
              user={user}
              isCreator={isCreator}
              isAdmin={isAdmin}
              roleResolved={roleResolved}
              tokenBalance={tokenBalance}
              onNavigate={(view) => setCurrentView(view)}
            />
          )
        ) : currentView === 'calls' || currentView === 'call-requests' ? (
          isMobile ? (
            <MobileCalls
              user={user}
              onNavigate={setCurrentView}
              onStartCall={handleStartVideoCall}
            />
          ) : (
            <>
              {isCreator ? (
                <DashboardRouter
                user={user}
                isCreator={isCreator}
                isAdmin={isAdmin}
                roleResolved={roleResolved}
                tokenBalance={tokenBalance}
                sessionStats={sessionStats}
                onShowAvailability={() => openModal(MODALS.AVAILABILITY_CALENDAR)}
                onShowGoLive={openGoLive}
                onCreatorSelect={handleCreatorView}
                onTipCreator={handleTipCreator}
                onStartVideoCall={handleStartVideoCall}
                onStartVoiceCall={handleStartVoiceCall}
                onShowEarnings={() => setCurrentView('wallet')}
                onShowOffers={() => setCurrentView('offers')}
                onShowSettings={() => openModal(MODALS.PRIVACY_SETTINGS)}
                onNavigate={(view) => setCurrentView(view)}
                contentData={sharedContentData}
                onContentUpdate={setSharedContentData}
              />
            ) : (
              <div className="flex items-center justify-center h-screen">
                <p className="text-gray-500">Page not found</p>
              </div>
            )}
          </>
          )
        ) : currentView === 'call-requests' ? (
          <CallRequestsPage 
            user={user}
          />
        ) : currentView === 'followers' ? (
          <FollowersSubscribersPage
            user={user}
            isCreator={isCreator}
            initialTab="followers"
          />
        ) : currentView === 'subscribers' ? (
          <FollowersSubscribersPage
            user={user}
            isCreator={isCreator}
            initialTab="subscribers"
          />
        ) : currentView === 'settings' ? (
          isMobile ? (
            <MobileSettingsPage
              user={user}
              navigateTo={setCurrentView}
            />
          ) : (
            <div className="container mx-auto px-4 py-8">
              <PrivacySettings
                user={user}
                onClose={() => setCurrentView('dashboard')}
              />
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">Page not found</p>
          </div>
        )}
        </main>
        )}
        {/* Close the !isRoutedPage conditional wrapper */}
        {/* Add padding at bottom for mobile navigation */}
        {isMobile && <div style={{ height: '80px' }} />}
      </PullToRefresh>

      {/* Video Call Modal */}
      {channel && (
        <VideoCall
          user={user}
          channel={channel}
          token={token}
          chatToken={chatToken}
          uid={sessionUid}
          isHost={true}
          onTokenUpdate={fetchTokenBalance}
          onSessionEnd={() => setChannel('')}
        />
      )}

      {/* Note: All modals now rendered via centralized Modals component above */}

      {/* Smart Balance Notifications - Removed to prevent zero balance popups */}

      {/* PWA Install Prompt - Removed */}

      {/* Real-time Notifications */}
      {user && (
        <RealTimeNotifications
          user={user}
          isCreator={isCreator}
          connected={websocketConnected}
        />
      )}

      {/* Incoming Call Modal */}
      <IncomingCallModal
        isOpen={!!incomingCall}
        onClose={() => {
          setIncomingCall(null);
          clearIncomingCall();
        }}
        callData={incomingCall}
        onAccept={async () => {
          console.log('✅ Call accepted');
          // Send acceptance to fan via socket
          if (incomingCall) {
            socketRespondToCall({
              requestId: incomingCall.id,
              accepted: true,
              creatorId: user?.id
            });
          }

          // Navigate to call view
          if (incomingCall?.type === 'video') {
            setCallType('video');
            setCurrentView('videoCall');
          } else {
            setCallType('voice');
            setCurrentView('voiceCall');
          }

          setIncomingCall(null);
          clearIncomingCall();
        }}
        onDecline={() => {
          console.log('❌ Call declined');
          // Send rejection to fan via socket
          if (incomingCall) {
            socketRespondToCall({
              requestId: incomingCall.id,
              accepted: false,
              creatorId: user?.id
            });
          }
          setIncomingCall(null);
          clearIncomingCall();
        }}
      />

      {/* Instant Chat Widget - Commented out to avoid duplicate on messages page
      {!isMobile && (
        <InstantChatWidget 
          user={user}
          onSendMessage={(messageData) => {
            console.log('Message sent via InstantChatWidget:', messageData);
          }}
        />
      )}
      */}
      
      {/* Navigation handled by NavigationProvider - already rendered above */}
        
        {/* Live Stream Notification - Show for all users */}
        <LiveStreamNotification
          isVisible={showStreamNotification}
          onClose={() => setShowStreamNotification(false)}
          streamConfig={streamNotificationConfig}
        />

        </div>
      </NavigationProvider>
      </Suspense>

      {/* Note: Go Live Setup and Mobile Live Stream modals are now managed via ModalContext */}
      {/* See openGoLive() function and Modals component for implementation */}
    </ErrorBoundary>
  );
};

export default App;