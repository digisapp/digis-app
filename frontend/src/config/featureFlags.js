/**
 * Feature Flags for API Endpoints
 *
 * Enable/disable API calls to unimplemented endpoints to reduce console noise
 * Set to false for endpoints that return 404
 */

export const FEATURE_FLAGS = {
  // Creator Dashboard endpoints
  ANALYTICS_ENABLED: false,
  TOP_FANS_ENABLED: false,
  DIGITALS_ENABLED: false,
  OFFERS_ENABLED: false,
  SUBSCRIPTION_TIERS_ENABLED: false,

  // Content endpoints
  CONTENT_API_ENABLED: false,

  // Shop endpoints
  SHOP_ANALYTICS_ENABLED: false,
  SHOP_ITEMS_ENABLED: false,

  // Session endpoints
  UPCOMING_SESSIONS_ENABLED: false,
};

/**
 * Check if a feature is enabled
 * @param {string} featureName - The feature flag name
 * @returns {boolean}
 */
export const isFeatureEnabled = (featureName) => {
  return FEATURE_FLAGS[featureName] === true;
};
