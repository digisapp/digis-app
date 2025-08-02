import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMobileUI } from './MobileUIProvider';
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
  PhotoIcon
} from '@heroicons/react/24/solid';

const MobileProfile = ({ user, isCreator, onSignOut, onEditProfile, onBecomeCreator }) => {
  const { triggerHaptic, openBottomSheet } = useMobileUI();
  const [activeTab, setActiveTab] = useState('overview');
  const [profileImage, setProfileImage] = useState(user?.photoURL);

  const stats = {
    tokenBalance: 250,
    totalEarnings: isCreator ? '$1,245' : null,
    totalSessions: isCreator ? 156 : 23,
    followers: isCreator ? 3420 : null,
    following: 45,
    rating: isCreator ? 4.9 : null
  };

  const tabs = isCreator ? [
    { id: 'overview', label: 'Overview', icon: ChartBarIcon },
    { id: 'content', label: 'Content', icon: PhotoIcon },
    { id: 'analytics', label: 'Analytics', icon: ChartBarIcon },
    { id: 'settings', label: 'Settings', icon: Cog6ToothIcon }
  ] : [
    { id: 'overview', label: 'Overview', icon: UserCircleIcon },
    { id: 'history', label: 'History', icon: CalendarIcon },
    { id: 'settings', label: 'Settings', icon: Cog6ToothIcon }
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
      {/* Cover Image */}
      <div className="relative h-48 bg-gradient-to-r from-purple-500 to-pink-500">
        <div className="absolute inset-0 bg-black/20" />
        
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
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{user?.displayName || 'User'}</h1>
        <p className="text-gray-500 mb-4">@{user?.email?.split('@')[0] || 'username'}</p>
        
        {/* Quick Stats */}
        <div className="flex justify-center gap-6 mb-4">
          {isCreator && (
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">{stats.followers}</div>
              <div className="text-xs text-gray-500">Followers</div>
            </div>
          )}
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">{stats.following}</div>
            <div className="text-xs text-gray-500">Following</div>
          </div>
          {isCreator && (
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900 flex items-center gap-1">
                <StarIcon className="w-4 h-4 text-yellow-500" />
                {stats.rating}
              </div>
              <div className="text-xs text-gray-500">Rating</div>
            </div>
          )}
        </div>
        
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

  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Balance Card */}
      <motion.div 
        className="mobile-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Token Balance</h3>
          <CurrencyDollarIcon className="w-6 h-6 text-purple-600" />
        </div>
        <div className="text-3xl font-bold text-gray-900 mb-2">{stats.tokenBalance} Tokens</div>
        <button className="text-purple-600 font-medium text-sm">Buy More Tokens →</button>
      </motion.div>
      
      {/* Creator Stats */}
      {isCreator && (
        <motion.div 
          className="mobile-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Creator Stats</h3>
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
      
      {/* Quick Actions */}
      <motion.div 
        className="space-y-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="text-lg font-semibold text-gray-900 px-4">Quick Actions</h3>
        
        <button className="mobile-list-item w-full">
          <HeartIcon className="w-5 h-5 text-red-500" />
          <div className="mobile-list-item-content">
            <div className="mobile-list-item-title">Favorites</div>
            <div className="mobile-list-item-subtitle">View your favorite creators</div>
          </div>
          <ChevronRightIcon className="w-5 h-5 text-gray-400" />
        </button>
        
        <button className="mobile-list-item w-full">
          <CalendarIcon className="w-5 h-5 text-blue-500" />
          <div className="mobile-list-item-content">
            <div className="mobile-list-item-title">Schedule</div>
            <div className="mobile-list-item-subtitle">Manage your availability</div>
          </div>
          <ChevronRightIcon className="w-5 h-5 text-gray-400" />
        </button>
        
        <button className="mobile-list-item w-full">
          <VideoCameraIcon className="w-5 h-5 text-purple-500" />
          <div className="mobile-list-item-content">
            <div className="mobile-list-item-title">Session History</div>
            <div className="mobile-list-item-subtitle">View past sessions</div>
          </div>
          <ChevronRightIcon className="w-5 h-5 text-gray-400" />
        </button>
      </motion.div>
    </div>
  );

  const SettingsTab = () => (
    <div className="space-y-6">
      <motion.div 
        className="mobile-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Settings</h3>
        
        <div className="space-y-4">
          <button className="w-full flex items-center justify-between py-3">
            <span className="text-gray-700">Notifications</span>
            <div className="mobile-toggle">
              <input type="checkbox" defaultChecked className="sr-only" />
              <div className="toggle-track"></div>
              <div className="toggle-thumb"></div>
            </div>
          </button>
          
          <button className="w-full flex items-center justify-between py-3">
            <span className="text-gray-700">Privacy</span>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </button>
          
          <button className="w-full flex items-center justify-between py-3">
            <span className="text-gray-700">Security</span>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </motion.div>
      
      <motion.button
        onClick={onSignOut}
        className="w-full mobile-list-item text-red-600"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        whileTap={{ scale: 0.98 }}
      >
        <ArrowRightOnRectangleIcon className="w-5 h-5" />
        <span className="flex-1 text-left font-medium">Sign Out</span>
      </motion.button>
    </div>
  );

  const ChevronRightIcon = ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
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
          {activeTab === 'overview' && <OverviewTab key="overview" />}
          {activeTab === 'settings' && <SettingsTab key="settings" />}
          {/* Add other tabs as needed */}
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