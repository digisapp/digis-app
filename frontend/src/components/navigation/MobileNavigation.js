import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, 
  MessageCircle, 
  User,
  Video,
  ShoppingBag,
  Settings,
  Crown,
  DollarSign
} from 'lucide-react';
import Button from '../ui/Button';
import { MagneticElement, RippleEffect } from '../ui/Interactions';
import ThemeToggle from '../ui/ThemeToggle';

/**
 * State-of-the-art Mobile Navigation with bottom tab bar
 * Features: gesture support, badges, smooth animations
 */
const MobileNavigation = ({
  currentView,
  setCurrentView,
  isCreator,
  isAdmin,
  tokenBalance,
  unreadMessages = 0,
  onTokenPurchase,
  onProfileClick,
  className = '',
  ...props
}) => {
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Core navigation items (always visible)
  const coreNavItems = isCreator ? [
    // Creator navigation
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      view: 'dashboard',
      color: 'text-primary'
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: MessageCircle,
      view: 'messages',
      color: 'text-info',
      badge: unreadMessages > 0 ? unreadMessages : null
    },
    {
      id: 'explore',
      label: 'Explore',
      icon: ShoppingBag,
      view: 'explore',
      color: 'text-purple-600'
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      view: 'profile',
      color: 'text-neutral-600'
    }
  ] : [
    // Fan navigation
    {
      id: 'explore',
      label: 'Explore',
      icon: Home,
      view: 'explore',
      color: 'text-primary'
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: MessageCircle,
      view: 'messages',
      color: 'text-info',
      badge: unreadMessages > 0 ? unreadMessages : null
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      view: 'profile',
      color: 'text-neutral-600'
    }
  ];

  // Quick action items (expandable menu)
  const quickActions = [
    ...(isCreator ? [
      {
        id: 'go-live',
        label: 'Go Live',
        icon: Video,
        action: () => setCurrentView('streaming'),
        color: 'text-error',
        variant: 'gradient'
      }
    ] : []),
    {
      id: 'tokens',
      label: 'Wallet',
      icon: DollarSign,
      action: () => setCurrentView('wallet'),
      color: 'text-success',
      badge: tokenBalance ? `${tokenBalance.toLocaleString()}` : null
    },
    ...(isAdmin ? [
      {
        id: 'admin',
        label: 'Admin',
        icon: Settings,
        action: () => setCurrentView('admin'),
        color: 'text-warning'
      }
    ] : [])
  ];

  const handleNavClick = (item) => {
    if (item.action) {
      item.action();
    } else if (item.view) {
      setCurrentView(item.view);
    } else if (item.id === 'profile') {
      onProfileClick?.();
    }
  };

  const NavItem = ({ item, isActive = false }) => {
    const Icon = item.icon;
    
    return (
      <MagneticElement strength={0.2}>
        <RippleEffect>
          <motion.button
            onClick={() => handleNavClick(item)}
            className={`
              relative flex flex-col items-center justify-center
              px-2 py-2 rounded-lg min-w-[60px]
              transition-all duration-normal ease-in-out
              ${isActive 
                ? 'bg-primary/10 text-primary' 
                : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
              }
            `}
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            aria-label={item.label}
          >
        {/* Icon with badge */}
        <div className="relative">
          <Icon 
            size={24} 
            className={`transition-colors duration-normal ${
              isActive ? 'text-primary' : item.color || 'text-neutral-500'
            }`}
          />
          
          {/* Badge */}
          {item.badge && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`
                absolute -top-2 -right-2 min-w-[18px] h-[18px]
                flex items-center justify-center
                bg-error text-white text-xs font-medium
                rounded-full px-1
                ${typeof item.badge === 'number' && item.badge > 99 ? 'text-[10px]' : 'text-xs'}
              `}
            >
              {typeof item.badge === 'number' && item.badge > 99 ? '99+' : item.badge}
            </motion.div>
          )}
        </div>
        
        {/* Label */}
        <span className={`
          text-xs font-medium mt-1 transition-colors duration-normal
          ${isActive ? 'text-primary' : 'text-neutral-500'}
        `}>
          {item.label}
        </span>
        
        {/* Active indicator */}
        {isActive && (
          <motion.div
            layoutId="activeNavIndicator"
            className="absolute -bottom-1 w-8 h-1 bg-primary rounded-full"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
          </motion.button>
        </RippleEffect>
      </MagneticElement>
    );
  };

  const QuickActionButton = ({ item }) => {
    const Icon = item.icon;
    
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <Button
          variant={item.variant || 'glass'}
          size="sm"
          onClick={() => {
            handleNavClick(item);
            setShowQuickActions(false);
          }}
          icon={<Icon size={16} />}
          className="shadow-lg hover:shadow-xl"
        >
          {item.label}
          {item.badge && (
            <span className="ml-2 px-2 py-0.5 bg-surface rounded-full text-xs">
              {item.badge}
            </span>
          )}
        </Button>
      </motion.div>
    );
  };

  return (
    <>
      {/* Quick Actions Overlay */}
      <AnimatePresence>
        {showQuickActions && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              onClick={() => setShowQuickActions(false)}
            />
            
            {/* Quick Actions Menu */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="fixed bottom-20 left-4 right-4 z-50"
            >
              <div className="glass-heavy rounded-2xl p-4 shadow-2xl">
                <div className="grid grid-cols-2 gap-3">
                  {quickActions.map((item) => (
                    <QuickActionButton key={item.id} item={item} />
                  ))}
                </div>
                
                {/* Theme Toggle Section */}
                <motion.div 
                  className="mt-4 pt-3 border-t border-white/10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-center justify-center">
                    <ThemeToggle size="medium" showLabel={true} />
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar */}
      <motion.nav
        className={`
          fixed bottom-0 left-0 right-0 z-30
          glass-heavy border-t border-neutral-200/20
          safe-area-inset-bottom
          ${className}
        `}
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        {...props}
      >
        <div className="flex items-center justify-between px-4 py-2">
          {/* Core Navigation Items */}
          {coreNavItems.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              isActive={currentView === item.view}
            />
          ))}
          
          {/* Quick Actions Toggle */}
          <motion.button
            onClick={() => setShowQuickActions(!showQuickActions)}
            className={`
              relative flex flex-col items-center justify-center
              px-3 py-2 rounded-lg min-w-[60px]
              transition-all duration-normal ease-in-out
              ${showQuickActions 
                ? 'bg-primary text-white' 
                : 'bg-gradient-miami text-white hover:shadow-lg'
              }
            `}
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            aria-label="Quick Actions"
          >
            <motion.div
              animate={{ rotate: showQuickActions ? 45 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <div className="w-1 h-1 bg-current rounded-full absolute" />
                <div className="w-1 h-1 bg-current rounded-full absolute transform translate-x-2" />
                <div className="w-1 h-1 bg-current rounded-full absolute transform -translate-x-2" />
                <div className="w-1 h-1 bg-current rounded-full absolute transform translate-y-2" />
                <div className="w-1 h-1 bg-current rounded-full absolute transform -translate-y-2" />
              </div>
            </motion.div>
            <span className="text-xs font-medium mt-1">More</span>
          </motion.button>
        </div>
      </motion.nav>
    </>
  );
};

export default MobileNavigation;