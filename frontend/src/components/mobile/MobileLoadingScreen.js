import React, { memo } from 'react';
import { motion } from 'framer-motion';
import '../../styles/mobile-loading.css';

const MobileLoadingScreen = memo(({ variant = 'default' }) => {
  const skeletonVariants = {
    shimmer: {
      backgroundPosition: ['200% 0', '-200% 0'],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: 'linear'
      }
    }
  };

  if (variant === 'creators') {
    return (
      <div className="mobile-loading-creators">
        {[1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className="mobile-skeleton-creator-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="skeleton-header">
              <motion.div 
                className="skeleton-avatar"
                animate={skeletonVariants.shimmer}
              />
              <div className="skeleton-info">
                <motion.div 
                  className="skeleton-name"
                  animate={skeletonVariants.shimmer}
                />
                <motion.div 
                  className="skeleton-username"
                  animate={skeletonVariants.shimmer}
                />
              </div>
            </div>
            <motion.div 
              className="skeleton-bio"
              animate={skeletonVariants.shimmer}
            />
            <div className="skeleton-actions">
              <motion.div 
                className="skeleton-button"
                animate={skeletonVariants.shimmer}
              />
              <motion.div 
                className="skeleton-button skeleton-button-small"
                animate={skeletonVariants.shimmer}
              />
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  if (variant === 'messages') {
    return (
      <div className="mobile-loading-messages">
        {[1, 2, 3, 4, 5].map((i) => (
          <motion.div
            key={i}
            className="mobile-skeleton-message"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <motion.div 
              className="skeleton-avatar-small"
              animate={skeletonVariants.shimmer}
            />
            <div className="skeleton-message-content">
              <motion.div 
                className="skeleton-message-name"
                animate={skeletonVariants.shimmer}
              />
              <motion.div 
                className="skeleton-message-text"
                animate={skeletonVariants.shimmer}
              />
            </div>
            <motion.div 
              className="skeleton-timestamp"
              animate={skeletonVariants.shimmer}
            />
          </motion.div>
        ))}
      </div>
    );
  }

  if (variant === 'profile') {
    return (
      <div className="mobile-loading-profile">
        <motion.div 
          className="skeleton-cover"
          animate={skeletonVariants.shimmer}
        />
        <div className="skeleton-profile-content">
          <motion.div 
            className="skeleton-avatar-large"
            animate={skeletonVariants.shimmer}
          />
          <motion.div 
            className="skeleton-profile-name"
            animate={skeletonVariants.shimmer}
          />
          <motion.div 
            className="skeleton-profile-bio"
            animate={skeletonVariants.shimmer}
          />
          <div className="skeleton-stats">
            {[1, 2, 3].map((i) => (
              <motion.div 
                key={i}
                className="skeleton-stat"
                animate={skeletonVariants.shimmer}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Default loading screen
  return (
    <div className="mobile-loading-default">
      <motion.div
        className="loading-spinner"
        animate={{
          rotate: 360
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear'
        }}
      >
        <svg className="w-12 h-12" viewBox="0 0 24 24">
          <circle
            className="loading-circle"
            cx="12"
            cy="12"
            r="10"
            fill="none"
            strokeWidth="3"
          />
        </svg>
      </motion.div>
      <motion.p
        className="loading-text"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Loading...
      </motion.p>

      {/* Styles moved to mobile-loading.css */}
      <svg width="0" height="0">
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#667eea" />
            <stop offset="100%" stopColor="#764ba2" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
});

MobileLoadingScreen.displayName = 'MobileLoadingScreen';

export default MobileLoadingScreen;