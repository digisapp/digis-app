// src/components/pages/SimpleConnectPage.js
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  VideoCameraIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  StarIcon,
  UserGroupIcon,
  ClockIcon,
  HeartIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

const SimpleConnectPage = () => {
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Mock data for creators to avoid API issues
  useEffect(() => {
    const mockCreators = [
      {
        id: 1,
        username: 'sarah_jones',
        display_name: 'Sarah Jones',
        profile_pic_url: 'https://via.placeholder.com/150',
        bio: 'Professional life coach and motivational speaker',
        price_per_min: 5,
        rating: 4.8,
        total_sessions: 250,
        is_online: true,
        categories: ['lifestyle', 'coaching']
      },
      {
        id: 2,
        username: 'mike_tech',
        display_name: 'Mike Chen',
        profile_pic_url: 'https://via.placeholder.com/150',
        bio: 'Tech entrepreneur and startup advisor',
        price_per_min: 10,
        rating: 4.9,
        total_sessions: 180,
        is_online: true,
        categories: ['business', 'technology']
      },
      {
        id: 3,
        username: 'emma_fitness',
        display_name: 'Emma Wilson',
        profile_pic_url: 'https://via.placeholder.com/150',
        bio: 'Certified fitness trainer and nutritionist',
        price_per_min: 3,
        rating: 4.7,
        total_sessions: 420,
        is_online: false,
        categories: ['fitness', 'health']
      },
      {
        id: 4,
        username: 'david_music',
        display_name: 'David Miller',
        profile_pic_url: 'https://via.placeholder.com/150',
        bio: 'Professional musician and music teacher',
        price_per_min: 4,
        rating: 4.6,
        total_sessions: 150,
        is_online: true,
        categories: ['music', 'education']
      },
      {
        id: 5,
        username: 'lisa_art',
        display_name: 'Lisa Anderson',
        profile_pic_url: 'https://via.placeholder.com/150',
        bio: 'Digital artist and creative director',
        price_per_min: 6,
        rating: 4.9,
        total_sessions: 320,
        is_online: false,
        categories: ['art', 'creative']
      },
      {
        id: 6,
        username: 'alex_gaming',
        display_name: 'Alex Thompson',
        profile_pic_url: 'https://via.placeholder.com/150',
        bio: 'Pro gamer and gaming coach',
        price_per_min: 2,
        rating: 4.5,
        total_sessions: 890,
        is_online: true,
        categories: ['gaming', 'entertainment']
      }
    ];

    setCreators(mockCreators);
  }, []);

  const categories = [
    { id: 'all', name: 'All', icon: SparklesIcon },
    { id: 'lifestyle', name: 'Lifestyle', icon: HeartIcon },
    { id: 'business', name: 'Business', icon: UserGroupIcon },
    { id: 'fitness', name: 'Fitness', icon: SparklesIcon },
    { id: 'education', name: 'Education', icon: StarIcon },
    { id: 'entertainment', name: 'Entertainment', icon: VideoCameraIcon }
  ];

  const filteredCreators = selectedCategory === 'all' 
    ? creators 
    : creators.filter(c => c.categories?.includes(selectedCategory));

  const handleConnect = (creator) => {
    console.log('Connecting to:', creator.display_name);
    // Handle connection logic here
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-40">
        <div className="px-4 py-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Connect with Creators
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Find and connect with amazing creators
          </p>
        </div>

        {/* Category Filters */}
        <div className="px-4 pb-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <motion.button
                  key={category.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap
                    transition-colors duration-200
                    ${selectedCategory === category.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{category.name}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Creators Grid */}
      <div className="px-4 py-6">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full" />
          </div>
        ) : filteredCreators.length === 0 ? (
          <div className="text-center py-20">
            <UserGroupIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              No creators found in this category
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCreators.map((creator) => (
              <motion.div
                key={creator.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden"
              >
                {/* Creator Image */}
                <div className="relative h-48 bg-gradient-to-br from-purple-400 to-pink-400">
                  <img
                    src={creator.profile_pic_url}
                    alt={creator.display_name}
                    className="w-full h-full object-cover"
                  />
                  {creator.is_online && (
                    <div className="absolute top-3 right-3 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      Online
                    </div>
                  )}
                </div>

                {/* Creator Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                    {creator.display_name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                    {creator.bio}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <StarIconSolid
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.floor(creator.rating)
                              ? 'text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                      <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
                        {creator.rating}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                      <ClockIcon className="w-4 h-4" />
                      {creator.total_sessions} sessions
                    </div>
                  </div>

                  {/* Price and Connect Button */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-purple-600 dark:text-purple-400 font-semibold">
                      ${creator.price_per_min}/min
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleConnect(creator)}
                      className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl transition-colors"
                    >
                      <VideoCameraIcon className="w-4 h-4" />
                      Connect
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleConnectPage;