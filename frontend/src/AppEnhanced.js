import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './utils/supabase-auth.js';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';

// Core components
import Auth from './components/Auth';
import ImprovedProfile from './components/ImprovedProfile';
import VideoCall from './components/VideoCall';
import EnhancedSchedule from './components/EnhancedSchedule';
import FanEngagement from './components/FanEngagement';
import EnhancedPublicLanding from './components/EnhancedPublicLanding';
import PublicCreatorProfile from './components/PublicCreatorProfile';
import CreatorStudio from './components/CreatorStudio';
import EnhancedCreatorDiscovery from './components/EnhancedCreatorDiscovery';
import PrivacySettings from './components/PrivacySettings';
import CreatorApplication from './components/CreatorApplication';
import GoLiveSetup from './components/GoLiveSetup';
import TokenTipping from './components/TokenTipping';
import Wallet from './components/Wallet';
import AdminDashboard from './components/AdminDashboard';

// Page components
import DashboardPage from './components/pages/DashboardPage';
import MessagesPage from './components/pages/MessagesPage';

// Navigation and UI components
import ResponsiveNavigation from './components/navigation/ResponsiveNavigation';
import ImprovedTokenPurchase from './components/ImprovedTokenPurchase';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { useBalance } from './hooks/useSocket';

import './index.css';

const AppEnhanced = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Auth state
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [isCreator, setIsCreator] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // App state
  const [channel, setChannel] = useState('');
  const [currentView, setCurrentView] = useState('explore');
  const [error, setError] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [viewingCreator, setViewingCreator] = useState(null);
  
  // Token state
  const [tokenBalance, setTokenBalance] = useState(0);
  
  // Modal states
  const [showTokenPurchase, setShowTokenPurchase] = useState(false);
  const [showCreatorStudio, setShowCreatorStudio] = useState(false);
  const [showCreatorDiscovery, setShowCreatorDiscovery] = useState(false);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [showCreatorApplication, setShowCreatorApplication] = useState(false);
  const [showGoLiveSetup, setShowGoLiveSetup] = useState(false);
  const [showTokenTipping, setShowTokenTipping] = useState(false);
  const [showAvailabilityCalendar, setShowAvailabilityCalendar] = useState(false);
  const [showFanEngagement, setShowFanEngagement] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showGoLive, setShowGoLive] = useState(false);
  const [showContentStudio, setShowContentStudio] = useState(false);
  const [showOffers, setShowOffers] = useState(false);
  
  const [tippingRecipient, setTippingRecipient] = useState(null);
  const [token, setToken] = useState('');
  const [sessionUid] = useState('');
  const [chatToken] = useState('');

  // Fetch user profile
  const fetchUserProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${user.access_token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
        setIsCreator(data.profile?.is_creator || false);
        setIsAdmin(data.profile?.email === 'admin@digis.com');
        setTokenBalance(data.profile?.token_balance || 0);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }, [user]);

  // Fetch token balance
  const fetchTokenBalance = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tokens/balance`, {
        headers: {
          'Authorization': `Bearer ${user.access_token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTokenBalance(data.balance || 0);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  }, [user]);

  // Initialize auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch profile when user changes
  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchTokenBalance();
    }
  }, [user, fetchUserProfile, fetchTokenBalance]);

  // Use the balance hook for real-time updates
  const { balance: realtimeBalance } = useBalance(user);
  
  useEffect(() => {
    if (realtimeBalance !== null) {
      setTokenBalance(realtimeBalance);
    }
  }, [realtimeBalance]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    navigate('/');
  };

  const handleCreatorView = (creator) => {
    setViewingCreator(creator.username || creator.id);
  };

  const handleTipCreator = (creator) => {
    setTippingRecipient(creator);
    setShowTokenTipping(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Loading Digis...</h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
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
                currentBalance={tokenBalance}
                onClose={() => setShowTokenPurchase(false)}
                onSuccess={() => {
                  fetchTokenBalance();
                  setShowTokenPurchase(false);
                }}
              />
            </ErrorBoundary>
          </div>
        )}

        {/* Main Navigation - Always visible */}
        <ResponsiveNavigation
          user={user}
          profile={profile}
          isCreator={isCreator}
          tokenBalance={tokenBalance}
          currentView={currentView}
          onViewChange={setCurrentView}
          onSignOut={handleSignOut}
          onShowCreatorStudio={() => setShowCreatorStudio(true)}
          onShowCreatorDiscovery={() => setShowCreatorDiscovery(true)}
          onShowPrivacySettings={() => setShowPrivacySettings(true)}
          onShowTokenPurchase={() => setShowTokenPurchase(true)}
          onShowGoLive={() => setShowGoLiveSetup(true)}
          onShowSchedule={() => setShowAvailabilityCalendar(true)}
        />

        {/* Main Content */}
        <main className="pt-16">
          <Routes>
            <Route path="/" element={
              user ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <EnhancedPublicLanding 
                  onSignIn={() => {
                    setAuthMode('signin');
                    setShowAuth(true);
                  }}
                  onSignUp={() => {
                    setAuthMode('signup');
                    setShowAuth(true);
                  }}
                />
              )
            } />
            
            <Route path="/dashboard" element={
              user ? (
                <DashboardPage
                  user={user}
                  profile={profile}
                  isCreator={isCreator}
                  isAdmin={isAdmin}
                  tokenBalance={tokenBalance}
                  onCreatorSelect={handleCreatorView}
                  onCreatorView={handleCreatorView}
                  onTokenPurchase={() => setShowTokenPurchase(true)}
                  onTipCreator={handleTipCreator}
                  onShowAvailability={() => setShowSchedule(true)}
                  onShowGoLive={() => setShowGoLive(true)}
                  onStartVideoCall={(creator) => {
                    console.log('Start video call with:', creator);
                    // TODO: Implement video call logic
                  }}
                  onStartVoiceCall={(creator) => {
                    console.log('Start voice call with:', creator);
                    // TODO: Implement voice call logic
                  }}
                  onShowEarnings={() => navigate('/wallet')}
                  onShowContent={() => setShowContentStudio(true)}
                  onShowOffers={() => setShowOffers(true)}
                  onShowSettings={() => navigate('/profile')}
                  onShowExperiences={() => navigate('/connect?section=experiences')}
                />
              ) : (
                <Navigate to="/" replace />
              )
            } />
            
            <Route path="/messages" element={
              user ? (
                <MessagesPage user={user} profile={profile} />
              ) : (
                <Navigate to="/" replace />
              )
            } />
            
            <Route path="/profile" element={
              user ? (
                <ImprovedProfile
                  user={user}
                  profile={profile}
                  isCreator={isCreator}
                  onProfileUpdate={fetchUserProfile}
                />
              ) : (
                <Navigate to="/" replace />
              )
            } />
            
            <Route path="/wallet" element={
              user ? (
                <Wallet user={user} />
              ) : (
                <Navigate to="/" replace />
              )
            } />
            
            <Route path="/creator/:username" element={
              <PublicCreatorProfile 
                viewingUser={user}
                onStartSession={(creator) => {
                  if (!user) {
                    setShowAuth(true);
                  } else {
                    // Start session logic
                    console.log('Starting session with:', creator);
                  }
                }}
              />
            } />
            
            {isAdmin && (
              <Route path="/admin" element={<AdminDashboard user={user} />} />
            )}
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Auth Modal */}
        {showAuth && !user && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Auth
              mode={authMode}
              onClose={() => setShowAuth(false)}
              onSuccess={() => {
                setShowAuth(false);
                navigate('/dashboard');
              }}
            />
          </div>
        )}

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

        {/* Creator Studio Modal */}
        {showCreatorStudio && (
          <CreatorStudio
            user={user}
            onClose={() => setShowCreatorStudio(false)}
          />
        )}

        {/* Creator Discovery Modal */}
        {showCreatorDiscovery && (
          <EnhancedCreatorDiscovery
            user={user}
            onCreatorSelect={handleCreatorView}
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
            user={user}
            onClose={() => setShowCreatorApplication(false)}
            onSuccess={() => {
              setShowCreatorApplication(false);
              fetchUserProfile();
            }}
          />
        )}

        {/* Go Live Setup Modal */}
        {showGoLiveSetup && (
          <GoLiveSetup
            user={user}
            onClose={() => setShowGoLiveSetup(false)}
            onStartStream={(config) => {
              console.log('Starting stream with config:', config);
              setShowGoLiveSetup(false);
            }}
          />
        )}

        {/* Token Tipping Modal */}
        {showTokenTipping && tippingRecipient && (
          <TokenTipping
            user={user}
            recipient={tippingRecipient}
            currentBalance={tokenBalance}
            onClose={() => {
              setShowTokenTipping(false);
              setTippingRecipient(null);
            }}
            onSuccess={() => {
              fetchTokenBalance();
              setShowTokenTipping(false);
              setTippingRecipient(null);
            }}
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
            onCreatorSelect={handleCreatorView}
            onClose={() => setShowFanEngagement(false)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default AppEnhanced;