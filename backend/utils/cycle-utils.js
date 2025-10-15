/**
 * Payout Cycle Utilities
 *
 * Helpers for computing payout cycle dates (1st & 15th of month).
 * Used by both frontend and backend to ensure consistent cycle calculations.
 */

/**
 * Get the next payout cycle date from a reference date
 *
 * Logic:
 * - If today is 1st or before: next cycle is 1st of current month
 * - If today is 2nd-15th: next cycle is 15th of current month
 * - If today is 16th or later: next cycle is 1st of next month
 *
 * @param {Date} referenceDate - Reference date (default: now)
 * @returns {Date} - Next cycle date (always 1st or 15th)
 */
function nextCycleDate(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const day = referenceDate.getUTCDate();

  if (day <= 1) {
    // Today is 1st: next cycle is 1st of this month
    return new Date(Date.UTC(year, month, 1));
  } else if (day <= 15) {
    // Today is 2nd-15th: next cycle is 15th of this month
    return new Date(Date.UTC(year, month, 15));
  } else {
    // Today is 16th or later: next cycle is 1st of next month
    return new Date(Date.UTC(year, month + 1, 1));
  }
}

/**
 * Get the current payout cycle date from a reference date
 *
 * Logic:
 * - If today is 1st-15th: current cycle is 1st of current month
 * - If today is 16th-end: current cycle is 15th of current month
 *
 * @param {Date} referenceDate - Reference date (default: now)
 * @returns {Date} - Current cycle date (always 1st or 15th)
 */
function currentCycleDate(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const day = referenceDate.getUTCDate();

  if (day <= 15) {
    // First half of month: cycle is 1st
    return new Date(Date.UTC(year, month, 1));
  } else {
    // Second half of month: cycle is 15th
    return new Date(Date.UTC(year, month, 15));
  }
}

/**
 * Format cycle date as YYYY-MM-DD string
 *
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatCycleDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Get days until next payout cycle
 *
 * @param {Date} referenceDate - Reference date (default: now)
 * @returns {number} - Days until next cycle
 */
function daysUntilNextCycle(referenceDate = new Date()) {
  const next = nextCycleDate(referenceDate);
  const now = new Date(referenceDate);
  const diffMs = next.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date is a payout day (1st or 15th)
 *
 * @param {Date} date - Date to check
 * @returns {boolean} - True if 1st or 15th
 */
function isPayoutDay(date) {
  const day = date.getUTCDate();
  return day === 1 || day === 15;
}

/**
 * Get human-readable cycle description
 *
 * @param {Date} cycleDate - Cycle date
 * @returns {string} - Description (e.g., "November 1st, 2025" or "November 15th, 2025")
 */
function cycleDateDescription(cycleDate) {
  const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
  return cycleDate.toLocaleDateString('en-US', options);
}

/**
 * Get payout window description for UI
 *
 * @param {Date} referenceDate - Reference date (default: now)
 * @returns {Object} - { nextCycle, daysUntil, description }
 */
function getPayoutWindow(referenceDate = new Date()) {
  const next = nextCycleDate(referenceDate);
  const daysUntil = daysUntilNextCycle(referenceDate);
  const description = cycleDateDescription(next);

  return {
    nextCycle: next,
    nextCycleFormatted: formatCycleDate(next),
    daysUntil,
    description,
    displayText: `Next payout: ${description} (in ${daysUntil} ${daysUntil === 1 ? 'day' : 'days'})`
  };
}

/**
 * Check if within cutoff window for current cycle
 * (optional feature for enforcing "must opt-in 24h before cycle")
 *
 * @param {Date} referenceDate - Reference date (default: now)
 * @param {number} cutoffHours - Hours before cycle (default: 0 = no cutoff)
 * @returns {boolean} - True if within cutoff window
 */
function isWithinCutoff(referenceDate = new Date(), cutoffHours = 0) {
  if (cutoffHours === 0) return true; // No cutoff enforced

  const next = nextCycleDate(referenceDate);
  const cutoffTime = new Date(next.getTime() - (cutoffHours * 60 * 60 * 1000));

  return referenceDate < cutoffTime;
}

/**
 * Get effective cycle date accounting for cutoff time
 * If current time is after cutoff on a cycle day, bumps to next cycle
 *
 * @param {Date} referenceDate - Reference date (default: now)
 * @param {number} cutoffHourUTC - Cutoff hour in UTC (default: 6 = 6am UTC)
 * @returns {Date} - Effective cycle date
 */
function getEffectiveCycleDate(referenceDate = new Date(), cutoffHourUTC = 6) {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const day = referenceDate.getUTCDate();
  const hour = referenceDate.getUTCHours();

  // Determine next cycle
  let targetCycle;
  if (day <= 1) {
    targetCycle = new Date(Date.UTC(year, month, 1));
  } else if (day <= 15) {
    targetCycle = new Date(Date.UTC(year, month, 15));
  } else {
    targetCycle = new Date(Date.UTC(year, month + 1, 1));
  }

  // Check if we're on a cycle day after cutoff hour
  const isCycleDay = (day === 1 || day === 15);
  const afterCutoff = hour >= cutoffHourUTC;

  if (isCycleDay && afterCutoff) {
    // Bump to next cycle (add 1 day and recalculate)
    const tomorrow = new Date(referenceDate.getTime() + 86400000);
    return nextCycleDate(tomorrow);
  }

  return targetCycle;
}

module.exports = {
  nextCycleDate,
  currentCycleDate,
  formatCycleDate,
  daysUntilNextCycle,
  isPayoutDay,
  cycleDateDescription,
  getPayoutWindow,
  isWithinCutoff,
  getEffectiveCycleDate,
};
