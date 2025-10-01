import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import PropTypes from 'prop-types';
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
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { useAccessibleModal, useKeyboardNavigation, useAnnouncement } from '../hooks/useAccessibility';
import { usePaginatedApi, useSearchApi, useMutation } from '../hooks/useApi';

const CreatorDirectory = memo(({ 
  isOpen, 
  onClose, 
  onSelectCreator, 
  sessionType = 'video', // 'video' or 'voice'
  user,
  backendUrl = import.meta.env.VITE_BACKEND_URL 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  // Accessibility hooks
  const modalProps = useAccessibleModal(isOpen, onClose, 'Creator directory');
  const announce = useAnnouncement();
  
  // API hooks
  const {
    items: creators,
    loading,
    error,
    refetch: fetchCreators,
    page,
    totalPages,
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage
  } = usePaginatedApi('/api/users/public/creators', {
    params: { sortBy, sortOrder },
    immediate: false
  });
  
  const {
    results: searchResults,
    loading: searchLoading,
    error: searchError
  } = useSearchApi('/api/users/creators/search', searchTerm, {
    minLength: 2,
    debounceDelay: 300
  });
  
  const { mutate: sendCallRequest, loading: requestLoading } = useMutation(
    async (creatorUsername) => {
      const token = await getAuthToken();
      const response = await fetchWithRetry(
        `${backendUrl}/api/users/sessions/call-request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            creatorId: creatorUsername,
            sessionType: sessionType,
            fanUsername: user.displayName || user.email?.split('@')[0] || 'Fan',
            fanProfilePicUrl: user.photoURL,
            fanBio: 'Fan requesting a session',
            estimatedDuration: 10
          })
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send call request');
      }
      
      return response.json();
    }
  );
  
  // Computed values
  const displayedCreators = searchTerm ? searchResults : creators;
  const isLoading = loading || searchLoading;
  
  // Keyboard navigation for creators grid
  const { getItemProps, focusedIndex, setFocusedIndex } = useKeyboardNavigation(
    displayedCreators,
    (creator) => handleCreatorSelect(creator),
    { orientation: 'horizontal', wrap: true }
  );

  // Transform creator data for display
  const transformCreator = useCallback((creator) => ({
    username: creator.username || 'creator',
    bio: creator.bio,
    profilePicUrl: creator.profile_pic_url,
    streamPrice: creator.price_per_min || 5.00,
    videoPrice: creator.price_per_min || 8.00,
    voicePrice: creator.price_per_min || 6.00,
    messagePrice: creator.price_per_min || 2.00,
    totalSessions: creator.total_sessions || 0,
    totalEarnings: creator.total_earnings || 0,
    followerCount: creator.follower_count || 0,
    createdAt: creator.created_at
  }), []);

  // Handle creator selection
  const handleCreatorSelect = useCallback((creator, index) => {
    setSelectedCreator(creator);
    setSelectedIndex(index);
    announce(`Selected creator ${creator.username}`);
  }, [announce]);

  // Handle start session
  const handleStartSession = useCallback(async () => {
    if (!selectedCreator || !onSelectCreator) return;

    try {
      const data = await sendCallRequest(selectedCreator.username);
      announce(`Call request sent to ${selectedCreator.username}`);
      toast.success(`Call request sent to @${selectedCreator.username}! Waiting for response...`);
      
      // Call the parent handler to navigate or setup the call
      onSelectCreator(selectedCreator, sessionType, data.callRequestId);
      onClose();
    } catch (error) {
      console.error('Error sending call request:', error);
      toast.error(error.message || 'Failed to send call request. Please try again.');
      announce('Failed to send call request');
    }
  }, [selectedCreator, onSelectCreator, sessionType, onClose, sendCallRequest, announce]);

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
  const handleSortChange = useCallback((newSortBy) => {
    const newSortOrder = sortBy === newSortBy && sortOrder === 'DESC' ? 'ASC' : 'DESC';
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    announce(`Sorting by ${newSortBy} ${newSortOrder.toLowerCase()}`);
  }, [sortBy, sortOrder, announce]);

  // Load creators when modal opens or sort changes
  useEffect(() => {
    if (isOpen) {
      fetchCreators();
    }
  }, [isOpen, sortBy, sortOrder, fetchCreators]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSelectedCreator(null);
      setSelectedIndex(-1);
      setFocusedIndex(0);
    }
  }, [isOpen, setFocusedIndex]);
  
  // Handle errors
  useEffect(() => {
    if (error) {
      toast.error('Failed to load creators directory');
      announce('Failed to load creators');
    }
    if (searchError) {
      toast.error('Search failed');
      announce('Search failed');
    }
  }, [error, searchError, announce]);

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
          {...modalProps}
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
                <VideoCameraIconSolid className="w-8 h-8 text-blue-600" aria-hidden="true" />
              ) : (
                <PhoneIconSolid className="w-8 h-8 text-green-600" aria-hidden="true" />
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
              aria-label="Close creator directory"
            >
              <XMarkIcon className="w-6 h-6 text-gray-500" aria-hidden="true" />
            </button>
          </div>

          {/* Search and Sort */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Search creators by bio or name..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  aria-label="Search creators"
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
                  aria-label="Sort creators by most recent"
                  aria-pressed={sortBy === 'created_at'}
                >
                  <ClockIcon className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  Recent
                </button>
                <button
                  onClick={() => handleSortChange('total_sessions')}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    sortBy === 'total_sessions' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  aria-label="Sort creators by popularity"
                  aria-pressed={sortBy === 'total_sessions'}
                >
                  <EyeIcon className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  Popular
                </button>
                <button
                  onClick={() => handleSortChange('stream_price')}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    sortBy === 'stream_price' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  aria-label="Sort creators by price"
                  aria-pressed={sortBy === 'stream_price'}
                >
                  <CurrencyDollarIcon className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  Price
                </button>
              </div>
            </div>
          </div>

          {/* Creators Grid */}
          <div className="flex-1 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-full" role="status" aria-live="polite">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading creators...</p>
                </div>
              </div>
            ) : displayedCreators.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <UserIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" aria-hidden="true" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Creators Found</h3>
                  <p className="text-gray-600">
                    {searchTerm ? 'Try different search terms' : 'No creators available at the moment'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 overflow-y-auto flex-1" role="list" aria-label="Creators list">
                  {displayedCreators.map((creator, index) => {
                    const transformedCreator = transformCreator(creator);
                    const itemProps = getItemProps(index);
                    const isSelected = selectedIndex === index;
                    
                    return (
                      <motion.div
                        key={creator.username || index}
                        {...itemProps}
                        className={`bg-white border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => handleCreatorSelect(transformedCreator, index)}
                        role="listitem"
                        aria-label={`${transformedCreator.username}, ${transformedCreator.bio || 'Professional creator'}, ${formatPrice(getSessionPrice(transformedCreator))} per minute`}
                        aria-selected={isSelected}
                      >
                        {/* Creator Avatar */}
                        <div className="flex items-center mb-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                            {transformedCreator.profilePicUrl ? (
                              <img
                                src={transformedCreator.profilePicUrl}
                                alt=""
                                className="w-full h-full rounded-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className={transformedCreator.profilePicUrl ? 'hidden' : 'flex'}>
                              {(transformedCreator.username || 'U').charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div className="ml-3 flex-1">
                            <h3 className="font-semibold text-gray-900 truncate">
                              @{transformedCreator.username || 'Creator'}
                            </h3>
                            <div className="flex items-center text-sm text-gray-600">
                              <StarIcon className="w-4 h-4 text-yellow-500 mr-1" aria-hidden="true" />
                              <span>{transformedCreator.followerCount || 0} followers</span>
                            </div>
                          </div>
                        </div>

                        {/* Creator Bio */}
                        <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                          {transformedCreator.bio || 'Professional creator available for personalized sessions.'}
                        </p>

                        {/* Pricing */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">
                              {sessionType.charAt(0).toUpperCase() + sessionType.slice(1)} Call
                            </span>
                            <span className="font-semibold text-green-600">
                              {formatPrice(getSessionPrice(transformedCreator))}
                            </span>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{transformedCreator.totalSessions || 0} sessions</span>
                          <span>${parseFloat(transformedCreator.totalEarnings || 0).toFixed(0)}+ earned</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 p-4 border-t border-gray-200">
                    <button
                      onClick={prevPage}
                      disabled={!hasPrevPage}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Previous page"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-700" aria-live="polite">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={nextPage}
                      disabled={!hasNextPage}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Next page"
                    >
                      Next
                    </button>
                  </div>
                )}
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
                  aria-label="Cancel and close creator directory"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartSession}
                  disabled={!selectedCreator || requestLoading}
                  className={`px-6 py-3 font-medium rounded-xl transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    selectedCreator && !requestLoading
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  aria-label={selectedCreator ? `Start ${sessionType} call with ${selectedCreator.username}` : 'Select a creator to start call'}
                  aria-disabled={!selectedCreator || requestLoading}
                >
                  {sessionType === 'video' ? (
                    <VideoCameraIcon className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <PhoneIcon className="w-5 h-5" aria-hidden="true" />
                  )}
                  {requestLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending Request...
                    </>
                  ) : (
                    <>
                      Start {sessionType.charAt(0).toUpperCase() + sessionType.slice(1)} Call
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

CreatorDirectory.displayName = 'CreatorDirectory';

CreatorDirectory.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelectCreator: PropTypes.func,
  sessionType: PropTypes.oneOf(['video', 'voice', 'stream']),
  user: PropTypes.object,
  backendUrl: PropTypes.string
};

export default CreatorDirectory;