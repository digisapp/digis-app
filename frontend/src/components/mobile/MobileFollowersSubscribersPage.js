import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserGroupIcon,
  UsersIcon,
  StarIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { getAuthToken } from '../../utils/auth-helpers';

const MobileFollowersSubscribersPage = ({ user }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'subscribers';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [followers, setFollowers] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    followersCount: 0,
    subscribersCount: 0
  });

  useEffect(() => {
    fetchFollowers();
    fetchSubscribers();
    fetchStats();
  }, [user]);

  const fetchStats = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/creators/stats`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats({
          followersCount: data.followersCount || 0,
          subscribersCount: data.subscribersCount || 0
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchFollowers = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/creators/followers`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Mock data for demonstration
        setFollowers([
          {
            id: 1,
            username: 'johndoe',
            displayName: 'John Doe',
            avatar: null,
            isVerified: true,
            followedAt: new Date()
          },
          {
            id: 2,
            username: 'sarahmiller',
            displayName: 'Sarah Miller',
            avatar: null,
            isVerified: false,
            followedAt: new Date()
          },
          {
            id: 3,
            username: 'mikewilson',
            displayName: 'Mike Wilson',
            avatar: null,
            isVerified: false,
            followedAt: new Date()
          }
        ]);
        setStats(prev => ({ ...prev, followersCount: 3 }));
      }
    } catch (error) {
      console.error('Error fetching followers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscribers = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/creators/subscribers`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Mock data for demonstration
        setSubscribers([
          {
            id: 1,
            username: 'alexsmith',
            displayName: 'Alex Smith',
            avatar: null,
            isVerified: true,
            tier: 'Gold',
            subscribedAt: new Date(),
            monthlyRevenue: 9.99
          },
          {
            id: 2,
            username: 'emmastone',
            displayName: 'Emma Stone',
            avatar: null,
            isVerified: false,
            tier: 'Silver',
            subscribedAt: new Date(),
            monthlyRevenue: 4.99
          }
        ]);
        setStats(prev => ({ ...prev, subscribersCount: 2 }));
      }
    } catch (error) {
      console.error('Error fetching subscribers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = (userId, username) => {
    navigate(`/messages?user=${username}`);
  };

  const filteredFollowers = followers.filter(follower =>
    follower.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    follower.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSubscribers = subscribers.filter(subscriber =>
    subscriber.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    subscriber.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const UserCard = ({ userData, isSubscriber = false }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700"
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative">
          {userData.avatar ? (
            <img
              src={userData.avatar}
              alt={userData.displayName || userData.username}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-lg">
              {(userData.displayName || userData.username || 'U')[0].toUpperCase()}
            </div>
          )}
          {userData.isVerified && (
            <CheckBadgeIcon className="absolute -bottom-1 -right-1 w-5 h-5 text-blue-500 bg-white dark:bg-gray-800 rounded-full" />
          )}
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">
              {userData.displayName || userData.username}
            </p>
            {isSubscriber && userData.tier && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                userData.tier === 'Gold' ? 'bg-yellow-100 text-yellow-700' :
                userData.tier === 'Silver' ? 'bg-gray-100 text-gray-700' :
                'bg-purple-100 text-purple-700'
              }`}>
                {userData.tier}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            @{userData.username}
          </p>
          {isSubscriber && userData.monthlyRevenue && (
            <div className="flex items-center gap-1 mt-1">
              <CurrencyDollarIcon className="w-3 h-3 text-green-600" />
              <span className="text-xs font-semibold text-green-600">
                ${userData.monthlyRevenue}/mo
              </span>
            </div>
          )}
        </div>

        {/* Message Button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            handleMessage(userData.id, userData.username);
          }}
          className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
        >
          <ChatBubbleLeftRightIcon className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Followers & Subscribers
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('subscribers')}
            className={`flex-1 px-4 py-3 font-medium text-sm transition-colors relative ${
              activeTab === 'subscribers'
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              <StarIcon className="w-4 h-4" />
              <span>Subscribers</span>
              <span className="ml-1 text-xs">({stats.subscribersCount})</span>
            </div>
            {activeTab === 'subscribers' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('followers')}
            className={`flex-1 px-4 py-3 font-medium text-sm transition-colors relative ${
              activeTab === 'followers'
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              <UsersIcon className="w-4 h-4" />
              <span>Followers</span>
              <span className="ml-1 text-xs">({stats.followersCount})</span>
            </div>
            {activeTab === 'followers' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400" />
            )}
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-gray-50 dark:bg-gray-900">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <div className="space-y-3">
              {activeTab === 'subscribers' ? (
                filteredSubscribers.length > 0 ? (
                  filteredSubscribers.map((subscriber) => (
                    <UserCard key={subscriber.id} userData={subscriber} isSubscriber={true} />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <StarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      {searchQuery ? 'No subscribers found matching your search' : 'No subscribers yet'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Subscribers support your content monthly
                    </p>
                  </div>
                )
              ) : (
                filteredFollowers.length > 0 ? (
                  filteredFollowers.map((follower) => (
                    <UserCard key={follower.id} userData={follower} />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <UsersIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      {searchQuery ? 'No followers found matching your search' : 'No followers yet'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Followers stay updated with your content
                    </p>
                  </div>
                )
              )}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default MobileFollowersSubscribersPage;