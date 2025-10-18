import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase, subscribeToAuthChanges } from './utils/supabase-auth.js';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { ContentProvider } from './contexts/ContentContext';
import { useMediaQuery } from './hooks/useMediaQuery';
import { fetchWithRetry, validateEnvVars } from './utils/fetchWithRetry';
import { useAppStore } from './stores/useAppStore';

// Validate environment variables on app start
try {
  validateEnvVars();
} catch (error) {
// console.error('Environment configuration error:', error);
}

// Regular imports (non-heavy components)
import Auth from './components/Auth';
import ImprovedProfile from './components/ImprovedProfile';
import HomePage from './components/HomePage';
import EnhancedPublicLanding from './components/EnhancedPublicLanding';
import PublicCreatorProfile from './components/PublicCreatorProfile';
import CreatorPublicProfile from './components/CreatorPublicProfile';
import PrivacySettings from './components/PrivacySettings';
import CreatorApplication from './components/CreatorApplication';
import Skeleton from './components/ui/Skeleton';
import Wallet from './components/Wallet';
import InstantChatWidget from './components/InstantChatWidget';
import ResponsiveNavigation from './components/navigation/ResponsiveNavigation';
import PullToRefresh from './components/ui/PullToRefresh';
import ErrorBoundary from './components/ui/ErrorBoundary';
import RecentlyViewedCreators from './components/RecentlyViewedCreators';
import ImprovedTokenPurchase from './components/ImprovedTokenPurchase';
import RealTimeNotifications from './components/RealTimeNotifications';
import IncomingCallNotification from './components/IncomingCallNotification';
import ExplorePage from './components/pages/ExplorePage';
import TVPage from './components/pages/TVPage';
import ConnectPage from './components/pages/ConnectPage';
import SupabaseTestPage from './components/SupabaseTestPage';

// Lazy load heavy components
const VideoCall = lazy(() => import('./components/VideoCall'));
const StreamingLayout = lazy(() => import('./components/StreamingLayout'));
const StreamingDashboard = lazy(() => import('./components/StreamingDashboard'));
const CreatorStudio = lazy(() => import('./components/CreatorStudio'));
const EnhancedCreatorDiscovery = lazy(() => import('./components/EnhancedCreatorDiscovery'));
const CreatorSubscriptions = lazy(() => import('./components/CreatorSubscriptions'));
const EnhancedSchedule = lazy(() => import('./components/EnhancedSchedule'));
const FanEngagement = lazy(() => import('./components/FanEngagement'));
const GoLiveSetup = lazy(() => import('./components/GoLiveSetup'));
const TokenTipping = lazy(() => import('./components/TokenTipping'));
const FollowingSystem = lazy(() => import('./components/FollowingSystem'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const DashboardPage = lazy(() => import('./components/pages/DashboardPage'));
const ClassesPage = lazy(() => import('./components/pages/ClassesPage'));
const MessagesPage = lazy(() => import('./components/pages/MessagesPage'));
const EnhancedContentStudio = lazy(() => import('./components/EnhancedContentStudio'));
// Removed OffersManagement - using Enhanced Content Gallery instead
const LiveStreamNotification = lazy(() => import('./components/LiveStreamNotification'));

// Mobile components (lazy loaded)
const MobileUIProvider = lazy(() => import('./components/mobile/MobileUIProvider').then(module => ({ default: module.MobileUIProvider })));
const MobileOptimizedAuth = lazy(() => import('./components/mobile/MobileOptimizedAuth'));
const FloatingActionButton = lazy(() => import('./components/mobile/FloatingActionButton'));
const MobileNavigationEnhanced = lazy(() => import('./components/navigation/MobileNavigationEnhanced'));
const MobileBottomSheet = lazy(() => import('./components/mobile/MobileBottomSheet'));
const MobileProfile = lazy(() => import('./components/mobile/MobileProfile'));
const MobileMessages = lazy(() => import('./components/mobile/MobileMessages'));
const NextLevelMobileApp = lazy(() => import('./components/mobile/NextLevelMobileApp'));
const SimpleMobileApp = lazy(() => import('./components/mobile/SimpleMobileApp'));

// Utilities
import recentlyViewedService from './utils/recentlyViewedService';
import serviceWorkerManager from './utils/ServiceWorkerManager';
import agoraLoader from './utils/AgoraLoader';
import socketService from '../services/socketServiceWrapper';
import { useBalance, useNotifications } from './hooks/useSocket';

// Loading component for lazy loaded components
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-900">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
      <p className="text-gray-400">Loading...</p>
    </div>
  </div>
);

const App = () => {
  // Mobile detection
  const isMobile = useMediaQuery('(max-width: 768px)');
  const navigate = useNavigate();
  const location = useLocation();
  
  // Zustand store
  const {
    user,
    userProfile,
    isCreator,
    isAdmin,
    tokenBalance,
    setUser,
    setUserProfile,
    updateTokenBalance,
    setError,
    clearError,
    reset
  } = useAppStore();
  
  // Local state
  const [authLoading, setAuthLoading] = useState(true);
  const [channel, setChannel] = useState('');
  const [currentView, setCurrentView] = useState('explore');
  
  // Public/Auth state
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [viewingCreator, setViewingCreator] = useState(null);
  
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

  // Real-time state
  const [incomingCall, setIncomingCall] = useState(null);
  const [websocketConnected, setWebsocketConnected] = useState(false);

  const modalRef = useRef(null);

  // Fetch user profile with retry logic
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
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/users/profile?uid=${currentUser.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      
      // Store the full user profile
      setUserProfile(data);
    } catch (error) {
// console.error('Error fetching user profile:', error);
      setError(`Failed to load user profile: ${error.message}`);
    } finally {
      fetchInProgress.current.profile = false;
    }
  }, [user, setUserProfile, setError]);

  // Fetch token balance with retry logic
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
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/tokens/balance`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      updateTokenBalance(data.balance || 0);
    } catch (error) {
// console.error('Error fetching token balance:', error);
      // Don't show error for balance fetch as it's not critical
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

  // Enhanced authentication state management
  useEffect(() => {
    let timeoutId;
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        if (session?.user && mounted) {
          setUser(session.user);
          clearError();
          setAuthLoading(false);
          
          // Stagger API calls to prevent overload
          setTimeout(() => {
            if (mounted) fetchUserProfile(session.user);
          }, 100);
          setTimeout(() => {
            if (mounted) fetchTokenBalance(session.user);
          }, 200);
        } else {
          setAuthLoading(false);
        }
      } catch (error) {
// console.error('Session initialization error:', error);
        setError('Failed to initialize session. Please try again.');
        setAuthLoading(false);
      }
    };

    initAuth();

    // Subscribe to auth changes
    const unsubscribe = subscribeToAuthChanges((event, session) => {
      if (!mounted) return;
      
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        clearError();
        
        // Clear any timeouts
        if (timeoutId) clearTimeout(timeoutId);
        
        // Fetch user data with delay
        timeoutId = setTimeout(() => {
          if (mounted) {
            fetchUserProfile(session.user);
            fetchTokenBalance(session.user);
          }
        }, 500);
      } else if (event === 'SIGNED_OUT') {
        // Reset all state
        reset();
        setAuthLoading(false);
        navigate('/');
      }
    });

    // Cleanup
    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [setUser, clearError, reset, navigate, fetchUserProfile, fetchTokenBalance]);

  // Initialize services
  useEffect(() => {
    if (user) {
      // Initialize WebSocket connection
      socketService.connect(user.id);
      socketService.on('connect', () => setWebsocketConnected(true));
      socketService.on('disconnect', () => setWebsocketConnected(false));

      // Service worker for PWA
      if ('serviceWorker' in navigator) {
        serviceWorkerManager.register();
      }

      // Preload Agora SDK
      agoraLoader.preload();

      return () => {
        socketService.disconnect();
      };
    }
  }, [user]);

  // Handle incoming notifications
  useEffect(() => {
    if (!user) return;

    const handleNotification = (notification) => {
      switch (notification.type) {
        case 'incoming_call':
          setIncomingCall(notification.data);
          break;
        case 'stream_started':
          // Using toast without emojis
          toast(`${notification.creatorName} just went live!`, {
            duration: 5000
          });
          break;
        case 'new_message':
          if (!window.location.pathname.includes('/messages')) {
            toast(notification.message, {
              duration: 4000
            });
          }
          break;
        default:
          break;
      }
    };

    socketService.on('notification', handleNotification);

    return () => {
      socketService.off('notification', handleNotification);
    };
  }, [user]);

  // Socket hooks
  const balance = useBalance(user?.id);
  const notifications = useNotifications(user?.id);

  // Update balance from socket
  useEffect(() => {
    if (balance !== null && balance !== tokenBalance) {
      updateTokenBalance(balance);
    }
  }, [balance, tokenBalance, updateTokenBalance]);

  // Common handler functions
  const handleCreatorClick = useCallback((creator) => {
    if (user) {
      navigate(`/creator/${creator.username}`);
      recentlyViewedService.addCreator(creator);
    } else {
      setViewingCreator(creator);
      setShowAuth(true);
      setAuthMode('signin');
    }
  }, [user, navigate]);

  const handleTipCreator = useCallback((creator) => {
    if (user) {
      setTippingRecipient(creator);
      setShowTokenTipping(true);
    } else {
      setShowAuth(true);
      setAuthMode('signin');
    }
  }, [user]);

  const handleStartVideoCall = useCallback((creator) => {
    if (user) {
      sessionStorage.setItem('callCreator', JSON.stringify({
        id: creator.id,
        username: creator.username,
        display_name: creator.display_name,
        avatar_url: creator.avatar_url,
        video_rate: creator.video_rate || 10,
        audio_rate: creator.audio_rate || 5
      }));
      navigate('/call/video');
    } else {
      setShowAuth(true);
      setAuthMode('signin');
    }
  }, [user, navigate]);

  const handleScheduleSession = useCallback((creator) => {
    if (user) {
      sessionStorage.setItem('scheduleCreator', JSON.stringify({
        id: creator.id,
        username: creator.username,
        display_name: creator.display_name,
        avatar_url: creator.avatar_url
      }));
      navigate('/schedule');
    } else {
      setShowAuth(true);
      setAuthMode('signin');
    }
  }, [user, navigate]);

  const handleGoLive = useCallback(() => {
    setShowGoLiveSetup(true);
  }, []);

  const handleStartStream = useCallback((config) => {
    setStreamConfig(config);
    setShowGoLiveSetup(false);
    navigate('/stream');
  }, [navigate]);

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading Digis...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ContentProvider>
        <MobileUIProvider>
          <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#1f2937',
                  color: '#fff',
                  borderRadius: '0.5rem',
                  border: '1px solid rgba(147, 51, 234, 0.3)',
                },
                success: {
                  iconTheme: {
                    primary: '#a855f7',
                    secondary: '#fff',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />

            {/* Navigation */}
            {user && !location.pathname.includes('/stream') && !location.pathname.includes('/call') && (
              <>
                {isMobile ? (
                  <MobileNavigationEnhanced 
                    isCreator={isCreator}
                    onGoLive={handleGoLive}
                  />
                ) : (
                  <ResponsiveNavigation
                    user={user}
                    isCreator={isCreator}
                    isAdmin={isAdmin}
                    currentView={currentView}
                    onViewChange={setCurrentView}
                    tokenBalance={tokenBalance}
                    onTokenPurchase={() => setShowTokenPurchase(true)}
                    notifications={notifications}
                  />
                )}
              </>
            )}

            {/* Main Content */}
            <PullToRefresh onRefresh={async () => {
              await Promise.all([
                fetchUserProfile(),
                fetchTokenBalance()
              ]);
            }}>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={
                    user ? <HomePage 
                      user={user}
                      isCreator={isCreator}
                      onCreatorClick={handleCreatorClick}
                      onTipCreator={handleTipCreator}
                      tokenBalance={tokenBalance}
                      onTokenPurchase={() => setShowTokenPurchase(true)}
                    /> : <EnhancedPublicLanding onGetStarted={() => {
                      setShowAuth(true);
                      setAuthMode('signup');
                    }} />
                  } />
                  
                  <Route path="/explore" element={<ExplorePage 
                    user={user}
                    onCreatorClick={handleCreatorClick}
                    onScheduleSession={handleScheduleSession}
                    onStartVideoCall={handleStartVideoCall}
                  />} />
                  
                  <Route path="/tv" element={<TVPage user={user} />} />
                  
                  <Route path="/connect" element={<ConnectPage 
                    user={user}
                    isCreator={isCreator}
                  />} />
                  
                  <Route path="/creator/:username" element={
                    <PublicCreatorProfile 
                      user={user}
                      onScheduleSession={handleScheduleSession}
                      onStartVideoCall={handleStartVideoCall}
                      tokenBalance={tokenBalance}
                      onTokenPurchase={() => setShowTokenPurchase(true)}
                    />
                  } />
                  
                  <Route path="/@:username" element={<CreatorPublicProfile />} />
                  
                  {/* Auth route */}
                  <Route path="/auth" element={
                    user ? <Navigate to="/" replace /> : <Auth />
                  } />
                  
                  {/* Protected routes */}
                  <Route path="/dashboard" element={
                    user ? <DashboardPage 
                      user={user}
                      userProfile={userProfile}
                      isCreator={isCreator}
                    /> : <Navigate to="/auth" replace />
                  } />
                  
                  <Route path="/profile" element={
                    user ? (
                      isMobile ? (
                        <MobileProfile user={user} userProfile={userProfile} />
                      ) : (
                        <ImprovedProfile user={user} userProfile={userProfile} />
                      )
                    ) : <Navigate to="/auth" replace />
                  } />
                  
                  <Route path="/wallet" element={
                    user ? <Wallet 
                      user={user}
                      tokenBalance={tokenBalance}
                      onPurchaseTokens={() => setShowTokenPurchase(true)}
                    /> : <Navigate to="/auth" replace />
                  } />
                  
                  <Route path="/messages" element={
                    user ? (
                      isMobile ? (
                        <MobileMessages user={user} />
                      ) : (
                        <MessagesPage user={user} isCreator={isCreator} />
                      )
                    ) : <Navigate to="/auth" replace />
                  } />
                  
                  <Route path="/classes" element={
                    user ? <ClassesPage user={user} isCreator={isCreator} /> : <Navigate to="/auth" replace />
                  } />
                  
                  <Route path="/schedule" element={
                    user ? <EnhancedSchedule user={user} isCreator={isCreator} /> : <Navigate to="/auth" replace />
                  } />
                  
                  <Route path="/subscriptions" element={
                    user ? <CreatorSubscriptions user={user} isCreator={isCreator} /> : <Navigate to="/auth" replace />
                  } />
                  
                  <Route path="/studio" element={
                    user && isCreator ? <CreatorStudio user={user} /> : <Navigate to="/" replace />
                  } />
                  
                  <Route path="/content-studio" element={
                    user && isCreator ? <EnhancedContentStudio user={user} /> : <Navigate to="/" replace />
                  } />
                  
                  <Route path="/offers" element={
                    // Offers are now managed in the Creator Dashboard
                    <Navigate to="/dashboard" replace />
                  } />
                  
                  <Route path="/call/video" element={
                    user ? <VideoCall 
                      user={user}
                      channel={channel}
                      token={token}
                      uid={sessionUid}
                      onTokenUpdate={fetchTokenBalance}
                    /> : <Navigate to="/auth" replace />
                  } />
                  
                  <Route path="/stream" element={
                    user && isCreator ? <StreamingLayout 
                      user={user}
                      streamConfig={streamConfig}
                      channel={channel}
                      token={token}
                      chatToken={chatToken}
                      sessionStats={sessionStats}
                    /> : <Navigate to="/" replace />
                  } />
                  
                  <Route path="/streaming-dashboard" element={
                    user && isCreator ? <StreamingDashboard user={user} /> : <Navigate to="/" replace />
                  } />
                  
                  <Route path="/fan-engagement" element={
                    user && isCreator ? <FanEngagement user={user} /> : <Navigate to="/" replace />
                  } />
                  
                  <Route path="/apply" element={
                    user ? <CreatorApplication user={user} onSuccess={() => {
                      setShowCreatorApplication(false);
                      fetchUserProfile();
                    }} /> : <Navigate to="/auth" replace />
                  } />
                  
                  <Route path="/privacy" element={<PrivacySettings user={user} />} />
                  
                  <Route path="/admin" element={
                    user && isAdmin ? <AdminDashboard user={user} /> : <Navigate to="/" replace />
                  } />
                  
                  <Route path="/test/supabase" element={<SupabaseTestPage />} />
                  
                  {/* Catch all route */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </PullToRefresh>

            {/* Modals */}
            {showAuth && !user && (
              <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setShowAuth(false);
                    setViewingCreator(null);
                  }
                }}
              >
                {isMobile ? (
                  <MobileOptimizedAuth
                    mode={authMode}
                    onSuccess={() => {
                      setShowAuth(false);
                      if (viewingCreator) {
                        navigate(`/creator/${viewingCreator.username}`);
                        setViewingCreator(null);
                      }
                    }}
                    onClose={() => {
                      setShowAuth(false);
                      setViewingCreator(null);
                    }}
                    onToggleMode={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                  />
                ) : (
                  <Auth
                    mode={authMode}
                    onSuccess={() => {
                      setShowAuth(false);
                      if (viewingCreator) {
                        navigate(`/creator/${viewingCreator.username}`);
                        setViewingCreator(null);
                      }
                    }}
                    onClose={() => {
                      setShowAuth(false);
                      setViewingCreator(null);
                    }}
                    onToggleMode={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                  />
                )}
              </div>
            )}

            {showTokenPurchase && (
              <div
                ref={modalRef}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                role="dialog"
                aria-labelledby="token-purchase-title"
                aria-modal="true"
                onClick={(e) => e.target === e.currentTarget && setShowTokenPurchase(false)}
              >
                <ImprovedTokenPurchase
                  user={user}
                  onSuccess={(tokensAdded) => {
                    updateTokenBalance(tokenBalance + tokensAdded);
                    setShowTokenPurchase(false);
                    toast.success(`Successfully purchased ${tokensAdded} tokens!`);
                  }}
                  onClose={() => setShowTokenPurchase(false)}
                  isModal={true}
                />
              </div>
            )}

            {/* Other modals with lazy loading */}
            {showGoLiveSetup && isCreator && (
              <Suspense fallback={<LoadingFallback />}>
                <GoLiveSetup
                  user={user}
                  onStart={handleStartStream}
                  onClose={() => setShowGoLiveSetup(false)}
                />
              </Suspense>
            )}

            {showTokenTipping && tippingRecipient && (
              <Suspense fallback={<LoadingFallback />}>
                <TokenTipping
                  user={user}
                  recipient={tippingRecipient}
                  tokenBalance={tokenBalance}
                  onSuccess={(amount) => {
                    updateTokenBalance(tokenBalance - amount);
                    setShowTokenTipping(false);
                    setTippingRecipient(null);
                    toast.success(`Tipped ${amount} tokens successfully!`);
                  }}
                  onClose={() => {
                    setShowTokenTipping(false);
                    setTippingRecipient(null);
                  }}
                />
              </Suspense>
            )}

            {/* Notifications */}
            {user && (
              <>
                <RealTimeNotifications user={user} />
                {incomingCall && (
                  <IncomingCallNotification
                    call={incomingCall}
                    onAccept={() => {
                      sessionStorage.setItem('callCreator', JSON.stringify(incomingCall.creator));
                      navigate('/call/video');
                      setIncomingCall(null);
                    }}
                    onDecline={() => setIncomingCall(null)}
                  />
                )}
                {showStreamNotification && streamNotificationConfig && (
                  <Suspense fallback={null}>
                    <LiveStreamNotification
                      creatorName={streamNotificationConfig.creatorName}
                      streamTitle={streamNotificationConfig.streamTitle}
                      thumbnailUrl={streamNotificationConfig.thumbnailUrl}
                      onJoin={() => {
                        navigate(`/stream/${streamNotificationConfig.streamId}`);
                        setShowStreamNotification(false);
                      }}
                      onDismiss={() => setShowStreamNotification(false)}
                    />
                  </Suspense>
                )}
              </>
            )}

            {/* Mobile FAB */}
            {user && isMobile && (
              <Suspense fallback={null}>
                <FloatingActionButton
                  isCreator={isCreator}
                  onGoLive={handleGoLive}
                  onTokenPurchase={() => setShowTokenPurchase(true)}
                />
              </Suspense>
            )}

            {/* Instant Chat Widget */}
            {user && !isMobile && (
              <InstantChatWidget user={user} />
            )}
          </div>
        </MobileUIProvider>
      </ContentProvider>
    </ErrorBoundary>
  );
};

export default App;