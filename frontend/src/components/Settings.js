import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  CogIcon,
  CreditCardIcon,
  BellIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  ArrowPathIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  BoltIcon,
  CurrencyDollarIcon,
  PencilSquareIcon,
  ArrowRightOnRectangleIcon,
  QuestionMarkCircleIcon,
  DocumentTextIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { getAuthToken } from '../utils/auth-helpers';
import PushNotificationManager from './PushNotificationManager';

const TOKEN_PACKAGES = [
  { tokens: 500, price: 5.94 },
  { tokens: 1000, price: 10.33 },
  { tokens: 2000, price: 18.57 },
  { tokens: 5000, price: 41.47, bonus: 0.05 },
  { tokens: 10000, price: 77.16, bonus: 0.05 },
  { tokens: 20000, price: 144.57, bonus: 0.05 },
  { tokens: 50000, price: 334.12, bonus: 0.05 },
  { tokens: 100000, price: 632.49, bonus: 0.05 }
];

const Settings = ({ user, onClose, onSettingsUpdate, onLogout }) => {
  console.log('Settings component loaded with new Profile & Account tab');
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('menu');
  const [autoRefillEnabled, setAutoRefillEnabled] = useState(false);
  const [autoRefillPackage, setAutoRefillPackage] = useState(500);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if we're on mobile
  const isMobile = window.innerWidth < 768;

  const tabs = isMobile ? [
    { id: 'menu', label: 'Menu', icon: CogIcon },
    { id: 'profile', label: 'Profile & Account', icon: UserCircleIcon },
    { id: 'auto-refill', label: 'Auto-Refill', icon: ArrowPathIcon },
    { id: 'notifications', label: 'Notifications', icon: BellIcon },
    { id: 'privacy', label: 'Privacy', icon: ShieldCheckIcon }
  ] : [
    { id: 'profile', label: 'Profile & Account', icon: UserCircleIcon },
    { id: 'auto-refill', label: 'Auto-Refill', icon: ArrowPathIcon },
    { id: 'notifications', label: 'Notifications', icon: BellIcon },
    { id: 'privacy', label: 'Privacy', icon: ShieldCheckIcon }
  ];

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const authToken = await getAuthToken();
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/profile`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch settings');
        }

        const data = await response.json();
        setAutoRefillEnabled(data.auto_refill_enabled);
        setAutoRefillPackage(data.auto_refill_package || data.last_purchase_amount || 500);
      } catch (err) {
        console.error('❌ Settings fetch error:', err);
        setError('Failed to load settings');
      }
    };

    fetchSettings();
  }, [user]);

  const handleSaveSettings = async () => {
    setLoading(true);
    setError(null);

    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tokens/settings/auto-refill`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          autoRefillEnabled,
          autoRefillPackage
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update settings');
      }

      // toast.success('Settings updated successfully!');
      onSettingsUpdate?.();
      onClose();
    } catch (err) {
      console.error('❌ Settings update error:', err);
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderMenuTab = () => {
    // Mobile menu view - shows quick access to profile and other options
    return (
      <div className="space-y-4">
        {/* User Profile Section */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
              <UserCircleIcon className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {user?.username || user?.email || 'User'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {user?.role === 'creator' ? 'Creator Account' : 'Fan Account'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <PencilSquareIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="text-gray-900 dark:text-white font-medium">Edit Profile</span>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <BellIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="text-gray-900 dark:text-white font-medium">Notifications</span>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ShieldCheckIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="text-gray-900 dark:text-white font-medium">Privacy & Security</span>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </button>

          <button
            onClick={() => setActiveTab('auto-refill')}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ArrowPathIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="text-gray-900 dark:text-white font-medium">Auto-Refill Settings</span>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </button>

          <button
            onClick={() => navigate('/help')}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <QuestionMarkCircleIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="text-gray-900 dark:text-white font-medium">Help & Support</span>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </button>

          <button
            onClick={() => navigate('/terms')}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <DocumentTextIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="text-gray-900 dark:text-white font-medium">Terms & Privacy</span>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Logout Button */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              if (onLogout) {
                onLogout();
              } else {
                navigate('/logout');
              }
            }}
            className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-medium"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  };

  const renderAutoRefillTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl">
            <BoltIcon className="w-6 h-6 text-purple-700" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Never Run Out of Tokens</h3>
            <p className="text-sm text-gray-600">
              Enable auto-refill to automatically purchase tokens when your balance runs low. 
              Stay connected with your favorite creators without interruption.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <label htmlFor="auto-refill-toggle" className="text-base font-semibold text-gray-900">
              Enable Auto-Refill
            </label>
            {autoRefillEnabled && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <CheckIcon className="w-4 h-4" />
                Active
              </span>
            )}
          </div>
          <button
            id="auto-refill-toggle"
            type="button"
            onClick={() => setAutoRefillEnabled(!autoRefillEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 ${
              autoRefillEnabled ? 'bg-gradient-to-r from-purple-600 to-pink-600' : 'bg-gray-300'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all duration-200 shadow-sm ${
              autoRefillEnabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {autoRefillEnabled && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Auto-Refill Package
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TOKEN_PACKAGES.map((pkg) => {
                  const isSelected = autoRefillPackage === pkg.tokens;
                  const pricePerToken = pkg.price / (pkg.tokens * (1 + (pkg.bonus || 0)));
                  
                  return (
                    <button
                      key={pkg.tokens}
                      onClick={() => setAutoRefillPackage(pkg.tokens)}
                      className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      {pkg.bonus && (
                        <span className="absolute -top-2 -right-2 px-2 py-1 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs font-bold rounded-full shadow-md">
                          +{(pkg.bonus * 100).toFixed(0)}% Bonus
                        </span>
                      )}
                      <div className="text-left">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-2xl font-bold text-gray-900">
                            {pkg.tokens.toLocaleString()}
                          </span>
                          <span className="text-sm text-gray-500">tokens</span>
                        </div>
                        {pkg.bonus && (
                          <p className="text-xs text-green-600 font-medium mb-2">
                            +{Math.floor(pkg.tokens * pkg.bonus).toLocaleString()} bonus tokens
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-semibold text-purple-600">
                            ${pkg.price.toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500">
                            ${pricePerToken.toFixed(3)}/token
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-2 right-2"
                        >
                          <CheckIcon className="w-5 h-5 text-purple-600" />
                        </motion.div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-start gap-3">
                <CreditCardIcon className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">How it works</p>
                  <p className="text-sm text-blue-700 mt-1">
                    When your balance drops below 100 tokens, we'll automatically purchase your selected package 
                    using your saved payment method.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <PushNotificationManager />
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Email Notifications
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-center py-8">
          Email notification settings coming soon...
        </p>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          In-App Notifications
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-center py-8">
          In-app notification preferences coming soon...
        </p>
      </div>
    </div>
  );

  const renderPrivacyTab = () => (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Privacy Settings</h3>
        <p className="text-gray-600 text-center py-8">
          Privacy settings coming soon...
        </p>
      </div>
    </div>
  );

  const renderProfileTab = () => (
    <div className="space-y-6">
      {/* Profile Information Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <UserCircleIcon className="w-5 h-5 text-purple-600" />
          Profile Information
        </h3>
        <div className="space-y-4">
          <button
            onClick={() => navigate('/profile')}
            className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <PencilSquareIcon className="w-5 h-5 text-gray-400" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Edit Profile</p>
                <p className="text-sm text-gray-500">Update your name, bio, and profile photo</p>
              </div>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </button>

          {user?.is_creator && (
            <button
              onClick={() => navigate('/creator/dashboard')}
              className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <SparklesIcon className="w-5 h-5 text-purple-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">Creator Settings</p>
                  <p className="text-sm text-gray-500">Manage your creator profile and rates</p>
                </div>
              </div>
              <ChevronRightIcon className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Account Security Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ShieldCheckIcon className="w-5 h-5 text-purple-600" />
          Account Security
        </h3>
        <div className="space-y-4">
          <button
            onClick={() => {
              // Handle password change
              toast('Password change feature coming soon!', { icon: '🔐' });
            }}
            className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <div className="text-left">
                <p className="font-medium text-gray-900">Change Password</p>
                <p className="text-sm text-gray-500">Update your account password</p>
              </div>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </button>

          <button
            onClick={() => {
              // Handle email change
              toast('Email change feature coming soon!', { icon: '✉️' });
            }}
            className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div className="text-left">
                <p className="font-medium text-gray-900">Email Address</p>
                <p className="text-sm text-gray-500">{user?.email || 'No email set'}</p>
              </div>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </button>

          <button
            onClick={() => {
              // Handle 2FA setup
              toast('Two-factor authentication coming soon!', { icon: '🔐' });
            }}
            className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div className="text-left">
                <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                <p className="text-sm text-gray-500">Not enabled</p>
              </div>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Account Management Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CogIcon className="w-5 h-5 text-purple-600" />
          Account Management
        </h3>
        <div className="space-y-4">
          <button
            onClick={() => {
              toast('Data export feature coming soon!', { icon: '💾' });
            }}
            className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              <div className="text-left">
                <p className="font-medium text-gray-900">Export Your Data</p>
                <p className="text-sm text-gray-500">Download a copy of your information</p>
              </div>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ArrowRightOnRectangleIcon className="w-5 h-5 text-gray-400" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Sign Out</p>
                <p className="text-sm text-gray-500">Sign out of your account</p>
              </div>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </button>

          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                toast.error('Please contact support to delete your account');
              }
            }}
            className="w-full flex items-center justify-between p-4 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
              <div className="text-left">
                <p className="font-medium text-red-900">Delete Account</p>
                <p className="text-sm text-red-600">Permanently delete your account and data</p>
              </div>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gray-50 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl">
                <CogIcon className="w-6 h-6 text-purple-700" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white border-b border-gray-200 px-6">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-all ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4"
            >
              <div className="flex items-center gap-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'menu' && renderMenuTab()}
          {activeTab === 'profile' && renderProfileTab()}
          {activeTab === 'auto-refill' && renderAutoRefillTab()}
          {activeTab === 'notifications' && renderNotificationsTab()}
          {activeTab === 'privacy' && renderPrivacyTab()}
        </div>

        {/* Footer */}
        {activeTab === 'auto-refill' && (
          <div className="bg-white border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={loading}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Settings;