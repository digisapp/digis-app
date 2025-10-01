const { logger } = require('./secureLogger');
const crypto = require('crypto');

/**
 * Strict environment validation with fail-fast behavior
 * Validates all required environment variables and their formats
 */
const validateEnvironmentVariables = () => {
  const startTime = Date.now();
  const configVersion = process.env.CONFIG_VERSION || '1.0.0';

  console.log('\n🔍 Environment Validation Starting');
  console.log(`📌 Config Version: ${configVersion}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(60));

  const requiredEnvVars = {
    // Configuration Management
    CONFIG_VERSION: {
      required: false,
      description: 'Configuration version for tracking deployments',
      defaultValue: '1.0.0'
    },
    // Database Configuration
    DATABASE_URL: {
      required: true,
      description: 'PostgreSQL connection string for Supabase'
    },
    
    // Supabase Configuration
    SUPABASE_URL: {
      required: true,
      description: 'Supabase project URL'
    },
    SUPABASE_ANON_KEY: {
      required: true,
      description: 'Supabase anonymous key'
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      required: true,
      description: 'Supabase service role key'
    },
    
    // Stripe Configuration
    STRIPE_SECRET_KEY: {
      required: true,
      description: 'Stripe secret key for payment processing'
    },
    STRIPE_WEBHOOK_SECRET: {
      required: false,
      description: 'Stripe webhook secret for webhook verification'
    },
    
    // Agora Configuration
    AGORA_APP_ID: {
      required: true,
      description: 'Agora.io application ID for video/voice calls'
    },
    AGORA_APP_CERTIFICATE: {
      required: true,
      description: 'Agora.io application certificate for token generation'
    },
    
    // JWT Configuration
    JWT_SECRET: {
      required: true,
      description: 'JWT signing secret (min 32 characters)',
      validator: (v) => v.length >= 32
    },
    JWT_ACCESS_LIFETIME: {
      required: false,
      description: 'JWT access token lifetime (e.g., 15m)',
      defaultValue: '15m',
      validator: (v) => /^\d+[smhd]$/.test(v)
    },
    JWT_REFRESH_LIFETIME: {
      required: false,
      description: 'JWT refresh token lifetime (e.g., 7d)',
      defaultValue: '7d',
      validator: (v) => /^\d+[smhd]$/.test(v)
    },

    // Server Configuration
    PORT: {
      required: false,
      description: 'Server port (defaults to 3001)',
      defaultValue: '3001'
    },
    NODE_ENV: {
      required: false,
      description: 'Node environment (development/production)',
      defaultValue: 'development'
    },
    FRONTEND_URL: {
      required: false,
      description: 'Frontend URL for CORS configuration',
      defaultValue: 'http://localhost:3000'
    }
  };

  const missing = [];
  const warnings = [];
  const configured = [];
  const validationErrors = [];

  // First pass: Check existence and set defaults

  Object.entries(requiredEnvVars).forEach(([varName, config]) => {
    const value = process.env[varName];

    if (!value) {
      if (config.required) {
        missing.push({
          name: varName,
          description: config.description
        });
      } else {
        // Set default value if provided
        if (config.defaultValue !== undefined) {
          process.env[varName] = config.defaultValue;
          warnings.push({
            name: varName,
            description: config.description,
            defaultValue: config.defaultValue
          });
        }
      }
    } else {
      // Validate the value if validator is provided
      if (config.validator && !config.validator(value)) {
        validationErrors.push({
          name: varName,
          description: config.description,
          error: `Invalid value format`
        });
      } else {
        configured.push({
          name: varName,
          description: config.description,
          hasValue: true
        });
      }
    }
  });

  // Check for unknown environment variables (potential typos)
  const knownKeys = Object.keys(requiredEnvVars);
  const envKeys = Object.keys(process.env).filter(k =>
    !k.startsWith('npm_') &&
    !k.startsWith('NODE_') &&
    !['PATH', 'HOME', 'USER', 'SHELL', 'PWD', 'LANG', 'TERM', 'COLORTERM'].includes(k)
  );
  const unknownKeys = envKeys.filter(k => !knownKeys.includes(k) && k.includes('_'));

  // Display results
  if (configured.length > 0) {
    console.log('✅ Configured environment variables:');
    configured.forEach(env => {
      console.log(`   ✓ ${env.name}`); // Don't log values for security
    });
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️  Optional environment variables (using defaults):');
    warnings.forEach(env => {
      const defaultMsg = env.defaultValue ? ` (default: ${env.defaultValue})` : '';
      console.log(`   ! ${env.name}${defaultMsg}`);
    });
    console.log('');
  }

  if (unknownKeys.length > 0) {
    console.log('🔍 Unknown environment variables detected (check for typos):');
    unknownKeys.slice(0, 10).forEach(key => {
      console.log(`   ? ${key}`);
    });
    if (unknownKeys.length > 10) {
      console.log(`   ... and ${unknownKeys.length - 10} more`);
    }
    console.log('');
  }

  if (validationErrors.length > 0) {
    console.log('❌ Environment variable validation errors:');
    validationErrors.forEach(env => {
      console.log(`   ✗ ${env.name}: ${env.error}`);
      console.log(`      ${env.description}`);
    });
    console.log('');
  }

  if (missing.length > 0) {
    console.log('❌ Missing required environment variables:');
    missing.forEach(env => {
      console.log(`   ✗ ${env.name}: ${env.description}`);
    });
    console.log('');
    console.log('💡 Please set the following environment variables:');
    missing.forEach(env => {
      console.log(`${env.name}=your_${env.name.toLowerCase().replace(/_/g, '_')}_here`);
    });
    console.log('');
  }

  // FAIL FAST: Exit if critical errors
  if (missing.length > 0 || validationErrors.length > 0) {
    const errorCount = missing.length + validationErrors.length;
    console.log('=' .repeat(60));
    console.log(`❌ FATAL: Environment validation failed with ${errorCount} error(s)`);
    console.log('🛑 Server startup aborted to prevent runtime errors');
    console.log('');

    // Log to file if logger is available
    if (logger) {
      logger.error('Environment validation failed', {
        missing: missing.map(e => e.name),
        validationErrors: validationErrors.map(e => ({ name: e.name, error: e.error })),
        configVersion
      });
    }

    process.exit(1);
  }

  // Validate specific environment variable formats
  validateEnvironmentFormats();

  const duration = Date.now() - startTime;
  console.log('=' .repeat(60));
  console.log(`✅ Environment validation completed successfully in ${duration}ms`);
  console.log(`📊 ${configured.length} variables configured, ${warnings.length} using defaults`);
  console.log('');

  // Log successful validation
  if (logger) {
    logger.info('Environment validation successful', {
      configVersion,
      environment: process.env.NODE_ENV,
      configuredCount: configured.length,
      warningCount: warnings.length,
      duration: `${duration}ms`
    });
  }
};

const validateEnvironmentFormats = () => {
  const validations = [];

  // Validate DATABASE_URL format
  if (process.env.DATABASE_URL) {
    if (!process.env.DATABASE_URL.startsWith('postgresql://') && !process.env.DATABASE_URL.startsWith('postgres://')) {
      validations.push('DATABASE_URL must start with postgresql:// or postgres://');
    }
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) {
      validations.push('JWT_SECRET must be at least 32 characters for security');
    }
    // Check for weak patterns
    if (/^[a-zA-Z]+$/.test(process.env.JWT_SECRET) || /^[0-9]+$/.test(process.env.JWT_SECRET)) {
      validations.push('JWT_SECRET appears weak. Use a mix of characters, numbers, and symbols');
    }
  }

  // Validate Stripe key format
  if (process.env.STRIPE_SECRET_KEY) {
    if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
      validations.push('STRIPE_SECRET_KEY must start with sk_');
    }
    // Check for test vs live keys in production
    if (process.env.NODE_ENV === 'production' && process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
      console.log('⚠️  WARNING: Using Stripe test key in production environment');
    }
  }

  // Validate webhook secret format
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    if (!process.env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
      validations.push('STRIPE_WEBHOOK_SECRET must start with whsec_');
    }
  }

  // Validate Supabase URL format
  if (process.env.SUPABASE_URL) {
    if (!process.env.SUPABASE_URL.startsWith('https://') || !process.env.SUPABASE_URL.includes('.supabase.co')) {
      validations.push('SUPABASE_URL must be a valid Supabase project URL');
    }
  }

  // Validate Agora App ID format (should be a string of alphanumeric characters)
  if (process.env.AGORA_APP_ID) {
    if (!/^[a-f0-9]{32}$/.test(process.env.AGORA_APP_ID)) {
      console.log('⚠️ AGORA_APP_ID format may be incorrect (expected 32-character hex string)');
    }
  }

  // Validate PORT is a number
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT);
    if (isNaN(port) || port < 1 || port > 65535) {
      validations.push('PORT must be a valid port number (1-65535)');
    }
  }

  // Security check: Ensure sensitive variables in production
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.SENTRY_DSN) {
      console.log('⚠️  WARNING: SENTRY_DSN not configured for production error tracking');
    }
    if (!process.env.REDIS_URL) {
      console.log('⚠️  WARNING: REDIS_URL not configured - using in-memory rate limiting');
    }
  }

  if (validations.length > 0) {
    console.log('❌ Environment variable format errors:');
    validations.forEach(error => {
      console.log(`   ✗ ${error}`);
    });
    console.log('');
    throw new Error(`${validations.length} environment variable format error(s). Fix the issues above and restart.`);
  }
};

/**
 * Generate a secure JWT secret if needed
 */
const generateSecureSecret = () => {
  return crypto.randomBytes(32).toString('base64');
};

/**
 * Check if running in production
 */
const isProduction = () => {
  return process.env.NODE_ENV === 'production';
};

/**
 * Get environment variable with fallback
 */
const getEnv = (key, defaultValue = null) => {
  return process.env[key] || defaultValue;
};

module.exports = {
  validateEnvironmentVariables,
  generateSecureSecret,
  isProduction,
  getEnv
};