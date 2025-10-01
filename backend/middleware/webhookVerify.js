const crypto = require('crypto');
const getRawBody = require('raw-body');

/**
 * Raw body parser for webhooks
 * Stores raw body for signature verification
 */
async function rawBodyParser(req, res, next) {
  try {
    req.rawBody = await getRawBody(req, {
      length: req.headers['content-length'],
      limit: '1mb',
      encoding: 'utf8',
    });
    next();
  } catch (error) {
    console.error('Raw body parsing error:', error);
    res.status(400).json({ error: 'Invalid request body' });
  }
}

/**
 * Stripe webhook signature verification
 * @param {string} secret - Stripe webhook secret
 */
function verifyStripeSignature(secret) {
  return (req, res, next) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).send('Missing Stripe signature');
    }

    try {
      // Stripe uses their own SDK for verification
      // This is a simplified version - use stripe.webhooks.constructEvent in production
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

      stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        secret
      );

      next();
    } catch (error) {
      console.error('Stripe signature verification failed:', error.message);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }
  };
}

/**
 * Generic HMAC signature verification
 * @param {string} headerName - Name of the signature header
 * @param {string} secret - HMAC secret
 */
function verifyHmacSignature(headerName, secret) {
  return (req, res, next) => {
    const signature = req.headers[headerName.toLowerCase()];

    if (!signature) {
      return res.status(400).send(`Missing ${headerName} header`);
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(req.rawBody)
        .digest('hex');

      // Timing-safe comparison
      const signatureBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);

      if (
        signatureBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
      ) {
        throw new Error('Signature mismatch');
      }

      next();
    } catch (error) {
      console.error('HMAC verification failed:', error.message);
      return res.status(400).send('Invalid signature');
    }
  };
}

module.exports = {
  rawBodyParser,
  verifyStripeSignature,
  verifyHmacSignature,
};
