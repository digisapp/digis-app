import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  VideoCameraIcon,
  PhoneIcon,
  ClockIcon,
  UserIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const CreatorCallModal = ({ 
  isOpen, 
  onClose, 
  callType, // 'video' or 'voice'
  user,
  onInitiateCall 
}) => {
  const [availableCreators, setAvailableCreators] = useState([]);
  const [filteredCreators, setFilteredCreators] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [callStatus, setCallStatus] = useState(null); // null, 'calling', 'waiting', 'connected', 'rejected'
  const [targetCreator, setTargetCreator] = useState(null);

  const categories = [
    { id: 'all', label: 'All Creators', icon: '👥' },
    { id: 'fitness', label: 'Fitness', icon: '💪' },
    { id: 'wellness', label: 'Wellness', icon: '🧘' },
    { id: 'fashion', label: 'Fashion', icon: '👗' },
    { id: 'business', label: 'Business', icon: '💼' },
    { id: 'creative', label: 'Creative', icon: '🎨' },
    { id: 'cooking', label: 'Cooking', icon: '🍳' },
    { id: 'tech', label: 'Technology', icon: '💻' },
    { id: 'music', label: 'Music', icon: '🎵' }
  ];

  const generateMockCreators = useCallback(() => {
    const mockCreators = [
      {
        id: 1,
        username: 'FitnessGuru_Alex',
        displayName: 'Alex Martinez',
        avatar: null,
        category: 'fitness',
        rating: 4.9,
        reviewCount: 256,
        isOnline: true,
        lastSeen: new Date(),
        specialties: ['Personal Training', 'Nutrition', 'HIIT'],
        pricePerMin: 3,
        responseTime: '< 1 min',
        totalCalls: 1240,
        bio: 'Certified personal trainer with 8+ years experience. Specializing in strength training and weight loss.',
        availableFor: ['video', 'voice']
      },
      {
        id: 2,
        username: 'YogaMaster_Sophia',
        displayName: 'Sophia Chen',
        avatar: null,
        category: 'wellness',
        rating: 4.8,
        reviewCount: 198,
        isOnline: true,
        lastSeen: new Date(),
        specialties: ['Yoga', 'Meditation', 'Mindfulness'],
        pricePerMin: 2,
        responseTime: '< 2 min',
        totalCalls: 892,
        bio: 'Yoga instructor and meditation guide. Helping you find inner peace and physical balance.',
        availableFor: ['video', 'voice']
      },
      {
        id: 3,
        username: 'StyleIcon_Emma',
        displayName: 'Emma Thompson',
        avatar: null,
        category: 'fashion',
        rating: 4.7,
        reviewCount: 167,
        isOnline: true,
        lastSeen: new Date(Date.now() - 300000), // 5 min ago
        specialties: ['Fashion Styling', 'Color Analysis', 'Wardrobe Planning'],
        pricePerMin: 4,
        responseTime: '< 3 min',
        totalCalls: 623,
        bio: 'Fashion stylist with experience in editorial and personal styling. Let me help you find your style!',
        availableFor: ['video']
      },
      {
        id: 4,
        username: 'BizCoach_Marcus',
        displayName: 'Marcus Johnson',
        avatar: null,
        category: 'business',
        rating: 4.9,
        reviewCount: 312,
        isOnline: true,
        lastSeen: new Date(),
        specialties: ['Business Strategy', 'Leadership', 'Entrepreneurship'],
        pricePerMin: 6,
        responseTime: '< 1 min',
        totalCalls: 1567,
        bio: 'Serial entrepreneur and business consultant. 15+ years building successful companies.',
        availableFor: ['video', 'voice']
      },
      {
        id: 5,
        username: 'Chef_Isabella',
        displayName: 'Isabella Rodriguez',
        avatar: null,
        category: 'cooking',
        rating: 4.8,
        reviewCount: 223,
        isOnline: false,
        lastSeen: new Date(Date.now() - 1200000), // 20 min ago
        specialties: ['Italian Cuisine', 'Baking', 'Healthy Cooking'],
        pricePerMin: 3,
        responseTime: '< 5 min',
        totalCalls: 734,
        bio: 'Professional chef specializing in Italian cuisine and healthy cooking techniques.',
        availableFor: ['video', 'voice']
      },
      {
        id: 6,
        username: 'TechMentor_David',
        displayName: 'David Kim',
        avatar: null,
        category: 'tech',
        rating: 4.9,
        reviewCount: 445,
        isOnline: true,
        lastSeen: new Date(),
        specialties: ['Software Development', 'AI/ML', 'Career Guidance'],
        pricePerMin: 5,
        responseTime: '< 1 min',
        totalCalls: 2134,
        bio: 'Senior software engineer at top tech company. Mentoring the next generation of developers.',
        availableFor: ['video', 'voice']
      }
    ];

    // Filter by call type availability
    return mockCreators.filter(creator => 
      creator.availableFor.includes(callType) && creator.id !== user?.uid
    );
  }, [callType, user?.uid]);

  const fetchAvailableCreators = useCallback(async () => {
    try {
      setLoading(true);
      const authToken = user ? await getAuthToken() : null;
      
      // In production, this would fetch from your API
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/creators/available?type=${callType}`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableCreators(data.creators || []);
      } else {
        // Use mock data for development
        setAvailableCreators(generateMockCreators());
      }
    } catch (error) {
      console.error('Error fetching available creators:', error);
      setAvailableCreators(generateMockCreators());
    } finally {
      setLoading(false);
    }
  }, [user, callType, generateMockCreators]);

  const filterCreators = useCallback(() => {
    let filtered = availableCreators;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(creator => creator.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(creator =>
        creator.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        creator.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        creator.specialties.some(specialty => 
          specialty.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Sort by online status first, then by rating
    filtered.sort((a, b) => {
      if (a.isOnline !== b.isOnline) {
        return b.isOnline - a.isOnline;
      }
      return b.rating - a.rating;
    });

    setFilteredCreators(filtered);
  }, [availableCreators, selectedCategory, searchTerm]);

  useEffect(() => {
    if (isOpen) {
      fetchAvailableCreators();
    }
  }, [isOpen, fetchAvailableCreators]);

  useEffect(() => {
    filterCreators();
  }, [availableCreators, searchTerm, selectedCategory, filterCreators]);

  const handleCallCreator = async (creator) => {
    try {
      setTargetCreator(creator);
      setCallStatus('calling');

      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/creators/call-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          targetCreatorId: creator.id,
          callType: callType,
          message: `${user.displayName || user.email} wants to start a ${callType} call with you.`
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCallStatus('waiting');
        
        // Simulate call response after some time
        setTimeout(() => {
          const accepted = Math.random() > 0.3; // 70% acceptance rate for demo
          if (accepted) {
            setCallStatus('connected');
            // toast.success(`${creator.displayName} accepted your call!`);
            
            // Navigate to call after short delay
            setTimeout(() => {
              if (onInitiateCall) {
                onInitiateCall({
                  creator,
                  callType,
                  callId: data.callId
                });
              }
              onClose();
            }, 2000);
          } else {
            setCallStatus('rejected');
            toast.error(`${creator.displayName} is currently unavailable.`);
            setTimeout(() => {
              setCallStatus(null);
              setTargetCreator(null);
            }, 3000);
          }
        }, 3000 + Math.random() * 4000); // 3-7 seconds wait
        
      } else {
        throw new Error('Failed to send call request');
      }
    } catch (error) {
      console.error('Error calling creator:', error);
      toast.error('Failed to initiate call. Please try again.');
      setCallStatus(null);
      setTargetCreator(null);
    }
  };

  const formatLastSeen = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Online now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const CreatorCard = ({ creator }) => (
    <motion.div
      className={`bg-white border-2 rounded-xl p-4 transition-all duration-300 ${
        creator.isOnline 
          ? 'border-green-200 hover:border-green-300 hover:shadow-lg' 
          : 'border-gray-200 hover:border-gray-300 opacity-75'
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {creator.displayName.charAt(0)}
            </div>
            {creator.isOnline && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{creator.displayName}</h3>
            <p className="text-sm text-gray-600">@{creator.username}</p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <StarIconSolid className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-medium">{creator.rating}</span>
          <span className="text-xs text-gray-500">({creator.reviewCount})</span>
        </div>
      </div>

      {/* Category & Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">
            {categories.find(cat => cat.id === creator.category)?.icon || '👤'}
          </span>
          <span className="text-sm font-medium text-gray-700">
            {categories.find(cat => cat.id === creator.category)?.label || 'Other'}
          </span>
        </div>
        <div className={`text-xs px-2 py-1 rounded-full ${
          creator.isOnline 
            ? 'bg-green-100 text-green-700' 
            : 'bg-gray-100 text-gray-600'
        }`}>
          {creator.isOnline ? 'Online' : formatLastSeen(creator.lastSeen)}
        </div>
      </div>

      {/* Bio */}
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{creator.bio}</p>

      {/* Specialties */}
      <div className="flex flex-wrap gap-1 mb-3">
        {creator.specialties.slice(0, 3).map((specialty, index) => (
          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
            {specialty}
          </span>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div>
          <div className="text-sm font-semibold text-gray-900">{creator.pricePerMin} tokens</div>
          <div className="text-xs text-gray-500">per min</div>
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-900">{creator.responseTime}</div>
          <div className="text-xs text-gray-500">response</div>
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-900">{creator.totalCalls}</div>
          <div className="text-xs text-gray-500">calls</div>
        </div>
      </div>

      {/* Call Button */}
      <button
        onClick={() => handleCallCreator(creator)}
        disabled={!creator.isOnline}
        className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center space-x-2 ${
          creator.isOnline
            ? callType === 'video'
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {callType === 'video' ? (
          <VideoCameraIcon className="w-5 h-5" />
        ) : (
          <PhoneIcon className="w-5 h-5" />
        )}
        <span>
          {creator.isOnline 
            ? `Start ${callType === 'video' ? 'Video' : 'Voice'} Call`
            : 'Currently Offline'
          }
        </span>
      </button>
    </motion.div>
  );

  const CallStatusModal = () => (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        {callStatus === 'calling' && (
          <>
            <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
              {targetCreator?.displayName.charAt(0)}
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Calling {targetCreator?.displayName}...
            </h3>
            <p className="text-gray-600 mb-6">
              Sending {callType} call request
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
          </>
        )}

        {callStatus === 'waiting' && (
          <>
            <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 animate-pulse">
              {targetCreator?.displayName.charAt(0)}
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Waiting for {targetCreator?.displayName}
            </h3>
            <p className="text-gray-600 mb-6">
              {targetCreator?.displayName} has been notified. Please wait...
            </p>
            <div className="flex items-center justify-center space-x-2">
              <ClockIcon className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-600">Typical response: {targetCreator?.responseTime}</span>
            </div>
          </>
        )}

        {callStatus === 'connected' && (
          <>
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto mb-4">
              <CheckCircleIcon className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Call Accepted!</h3>
            <p className="text-gray-600 mb-4">
              Connecting you with {targetCreator?.displayName}...
            </p>
          </>
        )}

        {callStatus === 'rejected' && (
          <>
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white mx-auto mb-4">
              <ExclamationTriangleIcon className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Call Declined</h3>
            <p className="text-gray-600 mb-4">
              {targetCreator?.displayName} is currently unavailable
            </p>
          </>
        )}
      </motion.div>
    </motion.div>
  );

  if (!isOpen) return null;

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              {callType === 'video' ? (
                <VideoCameraIcon className="w-8 h-8 text-purple-600" />
              ) : (
                <PhoneIcon className="w-8 h-8 text-green-600" />
              )}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {callType === 'video' ? 'Video Call' : 'Voice Call'} with Creators
                </h2>
                <p className="text-sm text-gray-600">
                  Connect with fellow creators for collaboration and networking
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

          {/* Filters */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search creators by name or specialty..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-w-[150px]"
              >
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Creators List */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-gray-600">Loading creators...</span>
              </div>
            ) : filteredCreators.length === 0 ? (
              <div className="text-center py-12">
                <UserIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Creators Available</h3>
                <p className="text-gray-600">
                  {searchTerm || selectedCategory !== 'all' 
                    ? 'Try adjusting your search or filters' 
                    : `No creators are currently available for ${callType} calls`
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCreators.map(creator => (
                  <CreatorCard key={creator.id} creator={creator} />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Online ({filteredCreators.filter(c => c.isOnline).length})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span>Offline ({filteredCreators.filter(c => !c.isOnline).length})</span>
                </div>
              </div>
              <span>Showing {filteredCreators.length} creators</span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Call Status Modal */}
      <AnimatePresence>
        {callStatus && <CallStatusModal />}
      </AnimatePresence>
    </>
  );
};

export default CreatorCallModal;