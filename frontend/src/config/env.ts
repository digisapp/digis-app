// Environment variables configuration for Vite
// In Vite, env variables must be prefixed with VITE_

interface EnvConfig {
  BACKEND_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  AGORA_APP_ID: string;
  STRIPE_PUBLISHABLE_KEY: string;
}

// Helper to get env variables with fallbacks
const getEnvVar = (key: string, fallback?: string): string => {
  const viteKey = `VITE_${key}`;
  const value = import.meta.env[viteKey];
  
  if (!value && !fallback) {
    console.warn(`Missing environment variable: ${viteKey}`);
  }
  
  return value || fallback || '';
};

// Export typed environment configuration
export const env: EnvConfig = {
  BACKEND_URL: getEnvVar('BACKEND_URL', 'http://localhost:3001'),
  SUPABASE_URL: getEnvVar('SUPABASE_URL'),
  SUPABASE_ANON_KEY: getEnvVar('SUPABASE_ANON_KEY'),
  AGORA_APP_ID: getEnvVar('AGORA_APP_ID'),
  STRIPE_PUBLISHABLE_KEY: getEnvVar('STRIPE_PUBLISHABLE_KEY'),
};

// Development helpers
export const isDev = import.meta.env.DEV;
export const isProd = import.meta.env.PROD;
export const isSSR = import.meta.env.SSR;

// Validate required env variables
export const validateEnv = () => {
  const required = [
    'BACKEND_URL',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'AGORA_APP_ID',
    'STRIPE_PUBLISHABLE_KEY',
  ];

  const missing = required.filter(key => !env[key as keyof EnvConfig]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    if (isProd) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
};