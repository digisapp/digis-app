import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XMarkIcon,
  SparklesIcon,
  ArrowRightIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

const FeatureDiscovery = ({ user, isCreator }) => {
  const [currentFeature, setCurrentFeature] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [hasSeenTour, setHasSeenTour] = useState(false);

  const features = isCreator ? [
    {
      title: "Creator Studio",
      description: "Manage your content, analytics, and fan interactions all in one place",
      icon: "🎬",
      action: "Go to Creator Studio",
      path: "/creator-studio"
    },
    {
      title: "Go Live Setup",
      description: "Start live streaming with advanced settings and quality controls",
      icon: "📺",
      action: "Set Up Stream",
      path: "#go-live"
    },
    {
      title: "Privacy Settings",
      description: "Control who can contact you and manage your visibility settings",
      icon: "🔐",
      action: "Manage Privacy",
      path: "/settings/privacy"
    }
  ] : [
    {
      title: "Discover Creators",
      description: "Find amazing creators based on your interests and preferences",
      icon: "🌟",
      action: "Explore Now",
      path: "/dashboard"
    },
    {
      title: "Token Wallet",
      description: "Buy tokens, track spending, and manage your digital wallet",
      icon: "💎",
      action: "View Wallet",
      path: "/wallet"
    },
    {
      title: "Become a Creator",
      description: "Apply to join our creator program and start earning",
      icon: "⭐",
      action: "Apply Now",
      path: "/apply"
    }
  ];

  useEffect(() => {
    // Check if user has seen the tour
    const tourKey = `feature-tour-${isCreator ? 'creator' : 'fan'}-${user?.uid}`;
    const seen = localStorage.getItem(tourKey);
    
    if (!seen && user) {
      setTimeout(() => setIsVisible(true), 2000); // Show after 2 seconds
    } else {
      setHasSeenTour(true);
    }
  }, [user, isCreator]);

  const handleNext = () => {
    if (currentFeature < features.length - 1) {
      setCurrentFeature(currentFeature + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    const tourKey = `feature-tour-${isCreator ? 'creator' : 'fan'}-${user?.uid}`;
    localStorage.setItem(tourKey, 'true');
    setIsVisible(false);
    setHasSeenTour(true);
  };

  const handleRestart = () => {
    setCurrentFeature(0);
    setIsVisible(true);
    setHasSeenTour(false);
  };

  if (hasSeenTour) {
    return (
      <button
        onClick={handleRestart}
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-purple-500 to-pink-500 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
        title="Feature Tour"
      >
        <SparklesIcon className="w-6 h-6" />
      </button>
    );
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={handleSkip}
          />

          {/* Feature Discovery Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6 relative">
                <button
                  onClick={handleSkip}
                  className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
                
                <div className="text-center">
                  <div className="text-4xl mb-3">
                    {features[currentFeature].icon}
                  </div>
                  <h2 className="text-xl font-bold mb-2">
                    {features[currentFeature].title}
                  </h2>
                  <p className="text-purple-100">
                    {features[currentFeature].description}
                  </p>
                </div>
              </div>

              {/* Progress Indicator */}
              <div className="px-6 py-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">
                    {currentFeature + 1} of {features.length}
                  </span>
                  <span className="text-sm text-gray-600">
                    {isCreator ? 'Creator Features' : 'Getting Started'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentFeature + 1) / features.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 space-y-4">
                <button
                  onClick={handleNext}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all flex items-center justify-center gap-2"
                >
                  {currentFeature < features.length - 1 ? (
                    <>
                      Next Feature
                      <ArrowRightIcon className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Get Started
                      <CheckIcon className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex gap-3">
                  <button
                    onClick={handleSkip}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Skip Tour
                  </button>
                  
                  {features[currentFeature].path !== '#go-live' && (
                    <button
                      onClick={() => {
                        window.location.href = features[currentFeature].path;
                        handleComplete();
                      }}
                      className="flex-1 bg-blue-100 text-blue-700 py-2 px-4 rounded-lg font-medium hover:bg-blue-200 transition-colors"
                    >
                      Try Now
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FeatureDiscovery;