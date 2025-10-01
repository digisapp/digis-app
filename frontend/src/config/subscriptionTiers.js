// Simplified subscription configuration - single tier model
export const SUBSCRIPTION_CONFIG = {
  // Single subscription model - creator sets one price
  subscription: {
    name: 'Monthly Subscription',
    description: 'Full access to exclusive content',
    emoji: '⭐',
    color: 'purple',
    benefits: [
      'Access to all exclusive content',
      'Unlock all paid photos and videos',
      'Priority messaging',
      'Subscriber badge',
      'Early access to new content',
      'Special subscriber-only posts'
    ]
  },

  // Default price in tokens (creators can customize)
  defaultPrice: 500,

  // Price limits (optional)
  minPrice: 1,
  maxPrice: null, // No maximum limit

  // Token to USD conversion rate
  tokenToUsdRate: 0.05
};

// Helper function to format subscription price
export const formatSubscriptionPrice = (tokens) => {
  return {
    tokens: tokens.toLocaleString(),
    usd: (tokens * SUBSCRIPTION_CONFIG.tokenToUsdRate).toFixed(2)
  };
};

// Check if user is subscribed (simplified)
export const isUserSubscribed = (userSubscription) => {
  if (!userSubscription) return false;

  // Check if subscription is active and not expired
  const now = new Date();
  const expiresAt = userSubscription.expires_at ? new Date(userSubscription.expires_at) : null;

  return userSubscription.is_active && (!expiresAt || expiresAt > now);
};

// Get subscription status
export const getSubscriptionStatus = (userSubscription) => {
  if (!userSubscription) {
    return {
      isSubscribed: false,
      message: 'Not subscribed'
    };
  }

  const subscribed = isUserSubscribed(userSubscription);

  return {
    isSubscribed: subscribed,
    message: subscribed ? 'Active subscriber' : 'Subscription expired',
    expiresAt: userSubscription.expires_at
  };
};

// Export empty SUBSCRIPTION_TIERS for backward compatibility
// This will prevent errors in files still referencing it
export const SUBSCRIPTION_TIERS = {};