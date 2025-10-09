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
const DigitalsPage = lazy(() => import('./components/pages/DigitalsPage'));
const CreatorApplication = lazy(() => import('./components/CreatorApplication'));
const CreatorKYCVerification = lazy(() => import('./components/CreatorKYCVerification'));

// Lazy load streaming components
const StreamingLoadingSkeleton = lazy(() => import('./components/StreamingLoadingSkeleton'));
const GoLiveSetup = lazy(() => import('./components/GoLiveSetup'));
const MobileGoLive = lazy(() => import('./components/mobile/MobileGoLive'));
const MobileLiveStream = lazy(() => import('./components/mobile/MobileLiveStream'));

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
import NextLevelMobileApp from './components/mobile/NextLevelMobileApp';
// Lazy load rarely accessed pages and components
const MobileApp = lazy(() => import('./components/mobile/MobileApp'));
const TermsOfService = lazy(() => import('./components/pages/TermsOfService'));
const PrivacyPolicy = lazy(() => import('./components/pages/PrivacyPolicy'));
const EnhancedNotificationBell = lazy(() => import('./components/EnhancedNotificationBell'));
const FileUpload = lazy(() => import('./components/FileUpload'));
const PictureInPicture = lazy(() => import('./components/PictureInPicture'));

// Keep essential UI components eager
import ErrorBoundary from './components/ui/ErrorBoundary';
import ErrorPage from './components/ErrorPage';
import ProtectedRoute from './components/ProtectedRoute';

// Mobile components - lazy load for better initial bundle size
import { MobileUIProvider } from './components/mobile/MobileUIProvider';
const FloatingActionButton = lazy(() => import('./components/mobile/FloatingActionButton'));
const MobileBottomSheet = lazy(() => import('./components/mobile/MobileBottomSheet'));
const MobileMessages = lazy(() => import('./components/mobile/MobileMessages'));
const MobileCreatorDashboard = lazy(() => import('./components/mobile/MobileCreatorDashboard'));
const MobileFanDashboard = lazy(() => import('./components/mobile/MobileFanDashboard'));
const MobileContent = lazy(() => import('./components/mobile/MobileContent'));
const MobileWallet = lazy(() => import('./components/mobile/MobileWallet'));
const MobileTokenPurchase = lazy(() => import('./components/mobile/MobileTokenPurchase'));
const MobileCalls = lazy(() => import('./components/mobile/MobileCalls'));
const MobileAnalytics = lazy(() => import('./components/mobile/MobileAnalytics'));
const MobileSchedule = lazy(() => import('./components/mobile/MobileSchedule'));
const MobileSettings = lazy(() => import('./components/mobile/MobileSettings'));
const MobileEditProfile = lazy(() => import('./components/mobile/MobileEditProfile'));
const MobileSettingsPage = lazy(() => import('./components/mobile/pages/MobileSettingsPage'));
const MobileExplore = lazy(() => import('./components/mobile/MobileExplore'));
const MobileCreatorProfile = lazy(() => import('./components/mobile/MobileCreatorProfile'));
const SimpleMobileApp = lazy(() => import('./components/mobile/SimpleMobileApp'));
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

// Keep utility imports eager
import recentlyViewedService from './utils/recentlyViewedService';
import serviceWorkerManager from './utils/ServiceWorkerManager';
import agoraLoader from './utils/AgoraLoader';
import socketService from './services/socket';
import { useBalance, useNotifications } from './hooks/useSocket';
// Import hybrid store
import useHybridStore, { useCurrentView, useNavigationActions } from './stores/useHybridStore';
import { shallow } from 'zustand/shallow';

// Constants
const FETCH_THROTTLE_MS = 5000; // 5 seconds between fetches

const App = () => {
  // Mobile detection - using consistent breakpoint
  const isMobilePortrait = useMediaQuery(BREAKPOINTS.MOBILE_PORTRAIT_QUERY);
  const isMobileLandscape = useMediaQuery(BREAKPOINTS.MOBILE_LANDSCAPE_QUERY);
  const isMobile = useMediaQuery(BREAKPOINTS.MOBILE_QUERY) || isMobileLandscape;
  const isTablet = useMediaQuery(BREAKPOINTS.TABLET_QUERY);
  
  // Debug logging for orientation
  useEffect(() => {
    console.log('📱 Device detection:', {
      isMobile,
      isMobilePortrait,
      isMobileLandscape,
      isTablet,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      orientation: window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape'
    });
  }, [isMobile, isMobilePortrait, isMobileLandscape, isTablet]);
  
  // Add a test state for debugging
  const [testModalOpen, setTestModalOpen] = useState(false);
  
  // Add global function for testing
  useEffect(() => {
    window.openTestModal = () => {
      console.log('🔴 OPENING TEST MODAL VIA GLOBAL FUNCTION');
      setTestModalOpen(true);
    };
    window.closeTestModal = () => {
      console.log('🔴 CLOSING TEST MODAL VIA GLOBAL FUNCTION');
      setTestModalOpen(false);
    };
  }, []);
  
  // Additional mobile detection for debugging
  useEffect(() => {
    console.log('📱 Mobile Detection Debug:', {
      isMobile,
      isTablet,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      userAgent: navigator.userAgent,
      touchCapable: 'ontouchstart' in window,
      pointerCoarse: window.matchMedia('(pointer: coarse)').matches
    });
  }, [isMobile, isTablet]);
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get state values directly from store - moved before useEffect to avoid reference error
  const user = useHybridStore((state) => state.user);
  const profile = useHybridStore((state) => state.profile);
  const storeIsCreator = useHybridStore((state) => state.isCreator);
  const isAdmin = useHybridStore((state) => state.isAdmin);
  const tokenBalance = useHybridStore((state) => state.tokenBalance);
  const notifications = useHybridStore((state) => state.notifications, shallow);
  
  // Get navigation state and actions from store BEFORE using them
  const currentView = useCurrentView();
  
  // Create a stable setCurrentView function using useCallback
  const setCurrentView = useCallback((view) => {
    useHybridStore.getState().setCurrentView(view);
  }, []);
  
  // Track last view with a ref to avoid re-render loops
  const lastViewRef = useRef(currentView);
  
  // Determine creator status - prioritize profile data over localStorage
  const isCreator = React.useMemo(() => {
    // First check profile directly (most reliable source)
    if (profile?.is_creator === true) {
      console.log('🔄 Using profile.is_creator for creator status');
      return true;
    }
    // Then check store
    if (storeIsCreator) {
      return true;
    }
    // Only use localStorage as last fallback if no profile data exists
    if (!profile && localStorage.getItem('userIsCreator') === 'true') {
      console.log('🔄 Using localStorage fallback for creator status (mobile:', isMobile, ')');
      return true;
    }
    return false;
  }, [isMobile, storeIsCreator, profile?.is_creator, profile]);

  // Sync localStorage when profile changes to ensure consistency
  useEffect(() => {
    if (profile) {
      const profileIsCreator = profile.is_creator === true;
      const currentLocalStorage = localStorage.getItem('userIsCreator');

      // Only update if different to avoid unnecessary writes
      if (currentLocalStorage !== String(profileIsCreator)) {
        console.log('🔄 Syncing localStorage: userIsCreator =', profileIsCreator);
        localStorage.setItem('userIsCreator', String(profileIsCreator));
      }
    }
  }, [profile?.is_creator, profile]);

  // Sync URL changes with currentView in store - using direct store access to prevent loops
  useEffect(() => {
    const pathToView = {
      '/': user ? (isCreator ? 'dashboard' : 'explore') : 'home',
      '/dashboard': 'dashboard',
      '/explore': 'explore',
      '/messages': 'messages',
      '/wallet': 'wallet',
      '/profile': 'profile',
      '/settings': 'settings',
      '/content': 'content',
      '/schedule': 'schedule',
      '/analytics': 'analytics',
      '/calls': 'calls',
      '/tv': 'tv',
      '/classes': 'classes',
      '/shop': 'shop',
      '/collections': 'collections',
      '/admin': 'admin',
    };
    
    const view = pathToView[location.pathname];
    if (view && view !== lastViewRef.current) {
      console.log('📱 URL changed to', location.pathname, '- updating view to', view);
      // Use direct store access instead of hook to avoid dependency issues
      useHybridStore.getState().setCurrentView(view);
      lastViewRef.current = view;
    }
  }, [location.pathname, user, isCreator]); // Removed setCurrentView from deps
  
  // Debug creator status for both mobile and desktop
  useEffect(() => {
    const deviceType = isMobile ? '📱 Mobile' : '🖥️ Desktop';
    console.log(`${deviceType} State Check:`, {
      user: user?.email,
      profile: profile?.email,
      isCreator,
      isAdmin,
      storeIsCreator,
      profile_is_creator: profile?.is_creator,
      profile_role: profile?.role,
      localStorage_isCreator: localStorage.getItem('userIsCreator'),
      localStorage_role: localStorage.getItem('userRole')
    });
  }, [isMobile, user, profile, isCreator, isAdmin, storeIsCreator]);
  
  // Get actions separately using store's getState to avoid subscriptions
  const store = useHybridStore;
  const setUser = useCallback((user) => store.getState().setUser(user), []);
  const setProfile = useCallback((profile) => store.getState().setProfile(profile), []);
  const updateTokenBalance = useCallback((balance) => store.getState().setTokenBalance(balance), []);
  const logout = useCallback(() => store.getState().logout(), []);
  const addNotification = useCallback((notif) => store.getState().addNotification(notif), []);
  const removeNotification = useCallback((id) => store.getState().removeNotification(id), []);
  const setActiveChannel = useCallback((channel) => store.getState().setActiveChannel(channel), []);
  const startStream = useCallback((stream) => store.getState().startStream(stream), []);
  const endStream = useCallback(() => store.getState().endStream(), []);
  
  // Local UI state with useState
  const [authLoading, setAuthLoading] = useState(() => {
    // For mobile, don't show loading state initially to avoid black screen
    if (window.innerWidth < 768) {
      return false;
    }
    // Check if we have cached auth to determine initial loading state
    const cachedAuth = localStorage.getItem('isAuthenticated');
    return cachedAuth === 'true';
  });
  const [channel, setChannel] = useState('');
  // Initialize current view based on stored role
  const getInitialView = () => {
    const storedRole = localStorage.getItem('userRole');
    const storedIsCreator = localStorage.getItem('userIsCreator') === 'true';
    if (storedRole === 'admin') return 'admin';
    if (storedRole === 'creator' || storedIsCreator) return 'dashboard';
    return 'explore';
  };
  
  // Initialize on mount with proper view - disabled to prevent loops
  // The view is already set by the URL sync effect above
  const [error, setError] = useState('');
  const [callType, setCallType] = useState('video');
  const [currentCreator, setCurrentCreator] = useState(null);
  
  // Initialize role from localStorage for faster initial render
  useEffect(() => {
    const cachedRole = localStorage.getItem('userRole');
    if (cachedRole && !profile) {
      // Roles are automatically set when setProfile is called
      // This is handled in the store's setProfile action
    }
  }, [profile]);

  // Public/Auth state
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [viewingCreator, setViewingCreator] = useState(null);
  
  // Debug showAuth changes
  useEffect(() => {
    console.log('🔴 showAuth changed to:', showAuth);
  }, [showAuth]);

  // Token balance is now managed in Zustand store (useTokenBalance)
  
  // Request throttling refs
  const fetchInProgress = useRef({ profile: false, balance: false });
  const lastFetch = useRef({ profile: 0, balance: 0 });
  
  // Notification state
  const [showStreamNotification, setShowStreamNotification] = useState(false);
  const [streamNotificationConfig, setStreamNotificationConfig] = useState(null);
  const [showTokenPurchase, setShowTokenPurchase] = useState(false);
  const [showMobileTokenPurchase, setShowMobileTokenPurchase] = useState(false);

  // Modal states
  const [showCreatorDiscovery, setShowCreatorDiscovery] = useState(false);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [showCreatorApplication, setShowCreatorApplication] = useState(false);
  const [showGoLiveSetup, setShowGoLiveSetup] = useState(false);
  const [showMobileLiveStream, setShowMobileLiveStream] = useState(false);
  const [goLiveClickCount, setGoLiveClickCount] = useState(0);

  // Debug effect to monitor showGoLiveSetup changes and lock scroll
  useEffect(() => {
    console.log('🔴 showGoLiveSetup state changed to:', showGoLiveSetup);
    console.log('📱 isMobile:', isMobile);
    console.log('👤 User exists:', !!user);
    console.log('🎬 GoLiveSetup component imported:', !!GoLiveSetup);
    if (showGoLiveSetup) {
      console.log('✅ Modal should be visible now!');
      // Add a small delay to ensure DOM is ready
      setTimeout(() => {
        const modalElement = document.querySelector('[data-golive-modal="true"]');
        if (modalElement) {
          console.log('✅ Modal element found in DOM:', modalElement);
          console.log('Modal dimensions:', {
            width: modalElement.offsetWidth,
            height: modalElement.offsetHeight,
            visible: modalElement.offsetWidth > 0 && modalElement.offsetHeight > 0
          });
        } else {
          console.error('❌ Modal element NOT found in DOM');
        }
      }, 100);
      
      // Lock body scroll when modal is open
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Restore previous overflow when modal closes
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [showGoLiveSetup, isMobile]);
  const [showTokenTipping, setShowTokenTipping] = useState(false);
  const [showAvailabilityCalendar, setShowAvailabilityCalendar] = useState(false);
  const [showFanEngagement, setShowFanEngagement] = useState(false);
  
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

  // Real-time state (from NewApp.js)
  const [incomingCall, setIncomingCall] = useState(null);
  const [websocketConnected, setWebsocketConnected] = useState(false);

  const modalRef = useRef(null);
  
  // No view mode switching - admins are always admins
  const effectiveIsCreator = isCreator;
  const effectiveIsAdmin = isAdmin;

  // Fetch user profile
  const fetchUserProfileDirectlyFromSupabase = async (userId) => {
    try {
      console.log('📱 Fetching profile directly from Supabase for:', userId);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Supabase direct query error:', error);
        return null;
      }
      
      console.log('✅ Direct Supabase profile data:', {
        username: data?.username,
        is_creator: data?.is_creator,
        creator_type: data?.creator_type,
        role: data?.role
      });
      
      return data;
    } catch (error) {
      console.error('Error in direct Supabase query:', error);
      return null;
    }
  };

  const fetchUserProfile = useCallback(async (currentUser = user) => {
    if (!currentUser) return;
    
    // Check throttling
    const now = Date.now();
    if (fetchInProgress.current.profile || now - lastFetch.current.profile < FETCH_THROTTLE_MS) {
      return;
    }
    
    fetchInProgress.current.profile = true;
    lastFetch.current.profile = now;
    
    let currentSession = null; // Store session in outer scope
    try {
      const { data: { session } } = await supabase.auth.getSession();
      currentSession = session; // Store for use in catch block
      console.log('🔑 Session check:', { 
        hasSession: !!session, 
        hasToken: !!session?.access_token,
        userId: session?.user?.id,
        currentUserId: currentUser?.id,
        isMobile: window.innerWidth <= 768
      });
      
      if (!session || !session.access_token) {
        console.error('No valid session found, cannot fetch profile');
        return;
      }
      
      const token = session.access_token;
      // Use the session user ID which is guaranteed to be the Supabase ID
      const userId = session.user.id || currentUser.id;
      
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/users/profile?uid=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Debug logging to check user data
        console.log('🔍 User Profile Data from API:', {
          username: data.username,
          is_creator: data.is_creator,
          is_super_admin: data.is_super_admin,
          role: data.role,
          full_data: data
        });
        // Store the full user profile in the store (this will automatically update isCreator and isAdmin)
        setProfile(data);
        if (data.token_balance !== undefined) {
          updateTokenBalance(data.token_balance);
        }
        
        // Additional debug logging
        console.log('🔐 Admin status set to:', data.is_super_admin === true || data.role === 'admin');
        console.log('👤 Current role:', data.is_super_admin ? 'ADMIN' : data.is_creator ? 'CREATOR' : 'FAN');
      } else {
        // API failed, log the issue
        console.error('❌ Profile API failed:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          isMobile: window.innerWidth <= 768
        });
        
        // Try to get error details
        try {
          const errorData = await response.json();
          console.error('API Error details:', errorData);
        } catch (e) {
          console.error('Could not parse error response');
        }
        
        // Fallback: Try direct Supabase query if API fails
        if (isMobile && userId) {
          console.log('📱 Mobile: Attempting direct Supabase query as fallback');
          const directData = await fetchUserProfileDirectlyFromSupabase(userId);
          if (directData) {
            setProfile(directData);
            console.log('✅ Mobile: Successfully loaded profile from direct Supabase query');
          }
        }
      }
    } catch (error) {
      console.error('❌ Error fetching user profile:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        isMobile: window.innerWidth <= 768
      });
      
      // Fallback: Try direct Supabase query if API fails
      if (isMobile && currentSession?.user?.id) {
        console.log('📱 Mobile: Attempting direct Supabase query as fallback (after error)');
        const directData = await fetchUserProfileDirectlyFromSupabase(currentSession.user.id);
        if (directData) {
          setProfile(directData);
          console.log('✅ Mobile: Successfully loaded profile from direct Supabase query (after error)');
        }
      }
    } finally {
      fetchInProgress.current.profile = false;
    }
  }, [user, setProfile, updateTokenBalance, isMobile]);

  // Fetch token balance
  const fetchTokenBalance = useCallback(async (currentUser = user) => {
    console.log('💰 fetchTokenBalance called with user:', currentUser?.email);
    if (!currentUser) {
      console.log('❌ No user provided to fetchTokenBalance');
      return;
    }
    
    // Check throttling
    const now = Date.now();
    if (fetchInProgress.current.balance || now - lastFetch.current.balance < FETCH_THROTTLE_MS) {
      console.log('⏳ Token balance fetch throttled');
      return;
    }
    
    fetchInProgress.current.balance = true;
    lastFetch.current.balance = now;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔑 Session check for token balance:', { 
        hasSession: !!session, 
        hasToken: !!session?.access_token,
        userId: session?.user?.id 
      });
      const token = session?.access_token;
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/tokens/balance`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log('📊 Token balance response:', { 
        status: response.status, 
        ok: response.ok 
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Token balance fetched successfully:', data.balance);
        updateTokenBalance(data.balance || 0);
      } else {
        console.error('❌ Failed to fetch token balance:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error fetching token balance:', error);
    } finally {
      fetchInProgress.current.balance = false;
    }
  }, [user, updateTokenBalance]);

  // Focus management for modals
  useEffect(() => {
    if (showTokenPurchase && modalRef.current) {
      const currentModalRef = modalRef.current;
      currentModalRef.focus();
      const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
          setShowTokenPurchase(false);
        }
      };
      currentModalRef.addEventListener('keydown', handleKeyDown);
      return () => {
        currentModalRef.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showTokenPurchase]);

  // Authentication state management - only run once on mount
  useEffect(() => {
    let timeoutId;
    let mounted = true;

    const initAuth = async () => {
      // Check for existing session immediately
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          // First sync the user with backend to ensure we have the correct role
          try {
            const response = await fetch(
              `${import.meta.env.VITE_BACKEND_URL}/api/auth/sync-user`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  supabaseId: session.user.id,
                  email: session.user.email,
                  metadata: session.user.user_metadata
                })
              }
            );
            
            if (response.ok) {
              const data = await response.json();
              const userData = data.user;
              
              // Log the user data to debug
              console.log('🔍 User data from sync:', {
                email: userData.email,
                is_creator: userData.is_creator,
                is_super_admin: userData.is_super_admin,
                role: userData.role,
                username: userData.username
              });
              
              // Set user and profile with synced data
              setUser(session.user);
              // Store in the global store (this will automatically update isCreator and isAdmin)
              setProfile(userData);
              if (userData.token_balance !== undefined) {
                updateTokenBalance(userData.token_balance);
              }
              
              console.log('✅ Roles set on refresh:', {
                isCreator: userData.is_creator === true,
                isAdmin: userData.is_super_admin === true || userData.role === 'admin'
              });
              
              setError(''); // Clear any existing errors
              setAuthLoading(false);
              clearTimeout(timeoutId);
              
              // Fetch token balance after sync
              setTimeout(() => fetchTokenBalance(session.user), 200);
            } else {
              // If sync fails, still set user but fetch profile normally
              setUser(session.user);
              setError(''); // Clear any existing errors
              setAuthLoading(false);
              clearTimeout(timeoutId);
              setTimeout(() => fetchUserProfile(session.user), 100);
              setTimeout(() => fetchTokenBalance(session.user), 200);
            }
          } catch (syncError) {
            console.error('Error syncing user on refresh:', syncError);
            // Fallback to normal flow
            setUser(session.user);
            setError(''); // Clear any existing errors
            setAuthLoading(false);
            clearTimeout(timeoutId);
            setTimeout(() => fetchUserProfile(session.user), 100);
            setTimeout(() => fetchTokenBalance(session.user), 200);
          }
        }
      } catch (error) {
        console.error('Error checking initial session:', error);
      }

      timeoutId = setTimeout(() => {
        if (mounted && authLoading) {
          console.log('Auth timeout reached, checking auth state...');
          // Don't show error immediately, just set loading to false
          setAuthLoading(false);
          // Only show error if we truly have no user after timeout
          if (!user) {
            console.warn('No user found after timeout');
          }
        }
      }, 30000); // Increased to 30 seconds

      const unsubscribe = subscribeToAuthChanges(async (event, session) => {
        if (!mounted) return;
        
        try {
          if (session?.user) {
            const user = session.user;
            setUser(user);
            setError(''); // Clear any existing errors
            
            // Verify role with secure backend endpoint
            const verifiedRole = await syncUserRole();
            
            if (verifiedRole) {
              console.log('✅ Role verified on auth change:', {
                event,
                primaryRole: verifiedRole.primaryRole,
                isCreator: verifiedRole.isCreator,
                isAdmin: verifiedRole.isAdmin
              });
            } else {
              console.warn('⚠️ Could not verify role, fetching profile data');
            }
            
            // Fetch user profile and token balance
            setTimeout(() => fetchUserProfile(user), 100);
            setTimeout(() => fetchTokenBalance(user), 200);
          } else {
            // User signed out
            setUser(null);
            // Use logout to clear all auth state
            logout();
            clearRoleCache();
          }
        } catch (error) {
          console.error('Auth state change error:', error);
          // Default to fan account on error for security
          
          if (error.message && !error.message.includes('No user logged in')) {
            setError('Authentication error. Please try again.');
          }
        } finally {
          if (mounted) {
            setAuthLoading(false);
            clearTimeout(timeoutId); // Clear timeout when auth completes
          }
        }
      });

      return unsubscribe;
    };

    let unsubscribe;
    initAuth().then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []); // Empty dependency array - only run once

  // Refresh user data when functions change
  useEffect(() => {
    if (user && !authLoading) {
      console.log('🔄 Fetching user profile for:', user.email);
      fetchUserProfile(user);
      fetchTokenBalance(user);
    }
  }, [user, fetchUserProfile, fetchTokenBalance, authLoading]);
  
  // Force fetch profile on mobile if we have user but no profile or wrong creator status
  useEffect(() => {
    if (isMobile && user) {
      // Always fetch profile on mobile when user changes or on mount
      if (!profile || !profile.id) {
        console.log('📱 Mobile: Fetching profile for user:', user?.email);
        fetchUserProfile(user);
      } else {
        // Check if we need to refresh based on mismatch
        const storedCreatorStatus = localStorage.getItem('userIsCreator') === 'true';
        const profileCreatorStatus = profile?.is_creator === true;
        
        if (storedCreatorStatus !== profileCreatorStatus) {
          console.log('📱 Mobile creator status mismatch, refetching:', {
            stored: storedCreatorStatus,
            profile: profileCreatorStatus,
            userEmail: user?.email
          });
          fetchUserProfile(user);
        }
      }
    }
  }, [isMobile, user?.id]); // Only depend on user.id to prevent loops

  // Set initial view based on user role and redirect from homepage
  useEffect(() => {
    if (!authLoading && user) {
      console.log('🎯 Setting initial view - Admin:', isAdmin, 'Creator:', isCreator);
      
      // Check if user is on homepage and redirect them
      const currentPath = location.pathname;
      if (currentPath === '/' || currentPath === '') {
        // Redirect authenticated users away from homepage
        if (isAdmin) {
          console.log('➡️ Redirecting to ADMIN from homepage');
          startTransition(() => {
            navigate('/admin');
            setCurrentView('admin');
          });
        } else if (isCreator) {
          console.log('➡️ Redirecting to DASHBOARD from homepage');
          startTransition(() => {
            navigate('/dashboard');
            setCurrentView('dashboard');
          });
        } else {
          console.log('➡️ Redirecting to EXPLORE from homepage');
          startTransition(() => {
            navigate('/explore');
            setCurrentView('explore');
          });
        }
      } else {
        // Set view based on current route
        if (isAdmin && currentPath === '/admin') {
          startTransition(() => {
            setCurrentView('admin');
          });
        } else if (isCreator && currentPath === '/dashboard') {
          startTransition(() => {
            setCurrentView('dashboard');
          });
        } else if (currentPath === '/explore') {
          startTransition(() => {
            setCurrentView('explore');
          });
        } else if (currentPath.startsWith('/stream/')) {
          // Handle stream viewing route
          startTransition(() => {
            setCurrentView('streaming');
          });
        }
      }
    }
  }, [isCreator, isAdmin, user, authLoading]); // Removed location.pathname and navigate from deps

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

  // Socket.io connection with delay to prevent immediate errors
  useEffect(() => {
    if (!user) return;

    // Add a small delay to allow backend to be ready
    const timeoutId = setTimeout(async () => {
      try {
        // Initialize Socket.io connection
        console.log('📡 Initializing Socket.io connection...');
        await socketService.connect();
      } catch (error) {
        console.warn('Socket connection failed (non-critical):', error.message);
        // Socket connection is optional, app can work without it
      }
    }, 1500); // Wait 1.5 seconds before connecting

    // Subscribe to connection status
    const unsubConnection = socketService.on('connection-status', ({ connected }) => {
      setWebsocketConnected(connected);
    });

    // Subscribe to call requests (for creators)
    const unsubCallRequest = socketService.on('call-request', (data) => {
      console.log('📞 Incoming call request:', data);
      if (isCreator) {
        // Show incoming call modal for creators
        setIncomingCall({
          id: data.requestId,
          type: data.type,
          caller: {
            id: data.fanId,
            name: data.fanName,
            username: data.fanName
          },
          rate: data.rate
        });
      }
    });

    // Subscribe to call acceptance (for fans)
    const unsubCallAccepted = socketService.on('call-accepted', (data) => {
      console.log('✅ Call accepted by creator:', data);
      // Navigate to video/voice call view
      if (data.type === 'video') {
        setCallType('video');
        setCurrentView('videoCall');
      } else {
        setCallType('voice');
        setCurrentView('voiceCall');
      }
    });

    // Subscribe to call rejection (for fans)
    const unsubCallRejected = socketService.on('call-rejected', (data) => {
      console.log('❌ Call rejected by creator:', data);
      toast.error('Call was declined by the creator', {
        duration: 4000
      });
    });

    // Cleanup on unmount or user change
    return () => {
      clearTimeout(timeoutId);
      unsubConnection();
      unsubCallRequest();
      unsubCallAccepted();
      unsubCallRejected();
      socketService.disconnect();
    };
  }, [user, isCreator]);

  // Real-time balance updates
  const { balance } = useBalance(user);
  
  useEffect(() => {
    if (balance !== null) {
      updateTokenBalance(balance);
    }
  }, [balance]);

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
  const handleTipCreator = (creator) => {
    setTippingRecipient(creator);
    setShowTokenTipping(true);
  };

  // Unified Go Live handler
  const openGoLive = useCallback(() => {
    console.log('🎬 Opening Go Live setup');
    console.log('📱 isMobile value:', isMobile);
    console.log('🔍 Current showMobileLiveStream state:', showMobileLiveStream);

    if (isMobile) {
      console.log('📱 Mobile detected - setting showMobileLiveStream to true');
      setShowMobileLiveStream(true);

      // Debug check after state update
      setTimeout(() => {
        console.log('🔍 After setState - checking for MobileLiveStream component...');
      }, 100);
    } else {
      console.log('🖥️ Desktop detected - setting showGoLiveSetup to true');
      setShowGoLiveSetup(true);
    }
  }, [isMobile, showMobileLiveStream]);

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
  const handlePurchase = (amount) => {
    setShowTokenPurchase(true);
  };
  
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
    console.log('currentView changed to:', currentView);
  }, [currentView]);

  // Removed the problematic URL sync effect to prevent infinite redirects

  // Removed the second URL sync effect to prevent infinite redirects

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      logout(); // This will clear isCreator and isAdmin through Zustand
      // Stay on the same site after logout
      startTransition(() => {
        navigate('/');
      });
      // Removed success toast for production
      // toast.success('Signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
    }
  };

  // Handle auth
  const handleSignIn = () => {
    console.log('🔵 handleSignIn called - setting showAuth to true');
    setAuthMode('signin');
    setShowAuth(true);
  };

  const handleSignUp = () => {
    console.log('🔵 handleSignUp called - setting showAuth to true');
    setAuthMode('signup');
    setShowAuth(true);
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
              onLogin={(user) => {
                console.log('🖥️ Desktop Auth onLogin called with user:', user);
                console.log('🖥️ Desktop auth data received:', {
                  hasProfile: !!user.profile,
                  is_creator: user.is_creator,
                  role: user.role,
                  creator_type: user.creator_type,
                  email: user.email
                });
                
                setUser(user);
                
                // Always set profile if we have creator/role data
                if (user.profile || user.is_creator !== undefined || user.role) {
                  const profileData = user.profile || user;
                  console.log('🖥️ Desktop: Setting profile with data:', {
                    is_creator: profileData.is_creator,
                    role: profileData.role,
                    creator_type: profileData.creator_type
                  });
                  setProfile(profileData);
                  
                  // Force a state refresh after setting profile
                  setTimeout(() => {
                    console.log('🖥️ Desktop: After profile set - checking store state');
                    const currentState = useHybridStore.getState();
                    console.log('🖥️ Desktop: Current store state:', {
                      isCreator: currentState.isCreator,
                      isAdmin: currentState.isAdmin,
                      profile_is_creator: currentState.profile?.is_creator
                    });
                    
                    // Also update the current view based on creator status
                    if (currentState.isCreator || profileData.is_creator) {
                      console.log('🖥️ Desktop: Setting view to dashboard for creator');
                      startTransition(() => {
                        setCurrentView('dashboard');
                      });
                    } else {
                      console.log('🖥️ Desktop: Setting view to explore for fan');
                      startTransition(() => {
                        setCurrentView('explore');
                      });
                    }
                  }, 100);
                }
                setShowAuth(false);
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
    // Mobile loading state - simple and clean
    if (isMobile) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
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
              setCurrentView('messages');
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
    
    // For mobile users, show the mobile landing page (sign-in focused)
    if (isMobile) {
      console.log('📱 Rendering mobile landing for unauthenticated user');
      return (
        <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div></div>}>
        <MobileUIProvider>
          <MobileLandingPage 
            onLogin={(user) => {
              console.log('📱 MobileLandingPage onLogin called with user:', user);
              setUser(user);
              
              // Set profile if available
              if (user.profile || user.is_creator !== undefined || user.role) {
                const profileData = user.profile || user;
                setProfile(profileData);

                // Immediately navigate based on user role
                const isCreatorUser = profileData.is_creator === true;
                const isAdminUser = profileData.is_super_admin === true || profileData.role === 'admin';

                if (isAdminUser) {
                  startTransition(() => {
                    setCurrentView('dashboard');
                    navigate('/admin');
                  });
                } else if (isCreatorUser) {
                  startTransition(() => {
                    setCurrentView('dashboard');
                    navigate('/dashboard');
                  });
                } else {
                  startTransition(() => {
                    setCurrentView('explore');
                    navigate('/explore');
                  });
                }
              } else {
                // Default to explore if no profile data
                startTransition(() => {
                  setCurrentView('explore');
                  navigate('/explore');
                });
              }
            }}
          />
        </MobileUIProvider>
        </Suspense>
      );
    }
    
    // Desktop routing
    return (
      <Routes>
        <Route path="/" element={<HomePage onSignIn={handleSignIn} onSignUp={handleSignUp} />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/explore" element={<HomePage onSignIn={handleSignIn} onSignUp={handleSignUp} />} />
        <Route path="/creator/:username" element={<CreatorPublicProfileEnhanced />} />
        <Route path="/:username/shop" element={<PublicCreatorShop />} />
        <Route path="/:username/digitals" element={<DigitalsPage />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="*" element={<HomePage onSignIn={handleSignIn} onSignUp={handleSignUp} />} />
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

  // Authenticated user layout
  console.log('👤 Showing authenticated layout for user:', user?.email, 'isCreator:', isCreator);
  
  // Don't return early for mobile - let the main layout handle it with MobileNavigationEnhanced
  // This ensures the navigation and content both render properly
  
  // Desktop layout continues below
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
        {/* Navigation Component - Outside main content for proper fixed positioning */}
        {user && (
          <Navigation 
            user={user}
            onLogout={handleSignOut}
            onShowGoLive={openGoLive}
          />
        )}
        
        <div className={`min-h-screen ${isMobile ? '' : 'bg-gray-50 dark:bg-gray-900'} text-gray-900 dark:text-white transition-all duration-300`}>
          <EnhancedToaster />

      {/* Token Purchase Modal */}
      {showTokenPurchase && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowTokenPurchase(false);
            }
          }}
        >
          <ErrorBoundary variant="compact">
            <ImprovedTokenPurchase
              user={user}
              onSuccess={(tokensAdded) => {
                updateTokenBalance(tokensAdded); // updateTokenBalance handles the delta
                setShowTokenPurchase(false);
                // toast.success(`✅ ${tokensAdded} tokens added to your account!`);
              }}
              onClose={() => setShowTokenPurchase(false)}
              isModal={true}
            />
          </ErrorBoundary>
        </div>
      )}

      {/* Mobile Token Purchase Modal */}
      {showMobileTokenPurchase && (
        <MobileTokenPurchase
          isOpen={showMobileTokenPurchase}
          onClose={() => setShowMobileTokenPurchase(false)}
          user={user}
          onPurchaseSuccess={(tokensAdded) => {
            updateTokenBalance(tokensAdded);
            setShowMobileTokenPurchase(false);
            toast.success(`✅ ${tokensAdded} tokens added to your account!`);
          }}
        />
      )}


      {/* Enhanced Creator Discovery Modal */}
      {showCreatorDiscovery && (
        <EnhancedCreatorDiscovery
          user={user}
          onClose={() => setShowCreatorDiscovery(false)}
        />
      )}

      {/* Privacy Settings Modal */}
      {showPrivacySettings && (
        <PrivacySettings
          user={user}
          onClose={() => setShowPrivacySettings(false)}
        />
      )}

      {/* Creator Application Modal */}
      {showCreatorApplication && (
        <CreatorApplication
          onClose={() => setShowCreatorApplication(false)}
          onSuccess={() => {
            setShowCreatorApplication(false);
            // toast.success('Creator application submitted successfully!');
          }}
        />
      )}


      {/* Tip Modal */}
      <TipModal
        isOpen={showTokenTipping}
        onClose={() => {
          setShowTokenTipping(false);
          setTippingRecipient(null);
        }}
        creator={tippingRecipient}
        tokenBalance={tokenBalance}
        onTipSent={() => {
          setShowTokenTipping(false);
          setTippingRecipient(null);
          fetchTokenBalance();
          // toast.success('🎉 Tip sent successfully!');
        }}
      />

      {/* Old header removed - Navigation component handles this now */}

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
          <div className="text-red-700 dark:text-red-400">
            <strong>⚠️ Error:</strong> {error}
          </div>
          <button
            onClick={clearError}
            className="text-red-500 hover:text-red-700 ml-4"
          >
            ✕
          </button>
        </div>
      )}

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
        <main className={isMobile ? '' : 'pt-20 p-6'}>
        {currentView === 'profile' ? (
          isMobile ? (
            <>
              {/* Debug info for mobile creator detection */}
              {console.log('📱 Mobile Profile Props:', {
                user: user?.email,
                isCreator,
                profile_is_creator: profile?.is_creator,
                profile_role: profile?.role,
                localStorage_creator: localStorage.getItem('userIsCreator')
              })}
              <ImprovedProfile
                user={{...user, ...profile}} // Merge auth user with profile data
                isCreator={isCreator}
                onProfileUpdate={async () => {
                  console.log('📱 Manual profile refresh triggered');
                  await fetchUserProfile(user);
                  toast.success('Profile refreshed!');
                }}
              />
            </>
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
        ) : currentView === 'history' ? (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 transition-all duration-300">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">📊 Session History</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-green-50 p-6 rounded-xl border border-green-200 text-center">
                <div className="text-2xl font-bold text-green-700">{sessionStats.totalSessions}</div>
                <div className="text-sm text-green-600">Total Sessions</div>
              </div>
              <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 text-center">
                <div className="text-2xl font-bold text-blue-700">${sessionStats.totalEarnings}</div>
                <div className="text-sm text-blue-600">Total Earnings</div>
              </div>
              <div className="bg-purple-50 p-6 rounded-xl border border-purple-200 text-center">
                <div className="text-2xl font-bold text-purple-700">{sessionStats.activeUsers}</div>
                <div className="text-sm text-purple-600">Active Fans</div>
              </div>
            </div>
          </div>
        ) : currentView === 'streaming' ? (
          (() => {
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
        ) : currentView === 'following' ? (
          <FollowingSystem 
            user={user}
            onCreatorSelect={(creator) => {
              setViewingCreator(creator.username || creator.creator);
            }}
          />
        ) : currentView === 'dashboard' && isMobile ? (
          // Mobile Dashboard - Creator or Fan
          (() => {
            // Prioritize profile data over store/localStorage
            const isCreatorUser = profile?.is_creator === true || (isCreator && profile?.is_creator !== false);
            
            console.log('📱 Mobile Dashboard Render:', {
              isCreatorUser,
              profile_is_creator: profile?.is_creator,
              store_isCreator: isCreator,
              localStorage_isCreator: localStorage.getItem('userIsCreator'),
              user: user?.email,
              profile: profile
            });
            
            // Show loading state if user data isn't ready
            if (!user) {
              return (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading dashboard...</p>
                  </div>
                </div>
              );
            }
            
            if (isCreatorUser) {
              // Try to render MobileCreatorDashboard with fallback
              try {
                return (
                  <MobileCreatorDashboard
                    user={user}
                    tokenBalance={tokenBalance}
                    onNavigate={setCurrentView}
                    onShowGoLive={openGoLive}
                    onShowAvailability={() => {
                      console.log('Schedule clicked - navigating to schedule');
                      setCurrentView('schedule');
                    }}
                    onShowEarnings={() => setCurrentView('wallet')}
                    onShowSettings={() => setShowPrivacySettings(true)}
                    onShowContent={() => setCurrentView('content')}
                    onShowMessages={() => setCurrentView('messages')}
                  />
                );
              } catch (error) {
                console.error('Error rendering MobileCreatorDashboard:', error);
                // Fallback to desktop dashboard for now
                return (
                  <div className="p-4">
                    <h2 className="text-xl font-bold mb-4">Creator Dashboard</h2>
                    <div className="grid gap-4">
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <p className="text-gray-600 dark:text-gray-400">Welcome back, {user?.email}</p>
                        <p className="text-sm text-gray-500 mt-2">Mobile dashboard is being updated</p>
                      </div>
                    </div>
                  </div>
                );
              }
            } else {
              // Try to render MobileFanDashboard with fallback
              try {
                return (
                  <MobileFanDashboard
                    user={user}
                    tokenBalance={tokenBalance}
                    onNavigate={setCurrentView}
                    onCreatorSelect={handleCreatorView}
                    onTokenPurchase={() => setShowTokenPurchase(true)}
                    onStartVideoCall={handleStartVideoCall}
                    onStartVoiceCall={handleStartVoiceCall}
                  />
                );
              } catch (error) {
                console.error('Error rendering MobileFanDashboard:', error);
                // Fallback to simple dashboard
                return (
                  <div className="p-4">
                    <h2 className="text-xl font-bold mb-4">Dashboard</h2>
                    <div className="grid gap-4">
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <p className="text-gray-600 dark:text-gray-400">Welcome, {user?.email}</p>
                        <p className="text-sm text-gray-500 mt-2">Explore creators to get started</p>
                      </div>
                    </div>
                  </div>
                );
              }
            }
          })()
        ) : currentView === 'dashboard' ? (
          <DashboardRouter 
            user={user}
            isCreator={effectiveIsCreator}
            isAdmin={effectiveIsAdmin}
            tokenBalance={tokenBalance}
            sessionStats={sessionStats}
            onShowAvailability={() => setShowAvailabilityCalendar(true)}
            onShowGoLive={openGoLive}
            onCreatorSelect={handleCreatorView}
            onTipCreator={handleTipCreator}
            onStartVideoCall={handleStartVideoCall}
            onStartVoiceCall={handleStartVoiceCall}
            onShowEarnings={() => setCurrentView('wallet')}
            onShowOffers={() => setCurrentView('offers')}
            onShowSettings={() => setShowPrivacySettings(true)}
            onNavigate={(view) => setCurrentView(view)}
            contentData={sharedContentData}
            onContentUpdate={setSharedContentData}
          />
        ) : currentView === 'explore' ? (
          isMobile ? (
            <MobileExplore
              user={user}
              onNavigate={setCurrentView}
              onCreatorSelect={handleCreatorView}
            />
          ) : (
            <ExplorePage
              user={user}
              tokenBalance={tokenBalance}
              onCreatorSelect={handleCreatorView}
              onTipCreator={handleTipCreator}
              onStartVideoCall={handleStartVideoCall}
              onStartVoiceCall={handleStartVoiceCall}
              onScheduleSession={(creator) => {
                sessionStorage.setItem('scheduleCreator', JSON.stringify(creator));
                startTransition(() => {
                  navigate('/schedule');
                });
              }}
              onSendMessage={(creator) => {
                sessionStorage.setItem('messageCreator', JSON.stringify(creator));
                setCurrentCreator(creator);
                setCurrentView('messages');
              }}
              onMakeOffer={(creator) => {
                sessionStorage.setItem('offerCreator', JSON.stringify(creator));
                startTransition(() => {
                  navigate('/offers');
                });
              }}
            />
          )
        ) : currentView === 'tv' ? (
          <TVPage
            user={user}
            isCreator={isCreator}
            tokenBalance={tokenBalance}
            onTokenPurchase={() => setShowTokenPurchase(true)}
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
        ) : currentView === 'messages' ? (
          isMobile ? (
            <MobileMessages
              user={user}
              isCreator={isCreator}
              tokenBalance={tokenBalance}
              onStartVideoCall={handleStartVideoCall}
              onStartVoiceCall={handleStartVoiceCall}
              onSendTip={handleTipCreator}
            />
          ) : (
            <MessagesPage 
              user={user}
              isCreator={isCreator}
              onStartVideoCall={handleStartVideoCall}
              onStartVoiceCall={handleStartVoiceCall}
              onSendTip={handleTipCreator}
            />
          )
        ) : currentView === 'shop' ? (
          <ShopPage 
            user={user}
          />
        ) : currentView === 'shop-management' ? (
          <ShopManagementPage 
            user={user}
          />
        ) : currentView === 'wallet' ? (
          isMobile ? (
            <MobileWallet
              user={user}
              tokenBalance={tokenBalance}
              onNavigate={setCurrentView}
              onTokenPurchase={() => setShowMobileTokenPurchase(true)}
            />
          ) : (
            <WalletPage 
              user={user}
              tokenBalance={tokenBalance}
              onTokenUpdate={fetchTokenBalance}
              onViewProfile={(username) => setViewingCreator(username)}
              onTokenPurchase={() => setShowTokenPurchase(true)}
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
              onShowTokenPurchase={() => setShowTokenPurchase(true)}
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
                tokenBalance={tokenBalance}
                sessionStats={sessionStats}
                onShowAvailability={() => setShowAvailabilityCalendar(true)}
                onShowGoLive={openGoLive}
                onCreatorSelect={handleCreatorView}
                onTipCreator={handleTipCreator}
                onStartVideoCall={handleStartVideoCall}
                onStartVoiceCall={handleStartVoiceCall}
                onShowEarnings={() => setCurrentView('wallet')}
                onShowOffers={() => setCurrentView('offers')}
                onShowSettings={() => setShowPrivacySettings(true)}
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
        ) : currentView === 'supabase-test' ? (
          <SupabaseTestPage />
        ) : currentView === 'kyc' && isCreator ? (
          <CreatorKYCVerification 
            user={user}
            onComplete={() => {
              toast.success('KYC verification submitted successfully!');
              setCurrentView('dashboard');
            }}
            onCancel={() => setCurrentView('dashboard')}
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
          <div className="space-y-8">
            <DashboardRouter 
              user={user}
              isCreator={isCreator}
              isAdmin={isAdmin}
              tokenBalance={tokenBalance}
              sessionStats={sessionStats}
              onShowAvailability={() => setShowAvailabilityCalendar(true)}
              onShowGoLive={openGoLive}
              onCreatorSelect={handleCreatorView}
              onTipCreator={handleTipCreator}
              onStartVideoCall={handleStartVideoCall}
              onStartVoiceCall={handleStartVoiceCall}
              onShowEarnings={() => setCurrentView('wallet')}
                onShowOffers={() => setCurrentView('offers')}
              onShowSettings={() => setShowPrivacySettings(true)}
              onNavigate={(view) => setCurrentView(view)}
              contentData={sharedContentData}
              onContentUpdate={setSharedContentData}
            />

            {/* Recently Viewed Creators - Only show for fans */}
            {!isCreator && (
              <ErrorBoundary variant="compact">
                <RecentlyViewedCreators
                  user={user}
                  onCreatorClick={handleCreatorView}
                  onTipCreator={handleTipCreator}
                  maxItems={8}
                  className="px-6"
                />
              </ErrorBoundary>
            )}
          </div>
        )}
        </main>
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

      {/* Availability Calendar Modal */}
      {showAvailabilityCalendar && (
        <EnhancedSchedule
          user={user}
          onClose={() => setShowAvailabilityCalendar(false)}
        />
      )}

      {/* Fan Engagement Modal */}
      {showFanEngagement && (
        <FanEngagement
          user={user}
          tokenBalance={tokenBalance}
          onCreatorSelect={(creator) => {
            setViewingCreator(creator.username || creator.creator);
          }}
          onClose={() => setShowFanEngagement(false)}
        />
      )}

      {/* Smart Balance Notifications - Removed to prevent zero balance popups */}
      {/* {user && !isCreator && (
        <SmartBalanceNotifications
          user={user}
          currentBalance={tokenBalance}
          onQuickPurchase={() => setShowTokenPurchase(true)}
          onOpenTokenStore={() => setShowTokenPurchase(true)}
        />
      )} */}

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
        onClose={() => setIncomingCall(null)}
        callData={incomingCall}
        onAccept={async () => {
          console.log('✅ Call accepted');
          // Send acceptance to fan via socket
          if (socketService && incomingCall) {
            socketService.emit('call-response', {
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
        }}
        onDecline={() => {
          console.log('❌ Call declined');
          // Send rejection to fan via socket
          if (socketService && incomingCall) {
            socketService.emit('call-response', {
              requestId: incomingCall.id,
              accepted: false,
              creatorId: user?.id
            });
          }
          setIncomingCall(null);
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
      
      {/* Go Live Setup Modal - Desktop only */}
      {showGoLiveSetup && !isMobile && (
        <GoLiveSetup
          user={user}
          onCancel={() => {
            console.log('GoLiveSetup cancelled');
            setShowGoLiveSetup(false);
          }}
          onGoLive={(config) => {
            console.log('Starting stream with config:', config);
            setStreamConfig(config);
            setShowGoLiveSetup(false);
            setCurrentView('streaming');
            toast.success('Going live! 🎉');
          }}
        />
      )}

      {/* Mobile Live Stream - Simplified for mobile */}
      {showMobileLiveStream && isMobile && (
        <>
          {console.log('🚀 Rendering MobileLiveStream component!')}
          <MobileLiveStream
            user={user}
            onEnd={() => {
              console.log('Mobile stream ended');
              setShowMobileLiveStream(false);
            }}
            streamConfig={streamConfig}
          />
        </>
      )}
      {/* Debug log for mobile stream state */}
      {isMobile && console.log('📱 Mobile Live Stream State:', { showMobileLiveStream, isMobile })}
    </ErrorBoundary>
  );
};

export default App;