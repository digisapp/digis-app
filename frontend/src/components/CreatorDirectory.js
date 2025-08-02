import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MagnifyingGlassIcon, 
  XMarkIcon,
  UserIcon,
  StarIcon,
  VideoCameraIcon,
  PhoneIcon,
  CurrencyDollarIcon,
  EyeIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { VideoCameraIcon as VideoCameraIconSolid, PhoneIcon as PhoneIconSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const CreatorDirectory = ({ 
  isOpen, 
  onClose, 
  onSelectCreator, 
  sessionType = 'video', // 'video' or 'voice'
  user,
  backendUrl = import.meta.env.VITE_BACKEND_URL 
}) => {
  const [creators, setCreators] = useState([]);
  const [filteredCreators, setFilteredCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [selectedCreator, setSelectedCreator] = useState(null);

  // Fetch creators from backend
  const fetchCreators = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/users/public/creators?limit=50&sortBy=${sortBy}&sortOrder=${sortOrder}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCreators(data.creators || []);
        setFilteredCreators(data.creators || []);
        console.log('✅ Creators fetched successfully:', data.creators.length);
      } else {
        throw new Error('Failed to fetch creators');
      }
    } catch (error) {
      console.error('❌ Failed to fetch creators:', error);
      toast.error('Failed to load creators directory');
      setCreators([]);
      setFilteredCreators([]);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, sortBy, sortOrder]);

  // Search creators
  const searchCreators = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setFilteredCreators(creators);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/users/creators/search?q=${encodeURIComponent(query)}&limit=20`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Convert backend format to frontend format
        const searchResults = data.creators.map(creator => ({
          username: creator.username || 'creator', // use actual username
          bio: creator.bio,
          profilePicUrl: creator.profile_pic_url,
          streamPrice: creator.price_per_min || 5.00,
          videoPrice: creator.price_per_min || 8.00,
          voicePrice: creator.price_per_min || 6.00,
          messagePrice: creator.price_per_min || 2.00,
          totalSessions: creator.total_sessions || 0,
          totalEarnings: creator.total_earnings || 0,
          followerCount: 0,
          createdAt: creator.created_at
        }));
        setFilteredCreators(searchResults);
        console.log('✅ Search completed:', searchResults.length, 'results');
      } else {
        throw new Error('Search failed');
      }
    } catch (error) {
      console.error('❌ Search error:', error);
      toast.error('Search failed');
    } finally {
      setSearchLoading(false);
    }
  }, [backendUrl, creators]);

  // Handle search input change
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Debounce search
    setTimeout(() => {
      searchCreators(value);
    }, 300);
  };

  // Handle creator selection
  const handleCreatorSelect = (creator) => {
    setSelectedCreator(creator);
  };

  // Handle start session
  const handleStartSession = async () => {
    if (!selectedCreator || !onSelectCreator) return;

    try {
      // Send call request to backend
      const response = await fetch(`${backendUrl}/api/users/sessions/call-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          creatorId: selectedCreator.username,
          sessionType: sessionType,
          fanUsername: user.displayName || user.email?.split('@')[0] || 'Fan',
          fanProfilePicUrl: user.photoURL,
          fanBio: 'Fan requesting a session',
          estimatedDuration: 10 // Default 10 minutes
        })
      });

      if (response.ok) {
        const data = await response.json();
        // toast.success(`Call request sent to @${selectedCreator.username}! Waiting for response...`);
        
        // Call the parent handler to navigate or setup the call
        onSelectCreator(selectedCreator, sessionType, data.callRequestId);
        onClose();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to send call request');
      }
    } catch (error) {
      console.error('Error sending call request:', error);
      toast.error('Failed to send call request. Please try again.');
    }
  };

  // Get price based on session type
  const getSessionPrice = (creator) => {
    switch (sessionType) {
      case 'video':
        return creator.videoPrice;
      case 'voice':
        return creator.voicePrice;
      case 'stream':
        return creator.streamPrice;
      default:
        return creator.videoPrice;
    }
  };

  // Format price display
  const formatPrice = (price) => {
    return `$${parseFloat(price || 0).toFixed(2)}/min`;
  };

  // Handle sort change
  const handleSortChange = (newSortBy) => {
    const newSortOrder = sortBy === newSortBy && sortOrder === 'DESC' ? 'ASC' : 'DESC';
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
  };

  // Load creators when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCreators();
    }
  }, [isOpen, fetchCreators]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSelectedCreator(null);
      setFilteredCreators([]);
      setCreators([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              {sessionType === 'video' ? (
                <VideoCameraIconSolid className="w-8 h-8 text-blue-600" />
              ) : (
                <PhoneIconSolid className="w-8 h-8 text-green-600" />
              )}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Creator Directory
                </h2>
                <p className="text-sm text-gray-600">
                  Choose a creator for your {sessionType} call
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <XMarkIcon className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Search and Sort */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Search creators by bio or name..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                {searchLoading && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>

              {/* Sort Dropdown */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleSortChange('created_at')}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    sortBy === 'created_at' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <ClockIcon className="w-4 h-4 inline mr-1" />
                  Recent
                </button>
                <button
                  onClick={() => handleSortChange('total_sessions')}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    sortBy === 'total_sessions' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <EyeIcon className="w-4 h-4 inline mr-1" />
                  Popular
                </button>
                <button
                  onClick={() => handleSortChange('stream_price')}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    sortBy === 'stream_price' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <CurrencyDollarIcon className="w-4 h-4 inline mr-1" />
                  Price
                </button>
              </div>
            </div>
          </div>

          {/* Creators Grid */}
          <div className="flex-1 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading creators...</p>
                </div>
              </div>
            ) : filteredCreators.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <UserIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Creators Found</h3>
                  <p className="text-gray-600">
                    {searchTerm ? 'Try different search terms' : 'No creators available at the moment'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 overflow-y-auto h-full">
                {filteredCreators.map((creator, index) => (
                  <motion.div
                    key={creator.username || index}
                    className={`bg-white border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg ${
                      selectedCreator?.username === creator.username
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleCreatorSelect(creator)}
                  >
                    {/* Creator Avatar */}
                    <div className="flex items-center mb-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {creator.profilePicUrl ? (
                          <img
                            src={creator.profilePicUrl}
                            alt={creator.username}
                            className="w-full h-full rounded-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className={creator.profilePicUrl ? 'hidden' : 'flex'}>
                          {(creator.username || 'U').charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="ml-3 flex-1">
                        <h3 className="font-semibold text-gray-900 truncate">
                          @{creator.username || 'Creator'}
                        </h3>
                        <div className="flex items-center text-sm text-gray-600">
                          <StarIcon className="w-4 h-4 text-yellow-500 mr-1" />
                          <span>{creator.followerCount || 0} followers</span>
                        </div>
                      </div>
                    </div>

                    {/* Creator Bio */}
                    <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                      {creator.bio || 'Professional creator available for personalized sessions.'}
                    </p>

                    {/* Pricing */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          {sessionType.charAt(0).toUpperCase() + sessionType.slice(1)} Call
                        </span>
                        <span className="font-semibold text-green-600">
                          {formatPrice(getSessionPrice(creator))}
                        </span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{creator.totalSessions || 0} sessions</span>
                      <span>${parseFloat(creator.totalEarnings || 0).toFixed(0)}+ earned</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {selectedCreator ? (
                  <span>
                    Selected: <strong>@{selectedCreator.username}</strong> • 
                    Rate: <strong>{formatPrice(getSessionPrice(selectedCreator))}</strong>
                  </span>
                ) : (
                  <span>Select a creator to start your {sessionType} call</span>
                )}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-3 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartSession}
                  disabled={!selectedCreator}
                  className={`px-6 py-3 font-medium rounded-xl transition-colors flex items-center gap-2 ${
                    selectedCreator
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {sessionType === 'video' ? (
                    <VideoCameraIcon className="w-5 h-5" />
                  ) : (
                    <PhoneIcon className="w-5 h-5" />
                  )}
                  Start {sessionType.charAt(0).toUpperCase() + sessionType.slice(1)} Call
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CreatorDirectory;