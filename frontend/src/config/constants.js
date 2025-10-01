// App-wide constants and configuration
export const APP_CONFIG = {
  // Token Economy
  TOKEN_RATE: 0.05, // USD per token
  TOKEN_SYMBOL: '🪙',
  
  // Platform Fees
  PLATFORM_FEE_PERCENTAGE: 0.20, // 20% platform fee
  CREATOR_EARNINGS_PERCENTAGE: 0.80, // 80% to creator
  
  // Content Pricing
  MIN_CONTENT_PRICE: 0, // Free content allowed
  MAX_CONTENT_PRICE: 10000, // Maximum tokens for content
  DEFAULT_CONTENT_PRICE: 100, // Default price in tokens
  
  // Session Rates
  MIN_SESSION_RATE: 10, // Minimum tokens per minute
  MAX_SESSION_RATE: 1000, // Maximum tokens per minute
  DEFAULT_SESSION_RATE: 50, // Default rate in tokens per minute
  
  // Upload Limits
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/ogg'],
  ALLOWED_AUDIO_TYPES: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
  
  // Analytics
  ANALYTICS_REFRESH_INTERVAL: 30000, // 30 seconds
  
  // UI/UX
  TOAST_DURATION: 3000, // 3 seconds
  ANIMATION_DURATION: 200, // milliseconds
  DEBOUNCE_DELAY: 300, // milliseconds for search
  
  // Categories
  CONTENT_CATEGORIES: [
    'Entertainment',
    'Education',
    'Lifestyle',
    'Gaming',
    'Music',
    'Art',
    'Technology',
    'Fashion',
    'Sports',
    'Other'
  ],
  
  // Engagement Metrics
  ENGAGEMENT_WEIGHTS: {
    views: 0.60,
    engagement: 0.30,
    tips: 0.10
  },
  
  // Shop Configuration
  SHOP_CONFIG: {
    PLATFORM_COMMISSION: 0.20, // 20% platform fee on shop sales
    TOKEN_TO_USD_RATE: 0.0625, // $1 = 16 tokens after fee
    MIN_PRODUCT_PRICE: 10, // Minimum 10 tokens
    MAX_PRODUCT_PRICE: 100000, // Maximum 100k tokens
    MAX_PRODUCT_IMAGES: 5,
    PRODUCT_TYPES: ['digital', 'physical'],
    ORDER_STATUSES: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    SHOP_URL_PREFIX: 'https://digis.app/shop/',
    NON_REFUNDABLE_NOTICE: 'All digital purchases are final and non-refundable',
    SHIPPING_NOTICE: 'Physical items ship within 3-5 business days'
  }
};

// Helper functions
export const formatTokenAmount = (tokens) => {
  return `${APP_CONFIG.TOKEN_SYMBOL} ${tokens.toLocaleString()}`;
};

export const tokensToUSD = (tokens) => {
  return (tokens * APP_CONFIG.TOKEN_RATE).toFixed(2);
};

export const usdToTokens = (usd) => {
  return Math.ceil(usd / APP_CONFIG.TOKEN_RATE);
};

export const calculateCreatorEarnings = (totalAmount) => {
  return totalAmount * APP_CONFIG.CREATOR_EARNINGS_PERCENTAGE;
};

export const calculatePlatformFee = (totalAmount) => {
  return totalAmount * APP_CONFIG.PLATFORM_FEE_PERCENTAGE;
};

export default APP_CONFIG;