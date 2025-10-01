/**
 * Creator data normalization utility
 * Ensures consistent shape across all components
 */

// Get status badges with proper precedence
export function getStatusBadges(creator) {
  const isLive = !!(creator.isLive || creator.is_streaming);
  const isOnline = !!(creator.isOnline || creator.is_online);

  // If live, don't show online badge (precedence)
  return {
    isLive,
    isOnline: isOnline && !isLive
  };
}

// Get category gradient color
export function getCategoryGradient(category) {
  const gradients = {
    'Music': 'from-purple-500 to-pink-500',
    'Gaming': 'from-blue-500 to-cyan-500',
    'Life Coach': 'from-green-500 to-emerald-500',
    'Fitness': 'from-orange-500 to-red-500',
    'Art': 'from-indigo-500 to-purple-500',
    'Business': 'from-gray-600 to-gray-800',
    'Education': 'from-yellow-500 to-amber-500',
    'Entertainment': 'from-pink-500 to-rose-500',
    'Fashion': 'from-pink-400 to-purple-400',
    'Beauty': 'from-rose-400 to-pink-400',
    'Tech': 'from-cyan-500 to-blue-500',
    'Sports': 'from-red-500 to-orange-500',
    'Travel': 'from-sky-500 to-blue-500',
    'Photography': 'from-gray-600 to-gray-800',
    'Dance': 'from-fuchsia-500 to-purple-500',
    'Comedy': 'from-yellow-400 to-amber-500',
    'Wellness': 'from-green-500 to-teal-500',
    'Cooking': 'from-yellow-500 to-orange-500',
    'Lifestyle': 'from-amber-500 to-orange-500',
    'default': 'from-gray-400 to-gray-600'
  };

  return gradients[category] || gradients.default;
}

// Format numbers with compact notation
export function formatCompactNumber(num) {
  if (!num) return '0';
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(num);
}

// Normalize creator data from various API responses
export function normalizeCreator(raw) {
  if (!raw) return null;

  return {
    // IDs
    id: raw.id || raw.uid || raw.userId || raw.supabase_id,
    uid: raw.uid || raw.id,
    supabaseId: raw.supabase_id || raw.supabaseId,

    // Basic info
    username: (raw.username || raw.email?.split('@')[0] || 'creator').replace(/^@/, ''),
    displayName: raw.display_name || raw.displayName || raw.full_name || raw.name || 'Creator',
    email: raw.email,

    // Profile
    bio: raw.bio || raw.description || '',
    avatar: raw.profile_pic_url || raw.profilePicUrl || raw.avatar_url || raw.photoUrl || null,
    coverImage: raw.cover_image || raw.banner_url || raw.coverUrl || null,

    // Category and specialties
    category: raw.creator_type || raw.category || raw.creatorType || 'Other',
    specialties: Array.isArray(raw.specialties)
      ? raw.specialties
      : (raw.specialties ? raw.specialties.split(',').map(s => s.trim()) : []),
    interests: raw.interests || [],

    // Status
    isOnline: !!(raw.is_online || raw.isOnline),
    isLive: !!(raw.is_streaming || raw.isLive || raw.isStreaming),
    isVerified: !!(raw.is_verified || raw.verified || raw.isVerified),

    // Pricing (normalize to cents)
    videoPrice: raw.video_price || raw.videoPrice || 15000, // $150
    voicePrice: raw.voice_price || raw.voicePrice || 5000,  // $50
    messagePrice: raw.message_price || raw.messagePrice || 5000, // $50
    streamPrice: raw.stream_price || raw.streamPrice || 10000, // $100

    // Stats
    rating: Number(raw.rating || 4.5),
    totalReviews: Number(raw.total_reviews || raw.totalReviews || 0),
    totalSessions: Number(raw.total_sessions || raw.totalSessions || 0),
    followerCount: Number(raw.follower_count || raw.followers || raw.followerCount || 0),

    // Location
    state: raw.state,
    country: raw.country,

    // Languages
    languages: Array.isArray(raw.languages)
      ? raw.languages
      : (raw.languages ? [raw.languages] : ['English']),

    // Other
    responseTime: raw.response_time || raw.responseTime || '< 1 hour',
    lastActive: raw.last_active || raw.lastActive,
    createdAt: raw.created_at || raw.createdAt,

    // Preserve original data for debugging
    _raw: raw
  };
}

// Normalize multiple creators
export function normalizeCreators(rawCreators) {
  if (!Array.isArray(rawCreators)) return [];
  return rawCreators.map(normalizeCreator).filter(Boolean);
}

// Get responsive image URLs with sizes
export function getResponsiveImageUrls(baseUrl, sizes = [320, 640, 960]) {
  if (!baseUrl) return null;

  // If it's already a data URL or external service, return as-is
  if (baseUrl.startsWith('data:') || baseUrl.includes('dicebear') || baseUrl.includes('ui-avatars')) {
    return {
      src: baseUrl,
      srcSet: null,
      sizes: null
    };
  }

  // Generate srcSet for responsive images
  const srcSet = sizes.map(size => `${baseUrl}?w=${size} ${size}w`).join(', ');

  return {
    src: baseUrl,
    srcSet,
    sizes: '(max-width: 480px) 50vw, (max-width: 768px) 33vw, 300px'
  };
}

// Check if user prefers reduced motion
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
}

// Debounce utility
export function debounce(fn, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}