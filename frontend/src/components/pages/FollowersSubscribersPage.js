import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  UserGroupIcon,
  UsersIcon,
  StarIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { getAuthToken } from '../../utils/auth-helpers';
import { isSelf } from '../../utils/creatorFilters';

const FollowersSubscribersPage = ({ user, isCreator, initialTab }) => {
  const { type } = useParams();
  const navigate = useNavigate();
  // Use initialTab prop if provided, otherwise use type from params, default to 'followers'
  const defaultTab = initialTab || type || 'followers';
  const [activeTab, setActiveTab] = useState(defaultTab === 'subscribers' ? 'subscribers' : 'followers');
  const [followers, setFollowers] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    followersCount: 0,
    subscribersCount: 0
  });

  useEffect(() => {
    // Update activeTab when initialTab or type changes
    if (initialTab) {
      setActiveTab(initialTab);
    } else if (type) {
      setActiveTab(type);
    }
  }, [type, initialTab]);

  useEffect(() => {
    if (isCreator) {
      fetchFollowers();
      fetchSubscribers();
      fetchStats();
    }
  }, [user, isCreator]);

  const fetchStats = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/creators/stats`,
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
        `${import.meta.env.VITE_BACKEND_URL}/creators/followers`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFollowers(data.followers || []);
      } else {
        console.error('Failed to fetch followers');
      }
    } catch (error) {
      console.error('Error fetching followers:', error);
      toast.error('Failed to load followers');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscribers = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/creators/subscribers`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSubscribers(data.subscribers || []);
      } else {
        console.error('Failed to fetch subscribers');
      }
    } catch (error) {
      console.error('Error fetching subscribers:', error);
      toast.error('Failed to load subscribers');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    navigate(`/${tab}`);
  };

  const filteredFollowers = followers.filter(follower => {
    // IMPORTANT: Filter out the creator's own account from followers list
    // Creators should not see themselves following themselves
    if (isSelf(follower, user?.id, user?.username)) {
      return false;
    }

    return follower.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           follower.displayName?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredSubscribers = subscribers.filter(subscriber => {
    // IMPORTANT: Filter out the creator's own account from subscribers list
    // Creators should not see themselves subscribing to themselves
    if (isSelf(subscriber, user?.id, user?.username)) {
      return false;
    }

    return subscriber.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           subscriber.displayName?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const UserCard = ({ userData, isSubscriber = false }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-400 transition-all duration-200 cursor-pointer"
      onClick={() => navigate(`/${userData.username}`)}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          {userData.avatar ? (
            <img
              src={userData.avatar}
              alt={userData.displayName || userData.username}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
              {(userData.displayName || userData.username || 'U')[0].toUpperCase()}
            </div>
          )}
          {userData.isVerified && (
            <CheckBadgeIcon className="absolute -bottom-1 -right-1 w-5 h-5 text-blue-500 bg-white dark:bg-gray-800 rounded-full" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 dark:text-white truncate">
              {userData.displayName || userData.username}
            </p>
            {isSubscriber && userData.tier && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                {userData.tier}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            @{userData.username}
          </p>
          {isSubscriber && userData.subscribedAt && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Subscribed {new Date(userData.subscribedAt).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="text-right">
          {isSubscriber && userData.monthlyRevenue && (
            <p className="text-sm font-semibold text-green-600 dark:text-green-400">
              ${userData.monthlyRevenue}/mo
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );

  // Remove unnecessary creator check - if they can access this page, they have the right permissions

  return (
    <div className="space-y-6 content-below-nav px-4 sm:px-6 lg:px-8">
      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => handleTabChange('followers')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'followers'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <UsersIcon className="w-5 h-5" />
              <span>Followers ({stats.followersCount})</span>
            </div>
          </button>
          <button
            onClick={() => handleTabChange('subscribers')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'subscribers'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <StarIcon className="w-5 h-5" />
              <span>Subscribers ({stats.subscribersCount})</span>
            </div>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1 relative min-w-0">
            <input
              type="search"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-8 sm:pl-10 pr-10 sm:pr-12 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-xs sm:text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            />
            <MagnifyingGlassIcon className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {activeTab === 'followers' ? (
                filteredFollowers.length > 0 ? (
                  filteredFollowers.map((follower) => (
                    <UserCard key={follower.id} userData={follower} />
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    {searchQuery ? 'No followers found matching your search' : 'No followers yet'}
                  </div>
                )
              ) : (
                filteredSubscribers.length > 0 ? (
                  filteredSubscribers.map((subscriber) => (
                    <UserCard key={subscriber.id} userData={subscriber} isSubscriber={true} />
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    {searchQuery ? 'No subscribers found matching your search' : 'No subscribers yet'}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowersSubscribersPage;