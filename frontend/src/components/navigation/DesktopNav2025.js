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
import WalletQuickView from '../WalletQuickView';
import ImprovedTokenPurchase from '../ImprovedTokenPurchase';
import useHybridStore from '../../stores/useHybridStore';
import useAuthStore from '../../stores/useAuthStore';
import useStore from '../../stores/useStore';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { preload } from '../../lib/preload';

const DesktopNav2025 = ({ onLogout, onShowGoLive }) => {
  // ✅ CRITICAL FIX: Declare ALL hooks BEFORE any early returns (fixes React error #310)

  // Mount beacon for diagnostics
  useEffect(() => {
    console.info("[MOUNT] DesktopNav2025.js");
  }, []);

  // Use AuthContext as SINGLE SOURCE OF TRUTH
  const { currentUser, isCreator, isAdmin, role, roleResolved } = useAuth();
  const { activePath, onNavigate, badges = { notifications: 0 }, tokenBalance } = useNavigation();
  const storeTokenBalance = useHybridStore((state) => state.tokenBalance);
  const theme = useStore((state) => state.theme);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showCreatorMenu, setShowCreatorMenu] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showTokenPurchase, setShowTokenPurchase] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [liveViewers, setLiveViewers] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const searchRef = useRef(null);
  const { scrollY } = useScroll();
  const navOpacity = useTransform(scrollY, [0, 100], [0.95, 0.98]);
  const navBlur = useTransform(scrollY, [0, 100], [15, 25]);

  // Debug log for QA (can be removed in production)
  if (process.env.NODE_ENV !== 'production') {
    console.log('🧭 DesktopNav Menu role:', role, {
      isCreator,
      isAdmin,
      roleResolved
    });
  }

  // ✅ NOW safe to do early return AFTER all hooks are declared
  if (!currentUser) return null;

  // Use store token balance if context doesn't have it
  const effectiveTokenBalance = tokenBalance !== undefined ? tokenBalance : storeTokenBalance;

  const navItems = getDesktopMenuItems(role);
  const mainNavItems = navItems.filter(item => {
    // Main navigation items - wallet is NOT included here (it's a button on the right)
    const allowedItems = role === 'creator'
      ? ['dashboard', 'explore', 'messages']
      : ['home', 'explore', 'messages', 'tv', 'classes'];
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

  // Guard: Don't render until role is resolved to prevent flicker
  if (!roleResolved) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-[100] h-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg shadow-lg">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="flex items-center space-x-4">
            <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-11 w-11 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
          </div>
        </div>
      </nav>
    );
  }

  // Mock live viewer count animation and fetch token balance if needed
  useEffect(() => {
    const ac = new AbortController();
    let mounted = true;

    // Fetch token balance if it's not loaded
    if (effectiveTokenBalance === undefined && currentUser) {
      console.log('🔄 Token balance undefined, triggering fetch...');
      // Trigger a token balance fetch through the API
      const fetchBalance = async () => {
        try {
          const { data: { session } } = await (await import('../../config/supabase')).supabase.auth.getSession();
          if (!mounted) return; // Component unmounted during async import

          if (session?.access_token) {
            const response = await fetch(
              `${import.meta.env.VITE_BACKEND_URL}/api/tokens/balance`,
              {
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
                signal: ac.signal
              }
            );
            if (!mounted) return; // Component unmounted during fetch

            if (response.ok) {
              const data = await response.json();
              console.log('✅ Token balance fetched:', data.balance);
              // Update the store with the fetched balance
              if (mounted) {
                useHybridStore.getState().setTokenBalance(data.balance || 0);
              }
            }
          }
        } catch (error) {
          // Ignore abort errors
          if (error.name === 'AbortError') return;
          console.error('Error fetching token balance:', error);
        }
      };
      fetchBalance();
    }

    if (role === 'creator') {
      const interval = setInterval(() => {
        if (mounted) {
          setLiveViewers(prev => Math.max(0, prev + Math.floor(Math.random() * 10 - 3)));
        }
      }, 5000);
      return () => {
        mounted = false;
        ac.abort();
        clearInterval(interval);
      };
    }

    return () => {
      mounted = false;
      ac.abort();
    };
  }, [role, effectiveTokenBalance, currentUser, roleResolved]);

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

  // Map paths to their lazy-loaded components for preloading
  const preloadRouteMap = {
    '/dashboard': () => import('../pages/DashboardRouter'),
    '/explore': () => import('../pages/ExplorePage'),
    '/messages': () => import('../pages/MessagesPage'),
    '/tv': () => import('../pages/TVPage'),
    '/classes': () => import('../pages/ClassesPage'),
    '/wallet': () => import('../pages/WalletPage'),
    '/earnings': () => import('../pages/EarningsPage'),
    '/schedule': () => import('../pages/SchedulePage'),
    '/profile': () => import('../ImprovedProfile'),
    '/content': () => import('../pages/DashboardRouter'),
    '/settings': () => import('../Settings'),
  };

  // Preload a route on hover
  const handleRoutePreload = (path) => {
    const importFn = preloadRouteMap[path];
    if (importFn) {
      preload(importFn);
    }
  };

  return (
    <>
      <motion.nav 
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
          scrolled ? 'shadow-2xl' : 'shadow-lg'
        }`}
        style={{
          backgroundColor: theme === 'dark' ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
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
                onClick={() => {
                  // Navigate based on user role - wait for roleResolved
                  if (role === 'creator') {
                    onNavigate('/dashboard');
                  } else if (role === 'fan') {
                    onNavigate('/explore');
                  } else {
                    onNavigate('/');
                  }
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="relative">
                  <img
                    src={theme === 'dark' ? '/digis-logo-white.png' : '/digis-logo-black.png'}
                    alt="Digis"
                    className="h-8 w-auto object-contain"
                  />
                </div>
              </motion.div>

              {/* Main Navigation with Hover Effects */}
              <div className="hidden lg:flex items-center space-x-1">
                
                {mainNavItems.map((item, index) => {
                  const Icon = item.icon;
                  // Special case for home button for fans - it should be active on /explore
                  const isActive = item.id === 'home' && role === 'fan'
                    ? activePath === '/explore' || activePath === item.path
                    : activePath === item.path;

                  return (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => item.path && onNavigate(item.path)}
                      onMouseEnter={() => handleRoutePreload(item.path)}
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

                {/* Go Live Button - icon only (creators only) */}
                {onShowGoLive && role === 'creator' && (
                  <motion.button
                    onClick={onShowGoLive}
                    className="relative group p-3 rounded-xl text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <VideoCameraIcon className="w-6 h-6 relative" />
                  </motion.button>
                )}
              </div>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right Section - Actions & Profile */}
            <div className="flex items-center space-x-4">
              {/* Wallet Button - Opens full page for creators, dropdown for fans */}
              <motion.button
                onClick={() => {
                  if (role === 'creator') {
                    console.log("[Nav] Wallet → /wallet (creator)");
                    onNavigate('/wallet');
                  } else {
                    console.log("[Nav] Wallet → opening dropdown (fan)");
                    setShowWalletModal(true);
                  }
                }}
                onMouseEnter={() => role === 'creator' && handleRoutePreload('/wallet')}
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
                user={currentUser}
                profile={currentUser}
                isCreator={isCreator}
                isAdmin={isAdmin}
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

      {/* Wallet Quick View Modal */}
      <WalletQuickView
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        user={currentUser}
        tokenBalance={effectiveTokenBalance}
        onTokenPurchase={() => {
          setShowWalletModal(false);
          setShowTokenPurchase(true);
        }}
      />

      {/* Token Purchase Modal */}
      {showTokenPurchase && (
        <ImprovedTokenPurchase
          user={currentUser}
          isModal={true}
          onClose={() => setShowTokenPurchase(false)}
          onSuccess={() => {
            setShowTokenPurchase(false);
            toast.success('Tokens purchased successfully!');
          }}
        />
      )}
    </>
  );
};

export default DesktopNav2025;