import React from 'react';
import { motion } from 'framer-motion';

const shimmer = {
  animate: {
    backgroundPosition: ['200% 0', '-200% 0']
  },
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: 'linear'
  }
};

export const CreatorCardSkeleton = ({ variant = 'default' }) => {
  if (variant === 'featured') {
    return (
      <div className="relative overflow-hidden rounded-2xl" style={{ aspectRatio: '3/4' }}>
        <motion.div 
          className="mobile-skeleton w-full h-full"
          animate={shimmer.animate}
          transition={shimmer.transition}
        />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="mobile-list-item">
        <motion.div 
          className="mobile-skeleton-avatar"
          animate={shimmer.animate}
          transition={shimmer.transition}
        />
        <div className="mobile-list-item-content">
          <motion.div 
            className="mobile-skeleton h-4 w-32 mb-2"
            animate={shimmer.animate}
            transition={shimmer.transition}
          />
          <motion.div 
            className="mobile-skeleton h-3 w-24"
            animate={shimmer.animate}
            transition={shimmer.transition}
          />
        </div>
        <div className="flex gap-2">
          <motion.div 
            className="mobile-skeleton w-5 h-5 rounded"
            animate={shimmer.animate}
            transition={shimmer.transition}
          />
          <motion.div 
            className="mobile-skeleton w-5 h-5 rounded"
            animate={shimmer.animate}
            transition={shimmer.transition}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-card">
      <div className="flex items-start gap-4 mb-4">
        <motion.div 
          className="mobile-skeleton-avatar"
          animate={shimmer.animate}
          transition={shimmer.transition}
        />
        <div className="flex-1">
          <motion.div 
            className="mobile-skeleton h-5 w-32 mb-2"
            animate={shimmer.animate}
            transition={shimmer.transition}
          />
          <motion.div 
            className="mobile-skeleton h-4 w-24 mb-2"
            animate={shimmer.animate}
            transition={shimmer.transition}
          />
          <motion.div 
            className="mobile-skeleton h-3 w-40"
            animate={shimmer.animate}
            transition={shimmer.transition}
          />
        </div>
      </div>
      <motion.div 
        className="mobile-skeleton h-12 w-full rounded-xl mb-3"
        animate={shimmer.animate}
        transition={shimmer.transition}
      />
      <div className="flex gap-2">
        <motion.div 
          className="mobile-skeleton h-8 w-20 rounded-full"
          animate={shimmer.animate}
          transition={shimmer.transition}
        />
        <motion.div 
          className="mobile-skeleton h-8 w-20 rounded-full"
          animate={shimmer.animate}
          transition={shimmer.transition}
        />
      </div>
    </div>
  );
};

export const MessageItemSkeleton = () => (
  <div className="px-4 py-4 flex items-start gap-3">
    <motion.div 
      className="mobile-skeleton w-14 h-14 rounded-full"
      animate={shimmer.animate}
      transition={shimmer.transition}
    />
    <div className="flex-1">
      <div className="flex justify-between mb-2">
        <motion.div 
          className="mobile-skeleton h-4 w-32"
          animate={shimmer.animate}
          transition={shimmer.transition}
        />
        <motion.div 
          className="mobile-skeleton h-3 w-12"
          animate={shimmer.animate}
          transition={shimmer.transition}
        />
      </div>
      <motion.div 
        className="mobile-skeleton h-3 w-48"
        animate={shimmer.animate}
        transition={shimmer.transition}
      />
    </div>
  </div>
);

export const ProfileHeaderSkeleton = () => (
  <div className="mobile-profile-header">
    <motion.div 
      className="h-48 bg-gradient-to-r from-gray-200 to-gray-300"
      animate={shimmer.animate}
      transition={shimmer.transition}
    />
    <div className="pt-20 pb-6 px-6 text-center">
      <motion.div 
        className="mobile-skeleton h-6 w-40 mx-auto mb-2"
        animate={shimmer.animate}
        transition={shimmer.transition}
      />
      <motion.div 
        className="mobile-skeleton h-4 w-24 mx-auto mb-4"
        animate={shimmer.animate}
        transition={shimmer.transition}
      />
      <div className="flex justify-center gap-6 mb-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="text-center">
            <motion.div 
              className="mobile-skeleton h-5 w-12 mb-1"
              animate={shimmer.animate}
              transition={shimmer.transition}
            />
            <motion.div 
              className="mobile-skeleton h-3 w-16"
              animate={shimmer.animate}
              transition={shimmer.transition}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <motion.div 
          className="mobile-skeleton h-12 flex-1 rounded-xl"
          animate={shimmer.animate}
          transition={shimmer.transition}
        />
        <motion.div 
          className="mobile-skeleton h-12 flex-1 rounded-xl"
          animate={shimmer.animate}
          transition={shimmer.transition}
        />
      </div>
    </div>
  </div>
);

export const StatCardSkeleton = () => (
  <div className="mobile-stat-card">
    <motion.div 
      className="mobile-skeleton w-8 h-8 rounded mb-2 mx-auto"
      animate={shimmer.animate}
      transition={shimmer.transition}
    />
    <motion.div 
      className="mobile-skeleton h-6 w-16 mb-1 mx-auto"
      animate={shimmer.animate}
      transition={shimmer.transition}
    />
    <motion.div 
      className="mobile-skeleton h-3 w-20 mx-auto"
      animate={shimmer.animate}
      transition={shimmer.transition}
    />
  </div>
);

export const CategoryChipSkeleton = () => (
  <motion.div 
    className="mobile-skeleton h-10 w-24 rounded-full"
    animate={shimmer.animate}
    transition={shimmer.transition}
    style={{ minWidth: '96px' }}
  />
);

export const LoadingScreen = ({ message = 'Loading...' }) => (
  <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
    <motion.div
      className="mb-8"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    >
      <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full" />
    </motion.div>
    <motion.p
      className="text-gray-600 text-lg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
    >
      {message}
    </motion.p>
  </div>
);

export default {
  CreatorCard: CreatorCardSkeleton,
  MessageItem: MessageItemSkeleton,
  ProfileHeader: ProfileHeaderSkeleton,
  StatCard: StatCardSkeleton,
  CategoryChip: CategoryChipSkeleton,
  LoadingScreen
};