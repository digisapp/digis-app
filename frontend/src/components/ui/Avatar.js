// Avatar Component with intelligent loading and error handling

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import avatarService from '../../services/avatarService';
import { generateAvatar } from '../../utils/avatarGenerator';

const Avatar = ({
  user,
  size = 40,
  className = '',
  shape = 'circle',
  showOnlineStatus = false,
  showBadge = false,
  badge = null,
  onClick = null,
  loading = false,
  priority = false,
  animate = true
}) => {
  const [imageSrc, setImageSrc] = useState('');
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef(null);
  const observerRef = useRef(null);

  // Generate placeholder immediately
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    // Set placeholder first for immediate display
    const placeholder = avatarService.getPlaceholder(user);
    if (!cancelled) {
      setImageSrc(placeholder);
    }

    // Only load if priority is set
    if (priority) {
      loadAvatar(cancelled);
    }

    return () => {
      cancelled = true;
    };
  }, [user?.id, size, shape, priority]); // Use user.id instead of whole user object

  const loadAvatar = async (cancelled = false) => {
    if (!user) return;

    let isCancelled = cancelled;

    if (!isCancelled) {
      setImageLoading(true);
      setImageError(false);
    }

    try {
      // Get avatar URL from service (with caching)
      const avatarUrl = await avatarService.getAvatar(user, { size, shape });

      // Check if cancelled before setting state
      if (isCancelled) return;

      // Validate URL if it's external
      const validatedUrl = avatarUrl.startsWith('data:')
        ? avatarUrl
        : avatarService.validateAvatarUrl(avatarUrl) || avatarUrl;

      if (!isCancelled) {
        setImageSrc(validatedUrl);
      }
    } catch (error) {
      if (!isCancelled) {
        console.error('Failed to load avatar:', error);
        handleImageError();
      }
    } finally {
      if (!isCancelled) {
        setImageLoading(false);
      }
    }
  };

  const handleImageError = () => {
    setImageError(true);
    // Generate fallback avatar
    const username = user?.username || user?.display_name || 'User';
    const category = user?.creator_type || null;
    const fallbackAvatar = generateAvatar(username, category, size, shape);
    setImageSrc(fallbackAvatar);
    setImageLoading(false);
  };

  // Setup lazy loading with Intersection Observer
  useEffect(() => {
    if (priority || !imgRef.current) return;

    let cancelled = false;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !cancelled) {
            loadAvatar(cancelled);
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '50px' }
    );

    observerRef.current.observe(imgRef.current);

    return () => {
      cancelled = true;
      if (observerRef.current && imgRef.current) {
        observerRef.current.unobserve(imgRef.current);
      }
      observerRef.current?.disconnect();
    };
  }, [priority]);

  // Determine online status
  const isOnline = user?.is_online || user?.isOnline || false;
  const isLive = user?.is_live || user?.isLive || user?.isStreaming || false;

  // Container styles
  const containerStyles = {
    width: size,
    height: size,
    position: 'relative',
    display: 'inline-block'
  };

  const imageStyles = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: shape === 'circle' ? '50%' : '0.5rem',
    backgroundColor: imageLoading ? '#E5E7EB' : 'transparent'
  };

  const AnimationWrapper = animate ? motion.div : 'div';
  const animationProps = animate ? {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.3 }
  } : {};

  return (
    <AnimationWrapper 
      style={containerStyles}
      className={`avatar-container ${className}`}
      onClick={onClick}
      {...animationProps}
    >
      {/* Main Avatar Image */}
      <img
        ref={imgRef}
        src={imageSrc}
        alt={`${user?.username || 'User'} avatar`}
        style={imageStyles}
        className={`avatar-image ${onClick ? 'cursor-pointer hover:opacity-90' : ''}`}
        onError={handleImageError}
        onLoad={() => setImageLoading(false)}
        loading={priority ? 'eager' : 'lazy'}
      />

      {/* Loading Overlay */}
      {imageLoading && !imageSrc.startsWith('data:') && (
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderRadius: shape === 'circle' ? '50%' : '0.5rem'
          }}
        >
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-transparent" />
        </div>
      )}

      {/* Online Status Indicator */}
      {showOnlineStatus && (isOnline || isLive) && (
        <div
          className={`absolute bottom-0 right-0 border-2 border-white ${
            isLive ? 'bg-red-500 animate-pulse' : 'bg-green-500'
          }`}
          style={{
            width: size * 0.25,
            height: size * 0.25,
            borderRadius: '50%',
            minWidth: '10px',
            minHeight: '10px',
            maxWidth: '16px',
            maxHeight: '16px'
          }}
        />
      )}

      {/* Badge Overlay */}
      {showBadge && badge && (
        <div
          className="absolute -top-1 -right-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full px-2 py-1"
          style={{
            fontSize: Math.max(10, size * 0.2),
            minWidth: size * 0.4
          }}
        >
          {badge}
        </div>
      )}
    </AnimationWrapper>
  );
};

// Memoized version for performance
export const MemoizedAvatar = React.memo(Avatar, (prevProps, nextProps) => {
  return (
    prevProps.user?.id === nextProps.user?.id &&
    prevProps.user?.profile_pic_url === nextProps.user?.profile_pic_url &&
    prevProps.user?.avatar_url === nextProps.user?.avatar_url &&
    prevProps.size === nextProps.size &&
    prevProps.shape === nextProps.shape &&
    prevProps.showOnlineStatus === nextProps.showOnlineStatus &&
    prevProps.showBadge === nextProps.showBadge &&
    prevProps.badge === nextProps.badge
  );
});

// Avatar Group Component for showing multiple avatars
export const AvatarGroup = ({ users = [], max = 3, size = 32, onClick }) => {
  const displayUsers = users.slice(0, max);
  const remainingCount = Math.max(0, users.length - max);

  return (
    <div className="flex -space-x-2">
      {displayUsers.map((user, index) => (
        <div
          key={user.id || index}
          className="relative"
          style={{ zIndex: max - index }}
        >
          <Avatar
            user={user}
            size={size}
            className="border-2 border-white"
            animate={false}
          />
        </div>
      ))}
      {remainingCount > 0 && (
        <div
          className="relative flex items-center justify-center bg-gray-300 text-gray-700 font-medium text-sm border-2 border-white"
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            zIndex: 0,
            cursor: onClick ? 'pointer' : 'default'
          }}
          onClick={onClick}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
};

export default Avatar;