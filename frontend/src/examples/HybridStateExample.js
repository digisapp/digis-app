/**
 * Example implementation of the Hybrid State Management approach
 * Demonstrates best practices for using Zustand + useState
 */

import React, { useState, useCallback, useEffect } from 'react';
import { 
  // Auth selectors - for global user state
  useUser,
  useTokenBalance,
  useIsCreator,
  useAuthActions,
  
  // Chat selectors - for real-time messages
  useChannelMessages,
  useTypingUsers,
  useOnlineUsersCount,
  useChatActions,
  
  // Notification selectors - for real-time alerts
  useNotifications,
  useIncomingCall,
  useStreamAlerts,
  useNotificationActions,
  
  // Stream selectors - for live streaming
  useIsStreaming,
  useViewerCount,
  useStreamActions
} from '../stores/useHybridStore';

/**
 * Example 1: Chat Component
 * Uses Zustand for messages (shared across components)
 * Uses useState for input field (local UI state)
 */
const ChatExample = ({ channelId }) => {
  // Global state from Zustand - messages are shared across components
  const messages = useChannelMessages(channelId);
  const typingUsers = useTypingUsers(channelId);
  const onlineCount = useOnlineUsersCount();
  const { addMessage, setTypingUser } = useChatActions();
  const user = useUser();
  
  // Local UI state with useState - input is component-specific
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Handle typing with debounce
  const handleTyping = useCallback(() => {
    if (!isTyping && user) {
      setIsTyping(true);
      setTypingUser(channelId, user.id, true);
      
      // Clear typing after 2 seconds
      setTimeout(() => {
        setIsTyping(false);
        setTypingUser(channelId, user.id, false);
      }, 2000);
    }
  }, [isTyping, user, channelId, setTypingUser]);
  
  // Send message
  const sendMessage = useCallback(() => {
    if (inputValue.trim() && user) {
      // Add to global store
      addMessage(channelId, {
        id: Date.now().toString(),
        text: inputValue,
        sender: user.name || user.email,
        senderId: user.id,
        timestamp: Date.now()
      });
      
      // Clear local state
      setInputValue('');
      setIsTyping(false);
      setTypingUser(channelId, user.id, false);
    }
  }, [inputValue, user, channelId, addMessage, setTypingUser]);
  
  return (
    <div>
      <h3>Chat ({onlineCount} online)</h3>
      
      {/* Messages from global store */}
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id}>
            <strong>{msg.sender}:</strong> {msg.text}
          </div>
        ))}
      </div>
      
      {/* Typing indicator from global store */}
      {typingUsers.length > 0 && (
        <div className="typing">
          {typingUsers.join(', ')} typing...
        </div>
      )}
      
      {/* Input with local state */}
      <input
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          handleTyping();
        }}
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        placeholder="Type a message..."
      />
    </div>
  );
};

/**
 * Example 2: Auth Form
 * Uses Zustand for user authentication state
 * Uses useState for form inputs
 */
const AuthFormExample = () => {
  // Global auth state from Zustand
  const user = useUser();
  const { setUser, setProfile, setTokenBalance, logout } = useAuthActions();
  
  // Local form state with useState
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Simulate API call
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      
      const userData = await response.json();
      
      // Update global store
      setUser(userData);
      setProfile(userData.profile);
      setTokenBalance(userData.tokenBalance);
      
      // Clear local form state
      setEmail('');
      setPassword('');
    } catch (err) {
      // Handle error locally
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  if (user) {
    return (
      <div>
        <p>Logged in as: {user.email}</p>
        <p>Token Balance: {useTokenBalance()}</p>
        <button onClick={logout}>Logout</button>
      </div>
    );
  }
  
  return (
    <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Loading...' : 'Login'}
      </button>
    </form>
  );
};

/**
 * Example 3: Notification System
 * Uses Zustand for notifications (shared across app)
 * Uses useState for UI display state
 */
const NotificationExample = () => {
  // Global notification state from Zustand
  const notifications = useNotifications();
  const incomingCall = useIncomingCall();
  const streamAlerts = useStreamAlerts();
  const { 
    addNotification, 
    removeNotification,
    clearIncomingCall,
    removeStreamAlert 
  } = useNotificationActions();
  
  // Local UI state
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unread, calls
  
  // Handle incoming call
  const handleCallAction = (action) => {
    if (action === 'accept' && incomingCall) {
      // Handle accept logic
      console.log('Accepting call from', incomingCall.caller);
    }
    clearIncomingCall();
  };
  
  // Filter notifications based on local state
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'calls') return n.type === 'call';
    return true;
  });
  
  return (
    <div className="notifications">
      {/* Incoming call alert - high priority */}
      {incomingCall && (
        <div className="incoming-call-alert">
          <p>Incoming call from {incomingCall.caller}</p>
          <button onClick={() => handleCallAction('accept')}>Accept</button>
          <button onClick={() => handleCallAction('decline')}>Decline</button>
        </div>
      )}
      
      {/* Stream alerts */}
      {streamAlerts.map(alert => (
        <div key={alert.id} className="stream-alert">
          <p>{alert.creatorName} is now live!</p>
          <button onClick={() => removeStreamAlert(alert.id)}>Dismiss</button>
        </div>
      ))}
      
      {/* Notification list with local UI state */}
      <div className="notification-header">
        <h3>Notifications ({notifications.length})</h3>
        <button onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      
      {isExpanded && (
        <>
          <div className="filters">
            {['all', 'unread', 'calls'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={filter === f ? 'active' : ''}
              >
                {f}
              </button>
            ))}
          </div>
          
          <div className="notification-list">
            {filteredNotifications.map(notification => (
              <div key={notification.id} className="notification">
                <p>{notification.message}</p>
                <button onClick={() => removeNotification(notification.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/**
 * Example 4: Stream Dashboard
 * Uses Zustand for stream state (shared)
 * Uses useState for dashboard UI controls
 */
const StreamDashboardExample = () => {
  // Global stream state from Zustand
  const isStreaming = useIsStreaming();
  const viewerCount = useViewerCount();
  const { startStream, endStream, setViewerCount } = useStreamActions();
  const user = useUser();
  const isCreator = useIsCreator();
  
  // Local UI state
  const [streamTitle, setStreamTitle] = useState('');
  const [streamCategory, setStreamCategory] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [qualitySettings, setQualitySettings] = useState({
    resolution: '1080p',
    bitrate: 5000,
    fps: 30
  });
  
  const handleStartStream = async () => {
    if (!streamTitle.trim()) {
      alert('Please enter a stream title');
      return;
    }
    
    // Start stream in global state
    startStream({
      title: streamTitle,
      category: streamCategory,
      channelName: `stream_${user.id}`,
      settings: qualitySettings
    });
    
    // Clear local form state
    setStreamTitle('');
    setStreamCategory('');
  };
  
  const handleEndStream = () => {
    if (confirm('Are you sure you want to end the stream?')) {
      endStream();
      setShowSettings(false);
    }
  };
  
  // Simulate viewer count updates
  useEffect(() => {
    if (isStreaming) {
      const interval = setInterval(() => {
        // Simulate random viewer changes
        setViewerCount(Math.floor(Math.random() * 100) + 50);
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [isStreaming, setViewerCount]);
  
  if (!isCreator) {
    return <div>Only creators can stream</div>;
  }
  
  return (
    <div className="stream-dashboard">
      {!isStreaming ? (
        <div className="start-stream">
          <h2>Start Streaming</h2>
          <input
            type="text"
            value={streamTitle}
            onChange={(e) => setStreamTitle(e.target.value)}
            placeholder="Stream title..."
          />
          <select 
            value={streamCategory}
            onChange={(e) => setStreamCategory(e.target.value)}
          >
            <option value="">Select category</option>
            <option value="gaming">Gaming</option>
            <option value="music">Music</option>
            <option value="talk">Just Chatting</option>
          </select>
          
          <button onClick={() => setShowSettings(!showSettings)}>
            Advanced Settings
          </button>
          
          {showSettings && (
            <div className="stream-settings">
              <select
                value={qualitySettings.resolution}
                onChange={(e) => setQualitySettings({
                  ...qualitySettings,
                  resolution: e.target.value
                })}
              >
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
                <option value="4k">4K</option>
              </select>
              {/* More settings... */}
            </div>
          )}
          
          <button onClick={handleStartStream} className="primary">
            Go Live
          </button>
        </div>
      ) : (
        <div className="live-stream">
          <div className="stream-stats">
            <h2>🔴 LIVE</h2>
            <p>Viewers: {viewerCount}</p>
            <p>Duration: {/* Calculate from stream start time */}</p>
          </div>
          
          <button onClick={handleEndStream} className="danger">
            End Stream
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Example 5: Token Purchase
 * Uses Zustand for token balance
 * Uses useState for purchase UI
 */
const TokenPurchaseExample = () => {
  // Global state
  const tokenBalance = useTokenBalance();
  const { updateTokenBalance } = useAuthActions();
  
  // Local UI state
  const [amount, setAmount] = useState('');
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const packages = [
    { tokens: 100, price: 9.99 },
    { tokens: 500, price: 44.99 },
    { tokens: 1000, price: 84.99 }
  ];
  
  const handlePurchase = async () => {
    if (!selectedPackage) return;
    
    setIsProcessing(true);
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update global balance
      updateTokenBalance(selectedPackage.tokens);
      
      // Reset local state
      setSelectedPackage(null);
      setAmount('');
      
      alert(`Successfully purchased ${selectedPackage.tokens} tokens!`);
    } catch (error) {
      alert('Purchase failed');
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="token-purchase">
      <h3>Token Balance: {tokenBalance}</h3>
      
      <div className="packages">
        {packages.map(pkg => (
          <div
            key={pkg.tokens}
            className={`package ${selectedPackage?.tokens === pkg.tokens ? 'selected' : ''}`}
            onClick={() => setSelectedPackage(pkg)}
          >
            <p>{pkg.tokens} tokens</p>
            <p>${pkg.price}</p>
          </div>
        ))}
      </div>
      
      <p>Or enter custom amount:</p>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Enter token amount"
      />
      
      <button 
        onClick={handlePurchase}
        disabled={!selectedPackage && !amount || isProcessing}
      >
        {isProcessing ? 'Processing...' : 'Purchase Tokens'}
      </button>
    </div>
  );
};

/**
 * Main App Example showing all components working together
 */
const HybridStateExample = () => {
  return (
    <div className="app">
      <h1>Hybrid State Management Examples</h1>
      
      <div className="examples-grid">
        <section>
          <h2>1. Authentication</h2>
          <AuthFormExample />
        </section>
        
        <section>
          <h2>2. Chat System</h2>
          <ChatExample channelId="main" />
        </section>
        
        <section>
          <h2>3. Notifications</h2>
          <NotificationExample />
        </section>
        
        <section>
          <h2>4. Stream Dashboard</h2>
          <StreamDashboardExample />
        </section>
        
        <section>
          <h2>5. Token Purchase</h2>
          <TokenPurchaseExample />
        </section>
      </div>
    </div>
  );
};

export default HybridStateExample;