import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase-auth.js';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const FanEngagement = ({ user, onCreatorSelect, tokenBalance }) => {
  const [engagementData, setEngagementData] = useState({
    watchHistory: [],
    favorites: [],
    achievements: [],
    spending: {
      thisMonth: 0,
      total: 0,
      sessions: 0,
      tips: 0
    }
  });
  const [activeTab, setActiveTab] = useState('history');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEngagementData();
  }, []);

  const fetchEngagementData = async () => {
    try {
      setLoading(true);
      const authToken = await getAuthToken();
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/engagement`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setEngagementData(data);
      } else {
        // Mock data for development
        setEngagementData({
          watchHistory: [
            {
              id: 1,
              creator: 'GamerGirl123',
              creatorName: 'Sarah Gaming',
              type: 'video_call',
              duration: 45,
              cost: 1350,
              rating: 5,
              timestamp: new Date(Date.now() - 86400000), // 1 day ago
              thumbnail: null,
              notes: 'Amazing gaming tips session!'
            },
            {
              id: 2,
              creator: 'MusicMaster',
              creatorName: 'Alex Melody',
              type: 'live_stream',
              duration: 120,
              cost: 0,
              rating: 4,
              timestamp: new Date(Date.now() - 86400000 * 3), // 3 days ago
              thumbnail: null,
              notes: 'Great piano performance'
            },
            {
              id: 3,
              creator: 'ArtistVibe',
              creatorName: 'Emma Creates',
              type: 'voice_call',
              duration: 30,
              cost: 900,
              rating: 5,
              timestamp: new Date(Date.now() - 86400000 * 7), // 1 week ago
              thumbnail: null,
              notes: 'Helpful art critique session'
            }
          ],
          favorites: [
            {
              id: 1,
              creator: 'GamerGirl123',
              creatorName: 'Sarah Gaming',
              category: 'Gaming',
              addedAt: new Date(Date.now() - 86400000 * 5),
              isOnline: true,
              isLive: true,
              lastInteraction: new Date(Date.now() - 86400000)
            },
            {
              id: 2,
              creator: 'MusicMaster',
              creatorName: 'Alex Melody',
              category: 'Music',
              addedAt: new Date(Date.now() - 86400000 * 15),
              isOnline: true,
              isLive: false,
              lastInteraction: new Date(Date.now() - 86400000 * 3)
            }
          ],
          achievements: [
            {
              id: 1,
              title: 'First Session',
              description: 'Completed your first video call',
              icon: '🎉',
              unlockedAt: new Date(Date.now() - 86400000 * 30),
              rarity: 'common'
            },
            {
              id: 2,
              title: 'Super Supporter',
              description: 'Spent over 5,000 tokens',
              icon: '💎',
              unlockedAt: new Date(Date.now() - 86400000 * 15),
              rarity: 'rare'
            },
            {
              id: 3,
              title: 'Social Butterfly',
              description: 'Followed 10 creators',
              icon: '🦋',
              unlockedAt: new Date(Date.now() - 86400000 * 10),
              rarity: 'uncommon'
            },
            {
              id: 4,
              title: 'Stream Enthusiast',
              description: 'Watched 20 live streams',
              icon: '📺',
              unlockedAt: new Date(Date.now() - 86400000 * 5),
              rarity: 'uncommon'
            }
          ],
          spending: {
            thisMonth: 4250,
            total: 12350,
            sessions: 15,
            tips: 8
          }
        });
      }
    } catch (error) {
      console.error('Error fetching engagement data:', error);
      toast.error('Failed to load engagement data');
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (creatorId) => {
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/favorite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ creatorId })
      });

      if (response.ok) {
        fetchEngagementData();
        // toast.success('Favorites updated');
      } else {
        // Mock toggle for development
        setEngagementData(prev => ({
          ...prev,
          favorites: prev.favorites.filter(fav => fav.id !== creatorId)
        }));
        // toast.success('Removed from favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorites');
    }
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor(diff / 60000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  };

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'common': return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'uncommon': return 'bg-green-100 text-green-700 border-green-300';
      case 'rare': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'epic': return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'legendary': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < rating ? 'text-yellow-400' : 'text-gray-300'}>
        ⭐
      </span>
    ));
  };

  const renderWatchHistory = () => (
    <div className="space-y-4">
      {engagementData.watchHistory.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📺</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No watch history yet</h3>
          <p className="text-gray-600">Start watching creators to build your history</p>
        </div>
      ) : (
        engagementData.watchHistory.map(session => (
          <div key={session.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                {session.creatorName.charAt(0)}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{session.creatorName}</h3>
                    <p className="text-sm text-gray-600">@{session.creator}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-1">
                      {renderStars(session.rating)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{formatTimeAgo(session.timestamp)}</p>
                  </div>
                </div>

                <div className="mt-2 flex items-center space-x-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    session.type === 'video_call' ? 'bg-blue-100 text-blue-700' :
                    session.type === 'voice_call' ? 'bg-green-100 text-green-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {session.type === 'video_call' ? '🎥 Video Call' :
                     session.type === 'voice_call' ? '🎙️ Voice Call' :
                     '📺 Live Stream'}
                  </span>
                  <span className="text-sm text-gray-600">{session.duration} minutes</span>
                  {session.cost > 0 && (
                    <span className="text-sm font-medium text-green-600">{session.cost} tokens</span>
                  )}
                </div>

                {session.notes && (
                  <p className="text-sm text-gray-700 mt-2 italic">"{session.notes}"</p>
                )}

                <div className="mt-3 flex items-center space-x-2">
                  <button
                    onClick={() => onCreatorSelect?.(session)}
                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                  >
                    Book Again
                  </button>
                  <button className="px-3 py-1 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50">
                    Leave Review
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderFavorites = () => (
    <div className="space-y-4">
      {engagementData.favorites.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">💝</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No favorites yet</h3>
          <p className="text-gray-600">Add creators to your favorites for quick access</p>
        </div>
      ) : (
        engagementData.favorites.map(favorite => (
          <div key={favorite.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {favorite.creatorName.charAt(0)}
                </div>
                {favorite.isOnline && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                )}
                {favorite.isLive && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full animate-pulse"></div>
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{favorite.creatorName}</h3>
                    <p className="text-sm text-gray-600">@{favorite.creator} • {favorite.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Added {formatTimeAgo(favorite.addedAt)}</p>
                    <p className="text-xs text-gray-500">Last interaction {formatTimeAgo(favorite.lastInteraction)}</p>
                  </div>
                </div>

                <div className="mt-2 flex items-center space-x-2">
                  {favorite.isLive && (
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full animate-pulse">
                      🔴 LIVE
                    </span>
                  )}
                  {favorite.isOnline && !favorite.isLive && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                      🟢 Online
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center space-x-2">
                  {favorite.isLive ? (
                    <button
                      onClick={() => onCreatorSelect?.(favorite)}
                      className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                    >
                      Watch Live
                    </button>
                  ) : (
                    <button
                      onClick={() => onCreatorSelect?.(favorite)}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                    >
                      View Profile
                    </button>
                  )}
                  <button
                    onClick={() => toggleFavorite(favorite.id)}
                    className="px-3 py-1 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50"
                  >
                    💔 Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderAchievements = () => (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl p-4 mb-6">
        <h3 className="text-lg font-semibold mb-2">🏆 Achievement Stats</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{engagementData.achievements.length}</div>
            <div className="text-sm opacity-90">Unlocked</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{engagementData.spending.sessions}</div>
            <div className="text-sm opacity-90">Sessions</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{engagementData.spending.total}</div>
            <div className="text-sm opacity-90">Total Tokens</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {engagementData.achievements.map(achievement => (
          <div key={achievement.id} className={`border-2 rounded-xl p-4 ${getRarityColor(achievement.rarity)}`}>
            <div className="flex items-start space-x-3">
              <div className="text-3xl">{achievement.icon}</div>
              <div className="flex-1">
                <h3 className="font-semibold">{achievement.title}</h3>
                <p className="text-sm opacity-80 mt-1">{achievement.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${getRarityColor(achievement.rarity)}`}>
                    {achievement.rarity}
                  </span>
                  <span className="text-xs opacity-70">
                    {formatTimeAgo(achievement.unlockedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Next Achievement Preview */}
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-4">
        <div className="text-center">
          <div className="text-3xl mb-2">🎯</div>
          <h3 className="font-semibold text-gray-700">Next Achievement</h3>
          <p className="text-sm text-gray-600 mt-1">Marathon Viewer: Watch 50 hours of content</p>
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: '65%' }}></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">32.5 / 50 hours completed</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSpending = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{tokenBalance}</div>
          <div className="text-sm text-blue-700">Current Balance</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{engagementData.spending.thisMonth}</div>
          <div className="text-sm text-green-700">This Month</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{engagementData.spending.total}</div>
          <div className="text-sm text-purple-700">Total Spent</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{engagementData.spending.tips}</div>
          <div className="text-sm text-orange-700">Tips Sent</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">💰 Spending Breakdown</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Video Calls</span>
            <div className="text-right">
              <div className="font-semibold">4,250 tokens</div>
              <div className="text-xs text-gray-500">65% of total</div>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full" style={{ width: '65%' }}></div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Tips</span>
            <div className="text-right">
              <div className="font-semibold">2,100 tokens</div>
              <div className="text-xs text-gray-500">17% of total</div>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full" style={{ width: '17%' }}></div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Voice Calls</span>
            <div className="text-right">
              <div className="font-semibold">1,800 tokens</div>
              <div className="text-xs text-gray-500">15% of total</div>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-purple-500 h-2 rounded-full" style={{ width: '15%' }}></div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Gifts</span>
            <div className="text-right">
              <div className="font-semibold">400 tokens</div>
              <div className="text-xs text-gray-500">3% of total</div>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '3%' }}></div>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'history', label: 'Watch History', icon: '📺', count: engagementData.watchHistory.length },
    { id: 'favorites', label: 'Favorites', icon: '💝', count: engagementData.favorites.length },
    { id: 'achievements', label: 'Achievements', icon: '🏆', count: engagementData.achievements.length },
    { id: 'spending', label: 'Spending', icon: '💰', count: engagementData.spending.sessions }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Loading engagement data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">My Activity</h2>
        <button
          onClick={fetchEngagementData}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <div className="flex space-x-8 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded-full text-xs">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'history' && renderWatchHistory()}
      {activeTab === 'favorites' && renderFavorites()}
      {activeTab === 'achievements' && renderAchievements()}
      {activeTab === 'spending' && renderSpending()}
    </div>
  );
};

export default FanEngagement;