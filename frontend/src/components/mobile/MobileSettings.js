import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  UserCircleIcon,
  BellIcon,
  ShieldCheckIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  GlobeAltIcon,
  QuestionMarkCircleIcon,
  ArrowRightOnRectangleIcon,
  ChevronRightIcon,
  SunIcon,
  MoonIcon,
  EyeIcon,
  EyeSlashIcon,
  CameraIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const MobileSettings = ({ user, onNavigate, onLogout }) => {
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState({
    calls: true,
    messages: true,
    payments: true,
    marketing: false
  });
  const [privacy, setPrivacy] = useState({
    profilePublic: true,
    showOnline: true,
    allowMessages: true
  });

  const settingSections = [
    {
      title: 'Account',
      items: [
        {
          id: 'profile',
          label: 'Profile Settings',
          icon: UserCircleIcon,
          description: 'Edit your profile information',
          action: () => onNavigate('profile')
        },
        {
          id: 'verification',
          label: 'Verification',
          icon: ShieldCheckIcon,
          description: 'Verify your identity',
          badge: user?.isVerified ? 'Verified' : 'Pending',
          badgeColor: user?.isVerified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
        },
        {
          id: 'payment',
          label: 'Payment Methods',
          icon: CreditCardIcon,
          description: 'Manage payment options'
        }
      ]
    },
    {
      title: 'Preferences',
      items: [
        {
          id: 'notifications',
          label: 'Notifications',
          icon: BellIcon,
          description: 'Control your notifications',
          hasToggle: true
        },
        {
          id: 'privacy',
          label: 'Privacy',
          icon: EyeIcon,
          description: 'Manage privacy settings',
          hasToggle: true
        },
        {
          id: 'appearance',
          label: 'Appearance',
          icon: darkMode ? MoonIcon : SunIcon,
          description: 'Theme and display settings',
          toggle: darkMode,
          onToggle: () => setDarkMode(!darkMode)
        }
      ]
    },
    {
      title: 'Support',
      items: [
        {
          id: 'help',
          label: 'Help Center',
          icon: QuestionMarkCircleIcon,
          description: 'Get help and support'
        },
        {
          id: 'about',
          label: 'About',
          icon: GlobeAltIcon,
          description: 'Version 2.1.0'
        }
      ]
    }
  ];

  const handleSettingClick = (item) => {
    if (item.action) {
      item.action();
    } else if (item.id === 'notifications') {
      // Show notifications modal
    } else if (item.id === 'privacy') {
      // Show privacy modal
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 ">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top, 20px)' }}>
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        </div>
      </div>

      {/* User Profile Card */}
      <div className="px-4 mt-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4"
        >
          <div className="flex items-center space-x-4">
            <div className="relative">
              <img
                src={user?.avatarUrl || '/api/placeholder/80/80'}
                alt={user?.username}
                className="w-20 h-20 rounded-full object-cover"
              />
              <button className="absolute bottom-0 right-0 bg-purple-600 text-white p-1.5 rounded-full shadow-lg active:scale-95">
                <CameraIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {user?.username || user?.email?.split('@')[0] || 'User'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                digis.cc/{user?.username || 'username'}
              </p>
              <div className="flex items-center space-x-2 mt-2">
                {user?.isCreator && (
                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                    Creator
                  </span>
                )}
                {user?.isVerified && (
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                    Verified
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Settings Sections */}
      <div className="px-4 mt-6 space-y-6">
        {settingSections.map((section, sectionIndex) => (
          <div key={section.title}>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">
              {section.title}
            </h3>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              {section.items.map((item, index) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: sectionIndex * 0.1 + index * 0.05 }}
                  onClick={() => handleSettingClick(item)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <item.icon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {item.badge && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                    {item.onToggle ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          item.onToggle();
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          item.toggle ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            item.toggle ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    ) : (
                      <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="px-4 mt-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold active:scale-95">
              Upgrade to Creator
            </button>
            <button className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-semibold active:scale-95">
              Download Your Data
            </button>
          </div>
        </div>
      </div>

      {/* Logout Button */}
      <div className="px-4 mt-6 mb-8">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onLogout}
          className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center space-x-2 shadow-lg"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          <span>Sign Out</span>
        </motion.button>
      </div>

      {/* Version Info */}
      <div className="text-center pb-4">
        <p className="text-xs text-gray-400">
          Digis v2.1.0 • Terms • Privacy
        </p>
      </div>
    </div>
  );
};

export default MobileSettings;