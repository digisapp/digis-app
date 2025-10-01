// Consolidated environment variables configuration for Vite
// In Vite, env variables must be prefixed with VITE_

interface EnvConfig {
  BACKEND_URL: string;
  SUPABASE: {
    URL: string;
    ANON_KEY: string;
  };
  STRIPE_PUBLISHABLE_KEY: string;
  AGORA_APP_ID: string;
  VAPID_PUBLIC_KEY: string;
  APP_VERSION: string;
  FEATURES: {
    ANALYTICS_ENABLED: boolean;
    PWA_ENABLED: boolean;
    NOTIFICATIONS_ENABLED: boolean;
    USE_SUPABASE_STORAGE: boolean;
  };
}

// Enhanced helper to get env variables with production validation
const getEnvVar = (key: string, fallback?: string, description?: string): string => {
  const viteKey = `VITE_${key}`;
  const value = import.meta.env[viteKey];
  
  if (!value) {
    if (isProd && !fallback) {
      const errorMsg = `Missing required environment variable: ${viteKey}${description ? ` (${description})` : ''}`;
// console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    } else if (!fallback) {
    }
  }
  
  return value || fallback || '';
};

// Development helpers
export const isDev = import.meta.env.DEV;
export const isProd = import.meta.env.PROD;
export const isSSR = import.meta.env.SSR;
export const NODE_ENV = import.meta.env.MODE || 'development';
export const PUBLIC_URL = import.meta.env.BASE_URL || '';

// Export consolidated environment configuration
export const ENV: EnvConfig = {
  // Backend Configuration
  BACKEND_URL: getEnvVar('BACKEND_URL', isDev ? 'http://localhost:3001' : undefined, 'Backend API URL'),
  
  // Supabase Configuration
  SUPABASE: {
    URL: getEnvVar('SUPABASE_URL', undefined, 'Supabase Project URL'),
    ANON_KEY: getEnvVar('SUPABASE_ANON_KEY', undefined, 'Supabase Anonymous Key'),
  },
  
  // Third-party Services
  STRIPE_PUBLISHABLE_KEY: getEnvVar('STRIPE_PUBLISHABLE_KEY', undefined, 'Stripe Publishable Key'),
  AGORA_APP_ID: getEnvVar('AGORA_APP_ID', '', 'Agora Application ID (optional)'),
  VAPID_PUBLIC_KEY: getEnvVar('VAPID_PUBLIC_KEY', '', 'VAPID Public Key for Push Notifications'),
  
  // App Configuration
  APP_VERSION: getEnvVar('APP_VERSION', '1.0.0', 'Application Version'),
  
  // Feature Flags
  FEATURES: {
    ANALYTICS_ENABLED: getEnvVar('ANALYTICS_ENABLED', 'false') === 'true',
    PWA_ENABLED: getEnvVar('PWA_ENABLED', 'true') !== 'false',
    NOTIFICATIONS_ENABLED: getEnvVar('NOTIFICATIONS_ENABLED', 'true') !== 'false',
    USE_SUPABASE_STORAGE: getEnvVar('USE_SUPABASE_STORAGE', 'false') === 'true',
  }
};

// Validate critical environment variables
export const validateEnvironment = (): boolean => {
  
  const critical = {
    'BACKEND_URL': ENV.BACKEND_URL,
    'SUPABASE_URL': ENV.SUPABASE.URL,
    'SUPABASE_ANON_KEY': ENV.SUPABASE.ANON_KEY,
    'STRIPE_PUBLISHABLE_KEY': ENV.STRIPE_PUBLISHABLE_KEY,
  };
  
  const missing = Object.entries(critical)
    .filter(([_, value]) => !value)
    .map(([key]) => key);
  
  if (missing.length > 0) {
    const errorMsg = `Critical environment variables are missing: ${missing.join(', ')}`;
// console.error(`❌ ${errorMsg}`);
// console.error('   Please check your .env file and ensure all required variables are set.');
    
    if (isProd) {
      throw new Error(errorMsg);
    }
    return false;
  }
  
  // Log configuration summary
    .filter(([_, enabled]) => enabled)
    .map(([feature]) => feature)
    .join(', ') || 'none'}`);
  
  return true;
};

// Run validation automatically
if (typeof window !== 'undefined') {
  validateEnvironment();
}

// Legacy export for backward compatibility
export const env = ENV;

export default ENV;