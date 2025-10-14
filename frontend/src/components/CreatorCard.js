// src/components/CreatorCard.js
import { motion } from 'framer-motion';
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlusIcon, VideoCameraIcon, PhoneIcon, ChatBubbleLeftRightIcon, GiftIcon, CheckBadgeIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { UserPlusIcon as UserPlusIconSolid, CheckBadgeIcon as CheckBadgeIconSolid } from '@heroicons/react/24/solid';
import { getAuthToken } from '../utils/auth-helpers';
import toast from 'react-hot-toast';
import CallRequestModal from './CallRequestModal';
import CallConfirmationModal from './CallConfirmationModal';
import MessageComposeModal from './MessageComposeModal';
import TipModal from './TipModal';
import { addBreadcrumb } from '../lib/sentry.client';
import {
  getStatusBadges,
  getCategoryGradient,
  formatCompactNumber,
  getResponsiveImageUrls,
  prefersReducedMotion
} from '../utils/creatorNormalizer';

// Language flag mapping
const languageFlags = {
  'English': '🇺🇸',
  'Spanish': '🇪🇸',
  'French': '🇫🇷',
  'German': '🇩🇪',
  'Italian': '🇮🇹',
  'Portuguese': '🇵🇹',
  'Russian': '🇷🇺',
  'Chinese': '🇨🇳',
  'Japanese': '🇯🇵',
  'Korean': '🇰🇷',
  'Arabic': '🇸🇦',
  'Hindi': '🇮🇳'
};

const CreatorCard = ({
  creator,
  onJoinSession,
  disabled,
  showTipButton,
  onTip,
  onMessage,
  isSaved,
  onToggleSave,
  onFollowToggle,
  currentUserId,
  tokenBalance,
  isDashboard,
  onOpenPricingModal,
  onCardClick,
  viewMode = 'card', // 'card', 'compact', or 'grid'
  isLazyLoaded = false,
  enableVideo = true,
  aspectRatio = '9:16' // '9:16', '1:1', '4:5'
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFollowing, setIsFollowing] = useState(creator.isFollowing || false);
  const [isLoadingFollow, setIsLoadingFollow] = useState(false);
  const [followerCount, setFollowerCount] = useState(creator.followerCount || creator.followers || 0);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const videoRef = useRef(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [isVisible, setIsVisible] = useState(!isLazyLoaded);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showMessageComposeModal, setShowMessageComposeModal] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const navigate = useNavigate();
  const cardRef = useRef(null);
  const videoTimeoutRef = useRef(null);
  const navigatingRef = useRef(false); // Guard against double navigation on rapid clicks
  const reducedMotion = prefersReducedMotion();

  // Check if creator has preview video
  useEffect(() => {
    if (creator.preview_video_url && enableVideo) {
      setHasVideo(true);
    }
  }, [creator.preview_video_url, enableVideo]);

  // Lazy loading with IntersectionObserver
  useEffect(() => {
    if (!isLazyLoaded || isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [isLazyLoaded]);

  // Auto-play video on hover (desktop) or tap (mobile)
  useEffect(() => {
    if (videoRef.current && hasVideo) {
      // Desktop: hover to play
      if (isHovered && window.matchMedia('(hover: hover)').matches) {
        videoRef.current.play().catch(err => console.log('Video play failed:', err));
        setIsVideoPlaying(true);
      }
      // Mobile: tap to preview
      else if (showVideoPreview) {
        videoRef.current.play().catch(err => console.log('Video play failed:', err));
        setIsVideoPlaying(true);

        // Auto-pause after 5 seconds
        videoTimeoutRef.current = setTimeout(() => {
          setShowVideoPreview(false);
          if (videoRef.current) {
            videoRef.current.pause();
            setIsVideoPlaying(false);
          }
        }, 5000);
      } else {
        videoRef.current.pause();
        setIsVideoPlaying(false);
      }
    }

    return () => {
      if (videoTimeoutRef.current) {
        clearTimeout(videoTimeoutRef.current);
      }
    };
  }, [isHovered, hasVideo, showVideoPreview]);

  const handleServiceClick = (serviceType) => {
    // If this is in the dashboard, open pricing modal instead of initiating service
    if (isDashboard && onOpenPricingModal) {
      onOpenPricingModal();
    } else if (!disabled && onJoinSession) {
      onJoinSession(serviceType);
    }
  };

  const handleFollowClick = async (e) => {
    e.preventDefault(); // Prevent Link navigation
    e.stopPropagation(); // Stop event from bubbling to card

    if (isLoadingFollow) return;
    
    // Optimistic updates
    const previousFollowState = isFollowing;
    const previousFollowerCount = followerCount;
    
    setIsLoadingFollow(true);
    setIsFollowing(!isFollowing);
    setFollowerCount(prev => isFollowing ? Math.max(0, prev - 1) : prev + 1);
    
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ creatorUsername: creator.username })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.action === 'followed' ? 'Following creator!' : 'Unfollowed creator');
        
        if (onFollowToggle) {
          onFollowToggle(creator.id, data.action === 'followed');
        }
      } else {
        // Revert optimistic updates on failure
        setIsFollowing(previousFollowState);
        setFollowerCount(previousFollowerCount);
        toast.error('Failed to update follow status');
      }
    } catch (error) {
      console.error('Follow error:', error);
      // Revert optimistic updates on error
      setIsFollowing(previousFollowState);
      setFollowerCount(previousFollowerCount);
      toast.error('Failed to update follow status');
    } finally {
      setIsLoadingFollow(false);
    }
  };

  // Import avatar service at the top of component
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarLoading, setAvatarLoading] = useState(true);
  
  // Load avatar using the service
  useEffect(() => {
    const loadAvatar = async () => {
      const { generateAvatar } = await import('../utils/avatarGenerator');
      const avatarService = (await import('../services/avatarService')).default;
      
      // Use existing image if available, otherwise generate
      if (creator.profile_pic_url || creator.profilePicUrl) {
        setAvatarUrl(creator.profile_pic_url || creator.profilePicUrl);
      } else {
        // Generate avatar locally
        const generated = generateAvatar(
          creator.username || 'Creator',
          creator.creator_type || creator.category,
          400,
          'circle'
        );
        setAvatarUrl(generated);
      }
      setAvatarLoading(false);
    };
    
    loadAvatar();
  }, [creator]);
  
  const creatorImage = avatarUrl;
  const imageData = getResponsiveImageUrls(creatorImage);
  const { isLive, isOnline } = getStatusBadges(creator);
  const categoryGradient = getCategoryGradient(creator.category || creator.creator_type);

  // Profile path for navigation - fallback gracefully if no username
  // Use encodeURIComponent for safety with special chars (dots, non-ASCII, etc.)
  const handle = (creator.username || creator.slug || '').toLowerCase();
  const profilePath = handle ? `/creator/${encodeURIComponent(handle)}` : null;

  // Prefetch profile on hover for snappier navigation
  const prefetchProfile = useCallback(() => {
    if (!handle) return;

    // Fire-and-forget prefetch (snappier subsequent navigation)
    const BASE_URL = import.meta.env.VITE_BACKEND_URL || '';
    fetch(`${BASE_URL}/api/public/creators/${encodeURIComponent(handle)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => {
      // Silently fail - this is just a performance optimization
    });
  }, [handle]);

  // Dev warning for missing username/slug
  useEffect(() => {
    if (!profilePath && !creator.username && !creator.slug && import.meta.env.DEV) {
      console.warn('[CreatorCard] Missing username/slug for creator:', {
        id: creator.id,
        displayName: creator.displayName,
        supabase_id: creator.supabase_id
      });
    }
  }, [profilePath, creator]);

  // Get aspect ratio class
  const getAspectRatioClass = () => {
    switch(aspectRatio) {
      case '1:1': return 'aspect-square';
      case '4:5': return 'aspect-[4/5]';
      case '9:16': return 'aspect-[9/16]';
      default: return 'aspect-[9/16]';
    }
  };

  // Get aspect ratio padding for skeleton loader
  const getAspectRatioPadding = () => {
    switch(aspectRatio) {
      case '1:1': return '100%';
      case '4:5': return '125%';
      case '9:16': return '177.77%';
      default: return '177.77%';
    }
  };

  // Handle service click with modals
  const handleServiceClickEnhanced = (serviceType) => {
    if (isDashboard && onOpenPricingModal) {
      onOpenPricingModal();
    } else {
      // For message, show the message compose modal instead of confirmation
      if (serviceType === 'message') {
        setShowMessageComposeModal(true);
      } else {
        // For video and voice calls, show confirmation modal
        setSelectedServiceType(serviceType);
        setShowConfirmationModal(true);
      }
    }
  };

  // Handle confirmation
  const handleConfirmService = async (sessionData) => {
    setShowConfirmationModal(false);
    if (onJoinSession) {
      onJoinSession(selectedServiceType, sessionData);
    }
  };

  // Render based on view mode
  if (viewMode === 'compact') {
    return (
      <div className="flex items-center gap-3 p-3 bg-white rounded-lg hover:shadow-md transition-shadow cursor-pointer" onClick={onCardClick}>
        <img src={creatorImage} alt={creator.username} className="w-12 h-12 rounded-full object-cover" />
        <div className="flex-1">
          <h4 className="font-semibold">{creator.username}</h4>
          <p className="text-sm text-gray-500">{creator.category}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={(e) => { e.stopPropagation(); handleServiceClickEnhanced('video'); }} className="p-2 bg-blue-100 rounded-lg hover:bg-blue-200">
            <VideoCameraIcon className="w-4 h-4 text-blue-600" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleServiceClickEnhanced('message'); }} className="p-2 bg-purple-100 rounded-lg hover:bg-purple-200">
            <ChatBubbleLeftRightIcon className="w-4 h-4 text-purple-600" />
          </button>
        </div>
      </div>
    );
  }

  if (!isVisible && isLazyLoaded) {
    return <div ref={cardRef} className="animate-pulse bg-gray-200 rounded-2xl" style={{ paddingBottom: getAspectRatioPadding() }} />;
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: reducedMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.5, delay: reducedMotion ? 0 : 0.1 * (creator.id || 0) }}
      whileHover={reducedMotion ? {} : { y: -4, scale: 1.01 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={(e) => {
        // Only trigger card click if not clicking on a button or interactive element
        const target = e.target;
        const isButton = target.closest('button');
        const isInteractive = target.closest('a, input, textarea, select');

        console.log('CreatorCard clicked:', {
          hasOnCardClick: !!onCardClick,
          isButton: !!isButton,
          isInteractive: !!isInteractive,
          creator: creator.username,
          target: e.target.tagName
        });

        if (onCardClick && !isButton && !isInteractive) {
          console.log('✅ Triggering onCardClick for creator:', creator.username);
          e.preventDefault();
          e.stopPropagation();
          onCardClick();
        } else if (!onCardClick) {
          console.warn('❌ No onCardClick handler provided for creator:', creator.username);
        }
      }}
      className={`
        relative cursor-pointer overflow-hidden rounded-2xl bg-white
        shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all will-change-transform
        hover:shadow-[0_20px_40px_rgba(0,0,0,0.15)]
        focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2
      `}
    >
      {/* Main Image Container - Wrapped in Link for reliable navigation */}
      {profilePath ? (
        <Link
          to={profilePath}
          className={`block relative ${getAspectRatioClass()} overflow-hidden bg-gradient-to-br ${categoryGradient} focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2`}
          onMouseEnter={prefetchProfile}
          onFocus={prefetchProfile}
          onClick={(e) => {
            // Guard against double navigation on rapid clicks
            if (navigatingRef.current) return;
            navigatingRef.current = true;
            setTimeout(() => { navigatingRef.current = false; }, 1000);

            // Analytics: Track card click
            addBreadcrumb('creator_card_click', {
              handle: creator.username,
              origin: 'explore',
              category: 'navigation'
            });

            if (onCardClick) {
              onCardClick();
            }
            console.log('🔗 Navigating to profile:', profilePath);
          }}
          aria-label={`View ${creator.displayName || creator.username}'s profile`}
          title={`View @${creator.username}'s profile`}
        >
        {/* Video-First: Show video if available, otherwise image */}
        {hasVideo && creator.preview_video_url ? (
          <>
            <video
              ref={videoRef}
              src={creator.preview_video_url}
              poster={creatorImage}
              muted
              loop
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Mobile play button */}
            {!window.matchMedia('(hover: hover)').matches && !showVideoPreview && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowVideoPreview(true);
                }}
                className="absolute inset-0 flex items-center justify-center bg-black/20"
                aria-label="Play preview video"
              >
                <div className="rounded-full bg-white/90 p-4 shadow-lg">
                  <svg className="h-8 w-8 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </button>
            )}
          </>
        ) : (
          <img
            src={imageData?.src || creatorImage}
            srcSet={imageData?.srcSet}
            sizes={imageData?.sizes}
            alt={`${creator.displayName || creator.username} profile`}
            className="absolute inset-0 h-full w-full object-cover"
            width={640}
            height={aspectRatio === '1:1' ? 640 : aspectRatio === '4:5' ? 800 : 1136}
            loading="lazy"
            decoding="async"
            onError={async (e) => {
              const { generateAvatar } = await import('../utils/avatarGenerator');
              e.target.src = generateAvatar(
                creator.username || 'Creator',
                creator.creator_type || creator.category,
                400,
                'circle'
              );
            }}
          />
        )}

        {/* Gradient Overlay for Text Readability */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

        {/* Follow Button - Top Right */}
        <button
          type="button"
          onClick={handleFollowClick}
          disabled={isLoadingFollow}
          aria-pressed={isFollowing}
          aria-label={isFollowing ? 'Unfollow creator' : 'Follow creator'}
          className="absolute right-3 top-3 p-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                   hover:scale-110 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 z-20"
        >
          {isFollowing ? (
            <UserPlusIconSolid className="w-6 h-6 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
          ) : (
            <UserPlusIcon className="w-6 h-6 text-white drop-shadow-md" />
          )}
        </button>

        {/* Status Badges with Precedence */}
        {isLive ? (
          <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-red-600/95 px-2.5 py-1 text-[11px] font-bold text-white shadow-md backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </div>
        ) : isOnline ? (
          <span className="absolute left-3 top-3 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow-md" />
        ) : null}

        {/* Glass Morphism Bottom Card - Better Hierarchy */}
        <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/10
                      bg-black/40 backdrop-blur-xl p-3 z-20">
          {/* Two-line name lockup */}
          <div className="mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-semibold text-sm truncate">
                {creator.displayName || creator.username}
              </span>
              {creator.is_verified && (
                <CheckBadgeIconSolid className="h-4 w-4 text-sky-400 flex-shrink-0" />
              )}
            </div>
            <div className="text-xs text-white/70 truncate">@{creator.username}</div>
          </div>

          {/* Followers count only */}
          <div className="mb-2.5 text-[11px] text-white/90 flex items-center gap-1">
            <UserGroupIcon className="h-3.5 w-3.5" />
            <span>{formatCompactNumber(creator.followerCount || creator.followers || 0)}</span>
          </div>

          {/* Icon-Only Action Buttons with Accessibility */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleServiceClickEnhanced('video');
              }}
              disabled={disabled}
              aria-label="Start video call"
              title="Video Call"
              className="min-h-[44px] rounded-xl border border-white/20 bg-white/20 backdrop-blur-md
                       p-2.5 transition-all hover:bg-white/30 hover:scale-105 active:scale-95
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <VideoCameraIcon className="w-5 h-5 text-white mx-auto" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleServiceClickEnhanced('message');
              }}
              disabled={disabled}
              aria-label="Send message"
              title="Message"
              className="min-h-[44px] rounded-xl border border-white/20 bg-white/20 backdrop-blur-md
                       p-2.5 transition-all hover:bg-white/30 hover:scale-105 active:scale-95
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5 text-white mx-auto" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowTipModal(true);
              }}
              disabled={disabled}
              aria-label="Send gift"
              title="Send Gift"
              className="min-h-[44px] rounded-xl border border-white/20 bg-white/20 backdrop-blur-md
                       p-2.5 transition-all hover:bg-white/30 hover:scale-105 active:scale-95
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <GiftIcon className="w-5 h-5 text-white mx-auto" />
            </button>
          </div>
        </div>

        {/* Hover Details Overlay */}
        {isHovered && creator.bio && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '12px',
            right: '12px',
            transform: 'translateY(-50%)',
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(20px)',
            borderRadius: '12px',
            padding: '16px',
            color: 'white',
            zIndex: 10,
            pointerEvents: 'none',
            animation: 'fadeIn 0.3s ease'
          }}>
            <p style={{ fontSize: '13px', lineHeight: '1.5', marginBottom: '8px' }}>
              {creator.bio}
            </p>
            {(creator.state || creator.country) && (
              <p style={{ fontSize: '11px', opacity: 0.8 }}>
                📍 {[creator.state, creator.country].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        )}
      </Link>
      ) : (
        <div
          className={`block relative ${getAspectRatioClass()} overflow-hidden bg-gradient-to-br ${categoryGradient} opacity-60 cursor-not-allowed`}
          title="Profile not available"
        >
        {/* Video-First: Show video if available, otherwise image */}
        {hasVideo && creator.preview_video_url ? (
          <>
            <video
              ref={videoRef}
              src={creator.preview_video_url}
              poster={creatorImage}
              muted
              loop
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Mobile play button */}
            {!window.matchMedia('(hover: hover)').matches && !showVideoPreview && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowVideoPreview(true);
                }}
                className="absolute inset-0 flex items-center justify-center bg-black/20"
                aria-label="Play preview video"
              >
                <div className="rounded-full bg-white/90 p-4 shadow-lg">
                  <svg className="h-8 w-8 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </button>
            )}
          </>
        ) : (
          <img
            src={imageData?.src || creatorImage}
            srcSet={imageData?.srcSet}
            sizes={imageData?.sizes}
            alt={`${creator.displayName || creator.username} profile`}
            className="absolute inset-0 h-full w-full object-cover"
            width={640}
            height={aspectRatio === '1:1' ? 640 : aspectRatio === '4:5' ? 800 : 1136}
            loading="lazy"
            decoding="async"
            onError={async (e) => {
              const { generateAvatar } = await import('../utils/avatarGenerator');
              e.target.src = generateAvatar(
                creator.username || 'Creator',
                creator.creator_type || creator.category,
                400,
                'circle'
              );
            }}
          />
        )}

        {/* Gradient Overlay for Text Readability */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

        {/* Follow Button - Top Right */}
        <button
          type="button"
          onClick={handleFollowClick}
          disabled={isLoadingFollow}
          aria-pressed={isFollowing}
          aria-label={isFollowing ? 'Unfollow creator' : 'Follow creator'}
          className="absolute right-3 top-3 p-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                   hover:scale-110 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 z-20"
        >
          {isFollowing ? (
            <UserPlusIconSolid className="w-6 h-6 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
          ) : (
            <UserPlusIcon className="w-6 h-6 text-white drop-shadow-md" />
          )}
        </button>

        {/* Status Badges with Precedence */}
        {isLive ? (
          <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-red-600/95 px-2.5 py-1 text-[11px] font-bold text-white shadow-md backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </div>
        ) : isOnline ? (
          <span className="absolute left-3 top-3 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow-md" />
        ) : null}

        {/* Glass Morphism Bottom Card - Better Hierarchy */}
        <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/10
                      bg-black/40 backdrop-blur-xl p-3 z-20">
          {/* Two-line name lockup */}
          <div className="mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-semibold text-sm truncate">
                {creator.displayName || creator.username}
              </span>
              {creator.is_verified && (
                <CheckBadgeIconSolid className="h-4 w-4 text-sky-400 flex-shrink-0" />
              )}
            </div>
            <div className="text-xs text-white/70 truncate">@{creator.username}</div>
          </div>

          {/* Followers count only */}
          <div className="mb-2.5 text-[11px] text-white/90 flex items-center gap-1">
            <UserGroupIcon className="h-3.5 w-3.5" />
            <span>{formatCompactNumber(creator.followerCount || creator.followers || 0)}</span>
          </div>

          {/* Icon-Only Action Buttons with Accessibility */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleServiceClickEnhanced('video');
              }}
              disabled={disabled}
              aria-label="Start video call"
              title="Video Call"
              className="min-h-[44px] rounded-xl border border-white/20 bg-white/20 backdrop-blur-md
                       p-2.5 transition-all hover:bg-white/30 hover:scale-105 active:scale-95
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <VideoCameraIcon className="w-5 h-5 text-white mx-auto" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleServiceClickEnhanced('message');
              }}
              disabled={disabled}
              aria-label="Send message"
              title="Message"
              className="min-h-[44px] rounded-xl border border-white/20 bg-white/20 backdrop-blur-md
                       p-2.5 transition-all hover:bg-white/30 hover:scale-105 active:scale-95
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5 text-white mx-auto" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowTipModal(true);
              }}
              disabled={disabled}
              aria-label="Send gift"
              title="Send Gift"
              className="min-h-[44px] rounded-xl border border-white/20 bg-white/20 backdrop-blur-md
                       p-2.5 transition-all hover:bg-white/30 hover:scale-105 active:scale-95
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <GiftIcon className="w-5 h-5 text-white mx-auto" />
            </button>
          </div>
        </div>

        {/* Hover Details Overlay */}
        {isHovered && creator.bio && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '12px',
            right: '12px',
            transform: 'translateY(-50%)',
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(20px)',
            borderRadius: '12px',
            padding: '16px',
            color: 'white',
            zIndex: 10,
            pointerEvents: 'none',
            animation: 'fadeIn 0.3s ease'
          }}>
            <p style={{ fontSize: '13px', lineHeight: '1.5', marginBottom: '8px' }}>
              {creator.bio}
            </p>
            {(creator.state || creator.country) && (
              <p style={{ fontSize: '11px', opacity: 0.8 }}>
                📍 {[creator.state, creator.country].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        )}
      </div>
      )}


      {/* Enhanced Modals */}
      {showRequestModal && (
        <CallRequestModal
          isOpen={showRequestModal}
          onClose={() => setShowRequestModal(false)}
          creator={creator}
          tokenBalance={tokenBalance}
        />
      )}

      {showConfirmationModal && (
        <CallConfirmationModal
          isOpen={showConfirmationModal}
          onClose={() => setShowConfirmationModal(false)}
          onConfirm={handleConfirmService}
          creator={creator}
          serviceType={selectedServiceType}
        />
      )}

      {showMessageComposeModal && (
        <MessageComposeModal
          isOpen={showMessageComposeModal}
          onClose={() => setShowMessageComposeModal(false)}
          onSend={(message) => {
            if (onMessage) onMessage(creator, message);
            setShowMessageComposeModal(false);
          }}
          creator={creator}
        />
      )}

      {showTipModal && (
        <TipModal
          isOpen={showTipModal}
          onClose={() => setShowTipModal(false)}
          creator={creator}
          tokenBalance={tokenBalance}
          onTipSent={(amount) => {
            if (onTip) onTip(creator, amount);
            setShowTipModal(false);
          }}
        />
      )}

      <style>{`
        @keyframes pulse {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-60%);
          }
          to {
            opacity: 1;
            transform: translateY(-50%);
          }
        }
      `}</style>
    </motion.div>
  );
};

// Memoize the component for better performance
export default memo(CreatorCard, (prevProps, nextProps) => {
  // Custom comparison for re-render optimization
  return (
    prevProps.creator?.id === nextProps.creator?.id &&
    prevProps.isSaved === nextProps.isSaved &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.tokenBalance === nextProps.tokenBalance
  );
});