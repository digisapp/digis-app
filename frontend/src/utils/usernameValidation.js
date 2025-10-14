/**
 * Username Validation - Client-side validation for usernames
 *
 * Enforces:
 * - Length: 3-20 characters
 * - Characters: lowercase letters, numbers, dots, underscores
 * - Reserved: No system/app route collisions
 * - Profanity: Optional filter (TODO: add profanity list)
 *
 * IMPORTANT: Keep validation rules synchronized with backend.
 */

import { isReservedUsername, getReservedUsernameError } from '../shared/reservedUsernames';

/**
 * Username validation rules
 */
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/;

/**
 * Validate username format and availability
 * @param {string} username - Username to validate
 * @returns {{ valid: boolean, error: string|null }} Validation result
 */
export function validateUsername(username) {
  // Empty check
  if (!username || !username.trim()) {
    return {
      valid: false,
      error: 'Username is required'
    };
  }

  const trimmed = username.trim();

  // Length check
  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return {
      valid: false,
      error: `Username must be at least ${USERNAME_MIN_LENGTH} characters`
    };
  }

  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Username must be ${USERNAME_MAX_LENGTH} characters or less`
    };
  }

  // Format check - only lowercase letters, numbers, dots, underscores
  if (!USERNAME_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: 'Username can only contain lowercase letters, numbers, dots, and underscores'
    };
  }

  // Reserved username check
  if (isReservedUsername(trimmed)) {
    return {
      valid: false,
      error: getReservedUsernameError(trimmed)
    };
  }

  // Additional rules
  // - Can't start or end with dot or underscore
  if (/^[._]|[._]$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Username cannot start or end with a dot or underscore'
    };
  }

  // - Can't have consecutive dots or underscores
  if (/[._]{2,}/.test(trimmed)) {
    return {
      valid: false,
      error: 'Username cannot have consecutive dots or underscores'
    };
  }

  return {
    valid: true,
    error: null
  };
}

/**
 * Simple boolean check for valid username
 * @param {string} username - Username to check
 * @returns {boolean} true if valid, false otherwise
 */
export function isValidUsername(username) {
  if (!username) return false;

  const trimmed = username.trim().toLowerCase();

  // Basic format check
  if (!USERNAME_PATTERN.test(trimmed)) return false;

  // Reserved check
  if (isReservedUsername(trimmed)) return false;

  // Edge case checks
  if (/^[._]|[._]$/.test(trimmed)) return false;
  if (/[._]{2,}/.test(trimmed)) return false;

  return true;
}

/**
 * Normalize username to safe format
 * @param {string} username - Username to normalize
 * @returns {string} Normalized username (lowercase, trimmed)
 */
export function normalizeUsername(username) {
  if (!username) return '';
  return username.trim().toLowerCase();
}

/**
 * Suggest alternative usernames when validation fails
 * @param {string} username - Original username attempt
 * @returns {string[]} Array of suggested alternatives
 */
export function suggestUsernames(username) {
  if (!username) return [];

  const base = normalizeUsername(username).replace(/[^a-z0-9]/g, '');
  const suggestions = [];

  // Add numbers
  for (let i = 1; i <= 3; i++) {
    const suggestion = `${base}${Math.floor(Math.random() * 1000)}`;
    if (isValidUsername(suggestion)) {
      suggestions.push(suggestion);
    }
  }

  // Add underscores
  if (base.length >= USERNAME_MIN_LENGTH) {
    const suggestion = `${base}_`;
    if (isValidUsername(suggestion)) {
      suggestions.push(suggestion);
    }
  }

  return suggestions.slice(0, 3);
}

export default {
  validateUsername,
  isValidUsername,
  normalizeUsername,
  suggestUsernames,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_PATTERN
};
