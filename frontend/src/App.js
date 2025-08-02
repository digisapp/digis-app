import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase, subscribeToAuthChanges } from './utils/supabase-auth.js';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { ContentProvider } from './contexts/ContentContext';
import LiveStreamNotification from './components/LiveStreamNotification';
import { useMediaQuery } from './hooks/useMediaQuery';
import Auth from './components/Auth';
import ImprovedProfile from './components/ImprovedProfile';
import VideoCall from './components/VideoCall';
import EnhancedSchedule from './components/EnhancedSchedule';
import FanEngagement from './components/FanEngagement';
import StreamingLayout from './components/StreamingLayout';
import StreamingDashboard from './components/StreamingDashboard';
import CreatorSubscriptions from './components/CreatorSubscriptions';
import HomePage from './components/HomePage';
import EnhancedPublicLanding from './components/EnhancedPublicLanding';
import PublicCreatorProfile from './components/PublicCreatorProfile';
import CreatorPublicProfile from './components/CreatorPublicProfile';
import CreatorStudio from './components/CreatorStudio';
import EnhancedCreatorDiscovery from './components/EnhancedCreatorDiscovery';
import PrivacySettings from './components/PrivacySettings';
// Removed unused imports: TokenPurchase, QuickBuyWidget
// import SmartBalanceNotifications from './components/SmartBalanceNotifications'; // Removed to prevent zero balance popups
// import PWAInstallPrompt from './components/PWAInstallPrompt'; // Removed PWA install prompt
import CreatorApplication from './components/CreatorApplication';
import Skeleton from './components/ui/Skeleton';
import GoLiveSetup from './components/GoLiveSetup';
import TokenTipping from './components/TokenTipping';
import FollowingSystem from './components/FollowingSystem';
// Removed unused imports: CreatorToolsQuickAccess, CreatorCardsGallery, GiftInteractionSystem, UserProfile
import Wallet from './components/Wallet';
import AdminDashboard from './components/AdminDashboard';
import InstantChatWidget from './components/InstantChatWidget';
import DashboardPage from './components/pages/DashboardPage';
import ClassesPage from './components/pages/ClassesPage';
import MessagesPage from './components/pages/MessagesPage';
// Removed unused import: ImprovedNavigation
import ResponsiveNavigation from './components/navigation/ResponsiveNavigation';
import PullToRefresh from './components/ui/PullToRefresh';
// import { PageTransition } from './components/ui/PageTransitions'; // Removed to eliminate transitions
import ErrorBoundary from './components/ui/ErrorBoundary';

// Mobile components
import { MobileUIProvider } from './components/mobile/MobileUIProvider';
import MobileOptimizedAuth from './components/mobile/MobileOptimizedAuth';
import FloatingActionButton from './components/mobile/FloatingActionButton';
import EnhancedMobileNavigation from './components/mobile/EnhancedMobileNavigation';
import MobileBottomSheet from './components/mobile/MobileBottomSheet';
import MobileProfile from './components/mobile/MobileProfile';
import MobileMessages from './components/mobile/MobileMessages';
import NextLevelMobileApp from './components/mobile/NextLevelMobileApp';
import SimpleMobileApp from './components/mobile/SimpleMobileApp';
import RecentlyViewedCreators from './components/RecentlyViewedCreators';
import ImprovedTokenPurchase from './components/ImprovedTokenPurchase';
// Removed unused import: SwipeableCreatorGallery
import RealTimeNotifications from './components/RealTimeNotifications';
import IncomingCallNotification from './components/IncomingCallNotification';
import recentlyViewedService from './utils/recentlyViewedService';
import serviceWorkerManager from './utils/ServiceWorkerManager';
import agoraLoader from './utils/AgoraLoader';
import ExplorePage from './components/pages/ExplorePage';
import TVPage from './components/pages/TVPage';
import EnhancedContentStudio from './components/EnhancedContentStudio';
import OffersManagement from './components/OffersManagement';
import ConnectPage from './components/pages/ConnectPage';
import SupabaseTestPage from './components/SupabaseTestPage';
import socketService from './services/socket';
import { useBalance, useNotifications } from './hooks/useSocket';

const App = () => {
  // Mobile detection
  const isMobile = useMediaQuery('(max-width: 768px)');
  const navigate = useNavigate();
  const location = useLocation();
  
  // Core state
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [channel, setChannel] = useState('');
  const [currentView, setCurrentView] = useState('explore');
  const [error, setError] = useState('');

  // Public/Auth state
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [viewingCreator, setViewingCreator] = useState(null);

  // Token economy state
  const [tokenBalance, setTokenBalance] = useState(0);
  
  // Request throttling refs
  const fetchInProgress = useRef({ profile: false, balance: false });
  const lastFetch = useRef({ profile: 0, balance: 0 });
  const FETCH_THROTTLE_MS = 5000; // 5 seconds between fetches
  
  // Notification state
  const [showStreamNotification, setShowStreamNotification] = useState(false);
  const [streamNotificationConfig, setStreamNotificationConfig] = useState(null);
  const [showTokenPurchase, setShowTokenPurchase] = useState(false);

  // Modal states
  const [showCreatorStudio, setShowCreatorStudio] = useState(false);
  const [showCreatorDiscovery, setShowCreatorDiscovery] = useState(false);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [showCreatorApplication, setShowCreatorApplication] = useState(false);
  const [showGoLiveSetup, setShowGoLiveSetup] = useState(false);
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

  // Real-time state (from NewApp.js)
  const [incomingCall, setIncomingCall] = useState(null);
  const [websocketConnected, setWebsocketConnected] = useState(false);

  const modalRef = useRef(null);

  // Fetch user profile
  const fetchUserProfile = useCallback(async (currentUser = user) => {
    if (!currentUser) return;
    
    // Check throttling
    const now = Date.now();
    if (fetchInProgress.current.profile || now - lastFetch.current.profile < FETCH_THROTTLE_MS) {
      return;
    }
    
    fetchInProgress.current.profile = true;
    lastFetch.current.profile = now;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/users/profile?uid=${currentUser.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Store the full user profile
        setUserProfile(data);
        // Check for dev mode override
        const devModeCreator = localStorage.getItem('devModeCreator');
        setIsCreator(devModeCreator === 'true' ? true : (data.is_creator || false));
        setIsAdmin(data.is_super_admin || false);
      } else {
        // Check dev mode even if API fails
        const devModeCreator = localStorage.getItem('devModeCreator');
        if (devModeCreator === 'true') {
          setIsCreator(true);
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Check dev mode even on error
      const devModeCreator = localStorage.getItem('devModeCreator');
      if (devModeCreator === 'true') {
        setIsCreator(true);
      }
    } finally {
      fetchInProgress.current.profile = false;
    }
  }, [user, FETCH_THROTTLE_MS]);

  // Fetch token balance
  const fetchTokenBalance = useCallback(async (currentUser = user) => {
    if (!currentUser) return;
    
    // Check throttling
    const now = Date.now();
    if (fetchInProgress.current.balance || now - lastFetch.current.balance < FETCH_THROTTLE_MS) {
      return;
    }
    
    fetchInProgress.current.balance = true;
    lastFetch.current.balance = now;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/tokens/balance`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTokenBalance(data.balance || 0);
      }
    } catch (error) {
      console.error('Error fetching token balance:', error);
    } finally {
      fetchInProgress.current.balance = false;
    }
  }, [user, FETCH_THROTTLE_MS]);

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
          setUser(session.user);
          setError(''); // Clear any existing errors
          setAuthLoading(false);
          clearTimeout(timeoutId);
          // Fetch additional data
          setTimeout(() => fetchUserProfile(session.user), 100);
          setTimeout(() => fetchTokenBalance(session.user), 200);
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
            // Use setTimeout to avoid multiple simultaneous requests
            setTimeout(() => fetchUserProfile(user), 100);
            setTimeout(() => fetchTokenBalance(user), 200);
          } else {
            setUser(null);
            setUserProfile(null);
            setIsCreator(false);
            setIsAdmin(false);
          }
        } catch (error) {
          console.error('Auth state change error:', error);
          // Only show error for actual failures, not for no session
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
      fetchUserProfile(user);
      fetchTokenBalance(user);
    }
  }, [user, fetchUserProfile, fetchTokenBalance, authLoading]);

  // Service initialization (from NewApp.js)
  useEffect(() => {
    const initializeServices = async () => {
      // Check dev mode on mount
      const devModeCreator = localStorage.getItem('devModeCreator');
      if (devModeCreator === 'true' && user) {
        setIsCreator(true);
      }
      
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

  // Socket.io connection
  useEffect(() => {
    if (!user) return;

    // Initialize Socket.io connection
    socketService.connect();

    // Subscribe to connection status
    const unsubConnection = socketService.on('connection-status', ({ connected }) => {
      setWebsocketConnected(connected);
    });

    // Cleanup on unmount or user change
    return () => {
      unsubConnection();
      socketService.disconnect();
    };
  }, [user]);

  // Real-time balance updates
  useBalance((newBalance) => {
    setTokenBalance(newBalance);
  });

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

  // Handle video call
  const handleStartVideoCall = (creator) => {
    // Store creator info if needed for the call
    if (creator) {
      sessionStorage.setItem('callCreator', JSON.stringify(creator));
    }
    navigate('/call/video');
  };

  // Handle voice call
  const handleStartVoiceCall = (creator) => {
    // Store creator info if needed for the call
    if (creator) {
      sessionStorage.setItem('callCreator', JSON.stringify(creator));
    }
    navigate('/call/voice');
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
      'connect': '/connect',
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
    navigate(path);
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
      setIsCreator(false);
      setIsAdmin(false);
      navigate('/explore');
      // toast.success('Signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
    }
  };

  // Handle auth
  const handleSignIn = () => {
    setAuthMode('signin');
    setShowAuth(true);
  };

  const handleSignUp = () => {
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

  // Loading state with modern skeleton
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-miami">
        <Skeleton.Navigation />
        <div className="container mx-auto py-8">
          <Skeleton.Grid items={6} columns={3} />
        </div>
      </div>
    );
  }

  // Auth state
  if (showAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-600">
        <div className="flex items-center justify-center">
          <div className="relative w-full max-w-md">
            <button
              onClick={() => setShowAuth(false)}
              className="absolute -top-10 left-0 text-white hover:text-gray-200 transition-colors"
            >
              ← Back to landing
            </button>
            {isMobile ? (
              <MobileOptimizedAuth 
                mode={authMode}
                onLogin={(user) => {
                  setUser(user);
                  setShowAuth(false);
                }}
              />
            ) : (
              <Auth 
                mode={authMode}
                onLogin={(user) => {
                  setUser(user);
                  setShowAuth(false);
                }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Handle creator profiles - accessible to both logged in and logged out users
  if (viewingCreator) {
    return (
      <CreatorPublicProfile
        user={user}
        username={viewingCreator}
        onAuthRequired={handleSignIn}
      />
    );
  }

  // Public routing - show HomePage or Auth based on route
  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    );
  }

  // Handle creator viewing for recently viewed service
  const handleCreatorView = (creator) => {
    // Track in recently viewed
    recentlyViewedService.addCreator(creator);
    // Handle the original click logic
    setViewingCreator(creator.username || creator.id);
  };

  return (
    <ContentProvider>
      <ErrorBoundary>
        <div className="min-h-screen relative bg-gray-50 dark:bg-gray-900 transition-colors">
            <Toaster
        position="top-right"
        toastOptions={{
          duration: 6000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />

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
                setTokenBalance(prev => prev + tokensAdded);
                setShowTokenPurchase(false);
                // toast.success(`✅ ${tokensAdded} tokens added to your account!`);
              }}
              onClose={() => setShowTokenPurchase(false)}
              isModal={true}
            />
          </ErrorBoundary>
        </div>
      )}

      {/* Creator Studio Modal */}
      {showCreatorStudio && (
        <CreatorStudio
          user={userProfile || user}
          onClose={() => setShowCreatorStudio(false)}
          onShowGoLive={() => setShowGoLiveSetup(true)}
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

      {/* Go Live Setup Modal */}
      {showGoLiveSetup && (
        <GoLiveSetup
          user={user}
          onCancel={() => setShowGoLiveSetup(false)}
          onGoLive={async (config) => {
            setStreamConfig(config);
            setCurrentView('streaming');
            setShowGoLiveSetup(false);
            setStreamNotificationConfig(config);
            setShowStreamNotification(true);
          }}
        />
      )}

      {/* Token Tipping Modal */}
      {showTokenTipping && tippingRecipient && (
        <TokenTipping
          recipient={tippingRecipient}
          userTokenBalance={tokenBalance}
          onClose={() => {
            setShowTokenTipping(false);
            setTippingRecipient(null);
          }}
          onSuccess={() => {
            setShowTokenTipping(false);
            setTippingRecipient(null);
            fetchTokenBalance();
            // toast.success('🎉 Tip sent successfully!');
          }}
        />
      )}

      {/* Header - Hidden on mobile */}
      {!isMobile && (
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 sticky top-0 z-40 backdrop-blur-md bg-white/90 dark:bg-gray-800/90">
        <div className="flex items-center justify-between">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <img 
              src="/digis-logo-black.png" 
              alt="Digis" 
              className="h-8 w-auto cursor-pointer transition-transform hover:scale-105"
              onClick={() => setCurrentView('explore')}
            />
          </div>

          {/* Navigation */}
          <ResponsiveNavigation
            currentView={currentView}
            setCurrentView={setCurrentView}
            isCreator={isCreator}
            isAdmin={isAdmin}
            tokenBalance={tokenBalance}
            user={user}
            onShowCreatorStudio={() => setShowCreatorStudio(true)}
            onTokenPurchase={() => setShowTokenPurchase(true)}
            onSignOut={handleSignOut}
          />
        </div>
      </header>
      )}

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div className="text-red-700">
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
        onRefresh={async () => {
          await fetchTokenBalance();
          // toast.success('Content refreshed!');
        }}
        refreshMessage="Pull to refresh"
        releaseMessage="Release to refresh"
        refreshingMessage="Refreshing content..."
      >
        <main className={isMobile ? 'pb-24' : 'p-6'}>
        {currentView === 'profile' ? (
          isMobile ? (
            <MobileProfile 
              user={user} 
              isCreator={isCreator} 
              onSignOut={handleSignOut}
              onEditProfile={() => toast.info('Edit profile coming soon!')}
              onBecomeCreator={() => setShowCreatorApplication(true)}
            />
          ) : (
            <ImprovedProfile user={user} isCreator={isCreator} />
          )
        ) : currentView === 'admin' ? (
          <AdminDashboard user={user} />
        ) : currentView === 'history' ? (
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">📊 Session History</h2>
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
          isCreator ? (
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
            />
          ) : (
            <StreamingLayout
              user={user}
              channel={channel}
              token={token}
              chatToken={chatToken}
              uid={sessionUid}
              isCreator={isCreator}
              isHost={true}
              isStreaming={true}
              streamConfig={streamConfig}
              onSessionEnd={() => {
                setChannel('');
                setStreamConfig(null);
              }}
            />
          )
        ) : currentView === 'subscriptions' ? (
          <CreatorSubscriptions
            user={user}
            isCreator={isCreator}
            tokenBalance={tokenBalance}
            onTokenUpdate={fetchTokenBalance}
          />
        ) : currentView === 'following' ? (
          <FollowingSystem 
            user={user}
            onCreatorSelect={(creator) => {
              setViewingCreator(creator.username || creator.creator);
            }}
          />
        ) : currentView === 'creator-studio' ? (
          <CreatorStudio 
            user={userProfile || user}
            onClose={() => navigate('/dashboard')}
            onShowGoLive={() => setShowGoLiveSetup(true)}
          />
        ) : currentView === 'dashboard' ? (
          <DashboardPage 
            user={user}
            isCreator={isCreator}
            isAdmin={isAdmin}
            tokenBalance={tokenBalance}
            sessionStats={sessionStats}
            onShowAvailability={() => setShowAvailabilityCalendar(true)}
            onShowGoLive={() => setShowGoLiveSetup(true)}
            onCreatorSelect={handleCreatorView}
            onTipCreator={handleTipCreator}
            onStartVideoCall={handleStartVideoCall}
            onStartVoiceCall={handleStartVoiceCall}
            onShowEarnings={() => setCurrentView('wallet')}
            onShowContent={() => setCurrentView('content')}
            onShowOffers={() => setCurrentView('offers')}
            onShowSettings={() => setShowPrivacySettings(true)}
            onShowExperiences={() => {
              navigate('/connect?section=experiences');
              setCurrentView('connect');
            }}
          />
        ) : currentView === 'explore' ? (
          <ExplorePage
            user={user}
            onCreatorSelect={handleCreatorView}
            onTipCreator={handleTipCreator}
            onStartVideoCall={handleStartVideoCall}
            onStartVoiceCall={handleStartVoiceCall}
            onScheduleSession={(creator) => {
              sessionStorage.setItem('scheduleCreator', JSON.stringify(creator));
              navigate('/schedule');
            }}
            onSendMessage={(creator) => {
              sessionStorage.setItem('messageCreator', JSON.stringify(creator));
              navigate('/messages');
            }}
            onMakeOffer={(creator) => {
              sessionStorage.setItem('offerCreator', JSON.stringify(creator));
              navigate('/offers');
            }}
          />
        ) : currentView === 'tv' ? (
          <TVPage
            user={user}
            tokenBalance={tokenBalance}
            onTokenPurchase={() => setShowTokenPurchase(true)}
            onJoinStream={(stream) => {
              // Handle joining a stream
              handleCreatorView(stream.creatorId);
              // toast.success(`Joining ${stream.creatorName}'s stream...`);
            }}
            onGoLive={() => setShowGoLiveSetup(true)}
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
        ) : currentView === 'wallet' ? (
          <Wallet 
            user={user}
            tokenBalance={tokenBalance}
            onTokenUpdate={fetchTokenBalance}
            onViewProfile={(username) => setViewingCreator(username)}
            onTokenPurchase={() => setShowTokenPurchase(true)}
            isCreator={isCreator}
          />
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
        ) : currentView === 'content' ? (
          <EnhancedContentStudio 
            user={user}
          />
        ) : currentView === 'offers' ? (
          <OffersManagement 
            user={user}
          />
        ) : currentView === 'connect' ? (
          <ConnectPage 
            user={user}
            isCreator={isCreator}
          />
        ) : currentView === 'supabase-test' ? (
          <SupabaseTestPage />
        ) : (
          <div className="space-y-8">
            <DashboardPage 
              user={user}
              isCreator={isCreator}
              isAdmin={isAdmin}
              tokenBalance={tokenBalance}
              sessionStats={sessionStats}
              onShowAvailability={() => setShowAvailabilityCalendar(true)}
              onShowGoLive={() => setShowGoLiveSetup(true)}
              onCreatorSelect={handleCreatorView}
              onTipCreator={handleTipCreator}
              onStartVideoCall={handleStartVideoCall}
              onStartVoiceCall={handleStartVoiceCall}
              onShowEarnings={() => setCurrentView('wallet')}
              onShowContent={() => setCurrentView('content')}
              onShowOffers={() => setCurrentView('offers')}
              onShowSettings={() => setShowPrivacySettings(true)}
              onShowExperiences={() => {
                navigate('/connect?section=experiences');
                setCurrentView('connect');
              }}
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

      {/* Incoming Call Notification */}
      {incomingCall && (
        <IncomingCallNotification
          call={incomingCall}
          user={user}
          onAccept={() => {
            // Handle call acceptance
            setChannel(incomingCall.channel);
            setToken(incomingCall.token);
            setIncomingCall(null);
          }}
          onReject={() => {
            setIncomingCall(null);
          }}
        />
      )}

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
      
      {/* Mobile Navigation */}
      {isMobile && (
        <>
          <EnhancedMobileNavigation 
            user={user}
            unreadMessages={0}
            currentView={currentView}
            setCurrentView={setCurrentView}
            onShowCreatorStudio={() => setShowCreatorStudio(true)}
            onTokenPurchase={() => setShowTokenPurchase(true)}
            onGoLive={() => setShowGoLiveSetup(true)}
          />
          
          {/* Floating Action Button - Commented out to avoid blocking send button
          <FloatingActionButton 
            onVideoCall={() => setChannel('video_' + Date.now())}
            onVoiceCall={() => setChannel('voice_' + Date.now())}
            onChat={() => setCurrentView('messages')}
            onGoLive={() => setShowGoLiveSetup(true)}
          />
          */}
        </>
      )}
        
        {/* Live Stream Notification - Show for all users */}
        <LiveStreamNotification
          isVisible={showStreamNotification}
          onClose={() => setShowStreamNotification(false)}
          streamConfig={streamNotificationConfig}
        />
      </div>
    </ErrorBoundary>
    </ContentProvider>
  );
};

export default App;