import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCircleIcon,
  CameraIcon,
  PencilIcon,
  CheckBadgeIcon,
  StarIcon,
  CurrencyDollarIcon,
  VideoCameraIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  HeartIcon,
  CalendarIcon,
  SparklesIcon,
  PhotoIcon,
  ArrowPathIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  BellIcon
} from '@heroicons/react/24/solid';

const MobileProfile = ({ user, isCreator, onSignOut, onEditProfile, onBecomeCreator, onRefreshProfile }) => {
  // Simple haptic feedback function
  const triggerHaptic = (type = 'light') => {
    if (navigator.vibrate) {
      const duration = type === 'light' ? 10 : type === 'success' ? 20 : 15;
      navigator.vibrate(duration);
    }
  };

  const openBottomSheet = () => {
    // Placeholder for bottom sheet functionality
    console.log('Bottom sheet opened');
  };

  const [activeTab, setActiveTab] = useState('profile');
  const [profileImage, setProfileImage] = useState(user?.photoURL);
  const [refreshing, setRefreshing] = useState(false);

  // Debug logging for mobile creator detection
  React.useEffect(() => {
    console.log('📱 MobileProfile Updated - Stats in header:', {
      isCreator: isCreator,
      user_email: user?.email,
      user_is_creator: user?.is_creator,
      user_role: user?.role,
      user_creator_type: user?.creator_type,
      localStorage_isCreator: localStorage.getItem('userIsCreator'),
      tokenBalance: stats.tokenBalance,
      followers: user?.followers || 0
    });
  }, [isCreator, user]);

  const stats = {
    tokenBalance: user?.token_balance || 0,
    totalEarnings: isCreator ? (user?.total_earnings || '$0') : null,
    totalSessions: isCreator ? (user?.total_sessions || 0) : 0
  };

  const tabs = isCreator ? [
    { id: 'profile', label: 'Profile', icon: UserCircleIcon },
    { id: 'account', label: 'Account', icon: Cog6ToothIcon }
  ] : [
    { id: 'profile', label: 'Profile', icon: UserCircleIcon },
    { id: 'account', label: 'Account', icon: Cog6ToothIcon }
  ];

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result);
        triggerHaptic('success');
      };
      reader.readAsDataURL(file);
    }
  };

  const ProfileHeader = () => (
    <motion.div
      className="mobile-profile-header"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Cover Image with stats in header */}
      <div className="relative h-48 bg-gradient-to-r from-purple-500 to-pink-500">
        <div className="absolute inset-0 bg-black/20" />

        {/* Top Right Stats - Absolute positioned */}
        <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
          {/* Followers Button */}
          <motion.button
            className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-lg"
            whileTap={{ scale: 0.95 }}
            onClick={() => console.log('Navigate to followers')}
          >
            <HeartIcon className="w-5 h-5 text-pink-500" />
            <span className="font-bold text-gray-900">{user?.followers_count || user?.followers || 0}</span>
          </motion.button>

          {/* Tokens Button */}
          <motion.button
            className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-lg"
            whileTap={{ scale: 0.95 }}
            onClick={() => console.log('Navigate to wallet')}
          >
            <CurrencyDollarIcon className="w-5 h-5 text-purple-600" />
            <span className="font-bold text-gray-900">{stats.tokenBalance}</span>
          </motion.button>
        </div>
        
        {/* Profile Image */}
        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2">
          <div className="relative">
            <motion.div 
              className="w-32 h-32 rounded-full border-4 border-white bg-white overflow-hidden shadow-xl"
              whileTap={{ scale: 0.95 }}
            >
              {profileImage ? (
                <img src={profileImage} alt={user?.displayName} className="w-full h-full object-cover" />
              ) : (
                <UserCircleIcon className="w-full h-full text-gray-300" />
              )}
            </motion.div>
            
            {/* Upload Button */}
            <label className="absolute bottom-0 right-0 w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center shadow-lg cursor-pointer">
              <CameraIcon className="w-5 h-5 text-white" />
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            
            {/* Verified Badge */}
            {isCreator && (
              <motion.div 
                className="absolute -top-2 -right-2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
              >
                <CheckBadgeIcon className="w-8 h-8 text-blue-500" />
              </motion.div>
            )}
          </div>
        </div>
      </div>
      
      {/* Profile Info */}
      <div className="pt-20 pb-6 px-6 text-center">
        {/* Name and Username row with better alignment */}
        <div className="mb-1">
          <h1 className="text-2xl font-bold text-gray-900">{user?.displayName || 'User'}</h1>
          <p className="text-gray-500 mt-1">@{user?.email?.split('@')[0] || 'username'}</p>
        </div>
        
        {/* Account Type Badge */}
        <div className="flex justify-center mb-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
            isCreator 
              ? 'bg-purple-100 text-purple-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {isCreator ? (
              <>
                <CheckBadgeIcon className="w-4 h-4 mr-1" />
                Creator Account
              </>
            ) : (
              <>
                <UserCircleIcon className="w-4 h-4 mr-1" />
                Fan Account
              </>
            )}
          </span>
        </div>
        
        {/* Bio section */}
        {user?.bio && (
          <div className="mb-4 px-6">
            <p className="text-sm text-gray-600 text-center">{user.bio}</p>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex gap-3">
          <motion.button
            onClick={() => onEditProfile?.()}
            className="flex-1 mobile-button-secondary flex items-center justify-center gap-2"
            whileTap={{ scale: 0.95 }}
          >
            <PencilIcon className="w-4 h-4" />
            Edit Profile
          </motion.button>
          
          {!isCreator && (
            <motion.button
              onClick={() => onBecomeCreator?.()}
              className="flex-1 mobile-button-primary flex items-center justify-center gap-2"
              whileTap={{ scale: 0.95 }}
            >
              <SparklesIcon className="w-4 h-4" />
              Become Creator
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );

  const ProfileTab = () => (
    <div className="space-y-6 p-4">
      {/* Profile Information */}
      <motion.div
        className="bg-white rounded-xl p-4 shadow-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-gray-600">Username</span>
            <span className="text-sm font-medium text-gray-900">@{user?.username || user?.email?.split('@')[0]}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-t">
            <span className="text-sm text-gray-600">Email</span>
            <span className="text-sm font-medium text-gray-900">{user?.email}</span>
          </div>
          {user?.phone && (
            <div className="flex justify-between items-center py-2 border-t">
              <span className="text-sm text-gray-600">Phone</span>
              <span className="text-sm font-medium text-gray-900">{user.phone}</span>
            </div>
          )}
          {user?.location && (
            <div className="flex justify-between items-center py-2 border-t">
              <span className="text-sm text-gray-600">Location</span>
              <span className="text-sm font-medium text-gray-900">{user.location}</span>
            </div>
          )}
        </div>
      </motion.div>


      {/* Creator Stats - Only for creators */}
      {isCreator && (
        <motion.div
          className="bg-white rounded-xl p-4 shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Creator Statistics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 rounded-xl">
              <div className="text-2xl font-bold text-green-700">{stats.totalEarnings}</div>
              <div className="text-sm text-green-600">Total Earnings</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl">
              <div className="text-2xl font-bold text-blue-700">{stats.totalSessions}</div>
              <div className="text-sm text-blue-600">Sessions</div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );


  const AccountTab = () => (
    <div className="space-y-4 p-4">
      <motion.div
        className="bg-white rounded-xl p-4 shadow-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Management</h3>

        <div className="space-y-3">
          <button
            onClick={() => onEditProfile?.()}
            className="w-full flex items-center justify-between py-3 px-2 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-3">
              <PencilIcon className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700">Edit Profile</span>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </button>

          <div className="border-t" />

          <button className="w-full flex items-center justify-between py-3 px-2 hover:bg-gray-50 rounded-lg transition-colors">
            <div className="flex items-center gap-3">
              <LockClosedIcon className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700">Change Password</span>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </button>

          <button className="w-full flex items-center justify-between py-3 px-2 hover:bg-gray-50 rounded-lg transition-colors">
            <div className="flex items-center gap-3">
              <ShieldCheckIcon className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700">Privacy Settings</span>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </button>

          <button className="w-full flex items-center justify-between py-3 px-2 hover:bg-gray-50 rounded-lg transition-colors">
            <div className="flex items-center gap-3">
              <BellIcon className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700">Notification Settings</span>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </motion.div>

      {!isCreator && (
        <motion.div
          className="bg-white rounded-xl p-4 shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <button
            onClick={() => onBecomeCreator?.()}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 hover:from-purple-700 hover:to-pink-700 transition-all"
          >
            <SparklesIcon className="w-5 h-5" />
            Become a Creator
          </button>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <button
          onClick={() => {
            triggerHaptic('medium');
            onSignOut?.();
          }}
          className="w-full bg-white rounded-xl p-4 shadow-sm text-red-600 font-medium flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          Sign Out
        </button>
      </motion.div>
    </div>
  );

  const ChevronRightIcon = ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <ProfileHeader />
      
      {/* Tabs */}
      <div className="px-4 mb-6">
        <div className="flex bg-white rounded-xl p-1 shadow-sm">
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                triggerHaptic('light');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.label}</span>
            </motion.button>
          ))}
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="px-4">
        <AnimatePresence mode="wait">
          {activeTab === 'profile' && <ProfileTab key="profile" />}
          {activeTab === 'account' && <AccountTab key="account" />}
        </AnimatePresence>
      </div>
      
      {/* Mobile Toggle Styles */}
      <style>{`
        .mobile-toggle {
          position: relative;
          width: 48px;
          height: 24px;
        }
        
        .toggle-track {
          position: absolute;
          inset: 0;
          background: #e5e7eb;
          border-radius: 12px;
          transition: background 0.2s;
        }
        
        .mobile-toggle input:checked ~ .toggle-track {
          background: #8b5cf6;
        }
        
        .toggle-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: transform 0.2s;
        }
        
        .mobile-toggle input:checked ~ .toggle-thumb {
          transform: translateX(24px);
        }
      `}</style>
    </div>
  );
};

export default MobileProfile;