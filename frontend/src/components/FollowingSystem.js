import React, { useState, useEffect, memo } from 'react';
import { supabase } from '../utils/supabase-auth.js';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';
import { fetchWithRetry } from '../utils/fetchWithRetry';

const FollowingSystem = memo(({ user, onCreatorSelect }) => {
  const [following, setFollowing] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('following');

  useEffect(() => {
    fetchFollowingData();
  }, []);

  const fetchFollowingData = async () => {
    try {
      setLoading(true);
      const authToken = await getAuthToken();
      
      const [followingResponse, activityResponse] = await Promise.all([
        fetchWithRetry(`${import.meta.env.VITE_BACKEND_URL}/users/following`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        fetchWithRetry(`${import.meta.env.VITE_BACKEND_URL}/users/following/activity`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
      ]);

      if (followingResponse.ok) {
        const followingData = await followingResponse.json();
        setFollowing(followingData.following || []);
      } else {
        // Mock data for development
        setFollowing([
          {
            id: 1,
            username: 'GamerGirl123',
            displayName: 'Sarah Gaming',
            avatar: null,
            isOnline: true,
            isLive: true,
            category: 'Gaming',
            currentStream: 'Minecraft Creative Build',
            followers: 15420,
            lastSeen: new Date(),
            followedAt: new Date(Date.now() - 86400000 * 5) // 5 days ago
          },
          {
            id: 2,
            username: 'MusicMaster',
            displayName: 'Alex Melody',
            avatar: null,
            isOnline: true,
            isLive: false,
            category: 'Music',
            followers: 8930,
            lastSeen: new Date(Date.now() - 3600000), // 1 hour ago
            followedAt: new Date(Date.now() - 86400000 * 12) // 12 days ago
          },
          {
            id: 3,
            username: 'ArtistVibe',
            displayName: 'Emma Creates',
            avatar: null,
            isOnline: false,
            isLive: false,
            category: 'Art',
            followers: 12500,
            lastSeen: new Date(Date.now() - 86400000 * 2), // 2 days ago
            followedAt: new Date(Date.now() - 86400000 * 30) // 30 days ago
          }
        ]);
      }

      if (activityResponse.ok) {
        const activityData = await activityResponse.json();
        setActivity(activityData.activity || []);
      } else {
        // Mock activity data
        setActivity([
          {
            id: 1,
            type: 'stream_started',
            creator: 'GamerGirl123',
            creatorName: 'Sarah Gaming',
            message: 'started streaming Minecraft Creative Build',
            timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
            thumbnail: null
          },
          {
            id: 2,
            type: 'new_video',
            creator: 'MusicMaster',
            creatorName: 'Alex Melody',
            message: 'uploaded a new song: "Midnight Dreams"',
            timestamp: new Date(Date.now() - 7200000), // 2 hours ago
            thumbnail: null
          },
          {
            id: 3,
            type: 'achievement',
            creator: 'ArtistVibe',
            creatorName: 'Emma Creates',
            message: 'reached 10,000 followers!',
            timestamp: new Date(Date.now() - 86400000), // 1 day ago
            thumbnail: null
          }
        ]);
      }
    } catch (error) {
      console.error('Error fetching following data:', error);
      toast.error('Failed to load following data');
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (creatorId) => {
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(`${import.meta.env.VITE_BACKEND_URL}/users/unfollow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ creatorId })
      });

      if (response.ok) {
        setFollowing(prev => prev.filter(creator => creator.id !== creatorId));
        // toast.success('Unfollowed creator');
      } else {
        // For demo, just remove from list
        setFollowing(prev => prev.filter(creator => creator.id !== creatorId));
        // toast.success('Unfollowed creator');
      }
    } catch (error) {
      console.error('Unfollow error:', error);
      toast.error('Failed to unfollow creator');
    }
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const renderFollowingList = () => (
    <div className="space-y-4">
      {following.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">💔</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No creators followed yet</h3>
          <p className="text-gray-600 mb-4">Start following creators to see their updates here</p>
          <button
            onClick={() => onCreatorSelect?.()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            aria-label="Discover and follow new creators"
          >
            Discover Creators
          </button>
        </div>
      ) : (
        <AnimatePresence>
          {following.map(creator => (
            <motion.div 
              key={creator.id} 
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {creator.displayName.charAt(0)}
                </div>
                {creator.isOnline && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                )}
                {creator.isLive && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full animate-pulse"></div>
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-medium text-gray-900">{creator.displayName}</h3>
                  <span className="text-sm text-gray-500">@{creator.username}</span>
                  {creator.isLive && (
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                      🔴 LIVE
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-3 mt-1">
                  <span className="text-sm text-gray-600">{creator.category}</span>
                  <span className="text-sm text-gray-500">•</span>
                  <span className="text-sm text-gray-600">{creator.followers.toLocaleString()} followers</span>
                </div>

                {creator.isLive && creator.currentStream && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-900">{creator.currentStream}</p>
                  </div>
                )}

                {!creator.isOnline && (
                  <div className="mt-1">
                    <span className="text-xs text-gray-500">Last seen {formatTimeAgo(creator.lastSeen)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {creator.isLive ? (
                  <button
                    onClick={() => onCreatorSelect?.(creator)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"
                    aria-label={`Watch ${creator.displayName} live stream`}
                  >
                    Watch Live
                  </button>
                ) : (
                  <button
                    onClick={() => onCreatorSelect?.(creator)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
                  >
                    View Profile
                  </button>
                )}
                
                <button
                  onClick={() => handleUnfollow(creator.id)}
                  className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                  aria-label={`Unfollow ${creator.displayName}`}
                >
                  Unfollow
                </button>
              </div>
            </div>
          </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );

  const renderActivity = () => (
    <div className="space-y-4">
      {activity.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No activity yet</h3>
          <p className="text-gray-600">Follow more creators to see their latest updates</p>
        </div>
      ) : (
        <AnimatePresence>
          {activity.map(item => (
            <motion.div 
              key={item.id} 
              className="bg-white border border-gray-200 rounded-xl p-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold">
                {item.creatorName.charAt(0)}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">{item.creatorName}</span>
                  <span className="text-sm text-gray-500">@{item.creator}</span>
                  <span className="text-sm text-gray-500">•</span>
                  <span className="text-sm text-gray-500">{formatTimeAgo(item.timestamp)}</span>
                </div>
                
                <p className="text-gray-700 mt-1">{item.message}</p>
                
                <div className="mt-2 flex items-center space-x-2">
                  {item.type === 'stream_started' && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                      🔴 Live Stream
                    </span>
                  )}
                  {item.type === 'new_video' && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      🎥 New Content
                    </span>
                  )}
                  {item.type === 'achievement' && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                      🏆 Achievement
                    </span>
                  )}
                </div>
              </div>
              
              {item.type === 'stream_started' && (
                <button
                  onClick={() => onCreatorSelect?.(item)}
                  className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
                >
                  Watch
                </button>
              )}
            </div>
          </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Loading following...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Following</h2>
        <button
          onClick={fetchFollowingData}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('following')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'following'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            aria-label="Switch to following tab"
            aria-selected={activeTab === 'following'}
          >
            Following ({following.length})
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'activity'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            aria-label="Switch to activity tab"
            aria-selected={activeTab === 'activity'}
          >
            Activity ({activity.length})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'following' ? renderFollowingList() : renderActivity()}
    </div>
  );
});

FollowingSystem.displayName = 'FollowingSystem';

FollowingSystem.propTypes = {
  user: PropTypes.object,
  onCreatorSelect: PropTypes.func
};

export default FollowingSystem;