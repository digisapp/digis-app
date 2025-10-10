/**
 * Inngest API Endpoint (Vercel)
 *
 * This endpoint serves Inngest's webhook handler.
 * Inngest will call this endpoint to execute your functions.
 *
 * For Express (development): Use as middleware
 * For Vercel (production): Export as serverless function
 */

const { serve } = require('inngest/express');
const { inngest } = require('../inngest/client');

// Import all Inngest functions
const {
  processPayouts,
  retryFailedPayouts,
  updateAccountStatuses,
  processSinglePayout,
} = require('../inngest/functions/payouts');

// Import V2 production-ready payout functions
const {
  createPayoutBatch,
  processPayoutChunk,
  retryFailedPayouts: retryFailedPayoutsV2,
} = require('../inngest/functions/payouts-v2');

const {
  dailyEarningsRollup,
  monthlyEarningsRollup,
  warmAnalyticsCache,
} = require('../inngest/functions/earnings-rollups');

/**
 * Create Inngest handler with all functions
 */
const handler = serve({
  client: inngest,
  functions: [
    // V2 Production-ready payout functions (use these for new deployments)
    createPayoutBatch,
    processPayoutChunk,
    retryFailedPayoutsV2,

    // Legacy payout functions (keep for backward compatibility)
    processPayouts,
    retryFailedPayouts,
    updateAccountStatuses,
    processSinglePayout,

    // Earnings rollup functions
    dailyEarningsRollup,
    monthlyEarningsRollup,
    warmAnalyticsCache,
  ],
  // Serve UI in development only
  servePath: process.env.NODE_ENV === 'development' ? '/api/inngest' : undefined,
  // Signature verification (production)
  signingKey: process.env.INNGEST_SIGNING_KEY,
});

/**
 * Export for Express (development)
 */
module.exports = handler;

/**
 * Export for Vercel serverless (production)
 *
 * In Vercel, create: /api/inngest.js or /pages/api/inngest.ts
 * With contents: export { default } from '../backend/api/inngest';
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports.GET = handler;
  module.exports.POST = handler;
  module.exports.PUT = handler;
}
