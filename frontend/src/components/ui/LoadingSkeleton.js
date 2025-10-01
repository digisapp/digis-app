import React from 'react';
import { motion } from 'framer-motion';

/**
 * Reusable loading skeleton components for consistent loading states
 */

// Base skeleton component
export const Skeleton = ({ className = '', ...props }) => (
  <div
    className={`animate-pulse bg-gray-200 rounded ${className}`}
    {...props}
  />
);

// Text skeleton
export const SkeletonText = ({ lines = 1, className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
      />
    ))}
  </div>
);

// Avatar skeleton
export const SkeletonAvatar = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };
  
  return <Skeleton className={`rounded-full ${sizes[size]} ${className}`} />;
};

// Card skeleton
export const SkeletonCard = ({ className = '' }) => (
  <div className={`bg-white rounded-xl p-6 shadow-sm border border-gray-200 ${className}`}>
    <div className="flex items-start gap-4">
      <SkeletonAvatar />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-1/3" />
        <SkeletonText lines={2} />
      </div>
    </div>
  </div>
);

// Button skeleton
export const SkeletonButton = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'h-8 w-20',
    md: 'h-10 w-24',
    lg: 'h-12 w-32'
  };
  
  return <Skeleton className={`rounded-lg ${sizes[size]} ${className}`} />;
};

// Creator card skeleton
export const SkeletonCreatorCard = ({ className = '' }) => (
  <motion.div
    className={`bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200 ${className}`}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3 }}
  >
    {/* Cover image */}
    <Skeleton className="h-48 w-full rounded-none" />
    
    {/* Content */}
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <SkeletonAvatar size="md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      
      <SkeletonText lines={2} />
      
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-18 rounded-full" />
      </div>
      
      <SkeletonButton className="w-full" />
    </div>
  </motion.div>
);

// Message skeleton
export const SkeletonMessage = ({ isOwn = false, className = '' }) => (
  <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${className}`}>
    <div className="max-w-xs lg:max-w-md space-y-2">
      {!isOwn && (
        <div className="flex items-center gap-2">
          <SkeletonAvatar size="sm" />
          <Skeleton className="h-4 w-24" />
        </div>
      )}
      <Skeleton className={`h-16 w-full rounded-2xl ${isOwn ? 'bg-purple-200' : ''}`} />
      <Skeleton className="h-3 w-16" />
    </div>
  </div>
);

// Table skeleton
export const SkeletonTable = ({ rows = 5, columns = 4, className = '' }) => (
  <div className={`w-full ${className}`}>
    {/* Header */}
    <div className="grid grid-cols-4 gap-4 p-4 border-b border-gray-200">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="h-4" />
      ))}
    </div>
    
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="grid grid-cols-4 gap-4 p-4 border-b border-gray-100">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={colIndex} className="h-4" />
        ))}
      </div>
    ))}
  </div>
);

// Stats skeleton
export const SkeletonStats = ({ className = '' }) => (
  <div className={`bg-white rounded-xl p-6 shadow-sm border border-gray-200 ${className}`}>
    <Skeleton className="h-4 w-24 mb-2" />
    <Skeleton className="h-8 w-32 mb-1" />
    <Skeleton className="h-3 w-20" />
  </div>
);

// Full page skeleton
export const SkeletonPage = ({ title = true, stats = true, content = true }) => (
  <div className="space-y-6">
    {/* Header */}
    {title && (
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    )}
    
    {/* Stats */}
    {stats && (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStats key={i} />
        ))}
      </div>
    )}
    
    {/* Content */}
    {content && (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )}
  </div>
);

// Video call skeleton
export const SkeletonVideoCall = ({ className = '' }) => (
  <div className={`bg-black rounded-xl overflow-hidden ${className}`}>
    <div className="aspect-video bg-gray-800 animate-pulse relative">
      {/* Main video placeholder */}
      <div className="absolute inset-0 flex items-center justify-center">
        <SkeletonAvatar size="xl" className="bg-gray-700" />
      </div>
      
      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-center gap-4">
          <Skeleton className="w-12 h-12 rounded-full bg-gray-700" />
          <Skeleton className="w-12 h-12 rounded-full bg-gray-700" />
          <Skeleton className="w-12 h-12 rounded-full bg-gray-700" />
        </div>
      </div>
    </div>
  </div>
);

// Loading dots animation
export const LoadingDots = ({ className = '' }) => (
  <div className={`flex items-center gap-1 ${className}`}>
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="w-2 h-2 bg-purple-600 rounded-full"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 1, 0.5]
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          delay: i * 0.2
        }}
      />
    ))}
  </div>
);

// Spinner
export const Spinner = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };
  
  return (
    <div className={`${sizes[size]} ${className}`}>
      <svg
        className="animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
};

export default {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonButton,
  SkeletonCreatorCard,
  SkeletonMessage,
  SkeletonTable,
  SkeletonStats,
  SkeletonPage,
  SkeletonVideoCall,
  LoadingDots,
  Spinner
};