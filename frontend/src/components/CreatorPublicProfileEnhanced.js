import React, { useState, useEffect, useCallback, memo, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  PlayIcon,
  PhotoIcon,
  VideoCameraIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  SparklesIcon,
  CheckCircleIcon,
  CheckIcon,
  HeartIcon,
  EyeIcon,
  ShoppingBagIcon,
  ArrowLeftIcon,
  CurrencyDollarIcon,
  BellIcon,
  ShareIcon,
  EllipsisHorizontalIcon,
  CalendarIcon,
  UserGroupIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  UserPlusIcon,
  UserIcon,
  UserCircleIcon,
  XMarkIcon,
  ClockIcon,
  ArrowRightIcon,
  DocumentIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid, LockClosedIcon } from '@heroicons/react/24/solid';
import api from '../services/api';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { getAuthToken } from '../utils/supabase-auth';
import socketService from '../services/socket';
import toast from 'react-hot-toast';
import Auth from './Auth';
import TokenPurchase from './TokenPurchase';
import CreatorOffers from './CreatorOffers';
import CreatorShopSection from './CreatorShopSection';
import ProfileBanner from './ProfileBanner';
import MessageComposeModal from './MessageComposeModal';
import VideoCallModal from './VideoCallModal';
import VoiceCallModal from './VoiceCallModal';
import TipModal from './TipModal';

// Memoized content item component for better performance
const ContentItem = memo(({ item, index, handleContentClick, purchasedContent, prefersReducedMotion }) => {
  const isPurchased = purchasedContent.has(item.id);
  
  return (
    <motion.div
      key={`${item.type}_${item.id}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        duration: 0.3,
        delay: Math.min(index * 0.05, 0.3) // Cap delay to prevent long waits
      }}
      className="group cursor-pointer"
      onClick={() => handleContentClick(item)}
    >
      <motion.div 
        whileHover={!prefersReducedMotion ? { boxShadow: '0 10px 30px rgba(139,92,246,0.2)' } : {}}
        className={`relative ${item.type === 'photo' ? 'aspect-[3/4]' : 'aspect-[3/4]'} bg-gray-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-violet-200 dark:border-violet-700/50 group-hover:border-violet-400 dark:group-hover:border-violet-500 transition-all`}>
        <img
          src={item.thumbnail || `https://source.unsplash.com/400x${item.type === 'photo' ? '600' : '300'}/?${item.type},${item.id}`}
          alt={item.title || item.description}
          className={`w-full h-full object-cover transition-all duration-300 ${
            !isPurchased && item.price > 0 ? 'blur-md group-hover:blur-sm' : ''
          }`}
          width={item.type === 'photo' ? 400 : 400}
          height={item.type === 'photo' ? 600 : 300}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          loading="lazy"
          decoding="async"
        />
        
        {/* Overlay for locked content */}
        {!isPurchased && item.price > 0 && (
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/50 to-transparent flex items-center justify-center">
            <motion.div
              whileHover={!prefersReducedMotion ? { scale: 1.1 } : {}}
              className="bg-white/10 backdrop-blur-sm p-4 rounded-full"
            >
              <LockClosedIcon className="h-10 w-10 text-white" />
            </motion.div>
          </div>
        )}
        
        {/* Type badge */}
        <div className="absolute top-3 left-3">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${
            item.type === 'photo' 
              ? 'bg-violet-500/80 text-white' 
              : item.type === 'video'
              ? 'bg-pink-500/80 text-white'
              : 'bg-emerald-500/80 text-white'
          }`}>
            {item.type === 'photo' ? 'Photo' : item.type === 'video' ? 'Video' : 'Stream'}
          </span>
        </div>

        {/* Price tag */}
        {item.price > 0 && (
          <div className="absolute top-3 right-3">
            <span className="px-3 py-1 bg-amber-500/90 text-white rounded-full text-xs font-bold backdrop-blur-sm">
              {item.price} tokens
            </span>
          </div>
        )}

        {/* Content Info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-gray-900 via-gray-900/90 to-transparent">
          <p className="text-white text-sm font-medium line-clamp-1">
            {item.title || item.description || 'Exclusive Content'}
          </p>
          {(item.type === 'video' || item.type === 'stream') && (
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-300">
              <span className="flex items-center gap-1">
                <EyeIcon className="h-3 w-3" />
                {item.views || item.viewCount || Math.floor(Math.random() * 5000)} views
              </span>
              {item.duration && (
                <span className="flex items-center gap-1">
                  <ClockIcon className="h-3 w-3" />
                  {item.duration}
                </span>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
});

ContentItem.displayName = 'ContentItem';

const CreatorPublicProfile = memo(({ user, onAuthRequired, username: propUsername, onClose }) => {
  const navigate = useNavigate();
  const { username: urlUsername } = useParams(); // Get username from URL params
  const username = propUsername || urlUsername; // Use prop username if provided, otherwise use URL param
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pictures, setPictures] = useState([]);
  const [videos, setVideos] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [digitals, setDigitals] = useState([]);
  const [selectedPicture, setSelectedPicture] = useState(0);
  const [purchasedContent, setPurchasedContent] = useState(new Set());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showTokenPurchase, setShowTokenPurchase] = useState(false);
  const [authAction, setAuthAction] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shopProducts, setShopProducts] = useState([]);
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);
  const [liveStreamData, setLiveStreamData] = useState(null);
  const [streamPreviewMuted, setStreamPreviewMuted] = useState(true);
  const [hasStreamAccess, setHasStreamAccess] = useState(false);
  const [streamPurchased, setStreamPurchased] = useState(false); // Fixed: Added missing state
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedContentType, setSelectedContentType] = useState('photos');
  const [selectedShopCategory, setSelectedShopCategory] = useState('all');
  const [showLiveNotification, setShowLiveNotification] = useState(false);
  const [newStreamData, setNewStreamData] = useState(null);
  const [showLiveStreamPlayer, setShowLiveStreamPlayer] = useState(false);
  const [showVideoCallModal, setShowVideoCallModal] = useState(false);
  const [showVoiceCallModal, setShowVoiceCallModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState(50);
  const [userTokenBalance, setUserTokenBalance] = useState(0);
  
  // Performance optimization states
  const [contentLoaded, setContentLoaded] = useState(false);
  const [shopLoaded, setShopLoaded] = useState(false);
  const [recordingsLoaded, setRecordingsLoaded] = useState(false);
  const [visibleContentCount, setVisibleContentCount] = useState(12);
  
  const videoRef = useRef(null);
  const shopSectionRef = useRef(null);
  const contentCache = useRef({});

  // Detect reduced motion preference
  const prefersReducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );

  // WebSocket connection for real-time updates using singleton service
  useEffect(() => {
    if (!creator?.id) return;

    let cleanupFunctions = [];

    const setupSocketListeners = async () => {
      try {
        // Connect using the singleton socket service
        await socketService.connect();

        // Join creator's room for updates
        socketService.emit('join_creator_room', creator.id);

        // Clean up previous listeners before adding new ones
        socketService.off('stream_started');
        socketService.off('stream_ended');
        socketService.off('viewer_count_update');

        // Listen for stream start events
        const unsubStreamStart = socketService.on('stream_started', (data) => {
          if (data.creatorId === creator.id) {
            setIsLiveStreaming(true);
            setLiveStreamData({
              title: data.title || 'Live Stream',
              viewerCount: data.viewerCount || 0,
              startTime: new Date(data.startTime),
              isPaidStream: data.isPaidStream || false,
              tokenPrice: data.tokenPrice || 0,
              streamUrl: data.streamUrl,
              streamId: data.streamId
            });
            setNewStreamData(data);
            setShowLiveNotification(true);
            
            // Auto-hide notification after 10 seconds
            setTimeout(() => setShowLiveNotification(false), 10000);
          }
        });
        cleanupFunctions.push(unsubStreamStart);

        // Listen for stream end events
        const unsubStreamEnd = socketService.on('stream_ended', (data) => {
          if (data.creatorId === creator.id) {
            setIsLiveStreaming(false);
            setLiveStreamData(null);
            toast((
              <div>
                <p className="font-semibold">{creator.username}'s stream has ended</p>
                <p className="text-sm">Check out the recording in their content!</p>
              </div>
            ));
          }
        });
        cleanupFunctions.push(unsubStreamEnd);

        // Listen for viewer count updates
        const unsubViewerCount = socketService.on('viewer_count_update', (data) => {
          if (data.creatorId === creator.id && liveStreamData) {
            setLiveStreamData(prev => ({
              ...prev,
              viewerCount: data.viewerCount
            }));
          }
        });
        cleanupFunctions.push(unsubViewerCount);
      } catch (error) {
        console.error('Socket connection error:', error);
      }
    };

    setupSocketListeners();

    return () => {
      // Clean up listeners
      cleanupFunctions.forEach(cleanup => cleanup());
      
      // Leave creator room
      if (creator?.id) {
        socketService.emit('leave_creator_room', creator.id);
      }
    };
  }, [creator?.id, user?.id]);

  // Lazy load recordings
  const loadRecordings = useCallback(async (creatorUsername) => {
    if (recordingsLoaded) return;
    
    try {
      const BASE_URL = import.meta.env.VITE_BACKEND_URL;
      const res = await fetchWithRetry(`${BASE_URL}/api/recording/creator/${creatorUsername}/recordings`).catch(() => null);
      
      if (res?.ok) {
        const data = await res.json();
        setRecordings(data.recordings || []);
        setRecordingsLoaded(true);
      }
    } catch (error) {
      console.error('Error loading recordings:', error);
    }
  }, [recordingsLoaded]);

  // Lazy load shop products
  const loadShopProducts = useCallback(async (creatorUsername) => {
    if (shopLoaded) return;
    
    try {
      const BASE_URL = import.meta.env.VITE_BACKEND_URL;
      // Fetch public shop items for this creator
      const res = await fetchWithRetry(`${BASE_URL}/api/shop/public/${creatorUsername}/items`).catch(() => null);
      
      if (res?.ok) {
        const data = await res.json();
        // Transform items to match the expected format
        const products = (data.items || []).map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          image_url: item.image_url,
          category: item.category,
          is_digital: item.category === 'digital' || item.category === 'service',
          is_featured: item.is_featured || false,
          is_active: item.is_active,
          stock_quantity: item.stock_quantity,
          sales_count: item.sales_count || 0
        }));
        setShopProducts(products.filter(p => p.is_active)); // Only show active products
        setShopLoaded(true);
      }
    } catch (error) {
      console.error('Error loading shop products:', error);
    }
  }, [shopLoaded]);

  // Intersection Observer for lazy loading shop section
  useEffect(() => {
    if (!shopSectionRef.current || shopLoaded) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && creator?.username) {
          loadShopProducts(creator.username);
        }
      },
      { threshold: 0.1 }
    );
    
    observer.observe(shopSectionRef.current);
    
    return () => observer.disconnect();
  }, [creator?.username, shopLoaded, loadShopProducts]);

  // Fetch notification preference for this creator
  const fetchNotificationPreference = async () => {
    if (!user || !creator?.id) return;
    
    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/notifications/creator/${creator.id}/preference`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setNotificationsEnabled(data.enabled);
      }
    } catch (error) {
      console.error('Error fetching notification preference:', error);
    }
  };

  // Update notification preference
  const toggleNotificationPreference = async () => {
    if (!user) {
      handleInteraction('notifications', creator);
      return;
    }
    
    const newState = !notificationsEnabled;
    
    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/notifications/creator/${creator.id}/toggle`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ enabled: newState })
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setNotificationsEnabled(newState);
        toast.success(data.message);
      } else {
        toast.error('Failed to update notification preferences');
      }
    } catch (error) {
      console.error('Error updating notification preference:', error);
      toast.error('Failed to update notification preferences');
    }
  };

  // Fetch notification preference when user or creator changes
  useEffect(() => {
    if (user && creator?.id) {
      fetchNotificationPreference();
    }
  }, [user, creator?.id]);

  useEffect(() => {
    const fetchCreatorProfile = async () => {
      console.log('CreatorPublicProfileEnhanced: Fetching profile for username:', username);
      
      try {
        // Check cache first
        const cacheKey = `creator_${username}`;
        const cached = contentCache.current[cacheKey];
        if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
          setCreator(cached.creator);
          setPictures(cached.pictures || []);
          setVideos(cached.videos || []);
          setLoading(false);
          setContentLoaded(true);
          return;
        }
        
        setLoading(true);
        
        // Load critical creator data first
        const BASE_URL = import.meta.env.VITE_BACKEND_URL;
        const apiUrl = `${BASE_URL}/api/users/public/creator/${username}`;
        console.log('Fetching from:', apiUrl);
        const contentRes = await fetchWithRetry(apiUrl).catch(() => null);
        
        if (contentRes?.ok) {
          const data = await contentRes.json();
          const creator = data.creator || data;
          
          // For now, initialize empty arrays for pictures and videos
          // These can be loaded separately if needed
          const pictures = [];
          const videos = [];
          
          // Cache the data
          contentCache.current[cacheKey] = {
            creator,
            pictures,
            videos,
            timestamp: Date.now()
          };
          
          // Check if creator is currently live streaming from actual API/database
          // Only set live streaming if creator is ACTUALLY broadcasting
          // This should come from the API response, not random simulation
          if (creator.isLiveStreaming) {
            setIsLiveStreaming(true);
            setLiveStreamData({
              title: creator.streamTitle || 'Live Stream',
              viewerCount: creator.viewerCount || 0,
              startTime: creator.streamStartTime ? new Date(creator.streamStartTime) : new Date(),
              isPaidStream: creator.isPaidStream || false,
              isClass: creator.isClass || false,
              tokenPrice: creator.tokenPrice || 0,
              streamUrl: creator.streamUrl || null
            });
            setHasStreamAccess(creator.hasAccess || !creator.isPaidStream);
          } else {
            // Creator is online but NOT live streaming
            setIsLiveStreaming(false);
            setLiveStreamData(null);
          }
          
          const transformedCreator = {
            id: creator.id || creator.supabase_id,
            username: creator.username,
            bio: creator.bio,
            profilePic: creator.profilePicUrl || creator.profile_pic_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
            banner_url: creator.banner_url || creator.bannerUrl || null,
            coverPhoto: `https://source.unsplash.com/1600x400/?abstract,${username}`,
            stats: {
              followers: 12500,
              posts: pictures.length + videos.length,
              likes: 45200,
              totalViews: 325000,
              joinedDate: new Date('2023-06-15')
            },
            rates: {
              videoCall: creator.videoPrice || 5,
              voiceCall: creator.voicePrice || 3,
              message: creator.messagePrice || 1,
              picture: 10,
              video: 25
            },
            isOnline: true,
            lastSeen: new Date()
          };
          
          const transformedPictures = pictures.map(pic => ({
            id: pic.id,
            thumbnail: pic.thumbnail_url,
            price: parseFloat(pic.price),
            isLocked: !pic.is_purchased,
            likes: pic.likes || 0,
            description: pic.title,
            isPurchased: pic.is_purchased
          }));
          
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
          
          const transformedRecordings = recordings.map(rec => ({
            id: rec.id,
            title: rec.title,
            thumbnail: rec.thumbnail_url || creator.profilePic,
            price: rec.token_price,
            duration: rec.duration,
            resolution: rec.resolution || '1440p',
            viewCount: rec.view_count || 0,
            createdAt: new Date(rec.created_at),
            isLocked: rec.access_type === 'paid',
            description: rec.description
          }));
          
          setCreator(transformedCreator);
          setPictures(transformedPictures);
          setVideos(transformedVideos);
          setRecordings(transformedRecordings);
          setShopProducts([]);
          
          const purchasedIds = new Set([
            ...transformedPictures.filter(p => p.isPurchased).map(p => p.id),
            ...transformedVideos.filter(v => v.isPurchased).map(v => v.id)
          ]);
          setPurchasedContent(purchasedIds);
        } else {
          // API request failed or returned non-OK status
          console.error('Failed to fetch creator profile:', contentRes?.status);
          // Use mock/fallback data
          const mockCreator = {
            id: '1',
            username: username,
            bio: "✨ Content Creator | 🎬 Live Streamer | 💫 Your favorite digital companion",
            profilePic: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
            coverPhoto: `https://source.unsplash.com/1600x400/?abstract,${username}`,
            stats: {
              followers: 0,
              posts: 0,
              likes: 0,
              totalViews: 0,
              joinedDate: new Date()
            },
            rates: {
              videoCall: 5,
              voiceCall: 3,
              message: 1,
              picture: 10,
              video: 25
            },
            isOnline: false,
            lastSeen: new Date()
          };
          
          setCreator(mockCreator);
          setPictures([]);
          setVideos([]);
          setRecordings([]);
        }
      } catch (error) {
        console.error('Error fetching creator profile:', error);
        
        const mockCreator = {
          id: '1',
          username: username,
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

  // Fetch user token balance
  useEffect(() => {
    const fetchUserTokenBalance = async () => {
      if (!user || !user.id) return;

      try {
        const token = await getAuthToken();
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tokens/balance/${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUserTokenBalance(data.balance || 0);
        }
      } catch (error) {
        console.error('Error fetching token balance:', error);
      }
    };

    fetchUserTokenBalance();
  }, [user]);

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

    if (user.tokenBalance < picture.price) {
      setShowTokenPurchase(true);
      return;
    }

    try {
      await api.post('/content/purchase', {
        contentId: picture.id,
        contentType: 'picture',
        price: picture.price
      });

      setPurchasedContent(prev => new Set([...prev, picture.id]));
    } catch (error) {
      toast.error('Failed to purchase picture');
    }
  };

  const handlePurchaseRecording = async (recording) => {
    if (!user) {
      setAuthAction(() => () => handlePurchaseRecording(recording));
      setShowAuthModal(true);
      return;
    }
    
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/api/recording/recordings/${recording.id}/purchase`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setPurchasedContent(prev => new Set([...prev, recording.id]));
        toast.success(
          <div>
            <p>2K Recording unlocked!</p>
            <a 
              href={data.fileUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 underline"
            >
              Watch Now
            </a>
          </div>
        );
      } else {
        const error = await response.json();
        if (error.error?.includes('Insufficient')) {
          setShowTokenPurchase(true);
        } else {
          toast.error('Failed to purchase recording');
        }
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error('Failed to purchase recording');
    }
  };
  
  const handleWatchRecording = (recording) => {
    window.open(recording.fileUrl, '_blank');
  };
  
  const handlePurchaseVideo = async (video) => {
    if (!handleInteraction('purchase_video', video)) return;

    if (user.tokenBalance < video.price) {
      setShowTokenPurchase(true);
      return;
    }

    try {
      await api.post('/content/purchase', {
        contentId: video.id,
        contentType: 'video',
        price: video.price
      });

      setPurchasedContent(prev => new Set([...prev, video.id]));
    } catch (error) {
      toast.error('Failed to purchase video');
    }
  };

  const handleStartVideoCall = () => {
    if (!handleInteraction('video_call', creator)) return;
    setShowVideoCallModal(true);
  };

  const handleStartVoiceCall = () => {
    if (!handleInteraction('voice_call', creator)) return;
    setShowVoiceCallModal(true);
  };

  const handleVideoCallStart = () => {
    navigate(`/video-call/${creator.username}`);
    setShowVideoCallModal(false);
  };

  const handleVoiceCallStart = () => {
    navigate(`/voice-call/${creator.username}`);
    setShowVoiceCallModal(false);
  };

  const handlePurchaseDigital = async (digital) => {
    if (!handleInteraction('digital_purchase', { creator, digital })) return;
    
    try {
      const response = await api.post('/api/digitals/purchase', {
        digitalId: digital.id,
        price: digital.price
      });
      
      if (response.data.success) {
        setPurchasedContent(prev => new Set([...prev, digital.id]));
        setDigitals(prev => prev.map(d => d.id === digital.id ? {...d, isPurchased: true} : d));
        toast.success('Digital content purchased successfully!');
      }
    } catch (error) {
      console.error('Error purchasing digital:', error);
      toast.error('Failed to purchase digital content');
    }
  };


  const handleSendMessage = () => {
    if (!handleInteraction('message', creator)) return;
    setShowMessageModal(true);
  };

  const handleMessageSent = (messageData) => {
    // Optional: Handle successful message sent
    toast.success('Message sent successfully!');
    // Optionally navigate to messages
    // navigate(`/messages/${creator.username}`);
  };

  const handleScheduleSession = () => {
    if (!handleInteraction('schedule', creator)) return;
    // Navigate to schedule page or open schedule modal
    navigate(`/schedule?creator=${creator.username}`);
  };

  const handleSendTip = () => {
    if (!handleInteraction('tip', creator)) return;
    setShowTipModal(true);
  };

  const handleTipSent = (amount) => {
    // Process the tip here
    toast.success(`Sent ${amount} tokens to @${creator.username}!`);
    // Update token balance if needed
    setUserTokenBalance(prevBalance => prevBalance - amount);
  };
  
  const handleShopProductClick = (product) => {
    if (!handleInteraction('shop_product', { creator, product })) return;
    
    if (product.external_link) {
      window.open(product.external_link, '_blank');
    } else {
      navigate(`/shop/${creator.username}/product/${product.id}`);
    }
  };
  
  const handleAddToCart = async (product) => {
    if (!handleInteraction('add_to_cart', { creator, product })) return;
    
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/api/shop/cart/add`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            productId: product.id,
            quantity: 1
          })
        }
      );
      
      if (response.ok) {
        toast.success(`${product.name} added to cart!`);
      } else {
        toast.error('Failed to add item to cart');
      }
    } catch (error) {
      console.error('Add to cart error:', error);
      toast.error('Failed to add item to cart');
    }
  };
  
  const handleUnlockStream = async () => {
    if (!user) {
      handleInteraction('unlock_stream', creator);
      return false;
    }
    
    if (user.tokenBalance < liveStreamData.tokenPrice) {
      setShowTokenPurchase(true);
      return false;
    }
    
    try {
      // Call API to purchase stream access
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/api/streaming/purchase-access`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            streamId: liveStreamData.streamId,
            creatorId: creator.id,
            tokenPrice: liveStreamData.tokenPrice
          })
        }
      );
      
      if (response.ok) {
        setHasStreamAccess(true);
        setStreamPurchased(true);
        toast.success(`Stream unlocked for ${liveStreamData.tokenPrice} tokens!`);
        
        // Update user token balance
        if (user) {
          user.tokenBalance -= liveStreamData.tokenPrice;
        }
        
        return true;
      } else {
        toast.error('Failed to unlock stream');
        return false;
      }
    } catch (error) {
      toast.error('Failed to unlock stream');
      return false;
    }
  };

  const handleFollow = async () => {
    if (!handleInteraction('follow', creator)) return;

    try {
      if (isFollowing) {
        await api.delete(`/creators/${creator.id}/unfollow`);
        setIsFollowing(false);
      } else {
        await api.post(`/creators/${creator.id}/follow`);
        setIsFollowing(true);
      }
    } catch (error) {
      toast.error('Failed to update follow status');
    }
  };

  if (loading) {
    // Show skeleton loader instead of null
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-pink-50 to-cyan-50 dark:from-violet-900 dark:via-slate-900 dark:to-cyan-900">
        <div className="h-64 md:h-80 animate-pulse bg-white/30 dark:bg-slate-800/30" />
        <div className="max-w-7xl mx-auto p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({length: 8}).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-white/40 dark:bg-slate-800/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Creator not found</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">The creator @{username} doesn't exist</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-pink-50 to-cyan-50 dark:from-violet-900 dark:via-slate-900 dark:to-cyan-900 relative">
      {/* Live Stream Notification Banner */}
      <AnimatePresence>
        {showLiveNotification && newStreamData && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 text-white shadow-2xl"
          >
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <motion.div
                    animate={!prefersReducedMotion ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="flex items-center gap-2"
                  >
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                    <span className="font-bold text-lg">LIVE NOW</span>
                  </motion.div>
                  <div>
                    <p className="font-semibold">{creator.username} just went live!</p>
                    <p className="text-sm opacity-90">"{newStreamData.title}"</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      navigate(`/stream/${creator.username}`);
                    }}
                    className="px-6 py-2 bg-white text-red-500 rounded-full font-bold shadow-lg hover:bg-gray-100 transition-colors"
                  >
                    Join Stream
                  </motion.button>
                  <button
                    onClick={() => setShowLiveNotification(false)}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Banner - Shows when not live streaming */}
      {!isLiveStreaming ? (
        <ProfileBanner
          creator={creator}
          isLiveStreaming={isLiveStreaming}
          liveStreamData={liveStreamData}
          onStartVideoCall={handleStartVideoCall}
          onStartVoiceCall={handleStartVoiceCall}
          onSendMessage={handleSendMessage}
          onScheduleSession={handleScheduleSession}
          onFollowToggle={handleFollow}
          isFollowing={isFollowing}
          lastVOD={recordings?.[0]}
        />
      ) : (
        <div className="relative h-64 md:h-96 overflow-hidden bg-gradient-to-br from-violet-400 via-pink-400 to-cyan-400 dark:from-violet-800 dark:via-purple-800 dark:to-cyan-800">
          <>
            {liveStreamData?.isPaidStream && !hasStreamAccess ? (
              <div className="relative w-full h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/90 to-pink-500/90 backdrop-blur-xl" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-8 bg-white/95 dark:bg-slate-900/95 rounded-2xl backdrop-blur-sm max-w-md border-2 border-violet-300 dark:border-violet-500/50 shadow-[0_0_30px_rgba(139,92,246,0.3)]">
                    <LockClosedIcon className="w-20 h-20 text-violet-500 dark:text-violet-400 mx-auto mb-4 drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 dark:from-violet-400 dark:to-pink-400 bg-clip-text text-transparent mb-2">
                      {liveStreamData.isClass ? 'Live Class' : 'Premium Live Stream'}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">{liveStreamData.title}</p>
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <span className="text-gray-600 dark:text-gray-400 text-sm">{liveStreamData.viewerCount} watching</span>
                    </div>
                    <div className="bg-gradient-to-r from-violet-100 to-pink-100 dark:from-violet-900/30 dark:to-pink-900/30 border border-violet-300 dark:border-violet-500/30 rounded-lg p-4 mb-4 shadow-lg">
                      <p className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 dark:from-violet-400 dark:to-pink-400 bg-clip-text text-transparent mb-1">{liveStreamData.tokenPrice} tokens</p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">One-time payment for full access</p>
                    </div>
                    <motion.button
                      whileHover={!prefersReducedMotion ? { scale: 1.05 } : {}}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleUnlockStream}
                      className="w-full px-6 py-3 bg-gradient-to-r from-violet-500 to-pink-500 text-white rounded-lg hover:from-violet-600 hover:to-pink-600 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] font-bold"
                    >
                      {liveStreamData.isClass ? 'Pay to Join Class' : 'Pay to Join Live Stream'}
                    </motion.button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted={streamPreviewMuted}
                  loop
                  playsInline
                >
                  <source src={liveStreamData?.streamUrl || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'} type="application/x-mpegURL" />
                  Your browser does not support the video tag.
                </video>
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/50 via-transparent to-transparent pointer-events-none" />
                <button
                  onClick={() => setStreamPreviewMuted(!streamPreviewMuted)}
                  className="absolute bottom-4 right-4 p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-full text-violet-600 dark:text-violet-400 hover:bg-white/90 dark:hover:bg-slate-700/90 transition-all border border-violet-300 dark:border-violet-500/30 shadow-lg"
                >
                  {streamPreviewMuted ? (
                    <SpeakerXMarkIcon className="h-5 w-5" />
                  ) : (
                    <SpeakerWaveIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            )}
          </>
        </div>
      )}
      
      {/* Back button - Positioned absolutely over the banner */}
      <button
        onClick={() => {
          if (onClose) {
            onClose();
          } else {
            navigate('/');
          }
        }}
        className="absolute top-4 left-4 p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-full text-violet-600 dark:text-violet-400 hover:bg-white/90 dark:hover:bg-slate-700/90 transition-all z-20 border border-violet-300 dark:border-violet-500/30 shadow-lg"
      >
        <ArrowLeftIcon className="h-6 w-6" />
      </button>

      {/* Profile Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 md:-mt-16 relative z-10">
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg rounded-2xl shadow-2xl hover:shadow-[0_20px_60px_rgba(139,92,246,0.2)] transition-all duration-300 p-6 md:p-8 border border-violet-200 dark:border-violet-800/50">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="relative">
              <img
                src={creator.profilePic}
                alt={creator.username}
                className="w-32 h-32 rounded-full object-cover border-4 border-white dark:border-slate-700 shadow-2xl ring-4 ring-violet-200 dark:ring-violet-800/50"
                width={128}
                height={128}
                sizes="(max-width:640px) 128px, 128px"
              />
              {creator.isOnline && (
                <motion.div 
                  animate={!prefersReducedMotion ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-800 shadow-[0_0_10px_rgba(34,197,94,0.6)]"
                />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 dark:from-violet-400 dark:to-pink-400 bg-clip-text text-transparent">{creator.username}</h1>
                    <motion.div
                      whileHover={!prefersReducedMotion ? { scale: 1.1 } : {}}
                      className="bg-blue-500 rounded-full p-1.5 shadow-lg"
                      title="Verified Creator"
                    >
                      <CheckCircleIcon className="h-5 w-5 text-white" />
                    </motion.div>
                  </div>
                  <div className="flex flex-row flex-nowrap gap-2 mb-4 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {['Just Chatting', 'Gaming', 'IRL', 'Music & DJ Sets'].map((category) => (
                      <motion.span
                        key={category}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={!prefersReducedMotion ? { scale: 1.05 } : {}}
                        className="flex-shrink-0 px-4 py-1.5 bg-gradient-to-r from-violet-100 to-pink-100 dark:from-violet-900/30 dark:to-pink-900/30 rounded-full text-sm font-medium text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all cursor-pointer whitespace-nowrap"
                      >
                        {category}
                      </motion.span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={!prefersReducedMotion ? { scale: 1.03 } : {}}
                      whileTap={!prefersReducedMotion ? { scale: 0.97 } : {}}
                      onClick={() => setShowSubscriptionModal(true)}
                      className="relative px-5 py-2.5 bg-gradient-to-r from-violet-500 to-pink-500 text-white rounded-xl font-semibold transition-all overflow-hidden group"
                      style={{
                        boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)'
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      <span className="relative z-10 flex items-center gap-2">
                        <SparklesIcon className="w-4 h-4" />
                        Subscribe
                      </span>
                    </motion.button>
                    <motion.button
                      whileHover={!prefersReducedMotion ? { scale: 1.02 } : {}}
                      whileTap={!prefersReducedMotion ? { scale: 0.98 } : {}}
                      onClick={handleFollow}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-sm font-medium ${
                        isFollowing
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
                      }`}
                      aria-label={isFollowing ? 'Unfollow creator' : 'Follow creator'}
                    >
                      {isFollowing ? <CheckCircleIcon className="h-4 w-4" /> : <UserPlusIcon className="h-4 w-4" />}
                      <span>{isFollowing ? 'Following' : 'Follow'}</span>
                    </motion.button>
                    <motion.button
                      whileHover={!prefersReducedMotion ? { scale: 1.02 } : {}}
                      whileTap={!prefersReducedMotion ? { scale: 0.98 } : {}}
                      onClick={() => {
                        const url = window.location.href;
                        // Try navigator.share first
                        if (navigator.share) {
                          navigator.share({ title: creator.username, url }).catch(() => {});
                        } else if (navigator.clipboard?.writeText) {
                          // Use clipboard API if available
                          navigator.clipboard.writeText(url).then(() => toast.success('Link copied!')).catch(() => {
                            // Fallback to execCommand
                            const input = document.createElement('input');
                            input.value = url;
                            document.body.appendChild(input);
                            input.select();
                            document.execCommand('copy');
                            input.remove();
                            toast.success('Link copied!');
                          });
                        } else {
                          // Final fallback
                          const input = document.createElement('input');
                          input.value = url;
                          document.body.appendChild(input);
                          input.select();
                          document.execCommand('copy');
                          input.remove();
                          toast.success('Link copied!');
                        }
                      }}
                      className="p-1.5 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all border border-gray-300 dark:border-gray-600"
                      title="Share Profile"
                      aria-label="Share profile"
                    >
                      <ShareIcon className="h-4 w-4" />
                    </motion.button>
                    <motion.button
                      whileHover={!prefersReducedMotion ? { scale: 1.02 } : {}}
                      whileTap={!prefersReducedMotion ? { scale: 0.98 } : {}}
                      onClick={toggleNotificationPreference}
                      className={`p-1.5 rounded-lg transition-all ${
                        notificationsEnabled
                          ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
                      }`}
                      title={notificationsEnabled ? 'Notifications enabled' : 'Enable notifications'}
                    >
                      <BellIcon className="h-4 w-4" />
                    </motion.button>
                  </div>
                  {/* Follower Count - Enhanced styling */}
                  <div className="bg-gradient-to-r from-violet-100 to-pink-100 dark:from-violet-900/30 dark:to-pink-900/30 px-4 py-2 rounded-lg border border-violet-200 dark:border-violet-700/50 shadow-sm">
                    <div className="flex items-center gap-2">
                      <UserGroupIcon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                      <div className="flex flex-col">
                        <div className="text-xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 dark:from-violet-400 dark:to-pink-400 bg-clip-text text-transparent">
                          {creator.stats.followers.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 font-medium uppercase tracking-wider">Followers</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {isLiveStreaming && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (!user) {
                      handleInteraction('join_stream', creator);
                    } else {
                      navigate(`/stream/${creator.username}`);
                    }
                  }}
                  className="relative w-full px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-bold transition-all overflow-hidden group mb-4"
                  style={{
                    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)'
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    <PlayIcon className="h-5 w-5" />
                    <span>{liveStreamData?.isClass ? 'Join Live Class' : 'Join Live Stream'}</span>
                    <span className="text-sm opacity-90">• {liveStreamData?.viewerCount || 0} watching</span>
                  </div>
                </motion.button>
              )}
              <div className="flex justify-start">
                <div className="flex flex-wrap gap-2">
                  <motion.button
                    onClick={handleStartVideoCall}
                    className="relative flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg transition-all text-sm font-medium overflow-hidden group"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
                      minWidth: '100px'
                    }}
                    aria-label="Start video call with creator"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    <VideoCameraIcon className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">Video</span>
                  </motion.button>

                  <motion.button
                    onClick={handleStartVoiceCall}
                    className="relative flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg transition-all text-sm font-medium overflow-hidden group"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                      minWidth: '100px'
                    }}
                    aria-label="Start voice call with creator"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-600 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    <PhoneIcon className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">Voice</span>
                  </motion.button>

                  <motion.button
                    onClick={handleSendMessage}
                    className="relative flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg transition-all text-sm font-medium overflow-hidden group"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      boxShadow: '0 2px 8px rgba(147, 51, 234, 0.3)',
                      minWidth: '100px'
                    }}
                    aria-label="Send message to creator"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    <ChatBubbleLeftRightIcon className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">Message</span>
                  </motion.button>

                  <motion.button
                    onClick={handleSendTip}
                    className="relative flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg transition-all text-sm font-medium overflow-hidden group"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)',
                      minWidth: '100px'
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    <SparklesIcon className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">Tip</span>
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Content Gallery for Fans */}
        <div className="mt-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-violet-200 dark:border-violet-800/50 overflow-hidden">
            {/* Gallery Header */}
            <div className="p-6 border-b border-violet-200 dark:border-violet-800/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {pictures.length + videos.length + recordings.length + digitals.length} items
                  </span>
                </div>
              </div>
              
              {/* Content Type Tabs with Neon Underlines */}
              <div className="flex gap-1 overflow-x-auto">
                {[
                  { id: 'photos', label: 'Photos', icon: PhotoIcon },
                  { id: 'videos', label: 'Videos', icon: VideoCameraIcon },
                  { id: 'streams', label: 'Streams', icon: PlayIcon },
                  { id: 'offers', label: 'Offers', icon: SparklesIcon },
                  { id: 'about', label: 'About', icon: UserCircleIcon },
                  { id: 'digitals', label: 'Digitals', icon: DocumentIcon },
                  { id: 'shop', label: 'Shop', icon: ShoppingBagIcon }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedContentType(tab.id)}
                    className={`px-4 py-2 font-medium transition-all relative group ${
                      selectedContentType === tab.id ? 'text-violet-600 dark:text-violet-400' : 'text-gray-500 dark:text-gray-400 hover:text-violet-500 dark:hover:text-violet-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {tab.icon && <tab.icon className="h-4 w-4" />}
                      {tab.label}
                    </span>
                    <motion.span
                      className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-violet-500 to-pink-500"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: selectedContentType === tab.id ? 1 : 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      style={{ originX: 0.5 }}
                    />
                    {selectedContentType === tab.id && (
                      <motion.span
                        className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-violet-500 to-pink-500 blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Grid */}
            <div className="p-6">
              {/* Show Offers Tab Content */}
              {/* About Section */}
              {selectedContentType === 'about' && (
                <div className="p-6">
                  <div className="max-w-4xl mx-auto">
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 dark:from-violet-400 dark:to-pink-400 bg-clip-text text-transparent mb-4">
                        About {creator.username}
                      </h2>
                      <div className="bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-900/20 dark:to-pink-900/20 rounded-xl p-6">
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {creator.bio || ''}
                        </p>
                        {!creator.bio && (
                          <p className="text-gray-500 dark:text-gray-400 italic">
                            No information provided yet.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedContentType === 'offers' && (
                <CreatorOffers 
                  creatorId={creator.id}
                  creatorUsername={creator.username}
                  auth={{ currentUser: user }}
                />
              )}
              
              {/* Show Shop Tab Content */}
              {selectedContentType === 'shop' && (
                <div>
                  {shopProducts.length > 0 ? (
                    <>
                      {/* Shop Categories */}
                      <div className="flex gap-2 mb-6">
                        {[
                          { id: 'all', label: 'All Products', count: shopProducts.length },
                          { id: 'digital', label: 'Digital', count: shopProducts.filter(p => p.is_digital).length },
                          { id: 'physical', label: 'Physical', count: shopProducts.filter(p => !p.is_digital).length },
                          { id: 'featured', label: 'Featured', count: shopProducts.filter(p => p.is_featured).length }
                        ].map((category) => (
                          <button
                            key={category.id}
                            onClick={() => setSelectedShopCategory(category.id)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
                              selectedShopCategory === category.id
                                ? 'bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-md'
                                : 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-900/50'
                            }`}
                          >
                            {category.label}
                            {category.count > 0 && (
                              <span className="ml-1.5 text-xs opacity-80">({category.count})</span>
                            )}
                          </button>
                        ))}
                      </div>
                      <CreatorShopSection 
                        creatorUsername={creator.username}
                        shopProducts={shopProducts}
                        selectedCategory={selectedShopCategory}
                      />
                    </>
                  ) : (
                    <div className="text-center py-16">
                      {/* Empty shop - no message */}
                    </div>
                  )}
                </div>
              )}
              
              {/* Show Content Grid for other tabs */}
              {selectedContentType !== 'menu' && selectedContentType !== 'shop' && selectedContentType !== 'about' && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {(() => {
                  let displayContent = [];
                  if (selectedContentType === 'photos') {
                    displayContent = pictures.map(p => ({ ...p, type: 'photo' }));
                  } else if (selectedContentType === 'videos') {
                    displayContent = videos.map(v => ({ ...v, type: 'video' }));
                  } else if (selectedContentType === 'streams') {
                    displayContent = recordings.map(r => ({ ...r, type: 'stream' }));
                  } else if (selectedContentType === 'digitals') {
                    displayContent = digitals.map(d => ({ ...d, type: 'digital' }));
                  }

                  // Limit displayed items for performance
                  const limitedContent = displayContent.slice(0, visibleContentCount);
                  
                  return limitedContent.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.05 }}
                      whileHover={{ scale: 1.05, rotateY: 5, z: 50 }}
                      whileTap={{ scale: 0.95 }}
                      className="relative group cursor-pointer transform-gpu"
                      style={{ transformStyle: 'preserve-3d' }}
                      onClick={() => {
                        if (!purchasedContent.has(item.id)) {
                          if (item.type === 'photo') {
                            handlePurchasePicture(item);
                          } else if (item.type === 'video') {
                            handlePurchaseVideo(item);
                          } else if (item.type === 'stream') {
                            handlePurchaseRecording(item);
                          } else if (item.type === 'digital') {
                            handlePurchaseDigital(item);
                          }
                        } else {
                          handleInteraction('view_content', { creator, item });
                        }
                      }}
                    >
                      <motion.div 
                        whileHover={!prefersReducedMotion ? { boxShadow: '0 10px 30px rgba(139,92,246,0.2)' } : {}}
                        className={`relative ${item.type === 'photo' ? 'aspect-[3/4]' : 'aspect-[3/4]'} bg-gray-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-violet-200 dark:border-violet-700/50 group-hover:border-violet-400 dark:group-hover:border-violet-500 transition-all`}>
                        <img
                          src={item.thumbnail || `https://source.unsplash.com/400x${item.type === 'photo' ? '600' : '300'}/?${item.type},${item.id}`}
                          alt={item.title || item.description}
                          className={`w-full h-full object-cover transition-all duration-300 ${
                            !purchasedContent.has(item.id) ? 'blur-xl scale-110 brightness-50' : 'group-hover:scale-105'
                          }`}
                          loading="lazy"
                        />
                        
                        {/* Content Type Badge */}
                        <div className="absolute top-2 left-2">
                          {item.type === 'photo' && (
                            <div className="px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded flex items-center gap-1 shadow-md">
                              <PhotoIcon className="h-3 w-3" />
                              PHOTO
                            </div>
                          )}
                          {item.type === 'video' && (
                            <div className="px-2 py-1 bg-purple-500 text-white text-xs font-bold rounded flex items-center gap-1 shadow-md">
                              <VideoCameraIcon className="h-3 w-3" />
                              VIDEO
                            </div>
                          )}
                          {item.type === 'stream' && (
                            <div className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded flex items-center gap-1 shadow-md">
                              <PlayIcon className="h-3 w-3" />
                              STREAM
                            </div>
                          )}
                          {item.type === 'digital' && (
                            <div className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded flex items-center gap-1 shadow-md">
                              <DocumentIcon className="h-3 w-3" />
                              DIGITAL
                            </div>
                          )}
                        </div>

                        {/* Lock Overlay for Unpurchased Content */}
                        {!purchasedContent.has(item.id) && (
                          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/70 to-gray-900/50 flex flex-col items-center justify-center backdrop-blur-sm">
                            <motion.div
                              animate={{ scale: [1, 1.1, 1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            >
                              <LockClosedIcon className="h-12 w-12 text-white mb-3 drop-shadow-lg" />
                            </motion.div>
                            <div className="text-center">
                              <p className="text-white font-bold text-lg mb-1 drop-shadow-lg">
                                {item.price || item.ppv_price || 10} tokens
                              </p>
                              <p className="text-white/80 text-xs">Click to unlock</p>
                            </div>
                          </div>
                        )}

                        {/* Purchased Badge */}
                        {purchasedContent.has(item.id) && (
                          <div className="absolute top-2 right-2">
                            <CheckCircleIcon className="h-6 w-6 text-green-500 bg-white dark:bg-slate-900 rounded-full shadow-lg" />
                          </div>
                        )}

                        {/* Play Overlay for Videos/Streams */}
                        {purchasedContent.has(item.id) && (item.type === 'video' || item.type === 'stream') && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-gray-900/60 transition-opacity backdrop-blur-sm">
                            <motion.div
                              whileHover={{ scale: 1.2 }}
                              className="drop-shadow-2xl"
                            >
                              <PlayIcon className="h-16 w-16 text-white" />
                            </motion.div>
                          </div>
                        )}

                        {/* Content Info */}
                        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-gray-900 via-gray-900/90 to-transparent">
                          <p className="text-white text-sm font-medium line-clamp-1">
                            {item.title || item.description || 'Exclusive Content'}
                          </p>
                          {(item.type === 'video' || item.type === 'stream') && (
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-300">
                              <span className="flex items-center gap-1">
                                <EyeIcon className="h-3 w-3" />
                                {item.views || item.viewCount || Math.floor(Math.random() * 5000)} views
                              </span>
                              {item.duration && (
                                <span className="flex items-center gap-1">
                                  <ClockIcon className="h-3 w-3" />
                                  {item.duration}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </motion.div>
                  ));
                })()}
              </div>
              )}

              {/* Load More Button */}
              {selectedContentType !== 'menu' && selectedContentType !== 'shop' && selectedContentType !== 'about' && (() => {
                let displayContent = [];
                if (selectedContentType === 'photos') {
                  displayContent = pictures.map(p => ({ ...p, type: 'photo' }));
                } else if (selectedContentType === 'videos') {
                  displayContent = videos.map(v => ({ ...v, type: 'video' }));
                } else if (selectedContentType === 'streams') {
                  displayContent = recordings.map(r => ({ ...r, type: 'stream' }));
                }
                
                if (displayContent.length > visibleContentCount) {
                  return (
                    <div className="flex justify-center mt-6">
                      <motion.button
                        whileHover={!prefersReducedMotion ? { scale: 1.05 } : {}}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setVisibleContentCount(prev => prev + 12)}
                        className="px-6 py-3 bg-gradient-to-r from-violet-500 to-pink-500 text-white rounded-xl hover:from-violet-600 hover:to-pink-600 transition-all shadow-md hover:shadow-lg font-medium"
                      >
                        Load More ({displayContent.length - visibleContentCount} remaining)
                      </motion.button>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Empty State */}
              {selectedContentType !== 'menu' && selectedContentType !== 'shop' && selectedContentType !== 'about' && pictures.length === 0 && videos.length === 0 && recordings.length === 0 && (
                <div className="text-center py-16">
                  {/* Empty content - no message */}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add padding at the bottom of the page */}
      <div className="pb-16"></div>

      {/* Video Call Modal */}
      <VideoCallModal
        isOpen={showVideoCallModal}
        onClose={() => setShowVideoCallModal(false)}
        creator={{
          ...creator,
          displayName: creator?.display_name || creator?.username,
          isOnline: creator?.is_online
        }}
        tokenCost={creator?.video_price || 100}
        tokenBalance={userTokenBalance}
        onCallStart={handleVideoCallStart}
      />

      {/* Voice Call Modal */}
      <VoiceCallModal
        isOpen={showVoiceCallModal}
        onClose={() => setShowVoiceCallModal(false)}
        creator={{
          ...creator,
          displayName: creator?.display_name || creator?.username,
          isOnline: creator?.is_online
        }}
        tokenCost={creator?.voice_price || 50}
        tokenBalance={userTokenBalance}
        onCallStart={handleVoiceCallStart}
      />

      {/* Message Compose Modal */}
      <MessageComposeModal
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        creator={{
          ...creator,
          displayName: creator?.display_name || creator?.username,
          isOnline: creator?.is_online
        }}
        tokenCost={creator?.message_price || 5}
        tokenBalance={userTokenBalance}
        onMessageSent={handleMessageSent}
      />

      {/* Tip Modal */}
      <TipModal
        isOpen={showTipModal}
        onClose={() => setShowTipModal(false)}
        creator={{
          ...creator,
          displayName: creator?.display_name || creator?.username,
          isOnline: creator?.is_online
        }}
        tokenBalance={userTokenBalance}
        onTipSent={handleTipSent}
      />

      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && setShowAuthModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-md w-full border border-violet-200 dark:border-violet-800/50 shadow-2xl"
            >
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Sign in to continue</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Join Digis to interact with {creator.username} and unlock exclusive content
              </p>
              <Auth
                mode="signin"
                onLogin={(user) => {
                  setShowAuthModal(false);
                  if (authAction) {
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

      <AnimatePresence>
        {showTokenPurchase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
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
                }}
                onClose={() => setShowTokenPurchase(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSubscriptionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && setShowSubscriptionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-violet-200 dark:border-violet-800/50 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Subscription
                </h2>
                <button
                  onClick={() => setShowSubscriptionModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                </button>
              </div>

              <div className="flex justify-center">
                <div className="w-full">
                  <div className="text-center mb-6">
                    <div className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                      {creator?.subscription_price || 500} tokens/month
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {[
                      'Access to exclusive content',
                      'Priority messaging with creator',
                      'Special subscriber badge',
                      'Access to subscriber-only live streams'
                    ].map((perk, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                        <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0" />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      handleInteraction('subscribe', {
                        creator,
                        subscription: {
                          price: creator?.subscription_price || 500,
                          tokens: creator?.subscription_price || 500
                        }
                      });
                      setShowSubscriptionModal(false);
                    }}
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                  >
                    Subscribe
                  </motion.button>

                  <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
                    Cancel anytime • Renews monthly
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Live Stream Player Modal */}
      <AnimatePresence>
        {showLiveStreamPlayer && isLiveStreaming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          >
            <button
              onClick={() => setShowLiveStreamPlayer(false)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            
            {!user ? (
              // Not Authenticated - Full Screen Sign Up
              <div className="text-center p-8 max-w-lg">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="inline-block mb-6"
                >
                  <PlayIcon className="w-32 h-32 text-white/80" />
                </motion.div>
                <h2 className="text-4xl font-bold text-white mb-4">
                  Watch {creator.username} Live
                </h2>
                <p className="text-xl text-white/80 mb-8">
                  Join Digis to watch this exclusive live stream and connect with your favorite creators
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowLiveStreamPlayer(false);
                    setShowAuthModal(true);
                  }}
                  className="px-8 py-4 bg-gradient-to-r from-violet-500 to-pink-500 text-white rounded-xl hover:from-violet-600 hover:to-pink-600 transition-all shadow-2xl font-bold text-lg mb-4"
                >
                  Sign Up Free to Watch
                </motion.button>
                <p className="text-white/60">
                  Already have an account? 
                  <button 
                    onClick={() => {
                      setShowLiveStreamPlayer(false);
                      setShowAuthModal(true);
                    }}
                    className="text-violet-400 hover:text-violet-300 underline ml-1"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            ) : liveStreamData?.isPaidStream && !streamPurchased ? (
              // Authenticated but Need to Pay
              <div className="relative w-full h-full">
                <video
                  className="w-full h-full object-contain opacity-30 blur-sm"
                  autoPlay
                  muted
                  loop
                  playsInline
                >
                  <source src={liveStreamData?.streamUrl || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'} type="application/x-mpegURL" />
                </video>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-8 bg-black/80 rounded-2xl backdrop-blur-sm max-w-md border border-violet-500/30">
                    <SparklesIcon className="w-20 h-20 text-violet-400 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-white mb-2">
                      Premium Live Stream
                    </h3>
                    <p className="text-white/80 mb-6">
                      Unlock full access to watch {creator.username}'s exclusive content
                    </p>
                    <div className="bg-violet-900/30 rounded-xl p-4 mb-6">
                      <p className="text-3xl font-bold text-violet-400 mb-1">
                        {liveStreamData.tokenPrice} tokens
                      </p>
                      <p className="text-white/60 text-sm">
                        One-time payment for this stream
                      </p>
                    </div>
                    {user.tokenBalance >= liveStreamData.tokenPrice ? (
                      <motion.button
                        whileHover={!prefersReducedMotion ? { scale: 1.05 } : {}}
                        whileTap={{ scale: 0.95 }}
                        onClick={async () => {
                          const success = await handleUnlockStream();
                          if (success) {
                            setStreamPurchased(true);
                          }
                        }}
                        className="w-full px-6 py-3 bg-gradient-to-r from-violet-500 to-pink-500 text-white rounded-xl hover:from-violet-600 hover:to-pink-600 transition-all shadow-2xl font-bold"
                      >
                        Unlock Stream Now
                      </motion.button>
                    ) : (
                      <div>
                        <p className="text-red-400 text-sm mb-3">
                          You need {liveStreamData.tokenPrice - user.tokenBalance} more tokens
                        </p>
                        <motion.button
                          whileHover={!prefersReducedMotion ? { scale: 1.05 } : {}}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setShowLiveStreamPlayer(false);
                            setShowTokenPurchase(true);
                          }}
                          className="w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-xl hover:from-amber-600 hover:to-yellow-600 transition-all shadow-2xl font-bold"
                        >
                          Get Tokens
                        </motion.button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Full Access - Show Live Stream
              <div className="relative w-full h-full flex flex-col">
                <div className="flex-1 relative">
                  <video
                    className="w-full h-full object-contain bg-black"
                    autoPlay
                    controls
                    playsInline
                  >
                    <source src={liveStreamData?.streamUrl || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'} type="application/x-mpegURL" />
                    Your browser does not support the video tag.
                  </video>
                  
                  {/* Stream Info Overlay */}
                  <div className="absolute top-4 left-4 right-20">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-600/90 rounded-full backdrop-blur-sm">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        <span className="text-white text-sm font-bold">LIVE</span>
                      </div>
                      <div className="px-3 py-1.5 bg-black/50 rounded-full backdrop-blur-sm">
                        <span className="text-white text-sm">
                          <EyeIcon className="inline h-4 w-4 mr-1" />
                          {liveStreamData?.viewerCount || 0} viewers
                        </span>
                      </div>
                    </div>
                    <h2 className="text-white text-xl font-bold mt-2 drop-shadow-lg">
                      {liveStreamData?.title}
                    </h2>
                    <p className="text-white/80 text-sm mt-1">
                      {creator.username} • Started {new Date(liveStreamData?.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                
                {/* Stream Chat (Optional - can be added later) */}
                <div className="h-32 bg-black/90 border-t border-gray-800 p-4">
                  <p className="text-white/60 text-center">
                    Chat coming soon...
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

CreatorPublicProfile.displayName = 'CreatorPublicProfile';

CreatorPublicProfile.propTypes = {
  user: PropTypes.object,
  onAuthRequired: PropTypes.func
};

export default CreatorPublicProfile;