import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  WalletIcon,
  UserIcon,
  VideoCameraIcon,
  CogIcon,
  Bars3Icon,
  XMarkIcon,
  ShoppingBagIcon,
  AcademicCapIcon,
  Squares2X2Icon,
  TvIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import EnhancedNotificationBell from './EnhancedNotificationBell';
import ThemeToggle from './ThemeToggle';

const ImprovedNavigation = ({ 
  currentView, 
  setCurrentView, 
  isCreator, 
  isAdmin, 
  tokenBalance, 
  user,
  isMobile = false 
}) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Navigation structure
  const navigation = {
    primary: isCreator ? [
      // Creator navigation order: Dashboard, Messages, Classes, TV, Explore, Connect
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: Squares2X2Icon,
        view: 'dashboard',
        alwaysShow: true
      },
      { 
        id: 'messages', 
        label: 'Messages', 
        icon: ChatBubbleLeftRightIcon, 
        view: 'messages',
        alwaysShow: true
      },
      { 
        id: 'classes', 
        label: 'Classes', 
        icon: AcademicCapIcon, 
        view: 'classes',
        alwaysShow: true
      },
      {
        id: 'tv',
        label: 'TV',
        icon: TvIcon,
        view: 'tv',
        alwaysShow: true
      },
      { 
        id: 'explore', 
        label: 'Explore', 
        icon: MagnifyingGlassIcon, 
        view: 'explore',
        alwaysShow: true
      },
      {
        id: 'connect',
        label: 'Connect',
        icon: UserGroupIcon,
        view: 'connect',
        alwaysShow: true
      }
    ] : [
      // Fan navigation order: TV, Explore, Messages, Classes
      {
        id: 'tv',
        label: 'TV',
        icon: TvIcon,
        view: 'tv',
        alwaysShow: true
      },
      { 
        id: 'explore', 
        label: 'Explore', 
        icon: MagnifyingGlassIcon, 
        view: 'explore',
        alwaysShow: true
      },
      { 
        id: 'messages', 
        label: 'Messages', 
        icon: ChatBubbleLeftRightIcon, 
        view: 'messages',
        alwaysShow: true
      },
      { 
        id: 'classes', 
        label: 'Classes', 
        icon: AcademicCapIcon, 
        view: 'classes',
        alwaysShow: true
      }
    ],
    user: [
      { 
        id: 'wallet', 
        label: 'Wallet', 
        icon: WalletIcon, 
        view: 'wallet',
        highlight: true,
        balance: tokenBalance
      },
      { 
        id: 'profile', 
        label: 'Profile', 
        icon: UserIcon, 
        view: 'profile'
      }
    ],
    creator: [],
  };

  // Add admin navigation if user is admin
  if (isAdmin) {
    navigation.creator.push({
      id: 'admin',
      label: 'Admin',
      icon: CogIcon,
      view: 'admin'
    });
  }


  const handleNavClick = (item) => {
    console.log('Navigation clicked:', item.label, 'view:', item.view);
    if (item.onClick) {
      item.onClick();
    } else if (item.view) {
      console.log('Setting current view to:', item.view);
      setCurrentView(item.view);
    }
    setShowMobileMenu(false);
  };

  const NavButton = ({ item, className = "" }) => {
    const Icon = item.icon;
    const isActive = currentView === item.view;
    
    return (
      <motion.button
        onClick={() => handleNavClick(item)}
        className={`
          relative px-3 py-2 rounded-xl font-medium text-sm transition-all duration-200 
          flex items-center gap-2 min-h-[44px] touch-manipulation
          focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
          ${isActive 
            ? 'bg-purple-500 text-white shadow-lg' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
          }
          ${item.highlight ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700' : ''}
          ${className}
        `}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        aria-label={`Navigate to ${item.label}${item.balance !== undefined ? `. Current balance: ${item.balance} tokens` : ''}`}
        aria-current={isActive ? 'page' : undefined}
        role={item.onClick ? 'button' : 'link'}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="whitespace-nowrap">{item.label}</span>
        {item.balance !== undefined && (
          <span className="ml-1 bg-white/20 px-2 py-1 rounded-full text-xs font-bold">
            {item.balance}
          </span>
        )}
        {isActive && (
          <motion.div
            className="absolute inset-0 bg-purple-500 rounded-xl -z-10"
            layoutId="activeNavButton"
            initial={false}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
      </motion.button>
    );
  };


  // Desktop Navigation
  const DesktopNav = () => (
    <nav className="flex items-center gap-2" role="navigation" aria-label="Main navigation">
      {/* Primary Navigation */}
      {navigation.primary.map((item) => {
        if (item.showFor && !item.showFor.includes(isCreator ? 'creator' : 'fan') && !item.alwaysShow) {
          return null;
        }
        return <NavButton key={item.id} item={item} />;
      })}

      {/* Creator-specific Navigation */}
      {isCreator && navigation.creator.map((item) => (
        <NavButton key={item.id} item={item} />
      ))}

    </nav>
  );

  // Mobile Navigation
  const MobileNav = () => (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setShowMobileMenu(!showMobileMenu)}
        className="lg:hidden p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Toggle mobile menu"
        aria-expanded={showMobileMenu}
      >
        {showMobileMenu ? (
          <XMarkIcon className="w-6 h-6" />
        ) : (
          <Bars3Icon className="w-6 h-6" />
        )}
      </button>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {showMobileMenu && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileMenu(false)}
            />
            <motion.div
              className="fixed top-0 right-0 h-full w-80 max-w-[80vw] bg-white dark:bg-gray-800 shadow-2xl z-50 lg:hidden"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Menu</h2>
                  <button
                    onClick={() => setShowMobileMenu(false)}
                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Close menu"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Mobile Menu Items */}
                <div className="space-y-2">
                  {/* Primary Items */}
                  {navigation.primary.map((item) => {
                    if (item.showFor && !item.showFor.includes(isCreator ? 'creator' : 'fan') && !item.alwaysShow) {
                      return null;
                    }
                    return <NavButton key={item.id} item={item} className="w-full justify-start" />;
                  })}

                  {/* User Items */}
                  {navigation.user.map((item) => (
                    <NavButton key={item.id} item={item} className="w-full justify-start" />
                  ))}

                  {/* Creator Items */}
                  {isCreator && navigation.creator.map((item) => (
                    <NavButton key={item.id} item={item} className="w-full justify-start" />
                  ))}

                  {/* Profile Item */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                    <NavButton 
                      item={{ id: 'profile', label: 'Profile', icon: UserIcon, view: 'profile' }} 
                      className="w-full justify-start" 
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );

  return (
    <div className="flex items-center gap-4">
      {/* Desktop Navigation */}
      <div className="hidden lg:flex">
        <DesktopNav />
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <MobileNav />
      </div>

      {/* Right Side Items (always visible) */}
      <div className="flex items-center gap-4 ml-auto">
        <EnhancedNotificationBell />
        
        {/* Wallet Button - Mobile Optimized */}
        <NavButton 
          item={navigation.user[0]} 
          className="hidden sm:flex"
        />
        
        {/* Mobile Wallet Button */}
        <button
          onClick={() => setCurrentView('wallet')}
          className="sm:hidden bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-2 rounded-xl font-medium text-sm min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          💰
        </button>

        <ThemeToggle />
        
        {/* Dev Mode Toggle - Only in development */}
        {process.env.NODE_ENV === 'development' && (
          <motion.button
            onClick={() => {
              const current = localStorage.getItem('devModeCreator') === 'true';
              localStorage.setItem('devModeCreator', (!current).toString());
              window.location.reload();
            }}
            className="p-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-600 transition-all min-h-[44px] px-3 flex items-center justify-center text-xs font-medium"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Toggle Creator Mode"
          >
            {localStorage.getItem('devModeCreator') === 'true' ? 'Creator' : 'Fan'}
          </motion.button>
        )}
        
        {/* Profile Button */}
        <motion.button
          onClick={() => setCurrentView('profile')}
          className="p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Profile"
        >
          <UserIcon className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
};

export default ImprovedNavigation;