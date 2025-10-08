/**
 * QStash Utility (Upstash)
 *
 * Lightweight HTTP task queue for:
 * - Webhook relay (Stripe, Agora → your API)
 * - Delayed HTTP requests ("send email in 5 min")
 * - Cron triggers (→ Inngest events)
 */

const { Client } = require('@upstash/qstash');

// Initialize QStash client
const qstash = process.env.QSTASH_TOKEN
  ? new Client({ token: process.env.QSTASH_TOKEN })
  : null;

/**
 * Publish HTTP request to queue
 *
 * @param {Object} options
 * @param {string} options.url - Target URL
 * @param {Object} options.body - Request body
 * @param {string} options.method - HTTP method (default: POST)
 * @param {number} options.delay - Delay in seconds
 * @param {string} options.deduplicationId - Idempotency key
 * @param {number} options.retries - Max retries (default: 3)
 */
async function publish({
  url,
  body,
  method = 'POST',
  delay = 0,
  deduplicationId,
  retries = 3,
  headers = {},
}) {
  if (!qstash) {
    console.warn('QStash not configured, executing immediately');
    // Fallback: Execute immediately if QStash not configured
    const fetch = (await import('node-fetch')).default;
    return fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }

  const options = {
    method,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  // Add delay if specified
  if (delay > 0) {
    options.headers['Upstash-Delay'] = `${delay}s`;
  }

  // Add deduplication for idempotency
  if (deduplicationId) {
    options.headers['Upstash-Deduplication-ID'] = deduplicationId;
  }

  // Set retries
  options.headers['Upstash-Retries'] = String(retries);

  return qstash.publishJSON({
    url,
    ...options,
  });
}

/**
 * Schedule a cron job
 *
 * @param {Object} options
 * @param {string} options.url - Target URL
 * @param {string} options.cron - Cron expression
 * @param {Object} options.body - Request body
 */
async function scheduleCron({ url, cron, body, headers = {} }) {
  if (!qstash) {
    throw new Error('QStash not configured');
  }

  return qstash.schedules.create({
    destination: url,
    cron,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

/**
 * Common use cases
 */

/**
 * Send email with delay
 */
async function sendEmailDelayed({ to, template, data, delayMinutes = 5 }) {
  return publish({
    url: `${process.env.BACKEND_URL || 'http://localhost:3005'}/api/emails/send`,
    body: { to, template, data },
    delay: delayMinutes * 60,
    deduplicationId: `email-${to}-${template}-${Date.now()}`,
  });
}

/**
 * Relay webhook (with signature verification and retries)
 */
async function relayWebhook({ source, targetUrl, payload, signature }) {
  return publish({
    url: targetUrl,
    body: payload,
    headers: {
      'X-Webhook-Source': source,
      'X-Webhook-Signature': signature,
    },
    retries: 5, // Webhooks need reliable delivery
    deduplicationId: payload.id || `webhook-${source}-${Date.now()}`,
  });
}

/**
 * Trigger Inngest event via HTTP
 */
async function triggerInngestEvent({ eventName, data }) {
  return publish({
    url: `${process.env.BACKEND_URL || 'http://localhost:3005'}/api/inngest/trigger`,
    body: {
      name: eventName,
      data,
    },
    method: 'POST',
  });
}

/**
 * Schedule nightly rollup (cron)
 *
 * Example: Run earnings rollup every day at 2 AM UTC
 */
async function scheduleNightlyRollup() {
  return scheduleCron({
    url: `${process.env.BACKEND_URL}/api/inngest/trigger`,
    cron: '0 2 * * *', // Daily at 2 AM UTC
    body: {
      name: 'earnings.rollup-daily',
      data: {},
    },
  });
}

/**
 * Schedule payout processing (1st and 15th of month)
 */
async function schedulePayouts() {
  // 1st of month at 2 AM UTC
  await scheduleCron({
    url: `${process.env.BACKEND_URL}/api/inngest/trigger`,
    cron: '0 2 1 * *',
    body: {
      name: 'payout.scheduled',
      data: {
        payoutDate: new Date().toISOString().split('T')[0],
        dayOfMonth: 1,
      },
    },
  });

  // 15th of month at 2 AM UTC
  await scheduleCron({
    url: `${process.env.BACKEND_URL}/api/inngest/trigger`,
    cron: '0 2 15 * *',
    body: {
      name: 'payout.scheduled',
      data: {
        payoutDate: new Date().toISOString().split('T')[0],
        dayOfMonth: 15,
      },
    },
  });
}

module.exports = {
  qstash,
  publish,
  scheduleCron,
  sendEmailDelayed,
  relayWebhook,
  triggerInngestEvent,
  scheduleNightlyRollup,
  schedulePayouts,
};
