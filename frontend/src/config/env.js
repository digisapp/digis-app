// Environment configuration validation and centralized access
const validateRequiredEnvVar = (varName, description) => {
  // For Vite, directly use VITE_ prefix
  const value = import.meta.env[varName];
  if (!value) {
// console.error(`❌ Missing required environment variable: ${varName}`);
// console.error(`   Description: ${description}`);
    return null;
  }
  return value;
};

// Validate and export environment variables
export const ENV = {
  // Supabase Configuration
  SUPABASE: {
    URL: validateRequiredEnvVar('VITE_SUPABASE_URL', 'Supabase Project URL'),
    ANON_KEY: validateRequiredEnvVar('VITE_SUPABASE_ANON_KEY', 'Supabase Anonymous Key'),
  },
  
  // Backend Configuration
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'https://backend-nathans-projects-43dfdae0.vercel.app',
  
  // Stripe Configuration
  STRIPE_PUBLISHABLE_KEY: validateRequiredEnvVar('VITE_STRIPE_PUBLISHABLE_KEY', 'Stripe Publishable Key'),
  
  // Agora Configuration (if used on frontend)
  AGORA_APP_ID: import.meta.env.VITE_AGORA_APP_ID, // Optional - usually handled by backend
  
  // App Configuration
  NODE_ENV: import.meta.env.MODE || 'development',
  PUBLIC_URL: import.meta.env.BASE_URL || '',
  
  // Feature Flags
  FEATURES: {
    ANALYTICS_ENABLED: import.meta.env.VITE_ANALYTICS_ENABLED === 'true',
    PWA_ENABLED: import.meta.env.VITE_PWA_ENABLED !== 'false', // Default true
    NOTIFICATIONS_ENABLED: import.meta.env.VITE_NOTIFICATIONS_ENABLED !== 'false', // Default true
    USE_SUPABASE_STORAGE: import.meta.env.VITE_USE_SUPABASE_STORAGE === 'true' // For file uploads
  }
};

// Validate critical environment variables
const validateEnvironment = () => {
  const critical = [
    ENV.SUPABASE.URL,
    ENV.SUPABASE.ANON_KEY,
    ENV.STRIPE_PUBLISHABLE_KEY
  ];
  
  const missing = critical.filter(value => !value);
  
  if (missing.length > 0) {
// console.error('❌ Critical environment variables are missing. The app may not function correctly.');
// console.error('   Please check your .env file and ensure all required variables are set.');
    return false;
  }
  
  return true;
};

// Run validation
validateEnvironment();

export default ENV;