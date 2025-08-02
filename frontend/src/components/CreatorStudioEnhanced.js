import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChartBarIcon,
  UserGroupIcon,
  ShoppingBagIcon,
  SparklesIcon,
  ChartPieIcon,
  VideoCameraIcon,
  CogIcon,
  CurrencyDollarIcon,
  ClockIcon,
  StarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CalendarDaysIcon,
  DocumentPlusIcon,
  SignalIcon,
  XMarkIcon,
  PlusIcon,
  PencilIcon,
  PauseIcon,
  PlayIcon,
  ChatBubbleLeftRightIcon,
  ArrowDownTrayIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import {
  StarIcon as StarIconSolid,
  CheckCircleIcon as CheckCircleIconSolid
} from '@heroicons/react/24/solid';
import InstantMessagingChat from './InstantMessagingChat';
import OffersManagement from './OffersManagement';
import ContentManagement from './ContentManagement';

const CreatorStudioEnhanced = ({ user, onClose }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [analytics, setAnalytics] = useState(null);
  const [subscriptionTiers, setSubscriptionTiers] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Studio tabs with modern icons
  const studioTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: ChartBarIcon, color: 'from-purple-500 to-indigo-600' },
    { id: 'subscribers', label: 'Subscribers', icon: UserGroupIcon, color: 'from-blue-500 to-cyan-600' },
    { id: 'offers', label: 'Offers', icon: ShoppingBagIcon, color: 'from-green-500 to-emerald-600' },
    { id: 'tiers', label: 'Subscription Tiers', icon: SparklesIcon, color: 'from-pink-500 to-rose-600' },
    { id: 'analytics', label: 'Analytics', icon: ChartPieIcon, color: 'from-amber-500 to-orange-600' },
    { id: 'content', label: 'Content', icon: VideoCameraIcon, color: 'from-red-500 to-pink-600' },
    { id: 'settings', label: 'Settings', icon: CogIcon, color: 'from-gray-500 to-gray-600' }
  ];

  const loadStudioData = useCallback(async () => {
    setLoading(true);
    try {
      // Simulated data loading
      setTimeout(() => {
        setAnalytics({
          totalSubscribers: 1247,
          totalEarnings: 8956.50,
          averageRating: 4.8,
          totalMinutesStreamed: 12450,
          totalRatings: 342,
          monthlyRevenue: 2347.80,
          activeSubscribers: 892,
          totalStreamViews: 15678
        });
        
        setSubscriptionTiers([
          {
            id: 1,
            name: 'Bronze Supporter',
            description: 'Basic access to exclusive content',
            monthly_price: 4.99,
            yearly_price: 49.99,
            badge_emoji: '🥉',
            badge_color: '#CD7F32',
            position: 1,
            currentSubscribers: 450,
            benefits: ['Access to subscriber-only posts', 'Monthly Q&A sessions', 'Early access to content'],
            isActive: true
          },
          {
            id: 2,
            name: 'Silver Member',
            description: 'Enhanced experience with extra perks',
            monthly_price: 9.99,
            yearly_price: 99.99,
            badge_emoji: '🥈',
            badge_color: '#C0C0C0',
            position: 2,
            currentSubscribers: 320,
            benefits: ['All Bronze benefits', 'Weekly group calls', 'Exclusive live streams', 'Priority DM responses'],
            isActive: true,
            isDefault: true
          },
          {
            id: 3,
            name: 'Gold VIP',
            description: 'Premium access with all benefits',
            monthly_price: 19.99,
            yearly_price: 199.99,
            badge_emoji: '🥇',
            badge_color: '#FFD700',
            position: 3,
            currentSubscribers: 122,
            benefits: ['All Silver benefits', '1-on-1 monthly calls', 'Custom content requests', 'VIP Discord access', 'Merchandise discounts'],
            isActive: true
          }
        ]);
        
        setSubscribers([
          {
            id: 1,
            subscriber_name: 'Alice Johnson',
            subscriber_username: 'alice_j',
            tier: 'Gold VIP',
            tier_config: { name: 'Gold VIP', badge_emoji: '🥇', badge_color: '#FFD700' },
            created_at: new Date(Date.now() - 86400000),
            isActive: true
          },
          {
            id: 2,
            subscriber_name: 'Bob Smith',
            subscriber_username: 'bobsmith22',
            tier: 'Silver Member',
            tier_config: { name: 'Silver Member', badge_emoji: '🥈', badge_color: '#C0C0C0' },
            created_at: new Date(Date.now() - 172800000),
            isActive: true
          }
        ]);
        
        setLoading(false);
      }, 1500);
    } catch (error) {
      console.error('Error loading studio data:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudioData();
  }, [loadStudioData]);

  const DashboardTab = () => (
    <div className="p-8 space-y-8">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-8 text-white"
      >
        <h2 className="text-3xl font-bold mb-2">Welcome to Your Studio! 🎬</h2>
        <p className="text-purple-100">Here's your performance overview for today</p>
      </motion.div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <UserGroupIcon className="w-6 h-6 text-blue-600" />
            </div>
            <ArrowTrendingUpIcon className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{analytics?.totalSubscribers || 0}</div>
          <div className="text-sm text-gray-600 mt-1">Total Subscribers</div>
          <div className="text-xs text-green-600 mt-2 font-medium">+12% this month</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
            </div>
            <ArrowTrendingUpIcon className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">${analytics?.totalEarnings?.toFixed(2) || '0.00'}</div>
          <div className="text-sm text-gray-600 mt-1">Total Earnings</div>
          <div className="text-xs text-green-600 mt-2 font-medium">+$127 this week</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-100 rounded-xl">
              <StarIcon className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-sm text-gray-500">⭐</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{analytics?.averageRating?.toFixed(1) || 'N/A'}</div>
          <div className="text-sm text-gray-600 mt-1">Average Rating</div>
          <div className="text-xs text-gray-500 mt-2">From {analytics?.totalRatings || 0} reviews</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-100 rounded-xl">
              <ClockIcon className="w-6 h-6 text-red-600" />
            </div>
            <SignalIcon className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{Math.floor((analytics?.totalMinutesStreamed || 0) / 60)}h</div>
          <div className="text-sm text-gray-600 mt-1">Hours Streamed</div>
          <div className="text-xs text-gray-500 mt-2">{analytics?.totalMinutesStreamed || 0} minutes total</div>
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Subscribers */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6"
        >
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <UserGroupIcon className="w-6 h-6 text-purple-600" />
            Recent Subscribers
          </h3>
          
          <div className="space-y-4">
            {subscribers.slice(0, 5).map((subscriber, index) => (
              <motion.div
                key={subscriber.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold">
                    {subscriber.subscriber_name.charAt(0)}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                    <CheckCircleIconSolid className="w-3 h-3 text-white" />
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{subscriber.subscriber_name}</div>
                  <div className="text-sm text-gray-600">@{subscriber.subscriber_username}</div>
                </div>
                
                <div className="text-right">
                  <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-full text-xs font-bold">
                    {subscriber.tier_config?.badge_emoji} {subscriber.tier}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(subscriber.created_at).toLocaleDateString()}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          {subscribers.length === 0 && (
            <div className="text-center py-12">
              <UserGroupIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No subscribers yet</p>
              <p className="text-sm text-gray-400 mt-2">Share your content to attract your first subscribers!</p>
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h4 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h4>
            
            <div className="space-y-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                <SignalIcon className="w-5 h-5" />
                Start Live Stream
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                <DocumentPlusIcon className="w-5 h-5" />
                Post Content
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                <SparklesIcon className="w-5 h-5" />
                Create New Tier
              </motion.button>
            </div>
          </div>

          {/* Performance Insights */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-200">
            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <ChartBarIcon className="w-5 h-5 text-purple-600" />
              Performance Insights
            </h4>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Best performing day:</span>
                <span className="font-medium text-gray-900">Tuesday</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Peak hours:</span>
                <span className="font-medium text-gray-900">7-10 PM</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Top content type:</span>
                <span className="font-medium text-gray-900">Live Streams</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );

  const SubscriptionTiersTab = () => (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-2xl font-bold text-gray-900">Subscription Tiers</h3>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
        >
          <PlusIcon className="w-5 h-5" />
          Create New Tier
        </motion.button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subscriptionTiers.map((tier, index) => (
          <motion.div
            key={tier.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`relative bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all ${
              tier.isDefault ? 'ring-2 ring-purple-500' : ''
            }`}
          >
            {tier.position === 2 && (
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-center py-2 text-sm font-bold">
                MOST POPULAR
              </div>
            )}

            <div className="p-6 pt-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-4xl">{tier.badge_emoji}</div>
                <div>
                  <h4 className="text-xl font-bold" style={{ color: tier.badge_color }}>
                    {tier.name}
                  </h4>
                  <p className="text-sm text-gray-600">{tier.currentSubscribers || 0} subscribers</p>
                </div>
              </div>

              <p className="text-gray-600 mb-6">{tier.description}</p>

              <div className="mb-6">
                <div className="text-3xl font-bold text-gray-900">
                  ${tier.monthly_price}
                  <span className="text-base font-normal text-gray-600">/month</span>
                </div>
                {tier.yearly_price && (
                  <p className="text-sm text-green-600 mt-1">
                    Save ${((tier.monthly_price * 12) - tier.yearly_price).toFixed(2)} with yearly
                  </p>
                )}
              </div>

              <div className="mb-6">
                <h5 className="font-semibold text-gray-900 mb-3">Benefits:</h5>
                <ul className="space-y-2">
                  {(tier.benefits || []).map((benefit, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 flex items-center justify-center gap-2 p-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  <PencilIcon className="w-4 h-4" />
                  Edit
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl font-medium transition-colors ${
                    tier.isActive 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {tier.isActive ? (
                    <>
                      <PauseIcon className="w-4 h-4" />
                      Disable
                    </>
                  ) : (
                    <>
                      <PlayIcon className="w-4 h-4" />
                      Enable
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Create new tier card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: subscriptionTiers.length * 0.1 }}
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-dashed border-gray-300 p-6 flex flex-col items-center justify-center min-h-[400px] cursor-pointer hover:border-purple-400 transition-all"
        >
          <PlusIcon className="w-12 h-12 text-gray-400 mb-4" />
          <h4 className="text-lg font-semibold text-gray-700 mb-2">Create New Tier</h4>
          <p className="text-sm text-gray-500 text-center">
            Add another subscription tier for your fans
          </p>
        </motion.div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab />;
      case 'subscribers':
        return <div className="p-8"><h2 className="text-2xl font-bold">Subscribers Management</h2></div>;
      case 'offers':
        return <OffersManagement auth={user} />;
      case 'tiers':
        return <SubscriptionTiersTab />;
      case 'analytics':
        return <div className="p-8"><h2 className="text-2xl font-bold">Analytics Dashboard</h2></div>;
      case 'content':
        return <ContentManagement user={user} onContentUpdate={(updatedContent) => {
          // This callback can be used to update global state or context
          console.log('Content updated:', updatedContent);
        }} />;
      case 'settings':
        return <div className="p-8"><h2 className="text-2xl font-bold">Creator Settings</h2></div>;
      default:
        return <DashboardTab />;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl p-8 text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 rounded-full border-4 border-gray-200 border-t-purple-600 mx-auto mb-4"
          />
          <p className="text-gray-600 font-medium">Loading Creator Studio...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-3xl w-full max-w-[1600px] h-[90vh] flex overflow-hidden shadow-2xl"
      >
        {/* Modern Sidebar */}
        <div className="w-72 bg-gradient-to-b from-gray-50 to-gray-100 border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                <SparklesIcon className="w-6 h-6 text-white" />
              </div>
              Creator Studio
            </h2>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {studioTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <motion.button
                  key={tab.id}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeTab === tab.id
                      ? 'bg-white shadow-md text-purple-600 font-medium'
                      : 'text-gray-600 hover:bg-white/50'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    activeTab === tab.id 
                      ? `bg-gradient-to-br ${tab.color} shadow-lg` 
                      : 'bg-gray-200'
                  }`}>
                    <Icon className={`w-5 h-5 ${
                      activeTab === tab.id ? 'text-white' : 'text-gray-600'
                    }`} />
                  </div>
                  {tab.label}
                </motion.button>
              );
            })}
          </nav>

          {/* Close Button */}
          <div className="p-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="w-full p-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
              <XMarkIcon className="w-5 h-5" />
              Close Studio
            </motion.button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* Studio Content */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
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

          {/* Chat Sidebar */}
          <div className="w-96 border-l border-gray-200 bg-white">
            <InstantMessagingChat
              user={user}
              isCreator={true}
              channelId={user?.uid}
              websocket={null}
              showOnlineFollowers={true}
              compact={true}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CreatorStudioEnhanced;