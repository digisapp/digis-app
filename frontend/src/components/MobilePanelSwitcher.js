import React, { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  ShoppingBagIcon,
  UserGroupIcon,
  XMarkIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline';
import { triggerHaptic } from '../utils/streamUtils';

/**
 * Mobile Panel Switcher Component
 * Provides a segmented control for switching between panels on mobile
 */
const MobilePanelSwitcher = memo(({
  activePanel = 'chat',
  onPanelChange,
  availablePanels = ['chat', 'analytics', 'shop'],
  showLabels = false,
  className = '',
  position = 'bottom', // 'top' or 'bottom'
  style = 'segmented' // 'segmented' or 'tabs'
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  // Panel configuration
  const panelConfig = {
    chat: {
      icon: ChatBubbleLeftRightIcon,
      label: 'Chat',
      color: 'purple'
    },
    analytics: {
      icon: ChartBarIcon,
      label: 'Stats',
      color: 'blue'
    },
    shop: {
      icon: ShoppingBagIcon,
      label: 'Shop',
      color: 'green'
    },
    guests: {
      icon: UserGroupIcon,
      label: 'Guests',
      color: 'orange'
    }
  };

  // Filter available panels
  const panels = availablePanels.filter(panel => panelConfig[panel]);

  const handlePanelClick = (panel) => {
    if (panel !== activePanel) {
      triggerHaptic(30);
      onPanelChange?.(panel);
    }
  };

  // Swipe gestures for panel switching
  useEffect(() => {
    let touchStartX = 0;
    let touchEndX = 0;

    const handleTouchStart = (e) => {
      touchStartX = e.touches[0].clientX;
    };

    const handleTouchEnd = (e) => {
      touchEndX = e.changedTouches[0].clientX;
      handleSwipe();
    };

    const handleSwipe = () => {
      const swipeThreshold = 50;
      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) > swipeThreshold) {
        const currentIndex = panels.indexOf(activePanel);

        if (diff > 0 && currentIndex < panels.length - 1) {
          // Swipe left - next panel
          handlePanelClick(panels[currentIndex + 1]);
        } else if (diff < 0 && currentIndex > 0) {
          // Swipe right - previous panel
          handlePanelClick(panels[currentIndex - 1]);
        }
      }
    };

    // Only add swipe listeners on mobile
    if (window.innerWidth <= 768) {
      document.addEventListener('touchstart', handleTouchStart);
      document.addEventListener('touchend', handleTouchEnd);

      return () => {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [activePanel, panels]);

  if (style === 'tabs') {
    return (
      <div className={`flex items-center justify-around bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 px-2 py-1 ${className}`}>
        {panels.map((panel) => {
          const config = panelConfig[panel];
          const Icon = config.icon;
          const isActive = activePanel === panel;

          return (
            <motion.button
              key={panel}
              onClick={() => handlePanelClick(panel)}
              whileTap={{ scale: 0.95 }}
              className={`
                flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-lg
                transition-all duration-200
                ${isActive
                  ? `bg-${config.color}-600/20 text-${config.color}-400`
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }
              `}
              aria-label={config.label}
              aria-pressed={isActive}
            >
              <Icon className="w-5 h-5 mb-1" />
              {showLabels && (
                <span className="text-[10px] font-medium">{config.label}</span>
              )}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className={`absolute bottom-0 left-0 right-0 h-0.5 bg-${config.color}-400`}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    );
  }

  // Default segmented control style
  return (
    <AnimatePresence>
      {!isMinimized ? (
        <motion.div
          initial={{ opacity: 0, y: position === 'bottom' ? 20 : -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === 'bottom' ? 20 : -20 }}
          className={`
            ${position === 'bottom' ? 'pb-safe' : 'pt-safe'}
            px-4 py-2 bg-gray-900/95 backdrop-blur-xl border-t border-gray-800
            ${className}
          `}
        >
          <div className="relative">
            {/* Minimize button */}
            <button
              onClick={() => setIsMinimized(true)}
              className="absolute -top-1 right-0 p-1 text-gray-500 hover:text-gray-300"
              aria-label="Minimize panel switcher"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>

            {/* Segmented control */}
            <div className="bg-gray-800/50 rounded-xl p-1 flex gap-1">
              {panels.map((panel, index) => {
                const config = panelConfig[panel];
                const Icon = config.icon;
                const isActive = activePanel === panel;

                return (
                  <motion.button
                    key={panel}
                    onClick={() => handlePanelClick(panel)}
                    whileTap={{ scale: 0.95 }}
                    className={`
                      flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg
                      transition-all duration-200 min-h-[44px] touchable
                      ${isActive
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                      }
                    `}
                    aria-label={config.label}
                    aria-pressed={isActive}
                  >
                    <Icon className="w-5 h-5" />
                    {(showLabels || window.innerWidth > 400) && (
                      <span className="text-sm font-medium">{config.label}</span>
                    )}

                    {/* Active indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="activeSegment"
                        className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg -z-10"
                        initial={false}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30
                        }}
                      />
                    )}

                    {/* Divider */}
                    {index < panels.length - 1 && !isActive && panels[index + 1] !== activePanel && (
                      <div className="absolute right-0 top-2 bottom-2 w-px bg-gray-700" />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Swipe indicator */}
            <div className="mt-2 flex justify-center gap-1">
              {panels.map((panel) => (
                <div
                  key={panel}
                  className={`
                    h-1 rounded-full transition-all duration-300
                    ${activePanel === panel
                      ? 'w-6 bg-purple-500'
                      : 'w-1 bg-gray-600'
                    }
                  `}
                />
              ))}
            </div>

            {/* Swipe hint */}
            {panels.length > 2 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 0.5 }}
                className="text-center text-[10px] text-gray-500 mt-1"
              >
                Swipe to switch panels
              </motion.p>
            )}
          </div>
        </motion.div>
      ) : (
        /* Minimized state - floating button */
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          onClick={() => setIsMinimized(false)}
          whileTap={{ scale: 0.9 }}
          className={`
            fixed ${position === 'bottom' ? 'bottom-20' : 'top-20'} right-4
            w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600
            rounded-full shadow-lg flex items-center justify-center
            text-white z-50
          `}
          aria-label="Show panel switcher"
        >
          <Squares2X2Icon className="w-6 h-6" />
        </motion.button>
      )}
    </AnimatePresence>
  );
});

MobilePanelSwitcher.displayName = 'MobilePanelSwitcher';

export default MobilePanelSwitcher;