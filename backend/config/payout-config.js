/**
 * Payout System Configuration
 *
 * Centralized configuration for the twice-monthly creator payout system.
 * All values can be overridden via environment variables.
 */

const config = {
  // Stripe Configuration
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  // Platform Defaults
  platform: {
    defaultCurrency: process.env.PLATFORM_DEFAULT_CURRENCY || 'usd',
    platformFeePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT || '10'), // 10%
  },

  // Payout Policy
  payout: {
    // Minimum payout amount in cents ($10 default)
    minThresholdCents: parseInt(process.env.PAYOUT_MIN_THRESHOLD_CENTS || '1000', 10),

    // Reserve percentage (0-100) to hold for chargebacks/refunds
    reservePercent: parseFloat(process.env.PAYOUT_RESERVE_PERCENT || '0'),

    // Payout schedule (1st and 15th of month)
    scheduleDay1: 1,
    scheduleDay2: 15,

    // Time zone for payout scheduling
    timezone: process.env.PAYOUT_TIMEZONE || 'UTC',

    // Cron schedule (6am UTC on 1st & 15th)
    cronSchedule: process.env.PAYOUT_CRON_SCHEDULE || '0 6 1,15 * *',
  },

  // Retry Policy
  retry: {
    maxAttempts: parseInt(process.env.PAYOUT_RETRY_MAX_ATTEMPTS || '5', 10),
    backoffMs: parseInt(process.env.PAYOUT_RETRY_BACKOFF_MS || '60000', 10), // 1 minute
  },

  // Internal API Security
  security: {
    // Secret key for cron/internal endpoints
    cronSecret: process.env.CRON_SECRET_KEY || process.env.INTERNAL_API_SECRET,

    // Custom header name for cron authentication
    cronHeaderName: process.env.CRON_HEADER_NAME || 'X-Cron-Secret',
  },

  // Observability
  observability: {
    // Enable structured logging
    enableStructuredLogs: process.env.PAYOUT_STRUCTURED_LOGS !== 'false',

    // Slack webhook for alerts
    slackWebhook: process.env.SLACK_PAYOUT_WEBHOOK_URL,

    // Email for critical alerts
    alertEmail: process.env.PAYOUT_ALERT_EMAIL,
  },

  // Feature Flags
  features: {
    // Enable instant payouts for premium creators
    instantPayoutsEnabled: process.env.ENABLE_INSTANT_PAYOUTS === 'true',

    // Enable multi-currency support
    multiCurrencyEnabled: process.env.ENABLE_MULTI_CURRENCY === 'true',

    // Enable automatic retry of failed payouts
    autoRetryEnabled: process.env.ENABLE_AUTO_RETRY !== 'false',
  },
};

/**
 * Validate required configuration
 * @throws {Error} if required config is missing
 */
function validateConfig() {
  const required = [
    { key: 'STRIPE_SECRET_KEY', value: config.stripe.secretKey },
  ];

  const missing = required.filter(({ value }) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Missing required payout configuration: ${missing.map(m => m.key).join(', ')}`
    );
  }

  // Validate thresholds
  if (config.payout.minThresholdCents < 0) {
    throw new Error('PAYOUT_MIN_THRESHOLD_CENTS must be >= 0');
  }

  if (config.payout.reservePercent < 0 || config.payout.reservePercent > 100) {
    throw new Error('PAYOUT_RESERVE_PERCENT must be between 0 and 100');
  }

  // Warn about missing webhook secret
  if (!config.stripe.webhookSecret) {
    console.warn('⚠️  STRIPE_WEBHOOK_SECRET not set - webhook signature verification disabled');
  }

  // Warn about missing cron secret
  if (!config.security.cronSecret) {
    console.warn('⚠️  CRON_SECRET_KEY not set - internal payout endpoint is not protected');
  }
}

/**
 * Get formatted configuration for logging (with secrets masked)
 */
function getConfigSummary() {
  return {
    platform: {
      currency: config.platform.defaultCurrency,
      platformFee: `${config.platform.platformFeePercent}%`,
    },
    payout: {
      minThreshold: `$${(config.payout.minThresholdCents / 100).toFixed(2)}`,
      reserve: `${config.payout.reservePercent}%`,
      schedule: `Day ${config.payout.scheduleDay1} & ${config.payout.scheduleDay2} of month`,
      timezone: config.payout.timezone,
    },
    retry: {
      maxAttempts: config.retry.maxAttempts,
      backoff: `${config.retry.backoffMs}ms`,
    },
    features: config.features,
    security: {
      webhookSecretSet: !!config.stripe.webhookSecret,
      cronSecretSet: !!config.security.cronSecret,
    },
  };
}

// Validate on load
try {
  validateConfig();
  console.log('✅ Payout configuration validated');
} catch (error) {
  console.error('❌ Payout configuration error:', error.message);
  throw error;
}

module.exports = {
  config,
  validateConfig,
  getConfigSummary,
};
