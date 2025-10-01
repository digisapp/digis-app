/**
 * Money Utilities for Integer Cents Conversion
 * Handles all monetary conversions to prevent floating point errors
 * All monetary values are stored as integer cents in the database
 */

/**
 * Convert dollars to cents (handles strings, numbers, nulls safely)
 * @param {number|string|null} dollars - Dollar amount
 * @returns {number} Integer cents
 */
function toCents(dollars) {
  if (dollars == null || dollars === '') return 0;

  const num = Number(dollars);
  if (Number.isNaN(num)) return 0;

  // Use Math.round to handle floating point precision issues
  // e.g., 5.005 * 100 = 500.49999999 -> rounds to 500
  return Math.round(num * 100);
}

/**
 * Convert cents to dollars
 * @param {number|string|null} cents - Cents amount
 * @returns {number} Dollar amount
 */
function toDollars(cents) {
  const num = Number(cents || 0);
  return num / 100;
}

/**
 * Format cents as currency string
 * @param {number} cents - Cents amount
 * @param {string} currency - Currency code (default USD)
 * @returns {string} Formatted currency string
 */
function formatCents(cents, currency = 'USD') {
  const dollars = toDollars(cents);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(dollars);
}

/**
 * Convert tokens to cents (assuming 1 token = $0.05)
 * @param {number} tokens - Number of tokens
 * @param {number} tokenRateCents - Cents per token (default 5)
 * @returns {number} Integer cents
 */
function tokensToCents(tokens, tokenRateCents = 5) {
  if (tokens == null) return 0;
  const num = Number(tokens);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * tokenRateCents);
}

/**
 * Convert cents to tokens
 * @param {number} cents - Cents amount
 * @param {number} tokenRateCents - Cents per token (default 5)
 * @returns {number} Number of tokens (integer)
 */
function centsToTokens(cents, tokenRateCents = 5) {
  if (cents == null || tokenRateCents === 0) return 0;
  return Math.floor(Number(cents) / tokenRateCents);
}

/**
 * Validate cents amount
 * @param {number} cents - Amount in cents
 * @param {object} options - Validation options
 * @returns {object} Validation result
 */
function validateCents(cents, options = {}) {
  const {
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    allowNegative = false,
    allowZero = false
  } = options;

  const amount = Number(cents);

  if (Number.isNaN(amount)) {
    return { valid: false, error: 'Invalid amount' };
  }

  if (!Number.isInteger(amount)) {
    return { valid: false, error: 'Amount must be an integer' };
  }

  if (!allowNegative && amount < 0) {
    return { valid: false, error: 'Amount cannot be negative' };
  }

  if (!allowZero && amount === 0) {
    return { valid: false, error: 'Amount cannot be zero' };
  }

  if (amount < min) {
    return { valid: false, error: `Amount must be at least ${formatCents(min)}` };
  }

  if (amount > max) {
    return { valid: false, error: `Amount cannot exceed ${formatCents(max)}` };
  }

  return { valid: true, amount };
}

/**
 * Calculate platform fee in cents
 * @param {number} amountCents - Base amount in cents
 * @param {number} feePercentage - Fee percentage (0-100)
 * @returns {object} Fee breakdown in cents
 */
function calculatePlatformFee(amountCents, feePercentage = 0) {
  const amount = Number(amountCents || 0);
  const percentage = Number(feePercentage || 0);

  if (percentage === 0) {
    return {
      gross: amount,
      fee: 0,
      net: amount
    };
  }

  const fee = Math.round(amount * percentage / 100);
  const net = amount - fee;

  return {
    gross: amount,
    fee: fee,
    net: net
  };
}

/**
 * Sum array of cent amounts safely
 * @param {Array<number>} amounts - Array of cent amounts
 * @returns {number} Total in cents
 */
function sumCents(amounts) {
  if (!Array.isArray(amounts)) return 0;

  return amounts.reduce((total, amount) => {
    const num = Number(amount || 0);
    if (Number.isNaN(num)) return total;
    return total + Math.round(num);
  }, 0);
}

/**
 * Dual-write helper for migration period
 * Writes both cents and dollar columns during transition
 * @param {object} db - Database connection
 * @param {string} query - SQL query with both columns
 * @param {object} values - Values including cents amounts
 * @param {boolean} enableDualWrite - Feature flag for dual-write
 */
async function dualWrite(db, tableName, updates, where, enableDualWrite = true) {
  const setClauses = [];
  const values = [];
  let valueIndex = 1;

  // Always write cents columns
  Object.entries(updates).forEach(([key, value]) => {
    if (key.endsWith('_cents')) {
      setClauses.push(`${key} = $${valueIndex++}`);
      values.push(value);

      // During dual-write, also update decimal column
      if (enableDualWrite) {
        const decimalColumn = key.replace('_cents', '');
        setClauses.push(`${decimalColumn} = $${valueIndex++}`);
        values.push(toDollars(value));
      }
    } else {
      setClauses.push(`${key} = $${valueIndex++}`);
      values.push(value);
    }
  });

  // Add WHERE clause values
  Object.values(where).forEach(value => {
    values.push(value);
  });

  const whereClause = Object.keys(where)
    .map((key, i) => `${key} = $${valueIndex + i}`)
    .join(' AND ');

  const query = `
    UPDATE ${tableName}
    SET ${setClauses.join(', ')}
    WHERE ${whereClause}
  `;

  return db.query(query, values);
}

/**
 * Get money amount with cents preference
 * Reads cents column first, falls back to decimal * 100
 * @param {object} row - Database row
 * @param {string} field - Field name (without _cents suffix)
 * @returns {number} Amount in cents
 */
function getMoneyAsCents(row, field) {
  if (!row) return 0;

  // Try cents column first
  const centsField = `${field}_cents`;
  if (centsField in row && row[centsField] != null) {
    return Number(row[centsField]);
  }

  // Fall back to decimal column
  if (field in row && row[field] != null) {
    return toCents(row[field]);
  }

  return 0;
}

// Feature flags for migration phases
const MONEY_FLAGS = {
  DUAL_WRITE: process.env.MONEY_DUAL_WRITE === 'true',
  READ_CENTS_ONLY: process.env.MONEY_READ_CENTS_ONLY === 'true'
};

module.exports = {
  toCents,
  toDollars,
  formatCents,
  tokensToCents,
  centsToTokens,
  validateCents,
  calculatePlatformFee,
  sumCents,
  dualWrite,
  getMoneyAsCents,
  MONEY_FLAGS
};