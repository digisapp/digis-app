/**
 * Normalize creator data from various sources into a consistent shape
 * This ensures all components work with the same data structure
 */

export const normalizeCreator = (creator) => {
  if (!creator) return null;

  return {
    // Core identifiers
    id: creator.id || creator.supabase_id || creator.user_id,
    supabase_id: creator.supabase_id || creator.id,

    // Display information
    displayName: creator.displayName || creator.display_name || creator.name || creator.username || 'Creator',
    username: (creator.username || creator.user_name || '').replace(/^@/, ''), // Remove @ if present
    bio: creator.bio || creator.description || '',

    // Images
    avatar: creator.avatar_url || creator.avatar || creator.profile_pic_url || creator.profilePicUrl,
    coverImage: creator.cover_image_url || creator.coverImageUrl || creator.banner_url,

    // Status
    isOnline: Boolean(creator.isOnline || creator.is_online || creator.online),
    isLive: Boolean(creator.isLive || creator.is_live || creator.streaming),
    isVerified: Boolean(creator.isVerified || creator.is_verified || creator.verified),
    isCreator: Boolean(creator.isCreator || creator.is_creator !== false),
    availableForCalls: Boolean(creator.availableForCalls || creator.available_for_calls),

    // Creator type/category
    category: creator.category || creator.creator_type || creator.creatorType || 'Creator',
    tags: creator.tags || creator.skills || creator.interests || [],

    // Ratings and stats
    rating: Number(creator.rating || creator.average_rating || 4.5),
    reviewCount: Number(creator.reviewCount || creator.review_count || creator.total_reviews || 0),
    followers: Number(creator.followers || creator.follower_count || creator.totalFollowers || 0),

    // Pricing (normalize to tokens/credits)
    voiceCallRate: Number(creator.voiceCallRate || creator.voice_call_rate || creator.callPrice || creator.call_price || 50),
    videoCallRate: Number(creator.videoCallRate || creator.video_call_rate || creator.videoPrice || creator.video_price || 100),
    messageRate: Number(creator.messageRate || creator.message_rate || creator.messagePrice || creator.message_price || 10),

    // Message pricing tiers
    textMessagePrice: Number(creator.text_message_price || creator.textMessagePrice || 1),
    imageMessagePrice: Number(creator.image_message_price || creator.imageMessagePrice || 2),
    audioMessagePrice: Number(creator.audio_message_price || creator.audioMessagePrice || 3),
    videoMessagePrice: Number(creator.video_message_price || creator.videoMessagePrice || 5),

    // Subscription
    subscriptionPrice: Number(creator.subscription_price || creator.subscriptionPrice || 0),
    hasSubscription: Boolean(creator.has_subscription || creator.hasSubscription || creator.subscription_price > 0),

    // Location and language
    location: creator.location || creator.city || creator.country || '',
    timezone: creator.timezone || creator.time_zone || 'UTC',
    language: creator.language || creator.languages || 'en',

    // Social and links
    socialLinks: creator.social_links || creator.socialLinks || {},

    // Features and capabilities
    features: {
      videoCall: creator.offers_video !== false,
      voiceCall: creator.offers_voice !== false,
      messaging: creator.offers_messaging !== false,
      streaming: creator.offers_streaming || false,
      content: creator.offers_content || false,
      tips: creator.accepts_tips !== false
    },

    // Timestamps
    createdAt: creator.created_at || creator.createdAt,
    updatedAt: creator.updated_at || creator.updatedAt,
    lastActive: creator.last_active || creator.lastActive || creator.last_active_at,

    // Original data (for debugging or specific use cases)
    _original: creator
  };
};

/**
 * Normalize an array of creators
 */
export const normalizeCreators = (creators = []) => {
  return creators.map(normalizeCreator).filter(Boolean);
};

/**
 * Get display price with currency symbol
 */
export const getDisplayPrice = (tokens, symbol = '$') => {
  if (!tokens || tokens === 0) return 'Free';
  return `${symbol}${tokens}`;
};

/**
 * Get creator status text
 */
export const getCreatorStatus = (creator) => {
  if (!creator) return 'Offline';

  if (creator.isLive) return 'Live Now';
  if (creator.isOnline) return 'Online';
  if (creator.availableForCalls) return 'Available';

  return 'Offline';
};

/**
 * Get creator status color class
 */
export const getStatusColorClass = (creator) => {
  if (!creator) return 'bg-gray-400';

  if (creator.isLive) return 'bg-red-500';
  if (creator.isOnline) return 'bg-green-500';
  if (creator.availableForCalls) return 'bg-yellow-500';

  return 'bg-gray-400';
};