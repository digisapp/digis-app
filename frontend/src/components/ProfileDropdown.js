import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import PricingRatesModal from './PricingRatesModal';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { getAuthToken } from '../utils/auth-helpers';
import { toggleTheme, getCurrentTheme } from '../utils/theme-init';
import {
  UserCircleIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  HomeIcon,
  ChatBubbleLeftRightIcon,
  TvIcon,
  UserGroupIcon,
  StarIcon,
  WalletIcon,
  ChartBarIcon,
  BellIcon,
  ShieldCheckIcon,
  SparklesIcon,
  VideoCameraIcon,
  XMarkIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  FolderIcon,
  SunIcon,
  MoonIcon,
  CurrencyDollarIcon,
  GiftIcon,
  ShoppingBagIcon,
  CalendarIcon,
  PhoneIcon,
  TrophyIcon,
  BanknotesIcon,
  UserPlusIcon,
  AdjustmentsHorizontalIcon,
  CheckBadgeIcon,
  PresentationChartBarIcon,
  HeartIcon,
  PhotoIcon,
  LockClosedIcon,
  PaintBrushIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon, BoltIcon } from '@heroicons/react/24/solid';

const ProfileDropdown = ({ 
  user, 
  profile,
  isCreator, 
  isAdmin,
  onSignOut,
  tokenBalance = 0,
  currentPath = '/',
  setCurrentView,
  onShowGoLive
}) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [showPricingRatesModal, setShowPricingRatesModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerData, setOfferData] = useState({
    title: '',
    description: '',
    category: 'General',
    priceTokens: '',
    deliveryTime: '24 hours',
    maxQuantity: ''
  });
  const [stats, setStats] = useState({ followersCount: 0, subscribersCount: 0 });
  const dropdownRef = useRef(null);

  // Merge user and profile data for consistent access
  const userData = { ...user, ...profile };
  
  // Determine if user is actually a creator - check multiple possible fields
  // Check various possible fields where creator status might be stored

  // TEMPORARY: Force show creator tools for testing
  // Remove this line once creator role is properly set in the database
  const FORCE_SHOW_CREATOR_TOOLS = false; // Set to false to use normal detection

  const isActuallyCreator = FORCE_SHOW_CREATOR_TOOLS || isCreator ||
    profile?.is_creator === true ||
    userData?.is_creator === true ||
    user?.is_creator === true ||
    profile?.role === 'creator' ||
    userData?.role === 'creator' ||
    user?.role === 'creator' ||
    // Check for creator-specific fields that indicate creator status
    userData?.creator_type !== undefined ||
    userData?.creator_rate !== undefined ||
    userData?.stream_rate !== undefined ||
    userData?.video_price !== undefined ||
    userData?.voice_price !== undefined ||
    false;
  const isActuallyAdmin = isAdmin || profile?.is_super_admin || profile?.role === 'admin' || userData?.role === 'admin';

  // Enhanced debug logging to help identify the issue
  console.log('🎭 ProfileDropdown Creator Detection:', {
    username: userData?.username,
    display_name: userData?.display_name,
    '--- Props ---': '',
    prop_isCreator: isCreator,
    prop_isAdmin: isAdmin,
    '--- Profile Fields ---': '',
    profile_is_creator: profile?.is_creator,
    profile_role: profile?.role,
    '--- User Fields ---': '',
    user_is_creator: user?.is_creator,
    user_role: user?.role,
    '--- Creator Indicators ---': '',
    has_creator_type: userData?.creator_type !== undefined,
    creator_type: userData?.creator_type,
    has_creator_rate: userData?.creator_rate !== undefined,
    has_stream_rate: userData?.stream_rate !== undefined,
    '--- Final Result ---': '',
    isActuallyCreator: isActuallyCreator,
    isActuallyAdmin: isActuallyAdmin
  });

  // Fetch creator stats when dropdown opens
  useEffect(() => {
    if (isOpen && isActuallyCreator) {
      fetchCreatorStats();
    }
  }, [isOpen, isActuallyCreator]);

  const fetchCreatorStats = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/creators/stats`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats({
          followersCount: data.followersCount || 0,
          subscribersCount: data.subscribersCount || 0
        });
      }
    } catch (error) {
      console.error('Error fetching creator stats:', error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const navigationItems = [
    // Main Navigation - For All Users
    {
      label: 'Explore',
      icon: MagnifyingGlassIcon,
      path: '/explore',
      color: 'text-purple-600 dark:text-purple-400'
    },
    {
      label: 'TV',
      icon: TvIcon,
      path: '/tv',
      color: 'text-pink-600 dark:text-pink-400'
    },
    {
      label: 'Classes',
      icon: StarIcon,
      path: '/classes',
      color: 'text-green-600 dark:text-green-400'
    },
    {
      label: 'Messages',
      icon: ChatBubbleLeftRightIcon,
      path: '/messages',
      color: 'text-blue-600 dark:text-blue-400'
    },
    {
      label: 'Collections',
      icon: FolderIcon,
      path: '/collections',
      color: 'text-orange-600 dark:text-orange-400'
    },
    
    // Creator Tools - Creators Only
    {
      label: 'Go Live',
      icon: VideoCameraIcon,
      path: '/go-live-setup',
      creatorOnly: true,
      highlight: true,
      color: 'text-red-600 dark:text-red-400',
      dividerBefore: true
    },
    {
      label: 'Dashboard',
      icon: HomeIcon,
      path: '/dashboard',
      creatorOnly: true,
      color: 'text-purple-600 dark:text-purple-400'
    },
    {
      label: 'Schedule',
      icon: CalendarIcon,
      path: '/schedule',
      creatorOnly: true,
      color: 'text-indigo-600 dark:text-indigo-400'
    },
    {
      label: 'Manage Calls',
      icon: PhoneIcon,
      path: '/call-requests',
      creatorOnly: true,
      color: 'text-blue-600 dark:text-blue-400'
    },
    
    // Creator Commerce - Creators Only
    {
      label: 'Shop',
      icon: ShoppingBagIcon,
      path: '/shop',
      creatorOnly: true,
      color: 'text-emerald-600 dark:text-emerald-400',
      dividerBefore: true
    },
    
  ];

  // Get current theme
  const [isDarkMode, setIsDarkMode] = useState(
    getCurrentTheme() === 'dark'
  );

  const handleToggleTheme = () => {
    const newTheme = toggleTheme();
    setIsDarkMode(newTheme === 'dark');
  };

  const settingsItems = [
    // Profile & Settings
    {
      label: 'Edit Profile',
      icon: UserCircleIcon,
      path: '/settings',
      color: 'text-gray-600 dark:text-gray-400'
    },
    
    // Creator Analytics & Pricing
    {
      label: 'Analytics',
      icon: ChartBarIcon,
      path: '/analytics',
      creatorOnly: true,
      color: 'text-purple-600 dark:text-purple-400',
      highlight: true,
      dividerBefore: true
    },
    {
      label: 'Pricing Rates',
      icon: CurrencyDollarIcon,
      onClick: () => {
        setShowPricingRatesModal(true);
        setIsOpen(false);
      },
      creatorOnly: true,
      color: 'text-green-600 dark:text-green-400'
    },
    
    // Theme Toggle
    {
      label: isDarkMode ? 'Light Mode' : 'Dark Mode',
      icon: isDarkMode ? SunIcon : MoonIcon,
      onClick: handleToggleTheme,
      color: 'text-gray-600 dark:text-gray-400',
      isToggle: true,
      dividerBefore: true
    }
  ];

  const handleNavigation = (path) => {
    // Always close the menu first
    setIsOpen(false);

    // Prevent fans from accessing wallet page
    if (path === '/wallet' && !isActuallyCreator) {
      path = '/explore'; // Redirect to explore instead
    }

    // Special handling for Go Live (it's a modal, not a view)
    if (path === '/go-live-setup') {
      if (onShowGoLive) {
        onShowGoLive();
      }
      return;
    }


    // Extract base path without query parameters
    const basePath = path.split('?')[0];
    const queryParams = path.includes('?') ? path.split('?')[1] : '';

    // Map paths to view names
    const viewMap = {
      '/dashboard': 'dashboard',
      '/offers': 'offers',
      '/shop': 'shop',
      '/schedule': 'schedule',
      '/call-requests': 'call-requests',
      '/calls': 'calls',
      '/messages': 'messages',
      '/classes': 'classes',
      '/tv': 'tv',
      '/explore': 'explore',
      '/collections': 'collections',
      '/wallet': 'wallet',
      '/go-live': 'streaming',
      '/profile': 'profile',
      '/analytics': 'analytics',
      '/followers': 'followers',
      '/subscribers': 'subscribers'
    };

    const view = viewMap[basePath];

    // Update the view using setCurrentView (which is actually onNavigate from NavigationContext)
    // onNavigate expects a path, not a view name
    if (setCurrentView) {
      console.log('ProfileDropdown: Navigating to path:', path);
      setCurrentView(path); // Pass the full path with slash

      // Handle tab parameters for profile page
      if (basePath === '/profile' && queryParams) {
        // Parse the tab parameter
        const tabMatch = queryParams.match(/tab=(\w+)/);
        if (tabMatch) {
          const tabName = tabMatch[1];
          // Give the profile view time to load, then switch to the specified tab
          setTimeout(() => {
            // Try to find and click the tab button
            const tabButtons = document.querySelectorAll('button');
            tabButtons.forEach(button => {
              // Look for the tab by checking if it contains the tab icon and label
              if (tabName === 'settings' && button.textContent?.includes('Settings')) {
                button.click();
              } else if (tabName === 'profile' && button.textContent?.includes('Profile')) {
                button.click();
              }
            });
          }, 100);
        }
      }
    } else {
      console.warn('ProfileDropdown: Cannot navigate to', path, '- setCurrentView not available');
    }
  };

  const filteredNavItems = navigationItems.filter(item => 
    !item.creatorOnly || (item.creatorOnly && isActuallyCreator)
  );

  const filteredSettingsItems = settingsItems.filter(item => 
    !item.creatorOnly || (item.creatorOnly && isActuallyCreator)
  );

  return (
    <div className="relative" style={{ zIndex: 9999 }} ref={dropdownRef}>
      {/* Profile Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="relative group"
        aria-label="Profile menu"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Outer ring container for hover effect */}
        <div className="relative">
          {/* Animated ring on hover */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 blur-lg transition-opacity duration-300" />
          
          {/* Profile image/avatar */}
          {userData?.profile_pic_url ? (
            <img
              src={userData.profile_pic_url}
              alt={userData.display_name || userData.username}
              className="relative w-11 h-11 rounded-full object-cover ring-2 ring-gray-200 dark:ring-gray-700 group-hover:ring-purple-500 dark:group-hover:ring-purple-400 transition-all duration-300"
            />
          ) : (
            <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-base shadow-lg ring-2 ring-gray-200 dark:ring-gray-700 group-hover:ring-purple-500 dark:group-hover:ring-purple-400 transition-all duration-300">
              {(userData?.display_name || userData?.username || 'U')[0].toUpperCase()}
            </div>
          )}
          
          {/* Creator verified badge */}
          {isActuallyCreator && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-900 shadow-sm"
            >
              <CheckCircleIcon className="w-3.5 h-3.5 text-white" />
            </motion.div>
          )}
          
          {/* Online status indicator (optional) */}
          <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full ring-2 ring-white dark:ring-gray-900 animate-pulse" />
        </div>
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for all devices */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998]"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              className={`absolute right-0 mt-2 ${isActuallyAdmin ? 'w-64' : isActuallyCreator ? 'w-[440px]' : 'w-72'} bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden`}
              style={{ zIndex: 99999 }}
            >
              {/* User Info Header */}
              <div className="p-4 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 text-white">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold text-xl">{userData?.display_name || userData?.username || 'User'}</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-base opacity-90">@{userData?.username || 'username'}</p>
                      {isActuallyCreator && !isActuallyAdmin && (
                        <CheckCircleIcon className="w-4 h-4 text-white/90" title="Verified Creator" />
                      )}
                      {isActuallyAdmin && (
                        <ShieldCheckIcon className="w-4 h-4 text-white/90" title="Administrator" />
                      )}
                    </div>
                    {isActuallyCreator && !isActuallyAdmin && userData?.username && (
                      <p className="text-xs opacity-75 mt-1">digis.cc/{userData.username}</p>
                    )}
                    {isActuallyAdmin && (
                      <p className="text-xs opacity-75 mt-1">Administrator</p>
                    )}
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Followers and Subscribers Stats */}
                {isActuallyCreator && !isActuallyAdmin && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleNavigation('/followers')}
                      className="flex-1 bg-white/20 backdrop-blur rounded-lg px-3 py-2 hover:bg-white/30 transition-all duration-200 text-left"
                    >
                      <p className="text-xs opacity-90">Followers</p>
                      <p className="font-bold text-lg">{stats.followersCount}</p>
                    </button>
                    <button
                      onClick={() => handleNavigation('/subscribers')}
                      className="flex-1 bg-white/20 backdrop-blur rounded-lg px-3 py-2 hover:bg-white/30 transition-all duration-200 text-left"
                    >
                      <p className="text-xs opacity-90">Subscribers</p>
                      <p className="font-bold text-lg">{stats.subscribersCount}</p>
                    </button>
                  </div>
                )}
              </div>

              {/* Navigation Content */}
              <div className="p-3">
                {/* Admin gets simplified single column layout */}
                {isActuallyAdmin ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      {/* Theme Toggle */}
                      <button
                        onClick={handleToggleTheme}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 text-gray-700 dark:text-gray-300"
                      >
                        <div className="flex items-center gap-3">
                          {isDarkMode ? (
                            <MoonIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <SunIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                          )}
                          <span className="font-medium">
                            {isDarkMode ? 'Dark Mode' : 'Light Mode'}
                          </span>
                        </div>
                        <ChevronRightIcon className="w-4 h-4 opacity-50" />
                      </button>
                      
                      {/* Sign Out */}
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          onSignOut();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 text-red-600 dark:text-red-400"
                      >
                        <ArrowRightOnRectangleIcon className="w-5 h-5" />
                        <span className="font-medium">Sign Out</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Normal navigation for non-admin users */
                  <div className={isActuallyCreator ? "grid grid-cols-2 gap-2" : "space-y-3"}>
                  {/* Left Column - Creator Tools (only shown for creators) */}
                  {isActuallyCreator && (
                  <div className="space-y-3 min-w-0">
                    <div className="px-2 py-1">
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Creator Tools</h3>
                    </div>
                    
                    {/* Go Live - Special Button */}
                    {(
                      <button
                        onClick={() => handleNavigation('/go-live-setup')}
                        className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-3 py-2.5 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                      >
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-white/20 rounded-lg">
                            <VideoCameraIcon className="w-5 h-5" />
                          </div>
                          <p className="font-semibold">Go Live</p>
                        </div>
                      </button>
                    )}
                    
                    {/* Creator Menu Items */}
                    <div className="space-y-1">
                      {[
                        { label: 'Dashboard', icon: HomeIcon, path: '/dashboard', color: 'text-purple-600 dark:text-purple-400' },
                        { label: 'Offers', icon: GiftIcon, onClick: () => { setShowOfferModal(true); setIsOpen(false); }, color: 'text-pink-600 dark:text-pink-400' },
                        { label: 'Schedule', icon: CalendarIcon, path: '/schedule', color: 'text-indigo-600 dark:text-indigo-400' },
                        { label: 'Calls', icon: PhoneIcon, onClick: () => { navigate('/call-requests'); setIsOpen(false); }, color: 'text-blue-600 dark:text-blue-400' },
                        { label: 'Shop', icon: ShoppingBagIcon, path: '/shop', color: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'Pricing Rates', icon: CurrencyDollarIcon, onClick: () => { setShowPricingRatesModal(true); setIsOpen(false); }, color: 'text-green-600 dark:text-green-400' }
                      ].map((item) => {
                        const Icon = item.icon;
                        const isActive = currentPath === item.path;
                        
                        return (
                          <button
                            key={item.path || item.label}
                            onClick={() => {
                              if (item.action) {
                                item.action();
                                setIsOpen(false);
                              } else if (item.onClick) {
                                item.onClick();
                              } else {
                                handleNavigation(item.path);
                              }
                            }}
                            className={`
                              w-full flex items-center gap-2 px-2 py-2 rounded-lg
                              transition-all duration-200 group
                              ${isActive
                                ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }
                            `}
                          >
                            <Icon className={`w-5 h-5 ${item.color}`} />
                            <span className="font-medium">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  )}
                  
                  {/* Right Column - General & Settings (for Creator) or Main Column (for Fan) */}
                  <div className="space-y-3 min-w-0">
                    <div className="px-2 py-1">
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{isActuallyCreator ? 'Navigation' : 'Menu'}</h3>
                    </div>
                    
                    {/* General Menu Items */}
                    <div className="space-y-1">
                      {[
                        { label: 'Explore', icon: MagnifyingGlassIcon, path: '/explore', color: 'text-purple-600 dark:text-purple-400' },
                        { label: 'TV', icon: TvIcon, path: '/tv', color: 'text-pink-600 dark:text-pink-400' },
                        { label: 'Classes', icon: StarIcon, path: '/classes', color: 'text-green-600 dark:text-green-400' },
                        { label: 'Messages', icon: ChatBubbleLeftRightIcon, path: '/messages', color: 'text-blue-600 dark:text-blue-400' },
                        { label: 'Collections', icon: FolderIcon, path: '/collections', color: 'text-orange-600 dark:text-orange-400' },
                        ...(isActuallyCreator ? [
                          { label: 'Wallet', icon: WalletIcon, path: '/wallet', color: 'text-yellow-600 dark:text-yellow-400' }
                        ] : [])
                      ].map((item) => {
                        const Icon = item.icon;
                        const isActive = currentPath === item.path;
                        
                        return (
                          <button
                            key={item.path}
                            onClick={() => handleNavigation(item.path)}
                            className={`
                              w-full flex items-center justify-between px-2 py-2 rounded-lg
                              transition-all duration-200 group
                              ${isActive 
                                ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' 
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }
                            `}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className={`w-5 h-5 ${item.color}`} />
                              <span className="font-medium">{item.label}</span>
                            </div>
                            {item.badge && (
                              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                                {item.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    
                    
                    {/* Settings Section */}
                    <div className="px-2 py-1 mt-3">
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Settings</h3>
                    </div>
                    <div className="space-y-1">
                      {[
                        { label: 'Edit Profile', icon: UserCircleIcon, path: '/profile', color: 'text-gray-600 dark:text-gray-400' },
                        { label: isDarkMode ? 'Light Mode' : 'Dark Mode', icon: isDarkMode ? SunIcon : MoonIcon, onClick: handleToggleTheme, color: 'text-gray-600 dark:text-gray-400', isToggle: true }
                      ].filter(Boolean).map((item) => {
                        const Icon = item.icon;
                        
                        return (
                          <button
                            key={item.path || item.label}
                            onClick={() => {
                              if (item.action) {
                                item.action();
                                setIsOpen(false);
                              } else if (item.onClick) {
                                item.onClick();
                                if (!item.isToggle) setIsOpen(false);
                              } else {
                                handleNavigation(item.path);
                              }
                            }}
                            className="
                              w-full flex items-center gap-2 px-2 py-2 rounded-lg
                              hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300
                              transition-all duration-200 group
                            "
                          >
                            <Icon className={`w-5 h-5 ${item.color}`} />
                            <span className="font-medium">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                )}
                
                {/* Bottom Section - Sign Out (only for non-admin users) */}
                {!isActuallyAdmin && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onSignOut();
                    }}
                    className="
                      w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg
                      bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30
                      text-red-600 dark:text-red-400 font-medium
                      transition-all duration-200 group
                    "
                  >
                    <ArrowRightOnRectangleIcon className="w-5 h-5" />
                    <span>Sign Out</span>
                  </button>
                </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Pricing Rates Modal */}
      <PricingRatesModal
        isOpen={showPricingRatesModal}
        onClose={() => setShowPricingRatesModal(false)}
        isCreator={isActuallyCreator}
      />

      {/* Offer Modal */}
      <Modal
        isOpen={showOfferModal}
        onClose={() => {
          setShowOfferModal(false);
          setOfferData({
            title: '',
            description: '',
            category: 'General',
            priceTokens: '',
            deliveryTime: '24 hours',
            maxQuantity: ''
          });
        }}
        title="Create New Offer"
      >
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Offer Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={offerData.title}
              onChange={(e) => setOfferData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              placeholder="e.g., Personalized Video Message"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={offerData.description}
              onChange={(e) => setOfferData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              rows={4}
              placeholder="Describe what you're offering..."
            />
          </div>

          {/* Token Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Token Price <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={offerData.priceTokens}
              onChange={(e) => setOfferData(prev => ({ ...prev, priceTokens: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              placeholder="Enter token amount"
              min="1"
            />
          </div>

          {/* Delivery Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Delivery Time
            </label>
            <select
              value={offerData.deliveryTime}
              onChange={(e) => setOfferData(prev => ({ ...prev, deliveryTime: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="1 hour">1 hour</option>
              <option value="6 hours">6 hours</option>
              <option value="12 hours">12 hours</option>
              <option value="24 hours">24 hours</option>
              <option value="2 days">2 days</option>
              <option value="3 days">3 days</option>
              <option value="1 week">1 week</option>
            </select>
          </div>

          {/* Max Quantity (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Max Orders (Optional)
            </label>
            <input
              type="number"
              value={offerData.maxQuantity}
              onChange={(e) => setOfferData(prev => ({ ...prev, maxQuantity: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              placeholder="Leave empty for unlimited"
              min="1"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowOfferModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Handle offer creation here
                console.log('Creating offer:', offerData);
                setShowOfferModal(false);
                // You can add API call here to actually create the offer
              }}
              disabled={!offerData.title || !offerData.description || !offerData.priceTokens}
            >
              Create Offer
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default ProfileDropdown;