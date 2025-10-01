import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { getDefaultAvatarUrl } from '../../utils/avatarHelpers';
import { useMobileUI } from './MobileUIProvider';
import MobileLiveStreamView from './MobileLiveStreamView';
import { useSocket } from '../../hooks/useSocket';
import { supabase } from '../../utils/supabase-auth';
import Hls from 'hls.js';
import {
  VideoCameraIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  HeartIcon,
  ShareIcon,
  CalendarIcon,
  StarIcon,
  CheckBadgeIcon,
  PhotoIcon,
  PlayCircleIcon,
  ShoppingBagIcon,
  GiftIcon,
  UserGroupIcon,
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisHorizontalIcon,
  SparklesIcon,
  CurrencyDollarIcon,
  ClockIcon,
  FireIcon,
  LockClosedIcon,
  TicketIcon,
  ArrowPathIcon,
  TagIcon,
  BoltIcon,
  DocumentIcon
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartSolidIcon,
  BellIcon as BellSolidIcon
} from '@heroicons/react/24/solid';

const MobileCreatorProfile = ({ 
  creatorId,
  creator,
  user,
  onBack,
  onStartCall,
  onSendMessage,
  onSubscribe,
  onFollow,
  onJoinStream
}) => {
  const { triggerHaptic, openBottomSheet } = useMobileUI();
  const [activeTab, setActiveTab] = useState('content');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isLiveNow, setIsLiveNow] = useState(false);
  const [liveStreamData, setLiveStreamData] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay policy
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasJoinedStream, setHasJoinedStream] = useState(false);
  const [videoQuality, setVideoQuality] = useState('auto');
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [showFullStream, setShowFullStream] = useState(false);
  const [streamViewers, setStreamViewers] = useState(0);
  const [streamChat, setStreamChat] = useState([]);
  const [contentPurchases, setContentPurchases] = useState({});
  const [messagePrice, setMessagePrice] = useState(5);
  const [showTicketedShows, setShowTicketedShows] = useState(false);
  const [ticketedShows, setTicketedShows] = useState([]);
  const [streamQuality, setStreamQuality] = useState('auto');
  const [loyaltyBadges, setLoyaltyBadges] = useState([]);
  const [fanNotes, setFanNotes] = useState('');
  
  // Refs for performance optimization
  const videoRef = useRef(null);
  const intersectionRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const scrollRef = useRef(null);
  const headerRef = useRef(null);
  const hlsRef = useRef(null);

  // WebSocket integration
  const socket = useSocket();
  
  // Use window scroll instead of container scroll to avoid ref issues
  const { scrollY } = useScroll();

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  []);

  // Parallax effect for header image (respecting motion preferences)
  const headerY = useTransform(scrollY, [0, 200], [0, prefersReducedMotion ? 0 : -50]);
  const headerOpacity = useTransform(scrollY, [0, 200], [1, prefersReducedMotion ? 1 : 0.3]);
  const headerScale = useTransform(scrollY, [0, 200], [1, prefersReducedMotion ? 1 : 1.1]);

  // Memoize creator data for performance
  const creatorData = useMemo(() => ({
    id: creatorId,
    username: creator?.username || 'alexcreator',
    displayName: creator?.displayName || 'Alex Creator',
    bio: creator?.bio || 'Digital artist & content creator 🎨✨ Creating amazing experiences for my fans!',
    avatarUrl: creator?.avatarUrl || null,
    coverUrl: creator?.coverUrl || '/api/placeholder/400/200',
    isVerified: true,
    followers: 15420,
    subscribers: 3200,
    contentCount: 248,
    rating: 4.9,
    responseTime: '< 2 hours',
    videoCallRate: 50,
    voiceCallRate: 30,
    messageRate: 5,
    isOnline: true,
    isLive: false, // Set this based on actual live status
    lastSeen: 'Active now',
    messagePrice: creator?.messagePrice || 5,
    interests: ['Art', 'Music', 'Gaming', 'Fashion'],
    subscriptionPrice: creator?.subscriptionPrice || 400, // Subscription price in tokens (was $19.99, now 400 tokens)
    subscriptionBenefits: [
      'Exclusive content',
      'Priority messages',
      'Monthly video call',
      'Custom content requests'
    ]
  }), [creatorId, creator]);

  // WebSocket event handlers for real-time updates
  useEffect(() => {
    if (!socket || typeof socket.emit !== 'function') return;

    // Join creator's room for updates
    socket.emit('join-creator-room', creatorId);

    // Listen for stream updates
    socket.on('stream-started', (data) => {
      if (data.creatorId === creatorId) {
        setIsLiveNow(true);
        setLiveStreamData(data.stream);
        setStreamViewers(data.viewers || 0);
      }
    });

    socket.on('stream-ended', (data) => {
      if (data.creatorId === creatorId) {
        setIsLiveNow(false);
        setLiveStreamData(null);
      }
    });

    socket.on('viewer-count-update', (data) => {
      if (data.creatorId === creatorId) {
        setStreamViewers(data.viewers);
      }
    });

    socket.on('stream-chat-message', (message) => {
      if (message.creatorId === creatorId) {
        setStreamChat(prev => [...prev.slice(-100), message]); // Keep last 100 messages
      }
    });

    // Listen for creator status updates
    socket.on('creator-online-status', (data) => {
      if (data.creatorId === creatorId) {
        // Update creator online status
      }
    });

    return () => {
      if (socket && typeof socket.emit === 'function') {
        socket.emit('leave-creator-room', creatorId);
        socket.off('stream-started');
        socket.off('stream-ended');
        socket.off('viewer-count-update');
        socket.off('stream-chat-message');
        socket.off('creator-online-status');
      }
    };
  }, [socket, creatorId]);

  // HLS.js video setup with fallback
  useEffect(() => {
    const video = videoRef.current;
    if (!isLiveNow || !liveStreamData?.streamUrl || !video) return;

    const src = liveStreamData.streamUrl;

    // Clean up previous HLS instance
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch (e) {}
      hlsRef.current = null;
    }

    // iOS Safari & modern Safari desktop can play HLS natively
    if (video.canPlayType('application/vnd.apple.mpegURL')) {
      video.src = src;
      video.play().catch(() => {}); // autoplay may need user gesture
      return;
    }

    // Use HLS.js for other browsers
    if (Hls.isSupported()) {
      const hls = new Hls({
        maxLiveSyncPlaybackRate: 1.5,
        enableWorker: true,
        lowLatencyMode: true
      });
      hlsRef.current = hls;

      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(src);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch(data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Try to recover network error
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              // Try to recover media error
              hls.recoverMediaError();
              break;
            default:
              // Cannot recover
              try {
                hls.destroy();
              } catch (e) {}
              setVideoLoadError(true);
              break;
          }
        }
      });

      return () => {
        if (hlsRef.current) {
          try {
            hlsRef.current.destroy();
          } catch (e) {}
          hlsRef.current = null;
        }
      };
    } else {
      // Very old browsers: show error
      setVideoLoadError(true);
    }
  }, [isLiveNow, liveStreamData?.streamUrl]);

  // Fetch ticketed shows
  useEffect(() => {
    const fetchTicketedShows = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/ticketed-shows/creator/${creatorId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setTicketedShows(data.shows || []);
        }
      } catch (error) {
        console.error('Error fetching ticketed shows:', error);
      }
    };

    fetchTicketedShows();
  }, [creatorId]);

  // Optimized live stream data fetching with error handling
  useEffect(() => {
    const fetchLiveStatus = async () => {
      try {
        setIsLoadingProfile(true);
        // Simulate API call - replace with actual API
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (creatorData.isLive) {
          const streamData = {
            title: "🎨 Live Art Session - Creating Digital Masterpiece",
            viewers: 342,
            duration: "00:00",
            thumbnail: 'https://picsum.photos/400/200',
            streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
            isPrivate: false,
            requiredTier: null,
            tokenPrice: 0
          };
          setLiveStreamData(streamData);
          setIsLiveNow(true);
          
          // Auto-join public streams
          if (!streamData.isPrivate && !streamData.requiredTier && streamData.tokenPrice === 0) {
            setHasJoinedStream(true);
          }
        }
      } catch (error) {
        console.error('Failed to fetch live status:', error);
        setNetworkError(true);
      } finally {
        setIsLoadingProfile(false);
      }
    };
    
    fetchLiveStatus();
    
    // Cleanup
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [creatorData.isLive]);

  // Memoize content sections for performance
  const content = useMemo(() => ({
    videos: [
      { id: 1, thumbnail: '/api/placeholder/150/150', duration: '5:23', views: 1200, locked: false },
      { id: 2, thumbnail: '/api/placeholder/150/150', duration: '3:45', views: 890, locked: true },
      { id: 3, thumbnail: '/api/placeholder/150/150', duration: '7:12', views: 2100, locked: false },
      { id: 4, thumbnail: '/api/placeholder/150/150', duration: '4:56', views: 1560, locked: true }
    ],
    photos: [
      { id: 1, url: '/api/placeholder/150/150', likes: 234, locked: false },
      { id: 2, url: '/api/placeholder/150/150', likes: 189, locked: true },
      { id: 3, url: '/api/placeholder/150/150', likes: 456, locked: false },
      { id: 4, url: '/api/placeholder/150/150', likes: 321, locked: true }
    ],
    recordings: [
      { id: 1, thumbnail: '/api/placeholder/150/150', title: 'Live Art Session', duration: '45:23', views: 3400, date: '2 days ago', price: 25 },
      { id: 2, thumbnail: '/api/placeholder/150/150', title: 'Q&A Stream', duration: '62:15', views: 2100, date: '1 week ago', price: 0 },
      { id: 3, thumbnail: '/api/placeholder/150/150', title: 'Tutorial Stream', duration: '38:45', views: 5600, date: '2 weeks ago', price: 15 }
    ],
    digitals: [
      { id: 1, name: 'Digital Art Pack', price: 50, type: 'download', downloads: 45 },
      { id: 2, name: 'Exclusive Wallpapers', price: 20, type: 'download', downloads: 120 },
      { id: 3, name: 'Behind the Scenes', price: 35, type: 'video', downloads: 89 },
      { id: 4, name: 'Tutorial Bundle', price: 75, type: 'course', downloads: 23 }
    ],
    shop: [
      { id: 1, name: 'Custom Video', price: 100, type: 'digital' },
      { id: 2, name: 'Signed Photo', price: 50, type: 'physical' },
      { id: 3, name: '1-on-1 Session', price: 200, type: 'service' }
    ],
    offers: [
      { 
        id: 1, 
        title: 'Quick Video Message', 
        description: 'Get a personalized 30-second video message',
        price: 500,
        originalPrice: 800,
        discount: '300 tokens OFF',
        type: 'video',
        deliveryTime: '24 hours',
        limited: true
      },
      { 
        id: 2, 
        title: '10 Min Video Call', 
        description: 'Private one-on-one video call session',
        price: 1500,
        originalPrice: 2000,
        discount: '500 tokens OFF',
        type: 'call',
        deliveryTime: 'Schedule within 48h'
      },
      { 
        id: 3, 
        title: 'Monthly Subscription', 
        description: 'All exclusive content + priority DMs',
        price: 400,
        originalPrice: 600,
        discount: 'SAVE 200 tokens',
        type: 'subscription',
        recurring: true
      },
      { 
        id: 4, 
        title: 'Custom Photo Set', 
        description: '5 exclusive photos just for you',
        price: 700,
        type: 'photo',
        deliveryTime: '3-5 days'
      }
    ]
  }), []);

  // Memoize tabs to prevent re-creation - including all desktop features
  const tabs = useMemo(() => [
    { id: 'content', label: 'Content', icon: PhotoIcon },
    { id: 'streams', label: 'Streams', icon: PlayCircleIcon },
    { id: 'digitals', label: 'Digitals', icon: TagIcon },
    { id: 'offers', label: 'Offers', icon: SparklesIcon },
    { id: 'shop', label: 'Shop', icon: ShoppingBagIcon },
    { id: 'about', label: 'About', icon: UserGroupIcon }
  ], []);

  // Optimized event handlers with useCallback
  const handleFollow = useCallback(() => {
    triggerHaptic('medium');
    setIsFollowing(prev => !prev);
    onFollow?.(!isFollowing);
  }, [isFollowing, onFollow, triggerHaptic]);

  const handleSubscribe = useCallback(() => {
    triggerHaptic('medium');
    // Show subscription cost popup
    openBottomSheet({
      title: `Subscribe to ${creatorData.displayName}`,
      content: (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-lg font-semibold">Monthly Subscription</span>
              <span className="text-2xl font-bold text-purple-600">{creatorData.subscriptionPrice} tokens</span>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Benefits included:</p>
              <ul className="space-y-1">
                {creatorData.subscriptionBenefits.map((benefit, index) => (
                  <li key={index} className="flex items-center text-sm text-gray-600">
                    <CheckBadgeIcon className="h-4 w-4 text-purple-500 mr-2" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <button
            onClick={() => {
              onSubscribe?.({ price: creatorData.subscriptionPrice });
              triggerHaptic('success');
            }}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold"
          >
            Subscribe for {creatorData.subscriptionPrice} tokens/month
          </button>
        </div>
      )
    });
  }, [onSubscribe, triggerHaptic, openBottomSheet, creatorData]);

  const handleStartVideoCall = useCallback(async () => {
    triggerHaptic('heavy');
    openBottomSheet({
      title: 'Video Call with ' + creatorData.displayName,
      content: (
        <div className="space-y-4 p-4">
          <div className="bg-purple-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-gray-600">Video Call Rate</p>
                <p className="text-2xl font-bold text-purple-600">{creatorData.videoCallRate} tokens/min</p>
              </div>
              <VideoCameraIcon className="w-10 h-10 text-purple-500" />
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <p>• Call will start immediately after acceptance</p>
              <p>• You will be charged per minute</p>
              <p>• Minimum call duration: 1 minute</p>
            </div>
          </div>

          <button
            onClick={async () => {
              triggerHaptic('success');
              // Close bottom sheet
              openBottomSheet(null);

              // Show connecting state
              openBottomSheet({
                title: 'Connecting...',
                content: (
                  <div className="p-8 text-center">
                    <div className="animate-pulse mb-4">
                      <VideoCameraIcon className="w-16 h-16 text-purple-600 mx-auto" />
                    </div>
                    <p className="text-lg font-semibold mb-2">Requesting Video Call</p>
                    <p className="text-sm text-gray-600">Notifying {creatorData.displayName}...</p>
                    <div className="mt-6">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-600 border-t-transparent mx-auto" />
                    </div>
                  </div>
                )
              });

              try {
                // Send call request to creator
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                  const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/sessions/request-call`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                      creatorId: creatorId,
                      type: 'video',
                      rate: creatorData.videoCallRate
                    })
                  });

                  if (response.ok) {
                    const data = await response.json();
                    // Emit socket event to notify creator
                    if (socket && typeof socket.emit === 'function') {
                      socket.emit('call-request', {
                        creatorId: creatorId,
                        fanId: user?.id,
                        fanName: user?.username || user?.email,
                        type: 'video',
                        requestId: data.requestId
                      });
                    }

                    // Wait for creator response
                    setTimeout(() => {
                      onStartCall?.('video', data.sessionId);
                    }, 2000);
                  }
                }
              } catch (error) {
                console.error('Failed to initiate call:', error);
                openBottomSheet({
                  title: 'Connection Failed',
                  content: (
                    <div className="p-4 text-center">
                      <p className="text-red-600 mb-4">Unable to connect call</p>
                      <button
                        onClick={() => openBottomSheet(null)}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg"
                      >
                        Close
                      </button>
                    </div>
                  )
                });
              }
            }}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold"
          >
            Start Video Call ({creatorData.videoCallRate} tokens/min)
          </button>
          <button
            onClick={() => openBottomSheet(null)}
            className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold"
          >
            Cancel
          </button>
        </div>
      )
    });
  }, [creatorData, creatorId, user, socket, onStartCall, openBottomSheet, triggerHaptic]);

  const handleStartVoiceCall = useCallback(async () => {
    triggerHaptic('medium');
    openBottomSheet({
      title: 'Voice Call with ' + creatorData.displayName,
      content: (
        <div className="space-y-4 p-4">
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-gray-600">Voice Call Rate</p>
                <p className="text-2xl font-bold text-blue-600">{creatorData.voiceCallRate} tokens/min</p>
              </div>
              <PhoneIcon className="w-10 h-10 text-blue-500" />
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <p>• Call will start immediately after acceptance</p>
              <p>• You will be charged per minute</p>
              <p>• Minimum call duration: 1 minute</p>
            </div>
          </div>

          <button
            onClick={async () => {
              triggerHaptic('success');
              // Close bottom sheet
              openBottomSheet(null);

              // Show connecting state
              openBottomSheet({
                title: 'Connecting...',
                content: (
                  <div className="p-8 text-center">
                    <div className="animate-pulse mb-4">
                      <PhoneIcon className="w-16 h-16 text-blue-600 mx-auto" />
                    </div>
                    <p className="text-lg font-semibold mb-2">Requesting Voice Call</p>
                    <p className="text-sm text-gray-600">Notifying {creatorData.displayName}...</p>
                    <div className="mt-6">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto" />
                    </div>
                  </div>
                )
              });

              try {
                // Send call request to creator
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                  const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/sessions/request-call`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                      creatorId: creatorId,
                      type: 'voice',
                      rate: creatorData.voiceCallRate
                    })
                  });

                  if (response.ok) {
                    const data = await response.json();
                    // Emit socket event to notify creator
                    if (socket && typeof socket.emit === 'function') {
                      socket.emit('call-request', {
                        creatorId: creatorId,
                        fanId: user?.id,
                        fanName: user?.username || user?.email,
                        type: 'voice',
                        requestId: data.requestId
                      });
                    }

                    // Wait for creator response
                    setTimeout(() => {
                      onStartCall?.('voice', data.sessionId);
                    }, 2000);
                  }
                }
              } catch (error) {
                console.error('Failed to initiate call:', error);
                openBottomSheet({
                  title: 'Connection Failed',
                  content: (
                    <div className="p-4 text-center">
                      <p className="text-red-600 mb-4">Unable to connect call</p>
                      <button
                        onClick={() => openBottomSheet(null)}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg"
                      >
                        Close
                      </button>
                    </div>
                  )
                });
              }
            }}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-xl font-semibold"
          >
            Start Voice Call ({creatorData.voiceCallRate} tokens/min)
          </button>
          <button
            onClick={() => openBottomSheet(null)}
            className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold"
          >
            Cancel
          </button>
        </div>
      )
    });
  }, [creatorData, creatorId, user, socket, onStartCall, openBottomSheet, triggerHaptic]);

  const handleSendMessage = useCallback(() => {
    triggerHaptic('light');

    // If message has a price, show pricing first
    if (creatorData.messagePrice > 0) {
      openBottomSheet({
        title: `Message ${creatorData.displayName}`,
        content: (
          <div className="space-y-4 p-4">
            <div className="bg-green-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-gray-600">Message Cost</p>
                  <p className="text-2xl font-bold text-green-600">{creatorData.messagePrice} tokens</p>
                </div>
                <ChatBubbleLeftRightIcon className="w-10 h-10 text-green-500" />
              </div>
              <div className="text-xs text-gray-500">
                <p>• One-time cost per message</p>
                <p>• Creator will be notified</p>
              </div>
            </div>
            <button
              onClick={() => {
                triggerHaptic('success');
                onSendMessage?.();
              }}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-xl font-semibold"
            >
              Send Message ({creatorData.messagePrice} tokens)
            </button>
            <button
              onClick={() => openBottomSheet(null)}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold"
            >
              Cancel
            </button>
          </div>
        )
      });
    } else {
      // Free messaging - go directly
      onSendMessage?.();
    }
  }, [creatorData.messagePrice, creatorData.displayName, onSendMessage, triggerHaptic, openBottomSheet]);

  const handleShare = useCallback(async () => {
    triggerHaptic('light');
    const url = `https://digis.cc/${creatorData.username}`;

    try {
      // Try native share first
      if (navigator.share) {
        return await navigator.share({
          title: creatorData.displayName,
          text: `Check out ${creatorData.displayName} on Digis!`,
          url
        });
      }

      // Try modern clipboard API
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        // TODO: Show toast "Link copied"
        return;
      }

      // Fallback for older browsers
      const dummy = document.createElement('input');
      dummy.value = url;
      document.body.appendChild(dummy);
      dummy.select();
      document.execCommand('copy');
      dummy.remove();
      // TODO: Show toast "Link copied"
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Share failed:', error);
      }
    }
  }, [creatorData.displayName, creatorData.username, triggerHaptic]);

  const handleJoinLiveStream = useCallback(() => {
    triggerHaptic('heavy');
    if (liveStreamData?.isPrivate || liveStreamData?.requiredTier || liveStreamData?.tokenPrice > 0) {
      openBottomSheet({
        title: 'Join Private Stream',
        content: (
          <div className="space-y-4 p-4">
            <div className="bg-purple-50 rounded-xl p-4">
              <p className="text-sm text-gray-600 mb-2">Stream Access</p>
              {liveStreamData.requiredTier ? (
                <p className="text-lg font-semibold text-purple-600">
                  Requires {liveStreamData.requiredTier} Subscription
                </p>
              ) : (
                <p className="text-2xl font-bold text-purple-600">
                  {liveStreamData.tokenPrice} tokens
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setHasJoinedStream(true);
                setShowFullStream(true);
                onJoinStream?.(liveStreamData);
              }}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold"
            >
              Join Stream
            </button>
          </div>
        )
      });
    } else {
      // Free stream - join directly and show full streaming view
      setHasJoinedStream(true);
      setShowFullStream(true);
      onJoinStream?.(liveStreamData);
    }
  }, [liveStreamData, onJoinStream, openBottomSheet, triggerHaptic]);

  const handleToggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newMuted = !prev;
      if (videoRef.current) {
        videoRef.current.muted = newMuted;
      }
      return newMuted;
    });
    triggerHaptic('light');
  }, [triggerHaptic]);

  const handleFullscreen = useCallback(async () => {
    try {
      if (!isFullscreen && videoRef.current) {
        if (videoRef.current.requestFullscreen) {
          await videoRef.current.requestFullscreen();
        } else if (videoRef.current.webkitRequestFullscreen) {
          await videoRef.current.webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
    triggerHaptic('medium');
  }, [isFullscreen, triggerHaptic]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    triggerHaptic('light');
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      // Refresh data here
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [triggerHaptic]);

  // Optimized pull to refresh with scoped listeners
  useEffect(() => {
    const root = document.scrollingElement || document.documentElement;
    let startY = 0;
    let refreshingNow = false;
    const threshold = 90;

    const onStart = (e) => {
      if (root.scrollTop === 0) {
        startY = e.touches[0].clientY;
      }
    };

    const onMove = (e) => {
      if (!startY || refreshingNow || refreshing) return;
      const diff = e.touches[0].clientY - startY;
      if (diff > threshold) {
        refreshingNow = true;
        handleRefresh().finally(() => {
          refreshingNow = false;
          startY = 0;
        });
      }
    };

    const onEnd = () => {
      startY = 0;
    };

    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: true });
    root.addEventListener('touchend', onEnd, { passive: true });

    return () => {
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', onEnd);
    };
  }, [handleRefresh, refreshing]);

  // Extract tab content rendering
  const renderContentTab = () => (
    <div className="space-y-6">
      {/* Live/Recent Streams Section */}
      {isLiveNow && (
        <div>
          <h3 className="text-lg font-semibold mb-3 px-4 flex items-center gap-2">
            <FireIcon className="w-5 h-5 text-red-500" />
            Streams
          </h3>
          {isLiveNow && liveStreamData && (
            <motion.div
              className="mx-4 mb-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-3 border border-red-200"
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (hasJoinedStream) {
                  setShowFullStream(true);
                } else {
                  handleJoinLiveStream();
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
                      <PlayCircleIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Live Now!</p>
                    <p className="text-xs text-gray-500">{liveStreamData.viewers} watching</p>
                  </div>
                </div>
                <ChevronRightIcon className="w-5 h-5 text-red-500" />
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Videos Section */}
      <div>
        <h3 className="text-lg font-semibold mb-3 px-4">Videos</h3>
        <div className="grid grid-cols-2 gap-2 px-4">
          {content.videos.map((video) => (
            <motion.div
              key={video.id}
              className="relative rounded-xl overflow-hidden bg-gray-100"
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (!video.locked || contentPurchases[`video-${video.id}`]) {
                  // Play video
                  console.log('Play video:', video);
                } else {
                  // Show purchase modal
                  triggerHaptic('medium');
                  openBottomSheet({
                    title: 'Unlock Video',
                    content: (
                      <div className="space-y-4 p-4">
                        <div className="bg-purple-50 rounded-xl p-4">
                          <p className="text-sm text-gray-600 mb-2">Video Price</p>
                          <p className="text-2xl font-bold text-purple-600">25 tokens</p>
                        </div>
                        <button
                          onClick={() => {
                            console.log('Purchase video:', video.id);
                            setContentPurchases(prev => ({ ...prev, [`video-${video.id}`]: true }));
                            triggerHaptic('success');
                          }}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold"
                        >
                          Unlock Video
                        </button>
                      </div>
                    )
                  });
                }
              }}
            >
              <img src={video.thumbnail} alt="" className="w-full h-32 object-cover" loading="lazy" />
              {video.locked && !contentPurchases[`video-${video.id}`] && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                  <LockClosedIcon className="w-8 h-8 text-white" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                {video.duration}
              </div>
              <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                {video.views} views
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Photos Section */}
      <div>
        <h3 className="text-lg font-semibold mb-3 px-4">Photos</h3>
        <div className="grid grid-cols-3 gap-1 px-4">
          {content.photos.map((photo) => (
            <motion.div
              key={photo.id}
              className="relative rounded-lg overflow-hidden bg-gray-100"
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (!photo.locked || contentPurchases[`photo-${photo.id}`]) {
                  // View photo
                  console.log('View photo:', photo);
                } else {
                  // Show purchase modal
                  triggerHaptic('medium');
                  openBottomSheet({
                    title: 'Unlock Photo',
                    content: (
                      <div className="space-y-4 p-4">
                        <div className="bg-purple-50 rounded-xl p-4">
                          <p className="text-sm text-gray-600 mb-2">Photo Price</p>
                          <p className="text-2xl font-bold text-purple-600">10 tokens</p>
                        </div>
                        <button
                          onClick={() => {
                            console.log('Purchase photo:', photo.id);
                            setContentPurchases(prev => ({ ...prev, [`photo-${photo.id}`]: true }));
                            triggerHaptic('success');
                          }}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold"
                        >
                          Unlock Photo
                        </button>
                      </div>
                    )
                  });
                }
              }}
            >
              <img src={photo.url} alt="" className="w-full h-28 object-cover" loading="lazy" />
              {photo.locked && !contentPurchases[`photo-${photo.id}`] && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                  <LockClosedIcon className="w-6 h-6 text-white" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
                <HeartIcon className="w-3 h-3" />
                {photo.likes}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderOffersTab = () => (
    <div className="space-y-3 px-4">
      {content.offers.map((offer) => (
        <motion.div
          key={offer.id}
          className="bg-white rounded-xl shadow-sm overflow-hidden"
          whileTap={{ scale: 0.98 }}
        >
          {/* Discount Badge */}
          {offer.discount && (
            <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-3 py-1 text-xs font-bold">
              <div className="flex items-center justify-between">
                <span>🔥 {offer.discount}</span>
                {offer.limited && <span>LIMITED TIME</span>}
              </div>
            </div>
          )}
          
          <div className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{offer.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{offer.description}</p>
              </div>
              {offer.type === 'video' && <VideoCameraIcon className="w-5 h-5 text-purple-600" />}
              {offer.type === 'call' && <PhoneIcon className="w-5 h-5 text-blue-600" />}
              {offer.type === 'subscription' && <SparklesIcon className="w-5 h-5 text-pink-600" />}
              {offer.type === 'photo' && <PhotoIcon className="w-5 h-5 text-green-600" />}
            </div>
            
            {/* Delivery Time */}
            {offer.deliveryTime && (
              <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                <ClockIcon className="w-3 h-3" />
                <span>{offer.deliveryTime}</span>
              </div>
            )}
            
            {/* Price and Action */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900">
                  {offer.recurring ? `${offer.price} tokens/mo` : `${offer.price} tokens`}
                </span>
                {offer.originalPrice && (
                  <span className="text-sm text-gray-400 line-through">
                    {offer.originalPrice} tokens
                  </span>
                )}
              </div>
              <button 
                onClick={() => {
                  triggerHaptic('medium');
                  // Handle purchase/booking
                  console.log('Purchase offer:', offer);
                }}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg font-semibold text-sm min-h-[40px]"
              >
                {offer.recurring ? 'Subscribe' : 'Book Now'}
              </button>
            </div>
          </div>
        </motion.div>
      ))}
      
      {/* Special Offers Banner */}
      <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl p-4 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <BoltIcon className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-purple-900">Bundle Deal</h3>
        </div>
        <p className="text-sm text-purple-700 mb-3">
          Book any 3 offers and save an extra 15%!
        </p>
        <button className="w-full bg-purple-600 text-white py-2 rounded-lg font-semibold text-sm">
          View Bundle Options
        </button>
      </div>
    </div>
  );

  const renderShopTab = () => (
    <div className="space-y-4 px-4">
      {content.shop.map((item) => (
        <motion.div
          key={item.id}
          className="bg-white rounded-xl p-4 shadow-sm"
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold">{item.name}</p>
              <p className="text-sm text-gray-500">{item.type}</p>
            </div>
            <button className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold min-h-[44px]">
              {item.price} tokens
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );

  // Streams/Recordings Tab
  const renderStreamsTab = () => (
    <div className="space-y-6 px-4">
      <h3 className="text-lg font-semibold">Past Streams</h3>
      <div className="space-y-3">
        {content.recordings.map((stream) => (
          <motion.div
            key={stream.id}
            className="bg-white rounded-xl overflow-hidden shadow-sm"
            whileTap={{ scale: 0.98 }}
          >
            <div className="relative">
              <img
                src={stream.thumbnail}
                alt={stream.title}
                className="w-full h-32 object-cover"
                loading="lazy"
              />
              <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                {stream.duration}
              </div>
              {stream.price > 0 && (
                <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded font-bold">
                  {stream.price} tokens
                </div>
              )}
            </div>
            <div className="p-3">
              <h4 className="font-semibold text-gray-900 mb-1">{stream.title}</h4>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{stream.views.toLocaleString()} views</span>
                <span>{stream.date}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  // Digitals Tab
  const renderDigitalsTab = () => (
    <div className="space-y-4 px-4">
      <h3 className="text-lg font-semibold mb-3">Digital Products</h3>
      {content.digitals.map((item) => (
        <motion.div
          key={item.id}
          className="bg-white rounded-xl p-4 shadow-sm"
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{item.name}</p>
              <p className="text-sm text-gray-500 mb-2">{item.type}</p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  {item.downloads} downloads
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                triggerHaptic('medium');
                console.log('Purchase digital:', item);
              }}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg font-semibold text-sm min-h-[40px]"
            >
              {item.price} tokens
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );

  const renderAboutTab = () => (
    <div className="space-y-6 px-4">
      {/* Bio */}
      <div className="bg-white rounded-xl p-4">
        <h3 className="font-semibold mb-2">About</h3>
        <p className="text-gray-600">{creatorData.bio}</p>
      </div>
      
      {/* Schedule Info */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-purple-600" />
          Schedule
        </h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>📅 <strong>Live Streams:</strong> Tue & Thu at 8 PM EST</p>
          <p>💬 <strong>DM Response:</strong> Daily 2-5 PM</p>
          <p>📞 <strong>Video Calls:</strong> By appointment (48h notice)</p>
          <p>🎯 <strong>Special Shows:</strong> Fridays 9 PM (ticketed)</p>
        </div>
        {ticketedShows.length > 0 && (
          <button
            onClick={() => {
              triggerHaptic('light');
              openBottomSheet({
                title: 'Ticketed Shows',
                content: (
                  <div className="space-y-3 p-4">
                    {ticketedShows.map((show) => (
                      <div key={show.id} className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-semibold">{show.title}</h4>
                            <p className="text-sm text-gray-600">{new Date(show.scheduled_time).toLocaleDateString()}</p>
                          </div>
                          <span className="bg-purple-100 text-purple-600 px-2 py-1 rounded text-sm font-semibold">
                            {show.ticket_price} tokens
                          </span>
                        </div>
                        <button className="w-full bg-purple-600 text-white py-2 rounded-lg font-semibold text-sm">
                          Buy Ticket
                        </button>
                      </div>
                    ))}
                  </div>
                )
              });
            }}
            className="w-full mt-3 bg-purple-600 text-white py-2 rounded-lg font-semibold text-sm"
          >
            View Ticketed Shows ({ticketedShows.length})
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="bg-white rounded-xl p-4">
        <h3 className="font-semibold mb-3">Stats</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold text-purple-600">{creatorData.followers.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Followers</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">{creatorData.subscribers.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Subscribers</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{creatorData.contentCount}</p>
            <p className="text-sm text-gray-500">Content</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-600">{creatorData.rating}</p>
            <p className="text-sm text-gray-500">Rating</p>
          </div>
        </div>
      </div>

      {/* Interests */}
      <div className="bg-white rounded-xl p-4">
        <h3 className="font-semibold mb-3">Interests</h3>
        <div className="flex flex-wrap gap-2">
          {creatorData.interests.map((interest) => (
            <span
              key={interest}
              className="bg-purple-100 text-purple-600 px-3 py-1 rounded-full text-sm"
            >
              {interest}
            </span>
          ))}
        </div>
      </div>

      {/* Response Time */}
      <div className="bg-white rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Response Time</p>
            <p className="text-sm text-gray-500">{creatorData.responseTime}</p>
          </div>
          <ClockIcon className="w-6 h-6 text-green-500" />
        </div>
      </div>

      {/* Calendar Integration */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-blue-600" />
          Book a Session
        </h3>
        <button
          onClick={() => {
            triggerHaptic('medium');
            // Navigate to calendar booking
            console.log('Open calendar booking');
          }}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold text-sm">
          View Available Slots
        </button>
      </div>
    </div>
  );

  // Show full streaming view if user has joined
  if (showFullStream && liveStreamData) {
    return (
      <MobileLiveStreamView
        streamData={liveStreamData}
        creator={creatorData}
        user={user}
        onClose={() => setShowFullStream(false)}
        onSendGift={(gift) => {
          console.log('Gift sent:', gift);
          triggerHaptic('heavy');
        }}
        onSendTip={(amount) => {
          console.log('Tip sent:', amount);
          triggerHaptic('heavy');
        }}
      />
    );
  }

  // Loading state
  if (isLoadingProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-600 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (networkError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center">
        <div className="text-center p-6">
          <p className="text-gray-600 mb-4">Unable to load profile</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg min-h-[44px]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Live Stream Video Player - AT THE VERY TOP when creator is live */}
      {isLiveNow && liveStreamData && (
        <div className="bg-black" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="relative">
            {/* Video Player or Preview */}
            <div className="relative" style={{ paddingTop: '56.25%' /* 16:9 Aspect Ratio */ }}>
              {/* Actual Video for joined/public streams */}
              {(hasJoinedStream || (!liveStreamData.isPrivate && !liveStreamData.requiredTier && liveStreamData.tokenPrice === 0)) ? (
                <>
                  <video
                    ref={videoRef}
                    className="absolute top-0 left-0 w-full h-full object-cover"
                    autoPlay
                    playsInline
                    muted={isMuted}
                    controls={false}
                    onLoadedData={() => setIsVideoLoading(false)}
                    onError={(e) => {
                      console.error('Video error:', e);
                      setVideoLoadError(true);
                      setIsVideoLoading(false);
                    }}
                    onWaiting={() => setIsVideoLoading(true)}
                    onPlaying={() => setIsVideoLoading(false)}
                    aria-label="Live stream video"
                  >
                    <source src={liveStreamData.streamUrl} type="application/x-mpegURL" />
                    <source src="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" type="application/x-mpegURL" />
                    Your browser does not support the video tag.
                  </video>
                  
                  {/* Loading indicator */}
                  {isVideoLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent" />
                    </div>
                  )}
                  
                  {/* Error state */}
                  {videoLoadError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                      <div className="text-center text-white p-4">
                        <p className="mb-2">Unable to load stream</p>
                        <button
                          onClick={() => {
                            setVideoLoadError(false);
                            setIsVideoLoading(true);
                            videoRef.current?.load();
                          }}
                          className="bg-white/20 px-4 py-2 rounded-lg min-h-[44px]"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Custom Controls Overlay - Click to enter full stream */}
                  <button
                    onClick={() => setShowFullStream(true)}
                    className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 cursor-pointer"
                    aria-label="Enter full streaming view"
                  >
                    {/* Top Bar - Live indicator and viewers */}
                    <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2">
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                          <span className="text-xs font-bold">LIVE</span>
                        </div>
                        <div className="bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-full flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs font-semibold">{streamViewers || liveStreamData.viewers}</span>
                        </div>
                      </div>
                      <div className="bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-xs font-medium">
                        {liveStreamData.duration}
                      </div>
                    </div>

                    {/* Bottom Controls */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                      <h3 className="text-white font-semibold text-sm flex-1 line-clamp-1">
                        {liveStreamData.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleToggleMute}
                          className="bg-black/60 backdrop-blur-sm text-white p-2 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center"
                          aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                        >
                          {isMuted ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={handleFullscreen}
                          className="bg-black/60 backdrop-blur-sm text-white p-2 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center"
                          aria-label="Toggle fullscreen"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Enter Full Stream Indicator */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      <span className="text-white text-sm font-medium">Tap for Full Stream & Chat</span>
                    </div>
                  </button>

                  {/* Stream Quality Selector */}
                  <div className="absolute top-3 right-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic('light');
                        openBottomSheet({
                          title: 'Stream Quality',
                          content: (
                            <div className="space-y-2 p-4">
                              {['auto', '2K', '1080p', '720p', '480p'].map((quality) => (
                                <button
                                  key={quality}
                                  onClick={() => {
                                    setStreamQuality(quality);
                                    triggerHaptic('light');
                                  }}
                                  className={`w-full p-3 rounded-lg text-left flex items-center justify-between ${
                                    streamQuality === quality
                                      ? 'bg-purple-100 text-purple-600'
                                      : 'bg-gray-50 text-gray-700'
                                  }`}
                                >
                                  <span className="font-medium">{quality === 'auto' ? 'Auto (Recommended)' : quality}</span>
                                  {streamQuality === quality && (
                                    <CheckBadgeIcon className="w-5 h-5" />
                                  )}
                                </button>
                              ))}
                            </div>
                          )
                        });
                      }}
                      className="bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-lg text-sm font-medium min-h-[32px]"
                    >
                      {streamQuality === 'auto' ? 'Auto' : streamQuality}
                    </button>
                  </div>
                </>
              ) : (
                /* Blurred Preview for Private/Paid Streams */
                <div className="absolute top-0 left-0 w-full h-full">
                  <img
                    src={liveStreamData.thumbnail}
                    alt="Stream Preview"
                    className="w-full h-full object-cover blur-xl"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="text-center text-white p-6">
                      <LockClosedIcon className="w-12 h-12 mx-auto mb-3" />
                      <h3 className="font-bold text-lg mb-2">Private Stream</h3>
                      <p className="text-sm mb-4">
                        {liveStreamData.requiredTier 
                          ? `Requires ${liveStreamData.requiredTier} subscription`
                          : `${liveStreamData.tokenPrice} tokens to watch`
                        }
                      </p>
                      <motion.button
                        onClick={handleJoinLiveStream}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold min-h-[44px]"
                        whileTap={{ scale: 0.95 }}
                      >
                        Unlock Stream
                      </motion.button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header with Parallax Effect */}
      <div className="relative" ref={headerRef}>
        <motion.div 
          className="relative h-64 overflow-hidden"
          style={{ y: headerY, opacity: headerOpacity, scale: headerScale }}
        >
          <img
            src={creatorData.coverUrl}
            alt=""
            className="w-full h-full object-cover"
            width={1200}
            height={600}
            sizes="100vw"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </motion.div>

        {/* Navigation Bar */}
        <div className="absolute top-0 left-0 right-0 flex justify-between items-center p-4 z-10" style={{ paddingTop: 'env(safe-area-inset-top, 20px)' }}>
          <button
            onClick={onBack}
            className="min-w-[44px] min-h-[44px] bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center"
            aria-label="Go back"
          >
            <ChevronLeftIcon className="w-6 h-6 text-white" />
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="min-w-[44px] min-h-[44px] bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center"
              aria-label="Share profile"
            >
              <ShareIcon className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="min-w-[44px] min-h-[44px] bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center"
              aria-label={showNotifications ? 'Disable notifications' : 'Enable notifications'}
            >
              {showNotifications ? (
                <BellSolidIcon className="w-5 h-5 text-yellow-400" />
              ) : (
                <BellIcon className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Profile Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-6">
          <div className="flex items-end gap-4">
            {/* Avatar */}
            <motion.div
              className="relative"
              whileTap={{ scale: 0.95 }}
            >
              <img
                src={creatorData.avatarUrl || getDefaultAvatarUrl(creatorData.displayName, 160)}
                alt={creatorData.displayName}
                className="w-20 h-20 rounded-full border-4 border-white shadow-lg object-cover"
                width={160}
                height={160}
                loading="eager"
              />
              {isLiveNow ? (
                <div className="absolute bottom-1 right-1">
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500 rounded-full animate-ping" />
                    <div className="relative bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                      LIVE
                    </div>
                  </div>
                </div>
              ) : creatorData.isOnline ? (
                <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white" />
              ) : null}
            </motion.div>

            {/* Name and Status */}
            <div className="flex-1 mb-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white">{creatorData.displayName}</h1>
                {creatorData.isVerified && (
                  <CheckBadgeIcon className="w-6 h-6 text-blue-400" />
                )}
              </div>
              <p className="text-white/80">@{creatorData.username}</p>
              <p className="text-white/60 text-sm">{creatorData.lastSeen}</p>
              {/* Loyalty Badges */}
              {loyaltyBadges.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {loyaltyBadges.map((badge, idx) => (
                    <span key={idx} className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
                      {badge}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-3 bg-white shadow-sm" style={{ paddingBottom: `max(12px, env(safe-area-inset-bottom))` }}>
        <div className="flex gap-2 mb-2">
          <motion.button
            onClick={handleFollow}
            className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all min-h-[36px] ${
              isFollowing
                ? 'bg-gray-100 text-gray-700'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </motion.button>
          <motion.button
            onClick={() => handleSubscribe()}
            className={`flex-1 py-2 rounded-lg font-medium text-sm min-h-[36px] ${
              isSubscribed
                ? 'bg-gray-100 text-gray-700'
                : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            {isSubscribed ? 'Subscribed' : 'Subscribe'}
          </motion.button>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {isLiveNow ? (
            <motion.button
              onClick={handleJoinLiveStream}
              className="bg-gradient-to-r from-red-500 to-pink-500 text-white p-2.5 rounded-lg flex items-center justify-center relative overflow-hidden min-h-[44px]"
              whileTap={{ scale: 0.95 }}
              aria-label="Watch Live"
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
              <PlayCircleIcon className="w-5 h-5 relative z-10" />
            </motion.button>
          ) : (
            <motion.button
              onClick={handleStartVideoCall}
              className="bg-purple-100 text-purple-600 p-2.5 rounded-lg flex items-center justify-center min-h-[44px]"
              whileTap={{ scale: 0.95 }}
              aria-label="Video Call"
            >
              <VideoCameraIcon className="w-5 h-5" />
            </motion.button>
          )}
          <motion.button
            onClick={handleStartVoiceCall}
            className="bg-blue-100 text-blue-600 p-2.5 rounded-lg flex items-center justify-center min-h-[44px]"
            whileTap={{ scale: 0.95 }}
            aria-label="Voice Call"
          >
            <PhoneIcon className="w-5 h-5" />
          </motion.button>
          <motion.button
            onClick={handleSendMessage}
            className="bg-green-100 text-green-600 p-2.5 rounded-lg flex items-center justify-center min-h-[44px]"
            whileTap={{ scale: 0.95 }}
            aria-label="Message"
          >
            <ChatBubbleLeftRightIcon className="w-5 h-5" />
          </motion.button>
          <motion.button
            onClick={() => {
              triggerHaptic('medium');
              openBottomSheet({
                title: 'Send a Tip',
                content: (
                  <div className="space-y-4 p-4">
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4">
                      <p className="text-sm text-gray-600 mb-3">Choose tip amount (tokens)</p>
                      <div className="grid grid-cols-4 gap-2">
                        {[25, 50, 100, 200].map((amount) => (
                          <button
                            key={amount}
                            onClick={() => {
                              console.log('Tip sent:', amount);
                              triggerHaptic('success');
                            }}
                            className="py-2 px-3 bg-white rounded-lg text-purple-600 font-semibold border border-purple-200"
                          >
                            {amount}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      placeholder="Custom amount"
                      className="w-full p-3 border border-gray-200 rounded-lg"
                      min="1"
                    />
                    <button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold">
                      Send Tip
                    </button>
                  </div>
                )
              });
            }}
            className="bg-amber-100 text-amber-600 p-2.5 rounded-lg flex items-center justify-center min-h-[44px]"
            whileTap={{ scale: 0.95 }}
            aria-label="Send Tip"
          >
            <GiftIcon className="w-5 h-5" />
          </motion.button>
          <motion.button
            onClick={() => {
              triggerHaptic('medium');
              // Navigate to schedule page or open schedule modal
              openBottomSheet({
                title: `Schedule with ${creatorData.displayName}`,
                content: (
                  <div className="space-y-4 p-4">
                    <div className="bg-indigo-50 rounded-xl p-4">
                      <p className="text-sm text-gray-600 mb-3">Available for booking:</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Video Calls</span>
                          <span className="text-sm font-semibold text-purple-600">{creatorData.videoCallRate} tokens/min</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Voice Calls</span>
                          <span className="text-sm font-semibold text-blue-600">{creatorData.voiceCallRate} tokens/min</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        console.log('Navigate to schedule page for creator:', creatorId);
                        // Navigate to /schedule/{creatorId} or open full calendar
                        window.location.href = `/schedule/${creatorId}`;
                      }}
                      className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold"
                    >
                      View Available Times
                    </button>
                  </div>
                )
              });
            }}
            className="bg-indigo-100 text-indigo-600 p-2.5 rounded-lg flex items-center justify-center min-h-[44px]"
            whileTap={{ scale: 0.95 }}
            aria-label="Schedule"
          >
            <CalendarIcon className="w-5 h-5" />
          </motion.button>
        </div>
      </div>


      {/* Tabs - Scrollable Horizontal */}
      <div className="sticky top-0 bg-white border-b border-gray-100 z-10" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex" role="tablist" style={{ minWidth: 'max-content' }}>
            {tabs.map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  triggerHaptic('light');
                }}
                className={`px-4 py-2.5 flex flex-col items-center gap-1 relative transition-all min-h-[44px] min-w-[60px] ${
                  activeTab === tab.id
                    ? 'text-purple-600'
                    : 'text-gray-500'
                }`}
                whileTap={{ scale: 0.95 }}
                aria-label={`View ${tab.label}`}
                role="tab"
                aria-selected={activeTab === tab.id}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-purple-600 rounded-full"
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="pb-20" style={{ minHeight: 'calc(100vh - 400px)' }}>
        {/* Refresh Indicator */}
        <AnimatePresence>
          {refreshing && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="absolute top-0 left-0 right-0 flex justify-center py-4 z-20"
            >
              <div className="bg-white rounded-full px-4 py-2 shadow-lg flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <ArrowPathIcon className="w-5 h-5 text-purple-600" />
                </motion.div>
                <span className="text-sm font-medium">Refreshing...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="py-4">
          <AnimatePresence mode="wait">
            {activeTab === 'content' && <div key="content">{renderContentTab()}</div>}
            {activeTab === 'streams' && <div key="streams">{renderStreamsTab()}</div>}
            {activeTab === 'digitals' && <div key="digitals">{renderDigitalsTab()}</div>}
            {activeTab === 'offers' && <div key="offers">{renderOffersTab()}</div>}
            {activeTab === 'shop' && <div key="shop">{renderShopTab()}</div>}
            {activeTab === 'about' && <div key="about">{renderAboutTab()}</div>}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default MobileCreatorProfile;