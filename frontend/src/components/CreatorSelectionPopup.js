import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  VideoCameraIcon,
  PhoneIcon,
  StarIcon,
  UserGroupIcon,
  ClockIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../utils/supabase-auth.js';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const CreatorSelectionPopup = ({ isOpen, onClose, callType, onCreatorSelect }) => {
  // ✅ Early return BEFORE hooks (fixes React error #310)
  if (!isOpen) return null;

  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [filter, setFilter] = useState('all'); // all, online, favorites

  useEffect(() => {
    fetchAvailableCreators();
  }, []); // Run on mount (component only renders when isOpen=true)

  const fetchAvailableCreators = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/creators/available`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCreators(data);
      } else {
        // Mock data for demonstration
        setCreators([
          {
            id: 'creator1',
            username: 'SarahGaming',
            fullName: 'Sarah Johnson',
            profilePic: null,
            category: 'Gaming',
            isOnline: true,
            isBusy: false,
            totalCalls: 156,
            videoPrice: 8,
            voicePrice: 6,
            bio: 'Professional gamer and content creator',
            specialties: ['Fortnite', 'Valorant', 'Gaming Tips']
          },
          {
            id: 'creator2',
            username: 'AlexMusic',
            fullName: 'Alex Rivera',
            profilePic: null,
            category: 'Music',
            isOnline: true,
            isBusy: true,
            totalCalls: 243,
            videoPrice: 10,
            voicePrice: 7,
            bio: 'Music producer and vocal coach',
            specialties: ['Singing', 'Music Production', 'Guitar']
          },
          {
            id: 'creator3',
            username: 'EmmaFitness',
            fullName: 'Emma Chen',
            profilePic: null,
            category: 'Fitness',
            isOnline: true,
            isBusy: false,
            totalCalls: 89,
            videoPrice: 12,
            voicePrice: 8,
            bio: 'Certified personal trainer and nutritionist',
            specialties: ['Yoga', 'HIIT', 'Nutrition']
          },
          {
            id: 'creator4',
            username: 'TechMike',
            fullName: 'Mike Anderson',
            profilePic: null,
            category: 'Tech',
            isOnline: false,
            isBusy: false,
            totalCalls: 67,
            videoPrice: 15,
            voicePrice: 10,
            bio: 'Software engineer and tech educator',
            specialties: ['Programming', 'Web Dev', 'AI/ML']
          }
        ]);
      }
    } catch (error) {
      console.error('Error fetching creators:', error);
      toast.error('Failed to load available creators');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatorSelect = async (creator) => {
    if (creator.isBusy) {
      toast.error(`${creator.username} is currently busy. Please try again later.`);
      return;
    }

    if (!creator.isOnline) {
      toast.error(`${creator.username} is currently offline.`);
      return;
    }

    setSelectedCreator(creator);
    setConnecting(true);

    try {
      // Notify the creator about the incoming call
      const token = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/calls/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          creatorId: creator.id,
          callType: callType,
          creatorUsername: creator.username
        })
      });

      if (response.ok) {
        const data = await response.json();
        // toast.success(`Connecting to ${creator.username}...`);
        
        // Call the parent callback with creator and call data
        onCreatorSelect(creator, data);
        onClose();
      } else {
        throw new Error('Failed to initiate call');
      }
    } catch (error) {
      console.error('Error initiating call:', error);
      toast.error('Failed to connect. Please try again.');
    } finally {
      setConnecting(false);
      setSelectedCreator(null);
    }
  };

  const filteredCreators = creators.filter(creator => {
    if (filter === 'online') return creator.isOnline && !creator.isBusy;
    if (filter === 'favorites') return creator.isFavorite;
    return true;
  });

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {callType === 'video' ? (
                  <VideoCameraIcon className="w-8 h-8" />
                ) : (
                  <PhoneIcon className="w-8 h-8" />
                )}
                <div>
                  <h2 className="text-2xl font-bold">
                    Start {callType === 'video' ? 'Video' : 'Voice'} Call
                  </h2>
                  <p className="text-purple-100">
                    Select a creator to connect with
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="mt-4 flex gap-2">
              {[
                { id: 'all', label: 'All Creators', icon: UserGroupIcon },
                { id: 'online', label: 'Available Now', icon: SparklesIcon },
                { id: 'favorites', label: 'Favorites', icon: StarIcon }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    filter === tab.id
                      ? 'bg-white/20 text-white'
                      : 'text-purple-100 hover:bg-white/10'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              </div>
            ) : filteredCreators.length === 0 ? (
              <div className="text-center py-12">
                <UserGroupIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No creators available</p>
                <p className="text-gray-400 text-sm mt-2">Please try again later</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCreators.map(creator => (
                  <motion.div
                    key={creator.id}
                    className={`bg-white border-2 rounded-xl p-4 cursor-pointer transition-all ${
                      creator.isBusy 
                        ? 'border-gray-200 opacity-60' 
                        : creator.isOnline 
                          ? 'border-gray-200 hover:border-purple-400 hover:shadow-lg' 
                          : 'border-gray-200 opacity-75'
                    }`}
                    whileHover={{ scale: creator.isBusy || !creator.isOnline ? 1 : 1.02 }}
                    onClick={() => handleCreatorSelect(creator)}
                  >
                    {/* Creator Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                            {creator.username[0].toUpperCase()}
                          </div>
                          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                            creator.isBusy ? 'bg-red-500' : creator.isOnline ? 'bg-green-500' : 'bg-gray-400'
                          }`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{creator.username}</h3>
                          <p className="text-sm text-gray-500">{creator.category}</p>
                        </div>
                      </div>
                      {creator.isBusy && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
                          Busy
                        </span>
                      )}
                    </div>

                    {/* Creator Info */}
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600 line-clamp-2">{creator.bio}</p>
                      
                      {/* Stats */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-gray-500">
                          <ClockIcon className="w-4 h-4" />
                          <span>{creator.totalCalls} calls</span>
                        </div>
                      </div>

                      {/* Specialties */}
                      <div className="flex flex-wrap gap-1">
                        {creator.specialties.slice(0, 3).map((specialty, index) => (
                          <span
                            key={index}
                            className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full"
                          >
                            {specialty}
                          </span>
                        ))}
                      </div>

                      {/* Pricing */}
                      <div className="pt-2 border-t border-gray-100">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">
                            {callType === 'video' ? 'Video' : 'Voice'} Rate:
                          </span>
                          <span className="font-semibold text-purple-600">
                            ${callType === 'video' ? creator.videoPrice : creator.voicePrice}/min
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Connect Button */}
                    {selectedCreator?.id === creator.id && connecting ? (
                      <div className="mt-3 py-2 bg-purple-100 rounded-lg flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                        <span className="text-sm text-purple-700">Connecting...</span>
                      </div>
                    ) : (
                      <button
                        className={`mt-3 w-full py-2 rounded-lg font-medium text-sm transition-all ${
                          creator.isBusy || !creator.isOnline
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
                        }`}
                        disabled={creator.isBusy || !creator.isOnline}
                      >
                        {creator.isBusy ? 'Currently Busy' : !creator.isOnline ? 'Offline' : 'Connect Now'}
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CreatorSelectionPopup;