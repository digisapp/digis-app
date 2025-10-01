// Supabase configuration
export const SUPABASE_CONFIG = {
  URL: import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  
  // Auth configuration
  AUTH: {
    // OAuth providers
    PROVIDERS: {
      GOOGLE: {
        enabled: true,
        scopes: ['email', 'profile']
      },
      GITHUB: {
        enabled: false,
        scopes: ['user:email']
      },
      DISCORD: {
        enabled: false,
        scopes: ['identify', 'email']
      }
    },
    
    // Auth redirects
    REDIRECTS: {
      CALLBACK: '/auth/callback',
      PASSWORD_RESET: '/auth/reset-password',
      EMAIL_CONFIRMATION: '/auth/confirm-email'
    },
    
    // Session configuration
    SESSION: {
      PERSIST: true,
      AUTO_REFRESH: true,
      STORAGE_KEY: 'digis-auth-token',
      EXPIRY_MARGIN: 60 // Refresh token 60 seconds before expiry
    }
  },
  
  // Realtime configuration
  REALTIME: {
    EVENTS_PER_SECOND: 10,
    HEARTBEAT_INTERVAL: 30000, // 30 seconds
    RECONNECT_INTERVAL_MIN: 1000, // 1 second
    RECONNECT_INTERVAL_MAX: 30000, // 30 seconds
    
    // Channel configurations
    CHANNELS: {
      CHAT: {
        PREFIX: 'chat:',
        EVENTS: ['message', 'typing', 'presence']
      },
      SESSION: {
        PREFIX: 'session:',
        EVENTS: ['update', 'end', 'participant_join', 'participant_leave']
      },
      TOKEN_BALANCE: {
        PREFIX: 'balance:',
        EVENTS: ['update', 'transaction']
      },
      NOTIFICATIONS: {
        PREFIX: 'notifications:',
        EVENTS: ['new', 'update']
      },
      STREAMING: {
        PREFIX: 'stream:',
        EVENTS: ['start', 'end', 'viewer_join', 'viewer_leave', 'tip', 'message']
      }
    }
  },
  
  // Storage configuration
  STORAGE: {
    BUCKETS: {
      AVATARS: 'avatars',
      MEDIA: 'media',
      RECORDINGS: 'recordings',
      DOCUMENTS: 'documents'
    },
    
    // File size limits (in bytes)
    LIMITS: {
      AVATAR: 5 * 1024 * 1024, // 5MB
      IMAGE: 10 * 1024 * 1024, // 10MB
      VIDEO: 100 * 1024 * 1024, // 100MB
      DOCUMENT: 20 * 1024 * 1024 // 20MB
    },
    
    // Allowed file types
    ALLOWED_TYPES: {
      AVATAR: ['image/jpeg', 'image/png', 'image/webp'],
      IMAGE: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      VIDEO: ['video/mp4', 'video/webm', 'video/quicktime'],
      DOCUMENT: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    }
  },
  
  // Database configuration
  DATABASE: {
    SCHEMA: 'public',
    
    // RLS (Row Level Security) policies
    RLS: {
      ENABLED: true,
      POLICIES: {
        USERS: ['read_own', 'update_own', 'read_public_creators'],
        SESSIONS: ['read_own', 'create_own'],
        TOKENS: ['read_own'],
        MESSAGES: ['read_own', 'create_own', 'delete_own']
      }
    }
  }
};

// Helper function to validate Supabase configuration
export const validateSupabaseConfig = () => {
  const errors = [];
  
  if (!SUPABASE_CONFIG.URL) {
    errors.push('Missing SUPABASE_URL environment variable');
  }
  
  if (!SUPABASE_CONFIG.ANON_KEY) {
    errors.push('Missing SUPABASE_ANON_KEY environment variable');
  }
  
  if (errors.length > 0) {
// console.error('❌ Supabase configuration errors:', errors);
    return false;
  }
  
  return true;
};

// Get full URL for auth redirects
export const getAuthRedirectUrl = (type) => {
  const baseUrl = window.location.origin;
  const redirect = SUPABASE_CONFIG.AUTH.REDIRECTS[type];
  return `${baseUrl}${redirect}`;
};

// Export individual configs for convenience
export const SUPABASE_URL = SUPABASE_CONFIG.URL;
export const SUPABASE_ANON_KEY = SUPABASE_CONFIG.ANON_KEY;