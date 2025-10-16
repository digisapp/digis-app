/**
 * Username Validator
 *
 * Validates usernames for uniqueness, format, and reserved words.
 * Used by API endpoints to ensure consistent username rules.
 */

const { RESERVED_HANDLES, isReserved } = require('../../shared/reservedHandles');

// Username format: 3-30 chars, lowercase a-z, 0-9, dot, underscore, hyphen
// Must start and end with alphanumeric
const USERNAME_RE = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;

// Minimum and maximum length
const MIN_LENGTH = 3;
const MAX_LENGTH = 30;

/**
 * Normalize username to lowercase and trimmed
 * @param {string} raw - Raw username input
 * @returns {string|null} - Normalized username or null if empty
 */
function normalizeUsername(raw) {
  if (raw == null || raw === '') return null;
  const trimmed = String(raw).trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validate username format and rules (NOT database uniqueness)
 * @param {string} raw - Raw username input
 * @returns {object} - Validation result { ok: boolean, username?: string, reason?: string, message?: string }
 */
function validateUsername(raw) {
  const username = normalizeUsername(raw);

  // Check 1: Not empty
  if (!username) {
    return {
      ok: false,
      reason: 'empty',
      message: 'Username is required.'
    };
  }

  // Check 2: Length
  if (username.length < MIN_LENGTH) {
    return {
      ok: false,
      reason: 'too_short',
      message: `Username must be at least ${MIN_LENGTH} characters.`
    };
  }

  if (username.length > MAX_LENGTH) {
    return {
      ok: false,
      reason: 'too_long',
      message: `Username must be at most ${MAX_LENGTH} characters.`
    };
  }

  // Check 3: Format (alphanumeric start/end, allows . _ - in middle)
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      reason: 'invalid_format',
      message: 'Username can only contain letters, numbers, dots, underscores, and hyphens. Must start and end with a letter or number.'
    };
  }

  // Check 4: No consecutive special characters (optional stricter rule)
  if (/[._-]{2,}/.test(username)) {
    return {
      ok: false,
      reason: 'consecutive_special',
      message: 'Username cannot have consecutive dots, underscores, or hyphens.'
    };
  }

  // Check 5: Reserved words
  if (isReserved(username)) {
    return {
      ok: false,
      reason: 'reserved',
      message: 'That username is reserved and cannot be used.'
    };
  }

  // All checks passed
  return {
    ok: true,
    username
  };
}

/**
 * Check if username contains profanity or inappropriate words
 * @param {string} username - Username to check
 * @returns {boolean} - True if contains inappropriate content
 */
function containsInappropriateContent(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return false;

  // Simple profanity check (expand as needed)
  const inappropriate = [
    'fuck', 'shit', 'ass', 'bitch', 'nigger', 'nigga', 'faggot',
    'cunt', 'dick', 'cock', 'pussy', 'porn', 'xxx', 'sex'
  ];

  return inappropriate.some(word => normalized.includes(word));
}

/**
 * Get friendly error message for validation failures
 * @param {string} reason - Validation failure reason
 * @returns {string} - User-friendly error message
 */
function getErrorMessage(reason) {
  const messages = {
    empty: 'Please enter a username.',
    too_short: `Username must be at least ${MIN_LENGTH} characters.`,
    too_long: `Username must be at most ${MAX_LENGTH} characters.`,
    invalid_format: 'Username can only contain letters, numbers, dots, underscores, and hyphens.',
    consecutive_special: 'Username cannot have consecutive special characters.',
    reserved: 'That username is reserved.',
    taken: 'That username is already taken.',
    quarantined: 'That username was recently released and is not yet available.',
    cooldown: 'You can only change your username once every 30 days.',
    inappropriate: 'Username contains inappropriate content.'
  };

  return messages[reason] || 'Invalid username.';
}

module.exports = {
  normalizeUsername,
  validateUsername,
  containsInappropriateContent,
  getErrorMessage,
  USERNAME_RE,
  MIN_LENGTH,
  MAX_LENGTH
};
