import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './utils/supabase-auth.js';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';

// Import main components
import MainNavigation from './components/MainNavigation';
import AppRouter from './components/AppRouter';
import Auth from './components/Auth';
import HomePage from './components/HomePage';
import PublicCreatorProfile from './components/PublicCreatorProfile';
import VirtualGifts from './components/VirtualGifts';
import GoLiveSetup from './components/GoLiveSetup';
import TokenTipping from './components/TokenTipping';
import SmartBalanceNotifications from './components/SmartBalanceNotifications';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import RealTimeNotifications from './components/RealTimeNotifications';
import FeatureDiscovery from './components/FeatureDiscovery';
import CreatorDirectory from './components/CreatorDirectory';
import IncomingCallNotification from './components/IncomingCallNotification';

// Import utilities
import serviceWorkerManager from './utils/ServiceWorkerManager';
import agoraLoader from './utils/AgoraLoader';

const AppContent = () => {
  // Core state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  // UI state
  const [error, setError] = useState(null);

  // Public/Auth state
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [viewingCreator, setViewingCreator] = useState(null);

  // Token economy state
  const [tokenBalance, setTokenBalance] = useState(0);

  // Modal states (for components that still need modals)
  const [showGifts, setShowGifts] = useState(false);
  const [showGoLiveSetup, setShowGoLiveSetup] = useState(false);
  const [showTokenTipping, setShowTokenTipping] = useState(false);
  const [showCreatorDirectory, setShowCreatorDirectory] = useState(false);
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  const [tippingRecipient, setTippingRecipient] = useState(null);
  const [sessionType, setSessionType] = useState(null); // 'video' or 'voice'
  const [incomingCallRequest, setIncomingCallRequest] = useState(null);

  // Session state
  const [sessionStats] = useState({
    totalSessions: 0,
    totalEarnings: 0,
    totalSpent: 0,
    activeUsers: 0,
  });

  // WebSocket state
  const [ws, setWs] = useState(null);

  // Agora state (simplified)
  const [channel, setChannel] = useState('');

  // Add notification helper
  const addNotification = useCallback((message, type = 'info') => {
    toast[type](message);
  }, []);

  // Reset all states
  const resetAllStates = useCallback(() => {
    setIsCreator(false);
    setIsAdmin(false);
    setTokenBalance(0);
    setChannel('');
    if (ws) {
      ws.close();
      setWs(null);
    }
  }, [ws]);

  // Fetch user profile and role
  const fetchUserProfile = useCallback(async () => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseToken = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/profile`, {
        headers: {
          Authorization: `Bearer ${supabaseToken}`,
        },
      });

      if (response.ok) {
        const profile = await response.json();
        setIsCreator(profile.is_creator || false);
        setIsAdmin(profile.is_super_admin || false);
      }
    } catch (error) {
// console.error('❌ Failed to fetch user profile:', error);
    }
  }, [user]);

  // Fetch token balance
  const fetchTokenBalance = useCallback(async () => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseToken = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/tokens/balance`, {
        headers: {
          Authorization: `Bearer ${supabaseToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTokenBalance(data.balance || 0);
      }
    } catch (error) {
// console.error('❌ Failed to fetch token balance:', error);
    }
  }, [user]);

  // Initialize WebSocket connection
  const initializeWebSocket = useCallback(() => {
    if (!user || ws) return;

    try {
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
      const websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        setWs(websocket);
        
        // Send authentication message
        websocket.send(JSON.stringify({
          type: 'auth',
          userId: user.id,
          isCreator: isCreator
        }));
      };

      websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'incoming_call':
              // Handle incoming call notification
              if (isCreator && message.data) {
                setIncomingCallRequest(message.data);
                setShowIncomingCall(true);
                addNotification(`Incoming ${message.data.sessionType} call from @${message.data.fanUsername}`, 'info');
              }
              break;
              
            case 'call_accepted':
              // Handle call acceptance notification for fans
              if (!isCreator && message.data) {
                addNotification(`@${message.data.creatorUsername} accepted your call!`, 'success');
                // Navigate to call room
                navigate(`/call/${message.data.sessionType}/${message.data.channelName}`);
              }
              break;
              
            case 'call_declined':
              // Handle call decline notification for fans
              if (!isCreator && message.data) {
                addNotification(`@${message.data.creatorUsername} declined your call`, 'error');
              }
              break;
              
            case 'notification':
              // Generic notification
              addNotification(message.message, message.level || 'info');
              break;
              
            default:
          }
        } catch (error) {
// console.error('Error parsing WebSocket message:', error);
        }
      };

      websocket.onclose = () => {
        setWs(null);
      };

      websocket.onerror = (error) => {
// console.error('❌ WebSocket error:', error);
      };
    } catch (error) {
// console.error('❌ WebSocket initialization error:', error);
    }
  }, [user, ws, isCreator, navigate, addNotification]);

  // Initialize authentication listener
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      const supabaseUser = session?.user;
      setUser(supabaseUser);
      if (supabaseUser) {
        await fetchUserProfile();
        await fetchTokenBalance();
        initializeWebSocket();
      } else {
        resetAllStates();
      }
      setAuthLoading(false);
    });

    return () => authListener.subscription.unsubscribe();
  }, [fetchUserProfile, fetchTokenBalance, initializeWebSocket, resetAllStates]);

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        await serviceWorkerManager.initialize();
        await agoraLoader.initialize();
      } catch (error) {
// console.error('❌ Service initialization error:', error);
      }
    };

    initializeServices();
  }, []);

  // Authentication handlers
  const handleSignIn = useCallback(() => {
    setAuthMode('signin');
    setShowAuth(true);
  }, []);

  const handleSignUp = useCallback(() => {
    setAuthMode('signup');
    setShowAuth(true);
  }, []);

  const handleCreatorClick = useCallback((creator) => {
    setViewingCreator(creator.username || creator.creator);
  }, []);

  const handleBackToLanding = useCallback(() => {
    setViewingCreator(null);
  }, []);

  // Add keyboard shortcut to exit fan view
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Press 'Escape' to exit fan view
      if (e.key === 'Escape' && viewingCreator) {
        setViewingCreator(null);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [viewingCreator]);

  const handleJoinPrivateSession = useCallback((sessionData) => {
    if (!user) {
      handleSignIn();
      return;
    }
    // Handle private session joining
  }, [user, handleSignIn]);

  const handleTipCreator = useCallback((creator) => {
    if (!user) {
      handleSignIn();
      return;
    }
    setTippingRecipient(creator);
    setShowTokenTipping(true);
  }, [user, handleSignIn]);

  // Navigation helpers
  const handleStartVideoCall = useCallback(() => {
    if (!user) {
      handleSignIn();
      return;
    }
    
    // For non-creator fans, show creator directory
    if (!isCreator) {
      setSessionType('video');
      setShowCreatorDirectory(true);
      return;
    }
    
    // For creators, navigate directly to host a session
    navigate('/call/video/general');
  }, [user, isCreator, navigate, handleSignIn]);

  const handleStartVoiceCall = useCallback(() => {
    if (!user) {
      handleSignIn();
      return;
    }
    
    // For non-creator fans, show creator directory
    if (!isCreator) {
      setSessionType('voice');
      setShowCreatorDirectory(true);
      return;
    }
    
    // For creators, navigate directly to host a session
    navigate('/call/voice/general');
  }, [user, isCreator, navigate, handleSignIn]);

  const handleGoLive = useCallback(() => {
    if (!user) {
      handleSignIn();
      return;
    }
    if (!isCreator) {
      navigate('/apply');
      return;
    }
    setShowGoLiveSetup(true);
  }, [user, isCreator, navigate, handleSignIn]);

  // Handle creator selection from directory
  const handleCreatorSelect = useCallback((creator, selectedSessionType, callRequestId) => {
    
    // Navigate to the selected creator's session
    const creatorId = creator.username || creator.id || creator.supabase_id;
    
    if (callRequestId) {
      // This is a call request, wait for creator response
      navigate(`/call/waiting/${callRequestId}`);
    } else {
      // Direct navigation
      navigate(`/call/${selectedSessionType}/${creatorId}`);
    }
    
    // Close the directory
    setShowCreatorDirectory(false);
    setSessionType(null);
    
    // toast.success(`Starting ${selectedSessionType} call with @${creatorId}!`);
  }, [navigate]);

  // Handle accepting incoming call
  const handleAcceptCall = useCallback(async (callRequest) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/sessions/call-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          callRequestId: callRequest.callRequestId,
          action: 'accept',
          channelName: `call_${Date.now()}`,
          sessionId: `session_${Date.now()}`
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Send WebSocket notification to fan
        if (ws) {
          ws.send(JSON.stringify({
            type: 'call_accepted',
            targetUserId: callRequest.fanId,
            data: {
              creatorUsername: user.displayName || 'Creator',
              sessionType: callRequest.sessionType,
              channelName: data.channelName,
              sessionId: data.sessionId
            }
          }));
        }

        // Navigate to call room
        navigate(`/call/${callRequest.sessionType}/${data.channelName}`);
        
        return true;
      } else {
        throw new Error('Failed to accept call');
      }
    } catch (error) {
// console.error('Error accepting call:', error);
      addNotification('Failed to accept call', 'error');
      return false;
    }
  }, [user, ws, navigate, addNotification]);

  // Handle declining incoming call
  const handleDeclineCall = useCallback(async (callRequest) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/sessions/call-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          callRequestId: callRequest.callRequestId,
          action: 'decline'
        })
      });

      if (response.ok) {
        // Send WebSocket notification to fan
        if (ws) {
          ws.send(JSON.stringify({
            type: 'call_declined',
            targetUserId: callRequest.fanId,
            data: {
              creatorUsername: user.displayName || 'Creator',
              sessionType: callRequest.sessionType
            }
          }));
        }
        
        return true;
      } else {
        throw new Error('Failed to decline call');
      }
    } catch (error) {
// console.error('Error declining call:', error);
      addNotification('Failed to decline call', 'error');
      return false;
    }
  }, [user, ws, addNotification]);

  // Loading screen
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🎥</div>
          <img
            src="/digis-logo-black.png"
            alt="Digis"
            className="h-12 w-auto object-contain mb-2 mx-auto"
          />
          <div className="text-gray-600 mb-4">Loading your experience...</div>
          <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto"></div>
          <button
            onClick={() => setAuthLoading(false)}
            className="mt-6 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Skip Loading & Continue
          </button>
        </div>
      </div>
    );
  }

  // Show public content when not authenticated
  if (!user) {
    if (showAuth) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-600">
          <div className="relative w-full max-w-md">
            <button
              onClick={() => setShowAuth(false)}
              className="absolute -top-12 left-0 text-white hover:text-purple-200 flex items-center gap-2"
            >
              ← Back to Explore
            </button>
            <Auth 
              onLogin={setUser} 
              mode={authMode}
              onModeSwitch={setAuthMode}
            />
          </div>
        </div>
      );
    }

    if (viewingCreator) {
      return (
        <PublicCreatorProfile
          username={viewingCreator}
          onBack={handleBackToLanding}
          onSignIn={handleSignIn}
          onJoinPrivateSession={handleJoinPrivateSession}
        />
      );
    }

    return (
      <HomePage
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onCreatorClick={handleCreatorClick}
        onTipCreator={handleTipCreator}
      />
    );
  }

  // Main authenticated app
  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          className: 'rounded-xl',
        }}
      />

      {/* Navigation */}
      <MainNavigation
        user={user}
        isCreator={isCreator}
        isAdmin={isAdmin}
        tokenBalance={tokenBalance}
        onStartVideo={handleStartVideoCall}
        onStartVoice={handleStartVoiceCall}
        onGoLive={handleGoLive}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8" style={{ paddingBottom: '80px' }}>
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            <div className="flex items-center justify-between">
              <span>⚠️ {error}</span>
              <button
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          </div>
        )}


        <AppRouter
          user={user}
          isCreator={isCreator}
          isAdmin={isAdmin}
          tokenBalance={tokenBalance}
          sessionStats={sessionStats}
          onTokenUpdate={fetchTokenBalance}
          onShowAvailability={() => navigate('/profile')}
          onShowGoLive={() => setShowGoLiveSetup(true)}
          onCreatorSelect={handleCreatorClick}
          onTipCreator={handleTipCreator}
          onViewProfile={(username) => navigate(`/${username}`)}
        />
      </main>

      {/* Modal Components */}
      {channel && (
        <VirtualGifts
          user={user}
          channel={channel}
          isOpen={showGifts}
          onClose={() => setShowGifts(false)}
          onSendGift={(giftData) => {
            addNotification(`Sent ${giftData.giftEmoji} ${giftData.giftName}!`, 'success');
          }}
          onSendTip={(tipData) => {
            addNotification(`Sent $${tipData.amount} tip!`, 'success');
          }}
        />
      )}

      {showGoLiveSetup && (
        <GoLiveSetup
          user={user}
          onClose={() => setShowGoLiveSetup(false)}
          onGoLive={(streamData) => {
            setShowGoLiveSetup(false);
            navigate(`/call/stream/${streamData.channel}`);
          }}
        />
      )}

      {showTokenTipping && (
        <TokenTipping
          user={user}
          recipient={tippingRecipient}
          tokenBalance={tokenBalance}
          onClose={() => setShowTokenTipping(false)}
          onTipSent={() => {
            fetchTokenBalance();
            setShowTokenTipping(false);
          }}
        />
      )}

      {/* Creator Directory Modal */}
      <CreatorDirectory
        isOpen={showCreatorDirectory}
        onClose={() => {
          setShowCreatorDirectory(false);
          setSessionType(null);
        }}
        onSelectCreator={handleCreatorSelect}
        sessionType={sessionType}
        user={user}
      />

      {/* Incoming Call Notification */}
      <IncomingCallNotification
        isOpen={showIncomingCall}
        callRequest={incomingCallRequest}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
        onClose={() => {
          setShowIncomingCall(false);
          setIncomingCallRequest(null);
        }}
        user={user}
      />

      {/* Utility Components */}
      <SmartBalanceNotifications user={user} tokenBalance={tokenBalance} />
      <PWAInstallPrompt />
      <RealTimeNotifications user={user} />
      <FeatureDiscovery user={user} isCreator={isCreator} />
    </div>
  );
};

const NewApp = () => {
  return <AppContent />;
};

export default NewApp;