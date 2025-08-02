import React from 'react';

/**
 * State-of-the-art Skeleton component for loading states
 * Features: variants, animations, accessibility, composability
 */
const Skeleton = ({ 
  variant = 'rounded',
  width = 'w-full',
  height = 'h-4',
  className = '',
  animate = true,
  ...props 
}) => {
  // Base skeleton classes using design tokens
  const baseClasses = `
    bg-neutral-200 
    ${animate ? 'animate-pulse' : ''}
    ${width} 
    ${height}
  `.trim();

  // Variant styles
  const variantClasses = {
    text: 'rounded-sm',
    rounded: 'rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-none'
  };

  return (
    <div
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${className}
      `.replace(/\s+/g, ' ').trim()}
      aria-hidden="true"
      {...props}
    />
  );
};

// Skeleton patterns for common UI elements
const SkeletonText = ({ lines = 3, className = '', ...props }) => (
  <div className={`space-y-2 ${className}`} {...props}>
    {[...Array(lines)].map((_, i) => (
      <Skeleton
        key={i}
        variant="text"
        height="h-4"
        width={i === lines - 1 ? 'w-3/4' : 'w-full'}
      />
    ))}
  </div>
);

const SkeletonAvatar = ({ size = 'md', className = '', ...props }) => {
  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-20 h-20'
  };

  return (
    <Skeleton
      variant="circular"
      width={sizeClasses[size]}
      height={sizeClasses[size]}
      className={className}
      {...props}
    />
  );
};

const SkeletonButton = ({ size = 'md', className = '', ...props }) => {
  const sizeClasses = {
    sm: 'w-20 h-8',
    md: 'w-24 h-10',
    lg: 'w-32 h-12'
  };

  return (
    <Skeleton
      variant="rounded"
      width={sizeClasses[size]}
      height={sizeClasses[size]}
      className={className}
      {...props}
    />
  );
};

const SkeletonCard = ({ className = '', ...props }) => (
  <div className={`p-4 border border-neutral-200 rounded-lg ${className}`} {...props}>
    <div className="flex items-center space-x-4 mb-4">
      <SkeletonAvatar size="md" />
      <div className="flex-1">
        <Skeleton variant="text" width="w-24" height="h-4" className="mb-2" />
        <Skeleton variant="text" width="w-16" height="h-3" />
      </div>
    </div>
    <SkeletonText lines={3} className="mb-4" />
    <div className="flex justify-between items-center">
      <SkeletonButton size="sm" />
      <Skeleton variant="text" width="w-12" height="h-4" />
    </div>
  </div>
);

const SkeletonCreatorCard = ({ className = '', ...props }) => (
  <div className={`glass-medium rounded-lg overflow-hidden ${className}`} {...props}>
    {/* Header image */}
    <Skeleton variant="rectangular" width="w-full" height="h-48" />
    
    <div className="p-4">
      {/* Creator info */}
      <div className="flex items-center space-x-3 mb-4">
        <SkeletonAvatar size="lg" />
        <div className="flex-1">
          <Skeleton variant="text" width="w-32" height="h-5" className="mb-2" />
          <Skeleton variant="text" width="w-20" height="h-4" />
        </div>
        <Skeleton variant="circular" width="w-6" height="h-6" />
      </div>
      
      {/* Specialties */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Skeleton variant="rounded" width="w-16" height="h-6" />
        <Skeleton variant="rounded" width="w-20" height="h-6" />
        <Skeleton variant="rounded" width="w-12" height="h-6" />
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <Skeleton variant="text" width="w-8" height="h-6" className="mx-auto mb-1" />
          <Skeleton variant="text" width="w-12" height="h-3" className="mx-auto" />
        </div>
        <div className="text-center">
          <Skeleton variant="text" width="w-8" height="h-6" className="mx-auto mb-1" />
          <Skeleton variant="text" width="w-12" height="h-3" className="mx-auto" />
        </div>
        <div className="text-center">
          <Skeleton variant="text" width="w-8" height="h-6" className="mx-auto mb-1" />
          <Skeleton variant="text" width="w-12" height="h-3" className="mx-auto" />
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex gap-2">
        <SkeletonButton size="md" className="flex-1" />
        <Skeleton variant="rounded" width="w-10" height="h-10" />
      </div>
    </div>
  </div>
);

const SkeletonList = ({ items = 3, className = '', renderItem, ...props }) => (
  <div className={`space-y-4 ${className}`} {...props}>
    {[...Array(items)].map((_, i) => 
      renderItem ? renderItem(i) : <SkeletonCard key={i} />
    )}
  </div>
);

const SkeletonGrid = ({ 
  items = 6, 
  columns = 3, 
  className = '', 
  renderItem,
  ...props 
}) => {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
  };

  return (
    <div className={`grid ${gridClasses[columns]} gap-4 ${className}`} {...props}>
      {[...Array(items)].map((_, i) => 
        renderItem ? renderItem(i) : <SkeletonCreatorCard key={i} />
      )}
    </div>
  );
};

const SkeletonNavigation = ({ className = '', ...props }) => (
  <div className={`flex items-center justify-between p-4 border-b border-neutral-200 ${className}`} {...props}>
    <div className="flex items-center space-x-4">
      <Skeleton variant="rounded" width="w-8" height="h-8" />
      <Skeleton variant="text" width="w-24" height="h-6" />
    </div>
    <div className="flex items-center space-x-3">
      <Skeleton variant="circular" width="w-8" height="h-8" />
      <Skeleton variant="circular" width="w-8" height="h-8" />
      <SkeletonAvatar size="sm" />
    </div>
  </div>
);

const SkeletonChatMessage = ({ isOwn = false, className = '', ...props }) => (
  <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4 ${className}`} {...props}>
    <div className={`flex ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end space-x-2`}>
      {!isOwn && <SkeletonAvatar size="sm" />}
      <div className={`max-w-xs ${isOwn ? 'ml-2' : 'mr-2'}`}>
        <Skeleton 
          variant="rounded" 
          width={isOwn ? 'w-32' : 'w-40'} 
          height="h-10" 
          className="mb-1"
        />
        <Skeleton variant="text" width="w-16" height="h-3" />
      </div>
    </div>
  </div>
);

const SkeletonChat = ({ messages = 5, className = '', ...props }) => (
  <div className={`space-y-2 ${className}`} {...props}>
    {[...Array(messages)].map((_, i) => (
      <SkeletonChatMessage key={i} isOwn={i % 3 === 0} />
    ))}
  </div>
);

// Enhanced skeleton with shimmer effect
const SkeletonShimmer = ({ className = '', children, ...props }) => (
  <div className={`relative overflow-hidden ${className}`} {...props}>
    {children}
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
  </div>
);

// Attach sub-components
Skeleton.Text = SkeletonText;
Skeleton.Avatar = SkeletonAvatar;
Skeleton.Button = SkeletonButton;
Skeleton.Card = SkeletonCard;
Skeleton.CreatorCard = SkeletonCreatorCard;
Skeleton.List = SkeletonList;
Skeleton.Grid = SkeletonGrid;
Skeleton.Navigation = SkeletonNavigation;
Skeleton.ChatMessage = SkeletonChatMessage;
Skeleton.Chat = SkeletonChat;
Skeleton.Shimmer = SkeletonShimmer;

export default Skeleton;