import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase-auth.js';
import toast from 'react-hot-toast';

const PersonalizedRecommendations = ({ user, onCreatorSelect, onTipCreator, onStartVideoCall, onStartVoiceCall }) => {
  const [recommendations, setRecommendations] = useState({
    trending: [],
    newCreators: [],
    forYou: [],
    similarToFollowing: []
  });
  const [userPreferences, setUserPreferences] = useState({
    categories: [],
    priceRange: { min: 0, max: 100 },
    sessionTypes: []
  });
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('forYou');

  useEffect(() => {
    fetchRecommendations();
    fetchUserPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUserPreferences = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.error('No auth token available');
        return;
      }
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/preferences`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUserPreferences(data.preferences || userPreferences);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.error('No auth token available');
        setLoading(false);
        return;
      }
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/recommendations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.recommendations || recommendations);
      } else {
        // Mock recommendation data
        setRecommendations({
          trending: [
            {
              id: 1,
              username: 'TechGuru2024',
              displayName: 'Alex Tech',
              category: 'Tech',
              avatar: null,
              followers: 25000,
              rating: 4.9,
              isLive: true,
              isOnline: true,
              pricePerMinute: 45,
              tags: ['AI', 'Programming', 'Tutorials'],
              bio: 'Teaching the latest in AI and machine learning',
              reasonForRecommendation: 'Trending in Tech category'
            },
            {
              id: 2,
              username: 'FitnessQueen',
              displayName: 'Sarah Fit',
              category: 'Fitness',
              avatar: null,
              followers: 18500,
              rating: 4.8,
              isLive: false,
              isOnline: true,
              pricePerMinute: 35,
              tags: ['Yoga', 'HIIT', 'Nutrition'],
              bio: 'Your personal fitness journey starts here',
              reasonForRecommendation: '#1 in Fitness this week'
            }
          ],
          newCreators: [
            {
              id: 3,
              username: 'ArtistNewbie',
              displayName: 'Maya Creates',
              category: 'Art',
              avatar: null,
              followers: 120,
              rating: 5.0,
              isLive: false,
              isOnline: true,
              pricePerMinute: 25,
              tags: ['Digital Art', 'Painting', 'Beginner-Friendly'],
              bio: 'New to the platform, specializing in digital art',
              reasonForRecommendation: 'New creator with perfect rating',
              isNew: true
            },
            {
              id: 4,
              username: 'CookingBasics',
              displayName: 'Chef Roberto',
              category: 'Cooking',
              avatar: null,
              followers: 89,
              rating: 4.9,
              isLive: true,
              isOnline: true,
              pricePerMinute: 30,
              tags: ['Italian', 'Basics', 'Quick Meals'],
              bio: 'Learn authentic Italian cooking from scratch',
              reasonForRecommendation: 'Recently joined, highly rated',
              isNew: true
            }
          ],
          forYou: [
            {
              id: 5,
              username: 'GameMaster99',
              displayName: 'Tyler Gaming',
              category: 'Gaming',
              avatar: null,
              followers: 12000,
              rating: 4.7,
              isLive: true,
              isOnline: true,
              pricePerMinute: 40,
              tags: ['Strategy', 'RPG', 'Coaching'],
              bio: 'Pro gamer offering strategy coaching',
              reasonForRecommendation: 'Based on your viewing history'
            },
            {
              id: 6,
              username: 'MusicMaestro',
              displayName: 'Emma Melody',
              category: 'Music',
              avatar: null,
              followers: 8900,
              rating: 4.8,
              isLive: false,
              isOnline: true,
              pricePerMinute: 50,
              tags: ['Piano', 'Theory', 'Composition'],
              bio: 'Classical pianist and music theory expert',
              reasonForRecommendation: 'Matches your music preferences'
            }
          ],
          similarToFollowing: [
            {
              id: 7,
              username: 'CreativeArt',
              displayName: 'Zoe Artistic',
              category: 'Art',
              avatar: null,
              followers: 15600,
              rating: 4.9,
              isLive: false,
              isOnline: true,
              pricePerMinute: 38,
              tags: ['Watercolor', 'Portraits', 'Live Painting'],
              bio: 'Award-winning watercolor artist',
              reasonForRecommendation: 'Similar to ArtistVibe (following)'
            }
          ]
        });
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      toast.error('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const CreatorCard = ({ creator, showReason = true }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all duration-300 h-full">
      {/* Profile Image and Status */}
      <div className="relative flex justify-center mb-4">
        <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-400 rounded-xl flex items-center justify-center text-white font-bold text-2xl">
          {creator.displayName.charAt(0)}
        </div>
        {creator.isOnline && (
          <div className="absolute bottom-0 right-4 w-5 h-5 bg-green-500 border-2 border-white rounded-full"></div>
        )}
        {creator.isLive && (
          <div className="absolute top-0 right-4 w-6 h-6 bg-red-500 border-2 border-white rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          </div>
        )}
        {creator.isNew && (
          <div className="absolute -top-2 -left-2 bg-yellow-400 text-yellow-900 text-xs px-2 py-1 rounded-full font-bold">
            NEW
          </div>
        )}
      </div>

      {/* Creator Info */}
      <div className="text-center mb-3">
        <h3 className="font-semibold text-gray-900 text-lg">{creator.displayName}</h3>
        <p className="text-sm text-gray-600">@{creator.username}</p>
        <div className="flex items-center justify-center space-x-1 mt-1">
          <span className="text-yellow-500">⭐</span>
          <span className="text-sm font-medium">{creator.rating}</span>
          <span className="text-xs text-gray-500">• {creator.followers.toLocaleString()} followers</span>
        </div>
      </div>

      {/* Category and Price */}
      <div className="flex flex-col items-center space-y-2 mb-3">
        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
          {creator.category}
        </span>
        <span className="text-sm font-medium text-green-600">
          {creator.pricePerMinute} tokens/min
        </span>
        {creator.isLive && (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full animate-pulse">
            🔴 LIVE
          </span>
        )}
      </div>

      {/* Bio */}
      <p className="text-sm text-gray-700 mb-3 text-center line-clamp-2">{creator.bio}</p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-3 justify-center">
        {creator.tags.slice(0, 2).map((tag, index) => (
          <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
            {tag}
          </span>
        ))}
      </div>

      {/* Reason */}
      {showReason && (
        <div className="text-xs text-blue-600 mb-3 text-center italic">
          💡 {creator.reasonForRecommendation}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col space-y-2 mt-auto">
        {creator.isLive ? (
          <button
            onClick={() => onCreatorSelect?.(creator)}
            className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"
          >
            Join Live
          </button>
        ) : (
          <button
            onClick={() => onCreatorSelect?.(creator)}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
          >
            View Profile
          </button>
        )}
        
        {/* Video and Voice Call Buttons */}
        <div className="flex space-x-2">
          <button
            onClick={() => onStartVideoCall?.(creator)}
            className="flex-1 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-xs font-medium flex items-center justify-center gap-1"
          >
            📹 Video
          </button>
          <button
            onClick={() => onStartVoiceCall?.(creator)}
            className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-xs font-medium flex items-center justify-center gap-1"
          >
            📱 Voice
          </button>
        </div>
        
        <button
          onClick={() => onTipCreator?.(creator)}
          className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
        >
          💝 Tip
        </button>
      </div>
    </div>
  );

  const sections = [
    { id: 'forYou', label: 'For You', icon: '🎯', data: recommendations.forYou },
    { id: 'trending', label: 'Trending', icon: '🔥', data: recommendations.trending },
    { id: 'newCreators', label: 'New Creators', icon: '✨', data: recommendations.newCreators },
    { id: 'similarToFollowing', label: 'Similar to Following', icon: '👥', data: recommendations.similarToFollowing }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Loading recommendations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Discover Creators</h2>
        <button
          onClick={fetchRecommendations}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Section Navigation */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              activeSection === section.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>{section.icon}</span>
            <span>{section.label}</span>
            <span className="text-xs bg-gray-200 text-gray-600 px-1 rounded">
              {section.data.length}
            </span>
          </button>
        ))}
      </div>

      {/* Active Section Content */}
      <div className="space-y-4">
        {sections.find(s => s.id === activeSection)?.data.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No recommendations yet</h3>
            <p className="text-gray-600">Try following more creators or updating your preferences</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {sections.find(s => s.id === activeSection)?.data.map(creator => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default PersonalizedRecommendations;