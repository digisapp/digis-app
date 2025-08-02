import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  PlayIcon,
  LockClosedIcon,
  PhotoIcon,
  VideoCameraIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  SparklesIcon,
  CheckCircleIcon,
  HeartIcon,
  EyeIcon,
  ShoppingBagIcon,
  ArrowLeftIcon,
  CurrencyDollarIcon,
  BellIcon,
  ShareIcon,
  EllipsisHorizontalIcon,
  CalendarIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import api from '../services/api';
import toast from 'react-hot-toast';
import Auth from './Auth';
import TokenPurchase from './TokenPurchase';

const CreatorPublicProfile = ({ user, username, onAuthRequired }) => {
  const navigate = useNavigate();
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pictures, setPictures] = useState([]);
  const [videos, setVideos] = useState([]);
  const [selectedPicture, setSelectedPicture] = useState(0);
  const [purchasedContent, setPurchasedContent] = useState(new Set());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showTokenPurchase, setShowTokenPurchase] = useState(false);
  const [authAction, setAuthAction] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  useEffect(() => {
    const fetchCreatorProfile = async () => {
      try {
        setLoading(true);
        
        // Fetch creator content from API
        const response = await api.get(`/content/creator/${username}`);
        
        if (response.data) {
          const { creator, pictures, videos } = response.data;
          
          // Transform the data to match our component structure
          const transformedCreator = {
            id: creator.id,
            username: creator.username,
            displayName: creator.displayName || creator.display_name,
            bio: creator.bio,
            profilePic: creator.profilePic || creator.profile_pic_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
            coverPhoto: `https://source.unsplash.com/1600x400/?abstract,${username}`,
            stats: {
              followers: 12500, // TODO: Get from API
              posts: pictures.length + videos.length,
              likes: 45200, // TODO: Get from API
              totalViews: 325000, // TODO: Get from API
              joinedDate: new Date('2023-06-15') // TODO: Get from API
            },
            rates: {
              videoCall: 5, // TODO: Get from user settings
              voiceCall: 3,
              message: 1,
              picture: 10,
              video: 25
            },
            isOnline: true,
            lastSeen: new Date()
          };
          
          // Transform pictures
          const transformedPictures = pictures.map(pic => ({
            id: pic.id,
            thumbnail: pic.thumbnail_url,
            price: parseFloat(pic.price),
            isLocked: !pic.is_purchased,
            likes: pic.likes || 0,
            description: pic.title,
            isPurchased: pic.is_purchased
          }));
          
          // Transform videos
          const transformedVideos = videos.map(vid => ({
            id: vid.id,
            thumbnail: vid.thumbnail_url,
            duration: vid.duration || '0:00',
            price: parseFloat(vid.price),
            isLocked: !vid.is_purchased,
            views: vid.views || 0,
            title: vid.title,
            date: new Date(vid.created_at),
            isPurchased: vid.is_purchased
          }));
          
          setCreator(transformedCreator);
          setPictures(transformedPictures);
          setVideos(transformedVideos);
          
          // Update purchased content set
          const purchasedIds = new Set([
            ...transformedPictures.filter(p => p.isPurchased).map(p => p.id),
            ...transformedVideos.filter(v => v.isPurchased).map(v => v.id)
          ]);
          setPurchasedContent(purchasedIds);
        }
      } catch (error) {
        console.error('Error fetching creator profile:', error);
        
        // Fallback to mock data for now
        const mockCreator = {
          id: '1',
          username: username,
          displayName: username.charAt(0).toUpperCase() + username.slice(1),
          bio: "✨ Content Creator | 🎬 Live Streamer | 💫 Your favorite digital companion",
          profilePic: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
          coverPhoto: `https://source.unsplash.com/1600x400/?abstract,${username}`,
          stats: {
            followers: 12500,
            posts: 342,
            likes: 45200,
            totalViews: 325000,
            joinedDate: new Date('2023-06-15')
          },
          rates: {
            videoCall: 5,
            voiceCall: 3,
            message: 1,
            picture: 10,
            video: 25
          },
          isOnline: true,
          lastSeen: new Date()
        };

        const mockPictures = Array.from({ length: 8 }, (_, i) => ({
          id: `pic-${i}`,
          thumbnail: `https://source.unsplash.com/400x600/?portrait,model&sig=${i}`,
          price: 10 + (i * 2),
          isLocked: true,
          likes: Math.floor(Math.random() * 1000),
          description: `Exclusive photo #${i + 1}`
        }));

        const mockVideos = Array.from({ length: 6 }, (_, i) => ({
          id: `vid-${i}`,
          thumbnail: `https://source.unsplash.com/600x400/?video,stream&sig=${i}`,
          duration: `${Math.floor(Math.random() * 10 + 5)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
          price: 25 + (i * 5),
          isLocked: true,
          views: Math.floor(Math.random() * 5000),
          title: `Stream Highlights #${i + 1}`,
          date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
        }));

        setCreator(mockCreator);
        setPictures(mockPictures);
        setVideos(mockVideos);
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      fetchCreatorProfile();
    }
  }, [username]);

  const handleInteraction = (action, data) => {
    if (!user) {
      setAuthAction({ action, data });
      setShowAuthModal(true);
      return false;
    }
    return true;
  };

  const handlePurchasePicture = async (picture) => {
    if (!handleInteraction('purchase_picture', picture)) return;

    // Check token balance
    if (user.tokenBalance < picture.price) {
      setShowTokenPurchase(true);
      return;
    }

    try {
      // API call to purchase picture
      await api.post('/content/purchase', {
        contentId: picture.id,
        contentType: 'picture',
        price: picture.price
      });

      setPurchasedContent(prev => new Set([...prev, picture.id]));
      // toast.success(`Picture unlocked for ${picture.price} tokens!`);
    } catch (error) {
      toast.error('Failed to purchase picture');
    }
  };

  const handlePurchaseVideo = async (video) => {
    if (!handleInteraction('purchase_video', video)) return;

    // Check token balance
    if (user.tokenBalance < video.price) {
      setShowTokenPurchase(true);
      return;
    }

    try {
      // API call to purchase video
      await api.post('/content/purchase', {
        contentId: video.id,
        contentType: 'video',
        price: video.price
      });

      setPurchasedContent(prev => new Set([...prev, video.id]));
      // toast.success(`Video unlocked for ${video.price} tokens!`);
    } catch (error) {
      toast.error('Failed to purchase video');
    }
  };

  const handleStartVideoCall = () => {
    if (!handleInteraction('video_call', creator)) return;
    navigate(`/video-call/${creator.username}`);
  };

  const handleStartVoiceCall = () => {
    if (!handleInteraction('voice_call', creator)) return;
    navigate(`/voice-call/${creator.username}`);
  };

  const handleSendMessage = () => {
    if (!handleInteraction('message', creator)) return;
    navigate(`/messages/${creator.username}`);
  };

  const handleFollow = async () => {
    if (!handleInteraction('follow', creator)) return;

    try {
      if (isFollowing) {
        await api.delete(`/creators/${creator.id}/unfollow`);
        setIsFollowing(false);
        // toast.success('Unfollowed creator');
      } else {
        await api.post(`/creators/${creator.id}/follow`);
        setIsFollowing(true);
        // toast.success('Following creator!');
      }
    } catch (error) {
      toast.error('Failed to update follow status');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading creator profile...</p>
        </div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Creator not found</h2>
          <p className="text-gray-400 mb-4">The creator @{username} doesn't exist</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Cover Photo */}
      <div className="relative h-64 md:h-80">
        <img
          src={creator.coverPhoto}
          alt="Cover"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent"></div>
        
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 p-2 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors"
        >
          <ArrowLeftIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Profile Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
        <div className="bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Profile Picture */}
            <div className="relative">
              <img
                src={creator.profilePic}
                alt={creator.displayName}
                className="w-32 h-32 rounded-2xl object-cover border-4 border-gray-700"
              />
              {creator.isOnline && (
                <div className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800"></div>
              )}
            </div>

            {/* Creator Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-3xl font-bold text-white">{creator.displayName}</h1>
                    {/* Verified Badge */}
                    <div className="flex items-center gap-2">
                      <div className="bg-purple-600 rounded-full p-1">
                        <CheckCircleIcon className="h-5 w-5 text-white" />
                      </div>
                      <span className="text-sm text-purple-400 font-medium">Verified Creator</span>
                    </div>
                  </div>
                  <p className="text-purple-400 mb-3">@{creator.username}</p>
                  <p className="text-gray-300 mb-2">{creator.bio}</p>
                  <div className="flex items-center gap-4 mb-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="h-4 w-4" />
                      Member since {creator.stats.joinedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-1">
                      <EyeIcon className="h-4 w-4" />
                      {creator.stats.totalViews?.toLocaleString() || '0'} total views
                    </span>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {/* More Options */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowShareMenu(!showShareMenu)}
                    className="p-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors relative"
                  >
                    <EllipsisHorizontalIcon className="h-5 w-5" />
                    
                    {showShareMenu && (
                      <div className="absolute top-full right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden z-20">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(window.location.href);
                            // toast.success('Profile link copied!');
                            setShowShareMenu(false);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-2"
                        >
                          <ShareIcon className="h-4 w-4" />
                          Share Profile
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            // Report functionality
                            toast.info('Report feature coming soon');
                            setShowShareMenu(false);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                        >
                          Report
                        </button>
                      </div>
                    )}
                  </motion.button>
                  
                  {/* Notifications */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (!user) {
                        handleInteraction('notifications', creator);
                      } else {
                        setNotificationsEnabled(!notificationsEnabled);
                        // toast.success(notificationsEnabled ? 'Notifications disabled' : 'Notifications enabled');
                      }
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      notificationsEnabled
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                  >
                    <BellIcon className="h-5 w-5" />
                  </motion.button>
                  
                  {/* Follow Button */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleFollow}
                    className={`px-6 py-2 rounded-lg font-medium transition-all ${
                      isFollowing
                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </motion.button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{creator.stats.followers.toLocaleString()}</div>
                  <div className="text-sm text-gray-400">Followers</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{creator.stats.posts}</div>
                  <div className="text-sm text-gray-400">Posts</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{creator.stats.likes.toLocaleString()}</div>
                  <div className="text-sm text-gray-400">Likes</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleStartVideoCall}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <VideoCameraIcon className="h-5 w-5" />
                  Video Call ({creator.rates.videoCall} tokens/min)
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleStartVoiceCall}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <PhoneIcon className="h-5 w-5" />
                  Voice Call ({creator.rates.voiceCall} tokens/min)
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSendMessage}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ChatBubbleLeftRightIcon className="h-5 w-5" />
                  Message ({creator.rates.message} token)
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleInteraction('tip', creator)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-colors"
                >
                  <SparklesIcon className="h-5 w-5" />
                  Send Tip
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        {/* Creator Tags/Interests */}
        <div className="mt-6 bg-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Creator Interests</h3>
          <div className="flex flex-wrap gap-2">
            {['Fitness', 'Gaming', 'Lifestyle', 'Fashion', 'Travel', 'Music'].map((tag) => (
              <span
                key={tag}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-full text-sm hover:bg-gray-600 transition-colors cursor-pointer"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Subscription Tiers */}
        <div className="mt-6 bg-gradient-to-br from-purple-900/20 to-pink-900/20 rounded-2xl p-6 border border-purple-800/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-purple-400" />
            Subscribe for Exclusive Benefits
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: 'Bronze', price: 4.99, color: 'from-orange-600 to-orange-700', perks: ['Access to subscriber-only content', 'Priority messages', 'Monthly exclusive photo'] },
              { name: 'Silver', price: 9.99, color: 'from-gray-400 to-gray-500', perks: ['All Bronze benefits', '50% off PPV content', 'Weekly live streams', 'Custom shoutout'] },
              { name: 'Gold', price: 19.99, color: 'from-yellow-500 to-yellow-600', perks: ['All Silver benefits', 'Free PPV content', 'Daily content', '1-on-1 monthly video call'] }
            ].map((tier) => (
              <motion.div
                key={tier.name}
                whileHover={{ y: -5 }}
                className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 hover:border-purple-600 transition-colors"
              >
                <div className={`bg-gradient-to-r ${tier.color} text-white text-sm font-bold px-3 py-1 rounded-full inline-block mb-3`}>
                  {tier.name}
                </div>
                <div className="text-2xl font-bold text-white mb-3">${tier.price}<span className="text-sm font-normal text-gray-400">/month</span></div>
                <ul className="space-y-2">
                  {tier.perks.map((perk, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleInteraction('subscribe', { creator, tier })}
                  className="w-full mt-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                >
                  Subscribe
                </motion.button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Content Tabs */}
        <div className="mt-8 border-b border-gray-700">
          <div className="flex gap-8">
            <button className="pb-4 text-purple-400 border-b-2 border-purple-400 font-medium">
              <span className="flex items-center gap-2">
                <PhotoIcon className="h-5 w-5" />
                Photos ({pictures.length})
              </span>
            </button>
            <button className="pb-4 text-gray-400 hover:text-gray-300 font-medium transition-colors">
              <span className="flex items-center gap-2">
                <VideoCameraIcon className="h-5 w-5" />
                Videos ({videos.length})
              </span>
            </button>
            <button className="pb-4 text-gray-400 hover:text-gray-300 font-medium transition-colors">
              <span className="flex items-center gap-2">
                <SparklesIcon className="h-5 w-5" />
                Live Streams
              </span>
            </button>
          </div>
        </div>

        {/* Pay-Per-View Pictures Section */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <PhotoIcon className="h-6 w-6 text-purple-400" />
            Exclusive Photos
          </h2>
          
          {/* Vertical Carousel - Mobile Optimized */}
          <div className="bg-gray-800 rounded-2xl p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Main Selected Picture */}
              <div className="relative aspect-[3/4] bg-gray-900 rounded-xl overflow-hidden order-2 md:order-1">
                {pictures[selectedPicture] && (
                  <>
                    <img
                      src={pictures[selectedPicture].thumbnail}
                      alt={pictures[selectedPicture].description}
                      className={`w-full h-full object-cover ${
                        !purchasedContent.has(pictures[selectedPicture].id) ? 'blur-2xl' : ''
                      }`}
                    />
                    {!purchasedContent.has(pictures[selectedPicture].id) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handlePurchasePicture(pictures[selectedPicture])}
                          className="flex flex-col items-center gap-2 px-6 py-4 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
                        >
                          <LockClosedIcon className="h-8 w-8" />
                          <span className="font-semibold">Unlock for {pictures[selectedPicture].price} tokens</span>
                        </motion.button>
                      </div>
                    )}
                    {/* Picture Info */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-white font-medium">{pictures[selectedPicture].description}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-300">
                        <span className="flex items-center gap-1">
                          <HeartIcon className="h-4 w-4" />
                          {pictures[selectedPicture].likes}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Thumbnail Grid - Mobile Optimized */}
              <div className="grid grid-cols-3 sm:grid-cols-2 gap-2 md:gap-3 auto-rows-min order-1 md:order-2">
                {pictures.map((picture, index) => (
                  <motion.div
                    key={picture.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedPicture(index)}
                    className={`relative aspect-[3/4] bg-gray-900 rounded-lg overflow-hidden cursor-pointer ${
                      selectedPicture === index ? 'ring-2 ring-purple-500' : ''
                    }`}
                  >
                    <img
                      src={picture.thumbnail}
                      alt={picture.description}
                      className={`w-full h-full object-cover ${
                        !purchasedContent.has(picture.id) ? 'blur-xl' : ''
                      }`}
                    />
                    {!purchasedContent.has(picture.id) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <div className="text-center">
                          <LockClosedIcon className="h-6 w-6 text-white mx-auto mb-1" />
                          <span className="text-xs text-white font-medium">{picture.price} tokens</span>
                        </div>
                      </div>
                    )}
                    {purchasedContent.has(picture.id) && (
                      <div className="absolute top-2 right-2">
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
            
            {/* Empty State */}
            {pictures.length === 0 && (
              <div className="col-span-2 flex flex-col items-center justify-center py-16 text-center">
                <PhotoIcon className="h-16 w-16 text-gray-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-300 mb-2">No photos yet</h3>
                <p className="text-gray-400">Check back later for exclusive content</p>
              </div>
            )}
          </div>
        </div>

        {/* Pay-Per-View Videos Section */}
        <div className="mt-8 mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <VideoCameraIcon className="h-6 w-6 text-purple-400" />
            Stream Recordings & Videos
          </h2>
          
          {/* Horizontal Video Grid - Mobile Optimized */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {videos.map((video) => (
              <motion.div
                key={video.id}
                whileHover={{ scale: 1.02 }}
                className="bg-gray-800 rounded-xl overflow-hidden group"
              >
                <div className="relative aspect-video bg-gray-900">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className={`w-full h-full object-cover ${
                      !purchasedContent.has(video.id) ? 'blur-xl' : ''
                    }`}
                  />
                  {!purchasedContent.has(video.id) ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handlePurchaseVideo(video)}
                        className="flex flex-col items-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <LockClosedIcon className="h-6 w-6" />
                        <span className="font-medium">Unlock for {video.price} tokens</span>
                      </motion.button>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                      <PlayIcon className="h-16 w-16 text-white" />
                    </div>
                  )}
                  {/* Duration Badge */}
                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-white">
                    {video.duration}
                  </div>
                  {purchasedContent.has(video.id) && (
                    <div className="absolute top-2 right-2">
                      <CheckCircleIcon className="h-6 w-6 text-green-500" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-white mb-2">{video.title}</h3>
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <EyeIcon className="h-4 w-4" />
                      {video.views.toLocaleString()} views
                    </span>
                    <span>{new Date(video.date).toLocaleDateString()}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          {/* Empty State */}
          {videos.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <VideoCameraIcon className="h-16 w-16 text-gray-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-300 mb-2">No videos yet</h3>
              <p className="text-gray-400">Stay tuned for upcoming video content</p>
            </div>
          )}
        </div>
      </div>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && setShowAuthModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 rounded-2xl p-8 max-w-md w-full"
            >
              <h2 className="text-2xl font-bold text-white mb-4">Sign in to continue</h2>
              <p className="text-gray-400 mb-6">
                Join Digis to interact with {creator.displayName} and unlock exclusive content
              </p>
              <Auth
                mode="signin"
                onLogin={(user) => {
                  setShowAuthModal(false);
                  if (authAction) {
                    // Retry the action after login
                    if (authAction.action === 'purchase_picture') {
                      handlePurchasePicture(authAction.data);
                    } else if (authAction.action === 'purchase_video') {
                      handlePurchaseVideo(authAction.data);
                    }
                  }
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token Purchase Modal */}
      <AnimatePresence>
        {showTokenPurchase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && setShowTokenPurchase(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-md w-full"
            >
              <TokenPurchase
                user={user}
                onSuccess={() => {
                  setShowTokenPurchase(false);
                  // toast.success('Tokens purchased successfully!');
                }}
                onClose={() => setShowTokenPurchase(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CreatorPublicProfile;