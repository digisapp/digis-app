import { z } from 'zod';

/**
 * Runtime environment validation
 * Fails fast if required environment variables are missing or invalid
 */
const EnvSchema = z.object({
  VITE_BACKEND_URL: z.string().url('VITE_BACKEND_URL must be a valid URL'),
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required'),
  VITE_STRIPE_PUBLISHABLE_KEY: z.string().min(1, 'VITE_STRIPE_PUBLISHABLE_KEY is required'),
  VITE_AGORA_APP_ID: z.string().optional(),
  VITE_SENTRY_DSN: z.string().optional(),
  VITE_SENTRY_ENABLED: z.string().optional(),
});

/**
 * Parse and validate environment variables at boot time
 * @throws {ZodError} if validation fails - caught in main.jsx
 */
function validateEnvironment() {
  try {
    return EnvSchema.parse(import.meta.env);
  } catch (error) {
    console.error('❌ Environment configuration error:', error.errors);
    throw new Error(
      `Invalid environment configuration:\n${error.errors
        .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
        .join('\n')}`
    );
  }
}

export const env = validateEnvironment();

// Convenience exports for common usage
export const BACKEND_URL = env.VITE_BACKEND_URL;
export const SUPABASE_URL = env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
export const STRIPE_KEY = env.VITE_STRIPE_PUBLISHABLE_KEY;
