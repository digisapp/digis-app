const { z } = require('zod');

/**
 * Environment variable validation schema
 * Validates and enforces required environment variables at startup
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL URL'),

  // Supabase
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Stripe (payment processing)
  STRIPE_SECRET_KEY: z.string().startsWith('sk_', 'STRIPE_SECRET_KEY must start with sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_', 'STRIPE_WEBHOOK_SECRET must start with whsec_'),

  // Agora (video/voice)
  AGORA_APP_ID: z.string().min(1, 'AGORA_APP_ID is required'),
  AGORA_APP_CERTIFICATE: z.string().min(1, 'AGORA_APP_CERTIFICATE is required'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters').optional(),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters').optional(),

  // Server config
  PORT: z.string().regex(/^\d+$/, 'PORT must be a number').transform(Number).default('3005'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),

  // Ably (real-time messaging - required for Vercel deployment)
  ABLY_API_KEY: z.string().min(1, 'ABLY_API_KEY is required for real-time features').optional(),

  // Inngest (serverless workflows)
  INNGEST_EVENT_KEY: z.string().min(1, 'INNGEST_EVENT_KEY is required for Inngest').optional(),
  INNGEST_SIGNING_KEY: z.string().startsWith('signkey-', 'INNGEST_SIGNING_KEY must start with signkey-').optional(),

  // QStash (HTTP task queue)
  QSTASH_TOKEN: z.string().optional(),

  // Backend URL (for webhooks and callbacks)
  BACKEND_URL: z.string().url().optional(),

  // Optional but recommended
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  POSTMARK_API_KEY: z.string().optional(),
  POSTMARK_FROM_EMAIL: z.string().email().optional(),
});

/**
 * Validates environment variables and crashes early if invalid
 * @throws {Error} If environment variables are invalid
 */
function validateEnv() {
  try {
    const validated = envSchema.parse(process.env);
    console.log('✅ Environment variables validated successfully');
    return validated;
  } catch (error) {
    console.error('❌ Environment validation failed:');

    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }

    console.error('\n💡 Fix these issues in your .env file before starting the server\n');
    process.exit(1);
  }
}

module.exports = {
  validateEnv,
  envSchema,
};
