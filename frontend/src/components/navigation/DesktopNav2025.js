import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { 
  BellIcon, 
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  SparklesIcon,
  CommandLineIcon,
  ChartBarIcon,
  VideoCameraIcon,
  RocketLaunchIcon,
  FireIcon,
  BoltIcon,
  ArrowTrendingUpIcon,
  CurrencyDollarIcon,
  ChatBubbleLeftEllipsisIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  FolderOpenIcon,
  HomeIcon,
  WalletIcon,
  GlobeAltIcon,
  AdjustmentsHorizontalIcon,
  BeakerIcon,
  ShieldCheckIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  QuestionMarkCircleIcon,
  ArrowPathIcon,
  MoonIcon,
  SunIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline';
import { BellIcon as BellSolidIcon, HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { useNavigation } from '../../contexts/NavigationContext';
import { getDesktopMenuItems } from '../../config/navSchema';
import NotificationDropdown from '../NotificationDropdown';
import ProfileDropdown from '../ProfileDropdown';
import useHybridStore from '../../stores/useHybridStore';
import toast from 'react-hot-toast';

const DesktopNav2025 = ({ user, onLogout, onShowGoLive }) => {
  const { activePath, onNavigate, role, badges = { notifications: 0 }, tokenBalance } = useNavigation();
  const storeTokenBalance = useHybridStore((state) => state.tokenBalance);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showCreatorMenu, setShowCreatorMenu] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [liveViewers, setLiveViewers] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const searchRef = useRef(null);
  const { scrollY } = useScroll();
  const navOpacity = useTransform(scrollY, [0, 100], [0.95, 0.98]);
  const navBlur = useTransform(scrollY, [0, 100], [15, 25]);

  // Use store token balance if context doesn't have it
  const effectiveTokenBalance = tokenBalance !== undefined ? tokenBalance : storeTokenBalance;

  const navItems = getDesktopMenuItems(role);
  const mainNavItems = navItems.filter(item => {
    // Main navigation items - add analytics for creators
    const allowedItems = role === 'creator'
      ? ['home', 'explore', 'analytics', 'messages']
      : ['home', 'explore', 'messages'];
    return allowedItems.includes(item.id);
  });

  // Debug token balance
  console.log('🔍 DesktopNav2025 Debug:', {
    role,
    contextTokenBalance: tokenBalance,
    storeTokenBalance,
    effectiveTokenBalance,
    hasTokenBalance: effectiveTokenBalance !== undefined,
    tokenType: typeof effectiveTokenBalance,
    allNavItems: navItems.map(i => i.id),
    mainNavItems: mainNavItems.map(i => ({ id: i.id, label: i.label })),
    hasWalletItem: mainNavItems.some(i => i.id === 'wallet')
  });
  const creatorItems = navItems.filter(item =>
    ['dashboard', 'earnings', 'content', 'schedule'].includes(item.id)  // Removed analytics from here
  );

  // Mock live viewer count animation and fetch token balance if needed
  useEffect(() => {
    // Fetch token balance if it's not loaded
    if (effectiveTokenBalance === undefined && user) {
      console.log('🔄 Token balance undefined, triggering fetch...');
      // Trigger a token balance fetch through the API
      const fetchBalance = async () => {
        try {
          const { data: { session } } = await (await import('../../config/supabase')).supabase.auth.getSession();
          if (session?.access_token) {
            const response = await fetch(
              `${import.meta.env.VITE_BACKEND_URL}/api/tokens/balance`,
              {
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
              }
            );
            if (response.ok) {
              const data = await response.json();
              console.log('✅ Token balance fetched:', data.balance);
              // Update the store with the fetched balance
              useHybridStore.getState().setTokenBalance(data.balance || 0);
            }
          }
        } catch (error) {
          console.error('Error fetching token balance:', error);
        }
      };
      fetchBalance();
    }
    
    if (role === 'creator') {
      const interval = setInterval(() => {
        setLiveViewers(prev => Math.max(0, prev + Math.floor(Math.random() * 10 - 3)));
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [role, effectiveTokenBalance, user]);

  // Scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Command palette shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // AI-powered search suggestions
  useEffect(() => {
    if (searchQuery.length > 2) {
      // Mock AI suggestions
      const suggestions = [
        { type: 'creator', text: `Top creators matching "${searchQuery}"`, icon: UserGroupIcon },
        { type: 'stream', text: `Live streams about ${searchQuery}`, icon: VideoCameraIcon },
        { type: 'trending', text: `Trending: ${searchQuery} content`, icon: FireIcon }
      ];
      setAiSuggestions(suggestions);
    } else {
      setAiSuggestions([]);
    }
  }, [searchQuery]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onNavigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
      setSearchFocused(false);
    }
  };

  const quickActions = [
    { id: 'dashboard', label: 'Dashboard', icon: ChartBarIcon, path: '/dashboard', color: 'from-blue-500 to-cyan-500' },
    { id: 'earnings', label: 'Earnings', icon: CurrencyDollarIcon, path: '/earnings', color: 'from-green-500 to-emerald-500' },
    { id: 'content', label: 'Content', icon: FolderOpenIcon, path: '/content', color: 'from-orange-500 to-red-500' },
    { id: 'schedule', label: 'Schedule', icon: CalendarDaysIcon, path: '/schedule', color: 'from-purple-500 to-indigo-500' }
  ];

  return (
    <>
      <motion.nav 
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
          scrolled ? 'shadow-2xl' : 'shadow-lg'
        }`}
        style={{
          backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: `blur(${scrolled ? '25px' : '15px'}) saturate(180%)`,
          WebkitBackdropFilter: `blur(${scrolled ? '25px' : '15px'}) saturate(180%)`,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Left Section - Logo & Main Nav */}
            <div className="flex items-center space-x-8">
              {/* Enhanced Logo with Animation */}
              <motion.div
                className="flex items-center cursor-pointer group"
                onClick={() => onNavigate('/')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="relative">
                  <img
                    src={document.documentElement.classList.contains('dark') ? '/digis-logo-white.png' : '/digis-logo-black.png'}
                    alt="Digis"
                    className="h-8 w-auto object-contain"
                  />
                  {role === 'creator' && (
                    <span className="absolute -top-2 -right-8 px-2 py-0.5 text-[10px] font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-full">
                      PRO
                    </span>
                  )}
                </div>
              </motion.div>

              {/* Main Navigation with Hover Effects */}
              <div className="hidden lg:flex items-center space-x-1">
                {/* Always show token balance for debugging */}
                {role === 'creator' && (
                  <div className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-lg mr-2">
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                      Tokens: {typeof effectiveTokenBalance === 'number' ? effectiveTokenBalance.toLocaleString() : 'Loading...'}
                    </span>
                  </div>
                )}
                
                {mainNavItems.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = activePath === item.path;

                  return (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => item.path && onNavigate(item.path)}
                      className="relative group"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div className={`
                        relative px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300
                        ${isActive 
                          ? 'text-white' 
                          : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                        }
                      `}>
                        {/* Active Background Gradient */}
                        {isActive && (
                          <motion.div
                            layoutId="activeNav"
                            className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl"
                            initial={false}
                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          />
                        )}
                        
                        {/* Hover Background */}
                        {!isActive && (
                          <div className="absolute inset-0 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        )}
                        
                        <div className="relative flex items-center justify-center">
                          <Icon className="w-6 h-6" />

                          {/* Show token count for wallet - visible for all users */}
                          {item.id === 'wallet' && effectiveTokenBalance !== undefined && (
                            <motion.span
                              className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-full shadow-sm min-w-[20px] text-center"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500 }}
                            >
                              {effectiveTokenBalance > 999 ? '999+' : effectiveTokenBalance}
                            </motion.span>
                          )}
                          {item.id === 'wallet' && (
                            console.log('💰 Wallet item render:', { 
                              itemId: item.id, 
                              role, 
                              effectiveTokenBalance, 
                              tokenType: typeof effectiveTokenBalance,
                              isWalletItem: true
                            }) || null
                          )}
                          
                          {/* Badge with Pulse Animation */}
                          {item.badgeKey && badges[item.badgeKey] > 0 && (
                            <motion.span 
                              className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500 }}
                            >
                              <motion.div
                                className="absolute inset-0 bg-red-500 rounded-full"
                                animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                              />
                              <span className="relative z-10">{badges[item.badgeKey]}</span>
                            </motion.span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}

                {/* Go Live Button - icon only */}
                {onShowGoLive && (
                  <motion.button
                    onClick={onShowGoLive}
                    className="relative group"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="relative px-4 py-2.5 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl text-white shadow-lg hover:shadow-xl transition-all duration-300">
                      <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-pink-600 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <VideoCameraIcon className="w-6 h-6 relative" />
                    </div>
                  </motion.button>
                )}

                {/* Creator Hub Dropdown with Glass Effect */}
                {role === 'creator' && creatorItems.length > 0 && (
                  <div className="relative">
                    <motion.button
                      onClick={() => setShowCreatorMenu(!showCreatorMenu)}
                      className="relative group px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-300"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="relative flex items-center space-x-2">
                        <RocketLaunchIcon className="w-5 h-5" />
                        <span>Creator Hub</span>
                        <ChevronDownIcon className={`w-4 h-4 transition-transform ${showCreatorMenu ? 'rotate-180' : ''}`} />
                      </div>
                    </motion.button>
                    
                    <AnimatePresence>
                      {showCreatorMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className="absolute top-full left-0 mt-2 w-64 p-2 rounded-2xl overflow-hidden"
                          style={{
                            backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(20px) saturate(180%)',
                            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)'
                          }}
                        >
                          {/* Quick Actions Grid */}
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            {quickActions.map((action) => {
                              const ActionIcon = action.icon;
                              return (
                                <motion.button
                                  key={action.id}
                                  onClick={() => {
                                    if (action.action) action.action();
                                    if (action.path) onNavigate(action.path);
                                    setShowCreatorMenu(false);
                                  }}
                                  className="relative group p-3 rounded-xl overflow-hidden"
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                >
                                  <div className={`absolute inset-0 bg-gradient-to-r ${action.color} opacity-10 group-hover:opacity-20 transition-opacity`} />
                                  <div className="relative flex flex-col items-center space-y-1">
                                    <ActionIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{action.label}</span>
                                  </div>
                                </motion.button>
                              );
                            })}
                          </div>
                          
                          <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
                          
                          {/* Creator Menu Items */}
                          {creatorItems.map((item, index) => {
                            const Icon = item.icon;
                            return (
                              <motion.button
                                key={item.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => {
                                  item.path && onNavigate(item.path);
                                  setShowCreatorMenu(false);
                                }}
                                className="w-full px-3 py-2.5 rounded-xl text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-between group"
                              >
                                <div className="flex items-center space-x-3">
                                  <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                                </div>
                                <ChevronRightIcon className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </motion.button>
                            );
                          })}
                          
                          {/* Live Stats */}
                          {liveViewers > 0 && (
                            <div className="mt-2 p-3 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-xl">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Live Viewers</span>
                                <div className="flex items-center space-x-1">
                                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                  <span className="text-sm font-bold text-red-600 dark:text-red-400">{liveViewers}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right Section - Actions & Profile */}
            <div className="flex items-center space-x-4">
              {/* Wallet Button - Icon and token count only */}
              <motion.button
                onClick={() => onNavigate('/wallet')}
                className="relative group"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="relative flex items-center space-x-2 px-3 py-2.5 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl text-sm font-medium transition-all duration-300">
                  <WalletIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  <span className="font-bold text-gray-900 dark:text-gray-100">
                    {typeof effectiveTokenBalance === 'number' ? effectiveTokenBalance.toLocaleString() : '0'}
                  </span>
                </div>
              </motion.button>


              {/* Theme Toggle removed - moved to profile dropdown */}

              {/* Profile with Status Indicator */}
              <ProfileDropdown 
                user={user}
                profile={user}
                isCreator={role === 'creator'}
                isAdmin={role === 'admin'}
                onSignOut={onLogout}
                tokenBalance={effectiveTokenBalance}
                currentPath={activePath}
                setCurrentView={onNavigate}
                onShowGoLive={onShowGoLive}
              />
            </div>
          </div>
        </div>

        {/* Progress Bar for Loading States */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-600 to-pink-600"
          initial={{ scaleX: 0, transformOrigin: 'left' }}
          animate={{ scaleX: 0 }}
          transition={{ duration: 0.3 }}
        />
      </motion.nav>

      {/* Command Palette Modal */}
      <AnimatePresence>
        {showCommandPalette && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-start justify-center pt-20 px-4"
            onClick={() => setShowCommandPalette(false)}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, y: -20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: -20 }}
              className="relative w-full max-w-2xl p-4 rounded-2xl"
              style={{
                backgroundColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center space-x-3 mb-4">
                <CommandLineIcon className="w-5 h-5 text-purple-600" />
                <input
                  type="text"
                  placeholder="Type a command or search..."
                  className="flex-1 bg-transparent text-lg font-medium text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none"
                  autoFocus
                />
                <kbd className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-md text-gray-600 dark:text-gray-400">ESC</kbd>
              </div>
              {/* Command suggestions would go here */}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DesktopNav2025;