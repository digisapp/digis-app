import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase-auth.js';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const UserProfile = ({ user, username, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('collection');
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      
      // Check if viewing own profile
      const currentUsername = user?.username || user?.displayName;
      setIsOwnProfile(currentUsername === username);

      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/profile/${username}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      } else {
        // Mock profile data for development
        setProfile({
          username: username,
          displayName: username === 'GamerGirl123' ? 'Sarah Gaming' : 
                     username === 'MusicMaster' ? 'Alex Melody' :
                     username === 'ArtistVibe' ? 'Emma Creates' :
                     username === 'TechGuru2024' ? 'Alex Tech' :
                     username === 'FitnessQueen' ? 'Sarah Fit' : username,
          avatar: null,
          bio: `Passionate creator and card collector. Love connecting with fans!`,
          memberSince: new Date(Date.now() - 86400000 * 365), // 1 year ago
          isCreator: ['GamerGirl123', 'MusicMaster', 'ArtistVibe', 'TechGuru2024', 'FitnessQueen'].includes(username),
          stats: {
            cardsOwned: Math.floor(Math.random() * 50) + 10,
            cardsTraded: Math.floor(Math.random() * 20) + 5,
            giftsSent: Math.floor(Math.random() * 30) + 8,
            totalValue: Math.floor(Math.random() * 500000) + 100000,
            followers: Math.floor(Math.random() * 10000) + 1000,
            following: Math.floor(Math.random() * 100) + 20
          },
          cards: [
            {
              id: 'card-1',
              creatorName: 'GamerGirl123',
              cardNumber: 15,
              rarity: 'rare',
              category: 'Gaming',
              acquiredAt: new Date(Date.now() - 86400000 * 10)
            },
            {
              id: 'card-2',
              creatorName: 'MusicMaster',
              cardNumber: 3,
              rarity: 'legendary',
              category: 'Music',
              acquiredAt: new Date(Date.now() - 86400000 * 20)
            },
            {
              id: 'card-3',
              creatorName: 'ArtistVibe',
              cardNumber: 156,
              rarity: 'epic',
              category: 'Art',
              acquiredAt: new Date(Date.now() - 86400000 * 5)
            },
            {
              id: 'card-4',
              creatorName: 'TechGuru2024',
              cardNumber: 42,
              rarity: 'common',
              category: 'Tech',
              acquiredAt: new Date(Date.now() - 86400000 * 15)
            }
          ],
          achievements: [
            {
              id: 1,
              title: 'First Collection',
              description: 'Collected your first 10 cards',
              icon: '🎴',
              unlockedAt: new Date(Date.now() - 86400000 * 30),
              rarity: 'common'
            },
            {
              id: 2,
              title: 'Legendary Hunter',
              description: 'Found a legendary card',
              icon: '⭐',
              unlockedAt: new Date(Date.now() - 86400000 * 20),
              rarity: 'legendary'
            },
            {
              id: 3,
              title: 'Social Trader',
              description: 'Completed 10 trades',
              icon: '🤝',
              unlockedAt: new Date(Date.now() - 86400000 * 10),
              rarity: 'rare'
            }
          ]
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'legendary': return 'from-yellow-400 to-orange-500';
      case 'epic': return 'from-purple-400 to-pink-500';
      case 'rare': return 'from-blue-400 to-indigo-500';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  const getRarityBorder = (rarity) => {
    switch (rarity) {
      case 'legendary': return 'border-yellow-400';
      case 'epic': return 'border-purple-400';
      case 'rare': return 'border-blue-400';
      default: return 'border-gray-400';
    }
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / 86400000);
    const months = Math.floor(days / 30);
    
    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    return 'Today';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <span className="block mt-2 text-gray-600">Loading profile...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">❌</div>
          <h3 className="text-lg font-bold mb-2">Profile Not Found</h3>
          <p className="text-gray-600 mb-4">Could not load profile for {username}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6 rounded-t-xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 text-xl"
          >
            ×
          </button>
          
          <div className="flex items-center space-x-6">
            <div className="w-24 h-24 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-4xl font-bold">
              {profile.displayName.charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{profile.displayName}</h1>
              <p className="text-lg opacity-90">@{profile.username}</p>
              {profile.isCreator && (
                <span className="inline-block bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-bold mt-2">
                  ✨ Creator
                </span>
              )}
            </div>
          </div>
          
          <p className="mt-4 text-lg opacity-90">{profile.bio}</p>
          <p className="text-sm opacity-75 mt-2">Fan since {formatTimeAgo(profile.memberSince)}</p>
        </div>

        {/* Stats */}
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{profile.stats.cardsOwned}</div>
              <div className="text-sm text-gray-600">Cards Owned</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{profile.stats.cardsTraded}</div>
              <div className="text-sm text-gray-600">Cards Traded</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-pink-600">{profile.stats.giftsSent}</div>
              <div className="text-sm text-gray-600">Gifts Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{profile.stats.totalValue.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Collection Value</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">{profile.stats.followers.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{profile.stats.following}</div>
              <div className="text-sm text-gray-600">Following</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <div className="flex space-x-8 px-6">
            {[
              { id: 'collection', label: 'Card Collection', icon: '🎴' },
              { id: 'achievements', label: 'Achievements', icon: '🏆' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'collection' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Card Collection ({profile.cards.length})</h3>
                {!isOwnProfile && (
                  <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm">
                    💬 Send Message
                  </button>
                )}
              </div>
              
              {profile.cards.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">🎴</div>
                  <p>No cards in collection yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {profile.cards.map(card => (
                    <div
                      key={card.id}
                      className={`bg-white border-2 ${getRarityBorder(card.rarity)} rounded-xl shadow-lg overflow-hidden hover:scale-105 transition-transform`}
                    >
                      <div className={`bg-gradient-to-br ${getRarityColor(card.rarity)} p-4 text-white text-center`}>
                        <div className="text-2xl mb-2">{card.creatorName.charAt(0)}</div>
                        <h4 className="font-bold text-sm">{card.creatorName}</h4>
                        <p className="text-xs opacity-90">{card.category}</p>
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-600">Card #</span>
                          <span className="text-sm font-bold">{card.cardNumber}</span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-600">Rarity</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            card.rarity === 'legendary' ? 'bg-yellow-100 text-yellow-700' :
                            card.rarity === 'epic' ? 'bg-purple-100 text-purple-700' :
                            card.rarity === 'rare' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {card.rarity}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 text-center">
                          Acquired {formatTimeAgo(card.acquiredAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'achievements' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold">Achievements ({profile.achievements.length})</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profile.achievements.map(achievement => (
                  <div
                    key={achievement.id}
                    className={`border-2 rounded-xl p-4 ${
                      achievement.rarity === 'legendary' ? 'border-yellow-400 bg-yellow-50' :
                      achievement.rarity === 'rare' ? 'border-blue-400 bg-blue-50' :
                      'border-gray-300 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="text-3xl">{achievement.icon}</div>
                      <div className="flex-1">
                        <h4 className="font-bold">{achievement.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{achievement.description}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            achievement.rarity === 'legendary' ? 'bg-yellow-100 text-yellow-700' :
                            achievement.rarity === 'rare' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {achievement.rarity}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTimeAgo(achievement.unlockedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;