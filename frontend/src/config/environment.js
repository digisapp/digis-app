// Centralized environment configuration
// All environment variables and config should be accessed through this file

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Helper to get environment variable with fallback
const getEnvVar = (viteName, reactName, defaultValue = '') => {
  return process.env[viteName] || process.env[reactName] || defaultValue;
};

// API Configuration
const API_CONFIG = {
  BASE_URL: getEnvVar('VITE_BACKEND_URL', 'REACT_APP_BACKEND_URL', 'https://backend-digis.vercel.app'),
  TIMEOUT: 30000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
};

// Supabase Configuration
const SUPABASE_CONFIG = {
  URL: getEnvVar('VITE_SUPABASE_URL', 'REACT_APP_SUPABASE_URL'),
  ANON_KEY: getEnvVar('VITE_SUPABASE_ANON_KEY', 'REACT_APP_SUPABASE_ANON_KEY'),
  SERVICE_ROLE_KEY: getEnvVar('VITE_SUPABASE_SERVICE_ROLE_KEY', 'REACT_APP_SUPABASE_SERVICE_ROLE_KEY'),
};

// Agora Configuration
const AGORA_CONFIG = {
  APP_ID: getEnvVar('VITE_AGORA_APP_ID', 'REACT_APP_AGORA_APP_ID'),
  APP_CERTIFICATE: getEnvVar('VITE_AGORA_APP_CERTIFICATE', 'REACT_APP_AGORA_APP_CERTIFICATE'),
  USE_CLOUD_PROXY: getEnvVar('VITE_AGORA_USE_CLOUD_PROXY', 'REACT_APP_AGORA_USE_CLOUD_PROXY', 'false') === 'true',
  MODE: getEnvVar('VITE_AGORA_MODE', 'REACT_APP_AGORA_MODE', 'rtc'),
  CODEC: getEnvVar('VITE_AGORA_CODEC', 'REACT_APP_AGORA_CODEC', 'vp8'),
};

// Stripe Configuration
const STRIPE_CONFIG = {
  PUBLISHABLE_KEY: getEnvVar('VITE_STRIPE_PUBLISHABLE_KEY', 'REACT_APP_STRIPE_PUBLISHABLE_KEY'),
  SECRET_KEY: getEnvVar('VITE_STRIPE_SECRET_KEY', 'REACT_APP_STRIPE_SECRET_KEY'),
  WEBHOOK_SECRET: getEnvVar('VITE_STRIPE_WEBHOOK_SECRET', 'REACT_APP_STRIPE_WEBHOOK_SECRET'),
  CONNECT_CLIENT_ID: getEnvVar('VITE_STRIPE_CONNECT_CLIENT_ID', 'REACT_APP_STRIPE_CONNECT_CLIENT_ID'),
};

// WebSocket Configuration
const WEBSOCKET_CONFIG = {
  URL: getEnvVar('VITE_WS_URL', 'REACT_APP_WS_URL', 'wss://backend-digis.vercel.app'),
  RECONNECT_DELAY: 1000,
  MAX_RECONNECT_ATTEMPTS: 10,
  PING_INTERVAL: 30000,
};

// Storage Configuration
const STORAGE_CONFIG = {
  AVATARS_BUCKET: 'avatars',
  CONTENT_BUCKET: 'content',
  RECORDINGS_BUCKET: 'recordings',
  PUBLIC_BUCKET: 'public',
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/ogg'],
  ALLOWED_AUDIO_TYPES: ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'],
};

// Token Economy Configuration
const TOKEN_CONFIG = {
  DEFAULT_PRICE: 0.05, // $0.05 per token
  MIN_PURCHASE: 10,
  MAX_PURCHASE: 10000,
  PACKAGES: [
    { tokens: 100, price: 5, bonus: 0 },
    { tokens: 500, price: 25, bonus: 10 },
    { tokens: 1000, price: 50, bonus: 50 },
    { tokens: 5000, price: 250, bonus: 500 },
  ],
  PLATFORM_FEE_PERCENTAGE: 20, // Platform takes 20%
};

// Video Call Configuration
const VIDEO_CALL_CONFIG = {
  MAX_PARTICIPANTS: 10,
  DEFAULT_VIDEO_QUALITY: '720p',
  VIDEO_QUALITIES: {
    '360p': { width: 640, height: 360, frameRate: 15, bitrate: 400 },
    '480p': { width: 640, height: 480, frameRate: 15, bitrate: 500 },
    '720p': { width: 1280, height: 720, frameRate: 30, bitrate: 1130 },
    '1080p': { width: 1920, height: 1080, frameRate: 30, bitrate: 2080 },
  },
  SCREEN_SHARE_CONFIG: {
    width: 1920,
    height: 1080,
    frameRate: 15,
    bitrate: 1000,
  },
  RECONNECT_TIMEOUT: 10000,
  STATS_INTERVAL: 2000,
};

// Stream Configuration
const STREAM_CONFIG = {
  MAX_VIEWERS: 1000,
  CHAT_RATE_LIMIT: 10, // messages per minute
  REACTION_COOLDOWN: 1000, // milliseconds
  RECORDING_ENABLED: true,
  AUTO_END_INACTIVE_MINUTES: 30,
  LOW_LATENCY_MODE: true,
};

// Feature Flags
const FEATURE_FLAGS = {
  ENABLE_RECORDING: getEnvVar('VITE_ENABLE_RECORDING', 'REACT_APP_ENABLE_RECORDING', 'true') === 'true',
  ENABLE_SCREEN_SHARE: getEnvVar('VITE_ENABLE_SCREEN_SHARE', 'REACT_APP_ENABLE_SCREEN_SHARE', 'true') === 'true',
  ENABLE_VIRTUAL_BACKGROUNDS: getEnvVar('VITE_ENABLE_VIRTUAL_BACKGROUNDS', 'REACT_APP_ENABLE_VIRTUAL_BACKGROUNDS', 'false') === 'true',
  ENABLE_NOISE_SUPPRESSION: getEnvVar('VITE_ENABLE_NOISE_SUPPRESSION', 'REACT_APP_ENABLE_NOISE_SUPPRESSION', 'true') === 'true',
  ENABLE_CHAT_MENTIONS: getEnvVar('VITE_ENABLE_CHAT_MENTIONS', 'REACT_APP_ENABLE_CHAT_MENTIONS', 'true') === 'true',
  ENABLE_LIVE_SHOPPING: getEnvVar('VITE_ENABLE_LIVE_SHOPPING', 'REACT_APP_ENABLE_LIVE_SHOPPING', 'false') === 'true',
  ENABLE_TICKETED_SHOWS: getEnvVar('VITE_ENABLE_TICKETED_SHOWS', 'REACT_APP_ENABLE_TICKETED_SHOWS', 'true') === 'true',
  ENABLE_ANALYTICS: getEnvVar('VITE_ENABLE_ANALYTICS', 'REACT_APP_ENABLE_ANALYTICS', 'true') === 'true',
};

// App Configuration
const APP_CONFIG = {
  NAME: 'Digis',
  VERSION: process.env.VITE_APP_VERSION || process.env.REACT_APP_VERSION || '1.0.0',
  ENVIRONMENT: process.env.NODE_ENV,
  PUBLIC_URL: getEnvVar('VITE_PUBLIC_URL', 'REACT_APP_PUBLIC_URL', 'http://localhost:3000'),
  SUPPORT_EMAIL: 'support@digis.com',
  DEFAULT_LOCALE: 'en',
  SUPPORTED_LOCALES: ['en', 'es', 'fr', 'de'],
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  IDLE_TIMEOUT: 15 * 60 * 1000, // 15 minutes
};

// Monitoring Configuration
const MONITORING_CONFIG = {
  SENTRY_DSN: getEnvVar('VITE_SENTRY_DSN', 'REACT_APP_SENTRY_DSN'),
  SENTRY_ENVIRONMENT: process.env.NODE_ENV,
  SENTRY_TRACES_SAMPLE_RATE: isProduction ? 0.1 : 1.0,
  LOG_LEVEL: isDevelopment ? 'debug' : 'error',
  ENABLE_PERFORMANCE_MONITORING: getEnvVar('VITE_ENABLE_PERFORMANCE_MONITORING', 'REACT_APP_ENABLE_PERFORMANCE_MONITORING', 'true') === 'true',
};

// Social Media Configuration
const SOCIAL_CONFIG = {
  TWITTER_HANDLE: '@digisapp',
  INSTAGRAM_HANDLE: '@digisapp',
  FACEBOOK_PAGE: 'digisapp',
  DISCORD_INVITE: 'https://discord.gg/digis',
  TELEGRAM_CHANNEL: 'https://t.me/digis',
};

// SEO Configuration
const SEO_CONFIG = {
  DEFAULT_TITLE: 'Digis - Connect with Creators',
  DEFAULT_DESCRIPTION: 'Join Digis to connect with your favorite creators through live video calls, streaming, and exclusive content.',
  DEFAULT_KEYWORDS: 'creators, video calls, streaming, content, fan interaction',
  DEFAULT_IMAGE: '/images/og-image.png',
  TWITTER_CARD: 'summary_large_image',
};

// Rate Limiting Configuration
const RATE_LIMIT_CONFIG = {
  API_CALLS_PER_MINUTE: 60,
  UPLOAD_LIMIT_PER_HOUR: 100,
  MESSAGE_LIMIT_PER_MINUTE: 30,
  SEARCH_LIMIT_PER_MINUTE: 20,
};

// Validation Configuration
const VALIDATION_CONFIG = {
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 20,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_LOWERCASE: true,
  PASSWORD_REQUIRE_NUMBER: true,
  PASSWORD_REQUIRE_SPECIAL: true,
  BIO_MAX_LENGTH: 500,
  MESSAGE_MAX_LENGTH: 1000,
};

// Export environment object
const environment = {
  // Environment flags
  isDevelopment,
  isProduction,
  isTest,

  // Configuration objects
  API: API_CONFIG,
  SUPABASE: SUPABASE_CONFIG,
  AGORA: AGORA_CONFIG,
  STRIPE: STRIPE_CONFIG,
  WEBSOCKET: WEBSOCKET_CONFIG,
  STORAGE: STORAGE_CONFIG,
  TOKEN: TOKEN_CONFIG,
  VIDEO_CALL: VIDEO_CALL_CONFIG,
  STREAM: STREAM_CONFIG,
  FEATURES: FEATURE_FLAGS,
  APP: APP_CONFIG,
  MONITORING: MONITORING_CONFIG,
  SOCIAL: SOCIAL_CONFIG,
  SEO: SEO_CONFIG,
  RATE_LIMIT: RATE_LIMIT_CONFIG,
  VALIDATION: VALIDATION_CONFIG,

  // Helper functions
  getEnvVar,
  isEnabled: (feature) => FEATURE_FLAGS[feature] === true,
  getApiUrl: (path = '') => `${API_CONFIG.BASE_URL}${path}`,
  getWsUrl: (path = '') => `${WEBSOCKET_CONFIG.URL}${path}`,
  getStorageUrl: (bucket, path) => `${SUPABASE_CONFIG.URL}/storage/v1/object/public/${bucket}/${path}`,
};

// Freeze configuration in production to prevent accidental modifications
if (isProduction) {
  Object.freeze(environment);
  Object.values(environment).forEach(value => {
    if (typeof value === 'object' && value !== null) {
      Object.freeze(value);
    }
  });
}

export default environment;

// Named exports for convenience
export {
  API_CONFIG,
  SUPABASE_CONFIG,
  AGORA_CONFIG,
  STRIPE_CONFIG,
  WEBSOCKET_CONFIG,
  STORAGE_CONFIG,
  TOKEN_CONFIG,
  VIDEO_CALL_CONFIG,
  STREAM_CONFIG,
  FEATURE_FLAGS,
  APP_CONFIG,
  MONITORING_CONFIG,
  SOCIAL_CONFIG,
  SEO_CONFIG,
  RATE_LIMIT_CONFIG,
  VALIDATION_CONFIG,
  isDevelopment,
  isProduction,
  isTest,
};