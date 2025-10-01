/**
 * System Configuration Helper
 * Centralized access to configuration values stored in database
 */

const { pool } = require('./db');

// Cache config values in memory with TTL
const configCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get configuration value from database
 * @param {string} key - Configuration key
 * @param {any} defaultValue - Default value if key not found
 * @returns {Promise<any>} - Configuration value
 */
const getConfig = async (key, defaultValue = null) => {
  // Check cache first
  const cached = configCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  try {
    const result = await pool.query(
      'SELECT value FROM system_config WHERE key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      return defaultValue;
    }

    const value = result.rows[0].value;

    // Cache the value
    configCache.set(key, {
      value,
      expires: Date.now() + CACHE_TTL
    });

    return value;
  } catch (error) {
    console.error(`Error fetching config ${key}:`, error);
    return defaultValue;
  }
};

/**
 * Get numeric configuration value
 * @param {string} key - Configuration key
 * @param {number} defaultValue - Default value if key not found
 * @returns {Promise<number>} - Numeric configuration value
 */
const getNumericConfig = async (key, defaultValue = 0) => {
  const value = await getConfig(key, defaultValue);
  return Number(value);
};

/**
 * Get boolean configuration value
 * @param {string} key - Configuration key
 * @param {boolean} defaultValue - Default value if key not found
 * @returns {Promise<boolean>} - Boolean configuration value
 */
const getBooleanConfig = async (key, defaultValue = false) => {
  const value = await getConfig(key, defaultValue);
  return value === true || value === 'true' || value === '1' || value === 1;
};

/**
 * Update configuration value in database
 * @param {string} key - Configuration key
 * @param {any} value - New value
 * @param {string} updatedBy - User ID making the update
 * @returns {Promise<boolean>} - Success status
 */
const setConfig = async (key, value, updatedBy = null) => {
  try {
    await pool.query(
      `INSERT INTO system_config (key, value, category, updated_at, updated_by)
       VALUES ($1, $2, 'runtime', NOW(), $3)
       ON CONFLICT (key) DO UPDATE
       SET value = $2, updated_at = NOW(), updated_by = $3`,
      [key, JSON.stringify(value), updatedBy]
    );

    // Clear cache
    configCache.delete(key);

    return true;
  } catch (error) {
    console.error(`Error setting config ${key}:`, error);
    return false;
  }
};

/**
 * Get all configuration values for a category
 * @param {string} category - Configuration category
 * @returns {Promise<Object>} - Object with all config values in category
 */
const getCategoryConfig = async (category) => {
  try {
    const result = await pool.query(
      'SELECT key, value FROM system_config WHERE category = $1',
      [category]
    );

    const config = {};
    for (const row of result.rows) {
      config[row.key] = row.value;
    }

    return config;
  } catch (error) {
    console.error(`Error fetching category config ${category}:`, error);
    return {};
  }
};

/**
 * Clear the configuration cache
 */
const clearCache = () => {
  configCache.clear();
};

// Common configuration keys as constants
const CONFIG_KEYS = {
  // Token settings
  TOKEN_USD_RATE: 'token_usd_rate',

  // Platform settings
  PLATFORM_FEE_PERCENTAGE: 'platform_fee_percentage',

  // VOD settings
  VOD_DEFAULT_PRICE: 'vod_default_price',
  VOD_PURCHASE_EXPIRY_HOURS: 'vod_purchase_expiry_hours',

  // TV Subscription
  TV_SUBSCRIPTION_TRIAL_DAYS: 'tv_subscription_trial_days',
  TV_SUBSCRIPTION_PRICE: 'tv_subscription_price',

  // Limits
  MIN_WITHDRAWAL_AMOUNT: 'min_withdrawal_amount',
  MAX_FILE_UPLOAD_SIZE: 'max_file_upload_size',

  // Features
  SESSION_AUTO_END_MINUTES: 'session_auto_end_minutes',
  REFRESH_TOKEN_DAYS: 'refresh_token_days',
  ACCESS_TOKEN_MINUTES: 'access_token_minutes'
};

module.exports = {
  getConfig,
  getNumericConfig,
  getBooleanConfig,
  setConfig,
  getCategoryConfig,
  clearCache,
  CONFIG_KEYS
};