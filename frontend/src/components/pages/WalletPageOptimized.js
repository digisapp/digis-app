import React, { useState, lazy, Suspense, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import WalletErrorBoundary from '../WalletErrorBoundary';
import LoadingSpinner from '../ui/LoadingSpinner';
import { 
  WalletIcon,
  BanknotesIcon,
  CogIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

// Lazy load heavy components
const Wallet = lazy(() => import('../WalletOptimized'));
const CreatorPayoutDashboard = lazy(() => import('../CreatorPayoutDashboard'));
const PayoutSettings = lazy(() => import('../PayoutSettings'));

// Loading skeleton component
const WalletSkeleton = () => (
  <div className="animate-pulse space-y-6">
    <div className="bg-gray-200 dark:bg-gray-700 h-32 rounded-xl"></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-gray-200 dark:bg-gray-700 h-24 rounded-lg"></div>
      ))}
    </div>
    <div className="bg-gray-200 dark:bg-gray-700 h-64 rounded-xl"></div>
  </div>
);

const WalletPageOptimized = ({ user, isCreator, isAdmin, tokenBalance, onTokenUpdate, onViewProfile, onTokenPurchase, setCurrentView }) => {
  // For fans, we don't need tabs at all - just show the wallet overview
  const [activeSection, setActiveSection] = useState('overview');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const sections = useMemo(() => {
    // Fans only see the overview (token balance and purchase)
    // Creators see additional tabs for payouts and banking
    if (!isCreator) {
      return [{ id: 'overview', label: 'Wallet', icon: WalletIcon }];
    }
    return [
      { id: 'overview', label: 'Overview', icon: WalletIcon },
      { id: 'payouts', label: 'Payouts', icon: BanknotesIcon },
      { id: 'banking', label: 'Banking', icon: CogIcon }
    ];
  }, [isCreator]);

  // Handle tab change with loading state
  const handleSectionChange = useCallback((sectionId) => {
    if (sectionId !== activeSection) {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveSection(sectionId);
        setIsTransitioning(false);
      }, 150);
    }
  }, [activeSection]);

  // Mobile swipe handlers
  const handlers = useSwipeable({
    onSwipedLeft: () => {
      const currentIndex = sections.findIndex(s => s.id === activeSection);
      if (currentIndex < sections.length - 1) {
        handleSectionChange(sections[currentIndex + 1].id);
      }
    },
    onSwipedRight: () => {
      const currentIndex = sections.findIndex(s => s.id === activeSection);
      if (currentIndex > 0) {
        handleSectionChange(sections[currentIndex - 1].id);
      }
    },
    preventDefaultTouchmoveEvent: true,
    trackMouse: false
  });

  // Get current section index for mobile navigation
  const currentSectionIndex = sections.findIndex(s => s.id === activeSection);

  return (
    <WalletErrorBoundary>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 md:space-y-8">
        {/* Desktop Navigation - Only show for creators */}
        {isCreator && (
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm p-2">
            <nav className="flex justify-center">
              <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => handleSectionChange(section.id)}
                  disabled={isTransitioning}
                  className={`
                    flex items-center justify-center gap-2 py-2.5 px-6 lg:px-8 
                    rounded-md font-medium text-sm transition-all duration-200 
                    min-w-[100px] lg:min-w-[120px] touch-manipulation
                    ${activeSection === section.id
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md transform scale-105'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white dark:hover:bg-gray-600'
                    }
                    ${isTransitioning ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  style={{ minHeight: '44px' }} // Touch-friendly size
                >
                  <section.icon className="w-5 h-5" />
                  <span className="whitespace-nowrap">{section.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>
        )}

        {/* Mobile Navigation - Swipeable Pills - Only show for creators */}
        {isCreator && (
          <div className="md:hidden">
          <div className="flex items-center justify-between px-4 mb-4">
            <button
              onClick={() => currentSectionIndex > 0 && handleSectionChange(sections[currentSectionIndex - 1].id)}
              disabled={currentSectionIndex === 0 || isTransitioning}
              className={`p-2 rounded-full ${currentSectionIndex === 0 || isTransitioning ? 'opacity-30' : 'bg-gray-100 dark:bg-gray-700'}`}
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            
            <div className="flex-1 overflow-hidden mx-4">
              <div className="flex justify-center gap-2">
                {sections.map((section, index) => (
                  <button
                    key={section.id}
                    onClick={() => handleSectionChange(section.id)}
                    className={`
                      flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium
                      transition-all duration-300 touch-manipulation
                      ${activeSection === section.id
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white scale-110'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }
                    `}
                    style={{ minHeight: '40px' }}
                  >
                    <span className="flex items-center gap-2">
                      <section.icon className="w-4 h-4" />
                      {section.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => currentSectionIndex < sections.length - 1 && handleSectionChange(sections[currentSectionIndex + 1].id)}
              disabled={currentSectionIndex === sections.length - 1 || isTransitioning}
              className={`p-2 rounded-full ${currentSectionIndex === sections.length - 1 || isTransitioning ? 'opacity-30' : 'bg-gray-100 dark:bg-gray-700'}`}
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile Swipe Indicator */}
          <div className="flex justify-center gap-1.5 mb-4">
            {sections.map((section, index) => (
              <div
                key={section.id}
                className={`
                  h-1.5 rounded-full transition-all duration-300
                  ${activeSection === section.id ? 'w-8 bg-purple-600' : 'w-1.5 bg-gray-300 dark:bg-gray-600'}
                `}
              />
            ))}
          </div>
        </div>
        )}

        {/* Content Sections with Lazy Loading */}
        <div {...handlers} className="min-h-[400px] relative">
          <AnimatePresence mode="wait">
            {isTransitioning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl"
              >
                <LoadingSpinner />
              </motion.div>
            )}
          </AnimatePresence>

          <Suspense fallback={<WalletSkeleton />}>
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeSection === 'overview' && (
                <Wallet 
                  user={user}
                  tokenBalance={tokenBalance}
                  onTokenUpdate={onTokenUpdate}
                  onViewProfile={onViewProfile}
                  onTokenPurchase={onTokenPurchase}
                  isCreator={isCreator}
                  isAdmin={isAdmin}
                  setCurrentView={setCurrentView}
                />
              )}

              {activeSection === 'payouts' && isCreator && (
                <CreatorPayoutDashboard user={user} />
              )}

              {activeSection === 'banking' && isCreator && (
                <PayoutSettings user={user} tokenBalance={tokenBalance} />
              )}
            </motion.div>
          </Suspense>
        </div>
      </div>
    </WalletErrorBoundary>
  );
};

export default WalletPageOptimized;