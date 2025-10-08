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

  // Real data states
  const [photos, setPhotos] = useState([]);
  const [videos, setVideos] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [digitals, setDigitals] = useState([]);
  const [shopProducts, setShopProducts] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState({
    photos: true,
    videos: true,
    recordings: true,
    digitals: true,
    shop: true,
    offers: true
  });

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

  // Fetch all real content data
  useEffect(() => {
    const fetchCreatorContent = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const headers = {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        };

        // Fetch all data in parallel
        const [
          photosRes,
          videosRes,
          recordingsRes,
          digitalsRes,
          shopRes,
          offersRes,
          ticketedShowsRes
        ] = await Promise.allSettled([
          fetch(`${import.meta.env.VITE_BACKEND_URL}/api/content/creator/${creatorId}?type=photo`, { headers }),
          fetch(`${import.meta.env.VITE_BACKEND_URL}/api/content/creator/${creatorId}?type=video`, { headers }),
          fetch(`${import.meta.env.VITE_BACKEND_URL}/api/streams/recordings/${creatorId}`, { headers }),
          fetch(`${import.meta.env.VITE_BACKEND_URL}/api/digitals/creator/${creatorId}`, { headers }),
          fetch(`${import.meta.env.VITE_BACKEND_URL}/api/shop/items?creator_id=${creatorId}`, { headers }),
          fetch(`${import.meta.env.VITE_BACKEND_URL}/api/offers/creator/${creatorId}`, { headers }),
          fetch(`${import.meta.env.VITE_BACKEND_URL}/api/ticketed-shows/creator/${creatorId}`, { headers })
        ]);

        // Process photos
        if (photosRes.status === 'fulfilled' && photosRes.value.ok) {
          const data = await photosRes.value.json();
          setPhotos(data.content || data.items || []);
        }
        setLoading(prev => ({ ...prev, photos: false }));

        // Process videos
        if (videosRes.status === 'fulfilled' && videosRes.value.ok) {
          const data = await videosRes.value.json();
          setVideos(data.content || data.items || []);
        }
        setLoading(prev => ({ ...prev, videos: false }));

        // Process recordings
        if (recordingsRes.status === 'fulfilled' && recordingsRes.value.ok) {
          const data = await recordingsRes.value.json();
          setRecordings(data.recordings || data.items || []);
        }
        setLoading(prev => ({ ...prev, recordings: false }));

        // Process digitals
        if (digitalsRes.status === 'fulfilled' && digitalsRes.value.ok) {
          const data = await digitalsRes.value.json();
          setDigitals(data.digitals || data.items || []);
        }
        setLoading(prev => ({ ...prev, digitals: false }));

        // Process shop products
        if (shopRes.status === 'fulfilled' && shopRes.value.ok) {
          const data = await shopRes.value.json();
          setShopProducts(data.items || data.products || []);
        }
        setLoading(prev => ({ ...prev, shop: false }));

        // Process offers
        if (offersRes.status === 'fulfilled' && offersRes.value.ok) {
          const data = await offersRes.value.json();
          setOffers(data.offers || data.items || []);
        }
        setLoading(prev => ({ ...prev, offers: false }));

        // Process ticketed shows
        if (ticketedShowsRes.status === 'fulfilled' && ticketedShowsRes.value.ok) {
          const data = await ticketedShowsRes.value.json();
          setTicketedShows(data.shows || []);
        }

      } catch (error) {
        console.error('Error fetching creator content:', error);
        // Set all loading states to false on error
        setLoading({
          photos: false,
          videos: false,
          recordings: false,
          digitals: false,
          shop: false,
          offers: false
        });
      }
    };

    if (creatorId) {
      fetchCreatorContent();
    }
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


  // Memoize tabs to prevent re-creation - including all desktop features
  const tabs = useMemo(() => [
    { id: 'content', label: 'Photos', icon: PhotoIcon },
    { id: 'videos', label: 'Videos', icon: VideoCameraIcon },
    { id: 'streams', label: 'Streams', icon: PlayCircleIcon },
    { id: 'offers', label: 'Offers', icon: SparklesIcon },
    { id: 'shop', label: 'Shop', icon: ShoppingBagIcon },
    { id: 'digitals', label: 'Digitals', icon: DocumentIcon },
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

  // Extract tab content rendering - Photos only (vertical aspect ratio)
  const renderContentTab = () => {
    if (loading.photos) {
      return (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-600 border-t-transparent" />
        </div>
      );
    }

    if (photos.length === 0) {
      return (
        <div className="text-center py-12 px-4">
          <PhotoIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No photos yet</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Photos Section */}
        <div>
          <div className="grid grid-cols-3 gap-1 px-4">
            {photos.map((photo) => (
              <motion.div
                key={photo.id}
                className="relative rounded-lg overflow-hidden bg-gray-100 aspect-[3/4]"
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                if (!photo.is_locked || contentPurchases[`photo-${photo.id}`]) {
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
                <img src={photo.thumbnail_url || photo.url || photo.content_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                {photo.is_locked && !contentPurchases[`photo-${photo.id}`] && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                    <LockClosedIcon className="w-6 h-6 text-white" />
                  </div>
                )}
                {photo.likes_count > 0 && (
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    <HeartIcon className="w-3 h-3" />
                    {photo.likes_count || photo.likes || 0}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Videos Tab - Vertical (Reels-style)
  const renderVideosTab = () => {
    if (loading.videos) {
      return (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-600 border-t-transparent" />
        </div>
      );
    }

    if (videos.length === 0) {
      return (
        <div className="text-center py-12 px-4">
          <VideoCameraIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No videos yet</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Videos Section */}
        <div>
          <div className="grid grid-cols-3 gap-1 px-4">
            {videos.map((video) => (
              <motion.div
                key={video.id}
                className="relative rounded-xl overflow-hidden bg-gray-100 aspect-[9/16]"
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (!video.is_locked || contentPurchases[`video-${video.id}`]) {
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
              <img src={video.thumbnail_url || video.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
              {video.is_locked && !contentPurchases[`video-${video.id}`] && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                  <LockClosedIcon className="w-8 h-8 text-white" />
                  </div>
                )}
                {video.duration && (
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {video.duration}
                  </div>
                )}
                {video.views_count > 0 && (
                  <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {video.views_count || video.views} views
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderOffersTab = () => {
    if (loading.offers) {
      return (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-600 border-t-transparent" />
        </div>
      );
    }

    if (offers.length === 0) {
      return (
        <div className="text-center py-12 px-4">
          <SparklesIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No offers yet</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 px-4">
        {offers.map((offer) => (
        <motion.div
          key={offer.id}
          whileTap={{ scale: 0.98 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-1">{offer.title}</h4>
              <p className="text-sm text-gray-600 mb-2">{offer.description}</p>
              {offer.deliveryTime && (
                <p className="text-xs text-gray-500">⏱️ {offer.deliveryTime}</p>
              )}
            </div>
            {offer.limited && (
              <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full font-semibold">
                Limited
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div>
              {offer.originalPrice && (
                <p className="text-xs text-gray-400 line-through">
                  {offer.originalPrice} tokens
                </p>
              )}
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-purple-600">{offer.price}</span>
                <span className="text-sm text-gray-500">tokens</span>
                {offer.discount && (
                  <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-semibold">
                    {offer.discount}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                triggerHaptic('medium');
                console.log('Purchase offer:', offer);
              }}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg font-semibold text-sm"
            >
              Get Now
            </button>
          </div>
        </motion.div>
        ))}
      </div>
    );
  };

  const renderShopTab = () => {
    if (loading.shop) {
      return (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-600 border-t-transparent" />
        </div>
      );
    }

    if (shopProducts.length === 0) {
      return (
        <div className="text-center py-12 px-4">
          <ShoppingBagIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No products yet</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-2 px-4">
        {shopProducts.map((product) => (
        <motion.div
          key={product.id}
          whileTap={{ scale: 0.98 }}
          className="bg-white rounded-lg border border-gray-200 overflow-hidden"
          onClick={() => {
            triggerHaptic('light');
            console.log('View product:', product);
          }}
        >
          {/* Compact Product Image */}
          <div className="relative aspect-square bg-gradient-to-br from-purple-100 to-pink-100">
            <div className="absolute inset-0 flex items-center justify-center">
              <ShoppingBagIcon className="w-8 h-8 text-purple-300" />
            </div>
            <div className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full"></div>
          </div>

          {/* Compact Product Info */}
          <div className="p-2">
            <h4 className="font-medium text-xs mb-1 line-clamp-1">{product.name || product.title}</h4>
            <p className="text-[10px] text-gray-500 mb-2 capitalize">{product.category || product.type}</p>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-purple-600">{product.price_tokens || product.price}</span>
                <span className="text-[10px] text-gray-500 ml-0.5">tokens</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('medium');
                  console.log('Buy product:', product);
                }}
                className="text-[10px] px-2 py-1 bg-purple-600 text-white rounded"
              >
                Buy
              </button>
            </div>
          </div>
        </motion.div>
        ))}
      </div>
    );
  };

  // Streams/Recordings Tab - Horizontal aspect ratio
  const renderStreamsTab = () => {
    if (loading.recordings) {
      return (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-600 border-t-transparent" />
        </div>
      );
    }

    if (recordings.length === 0) {
      return (
        <div className="text-center py-12 px-4">
          <PlayCircleIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No stream recordings yet</p>
        </div>
      );
    }

    return (
      <div className="space-y-6 px-4">
        <div className="space-y-3">
          {recordings.map((stream) => (
          <motion.div
            key={stream.id}
            className="bg-white rounded-xl overflow-hidden shadow-sm"
            whileTap={{ scale: 0.98 }}
          >
            <div className="relative aspect-video">
              <img
                src={stream.thumbnail_url || stream.thumbnail}
                alt={stream.title || stream.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {stream.duration && (
                <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {stream.duration}
                </div>
              )}
              {stream.price_tokens > 0 && (
                <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded font-bold">
                  {stream.price_tokens || stream.price} tokens
                </div>
              )}
            </div>
            <div className="p-3">
              <h4 className="font-semibold text-gray-900 mb-1">{stream.title || stream.name}</h4>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{(stream.views_count || stream.views || 0).toLocaleString()} views</span>
                <span>{stream.created_at ? new Date(stream.created_at).toLocaleDateString() : stream.date}</span>
              </div>
            </div>
          </motion.div>
          ))}
        </div>
      </div>
    );
  };

  // Digitals Tab - Studio Model Section (2-column grid, clean layout)
  const renderDigitalsTab = () => {
    if (loading.digitals) {
      return (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-600 border-t-transparent" />
        </div>
      );
    }

    return (
      <div className="space-y-4 px-4">
        {user?.id === creatorId && (
          <div className="flex justify-end mb-4">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                triggerHaptic('medium');
                // Open upload modal
                console.log('Upload new digitals');
              }}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
            >
              <PhotoIcon className="w-4 h-4" />
              Upload
            </motion.button>
          </div>
        )}

        {digitals.length === 0 ? (
          <div className="text-center py-12">
            <DocumentIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No studio digitals yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {digitals.map((item) => (
          <motion.div
            key={item.id}
            className="relative rounded-xl overflow-hidden bg-gray-100 aspect-[3/4]"
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              triggerHaptic('light');
              console.log('View digital:', item);
            }}
              >
                <img
                  src={item.thumbnail_url || item.thumbnail || '/api/placeholder/300/400'}
                  alt={`Studio digital by ${creatorData.displayName}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />

                {/* Metadata overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <p className="text-white text-xs font-medium">{item.title || item.name}</p>
                  <p className="text-white/70 text-xs mt-1">
                    Uploaded {new Date(item.created_at || item.uploadedAt || Date.now()).toLocaleDateString()}
                  </p>
                </div>

                {/* Professional badge */}
                <div className="absolute top-2 right-2 bg-blue-500/90 text-white px-2 py-1 rounded text-xs font-bold">
                  PRO
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderAboutTab = () => (
    <div className="space-y-6 px-4">
      {/* Bio */}
      <div className="bg-white rounded-xl p-4">
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

                  {/* Stream Quality Selector - Connected to HLS levels */}
                  <div className="absolute top-3 right-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic('light');

                        // Get available quality levels from HLS
                        const availableLevels = hlsRef.current?.levels || [];
                        const qualityOptions = ['auto', ...availableLevels.map(l => `${l.height}p`)];

                        openBottomSheet({
                          title: 'Stream Quality',
                          content: (
                            <div className="space-y-2 p-4">
                              {qualityOptions.map((quality) => (
                                <button
                                  key={quality}
                                  onClick={() => {
                                    // Apply quality change to HLS
                                    if (hlsRef.current) {
                                      if (quality === 'auto') {
                                        hlsRef.current.autoLevelEnabled = true;
                                        hlsRef.current.currentLevel = -1;
                                      } else {
                                        hlsRef.current.autoLevelEnabled = false;
                                        const levelIndex = hlsRef.current.levels.findIndex(
                                          l => `${l.height}p` === quality
                                        );
                                        if (levelIndex >= 0) {
                                          hlsRef.current.currentLevel = levelIndex;
                                        }
                                      }
                                    }
                                    setStreamQuality(quality);
                                    triggerHaptic('light');
                                    openBottomSheet(null);
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
        <div className="absolute top-0 left-0 right-0 flex justify-end items-center p-4 z-10" style={{ paddingTop: 'env(safe-area-inset-top, 20px)' }}>
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
              {/* Follower Count - Under username */}
              <div className="flex items-center gap-1.5 text-white/80 mt-1">
                <UserGroupIcon className="w-4 h-4" />
                <span className="font-semibold text-sm">{creatorData.followers.toLocaleString()}</span>
              </div>
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
            className={`flex-1 py-1.5 rounded-lg font-medium text-xs transition-all min-h-[32px] ${
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
            className={`flex-1 py-1.5 rounded-lg font-medium text-xs min-h-[32px] ${
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


      {/* Tabs - Sticky with improved styling */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm z-10" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex" role="tablist" style={{ minWidth: 'max-content' }}>
            {tabs.map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  triggerHaptic('light');
                }}
                className={`px-4 py-3 flex flex-col items-center gap-1 relative transition-all min-h-[60px] min-w-[70px] ${
                  activeTab === tab.id
                    ? 'text-purple-600'
                    : 'text-gray-500'
                }`}
                whileTap={{ scale: 0.95 }}
                aria-label={`View ${tab.label}`}
                role="tab"
                aria-selected={activeTab === tab.id}
              >
                <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'drop-shadow-sm' : ''}`} />
                <span className={`text-[10px] font-medium ${activeTab === tab.id ? 'font-semibold' : ''}`}>{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-2 right-2 h-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-lg"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
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
            {activeTab === 'videos' && <div key="videos">{renderVideosTab()}</div>}
            {activeTab === 'streams' && <div key="streams">{renderStreamsTab()}</div>}
            {activeTab === 'offers' && <div key="offers">{renderOffersTab()}</div>}
            {activeTab === 'shop' && <div key="shop">{renderShopTab()}</div>}
            {activeTab === 'digitals' && <div key="digitals">{renderDigitalsTab()}</div>}
            {activeTab === 'about' && <div key="about">{renderAboutTab()}</div>}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default MobileCreatorProfile;