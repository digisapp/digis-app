/**
 * Feature Flags for gradual rollout
 *
 * Control feature availability via environment variables
 * Allows safe, incremental deployment
 */

const { logger } = require('./secureLogger');

/**
 * Check if a feature is enabled
 *
 * @param {string} flagName - Name of the feature flag
 * @param {boolean} defaultValue - Default value if not set
 * @returns {boolean} - True if enabled
 */
function isFeatureEnabled(flagName, defaultValue = false) {
  const envVar = `FEATURE_${flagName.toUpperCase()}`;
  const value = process.env[envVar];

  if (value === undefined) {
    return defaultValue;
  }

  // Parse boolean from string
  return value === 'true' || value === '1' || value === 'yes';
}

/**
 * Feature flag configuration
 */
const FEATURES = {
  // Fan privacy system
  FAN_PRIVACY: {
    name: 'FAN_PRIVACY',
    description: 'Enable fan privacy settings and controls',
    enabled: () => isFeatureEnabled('FAN_PRIVACY', true) // Enabled by default
  },

  // Voice/Video calls
  CALLS: {
    name: 'CALLS',
    description: 'Enable voice and video calls between creators and fans',
    enabled: () => isFeatureEnabled('CALLS', false) // Disabled by default for gradual rollout
  },

  // Fan profile mini view for creators
  FAN_MINI_PROFILE: {
    name: 'FAN_MINI_PROFILE',
    description: 'Enable creator-scoped fan mini profiles',
    enabled: () => isFeatureEnabled('FAN_MINI_PROFILE', true)
  },

  // Share card generation
  FAN_SHARE_CARD: {
    name: 'FAN_SHARE_CARD',
    description: 'Enable fan share card link generation',
    enabled: () => isFeatureEnabled('FAN_SHARE_CARD', false) // Disabled by default
  }
};

/**
 * Get status of all feature flags
 *
 * @returns {Object} - Map of feature names to enabled status
 */
function getFeatureStatus() {
  const status = {};

  for (const [key, feature] of Object.entries(FEATURES)) {
    status[key] = {
      enabled: feature.enabled(),
      description: feature.description
    };
  }

  return status;
}

/**
 * Middleware to check if a feature is enabled
 * Returns 403 if feature is disabled
 *
 * Usage:
 *   router.post('/api/calls/initiate', requireFeature('CALLS'), handler);
 */
function requireFeature(featureName) {
  return (req, res, next) => {
    const feature = FEATURES[featureName];

    if (!feature) {
      logger.error('Unknown feature flag:', featureName);
      return res.status(500).json({
        ok: false,
        code: 'INTERNAL_ERROR',
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }

    if (!feature.enabled()) {
      logger.info('Feature disabled:', {
        feature: featureName,
        userId: req.user?.supabase_id,
        path: req.path
      });

      return res.status(403).json({
        ok: false,
        code: 'FEATURE_DISABLED',
        error: `${feature.description} is not available yet`,
        feature: featureName,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

/**
 * Log feature flag status on server start
 */
function logFeatureStatus() {
  const status = getFeatureStatus();

  logger.info('Feature Flags:', status);

  console.log('\n🚩 Feature Flags:');
  for (const [key, feature] of Object.entries(status)) {
    const icon = feature.enabled ? '✅' : '⛔';
    console.log(`  ${icon} ${key}: ${feature.enabled ? 'ENABLED' : 'DISABLED'}`);
  }
  console.log('');
}

module.exports = {
  FEATURES,
  isFeatureEnabled,
  getFeatureStatus,
  requireFeature,
  logFeatureStatus
};
