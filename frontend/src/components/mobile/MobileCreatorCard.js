import React, { useState, memo, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import PropTypes from 'prop-types';
import {
  ChatBubbleLeftRightIcon,
  VideoCameraIcon,
  GiftIcon,
  StarIcon as StarIconSolid,
  CheckBadgeIcon,
  UserGroupIcon
} from '@heroicons/react/24/solid';
import {
  StarIcon as StarIconOutline
} from '@heroicons/react/24/outline';

// Module-level image cache for performance (capped to prevent memory leaks)
const MAX_CACHE_SIZE = 300;
const imgCache = new Map();

const addToCache = (key) => {
  imgCache.set(key, true);
  // Remove oldest entry if cache exceeds max size
  if (imgCache.size > MAX_CACHE_SIZE) {
    const firstKey = imgCache.keys().next().value;
    imgCache.delete(firstKey);
  }
};

// Lazy loading hook with IntersectionObserver
const useLazyLoad = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.unobserve(element);
        }
      },
      {
        rootMargin: options.rootMargin || '50px',
        threshold: options.threshold || 0.01
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [options.rootMargin, options.threshold]);

  return [ref, isIntersecting];
};

// Image optimization component with caching
const OptimizedImage = memo(({ src, alt, className, onLoad, sizes }) => {
  const cached = imgCache.get(src);
  const [imgSrc, setImgSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(!cached);

  const handleLoad = () => {
    addToCache(src);
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    // Use local fallback with initials instead of external service
    const initials = alt ? alt.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '??';
    // Data URI fallback with initials
    setImgSrc(`data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%239333ea"/><text x="50" y="50" font-family="system-ui" font-size="40" fill="white" text-anchor="middle" dy="0.35em">${initials}</text></svg>`);
  };

  return (
    <>
      {isLoading && (
        <div className={`${className} bg-gradient-to-br from-purple-400 to-pink-400 animate-pulse`} />
      )}
      <img
        src={imgSrc}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
        decoding="async"
        sizes={sizes}
      />
    </>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

// Main card component - unified version
const MobileCreatorCard = memo(({
  creator,
  variant = 'grid', // 'grid', 'compact', 'featured', 'default' (alias for grid)
  onSelect,
  onMessage,
  onCall,
  onVideoCall,
  onTip,
  onSaveCreator,
  showPricing = true,
  className = ''
}) => {
  // Handle legacy 'default' variant
  const cardVariant = variant === 'default' ? 'grid' : variant;

  const [cardRef, isVisible] = useLazyLoad();
  const [isSaved, setIsSaved] = useState(false);

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Intl formatter for follower counts (i18n ready)
  const compactNum = useMemo(
    () => new Intl.NumberFormat(undefined, {
      notation: 'compact',
      maximumFractionDigits: 1
    }),
    []
  );

  // Haptic feedback with SSR/desktop guard
  const hapticFeedback = useCallback((type = 'light') => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30],
        success: [10, 20, 10]
      };
      navigator.vibrate(patterns[type] || patterns.light);
    }
  }, []);

  const handleTip = useCallback((e) => {
    e.stopPropagation();
    hapticFeedback('light');
    onTip?.(creator);
  }, [creator, onTip, hapticFeedback]);

  const handleSave = useCallback((e) => {
    e.stopPropagation();
    setIsSaved(!isSaved);
    hapticFeedback('medium');
    onSaveCreator?.(creator, !isSaved);
  }, [isSaved, creator, onSaveCreator, hapticFeedback]);

  const handleMessage = useCallback((e) => {
    e.stopPropagation();
    hapticFeedback('light');
    onMessage?.(creator);
  }, [creator, onMessage, hapticFeedback]);

  const handleVideoCall = useCallback((e) => {
    e.stopPropagation();
    hapticFeedback('light');
    // Support both onVideoCall and onCall for backwards compatibility
    (onVideoCall || onCall)?.(creator);
  }, [creator, onVideoCall, onCall, hapticFeedback]);

  const handleSelect = useCallback(() => {
    hapticFeedback('light');
    onSelect?.(creator);
  }, [creator, onSelect, hapticFeedback]);

  // Keyboard navigation support for accessibility
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect();
    }
  }, [handleSelect]);

  // Get display data with fallbacks
  const displayData = useMemo(() => {
    const category = creator?.category || creator?.creator_type || 'Content Creator';
    const username = creator?.username || '';
    const email = creator?.email || '';

    // Get the best available display name
    let name = creator?.displayName || creator?.display_name || '';

    // If no display name, try to use something meaningful
    if (!name) {
      // Extract name from email if available (e.g., "john.doe@email.com" -> "John Doe")
      if (email && email.includes('@')) {
        const emailName = email.split('@')[0]
          .replace(/[._-]/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        name = emailName;
      } else if (username) {
        // Format username nicely if that's all we have
        name = username.charAt(0).toUpperCase() + username.slice(1);
      } else {
        // Last resort - but avoid using the category as the name
        name = 'Anonymous Creator';
      }
    }

    // Still check if name ended up being the same as category
    if (name.toLowerCase() === category.toLowerCase() ||
        name.toLowerCase() === 'creator' ||
        name.toLowerCase() === 'content creator') {
      name = username ? username.charAt(0).toUpperCase() + username.slice(1) : 'Anonymous';
    }

    // Normalize username (remove @ if present)
    const cleanUsername = username?.startsWith('@') ? username.slice(1) : username;

    return {
      name,
      username: cleanUsername,
      category,
      bio: creator?.bio || '',
      followers: Number(creator?.followers || creator?.follower_count || 0),
      isVerified: creator?.isVerified || creator?.is_verified || false,
      isLive: creator?.isLive || creator?.is_live || false,
      isOnline: creator?.isOnline || creator?.is_online || false,
      avatar: creator?.avatar || creator?.avatar_url || creator?.profile_pic_url,
      voiceRate: creator?.voiceCallRate || creator?.voice_call_rate || 50,
      videoRate: creator?.videoCallRate || creator?.video_call_rate || 100,
      messageRate: creator?.messageRate || creator?.message_rate || 10,
      availableForCalls: creator?.availableForCalls || creator?.available_for_calls || false
    };
  }, [creator]);

  // Card animation variants with reduced motion support
  const cardVariants = prefersReducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 }, tap: { scale: 1 } }
    : {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
        tap: { scale: 0.98 }
      };

  // Grid variant - Desktop-style with glass morphism
  if (cardVariant === 'grid') {
    return (
      <motion.div
        ref={cardRef}
        className={`relative rounded-2xl overflow-hidden bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 ${className}`}
        variants={cardVariants}
        initial="hidden"
        animate={isVisible ? "visible" : "hidden"}
        whileTap="tap"
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`${displayData.name}, ${displayData.category} creator`}
      >
        {!isVisible ? (
          <div className="w-full aspect-[9/16] bg-gradient-to-br from-purple-200 to-pink-200 animate-pulse" />
        ) : (
          <>
            {/* Main Image Container */}
            <div className="relative aspect-[9/16] overflow-hidden bg-gradient-to-br from-purple-400 via-pink-400 to-purple-500">
              <OptimizedImage
                src={displayData.avatar}
                alt={displayData.name}
                className="absolute inset-0 w-full h-full object-cover"
                sizes="(max-width: 480px) 50vw, (max-width: 768px) 33vw, 300px"
              />

              {/* Gradient Overlay for Text Readability */}
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

              {/* Save Button - Top Right */}
              <button
                type="button"
                onClick={handleSave}
                className="absolute right-3 top-3 h-10 w-10 grid place-items-center rounded-full
                         border border-white/40 bg-white/90 backdrop-blur-md shadow-md
                         hover:bg-white hover:scale-110 transition-all"
                aria-label={isSaved ? "Unsave creator" : "Save creator"}
                aria-pressed={isSaved}
              >
                {isSaved ? (
                  <StarIconSolid className="w-5 h-5 text-yellow-500" />
                ) : (
                  <StarIconOutline className="w-5 h-5 text-gray-600" />
                )}
              </button>

              {/* Status Badges */}
              {displayData.isLive ? (
                <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-red-600/95 px-2.5 py-1 text-[11px] font-bold text-white shadow-md backdrop-blur-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </div>
              ) : displayData.isOnline ? (
                <span className="absolute left-3 top-3 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow-md" />
              ) : null}

              {/* Glass Morphism Bottom Card */}
              <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/10
                            bg-black/40 backdrop-blur-xl p-3">
                {/* Two-line name lockup */}
                <div className="mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-semibold text-sm truncate">
                      {displayData.name}
                    </span>
                    {displayData.isVerified && (
                      <CheckBadgeIcon className="h-4 w-4 text-sky-400 flex-shrink-0" />
                    )}
                  </div>
                  {displayData.username && (
                    <div className="text-xs text-white/70 truncate">@{displayData.username}</div>
                  )}
                </div>

                {/* Followers count only (no ratings) */}
                <div className="mb-2.5 text-[11px] text-white/90 flex items-center gap-1">
                  <UserGroupIcon className="h-3.5 w-3.5" />
                  <span>{compactNum.format(displayData.followers || 0)}</span>
                </div>

                {/* Icon-Only Action Buttons */}
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      hapticFeedback('light');
                      onVideoCall?.(creator);
                    }}
                    aria-label="Start video call"
                    className="min-h-[38px] rounded-xl border border-white/20 bg-white/20 backdrop-blur-md
                             p-2 transition-all hover:bg-white/30 hover:scale-105 active:scale-95"
                  >
                    <VideoCameraIcon className="w-4 h-4 text-white mx-auto" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      hapticFeedback('light');
                      onMessage?.(creator);
                    }}
                    aria-label="Send message"
                    className="min-h-[38px] rounded-xl border border-white/20 bg-white/20 backdrop-blur-md
                             p-2 transition-all hover:bg-white/30 hover:scale-105 active:scale-95"
                  >
                    <ChatBubbleLeftRightIcon className="w-4 h-4 text-white mx-auto" />
                  </button>

                  <button
                    type="button"
                    onClick={handleTip}
                    aria-label="Send gift"
                    className="min-h-[38px] rounded-xl border border-white/20 bg-white/20 backdrop-blur-md
                             p-2 transition-all hover:bg-white/30 hover:scale-105 active:scale-95"
                  >
                    <GiftIcon className="w-4 h-4 text-white mx-auto" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </motion.div>
    );
  }

  // Compact variant - Horizontal card with stable layout
  if (cardVariant === 'compact') {
    return (
      <motion.div
        ref={cardRef}
        className={`flex items-center gap-3 p-3 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 ${className}`}
        variants={cardVariants}
        initial="hidden"
        animate={isVisible ? "visible" : "hidden"}
        whileTap="tap"
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`${displayData.name}, ${displayData.category} creator`}
      >
        {/* Avatar container with fixed dimensions to prevent layout shift */}
        <div className="relative w-14 h-14 flex-shrink-0">
          {!isVisible ? (
            <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-200 to-pink-200 animate-pulse" />
          ) : (
            <>
              <OptimizedImage
                src={displayData.avatar}
                alt={displayData.name}
                className="absolute inset-0 w-full h-full rounded-full object-cover ring-2 ring-purple-100"
                sizes="56px"
              />
              {displayData.isLive && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center ring-2 ring-white">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                </div>
              )}
              {displayData.isOnline && !displayData.isLive && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full ring-2 ring-white" />
              )}
            </>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h3 className="font-semibold text-gray-900 truncate">{displayData.name}</h3>
            {displayData.isVerified && (
              <CheckBadgeIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-gray-500 truncate">{displayData.category}</p>
          {displayData.bio && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{displayData.bio}</p>
          )}
        </div>

        {/* Quick actions with proper tap targets */}
        <div className="flex gap-2">
          {displayData.availableForCalls && (
            <button
              type="button"
              onClick={handleVideoCall}
              className="bg-purple-600 text-white p-3 rounded-lg hover:bg-purple-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Start video call"
            >
              <VideoCameraIcon className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={handleMessage}
            className="bg-gray-100 text-gray-700 p-3 rounded-lg hover:bg-gray-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Send message"
          >
            <ChatBubbleLeftIcon className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  // Featured variant - Large hero card
  if (cardVariant === 'featured') {
    return (
      <motion.div
        ref={cardRef}
        className={`relative bg-white rounded-3xl overflow-hidden shadow-2xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 ${className}`}
        variants={cardVariants}
        initial="hidden"
        animate={isVisible ? "visible" : "hidden"}
        whileTap="tap"
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`${displayData.name}, ${displayData.category} creator - Featured`}
      >
        {!isVisible ? (
          <div className="w-full h-64 bg-gradient-to-br from-purple-200 to-pink-200 animate-pulse" />
        ) : (
          <>
            {/* Background image with proper sizing */}
            <div className="relative h-64 overflow-hidden">
              <OptimizedImage
                src={displayData.avatar}
                alt={displayData.name}
                className="absolute inset-0 w-full h-full object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />

              {/* Status badges - suppress online when live */}
              <div className="absolute top-4 left-4 flex gap-2">
                {displayData.isLive && (
                  <div className="bg-red-500 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    LIVE NOW
                  </div>
                )}
              </div>

              {/* Creator info */}
              <div className="absolute bottom-4 left-4 right-4 text-white pointer-events-none">
                <h2 className="text-2xl font-bold mb-1 flex items-center gap-1.5">
                  {displayData.name}
                  {displayData.isVerified && (
                    <CheckBadgeIcon className="w-6 h-6 text-blue-400" />
                  )}
                </h2>
                <p className="text-sm opacity-90 mb-2 truncate">@{displayData.username} • {displayData.category}</p>
                {displayData.bio && (
                  <p className="text-sm opacity-80 line-clamp-2">{displayData.bio}</p>
                )}
              </div>
            </div>

            {/* Action section with proper tap targets */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  {displayData.followers > 0 && (
                    <span className="font-semibold flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                      {compactNum.format(displayData.followers)}
                    </span>
                  )}
                  {displayData.isOnline && !displayData.isLive && (
                    <span className="flex items-center gap-1 text-green-600">
                      <span className="w-2 h-2 bg-green-600 rounded-full" />
                      Online now
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleVideoCall}
                  className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors min-h-[44px]"
                  aria-label="Start video call"
                >
                  <VideoCameraIcon className="w-5 h-5" />
                  Start Video Call
                  {showPricing && <span className="text-sm opacity-90">• ${displayData.videoRate}/min</span>}
                </button>
                <button
                  type="button"
                  onClick={handleTip}
                  className="bg-green-100 text-green-700 px-4 rounded-xl font-semibold hover:bg-green-200 transition-colors min-h-[44px] flex items-center justify-center gap-2"
                  aria-label="Send tip"
                >
                  <CurrencyDollarIcon className="w-5 h-5" />
                  Tip
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    );
  }

  return null;
});

MobileCreatorCard.displayName = 'MobileCreatorCard';

// PropTypes for better type safety and documentation
MobileCreatorCard.propTypes = {
  creator: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    displayName: PropTypes.string,
    username: PropTypes.string,
    avatar: PropTypes.string,
    avatar_url: PropTypes.string,
    profile_pic_url: PropTypes.string,
    category: PropTypes.string,
    creator_type: PropTypes.string,
    bio: PropTypes.string,
    followers: PropTypes.number,
    follower_count: PropTypes.number,
    isVerified: PropTypes.bool,
    is_verified: PropTypes.bool,
    isLive: PropTypes.bool,
    is_live: PropTypes.bool,
    isOnline: PropTypes.bool,
    is_online: PropTypes.bool,
    isFollowing: PropTypes.bool,
    voiceCallRate: PropTypes.number,
    voice_call_rate: PropTypes.number,
    videoCallRate: PropTypes.number,
    video_call_rate: PropTypes.number,
    messageRate: PropTypes.number,
    message_rate: PropTypes.number,
    availableForCalls: PropTypes.bool,
    available_for_calls: PropTypes.bool
  }),
  variant: PropTypes.oneOf(['grid', 'compact', 'featured', 'default']),
  onSelect: PropTypes.func,
  onMessage: PropTypes.func,
  onCall: PropTypes.func,
  onVideoCall: PropTypes.func,
  onTip: PropTypes.func,
  onSaveCreator: PropTypes.func,
  showPricing: PropTypes.bool,
  className: PropTypes.string
};

export default MobileCreatorCard;