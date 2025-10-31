import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import CallRequestsModal from './CallRequestsModal';
import CallQueueSystem from './CallQueueSystem';
import CallAvailabilityIndicator from './CallAvailabilityIndicator';
import PreCallReminder from './PreCallReminder';
import CreatorKYCVerification from './CreatorKYCVerification';
import CreatorSavedStreams from './CreatorSavedStreams';
import StreamRecordingManager from './StreamRecordingManager';
import TopSupportersPanel from './TopSupportersPanel';
import StreamAnalyticsEnhanced from './StreamAnalyticsEnhanced';
import {
  PlayIcon,
  PencilIcon,
  PencilSquareIcon,
  PhotoIcon,
  VideoCameraIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  SparklesIcon,
  CheckCircleIcon,
  HeartIcon,
  EyeIcon,
  ShoppingBagIcon,
  CurrencyDollarIcon,
  ShareIcon,
  CalendarIcon,
  UserGroupIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  GiftIcon,
  MegaphoneIcon,
  CameraIcon,
  PlusIcon,
  TicketIcon,
  ClockIcon,
  FireIcon,
  StarIcon,
  BanknotesIcon,
  InboxIcon,
  Cog6ToothIcon,
  ChevronRightIcon,
  TrashIcon,
  LightBulbIcon,
  ChatBubbleBottomCenterTextIcon,
  UserPlusIcon,
  TrophyIcon,
  TagIcon,
  ArrowPathIcon,
  UserCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid, SparklesIcon as SparklesSolid } from '@heroicons/react/24/solid';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import api from '../services/api';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { getAuthToken } from '../utils/supabase-auth';
import LiquidGlass from './ui/LiquidGlass';
import { isFeatureEnabled } from '../config/featureFlags';
import toast from 'react-hot-toast';
import Button from './ui/Button';
import Card from './ui/Card';
import Modal from './ui/Modal';
import MassMessageModal from './MassMessageModal';
import DualBadgeDisplay from './DualBadgeDisplay';
// import CallInviteModal from './CallInviteModal'; // Moved to CallsPage
// import CallManagementModal from './CallManagementModal'; // Moved to CallsPage
import EnhancedScheduleCalendar from './EnhancedScheduleCalendar';
import EnhancedContentGallery from './EnhancedContentGallery';
import PricingRatesModal from './PricingRatesModal';
import ImageCropModal from './media/ImageCropModal';
import TokenTipping from './TokenTipping';
import DigitalsUploadModal from './DigitalsUploadModal';
import NotificationCenter from './NotificationCenter';

// Import ItemModal for Add Product functionality
import { ItemModal } from './CreatorShopManagement';

// HYBRID_CREATOR_DASHBOARD_ACTIVE - This is the active component file
const HybridCreatorDashboard = memo(({
  user,
  onNavigate,
  onShowGoLive,
  onShowAvailability,
  onShowEarnings,
  onShowSettings,
  tokenBalance = 0,
  sessionStats = {},
  contentData: externalContentData,
  onContentUpdate: onExternalContentUpdate
}) => {
  // Mount beacon for diagnostics
  useEffect(() => {
    console.info("[MOUNT] HybridCreatorDashboard.js");
  }, []);

  const isNavigatingRef = useRef(false);
  // Initialize profile data from user prop (from Zustand store) without fallback defaults
  // This prevents showing "Creator Name" / "creator" before API data loads
  const [profileData, setProfileData] = useState({
    banner: user?.banner_url || '/placeholder-banner.jpg',
    avatar: user?.avatar_url || '/avatar-placeholder.png',
    name: user?.name || user?.display_name || '',
    username: user?.username || '',
    bio: user?.bio || '',
    views: 0,
    followers: 0,
    subscribers: 0,
    badges: user?.badges || []
  });
  
  const [showPricingRatesModal, setShowPricingRatesModal] = useState(false);
  const [showTokenTipping, setShowTokenTipping] = useState(false);
  const [tippingRecipient, setTippingRecipient] = useState(null);
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState(null);
  const [editedProfile, setEditedProfile] = useState({
    name: '',
    username: '',
    bio: '',
    category: ''
  });
  
  const [analytics, setAnalytics] = useState({
    revenue: { current: 0, previous: 0, trend: 0 },
    followers: { current: 0, previous: 0, trend: 0 },
    engagement: { current: 0, previous: 0, trend: 0 },
    avgSessionTime: { current: 0, previous: 0, trend: 0 }
  });
  
  const [topFans, setTopFans] = useState([]);
  const [revenueChartData, setRevenueChartData] = useState([]);
  const [engagementData, setEngagementData] = useState([]);
  
  // AI Tips state
  const [currentTip, setCurrentTip] = useState(null);
  const [tipHistory, setTipHistory] = useState([]);
  // Removed tipCategory - always show all tips rotating
  const [quickStats, setQuickStats] = useState({
    todayEarnings: 0,
    monthlyEarnings: 0,
    pendingRequests: 0,
    activeStreams: 0,
    messagesUnread: 0,
    vipCount: 0,
    recentTips: 0
  });
  
  const [showMassMessageModal, setShowMassMessageModal] = useState(false);
  const [showDigitalsUploadModal, setShowDigitalsUploadModal] = useState(false);
  const [digitals, setDigitals] = useState([]);
  const [offers, setOffers] = useState([]);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showCallRequestsModal, setShowCallRequestsModal] = useState(false);
  // const [showCallInviteModal, setShowCallInviteModal] = useState(false); // Moved to CallsPage
  // const [showCallManagement, setShowCallManagement] = useState(false); // Moved to CallsPage
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showTicketedShowModal, setShowTicketedShowModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [shopProducts, setShopProducts] = useState([]);
  const [shopStats, setShopStats] = useState({});
  const [subscriptionTiers, setSubscriptionTiers] = useState([]);
  const [isLive, setIsLive] = useState(false);
  // Use external content data if provided, otherwise use local state
  const [contentData, setContentData] = useState(externalContentData || {
    photos: [],
    videos: [],
    audios: [],
    streams: [],
    digitals: []
  });
  
  // Sync with external content data when it changes
  useEffect(() => {
    if (externalContentData) {
      setContentData(externalContentData);
    }
  }, [externalContentData]);
  
  // Update content data handler that syncs with external
  const updateContentData = useCallback((newData) => {
    setContentData(newData);
    if (onExternalContentUpdate) {
      onExternalContentUpdate(newData);
    }
  }, [onExternalContentUpdate]);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  
  const fileInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  // Fetch analytics and profile data
  // AI Tip Generation Logic
  const generateAITip = useCallback(() => {
    const tips = {
      monetization: [
        {
          type: 'fan_engagement',
          icon: HeartIcon,
          color: 'rose',
          title: 'Engage Your Top Fan!',
          message: topFans[0] ? `${topFans[0].name} has spent ${topFans[0].totalSpent} tokens this month. Send them a personalized thank you message!` : 'Build stronger connections with your top supporters',
          action: 'Message',
          actionTarget: topFans[0]?.id
        },
        {
          type: 'diamond_fan',
          icon: TrophyIcon,
          color: 'purple',
          title: 'Diamond Fan Alert!',
          message: topFans[0] ? `${topFans[0].name} is a Diamond tier fan! They're 3x more likely to purchase exclusive content.` : 'Identify and reward your most loyal fans',
          action: 'View Profile',
          actionTarget: topFans[0]?.id
        },
        {
          type: 'revenue_opportunity',
          icon: CurrencyDollarIcon,
          color: 'green',
          title: 'Revenue Opportunity',
          message: 'Fans who receive personalized messages spend 40% more on average. Message your top 5 fans today!',
          action: 'Start Messaging',
          actionTarget: 'messages'
        },
        {
          type: 'content_pricing',
          icon: TagIcon,
          color: 'indigo',
          title: 'Optimize Your Pricing',
          message: 'Your content is priced 20% below similar creators. Consider increasing prices by 10-15 tokens.',
          action: 'Adjust Prices',
          actionTarget: 'content'
        }
      ],
      engagement: [
        {
          type: 'peak_hours',
          icon: ClockIcon,
          color: 'blue',
          title: 'Peak Engagement Hours',
          message: 'Your fans are most active between 8-10 PM. Schedule your next live stream during this time!',
          action: 'Schedule Stream',
          actionTarget: 'schedule'
        },
        {
          type: 'fan_milestone',
          icon: StarIcon,
          color: 'yellow',
          title: 'Fan Milestone',
          message: topFans[1] ? `${topFans[1].name} just hit 30 days as your fan! Celebrate with a special shoutout.` : 'Celebrate fan milestones to boost retention',
          action: 'Send Thanks',
          actionTarget: topFans[1]?.id
        },
        {
          type: 'engagement_boost',
          icon: FireIcon,
          color: 'orange',
          title: 'Boost Engagement',
          message: 'Running a Q&A session can increase engagement by 60%. Schedule one this week!',
          action: 'Create Event',
          actionTarget: 'schedule'
        }
      ],
      growth: [
        {
          type: 'content_consistency',
          icon: CalendarIcon,
          color: 'teal',
          title: 'Consistency Matters',
          message: 'Creators who post 3x per week grow 2x faster. You posted 1 time this week.',
          action: 'Plan Content',
          actionTarget: 'content'
        },
        {
          type: 'collaboration',
          icon: UserGroupIcon,
          color: 'pink',
          title: 'Collaboration Opportunity',
          message: 'Partner with other creators to reach new audiences. Start with creators in your niche.',
          action: 'Find Partners',
          actionTarget: 'explore'
        },
        {
          type: 'cross_promotion',
          icon: UserPlusIcon,
          color: 'indigo',
          title: 'Cross-Promotion Alert',
          message: 'Creators who collaborate see 45% follower growth. Find someone with similar audience size.',
          action: 'Browse Creators',
          actionTarget: 'explore-collab'
        },
        {
          type: 'trending_content',
          icon: FireIcon,
          color: 'orange',
          title: 'Trending Now',
          message: 'Live Q&A sessions are trending! Creators doing Q&As see 60% more engagement.',
          action: 'Schedule Q&A',
          actionTarget: 'schedule'
        }
      ]
    };

    // Always use all tips combined for rotation
    const availableTips = [...tips.monetization, ...tips.engagement, ...tips.growth];

    // Filter out tips that were recently shown
    const recentTipIds = tipHistory.slice(-3).map(t => t.message);
    const freshTips = availableTips.filter(tip => !recentTipIds.includes(tip.message));
    
    // Select a random tip from fresh tips or all if none are fresh
    const tipsPool = freshTips.length > 0 ? freshTips : availableTips;
    const selectedTip = tipsPool[Math.floor(Math.random() * tipsPool.length)];
    
    setCurrentTip(selectedTip);
    setTipHistory(prev => [...prev, selectedTip].slice(-10)); // Keep last 10 tips
  }, [topFans]);

  // Generate initial tip and refresh periodically
  useEffect(() => {
    if (topFans.length > 0 || currentTip === null) {
      generateAITip();
    }
    
    // Refresh tip every 30 seconds
    const interval = setInterval(generateAITip, 30000);
    return () => clearInterval(interval);
  }, [topFans, generateAITip]);

  // Update profile data when user prop changes (syncs with Zustand store updates)
  useEffect(() => {
    if (user) {
      setProfileData(prev => ({
        ...prev,
        banner: user.banner_url || prev.banner,
        avatar: user.avatar_url || prev.avatar,
        name: user.name || user.display_name || prev.name,
        username: user.username || prev.username,
        bio: user.bio || prev.bio,
        badges: user.badges || prev.badges
      }));
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const fetchAllData = async () => {
      if (!isMounted) return;

      // Only fetch if user is available
      if (user?.username || user?.id) {
        const fetchTasks = [fetchDashboardData()];

        // Only fetch if endpoints are enabled
        if (isFeatureEnabled('ANALYTICS_ENABLED')) {
          fetchTasks.push(fetchAnalytics());
        }
        if (isFeatureEnabled('TOP_FANS_ENABLED')) {
          fetchTasks.push(fetchTopFans());
        }
        if (isFeatureEnabled('DIGITALS_ENABLED')) {
          fetchTasks.push(fetchDigitals());
        }
        if (isFeatureEnabled('OFFERS_ENABLED')) {
          fetchTasks.push(fetchOffers());
        }

        await Promise.all(fetchTasks).catch(error => {
          console.error('Error fetching dashboard data:', error);
        });
      }
    };

    fetchAllData();

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.username]); // Only depend on stable user identifiers

  const fetchDashboardData = async () => {
    if (!user?.username && !user?.id) {
      console.log('User not loaded yet, skipping dashboard fetch');
      return;
    }
    
    try {
      const authToken = await getAuthToken();
      
      // Fetch creator profile
      const profileResponse = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/public/creators/${user?.username || user?.id}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      
      if (profileResponse.ok) {
        const data = await profileResponse.json();
        setProfileData(prev => ({
          ...prev,
          ...data.creator,
          views: data.stats?.views || 0,
          followers: data.stats?.followers || 0,
          subscribers: data.stats?.subscribers || 0
        }));
      }
      
      // Defer shop products and stats fetch to prevent blocking initial load
      setTimeout(async () => {
        try {
          // Fetch shop items
          const itemsResponse = await fetchWithRetry(
            `${import.meta.env.VITE_BACKEND_URL}/shop/items/manage?includeInactive=true`,
            {
              headers: { Authorization: `Bearer ${authToken}` }
            }
          );

          if (itemsResponse.status === 404) {
            console.log('ℹ️ Shop items endpoint not available yet');
            setShopProducts([]);
          } else if (itemsResponse.ok) {
            const itemsData = await itemsResponse.json();
            const products = (itemsData.items || []).map(item => ({
              ...item,
              title: item.name,
              currency: 'tokens',
              thumbnail: item.image_url || '/api/placeholder/300/400',
              sales: item.sales_count || 0,
              rating: 4.8,
              reviews: 0,
              available: item.is_active
            }));
            setShopProducts(products);
          }

          // Fetch shop analytics
          const analyticsResponse = await fetchWithRetry(
            `${import.meta.env.VITE_BACKEND_URL}/shop/analytics`,
            {
              headers: { Authorization: `Bearer ${authToken}` }
            }
          );

          if (analyticsResponse.status === 404) {
            console.log('ℹ️ Shop analytics endpoint not available yet');
          } else if (analyticsResponse.ok) {
            const analyticsData = await analyticsResponse.json();
            setShopStats(analyticsData.analytics || {});
          }
        } catch (error) {
          console.error('Failed to fetch shop data:', error);
        }
      }, 100); // Small delay to let critical content load first
      
      // Fetch subscription tiers
      try {
        const tiersResponse = await fetchWithRetry(
          `${import.meta.env.VITE_BACKEND_URL}/subscription-tiers/creator/${user?.id}`,
          {
            headers: { Authorization: `Bearer ${authToken}` }
          }
        );

        if (tiersResponse.status === 404) {
          console.log('ℹ️ Subscription tiers endpoint not available yet');
          setSubscriptionTiers([]);
        } else if (tiersResponse.ok) {
          const tiersData = await tiersResponse.json();
          setSubscriptionTiers(tiersData.tiers || []);
        }
      } catch (tiersError) {
        console.error('Error fetching subscription tiers:', tiersError);
      }
      
      // Fetch content (photos, videos, audios)
      const creatorId = user?.supabase_id || user?.id;
      if (creatorId) {
        try {
          const contentResponse = await fetchWithRetry(
            `${import.meta.env.VITE_BACKEND_URL}/content/creator/${creatorId}`,
            {
              headers: { Authorization: `Bearer ${authToken}` }
            }
          );

          if (contentResponse.status === 404) {
            console.log('ℹ️ Content endpoint not available yet');
            setContentData({ photos: [], videos: [] });
          } else if (contentResponse.ok) {
            const contentResult = await contentResponse.json();
            setContentData({
              photos: contentResult.pictures || [],
              videos: contentResult.videos || []
            });
          }
        } catch (contentError) {
          console.error('Error fetching content:', contentError);
        }
      }

      // Fetch upcoming sessions (only if enabled)
      if (isFeatureEnabled('UPCOMING_SESSIONS_ENABLED')) {
        try {
          const sessionsResponse = await fetchWithRetry(
            `${import.meta.env.VITE_BACKEND_URL}/sessions/upcoming`,
            {
              headers: { Authorization: `Bearer ${authToken}` }
            }
          );

          if (sessionsResponse.status === 404) {
            console.log('ℹ️ Upcoming sessions endpoint not available yet');
            setUpcomingSessions([]);
          } else if (sessionsResponse.ok) {
            const sessionsData = await sessionsResponse.json();
            setUpcomingSessions(sessionsData.sessions || []);
          }
        } catch (sessionsError) {
          console.error('Error fetching upcoming sessions:', sessionsError);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const fetchDigitals = async () => {
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/digitals/my`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      if (response.status === 404) {
        console.log('ℹ️ Digitals endpoint not available yet');
        setDigitals([]);
        setContentData(prev => ({ ...prev, digitals: [] }));
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setDigitals(data.digitals || []);
        setContentData(prev => ({
          ...prev,
          digitals: data.digitals || []
        }));
      }
    } catch (error) {
      console.error('Error fetching digitals:', error);
    }
  };

  const fetchOffers = async () => {
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/offers/my-offers`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      if (response.status === 404) {
        console.log('ℹ️ Offers endpoint not available yet');
        setOffers([]);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setOffers(data.offers || []);
      }
    } catch (error) {
      // Silently handle other errors
      if (error.message?.includes('404') || error.message?.includes('NOT_FOUND')) {
        setOffers([]);
        return;
      }
      console.error('Error fetching offers:', error);
    }
  };

  const handleAddOffer = async (offerData) => {
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/offers`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify(offerData)
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setOffers(prev => [data.offer, ...prev]);
        return data.offer;
      }
      throw new Error('Failed to create offer');
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
    }
  };

  const handleUpdateOffer = async (offerId, offerData) => {
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/offers/${offerId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify(offerData)
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setOffers(prev => prev.map(o => o.id === offerId ? data.offer : o));
        return data.offer;
      }
      throw new Error('Failed to update offer');
    } catch (error) {
      console.error('Error updating offer:', error);
      throw error;
    }
  };

  const handleDeleteOffer = async (offerId) => {
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/offers/${offerId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      
      if (response.ok) {
        setOffers(prev => prev.filter(o => o.id !== offerId));
        toast.success('Offer deleted successfully');
      } else {
        throw new Error('Failed to delete offer');
      }
    } catch (error) {
      console.error('Error deleting offer:', error);
      toast.error('Failed to delete offer');
    }
  };

  const handleDigitalUploadSuccess = (newDigital) => {
    setDigitals(prev => [newDigital, ...prev]);
    setContentData(prev => ({
      ...prev,
      digitals: [newDigital, ...prev.digitals]
    }));
    toast.success('Digital uploaded successfully!');
  };

  const fetchAnalytics = async () => {
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/analytics/creator/${user?.id}/overview?period=7d`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      if (response.status === 404) {
        console.log('ℹ️ Analytics endpoint not available yet');
        return;
      }

      if (response.ok) {
        const data = await response.json();

        // Set analytics data
        setAnalytics({
          revenue: {
            current: data.revenue?.total || 0,
            previous: data.revenue?.previous || 0,
            trend: data.revenue?.trend || 0
          },
          followers: {
            current: data.followers?.total || 0,
            previous: data.followers?.previous || 0,
            trend: data.followers?.trend || 0
          },
          engagement: {
            current: data.engagement?.rate || 0,
            previous: data.engagement?.previous || 0,
            trend: data.engagement?.trend || 0
          },
          avgSessionTime: {
            current: data.sessions?.avgDuration || 0,
            previous: data.sessions?.previousAvg || 0,
            trend: data.sessions?.trend || 0
          }
        });

        // Set chart data
        setRevenueChartData(data.revenueHistory || []);
        setEngagementData([
          { name: 'Video Calls', value: data.engagement?.videoCalls || 0, color: '#8b5cf6' },
          { name: 'Messages', value: data.engagement?.messages || 0, color: '#f59e0b' },
          { name: 'Tips', value: data.engagement?.tips || 0, color: '#10b981' },
          { name: 'Gifts', value: data.engagement?.gifts || 0, color: '#ec4899' }
        ]);

        // Set quick stats
        setQuickStats({
          todayEarnings: data.today?.earnings || 0,
          monthlyEarnings: data.monthly?.earnings || 0,
          pendingRequests: data.pending?.requests || 0,
          activeStreams: data.active?.streams || 0,
          messagesUnread: data.unread?.messages || 0,
          vipCount: data.vips?.count || 0,
          recentTips: data.today?.tips || 0
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchTopFans = async () => {
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/analytics/creator/${user?.id}/top-fans`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      if (response.status === 404) {
        console.log('ℹ️ Top fans endpoint not available yet');
        setTopFans([]);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setTopFans(data.fans || []);
      }
    } catch (error) {
      console.error('Error fetching top fans:', error);
    }
  };


  // Function to update specific profile fields (used by EnhancedCreatorCard)
  const updateProfile = async (updates) => {
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/users/profile`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify(updates)
        }
      );
      
      if (response.ok) {
        setProfileData(prev => ({ 
          ...prev, 
          ...updates 
        }));
        toast.success('Profile updated successfully!');
      } else {
        toast.error('Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('Failed to update profile');
    }
  };

  const handleCroppedImage = async (croppedImageUrl) => {
    try {
      // Convert the cropped image URL to a blob
      const response = await fetch(croppedImageUrl);
      const blob = await response.blob();
      
      // Create a FormData object with the cropped image
      const formData = new FormData();
      formData.append('image', blob, 'profile.jpg');
      
      const authToken = await getAuthToken();
      const uploadResponse = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/storage/profile-picture`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`
          },
          body: formData
        }
      );
      
      if (uploadResponse.ok) {
        const data = await uploadResponse.json();
        setProfileData(prev => ({
          ...prev,
          avatar: data.urls?.original || data.urls?.large || data.url
        }));
        toast.success('Profile picture uploaded to Supabase!');
      } else {
        const error = await uploadResponse.json();
        toast.error(error.error || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading cropped image:', error);
      toast.error('Failed to upload image');
    }
  };

  const handleImageUpload = async (event, type) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // If it's a profile picture, show the cropper first
    if (type === 'avatar') {
      const reader = new FileReader();
      reader.onload = () => {
        setTempImageSrc(reader.result);
        setShowImageCropper(true);
      };
      reader.readAsDataURL(file);
      return;
    }
    
    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', type);
    
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/users/upload-image`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`
          },
          body: formData
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setProfileData(prev => ({ 
          ...prev, 
          [type === 'avatar' ? 'avatar' : 'banner']: data.url 
        }));
        toast.success(`${type} updated successfully!`);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    }
  };

  const handleStartStream = () => {
    if (onShowGoLive) {
      onShowGoLive();
    } else {
      onNavigate('/streaming');
    }
  };

  const handleAnnounceShow = () => {
    setShowTicketedShowModal(true);
  };
  
  // Debounced navigation helper to prevent double-clicks
  const handleNavigateToPage = useCallback((path) => {
    if (isNavigatingRef.current) {
      console.warn('[Nav] Navigation already in progress, ignoring:', path);
      return;
    }

    isNavigatingRef.current = true;

    // Normalize path to always have leading slash
    const normalizedPath = path?.startsWith('/') ? path : `/${path}`;

    console.log(`[Nav] Navigating to: ${normalizedPath} { hasOnNavigate: ${!!onNavigate} }`);

    try {
      if (onNavigate) {
        console.log('[Nav] Using onNavigate callback');
        onNavigate(normalizedPath);
      } else {
        console.log('[Nav] Using react-router navigate');
        onNavigate(normalizedPath);
      }
    } catch (error) {
      console.error('[Nav] Navigation error:', error);
    }

    // Reset after 300ms (reduced from 800ms)
    setTimeout(() => {
      console.log('[Nav] Resetting navigation lock');
      isNavigatingRef.current = false;
    }, 300);
  }, [onNavigate, navigate]);

  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(d);
  };

  const createTicketedShow = async (showData) => {
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/ticketed-shows`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify(showData)
        }
      );
      
      if (response.ok) {
        toast.success('Ticketed show announced successfully!');
        setShowTicketedShowModal(false);
        // Optionally refresh data
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Error creating ticketed show:', error);
      toast.error('Failed to create ticketed show');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Section: 3-Column Grid - Calls, Schedule, Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 content-below-nav" data-test="creator-dashboard-top-grid">

        {/* Enhanced Calls Box */}
        <LiquidGlass className="p-6 shadow-xl rounded-xl" intensity="light">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    console.log('[CALLS] Icon clicked - navigating to call requests');
                    onNavigate('/call-requests');
                  }}
                  className="p-3 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                  aria-label="Manage call requests"
                >
                  <ClockIcon className="w-6 h-6 text-white" />
                </button>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Calls</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Upcoming</p>
                </div>
              </div>
            </div>

            {(() => {
              // Filter for only video or voice calls
              const nextCall = upcomingSessions.find(session =>
                session.type === 'video' || session.type === 'voice'
              );

              if (nextCall) {
                return (
                  <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl">
                      <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        {formatTime(nextCall.time || nextCall.scheduled_time)}
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          nextCall.type === 'video'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {nextCall.type === 'video' ? (
                            <VideoCameraIcon className="w-3 h-3" />
                          ) : (
                            <PhoneIcon className="w-3 h-3" />
                          )}
                          {nextCall.type === 'video' ? 'Video Call' : 'Voice Call'}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {nextCall.duration || nextCall.duration_minutes || 30} min
                        </span>
                      </div>
                    </div>

                    {/* Enhanced Fan/User Info */}
                    <div className="relative overflow-hidden p-4 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-yellow-300/20 to-orange-300/20 rounded-full blur-xl"></div>
                      <div className="relative flex items-center gap-3">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                            {(nextCall.fan_username || nextCall.fan_name || nextCall.username || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-gray-900 dark:text-gray-100">
                            @{nextCall.fan_username || nextCall.username || 'Unknown'}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {nextCall.fan_name || nextCall.name || 'Fan'}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                              <SparklesIcon className="w-3 h-3 text-yellow-600" />
                              <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                                {nextCall.tokens || 0} tokens
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons - Always show all 3 */}
                    <div className="flex gap-2">
                      {/* Start Now Button - Shows when within 5 minutes of call time */}
                      <Button
                        size="sm"
                        className={`flex-1 ${
                          (() => {
                            const sessionTime = new Date(`${nextCall.date || nextCall.scheduled_date} ${nextCall.time || nextCall.scheduled_time}`);
                            const now = new Date();
                            const minutesUntil = Math.floor((sessionTime - now) / 60000);
                            return minutesUntil <= 5 && minutesUntil >= 0;
                          })()
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                        onClick={() => {
                          const sessionTime = new Date(`${nextCall.date || nextCall.scheduled_date} ${nextCall.time || nextCall.scheduled_time}`);
                          const now = new Date();
                          const minutesUntil = Math.floor((sessionTime - now) / 60000);

                          if (minutesUntil <= 5 && minutesUntil >= 0) {
                            // Start the call with the fan
                            if (nextCall.type === 'video') {
                              onNavigate(`/video-call/${nextCall.id || nextCall.session_id}?fan=${nextCall.fan_username || nextCall.username}`);
                            } else {
                              onNavigate(`/voice-call/${nextCall.id || nextCall.session_id}?fan=${nextCall.fan_username || nextCall.username}`);
                            }
                            toast.success('Starting call with ' + (nextCall.fan_username || nextCall.username));
                          } else if (minutesUntil > 5) {
                            toast.info(`Call starts in ${minutesUntil} minutes`);
                          }
                        }}
                        disabled={(() => {
                          const sessionTime = new Date(`${nextCall.date || nextCall.scheduled_date} ${nextCall.time || nextCall.scheduled_time}`);
                          const now = new Date();
                          const minutesUntil = Math.floor((sessionTime - now) / 60000);
                          return minutesUntil > 5 || minutesUntil < 0;
                        })()}
                      >
                        <PlayIcon className="w-4 h-4 mr-1" />
                        Start Now
                      </Button>

                      {/* Message Button */}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1"
                        onClick={() => {
                          // Open messages with the specific fan
                          const username = nextCall.fan_username || nextCall.username;
                          onNavigate(`/messages?user=${username}`);
                          toast.success(`Opening messages with @${username}`);
                        }}
                      >
                        <ChatBubbleLeftRightIcon className="w-4 h-4 mr-1" />
                        Message
                      </Button>

                      {/* Reschedule Button */}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1"
                        onClick={() => {
                          // TODO: Implement reschedule modal
                          toast.info('Opening reschedule options...');
                          // You can add a modal here for rescheduling
                        }}
                      >
                        <CalendarIcon className="w-4 h-4 mr-1" />
                        Reschedule
                      </Button>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="flex-1 flex flex-col items-center justify-center py-4">
                    <PhoneIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-gray-400 dark:text-gray-500">No calls scheduled</p>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                      Video and voice calls will appear here
                    </p>
                  </div>
                );
              }
            })()}
          </div>
        </LiquidGlass>

        {/* Schedule Box - Next 2 Events */}
        <LiquidGlass className="p-6 shadow-xl rounded-xl" intensity="light">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    console.log('[SCHEDULE] Icon clicked - navigating to schedule');
                    onNavigate('/schedule');
                  }}
                  className="p-3 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-2xl shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                  aria-label="Manage schedule"
                >
                  <CalendarIcon className="w-6 h-6 text-white" />
                </button>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Schedule</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Upcoming Events</p>
                </div>
              </div>
            </div>

            {upcomingSessions.length > 0 ? (
              <div className="space-y-3">
                {/* Show next 2 events */}
                {upcomingSessions.slice(0, 2).map((session, index) => {
                  const eventDate = session.date || session.scheduled_date;
                  const eventTime = session.time || session.scheduled_time;

                  return (
                  <div
                    key={session.id || index}
                    className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {session.type === 'video' ? (
                            <VideoCameraIcon className="w-4 h-4 text-purple-600" />
                          ) : session.type === 'voice' ? (
                            <PhoneIcon className="w-4 h-4 text-green-600" />
                          ) : session.type === 'stream' ? (
                            <PlayIcon className="w-4 h-4 text-pink-600" />
                          ) : session.type === 'class' ? (
                            <UserGroupIcon className="w-4 h-4 text-amber-600" />
                          ) : (
                            <CalendarIcon className="w-4 h-4 text-gray-600" />
                          )}
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {session.type === 'video' ? 'Video Call' :
                             session.type === 'voice' ? 'Voice Call' :
                             session.type === 'stream' ? 'Live Stream' :
                             session.type === 'class' ? (session.status === 'hosting' ? 'Class (Hosting)' : 'Class') :
                             session.type || 'Event'}
                          </span>
                        </div>

                        {/* Time and Date */}
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {formatTime(eventTime)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(eventDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>

                        {/* Participant info for regular sessions */}
                        {(session.fan_username || session.username) && session.type !== 'class' && (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold">
                              {(session.fan_username || session.username || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              @{session.fan_username || session.username}
                            </span>
                          </div>
                        )}

                        {/* Enrollment count for hosting classes */}
                        {session.type === 'class' && session.status === 'hosting' && (
                          <div className="mt-2">
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              {session.enrolled_count || 0}/{session.max_participants || '∞'} enrolled
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Duration badge */}
                      <span className="text-xs px-2 py-1 bg-white dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400">
                        {session.duration || session.duration_minutes || 30}m
                      </span>
                    </div>
                  </div>
                );
                })}

                {/* If only 1 event, show placeholder for second */}
                {upcomingSessions.length === 1 && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
                    <p className="text-xs text-gray-400">No more events scheduled</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-4">
                <CalendarIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-gray-400 dark:text-gray-500">No events scheduled</p>
              </div>
            )}
          </div>
        </LiquidGlass>

        {/* Recent Activity Section */}
        <LiquidGlass className="p-6 shadow-xl rounded-xl" intensity="light">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                console.log('[ACTIVITY] Icon clicked - showing notifications modal');
                setShowNotificationsModal(true);
              }}
              className="p-3 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
              aria-label="View all activity"
            >
              <ClockIcon className="w-6 h-6 text-white" />
            </button>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Activity</p>
              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Last 24 hours</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* Recent Tips */}
          {quickStats.recentTips > 0 && (
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-pink-50 to-red-50 dark:from-pink-900/20 dark:to-red-900/20 rounded-lg">
              <div className="flex items-center gap-3">
                <HeartSolid className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {quickStats.recentTips} new tips received
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Total: {quickStats.todayEarnings} tokens today
                  </p>
                </div>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
            </div>
          )}

          {/* New Messages */}
          {quickStats.messagesUnread > 0 && (
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg cursor-pointer hover:bg-opacity-80 transition-colors"
                 onClick={() => onNavigate('/messages')}>
              <div className="flex items-center gap-3">
                <ChatBubbleLeftRightIcon className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {quickStats.messagesUnread} unread messages
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Click to view messages
                  </p>
                </div>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
            </div>
          )}

          {/* Top Fan Activity */}
          {topFans.length > 0 && topFans[0] && (
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                    {(topFans[0].name || topFans[0].username || 'U')[0].toUpperCase()}
                  </div>
                  <TrophyIcon className="absolute -bottom-1 -right-1 w-4 h-4 text-yellow-500 bg-white rounded-full p-0.5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Top fan: @{topFans[0].username || topFans[0].name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Spent {topFans[0].totalSpent || 0} tokens this month
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  onNavigate(`/messages?user=${topFans[0].username || topFans[0].id}`);
                  toast.success('Opening chat with your top fan!');
                }}
                className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
              >
                Message
              </button>
            </div>
          )}

          {/* New Followers */}
          {analytics.followers.trend > 0 && (
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
              <div className="flex items-center gap-3">
                <UserPlusIcon className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    +{Math.abs(analytics.followers.trend)} new followers
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Total: {analytics.followers.current} followers
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <ArrowTrendingUpIcon className="w-4 h-4" />
                <span className="text-xs font-medium">
                  +{Math.abs(analytics.followers.trend)}%
                </span>
              </div>
            </div>
          )}

          {/* Pending Requests */}
          {quickStats.pendingRequests > 0 && (
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-lg cursor-pointer hover:bg-opacity-80 transition-colors"
                 onClick={() => setShowCallRequestsModal(true)}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <InboxIcon className="w-5 h-5 text-yellow-500" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {quickStats.pendingRequests} pending requests
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Click to review requests
                  </p>
                </div>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
            </div>
          )}

          {/* If no activity */}
          {quickStats.recentTips === 0 &&
           quickStats.messagesUnread === 0 &&
           topFans.length === 0 &&
           analytics.followers.trend <= 0 &&
           quickStats.pendingRequests === 0 && (
            <div className="text-center py-6 text-gray-400">
              <ClockIcon className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
              <p className="text-sm">No recent activity</p>
              <p className="text-xs mt-1">Check back later for updates</p>
            </div>
          )}
        </div>
        </LiquidGlass>
      </div>

      {/* Enhanced Content Gallery */}
      <EnhancedContentGallery
            photos={contentData.photos}
            videos={contentData.videos}
            audios={contentData.audios}
            streams={contentData.streams}
            shopProducts={shopProducts}
            digitals={contentData.digitals || digitals}
            offers={offers}
            userPurchases={[]} // You can populate this with actual purchased content IDs
            user={{ ...user, is_creator: true }}
            onAddProduct={() => {
              setShowAddProductModal(true);
            }}
            onUpdateProfile={async (profileData) => {
              try {
                const response = await api.put('/users/profile', profileData);
                if (response.data.success) {
                  toast.success('Profile updated successfully!');
                  // Update local user data if needed
                }
              } catch (error) {
                console.error('Error updating profile:', error);
                toast.error('Failed to update profile');
              }
            }}
            onAddDigital={() => setShowDigitalsUploadModal(true)}
            onPurchaseContent={(item) => {
          // Handle PPV purchase
          const price = item.ppv_price || (item.is_premium ? 100 : 0);
          if (price > 0) {
            toast(
              <div>
                <p className="font-semibold">Unlock Premium Content</p>
                <p className="text-sm">This {item.type} costs {price} tokens</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      // Implement actual purchase logic here
                      toast.success(`Purchased ${item.title || 'content'} for ${price} tokens!`);
                      toast.dismiss();
                    }}
                    className="px-3 py-1 bg-purple-500 text-white rounded-lg text-sm"
                  >
                    Purchase
                  </button>
                  <button
                    onClick={() => toast.dismiss()}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>,
              { duration: 10000 }
            );
          }
        }}
        onAddContent={async (type, newContent) => {
          // The EnhancedContentGallery now handles uploads internally
          // Just refresh the content data if needed
          fetchDashboardData();
        }}
        onEditContent={(item) => {
          console.log('Edit item:', item);
          toast.info(`Edit ${item.type}: ${item.title || item.name || 'Untitled'}`);
        }}
        onDeleteContent={async (item) => {
          if (item.type === 'photo') {
            updateContentData({
              ...contentData,
              photos: contentData.photos.filter(p => p.id !== item.id)
            });
            toast.success('Photo deleted');
          } else if (item.type === 'video') {
            updateContentData({
              ...contentData,
              videos: contentData.videos.filter(v => v.id !== item.id)
            });
            toast.success('Video deleted');
          } else if (item.type === 'audio') {
            updateContentData({
              ...contentData,
              audios: contentData.audios.filter(a => a.id !== item.id)
            });
            toast.success('Audio deleted');
          } else if (item.type === 'stream') {
            updateContentData({
              ...contentData,
              streams: contentData.streams.filter(s => s.id !== item.id)
            });
            toast.success('Stream deleted');
          } else if (item.type === 'product') {
            setShopProducts(prev => prev.filter(p => p.id !== item.id));
            toast.success('Product removed from shop');
          }
        }}
        onViewDetails={(item) => {
          if (item.type === 'product') {
            onNavigate(`/shop/product/${item.id}`);
          } else if (item.type === 'video') {
            // Open in a modal or viewer instead of navigating
            console.log('View video:', item);
          } else if (item.type === 'audio') {
            console.log('Play audio:', item);
          } else if (item.type === 'stream') {
            console.log('View stream:', item);
          } else {
            console.log('View photo:', item);
          }
        }}
        onAddOffer={handleAddOffer}
        onUpdateOffer={handleUpdateOffer}
        onDeleteOffer={handleDeleteOffer}
      />

      {/* Quick Insights Bar */}
      {(quickStats.pendingRequests > 0 || quickStats.recentTips > 0 || quickStats.messagesUnread > 0) && (
        <div className="flex flex-wrap gap-3 px-4 py-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          {quickStats.pendingRequests > 0 && (
            <button
              onClick={() => onNavigate('/requests')}
              className="flex items-center space-x-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-full text-sm hover:shadow-md transition-shadow"
            >
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              <span>{quickStats.pendingRequests} pending requests</span>
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          )}
          {quickStats.messagesUnread > 0 && (
            <button
              onClick={() => onNavigate('/messages')}
              className="flex items-center space-x-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-full text-sm hover:shadow-md transition-shadow"
            >
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span>{quickStats.messagesUnread} unread messages</span>
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          )}
          {quickStats.recentTips > 0 && (
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-full text-sm">
              <HeartSolid className="w-4 h-4 text-red-500" />
              <span>{quickStats.recentTips} tips today</span>
            </div>
          )}
        </div>
      )}


        {/* Old Photos Section - Hidden
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Photos</h3>
            <Button
              size="sm"
              onClick={() => {
                if (onNavigate) {
                  onNavigate('/content-studio');
                } else {
                  onNavigate('/content-studio');
                }
              }}
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Content
            </Button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {contentData.photos.length === 0 ? (
              <div className="col-span-full text-center py-8 text-gray-500">
                <PhotoIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No photos yet</p>
              </div>
            ) : (
              contentData.photos.slice(0, 12).map((photo) => (
                <div key={photo.id} className="relative group aspect-square">
                  <img
                    src={photo.thumbnail_url || photo.url}
                    alt={photo.title || 'Photo'}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center space-x-2">
                    <button className="p-1.5 bg-white/90 rounded hover:bg-white">
                      <PencilSquareIcon className="w-4 h-4 text-gray-700" />
                    </button>
                    <button className="p-1.5 bg-red-500/90 rounded hover:bg-red-500">
                      <TrashIcon className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  {photo.is_premium && (
                    <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
                      Premium
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          {contentData.photos.length > 12 && (
            <div className="mt-4 text-center">
              <Button size="sm" variant="ghost">View All Photos</Button>
            </div>
          )}
        </Card>
        */}


        {/* Old Videos Section - Hidden
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Videos</h3>
            <Button
              size="sm"
              onClick={() => {
                if (onShowContent) {
                  onShowContent();
                } else {
                  onNavigate('/creator/content?tab=videos');
                }
              }}
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Videos
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {contentData.videos.length === 0 ? (
              <div className="col-span-full text-center py-8 text-gray-500">
                <VideoCameraIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No videos yet</p>
              </div>
            ) : (
              contentData.videos.slice(0, 8).map((video) => (
                <div key={video.id} className="relative group">
                  <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={video.thumbnail_url || '/video-placeholder.jpg'}
                      alt={video.title || 'Video'}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 bg-black/70 rounded-full flex items-center justify-center">
                        <PlayIcon className="w-6 h-6 text-white ml-1" />
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center space-x-2">
                    <button className="p-2 bg-white/90 rounded hover:bg-white">
                      <PencilSquareIcon className="w-4 h-4 text-gray-700" />
                    </button>
                    <button className="p-2 bg-red-500/90 rounded hover:bg-red-500">
                      <TrashIcon className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  {video.is_premium && (
                    <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
                      Premium
                    </div>
                  )}
                  <p className="mt-2 text-sm font-medium truncate">{video.title || 'Untitled Video'}</p>
                  <p className="text-xs text-gray-500">{video.duration || '0:00'}</p>
                </div>
              ))
            )}
          </div>
          {contentData.videos.length > 8 && (
            <div className="mt-4 text-center">
              <Button size="sm" variant="ghost">View All Videos</Button>
            </div>
          )}
        </Card>
        */}

        {/* Old Shop Section - Hidden
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Shop</h3>
            <Button 
              size="sm" 
              onClick={() => setShowAddProductModal(true)}
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Product
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {shopProducts.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                <ShoppingBagIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No products yet</p>
              </div>
            ) : (
              shopProducts.slice(0, 8).map((product) => (
                <div key={product.id} className="relative group">
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={product.image_url || '/product-placeholder.jpg'}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center space-x-2">
                      <button 
                        onClick={() => setShowAddProductModal(true)}
                        className="p-2 bg-white/90 rounded hover:bg-white"
                      >
                        <PencilSquareIcon className="w-4 h-4 text-gray-700" />
                      </button>
                      <button className="p-2 bg-red-500/90 rounded hover:bg-red-500">
                        <TrashIcon className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm font-medium truncate">{product.name}</p>
                  <p className="text-sm text-gray-500">${product.price}</p>
                </div>
              ))
            )}
          </div>
          {shopProducts.length > 8 && (
            <div className="mt-4 text-center">
              <Button size="sm" variant="ghost" onClick={() => setShowAddProductModal(true)}>
                View All Products
              </Button>
            </div>
          )}
        </Card>
        */}

      {/* Modals */}
      <AnimatePresence>
        {showMassMessageModal && (
          <MassMessageModal
            isOpen={showMassMessageModal}
            onClose={() => setShowMassMessageModal(false)}
            creatorId={user?.id}
          />
        )}

        {showDigitalsUploadModal && (
          <DigitalsUploadModal
            isOpen={showDigitalsUploadModal}
            onClose={() => setShowDigitalsUploadModal(false)}
            onUploadSuccess={handleDigitalUploadSuccess}
          />
        )}
        
        {showAddProductModal && (
          <ItemModal
            item={null}
            onClose={() => setShowAddProductModal(false)}
            onSuccess={() => {
              setShowAddProductModal(false);
              fetchDashboardData(); // Refresh shop products
              toast.success('Product added successfully!');
            }}
          />
        )}
        
        {/* Call-related modals removed - now using unified CallsPage
        {showCallInviteModal && (
          <CallInviteModal
            isOpen={showCallInviteModal}
            onClose={() => setShowCallInviteModal(false)}
            creatorId={user?.id}
          />
        )}
        
        {showCallManagement && (
          <CallManagementModal
            isOpen={showCallManagement}
            onClose={() => setShowCallManagement(false)}
            creatorId={user?.id}
            pendingRequests={quickStats.pendingRequests}
          />
        )}
        */}
        
        {showScheduleModal && (
          <Modal
            isOpen={showScheduleModal}
            onClose={() => setShowScheduleModal(false)}
            title="Your Schedule"
            size="2xl"
          >
            <div className="max-h-[75vh] overflow-y-auto p-4">
              <EnhancedScheduleCalendar 
                userType="creator"
                userId={user?.id}
                allowEditing={true}
                showAvailability={true}
                onScheduleEvent={(event) => {
                  console.log('Schedule event:', event);
                  toast.success('Event scheduled successfully!');
                }}
              />
            </div>
          </Modal>
        )}
        
        {showTicketedShowModal && (
          <Modal
            isOpen={showTicketedShowModal}
            onClose={() => setShowTicketedShowModal(false)}
            title="Announce Private Show"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Show Title</label>
                <input
                  type="text"
                  placeholder="Exclusive VIP Show"
                  className="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  placeholder="Describe your show..."
                  className="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  rows="3"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Date & Time</label>
                  <input
                    type="datetime-local"
                    className="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Ticket Price (tokens)</label>
                  <input
                    type="number"
                    placeholder="100"
                    className="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowTicketedShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    toast.success('Private show announced!');
                    setShowTicketedShowModal(false);
                  }}
                >
                  Announce Show
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {showNotificationsModal && (
          <Modal
            isOpen={showNotificationsModal}
            onClose={() => setShowNotificationsModal(false)}
            title="All Notifications"
            size="lg"
          >
            <div className="max-h-[75vh] overflow-y-auto">
              <NotificationCenter />
            </div>
          </Modal>
        )}

      </AnimatePresence>
      
      {/* Pricing Rates Modal */}
      <PricingRatesModal
        isOpen={showPricingRatesModal}
        onClose={async () => {
          setShowPricingRatesModal(false);
          // Refresh user data to get updated rates
          if (user?.supabase_id) {
            try {
              const authToken = await getAuthToken();
              const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/profile`, {
                headers: {
                  'Authorization': `Bearer ${authToken}`
                }
              });
              if (response.ok) {
                const updatedUser = await response.json();
                // Update the local user state if there's a setter function
                if (onContentUpdate) {
                  onContentUpdate(updatedUser);
                }
              }
            } catch (error) {
              console.error('Error refreshing user data:', error);
            }
          }
        }}
        isCreator={true}
      />

      {/* Token Tipping Modal */}
      {showTokenTipping && tippingRecipient && (
        <TokenTipping
          recipient={tippingRecipient}
          userTokenBalance={tokenBalance}
          onClose={() => {
            setShowTokenTipping(false);
            setTippingRecipient(null);
          }}
          onSuccess={() => {
            setShowTokenTipping(false);
            setTippingRecipient(null);
            toast.success('Tip sent successfully!');
          }}
        />
      )}

      {/* Image Cropper Modal */}
      {showImageCropper && tempImageSrc && (
        <ImageCropModal
          isOpen={showImageCropper}
          cropType="card"
          file={tempImageSrc}
          onClose={() => {
            setShowImageCropper(false);
            setTempImageSrc(null);
          }}
          onSave={handleCroppedImage}
          aspectRatio="4:5"
          allowRatioChange={false}
        />
      )}

      {/* Call Requests Modal */}
      <CallRequestsModal
        isOpen={showCallRequestsModal}
        onClose={() => setShowCallRequestsModal(false)}
        user={user}
        onRequestAccepted={() => {
          // Refresh data if needed
          fetchUpcomingSessions();
        }}
      />
    </div>
  );
});

HybridCreatorDashboard.propTypes = {
  user: PropTypes.object,
  onNavigate: PropTypes.func,
  onShowGoLive: PropTypes.func,
  onShowAvailability: PropTypes.func,
  onShowEarnings: PropTypes.func,
  onShowContent: PropTypes.func,
  onShowSettings: PropTypes.func,
  tokenBalance: PropTypes.number,
  sessionStats: PropTypes.object
};

export default HybridCreatorDashboard;