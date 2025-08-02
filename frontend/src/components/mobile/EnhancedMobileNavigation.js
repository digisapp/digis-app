import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMobileUI } from './MobileUIProvider';
import {
  HomeIcon,
  MagnifyingGlassIcon,
  PlusCircleIcon,
  ChatBubbleLeftRightIcon,
  UserCircleIcon,
  VideoCameraIcon,
  SparklesIcon,
  WalletIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeSolidIcon,
  MagnifyingGlassIcon as SearchSolidIcon,
  PlusCircleIcon as PlusSolidIcon,
  ChatBubbleLeftRightIcon as ChatSolidIcon,
  UserCircleIcon as UserSolidIcon
} from '@heroicons/react/24/solid';

const EnhancedMobileNavigation = ({ 
  user, 
  unreadMessages = 0,
  currentView,
  setCurrentView,
  onShowCreatorStudio,
  onTokenPurchase,
  onGoLive
}) => {
  const { isScrollingUp, triggerHaptic, openModal } = useMobileUI();
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    // Update active tab based on current view
    if (currentView === 'explore') setActiveTab('home');
    else if (currentView === 'messages') setActiveTab('messages');
    else if (currentView === 'profile') setActiveTab('profile');
    else setActiveTab(currentView);
  }, [currentView]);

  const navigationItems = [
    {
      id: 'home',
      label: 'Home',
      icon: HomeIcon,
      activeIcon: HomeSolidIcon,
      view: 'explore',
      color: 'text-purple-600'
    },
    {
      id: 'explore',
      label: 'Explore',
      icon: MagnifyingGlassIcon,
      activeIcon: SearchSolidIcon,
      view: 'explore',
      color: 'text-blue-600'
    },
    {
      id: 'create',
      label: 'Create',
      icon: PlusCircleIcon,
      activeIcon: PlusSolidIcon,
      isSpecial: true,
      color: 'text-gradient'
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: ChatBubbleLeftRightIcon,
      activeIcon: ChatSolidIcon,
      view: 'messages',
      badge: unreadMessages,
      color: 'text-green-600'
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: UserCircleIcon,
      activeIcon: UserSolidIcon,
      view: 'profile',
      color: 'text-pink-600'
    }
  ];

  const quickActions = [
    {
      id: 'video',
      label: 'Start Video Call',
      icon: VideoCameraIcon,
      color: 'bg-blue-500',
      onClick: () => {
        openModal('videoCall');
        setShowQuickActions(false);
      }
    },
    {
      id: 'live',
      label: 'Go Live',
      icon: SparklesIcon,
      color: 'bg-red-500',
      onClick: () => {
        onGoLive?.();
        setShowQuickActions(false);
      }
    },
    {
      id: 'wallet',
      label: 'Token Store',
      icon: WalletIcon,
      color: 'bg-purple-500',
      onClick: () => {
        onTokenPurchase?.();
        setShowQuickActions(false);
      }
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Cog6ToothIcon,
      color: 'bg-gray-500',
      onClick: () => {
        setCurrentView('settings');
        setShowQuickActions(false);
      }
    }
  ];

  const handleNavigation = (item) => {
    if (item.isSpecial) {
      setShowQuickActions(!showQuickActions);
      triggerHaptic('medium');
    } else {
      setActiveTab(item.id);
      if (item.view) {
        setCurrentView(item.view);
      }
      triggerHaptic('light');
    }
  };

  return (
    <>
      {/* Quick Actions Menu */}
      <AnimatePresence>
        {showQuickActions && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/50 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQuickActions(false)}
            />
            
            {/* Actions Grid */}
            <motion.div
              className="fixed bottom-20 left-4 right-4 z-50"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <div className="bg-white rounded-2xl shadow-xl p-4 grid grid-cols-2 gap-3">
                {quickActions.map((action) => (
                  <motion.button
                    key={action.id}
                    onClick={action.onClick}
                    className="flex flex-col items-center p-4 rounded-xl hover:bg-gray-50 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className={`w-12 h-12 ${action.color} rounded-full flex items-center justify-center mb-2`}>
                      <action.icon className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{action.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <motion.nav
        className={`mobile-bottom-nav ${!isScrollingUp && !showQuickActions ? 'hidden' : ''}`}
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        <div className="mobile-nav-items">
          {navigationItems.map((item) => {
            const Icon = activeTab === item.id ? item.activeIcon : item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <motion.button
                key={item.id}
                onClick={() => handleNavigation(item)}
                className={`mobile-nav-item ${item.isSpecial ? 'special' : ''}`}
                whileTap={{ scale: 0.9 }}
              >
                {item.isSpecial ? (
                  <motion.div
                    className="w-14 h-14 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg"
                    animate={{ 
                      rotate: showQuickActions ? 45 : 0,
                      scale: showQuickActions ? 1.1 : 1
                    }}
                    transition={{ type: 'spring', damping: 15 }}
                  >
                    <Icon className="w-7 h-7 text-white" />
                  </motion.div>
                ) : (
                  <>
                    <motion.div
                      className="relative"
                      animate={{ scale: isActive ? 1.1 : 1 }}
                      transition={{ type: 'spring', damping: 15 }}
                    >
                      <Icon className={`w-6 h-6 ${isActive ? item.color : 'text-gray-400'}`} />
                      
                      {/* Badge */}
                      {item.badge > 0 && (
                        <motion.span
                          className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', damping: 15 }}
                        >
                          {item.badge > 9 ? '9+' : item.badge}
                        </motion.span>
                      )}
                    </motion.div>
                    
                    <motion.span 
                      className={`text-xs mt-1 ${isActive ? item.color : 'text-gray-400'} font-medium`}
                      animate={{ opacity: isActive ? 1 : 0.7 }}
                    >
                      {item.label}
                    </motion.span>
                    
                    {/* Active indicator */}
                    {isActive && (
                      <motion.div
                        className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-current rounded-full"
                        layoutId="activeIndicator"
                        transition={{ type: 'spring', damping: 20 }}
                      />
                    )}
                  </>
                )}
              </motion.button>
            );
          })}
        </div>
        
        {/* Gesture indicator */}
        <motion.div
          className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-gray-300 rounded-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        />
      </motion.nav>
    </>
  );
};

export default EnhancedMobileNavigation;