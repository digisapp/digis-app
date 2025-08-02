import React, { useState, useEffect, useCallback } from 'react';
// import { motion, AnimatePresence } from 'framer-motion'; // Removed to eliminate animations
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ClockIcon,
  StarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CalendarIcon,
  BellIcon,
  CogIcon,
  EyeIcon,
  PhoneIcon,
  VideoCameraIcon,
  SignalIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  FireIcon,
  LightBulbIcon,
  GiftIcon,
  FolderIcon,
  UserPlusIcon,
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  MapPinIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import {
  HeartIcon,
  TrophyIcon,
  SparklesIcon
} from '@heroicons/react/24/solid';
import CreatorAvailabilitySystem from './CreatorAvailabilitySystem';
import CallQueueSystem from './CallQueueSystem';
import PreCallValidation from './PreCallValidation';
import Button from './ui/Button';
import Card from './ui/Card';
import toast from 'react-hot-toast';
import MassMessageModal from './MassMessageModal';
import CreatorExperiencesMeter from './CreatorExperiencesMeter';
import CreatorNotificationWidget from './CreatorNotificationWidget';
import EnhancedScheduleCalendar from './EnhancedScheduleCalendar';

const EnhancedCreatorDashboard = ({ 
  user, 
  onNavigate,
  onShowGoLive, 
  onShowAvailability,
  onShowEarnings,
  onShowContent,
  onShowOffers,
  onShowSettings,
  onShowExperiences,
  tokenBalance = 0,
  sessionStats = {}
}) => {
  const [showMassMessageModal, setShowMassMessageModal] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    todayStats: {
      earnings: 12450,
      calls: 24,
      minutes: 340,
      uniqueFans: 18,
      earningsGrowth: 20.6
    },
    weekStats: {
      earnings: 45320,
      calls: 142,
      minutes: 2140,
      growth: 15.3
    },
    activeSubscribers: 847,
    subscriberGrowth: 12.3,
    topFans: [
      { id: 1, username: 'SuperFan123', displayName: 'Alice', totalSpent: 2450, totalCalls: 15, lastActive: new Date(Date.now() - 3600000), isVip: true },
      { id: 2, username: 'MusicLover', displayName: 'Bob', totalSpent: 1890, totalCalls: 12, lastActive: new Date(Date.now() - 7200000), isVip: false },
      { id: 3, username: 'ArtEnthusiast', displayName: 'Carol', totalSpent: 1670, totalCalls: 10, lastActive: new Date(Date.now() - 86400000), isVip: true },
      { id: 4, username: 'PhotoPro', displayName: 'David', totalSpent: 1520, totalCalls: 9, lastActive: new Date(Date.now() - 10800000), isVip: false },
      { id: 5, username: 'TechGuru', displayName: 'Eva', totalSpent: 1380, totalCalls: 8, lastActive: new Date(Date.now() - 14400000), isVip: true }
    ],
    recentActivities: [
      { id: 1, type: 'tip', user: 'Bob', amount: 100, time: new Date(Date.now() - 1800000), message: 'Great stream!' },
      { id: 2, type: 'subscribe', user: 'Carol', time: new Date(Date.now() - 3600000) },
      { id: 3, type: 'gift', user: 'David', gift: '💎', value: 50, time: new Date(Date.now() - 7200000) }
    ],
    insights: [
      { id: 1, type: 'warning', title: 'Low engagement last stream', description: 'Try interacting more with chat', priority: 'high', action: 'View tips' },
      { id: 2, type: 'success', title: 'Peak viewing time identified', description: '8-10 PM EST gets 3x more viewers', priority: 'medium', action: 'Set schedule' },
      { id: 3, type: 'info', title: 'New feature available', description: 'Try co-hosting to boost engagement', priority: 'low', action: 'Learn more' }
    ],
    bestStreamTimes: [
      { day: 'Monday', time: '8 PM', viewers: 320 },
      { day: 'Wednesday', time: '9 PM', viewers: 410 },
      { day: 'Friday', time: '8 PM', viewers: 580 },
      { day: 'Saturday', time: '7 PM', viewers: 650 }
    ],
    upcomingSessions: [
      { id: 1, type: 'video', fan: 'Alice', time: new Date(Date.now() + 3600000), duration: 30, price: 45 },
      { id: 2, type: 'stream', title: 'Evening Stream', time: new Date(Date.now() + 7200000), estimatedViewers: 250 }
    ]
  });
  const [loading, setLoading] = useState(false);

  // Data is loaded immediately
  useEffect(() => {
    // No loading delay needed
  }, []);

  const getInsightIcon = (type) => {
    switch (type) {
      case 'warning': return ExclamationTriangleIcon;
      case 'success': return CheckCircleIcon;
      case 'info': return InformationCircleIcon;
      default: return LightBulbIcon;
    }
  };

  const getInsightColor = (type) => {
    switch (type) {
      case 'warning': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-purple-600 bg-purple-50 border-purple-200';
    }
  };

  const formatTime = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };



  return (
    <div className="space-y-6">

      {/* Quick Actions - Horizontal Layout */}
      <div
        className="flex flex-wrap gap-3"
      >
        <button
          onClick={onShowGoLive}
          className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 min-w-[140px] whitespace-nowrap"
        >
          <SignalIcon className="w-5 h-5 flex-shrink-0" />
          <span>Go Live</span>
        </button>
        <div className="flex-1" /> {/* Spacer to push action buttons to the right */}
        <Button
          variant="secondary"
          size="md"
          onClick={onShowContent}
          icon={<FolderIcon className="w-5 h-5" />}
          className="min-w-[140px] whitespace-nowrap"
        >
          Content
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => {
            console.log('Offers button clicked');
            if (onShowOffers) {
              console.log('Calling onShowOffers');
              onShowOffers();
            } else {
              console.error('onShowOffers prop is not defined');
            }
          }}
          icon={<GiftIcon className="w-5 h-5" />}
          className="min-w-[140px] whitespace-nowrap"
        >
          Offers
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => setShowSchedule(true)}
          icon={<CalendarDaysIcon className="w-5 h-5" />}
          className="min-w-[140px] whitespace-nowrap"
        >
          Schedule
        </Button>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <Card className="p-6 h-full bg-gradient-to-br from-purple-50 via-white to-pink-50 border-purple-200">
            <div className="flex items-start justify-between h-full">
              <div className="flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl">
                      <CalendarIcon className="w-5 h-5 text-purple-700" />
                    </div>
                    <p className="text-base font-bold text-gray-800 uppercase tracking-wide">This Month</p>
                  </div>
                  <div className="mb-2">
                    <p className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                      {dashboardData.todayStats.earnings.toLocaleString()}
                    </p>
                    <p className="text-sm font-medium text-gray-600 mt-1">tokens earned</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full font-semibold text-sm ${
                  dashboardData.todayStats.earningsGrowth >= 0 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {dashboardData.todayStats.earningsGrowth >= 0 ? (
                    <ArrowTrendingUpIcon className="w-4 h-4" />
                  ) : (
                    <ArrowTrendingDownIcon className="w-4 h-4" />
                  )}
                  {Math.abs(dashboardData.todayStats.earningsGrowth)}%
                </div>
                <p className="text-xs text-gray-500 mt-1">vs last month</p>
              </div>
            </div>
          </Card>
        </div>

        <div>
          <Card className="p-6 h-full bg-gradient-to-br from-blue-50 via-white to-indigo-50 border-blue-200">
            <div className="flex flex-col h-full">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl">
                      <UserGroupIcon className="w-5 h-5 text-blue-700" />
                    </div>
                    <p className="text-base font-bold text-gray-800 uppercase tracking-wide">Active Fans</p>
                  </div>
                  <div className="mb-2">
                    <p className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                      {dashboardData.activeSubscribers}
                    </p>
                    <p className="text-sm font-medium text-gray-600 mt-1">subscribers</p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full font-semibold text-sm ${
                    dashboardData.subscriberGrowth >= 0 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {dashboardData.subscriberGrowth >= 0 ? (
                      <ArrowTrendingUpIcon className="w-4 h-4" />
                    ) : (
                      <ArrowTrendingDownIcon className="w-4 h-4" />
                    )}
                    {Math.abs(dashboardData.subscriberGrowth)}%
                  </div>
                  <p className="text-xs text-gray-500 mt-1">vs last month</p>
                </div>
              </div>
              <div className="mt-auto pt-4 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 border-2 border-white" />
                  ))}
                  <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium">
                    +{dashboardData.activeSubscribers - 5}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowMassMessageModal(true)}
                  icon={<ChatBubbleLeftRightIcon className="w-4 h-4" />}
                >
                  Message All
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div>
          <Card className="p-6 h-full bg-gradient-to-br from-green-50 via-white to-emerald-50 border-green-200">
            <div className="flex flex-col h-full">
              <div className="flex items-start justify-between">
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
                      <ClockIcon className="w-5 h-5 text-green-700" />
                    </div>
                    <p className="text-base font-bold text-gray-800 uppercase tracking-wide">Next Session</p>
                  </div>
                  {dashboardData.upcomingSessions.length > 0 ? (
                    <div className="mb-2">
                      <p className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">
                        {formatTime(dashboardData.upcomingSessions[0].time)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                          dashboardData.upcomingSessions[0].type === 'video' 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-pink-100 text-pink-700'
                        }`}>
                          {dashboardData.upcomingSessions[0].type === 'video' ? (
                            <VideoCameraIcon className="w-4 h-4" />
                          ) : (
                            <SignalIcon className="w-4 h-4" />
                          )}
                          {dashboardData.upcomingSessions[0].type === 'video' ? 'Video Call' : 'Live Stream'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-xl font-medium text-gray-400">No sessions scheduled</p>
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full mt-auto"
                onClick={onShowAvailability}
              >
                Manage Schedule
              </Button>
            </div>
          </Card>
        </div>

      </div>

      {/* Main Content Grid - All three sections on same row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Enhanced Notifications Widget */}
        <div>
          <CreatorNotificationWidget 
            onShowAllNotifications={() => {
              // This will trigger the notification bell to open
              const bellButton = document.querySelector('[data-notification-bell]');
              if (bellButton) {
                bellButton.click();
              }
            }}
          />
        </div>

        {/* Top Supporters */}
        <div>
          <Card className="p-6 h-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrophyIcon className="w-5 h-5 text-yellow-500" />
              Top Supporters
            </h3>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {dashboardData.topFans.map((fan, index) => (
                <div 
                  key={fan.id} 
                  className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors -mx-2"
                  onClick={() => {
                    // Navigate to fan profile without toast messages
                    // onViewProfile && onViewProfile(fan.id);
                  }}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500' :
                    index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400' :
                    index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500' :
                    index === 3 ? 'bg-gradient-to-br from-purple-400 to-purple-600' :
                    index === 4 ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                    index === 5 ? 'bg-gradient-to-br from-green-400 to-green-600' :
                    index === 6 ? 'bg-gradient-to-br from-pink-400 to-pink-600' :
                    index === 7 ? 'bg-gradient-to-br from-indigo-400 to-indigo-600' :
                    index === 8 ? 'bg-gradient-to-br from-teal-400 to-teal-600' :
                    'bg-gradient-to-br from-red-400 to-red-600'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{fan.displayName}</p>
                    <p className="text-xs text-gray-500">{fan.totalSpent} tokens</p>
                  </div>
                  {fan.isVip && <SparklesIcon className="w-4 h-4 text-yellow-500" />}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Creator Experiences */}
        <div>
          <CreatorExperiencesMeter 
            totalTokens={dashboardData.todayStats.earnings}
            onViewExperiences={() => {
              if (onNavigate) {
                onNavigate('/connect?section=experiences');
              } else {
                console.log('Navigation to Connect page Experiences');
              }
            }}
          />
        </div>
      </div>
      
      {/* Mass Message Modal */}
      <MassMessageModal
        isOpen={showMassMessageModal}
        onClose={() => setShowMassMessageModal(false)}
        totalFans={dashboardData.activeSubscribers}
      />

      {/* Schedule Calendar Modal */}
      {showSchedule && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Your Schedule</h2>
              <button
                onClick={() => setShowSchedule(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <EnhancedScheduleCalendar 
                userType="creator"
                userId={user?.id}
                allowEditing={true}
                showAvailability={true}
                onScheduleEvent={(event) => {
                  console.log('Schedule event:', event);
                  // Handle scheduling
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedCreatorDashboard;