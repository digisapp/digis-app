import React from 'react';
import { motion } from 'framer-motion';

const SkeletonLoader = ({ 
  className = "", 
  variant = "default", 
  count = 1, 
  animation = true 
}) => {
  const variants = {
    default: "h-4 w-full",
    card: "h-48 w-full rounded-2xl",
    avatar: "h-12 w-12 rounded-full",
    button: "h-10 w-24 rounded-xl",
    text: "h-4 w-3/4",
    title: "h-6 w-1/2",
    creator: "h-80 w-full rounded-3xl",
    message: "h-16 w-full rounded-xl",
    navigation: "h-10 w-20 rounded-lg"
  };

  const baseClasses = `
    bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 
    dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 
    ${animation ? 'animate-pulse bg-[length:200%_100%]' : ''}
    ${variants[variant]} 
    ${className}
  `;

  const shimmerEffect = animation ? {
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite'
  } : {};

  if (count === 1) {
    return (
      <div 
        className={baseClasses}
        style={shimmerEffect}
        role="status" 
        aria-label="Loading content"
      />
    );
  }

  return (
    <div className="space-y-3" role="status" aria-label="Loading multiple items">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={baseClasses}
          style={{
            ...shimmerEffect,
            animationDelay: `${index * 0.1}s`
          }}
        />
      ))}
    </div>
  );
};

// Specialized Skeleton Components
export const CreatorCardSkeleton = ({ count = 1 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
    {Array.from({ length: count }, (_, index) => (
      <motion.div
        key={index}
        className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-lg border border-gray-200 dark:border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
      >
        <div className="text-center mb-6">
          <SkeletonLoader variant="avatar" className="mx-auto mb-3" />
          <SkeletonLoader variant="title" className="mx-auto mb-2" />
          <SkeletonLoader variant="text" className="mx-auto mb-3" />
          <div className="flex justify-center gap-1 mb-3">
            {[...Array(3)].map((_, i) => (
              <SkeletonLoader key={i} className="h-6 w-12 rounded-full" />
            ))}
          </div>
          <div className="flex justify-center gap-4 mb-4">
            <SkeletonLoader className="h-4 w-16" />
            <SkeletonLoader className="h-4 w-16" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonLoader key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
        <div className="flex gap-2">
          <SkeletonLoader className="h-10 flex-1 rounded-xl" />
          <SkeletonLoader className="h-10 w-16 rounded-xl" />
        </div>
      </motion.div>
    ))}
  </div>
);

export const MessageListSkeleton = ({ count = 5 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }, (_, index) => (
      <motion.div
        key={index}
        className="flex items-start gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: index * 0.1 }}
      >
        <SkeletonLoader variant="avatar" className="flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <SkeletonLoader className="h-4 w-24" />
            <SkeletonLoader className="h-3 w-16" />
          </div>
          <SkeletonLoader className="h-4 w-full" />
          <SkeletonLoader className="h-4 w-2/3" />
        </div>
      </motion.div>
    ))}
  </div>
);

export const DashboardSkeleton = () => (
  <div className="space-y-8">
    {/* Header */}
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <SkeletonLoader variant="title" className="mb-2" />
        <SkeletonLoader variant="text" />
      </div>
      <SkeletonLoader variant="button" />
    </div>

    {/* Stats Grid */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[...Array(3)].map((_, index) => (
        <div key={index} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <SkeletonLoader className="h-8 w-8 rounded-lg" />
            <SkeletonLoader className="h-4 w-16" />
          </div>
          <SkeletonLoader variant="title" className="mb-2" />
          <SkeletonLoader variant="text" />
        </div>
      ))}
    </div>

    {/* Content Grid */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-4">
        <SkeletonLoader variant="title" />
        <div className="space-y-3">
          {[...Array(4)].map((_, index) => (
            <SkeletonLoader key={index} variant="message" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <SkeletonLoader variant="title" />
        <CreatorCardSkeleton count={2} />
      </div>
    </div>
  </div>
);

export const NavigationSkeleton = ({ count = 5 }) => (
  <div className="flex items-center gap-2">
    {Array.from({ length: count }, (_, index) => (
      <SkeletonLoader
        key={index}
        variant="navigation"
        animation={false}
        className="animate-pulse"
        style={{ animationDelay: `${index * 0.1}s` }}
      />
    ))}
  </div>
);

export default SkeletonLoader;