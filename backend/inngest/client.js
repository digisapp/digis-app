/**
 * Inngest Client Configuration
 *
 * Central Inngest client for Digis background workflows.
 * Replaces BullMQ for Vercel-compatible serverless execution.
 */

const { Inngest } = require('inngest');

// Initialize Inngest client
const inngest = new Inngest({
  id: 'digis-app',
  name: 'Digis Background Workflows',
  // Event key for secure communication (set in production)
  eventKey: process.env.INNGEST_EVENT_KEY,
  // Optional: Enable logging in development
  logger: process.env.NODE_ENV === 'development' ? console : undefined,
});

module.exports = { inngest };
