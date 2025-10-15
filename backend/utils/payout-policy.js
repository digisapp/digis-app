/**
 * Payout Policy Computation
 *
 * Determines payout amounts based on available balance, reserves, and thresholds.
 * Supports multi-currency and configurable policies.
 */

const { config } = require('../config/payout-config');

/**
 * Compute payout amount from Stripe balance
 *
 * @param {Array} availableBalances - Array of {currency, amount} from Stripe balance
 * @param {string} currency - Target currency (default: 'usd')
 * @param {Object} options - Override policy options
 * @param {number} options.reservePercent - Percentage to hold back (0-100)
 * @param {number} options.minThreshold - Minimum payout in cents
 * @returns {Object} - {amount, reserve_amount, threshold, reason}
 */
function computePayoutAmount(
  availableBalances,
  currency = config.platform.defaultCurrency,
  options = {}
) {
  const {
    reservePercent = config.payout.reservePercent,
    minThreshold = config.payout.minThresholdCents,
  } = options;

  // Normalize currency
  const targetCurrency = currency.toLowerCase();

  // Find balance for target currency
  const balanceItem = availableBalances.find(
    (b) => b.currency.toLowerCase() === targetCurrency
  );

  if (!balanceItem || balanceItem.amount <= 0) {
    return {
      amount: 0,
      reserve_amount: 0,
      threshold: minThreshold,
      reason: 'no_balance',
    };
  }

  const availableAmount = balanceItem.amount;

  // Calculate reserve amount
  const reserveAmount = Math.floor(availableAmount * (reservePercent / 100));

  // Calculate candidate payout amount
  const candidateAmount = availableAmount - reserveAmount;

  // Check minimum threshold
  if (candidateAmount < minThreshold) {
    return {
      amount: 0,
      reserve_amount: reserveAmount,
      threshold: minThreshold,
      reason: 'below_threshold',
      details: {
        available: availableAmount,
        afterReserve: candidateAmount,
        required: minThreshold,
      },
    };
  }

  // Valid payout
  return {
    amount: candidateAmount,
    reserve_amount: reserveAmount,
    threshold: minThreshold,
    reason: 'eligible',
    details: {
      available: availableAmount,
      reserve: reserveAmount,
      payout: candidateAmount,
    },
  };
}

/**
 * Compute payouts for multiple currencies
 *
 * @param {Array} availableBalances - Array of {currency, amount} from Stripe
 * @param {Array} enabledCurrencies - List of currencies to process (default: ['usd'])
 * @returns {Array} - Array of {currency, amount, reserve_amount, reason}
 */
function computeMultiCurrencyPayouts(
  availableBalances,
  enabledCurrencies = [config.platform.defaultCurrency]
) {
  return enabledCurrencies.map((currency) => {
    const result = computePayoutAmount(availableBalances, currency);
    return {
      currency,
      ...result,
    };
  }).filter((payout) => payout.amount > 0); // Only return eligible payouts
}

/**
 * Check if creator is eligible for payout
 *
 * @param {Object} creator - Creator object with account info
 * @param {Object} stripeAccount - Stripe account object
 * @returns {Object} - {eligible, reason}
 */
function checkPayoutEligibility(creator, stripeAccount) {
  // Check if account exists
  if (!stripeAccount || !stripeAccount.stripe_account_id) {
    return {
      eligible: false,
      reason: 'no_stripe_account',
      message: 'Creator has not set up Stripe account',
    };
  }

  // Check if payouts are enabled
  if (!stripeAccount.payouts_enabled) {
    return {
      eligible: false,
      reason: 'payouts_disabled',
      message: 'Payouts not enabled on Stripe account',
    };
  }

  // Check if charges are enabled (indicates full verification)
  if (!stripeAccount.charges_enabled) {
    return {
      eligible: false,
      reason: 'charges_disabled',
      message: 'Account not fully verified',
    };
  }

  // Check account status
  if (stripeAccount.account_status !== 'active') {
    return {
      eligible: false,
      reason: 'account_inactive',
      message: `Account status is ${stripeAccount.account_status}`,
    };
  }

  // Check creator settings (if payout settings table exists)
  if (creator.payout_enabled === false) {
    return {
      eligible: false,
      reason: 'creator_disabled_payouts',
      message: 'Creator has disabled payouts',
    };
  }

  // All checks passed
  return {
    eligible: true,
    reason: 'eligible',
    message: 'Creator is eligible for payouts',
  };
}

/**
 * Generate idempotency key for payout
 *
 * @param {string} stripeAccountId - Stripe account ID
 * @param {string} cycleDate - Cycle date (YYYY-MM-DD)
 * @param {string} currency - Currency code
 * @returns {string} - Idempotency key
 */
function generateIdempotencyKey(stripeAccountId, cycleDate, currency = 'usd') {
  return `payout:${stripeAccountId}:${cycleDate}:${currency.toLowerCase()}`;
}

/**
 * Determine payout cycle dates
 *
 * @param {Date} date - Reference date (default: now)
 * @returns {Object} - {cycleDate, periodStart, periodEnd}
 */
function determinePayoutCycle(date = new Date()) {
  const day = date.getDate();
  const year = date.getFullYear();
  const month = date.getMonth();

  let cycleDate, periodStart, periodEnd;

  if (day === config.payout.scheduleDay1) {
    // 1st of month - covers 16th to end of previous month
    cycleDate = new Date(year, month, 1);
    const prevMonth = new Date(year, month - 1, 1);
    periodStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 16);
    periodEnd = new Date(year, month, 0); // Last day of previous month
  } else if (day === config.payout.scheduleDay2) {
    // 15th of month - covers 1st to 15th of current month
    cycleDate = new Date(year, month, 15);
    periodStart = new Date(year, month, 1);
    periodEnd = new Date(year, month, 15);
  } else {
    throw new Error(`Invalid payout day: ${day}. Expected ${config.payout.scheduleDay1} or ${config.payout.scheduleDay2}`);
  }

  return {
    cycleDate: cycleDate.toISOString().split('T')[0],
    periodStart: periodStart.toISOString().split('T')[0],
    periodEnd: periodEnd.toISOString().split('T')[0],
  };
}

/**
 * Format payout amount for display
 *
 * @param {number} amountCents - Amount in cents
 * @param {string} currency - Currency code
 * @returns {string} - Formatted amount (e.g., "$150.00")
 */
function formatPayoutAmount(amountCents, currency = 'usd') {
  const amount = amountCents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

module.exports = {
  computePayoutAmount,
  computeMultiCurrencyPayouts,
  checkPayoutEligibility,
  generateIdempotencyKey,
  determinePayoutCycle,
  formatPayoutAmount,
};
