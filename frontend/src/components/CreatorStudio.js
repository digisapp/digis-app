import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAuthToken } from '../utils/supabase-auth';
import InstantMessagingChat from './InstantMessagingChat';
import OffersManagement from './OffersManagement';
import ConfirmDialog from './common/ConfirmDialog';
import toast from 'react-hot-toast';
import {
  ChartBarIcon,
  UsersIcon,
  GiftIcon,
  SparklesIcon,
  VideoCameraIcon,
  CogIcon,
  XMarkIcon,
  ArrowTrendingUpIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CalendarIcon,
  BellIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  EllipsisHorizontalIcon,
  PlayIcon,
  PauseIcon,
  PhotoIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  BanknotesIcon,
  UserGroupIcon,
  EyeIcon,
  HeartIcon,
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  ArrowsRightLeftIcon,
  QuestionMarkCircleIcon,
  PencilIcon,
  CloudArrowUpIcon,
  PhoneIcon,
  LockClosedIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import {
  StarIcon as StarIconSolid,
  HeartIcon as HeartIconSolid,
  SparklesIcon as SparklesIconSolid
} from '@heroicons/react/24/solid';

const CreatorStudio = ({ user, onClose, onShowGoLive }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [analytics, setAnalytics] = useState(null);
  const [subscriptionTiers, setSubscriptionTiers] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('30d');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'subscriber', message: 'John Doe subscribed to Gold tier', time: '5m ago', read: false },
    { id: 2, type: 'tip', message: 'Sarah sent you 100 tokens', time: '1h ago', read: false },
    { id: 3, type: 'milestone', message: 'You reached 100 subscribers!', time: '2h ago', read: true }
  ]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState('picture');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning'
  });

  // Enhanced studio tabs with icons
  const studioTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: ChartBarIcon },
    { id: 'subscribers', label: 'Subscribers', icon: UsersIcon },
    { id: 'offers', label: 'Offers', icon: GiftIcon },
    { id: 'tiers', label: 'Subscription Tiers', icon: SparklesIcon },
    { id: 'analytics', label: 'Analytics', icon: ChartBarIcon },
    { id: 'content', label: 'Content', icon: VideoCameraIcon },
    { id: 'settings', label: 'Settings', icon: CogIcon }
  ];

  const loadStudioData = useCallback(async () => {
    setLoading(true);
    try {
      const authToken = await getAuthToken();
      
      if (!authToken) {
        console.error('No auth token available');
        return;
      }
      
      // Load all studio data in parallel
      const [analyticsRes, tiersRes, subscribersRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/analytics`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/subscriptions/creator-tiers`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/subscriptions/subscribers`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
      ]);

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data.analytics);
      }

      if (tiersRes.ok) {
        const data = await tiersRes.json();
        setSubscriptionTiers(data.tiers);
      }

      if (subscribersRes.ok) {
        const data = await subscribersRes.json();
        setSubscribers(data.subscribers);
      }

    } catch (error) {
      console.error('❌ Error loading studio data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudioData();
  }, [loadStudioData]);

  const handleContentUpload = async (file, title, description, price) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('price', price);
    formData.append('contentType', uploadType);

    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/content/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        // toast.success('Content uploaded successfully!');
        setShowUploadModal(false);
        // Refresh content list
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload content');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteContent = async (contentId, contentTitle) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Content',
      message: `Are you sure you want to delete "${contentTitle}"? This action cannot be undone.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          const authToken = await getAuthToken();
          const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/content/${contentId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });

          if (response.ok) {
            // toast.success('Content deleted successfully');
            // Refresh content list
            loadStudioData();
          } else {
            throw new Error('Delete failed');
          }
        } catch (error) {
          console.error('Delete error:', error);
          toast.error('Failed to delete content');
        }
      }
    });
  };

  const DashboardTab = () => (
    <div className="p-6 space-y-8">
      {/* Header with actions */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, {user?.display_name || user?.username}! 👋</h1>
          <p className="text-gray-600">Here's how your content is performing today</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-3 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-all duration-200 group"
          >
            <BellIcon className="w-5 h-5 text-gray-600 group-hover:text-gray-900" />
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </button>
          <button 
            onClick={onShowGoLive}
            className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl hover:from-pink-600 hover:to-rose-600 transition-all duration-200 shadow-lg shadow-pink-500/25 flex items-center gap-2">
            <VideoCameraIcon className="w-5 h-5" />
            Go Live
          </button>
        </div>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200"
        >
          <div className="flex items-center justify-between mb-4">
            <UserGroupIcon className="w-10 h-10 text-blue-600" />
            <span className="text-sm font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
              +12%
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {analytics?.totalSubscribers || 0}
          </div>
          <div className="text-sm text-gray-600">Total Subscribers</div>
          <div className="mt-4 pt-4 border-t border-blue-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">New this week</span>
              <span className="font-semibold text-blue-600">+23</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border border-green-200"
        >
          <div className="flex items-center justify-between mb-4">
            <BanknotesIcon className="w-10 h-10 text-green-600" />
            <span className="text-sm font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
              +18%
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            ${analytics?.totalEarnings?.toFixed(2) || '0.00'}
          </div>
          <div className="text-sm text-gray-600">Total Earnings</div>
          <div className="mt-4 pt-4 border-t border-green-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">This month</span>
              <span className="font-semibold text-green-600">+$427</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-2xl border border-amber-200"
        >
          <div className="flex items-center justify-between mb-4">
            <StarIconSolid className="w-10 h-10 text-amber-600" />
            <span className="text-sm font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
              Stable
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {analytics?.averageRating?.toFixed(1) || '4.8'}
          </div>
          <div className="text-sm text-gray-600">Average Rating</div>
          <div className="mt-4 pt-4 border-t border-amber-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Total reviews</span>
              <span className="font-semibold text-amber-600">{analytics?.totalRatings || 142}</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border border-purple-200"
        >
          <div className="flex items-center justify-between mb-4">
            <ClockIcon className="w-10 h-10 text-purple-600" />
            <span className="text-sm font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
              +25%
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {Math.floor((analytics?.totalMinutesStreamed || 0) / 60)}h
          </div>
          <div className="text-sm text-gray-600">Hours Streamed</div>
          <div className="mt-4 pt-4 border-t border-purple-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Active sessions</span>
              <span className="font-semibold text-purple-600">3</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recent activity */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '24px'
      }}>
        {/* Recent subscribers */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          style={{
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e1e5e9',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 'bold' }}>
            Recent Subscribers
          </h3>
          
          {subscribers.slice(0, 5).map((subscriber, index) => (
            <div
              key={subscriber.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: index < 4 ? '1px solid #f0f0f0' : 'none'
              }}
            >
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '12px',
                fontSize: '16px'
              }}>
                👤
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '500', fontSize: '14px' }}>
                  {subscriber.subscriber_name}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {subscriber.tier_config?.name} • {new Date(subscriber.created_at).toLocaleDateString()}
                </div>
              </div>
              
              <div style={{
                backgroundColor: subscriber.tier_config?.badge_color || '#007bff',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 'bold'
              }}>
                {subscriber.tier_config?.badge_emoji} {subscriber.tier}
              </div>
            </div>
          ))}
          
          {subscribers.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#666'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
              <div>No subscribers yet</div>
              <div style={{ fontSize: '14px', marginTop: '8px' }}>
                Share your content to attract your first subscribers!
              </div>
            </div>
          )}
        </motion.div>

        {/* Quick actions & notifications */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}
        >
          {/* Quick actions */}
          <div style={{
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid #e1e5e9',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold' }}>
              Quick Actions
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={onShowGoLive}
                style={{
                padding: '12px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                🔴 Start Live Stream
              </button>
              
              <button style={{
                padding: '12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                📹 Post Content
              </button>
              
              <button style={{
                padding: '12px',
                backgroundColor: '#ffc107',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                💎 Create Tier
              </button>
            </div>
          </div>

        </motion.div>
      </div>
    </div>
  );

  const SubscriptionTiersTab = () => (
    <div style={{ padding: '24px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
          Subscription Tiers
        </h3>
        
        <button style={{
          padding: '12px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          ➕ Create New Tier
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        {subscriptionTiers.map((tier, index) => (
          <motion.div
            key={tier.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            style={{
              backgroundColor: '#fff',
              padding: '24px',
              borderRadius: '16px',
              border: '2px solid',
              borderColor: tier.isDefault ? '#e1e5e9' : tier.badge_color,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              position: 'relative'
            }}
          >
            {tier.position === 2 && (
              <div style={{
                position: 'absolute',
                top: '-12px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: '#ffc107',
                color: '#000',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 'bold'
              }}>
                MOST POPULAR
              </div>
            )}

            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <div style={{
                fontSize: '24px',
                marginRight: '8px'
              }}>
                {tier.badge_emoji}
              </div>
              
              <div>
                <h4 style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: tier.badge_color
                }}>
                  {tier.name}
                </h4>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  {tier.currentSubscribers || 0} subscribers
                </div>
              </div>
            </div>

            <p style={{
              margin: '0 0 16px 0',
              fontSize: '14px',
              color: '#666',
              lineHeight: '1.4'
            }}>
              {tier.description}
            </p>

            <div style={{
              marginBottom: '20px'
            }}>
              <div style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#333',
                marginBottom: '4px'
              }}>
                ${tier.monthly_price}
                <span style={{ fontSize: '16px', color: '#666' }}>/month</span>
              </div>
              
              {tier.yearly_price && (
                <div style={{ fontSize: '14px', color: '#28a745' }}>
                  Save ${((tier.monthly_price * 12) - tier.yearly_price).toFixed(2)} with yearly billing
                </div>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                marginBottom: '12px'
              }}>
                Benefits:
              </div>
              
              <ul style={{
                margin: 0,
                paddingLeft: '20px',
                fontSize: '13px',
                lineHeight: '1.6'
              }}>
                {(tier.benefits || []).map((benefit, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{
              display: 'flex',
              gap: '8px'
            }}>
              <button style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#f8f9fa',
                color: '#333',
                border: '1px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}>
                ✏️ Edit
              </button>
              
              <button 
                onClick={() => {
                  setConfirmDialog({
                    isOpen: true,
                    title: tier.isActive ? 'Disable Tier' : 'Enable Tier',
                    message: tier.isActive 
                      ? `Are you sure you want to disable the "${tier.name}" tier? Current subscribers will not be affected.`
                      : `Are you sure you want to enable the "${tier.name}" tier? New fans will be able to subscribe to this tier.`,
                    type: 'warning',
                    onConfirm: async () => {
                      try {
                        const authToken = await getAuthToken();
                        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/subscriptions/tiers/${tier.id}/toggle`, {
                          method: 'PUT',
                          headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ isActive: !tier.isActive })
                        });

                        if (response.ok) {
                          // toast.success(`Tier ${tier.isActive ? 'disabled' : 'enabled'} successfully`);
                          loadStudioData();
                        }
                      } catch (error) {
                        toast.error('Failed to update tier status');
                      }
                    }
                  });
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: tier.isActive ? '#dc3545' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {tier.isActive ? '⏸️ Disable' : '▶️ Enable'}
              </button>
            </div>
          </motion.div>
        ))}

        {/* Create new tier card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: subscriptionTiers.length * 0.1 }}
          style={{
            backgroundColor: '#f8f9fa',
            padding: '24px',
            borderRadius: '16px',
            border: '2px dashed #ccc',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '300px',
            cursor: 'pointer'
          }}
        >
          <div style={{
            fontSize: '48px',
            marginBottom: '16px',
            opacity: 0.5
          }}>
            ➕
          </div>
          
          <div style={{
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: '#666'
          }}>
            Create New Tier
          </div>
          
          <div style={{
            fontSize: '14px',
            color: '#999',
            textAlign: 'center'
          }}>
            Add another subscription<br />tier for your fans
          </div>
        </motion.div>
      </div>
    </div>
  );

  const AnalyticsTab = () => (
    <div style={{ padding: '24px' }}>
      <h3 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: 'bold' }}>
        Analytics Dashboard
      </h3>
      
      {/* Revenue Overview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid #e1e5e9',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#666' }}>Revenue This Month</h4>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#28a745', marginBottom: '8px' }}>
            ${analytics?.monthlyRevenue?.toFixed(2) || '0.00'}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            +12.5% from last month
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid #e1e5e9',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#666' }}>Active Subscribers</h4>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#007bff', marginBottom: '8px' }}>
            {analytics?.activeSubscribers || 0}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            Across all tiers
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid #e1e5e9',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#666' }}>Stream Views</h4>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ffc107', marginBottom: '8px' }}>
            {analytics?.totalStreamViews || 0}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            This month
          </div>
        </motion.div>
      </div>

      {/* Charts and detailed analytics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '24px'
      }}>
        {/* Revenue chart placeholder */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e1e5e9',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <h4 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 'bold' }}>
            Revenue Trends
          </h4>
          <div style={{
            height: '300px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8f9fa',
            borderRadius: '12px',
            border: '2px dashed #ddd'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📈</div>
              <div style={{ fontSize: '16px', color: '#666' }}>Revenue Chart</div>
              <div style={{ fontSize: '14px', color: '#999', marginTop: '8px' }}>
                Interactive charts coming soon
              </div>
            </div>
          </div>
        </motion.div>

        {/* Top performing content */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          style={{
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e1e5e9',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <h4 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 'bold' }}>
            Top Content
          </h4>
          
          {[
            { title: 'Morning Workout Stream', views: 1234, revenue: 89.50 },
            { title: 'Q&A Session', views: 892, revenue: 67.30 },
            { title: 'Tutorial: Basics', views: 756, revenue: 45.20 },
            { title: 'Live Gaming', views: 623, revenue: 38.90 },
            { title: 'Chat & Chill', views: 445, revenue: 29.80 }
          ].map((content, index) => (
            <div
              key={index}
              style={{
                padding: '12px 0',
                borderBottom: index < 4 ? '1px solid #f0f0f0' : 'none'
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                {content.title}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
                <span>{content.views} views</span>
                <span>${content.revenue}</span>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );

  const SubscribersTab = () => (
    <div style={{ padding: '24px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
          Subscribers Management
        </h3>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer'
          }}>
            📧 Message All
          </button>
          <button style={{
            padding: '8px 16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer'
          }}>
            📊 Export Data
          </button>
        </div>
      </div>

      {/* Subscriber stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {[
          { label: 'Total Subscribers', value: subscribers.length, color: '#007bff' },
          { label: 'This Month', value: subscribers.filter(s => 
            new Date(s.created_at) > new Date(Date.now() - 30*24*60*60*1000)
          ).length, color: '#28a745' },
          { label: 'Active', value: subscribers.filter(s => s.isActive).length, color: '#ffc107' },
          { label: 'Churn Rate', value: '2.3%', color: '#dc3545' }
        ].map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            style={{
              backgroundColor: '#fff',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid #e1e5e9',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: stat.color }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Subscribers list */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        border: '1px solid #e1e5e9',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e1e5e9',
          backgroundColor: '#f8f9fa',
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
          gap: '16px',
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#666'
        }}>
          <div>Subscriber</div>
          <div>Tier</div>
          <div>Joined</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {subscribers.slice(0, 10).map((subscriber, index) => (
          <motion.div
            key={subscriber.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            style={{
              padding: '16px 24px',
              borderBottom: index < 9 ? '1px solid #f0f0f0' : 'none',
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
              gap: '16px',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px'
              }}>
                👤
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>
                  {subscriber.subscriber_name}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  @{subscriber.subscriber_username}
                </div>
              </div>
            </div>

            <div>
              <span style={{
                backgroundColor: subscriber.tier_config?.badge_color || '#007bff',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 'bold'
              }}>
                {subscriber.tier_config?.badge_emoji} {subscriber.tier}
              </span>
            </div>

            <div style={{ fontSize: '14px', color: '#666' }}>
              {new Date(subscriber.created_at).toLocaleDateString()}
            </div>

            <div>
              <span style={{
                color: subscriber.isActive ? '#28a745' : '#dc3545',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                {subscriber.isActive ? '● Active' : '○ Inactive'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{
                padding: '4px 8px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #e1e5e9',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer'
              }}>
                💬
              </button>
              <button style={{
                padding: '4px 8px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #e1e5e9',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer'
              }}>
                📊
              </button>
            </div>
          </motion.div>
        ))}

        {subscribers.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>No subscribers yet</div>
            <div style={{ fontSize: '14px' }}>
              Start creating content to attract your first subscribers!
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const ContentTab = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Enhanced Header Section - Matching Offers Page Style */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Content Studio</h2>
              <p className="text-gray-600">Create and manage your exclusive content</p>
            </div>
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
              >
                <PlusIcon className="w-5 h-5" />
                Post Content
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onShowGoLive}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:from-red-600 hover:to-pink-600 transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
              >
                <VideoCameraIcon className="w-5 h-5" />
                Go Live
              </motion.button>
            </div>
          </div>
        </div>

        {/* Enhanced Content Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { 
              label: 'Total Videos', 
              value: '42', 
              icon: PhotoIcon,
              bgGradient: 'from-blue-500 to-cyan-500',
              lightBg: 'from-blue-50 to-cyan-50'
            },
            { 
              label: 'Total Views', 
              value: '12.3K', 
              icon: EyeIcon,
              bgGradient: 'from-green-500 to-emerald-500',
              lightBg: 'from-green-50 to-emerald-50'
            },
            { 
              label: 'Live Streams', 
              value: '18', 
              icon: VideoCameraIcon,
              bgGradient: 'from-red-500 to-pink-500',
              lightBg: 'from-red-50 to-pink-50'
            },
            { 
              label: 'Active Status', 
              value: 'Online', 
              icon: StarIcon,
              bgGradient: 'from-yellow-500 to-orange-500',
              lightBg: 'from-yellow-50 to-orange-50'
            }
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-gradient-to-br ${stat.lightBg} p-6 rounded-2xl border border-gray-200 hover:shadow-lg transition-all duration-300`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 bg-gradient-to-br ${stat.bgGradient} rounded-xl`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <ArrowTrendingUpIcon className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-600">
                  {stat.label}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Enhanced Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[
            { title: 'Morning Workout Routine', type: 'video', views: 1234, duration: '45:30', thumbnail: '🏃‍♀️' },
            { title: 'Live Q&A Session', type: 'live', views: 892, duration: 'Live', thumbnail: '🎙️' },
            { title: 'Cooking Tutorial', type: 'video', views: 756, duration: '25:15', thumbnail: '👨‍🍳' },
            { title: 'Gaming Stream', type: 'live', views: 623, duration: 'Live', thumbnail: '🎮' }
          ].map((content, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -5 }}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300"
            >
              {/* Thumbnail */}
              <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-5xl relative">
                {content.thumbnail}
                
                {/* Duration badge */}
                <div className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs font-bold">
                  {content.duration}
                </div>

                {/* Live indicator */}
                {content.type === 'live' && (
                  <div className="absolute top-2 left-2 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    LIVE
                  </div>
                )}
              </div>

              {/* Content info */}
              <div className="p-4">
                <h4 className="font-semibold text-gray-900 mb-2">
                  {content.title}
                </h4>
                
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-600">
                    {content.views.toLocaleString()} views
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    content.type === 'live' 
                      ? 'bg-red-100 text-red-600' 
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    {content.type.toUpperCase()}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button className="flex-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors duration-200 flex items-center justify-center gap-1">
                    <PencilIcon className="w-4 h-4" />
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteContent(content.id || index, content.title)}
                    className="flex-1 px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-sm font-medium text-red-700 transition-colors duration-200 flex items-center justify-center gap-1"
                  >
                    <XMarkIcon className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );

  const SettingsTab = () => (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Enhanced Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Creator Settings</h2>
          <p className="text-gray-600">Manage your profile, pricing, and preferences</p>
        </div>

        <div className="space-y-6">
          {/* Profile Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl">
                  <UserGroupIcon className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-gray-900">Profile Settings</h4>
                  <p className="text-sm text-gray-600">Customize your creator profile</p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => window.open(`/profile`, '_blank')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium text-sm"
              >
                <EyeIcon className="w-4 h-4" />
                View as Fan
              </motion.button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-700">
                  Display Name
                </label>
                <input
                  type="text"
                  defaultValue={user?.displayName || ''}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your display name"
                />
              </div>
              
              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-700">
                  Username
                </label>
                <input
                  type="text"
                  defaultValue={user?.username || ''}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  placeholder="@username"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block mb-2 text-sm font-semibold text-gray-700">
                  Bio
                </label>
                <textarea
                  rows="3"
                  defaultValue="Fitness enthusiast and wellness coach helping you achieve your goals!"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-vertical"
                  placeholder="Tell your fans about yourself..."
                />
              </div>
            </div>
          </motion.div>

          {/* Pricing Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
                <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-gray-900">Pricing Settings</h4>
                <p className="text-sm text-gray-600">Set your rates for different session types</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Video Call', key: 'videoCall', value: '50', icon: VideoCameraIcon, color: 'blue' },
                { label: 'Voice Call', key: 'voiceCall', value: '30', icon: PhoneIcon, color: 'green' },
                { label: 'Private Stream', key: 'privateStream', value: '100', icon: LockClosedIcon, color: 'purple' },
                { label: 'Group Session', key: 'groupSession', value: '25', icon: UserGroupIcon, color: 'pink' }
              ].map((pricing, index) => {
                const Icon = pricing.icon;
                return (
                  <div key={index} className="relative">
                    <div className={`absolute top-3 right-3 p-2 bg-gradient-to-br from-${pricing.color}-100 to-${pricing.color}-200 rounded-lg`}>
                      <Icon className={`w-4 h-4 text-${pricing.color}-600`} />
                    </div>
                    <label className="block mb-2 text-sm font-semibold text-gray-700">
                      {pricing.label}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        defaultValue={pricing.value}
                        min="1"
                        className="w-full px-4 py-3 pr-20 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                        tokens/min
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          
            
            {/* Private Stream Settings */}
            <div className="mt-6 p-5 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
              <div className="flex items-center gap-2 mb-4">
                <LockClosedIcon className="w-5 h-5 text-purple-600" />
                <h5 className="text-lg font-semibold text-purple-900">Private Stream Settings</h5>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Minimum Session Time
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      defaultValue="5"
                      min="1"
                      max="60"
                      className="w-full px-4 py-3 pr-16 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                      minutes
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">
                    Minimum duration fans must pay for
                  </p>
                </div>
                
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Auto-accept Requests
                  </label>
                  <select className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200">
                    <option value="manual">Manual Approval</option>
                    <option value="auto">Auto-accept All</option>
                    <option value="subscribers">Subscribers Only</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-600">
                    How private requests are handled
                  </p>
                </div>
              </div>
              
              <div className="mt-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    defaultChecked 
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 focus:ring-2"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">Show "Request Private Stream" button during live streams</span>
                </label>
              </div>
            </div>
          </motion.div>

          {/* Availability Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl">
                <CalendarIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-gray-900">Availability Settings</h4>
                <p className="text-sm text-gray-600">Set your weekly availability schedule</p>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-3">
              {[
                { day: 'Mon', full: 'Monday' },
                { day: 'Tue', full: 'Tuesday' },
                { day: 'Wed', full: 'Wednesday' },
                { day: 'Thu', full: 'Thursday' },
                { day: 'Fri', full: 'Friday' },
                { day: 'Sat', full: 'Saturday' },
                { day: 'Sun', full: 'Sunday' }
              ].map((item, index) => (
                <motion.div 
                  key={index} 
                  whileHover={{ y: -2 }}
                  className="text-center"
                >
                  <div className="mb-2 text-sm font-semibold text-gray-700">
                    {item.day}
                  </div>
                  <label className="relative inline-flex cursor-pointer group">
                    <input 
                      type="checkbox" 
                      defaultChecked={index < 5}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-14 bg-gray-100 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-xl peer-checked:bg-gradient-to-br peer-checked:from-purple-500 peer-checked:to-pink-500 flex items-center justify-center transition-all duration-300 group-hover:shadow-md">
                      <CheckIcon className="w-6 h-6 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200" />
                    </div>
                  </label>
                  <p className="mt-1 text-xs text-gray-600">
                    {index < 5 ? 'Active' : 'Off'}
                  </p>
                </motion.div>
              ))}
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Tip:</span> Your availability helps fans know the best times to book sessions with you. You can still accept requests outside these hours.
              </p>
            </div>
          </motion.div>

          {/* Privacy Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-red-100 to-pink-100 rounded-xl">
                <ShieldCheckIcon className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-gray-900">Privacy & Safety</h4>
                <p className="text-sm text-gray-600">Control your privacy and interaction settings</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {[
                { label: 'Allow direct messages from subscribers', checked: true, icon: ChatBubbleLeftRightIcon },
                { label: 'Require approval for new followers', checked: false, icon: UserGroupIcon },
                { label: 'Show online status to followers', checked: true, icon: CheckCircleIcon },
                { label: 'Allow tips during streams', checked: true, icon: CurrencyDollarIcon },
                { label: 'Enable automatic session recording', checked: false, icon: VideoCameraIcon }
              ].map((setting, index) => {
                const Icon = setting.icon;
                return (
                  <motion.label 
                    key={index} 
                    whileHover={{ x: 2 }}
                    className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl cursor-pointer transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-gray-500 group-hover:text-gray-700" />
                      <span className="text-gray-700 font-medium group-hover:text-gray-900">{setting.label}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        defaultChecked={setting.checked}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-600 peer-checked:to-pink-600"></div>
                    </label>
                  </motion.label>
                );
              })}
            </div>
          </motion.div>

          {/* Save button */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex justify-between items-center pt-6"
          >
            <p className="text-sm text-gray-600">
              <span className="font-medium">Last saved:</span> 2 hours ago
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold flex items-center gap-2"
            >
              <CheckIcon className="w-5 h-5" />
              Save All Settings
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab />;
      case 'subscribers':
        return <SubscribersTab />;
      case 'offers':
        return <OffersManagement auth={user} />;
      case 'tiers':
        return <SubscriptionTiersTab />;
      case 'analytics':
        return <AnalyticsTab />;
      case 'content':
        return <ContentTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <DashboardTab />;
    }
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            backgroundColor: '#fff',
            padding: '40px',
            borderRadius: '16px',
            textAlign: 'center'
          }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <div>Loading Creator Studio...</div>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        style={{
          backgroundColor: '#fff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '1400px',
          maxHeight: '90vh',
          display: 'flex',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
      >
        {/* Sidebar */}
        <div style={{
          width: '250px',
          backgroundColor: '#f8f9fa',
          borderRight: '1px solid #e1e5e9',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{
            padding: '24px',
            borderBottom: '1px solid #e1e5e9'
          }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
              🎬 Creator Studio
            </h2>
          </div>

          {/* Navigation */}
          <div style={{ flex: 1, padding: '16px 0' }}>
            {studioTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  backgroundColor: activeTab === tab.id ? '#007bff' : 'transparent',
                  color: activeTab === tab.id ? 'white' : '#666',
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Close button */}
          <div style={{ padding: '16px 24px' }}>
            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Close Studio
            </button>
          </div>
        </div>

        {/* Main content with Chat */}
        <div style={{
          flex: 1,
          backgroundColor: '#fff',
          display: 'flex'
        }}>
          {/* Studio Content */}
          <div style={{
            flex: 1,
            overflowY: 'auto'
          }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {renderTabContent()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Followers Chat Sidebar */}
          <div style={{
            width: '380px',
            borderLeft: '1px solid #e1e5e9',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <InstantMessagingChat
              user={user}
              isCreator={true}
              channelId={user?.uid}
              websocket={null} // You'll need to pass the actual websocket from the parent
              showOnlineFollowers={true}
              compact={true}
            />
          </div>
        </div>
      </motion.div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && setShowUploadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Post Content</h2>
              
              {/* Content Type Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Content Type</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setUploadType('picture')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      uploadType === 'picture' 
                        ? 'border-purple-500 bg-purple-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <PhotoIcon className={`h-8 w-8 mx-auto mb-2 ${
                      uploadType === 'picture' ? 'text-purple-600' : 'text-gray-400'
                    }`} />
                    <span className={`font-medium ${
                      uploadType === 'picture' ? 'text-purple-900' : 'text-gray-700'
                    }`}>Picture</span>
                  </button>
                  <button
                    onClick={() => setUploadType('video')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      uploadType === 'video' 
                        ? 'border-purple-500 bg-purple-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <VideoCameraIcon className={`h-8 w-8 mx-auto mb-2 ${
                      uploadType === 'video' ? 'text-purple-600' : 'text-gray-400'
                    }`} />
                    <span className={`font-medium ${
                      uploadType === 'video' ? 'text-purple-900' : 'text-gray-700'
                    }`}>Video</span>
                  </button>
                </div>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const file = formData.get('file');
                const title = formData.get('title');
                const description = formData.get('description');
                const price = formData.get('price');
                await handleContentUpload(file, title, description, price);
              }} className="space-y-6">
                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Choose {uploadType === 'picture' ? 'Picture' : 'Video'}
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-purple-400 transition-colors">
                    <input
                      type="file"
                      name="file"
                      accept={uploadType === 'picture' ? 'image/*' : 'video/*'}
                      required
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <CloudArrowUpIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-600">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {uploadType === 'picture' ? 'PNG, JPG up to 10MB' : 'MP4, MOV up to 100MB'}
                      </p>
                    </label>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder={uploadType === 'picture' ? 'Exclusive Photo #1' : 'Behind the Scenes Video'}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Tell your fans what makes this content special..."
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price (tokens)
                  </label>
                  <input
                    type="number"
                    name="price"
                    required
                    min="1"
                    defaultValue={uploadType === 'picture' ? '10' : '25'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Fans will pay this amount to unlock this content
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                    disabled={isUploading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <CloudArrowUpIcon className="h-5 w-5" />
                        Post Content
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
      />
    </div>
  );
};

export default CreatorStudio;