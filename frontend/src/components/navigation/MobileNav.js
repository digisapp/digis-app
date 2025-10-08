import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  VideoCameraIcon,
  SparklesIcon,
  UserCircleIcon,
  PencilSquareIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ChevronRightIcon,
  ShoppingBagIcon,
  TvIcon,
  StarIcon,
  HeartIcon,
  TagIcon,
  CurrencyDollarIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';
import { useNavigation } from '../../contexts/NavigationContext';
import { getMobileBottomItems, getMobileCenterAction } from '../../config/navSchema';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import WalletQuickView from '../WalletQuickView';
import TokenPurchase from '../TokenPurchase';
import useAuthStore from '../../stores/useAuthStore';
import toast from 'react-hot-toast';

const MobileNav = ({ user, onShowGoLive, onLogout }) => {
  // Use AuthStore as single source of truth for role
  const role = useAuthStore((state) => state.role || 'fan');
  const authUser = useAuthStore((state) => state.user);

  const { activePath, onNavigate, badges, tokenBalance } = useNavigation();
  const [hoveredItem, setHoveredItem] = useState(null);
  const [lastTap, setLastTap] = useState({});
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPricingRatesModal, setShowPricingRatesModal] = useState(false);
  const [showOffersModal, setShowOffersModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showTokenPurchase, setShowTokenPurchase] = useState(false);
  const controls = useAnimation();
  const navRef = useRef(null);
  const menuRef = useRef(null);
  
  // Always visible - removed scroll-based hiding for better UX
  const isVisible = true;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) &&
          !event.target.closest('.profile-button')) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showProfileMenu]);

  // Close TokenPurchase modal when navigating to other pages
  useEffect(() => {
    setShowTokenPurchase(false);
    setShowWalletModal(false);
  }, [activePath]);

  // Helper function to handle navigation and close menu
  const handleMenuNavigate = (path) => {
    setShowProfileMenu(false);
    // Small delay to allow the menu animation to start before navigation
    requestAnimationFrame(() => {
      onNavigate(path);
    });
  };

  const bottomItems = getMobileBottomItems(role);
  const centerAction = getMobileCenterAction(role);
  const currentIndex = bottomItems.findIndex(item => item.path === activePath);
  
  // Add floating particle effect on active change
  useEffect(() => {
    controls.start({
      scale: [1, 1.02, 1],
      transition: { duration: 0.3 }
    });
  }, [activePath, controls]);
  
  // Add swipe gesture navigation
  useSwipeGesture({
    element: navRef.current,
    onSwipeLeft: () => {
      if (currentIndex < bottomItems.length - 1) {
        const nextItem = bottomItems[currentIndex + 1];
        if (nextItem?.path) {
          triggerHaptic('swipe');
          onNavigate(nextItem.path);
        }
      }
    },
    onSwipeRight: () => {
      if (currentIndex > 0) {
        const prevItem = bottomItems[currentIndex - 1];
        if (prevItem?.path) {
          triggerHaptic('swipe');
          onNavigate(prevItem.path);
        }
      }
    },
    threshold: 40,
    velocityThreshold: 0.2
  });
  
  
  console.log('MobileNav rendering:', { 
    user: !!user, 
    role, 
    bottomItems: bottomItems?.length,
    badges,
    activePath 
  });

  // Haptic-like animation trigger
  const triggerHaptic = (itemId) => {
    // Simulate haptic feedback with micro-animation
    setLastTap({ [itemId]: Date.now() });
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const getActiveScale = (isActive) => isActive ? 1.1 : 1;

  return (
    <>
      {/* Modern 2025 Tab Bar with Glassmorphism */}
      <motion.nav
        ref={navRef}
        animate={controls}
        className="fixed bottom-0 left-0 right-0 z-[100] mobile-nav-2025"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.85) 30%, rgba(255,255,255,0.95) 100%)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderTop: '0.5px solid rgba(0,0,0,0.1)',
          boxShadow: '0 -10px 40px -10px rgba(0,0,0,0.1), inset 0 1px 0 0 rgba(255,255,255,0.5)'
        }}
        role="navigation"
        aria-label="Primary navigation"
      >
        {/* Animated gradient border */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 opacity-60 animate-gradient-x" />
        
        
        <div className="flex items-center justify-around h-[72px] px-4 relative w-full">
          {bottomItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activePath === item.path;

            // Special handling for profile button
            if (item.id === 'profile') {
              return (
                <motion.button
                  key={item.id}
                  onClick={() => {
                    triggerHaptic(item.id);
                    setShowProfileMenu(!showProfileMenu);
                  }}
                  className="profile-button relative flex flex-col items-center justify-center flex-1 py-2 px-1 touch-manipulation"
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.label}
                  whileTap={{ scale: 0.92 }}
                >
                  <motion.div
                    className="relative p-2"
                    animate={{
                      scale: showProfileMenu ? 1.1 : 1
                    }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  >
                    {user?.avatar_url || user?.profilePicture ? (
                      <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                        <img
                          src={user?.avatar_url || user?.profilePicture}
                          alt={user?.username || 'Profile'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <UserCircleIcon
                        className={`w-8 h-8 transition-all duration-300 ${
                          showProfileMenu
                            ? 'text-purple-600 dark:text-purple-400 drop-shadow-lg'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                        strokeWidth={showProfileMenu ? 2.5 : 2}
                      />
                    )}
                    {showProfileMenu && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-purple-600 rounded-full"
                      />
                    )}
                  </motion.div>
                  <motion.span
                    initial={false}
                    animate={{
                      opacity: isActive || hoveredItem === item.id ? 1 : 0,
                      y: isActive || hoveredItem === item.id ? 0 : 10
                    }}
                    transition={{ duration: 0.2 }}
                    className="absolute -bottom-1 text-[10px] font-medium text-purple-600 dark:text-purple-400"
                  >
                    Menu
                  </motion.span>
                </motion.button>
              );
            }

            return (
              <motion.button
                key={item.id}
                onClick={() => {
                  triggerHaptic(item.id);
                  // Special handling for wallet popup button (fans only)
                  if (item.id === 'wallet-popup') {
                    setShowWalletModal(true);
                  } else {
                    item.path && onNavigate(item.path);
                  }
                }}
                onHoverStart={() => setHoveredItem(item.id)}
                onHoverEnd={() => setHoveredItem(null)}
                className="relative flex flex-col items-center justify-center flex-1 py-2 px-1 touch-manipulation"
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
                whileTap={{ scale: 0.92 }}
                animate={{
                  y: isActive ? -2 : 0,
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                {/* Icon container without background */}
                <motion.div
                  className="relative p-2"
                  animate={{ 
                    scale: getActiveScale(isActive)
                  }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  <Icon
                    className={`w-7 h-7 transition-all duration-300 ${
                      isActive
                        ? 'text-purple-600 dark:text-purple-400 drop-shadow-lg'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </motion.div>
                
                {/* Modern Active Indicator with gradient */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute -bottom-1 h-[3px] rounded-full"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 48, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      style={{
                        background: 'linear-gradient(90deg, #a855f7 0%, #ec4899 50%, #a855f7 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'gradient-shift 3s ease infinite'
                      }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </AnimatePresence>
                
              </motion.button>
            );
          })}
        </div>
      </motion.nav>


      {/* Top Status Bar removed - not needed for this implementation */}

      {/* Profile Dropdown Menu */}
      {/* Backdrop to close menu when clicking outside */}
      {showProfileMenu && (
        <div
          className="fixed inset-0 z-[101]"
          onClick={() => setShowProfileMenu(false)}
        />
      )}

      <AnimatePresence mode="wait">
        {showProfileMenu && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed bottom-20 right-4 z-[102] w-72 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800"
            style={{
              marginBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
          >
            {/* User Profile Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="space-y-3">
                {/* Profile info */}
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center overflow-hidden">
                    {user?.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt="Profile"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = '<svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';
                        }}
                      />
                    ) : (
                      <UserCircleIcon className="w-12 h-12 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {user?.username || user?.email?.split('@')[0] || 'User'}
                    </p>
                  </div>
                </div>

                {/* Profile URL - Copy button for creators only */}
                {(role === 'creator' || role === 'admin') && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const username = authUser?.username || user?.username || user?.email?.split('@')[0] || 'creator';
                      const profileUrl = `https://digis.cc/${username}`;

                      try {
                        if (navigator.clipboard && window.isSecureContext) {
                          await navigator.clipboard.writeText(profileUrl);
                          // Simple visual feedback
                          const button = e.currentTarget;
                          const originalText = button.querySelector('.copy-text').textContent;
                          button.querySelector('.copy-text').textContent = 'Copied!';
                          setTimeout(() => {
                            if (button.querySelector('.copy-text')) {
                              button.querySelector('.copy-text').textContent = originalText;
                            }
                          }, 2000);
                        } else {
                          // Fallback for older browsers
                          const textArea = document.createElement('textarea');
                          textArea.value = profileUrl;
                          textArea.style.position = 'fixed';
                          textArea.style.left = '-999999px';
                          document.body.appendChild(textArea);
                          textArea.select();
                          document.execCommand('copy');
                          document.body.removeChild(textArea);
                          // Visual feedback
                          const button = e.currentTarget;
                          const originalText = button.querySelector('.copy-text').textContent;
                          button.querySelector('.copy-text').textContent = 'Copied!';
                          setTimeout(() => {
                            if (button.querySelector('.copy-text')) {
                              button.querySelector('.copy-text').textContent = originalText;
                            }
                          }, 2000);
                        }
                      } catch (err) {
                        console.error('Failed to copy:', err);
                      }
                    }}
                    className="w-full flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <ClipboardDocumentIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                        digis.cc/{user?.username || user?.email?.split('@')[0] || 'creator'}
                      </span>
                    </div>
                    <span className="copy-text text-xs text-purple-600 dark:text-purple-400 font-medium ml-2 flex-shrink-0">Copy</span>
                  </button>
                )}
              </div>
            </div>

            {/* Menu Items - Different for Creator vs Fan */}
            <div className="py-2">
              <button
                onClick={() => handleMenuNavigate('/settings')}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <PencilSquareIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <span className="text-gray-900 dark:text-white">Edit Profile</span>
              </button>

              {/* Creator-specific menu items */}
              {(role === 'creator' || role === 'admin') ? (
                <>
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      setShowOffersModal(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <TagIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-900 dark:text-white">Offers</span>
                  </button>

                  <button
                    onClick={() => handleMenuNavigate('/shop')}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <ShoppingBagIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-900 dark:text-white">Shop</span>
                  </button>

                  <button
                    onClick={() => handleMenuNavigate('/call-requests')}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <VideoCameraIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-900 dark:text-white">Calls</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      setShowPricingRatesModal(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <CurrencyDollarIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-900 dark:text-white">Pricing Rates</span>
                  </button>

                  <button
                    onClick={() => handleMenuNavigate('/tv')}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <TvIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-900 dark:text-white">TV</span>
                  </button>

                  <button
                    onClick={() => handleMenuNavigate('/classes')}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <StarIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-900 dark:text-white">Classes</span>
                  </button>

                  <button
                    onClick={() => handleMenuNavigate('/content')}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <HeartIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-900 dark:text-white">My Content</span>
                  </button>
                </>
              ) : (
                // Fan-specific menu items
                <>
                  <button
                    onClick={() => handleMenuNavigate('/tv')}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <TvIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-900 dark:text-white">TV</span>
                  </button>

                  <button
                    onClick={() => handleMenuNavigate('/classes')}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <StarIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-900 dark:text-white">Classes</span>
                  </button>

                  <button
                    onClick={() => handleMenuNavigate('/collections')}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <HeartIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-900 dark:text-white">Collections</span>
                  </button>
                </>
              )}

              <div className="my-2 border-t border-gray-200 dark:border-gray-800" />

              <button
                onClick={async () => {
                  console.log('Sign Out clicked');
                  setShowProfileMenu(false);

                  try {
                    if (onLogout && typeof onLogout === 'function') {
                      console.log('Calling onLogout function');
                      await onLogout();
                    } else {
                      console.log('onLogout not available, using fallback');
                      // Fallback: clear local storage and reload
                      localStorage.clear();
                      sessionStorage.clear();
                      window.location.href = '/';
                    }
                  } catch (error) {
                    console.error('Error during logout:', error);
                    // Force logout on error
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = '/';
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pricing Rates Modal */}
      {showPricingRatesModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPricingRatesModal(false)}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl z-[201] max-h-[85vh] overflow-hidden"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Pricing Rates</h2>
                <button
                  onClick={() => setShowPricingRatesModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 pb-8 overflow-y-auto">
              <div className="space-y-4">
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Video Call Rate</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">50</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">tokens/minute</span>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Voice Call Rate</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">25</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">tokens/minute</span>
                  </div>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Message Rate</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-green-600 dark:text-green-400">5</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">tokens/message</span>
                  </div>
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Live Stream</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">Free</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">with tips enabled</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-semibold">Note:</span> Rates are subject to change based on demand and special events.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Offers Modal */}
      {showOffersModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowOffersModal(false)}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl z-[201] max-h-[85vh] overflow-hidden"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Special Offers</h2>
                <button
                  onClick={() => setShowOffersModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 pb-8 overflow-y-auto">
              <div className="space-y-4">
                {/* Bundle Deal */}
                <div className="border-2 border-purple-500 rounded-xl p-4 relative">
                  <div className="absolute -top-3 left-4 bg-white dark:bg-gray-900 px-2">
                    <span className="text-xs font-bold text-purple-600">BEST VALUE</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Ultimate Bundle</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Get 60 minutes of video calls + 100 messages
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-bold text-purple-600">2500</span>
                      <span className="text-sm text-gray-500 line-through ml-2">3500</span>
                    </div>
                    <span className="text-sm font-semibold text-green-600">Save 30%</span>
                  </div>
                </div>

                {/* Weekly Special */}
                <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl p-4 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Weekly VIP Access</h3>
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">LIMITED</span>
                  </div>
                  <p className="text-sm opacity-90 mb-3">
                    Unlimited messages + priority booking for 7 days
                  </p>
                  <div className="text-2xl font-bold">5000 tokens</div>
                </div>

                {/* First Timer Offer */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">First Timer Special</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    New fans get 20% off first video call
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">40</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">tokens/minute</span>
                    <span className="text-xs text-gray-500 line-through ml-2">50</span>
                  </div>
                </div>

                {/* Group Session */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Group Sessions</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Join group video calls at discounted rates
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">15</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">tokens/minute per person</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Wallet Quick View Modal */}
      <WalletQuickView
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        user={user}
        tokenBalance={tokenBalance}
        onTokenPurchase={() => {
          setShowWalletModal(false);
          setShowTokenPurchase(true);
        }}
      />

      {/* Token Purchase Modal */}
      {showTokenPurchase && (
        <TokenPurchase
          user={user}
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

export default MobileNav;