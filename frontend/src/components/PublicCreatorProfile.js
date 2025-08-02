import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import CreatorOffers from './CreatorOffers';
import CreatorContentGallery from './CreatorContentGallery';

const PublicCreatorProfile = ({ username: propUsername, onBack, onSignIn, onJoinPrivateSession, user }) => {
  const { username: paramUsername } = useParams();
  const navigate = useNavigate();
  const username = propUsername || paramUsername;
  
  // Handle back navigation
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1); // Go back in browser history
    }
  };
  
  // Handle sign in
  const handleSignIn = () => {
    if (onSignIn) {
      onSignIn();
    } else {
      // If user is already logged in, no need to sign in
      navigate('/dashboard');
    }
  };
  const [creator, setCreator] = useState(null);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState('');
  const [tipMessage, setTipMessage] = useState('');
  const [activeTab, setActiveTab] = useState('shop');

  useEffect(() => {
    if (username) {
      fetchCreatorProfile();
      fetchFollowers();
    }
  }, [username]);

  const fetchCreatorProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/public/creator/${username}`);
      
      if (!response.ok) {
        throw new Error('Creator not found');
      }

      const data = await response.json();
      setCreator(data.creator);
    } catch (err) {
      console.error('Error fetching creator profile:', err);
      setError('Failed to load creator profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowers = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/creator/${username}/followers`);
      
      if (response.ok) {
        const data = await response.json();
        setFollowers(data.followers || []);
      }
    } catch (err) {
      console.error('Error fetching followers:', err);
    }
  };

  const handleTip = () => {
    setShowTipModal(true);
  };

  const handleSendTip = () => {
    // Redirect to sign in since user needs to be authenticated
    handleSignIn();
  };

  const handleJoinPrivateSession = (type) => {
    // This will trigger sign in since private sessions require authentication
    if (onJoinPrivateSession) {
      onJoinPrivateSession(type);
    } else {
      // If user is logged in via route, redirect to appropriate page
      handleSignIn();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-4xl mb-4 animate-pulse">👤</div>
          <p>Loading creator profile...</p>
        </div>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">😔</div>
          <h2 className="text-2xl mb-2">Creator Not Found</h2>
          <p className="mb-4">{error || 'This creator profile is not available.'}</p>
          <button
            onClick={handleBack}
            className="px-6 py-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500">
      {/* Header */}
      <header className="p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <span>←</span> Back
          </button>
          {!user && (
            <button
              onClick={handleSignIn}
              className="px-6 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-white hover:bg-white/30 transition-all"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Profile Section */}
          <div className="lg:col-span-3">
            {/* Creator Info Card */}
            <motion.div 
              className="bg-white/10 backdrop-blur-md rounded-2xl p-8 mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                {/* Profile Picture */}
                <div className="relative">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center text-4xl font-bold text-white">
                    {creator.profilePicUrl ? (
                      <img 
                        src={creator.profilePicUrl} 
                        alt={creator.username}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      creator.username?.[0]?.toUpperCase() || '?'
                    )}
                  </div>
                  {/* Online Status */}
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-white"></div>
                </div>

                {/* Creator Details */}
                <div className="flex-1 text-center md:text-left">
                  <h1 className="text-3xl font-bold text-white mb-2">
                    @{creator.username}
                  </h1>
                  
                  {creator.bio && (
                    <p className="text-white/80 text-lg mb-4 max-w-2xl">
                      {creator.bio}
                    </p>
                  )}

                  {/* Location */}
                  {(creator.state || creator.country) && (
                    <div className="flex items-center gap-2 text-white/70 mb-4">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                      </svg>
                      <span>{[creator.state, creator.country].filter(Boolean).join(', ')}</span>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex flex-wrap gap-6 justify-center md:justify-start mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{creator.followerCount}</div>
                      <div className="text-white/60 text-sm">Followers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{creator.totalSessions}</div>
                      <div className="text-white/60 text-sm">Sessions</div>
                    </div>
                  </div>

                  {/* Pricing Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white/10 p-3 rounded-lg text-center">
                      <div className="text-2xl mb-1">📡</div>
                      <div className="text-white font-semibold">${creator.streamPrice}</div>
                      <div className="text-white/60 text-xs">Stream/min</div>
                    </div>
                    <div className="bg-white/10 p-3 rounded-lg text-center">
                      <div className="text-2xl mb-1">📹</div>
                      <div className="text-white font-semibold">${creator.videoPrice}</div>
                      <div className="text-white/60 text-xs">Video Call/min</div>
                    </div>
                    <div className="bg-white/10 p-3 rounded-lg text-center">
                      <div className="text-2xl mb-1">📱</div>
                      <div className="text-white font-semibold">${creator.voicePrice}</div>
                      <div className="text-white/60 text-xs">Voice Call/min</div>
                    </div>
                    <div className="bg-white/10 p-3 rounded-lg text-center">
                      <div className="text-2xl mb-1">📧</div>
                      <div className="text-white font-semibold">${creator.messagePrice}</div>
                      <div className="text-white/60 text-xs">Messages/min</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 justify-center md:justify-start">
                    <button
                      onClick={() => handleJoinPrivateSession('stream')}
                      className="px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg hover:scale-105 transition-all text-center"
                    >
                      <div className="text-xl mb-1">📡</div>
                      <div className="text-sm">Stream</div>
                    </button>
                    <button
                      onClick={() => handleJoinPrivateSession('video')}
                      className="px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg hover:scale-105 transition-all text-center"
                    >
                      <div className="text-xl mb-1">📹</div>
                      <div className="text-sm">Video Call</div>
                    </button>
                    <button
                      onClick={() => handleJoinPrivateSession('voice')}
                      className="px-4 py-3 bg-gradient-to-r from-green-500 to-teal-600 text-white font-semibold rounded-xl hover:shadow-lg hover:scale-105 transition-all text-center"
                    >
                      <div className="text-xl mb-1">📱</div>
                      <div className="text-sm">Voice Call</div>
                    </button>
                    <button
                      onClick={() => handleJoinPrivateSession('message')}
                      className="px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl hover:shadow-lg hover:scale-105 transition-all text-center"
                    >
                      <div className="text-xl mb-1">📧</div>
                      <div className="text-sm">Messages</div>
                    </button>
                  </div>

                  <div className="flex justify-center mt-4">
                    <button
                      onClick={handleTip}
                      className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-600 text-white font-semibold rounded-xl hover:shadow-lg hover:scale-105 transition-all"
                    >
                      💰 Send Tip
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Tab Navigation */}
            <div className="flex space-x-4 mb-6 overflow-x-auto">
              <button
                onClick={() => setActiveTab('shop')}
                className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === 'shop'
                    ? 'bg-white/20 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                🛒 Shop
              </button>
              <button
                onClick={() => setActiveTab('stream')}
                className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === 'stream'
                    ? 'bg-white/20 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                📺 Live Stream
              </button>
              <button
                onClick={() => setActiveTab('offers')}
                className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === 'offers'
                    ? 'bg-white/20 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                🎁 Special Offers
              </button>
            </div>

            {/* Tab Content */}
            <motion.div 
              className="bg-white/10 backdrop-blur-md rounded-2xl p-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              key={activeTab}
            >
              {activeTab === 'shop' ? (
                <div className="bg-white rounded-lg p-6">
                  <CreatorContentGallery 
                    creatorId={creator.supabaseId}
                    creatorName={creator.username}
                    onPurchase={async (content) => {
                      // Handle purchase logic here
                      console.log('Purchasing content:', content);
                      // You would integrate with your backend here
                      return Promise.resolve();
                    }}
                    userTokenBalance={user?.tokenBalance || 0}
                    purchasedContent={user?.purchasedContent || []}
                  />
                </div>
              ) : activeTab === 'stream' ? (
                <>
                  <h2 className="text-2xl font-bold text-white mb-6">📺 Live Stream</h2>
                  
                  {/* Mock stream preview */}
                  <div className="aspect-video bg-gray-900 rounded-xl mb-4 flex items-center justify-center">
                    <div className="text-center text-white/60">
                      <div className="text-6xl mb-4">📺</div>
                      <p className="text-lg">Stream currently offline</p>
                      <p className="text-sm">Check back later or join a private session!</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/80">
                        Join when @{creator.username} goes live for free!
                      </p>
                    </div>
                    <button
                      onClick={handleSignIn}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
                    >
                      🔔 Get Notified
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-white mb-6">🎁 Special Offers</h2>
                  <div className="bg-white rounded-lg p-4">
                    <CreatorOffers 
                      creatorId={creator.supabaseId}
                      creatorUsername={creator.username}
                      auth={null}
                    />
                  </div>
                </>
              )}
            </motion.div>
          </div>

          {/* Followers Sidebar */}
          <div className="lg:col-span-1">
            <motion.div 
              className="bg-white/10 backdrop-blur-md rounded-2xl p-6 sticky top-6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <h3 className="text-xl font-bold text-white mb-4">
                👥 Followers ({followers.length})
              </h3>
              
              {followers.length === 0 ? (
                <div className="text-center text-white/60 py-8">
                  <div className="text-3xl mb-2">👤</div>
                  <p className="text-sm">No followers yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {followers.map((follower, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                    >
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center text-sm font-bold text-white">
                          {follower.profile_pic_url ? (
                            <img 
                              src={follower.profile_pic_url} 
                              alt={follower.username}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            follower.username?.[0]?.toUpperCase() || '?'
                          )}
                        </div>
                        {/* Online indicator */}
                        {follower.is_online && (
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">
                          {follower.username || 'Fan'}
                        </p>
                        <p className="text-white/60 text-xs">
                          {follower.is_online ? 'Online' : 'Offline'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-white/10">
                <button
                  onClick={handleSignIn}
                  className="w-full px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                >
                  ➕ Follow @{creator.username}
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Tip Modal */}
      {showTipModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            className="bg-white rounded-2xl p-6 w-full max-w-md"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">💰 Send Tip</h3>
              <button
                onClick={() => setShowTipModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center text-xl font-bold text-white mb-2">
                {creator.profilePicUrl ? (
                  <img 
                    src={creator.profilePicUrl} 
                    alt={creator.username}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  creator.username?.[0]?.toUpperCase() || '?'
                )}
              </div>
              <p className="font-medium text-gray-900">@{creator.username}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (tokens)
              </label>
              <input
                type="number"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                placeholder="Enter amount..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="1"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message (optional)
              </label>
              <textarea
                value={tipMessage}
                onChange={(e) => setTipMessage(e.target.value)}
                placeholder="Leave a nice message..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows="3"
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-yellow-800">
                💡 You'll need to sign in to send tips to creators.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowTipModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTip}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
              >
                Sign In to Send
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PublicCreatorProfile;