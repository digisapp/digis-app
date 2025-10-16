import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  UserCircleIcon,
  GlobeAltIcon,
  CalendarIcon,
  ChatBubbleBottomCenterTextIcon,
  FireIcon,
  GiftIcon,
  MapPinIcon,
  LockClosedIcon,
  SparklesIcon,
  HeartIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { getAuthToken } from '../../utils/auth-helpers';

const FanProfilePage = ({ user: currentUser }) => {
  const { username } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [stats, setStats] = useState({
    tipsGiven: 0,
    commentsPosted: 0,
    topCreatorSupported: null,
    memberSince: null
  });

  useEffect(() => {
    fetchFanProfile();
  }, [username]);

  const fetchFanProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/users/fan-profile/${username}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError('Fan profile not found');
        } else if (response.status === 403) {
          setError('This profile is private');
        } else {
          setError('Failed to load profile');
        }
        return;
      }

      const data = await response.json();
      setProfile(data.profile);
      setStats(data.stats || {});
      setIsFollowing(data.isFollowing || false);
    } catch (err) {
      console.error('Error fetching fan profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUser) {
      toast.error('Please sign in to follow this user');
      return;
    }

    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/users/follow/${profile.id}`,
        {
          method: isFollowing ? 'DELETE' : 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      if (response.ok) {
        setIsFollowing(!isFollowing);
        toast.success(isFollowing ? 'Unfollowed' : 'Following!');
      }
    } catch (err) {
      console.error('Error following user:', err);
      toast.error('Failed to follow user');
    }
  };

  const getDefaultAvatar = (name) => {
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%239333ea'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='white' font-size='50' font-family='system-ui'%3E${initial}%3C/text%3E%3C/svg%3E`;
  };

  const formatMemberSince = (dateString) => {
    if (!dateString) return 'Recently joined';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Loading Profile - Digis</title>
          <meta name="robots" content="noindex,nofollow" />
        </Helmet>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 dark:from-gray-900 dark:to-purple-900/20 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-purple-200 dark:border-purple-800 border-t-purple-600 dark:border-t-purple-400 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading profile...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    const is404 = error.includes('not found');
    const is403 = error.includes('private');

    return (
      <>
        <Helmet>
          <title>{is404 ? 'Profile Not Found' : 'Private Profile'} - Digis</title>
          <meta name="robots" content="noindex,nofollow" />
        </Helmet>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 dark:from-gray-900 dark:to-purple-900/20 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              is403
                ? 'bg-purple-100 dark:bg-purple-900/30'
                : 'bg-red-100 dark:bg-red-900/20'
            }`}>
              <LockClosedIcon className={`w-10 h-10 ${
                is403
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-red-600 dark:text-red-400'
              }`} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {is404 ? 'Profile Not Found' : 'This Profile is Private'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {is404
                ? "This user doesn't exist or may have changed their username."
                : 'This user has set their profile to private. Follow them to view their profile.'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-lg"
            >
              Go to Home
            </button>
          </div>
        </div>
      </>
    );
  }

  // Check if profile is public for SEO
  const isPublic = profile?.profile_visibility === 'public';
  const pageTitle = `@${profile?.username || username} - Digis Fan Profile`;
  const pageDescription = profile?.bio || `View ${profile?.display_name || profile?.username}'s fan profile on Digis`;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />

        {/* Robots meta - only index if profile is public */}
        {isPublic ? (
          <meta name="robots" content="index,follow" />
        ) : (
          <meta name="robots" content="noindex,nofollow" />
        )}

        {/* Open Graph tags for social sharing (only for public profiles) */}
        {isPublic && (
          <>
            <meta property="og:title" content={pageTitle} />
            <meta property="og:description" content={pageDescription} />
            <meta property="og:type" content="profile" />
            <meta property="og:url" content={`https://digis.cc/u/${username}`} />
            {profile?.profile_pic_url && (
              <meta property="og:image" content={profile.profile_pic_url} />
            )}
            <meta property="og:site_name" content="Digis" />

            {/* Twitter Card tags */}
            <meta name="twitter:card" content="summary" />
            <meta name="twitter:title" content={pageTitle} />
            <meta name="twitter:description" content={pageDescription} />
            {profile?.profile_pic_url && (
              <meta name="twitter:image" content={profile.profile_pic_url} />
            )}
          </>
        )}
      </Helmet>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden mb-6"
        >
          {/* Banner Background */}
          <div className="h-32 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 relative">
            <div className="absolute inset-0 bg-black/10"></div>
          </div>

          {/* Profile Content */}
          <div className="relative px-6 pb-6">
            {/* Profile Picture */}
            <div className="flex items-end justify-between -mt-16 mb-4">
              <div className="relative">
                <div className="w-32 h-32 rounded-full border-4 border-white dark:border-gray-800 bg-white dark:bg-gray-800 overflow-hidden shadow-xl">
                  <img
                    src={profile.profile_pic_url || getDefaultAvatar(profile.display_name || profile.username)}
                    alt={profile.display_name || profile.username}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = getDefaultAvatar(profile.display_name || profile.username);
                    }}
                  />
                </div>
                {profile.is_online && (
                  <div className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 border-4 border-white dark:border-gray-800 rounded-full"></div>
                )}
              </div>

              {/* Follow Button */}
              {currentUser && currentUser.id !== profile.id && (
                <button
                  onClick={handleFollow}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                    isFollowing
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <HeartIconSolid className="w-5 h-5" />
                      Following
                    </>
                  ) : (
                    <>
                      <HeartIcon className="w-5 h-5" />
                      Follow
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Name and Username */}
            <div className="mb-4">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {profile.display_name || profile.username}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                @{profile.username}
              </p>
            </div>

            {/* Badges */}
            {profile.badges && profile.badges.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {profile.badges.map((badge, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30 text-yellow-800 dark:text-yellow-200 rounded-full text-sm font-medium"
                  >
                    {badge.icon} {badge.label}
                  </span>
                ))}
              </div>
            )}

            {/* Bio */}
            {profile.bio && (
              <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                {profile.bio}
              </p>
            )}
          </div>
        </motion.div>

        {/* Stats Row */}
        {profile.profile_visibility !== 'private' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 text-center">
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                  <GiftIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {stats.tipsGiven?.toLocaleString() || '0'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Tips Given</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 text-center">
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <ChatBubbleBottomCenterTextIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {stats.commentsPosted?.toLocaleString() || '0'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Comments</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 text-center">
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                  <FireIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white mb-1 truncate">
                {stats.topCreatorSupported ? `@${stats.topCreatorSupported}` : 'N/A'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Top Supported</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 text-center">
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <CalendarIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                {formatMemberSince(stats.memberSince || profile.created_at)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Member Since</p>
            </div>
          </motion.div>
        )}

        {/* About Me Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <SparklesIcon className="w-6 h-6 text-purple-600" />
            About Me
          </h2>

          <div className="space-y-4">
            {profile.about_me ? (
              <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                  {profile.about_me}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400 text-center">
                  No about me section yet
                </p>
              </div>
            )}

            {/* Location */}
            {profile.location && (
              <div className="flex items-center gap-3">
                <MapPinIcon className="w-5 h-5 text-gray-400" />
                <span className="text-gray-700 dark:text-gray-300">
                  {profile.location}
                </span>
              </div>
            )}

            {/* Interests */}
            {profile.interests && profile.interests.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Interests
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((interest, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm"
                    >
                      #{interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Fan Rank */}
            {profile.fan_rank && (
              <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                    <SparklesIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Fan Rank</p>
                    <p className="font-bold text-gray-900 dark:text-white">
                      {profile.fan_rank}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Support History - Future Upgrade Placeholder */}
        {profile.profile_visibility === 'public' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Top Creators Supported
            </h2>
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <HeartIcon className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                Support history coming soon
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
    </>
  );
};

export default FanProfilePage;
