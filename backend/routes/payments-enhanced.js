/**
 * Enhanced payment routes with idempotency and rate limiting
 */
const express = require('express');
const router = express.Router();
const { authenticateToken, requireTokens } = require('../middleware/auth');
const { idempotency, requireIdempotencyKey } = require('../middleware/idempotency');
const {
  tokenPurchaseLimiter,
  withdrawalLimiter,
  dailySpendingLimit,
  financialEndpointProtection
} = require('../middleware/financial-rate-limiter');
const { asyncHandler, InsufficientFundsError, PaymentDeclinedError, ValidationError } = require('../utils/app-errors');
const { pool } = require('../utils/db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/secureLogger');

/**
 * Token purchase with idempotency and rate limiting
 */
router.post('/purchase-tokens',
  authenticateToken,
  requireIdempotencyKey,
  tokenPurchaseLimiter,
  dailySpendingLimit(10000), // $100 daily limit
  idempotency({ ttl: 86400 }),
  asyncHandler(async (req, res) => {
    const { amountInCents, paymentMethodId } = req.body;
    const userId = req.user.supabase_id;
    const idempotencyKey = req.headers['idempotency-key'];

    // Validate amount
    if (!amountInCents || amountInCents < 100) {
      throw new ValidationError('Invalid amount', [{
        field: 'amountInCents',
        message: 'Amount must be at least 100 cents ($1.00)'
      }]);
    }

    // Begin transaction
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Create Stripe payment intent with idempotency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        payment_method: paymentMethodId,
        confirm: true,
        metadata: {
          userId,
          type: 'token_purchase',
          idempotencyKey
        }
      }, {
        idempotencyKey: `stripe_${idempotencyKey}`
      });

      if (paymentIntent.status !== 'succeeded') {
        throw new PaymentDeclinedError('Payment was not successful', paymentIntent.last_payment_error?.code);
      }

      // Calculate tokens (using cents to avoid floating point issues)
      const tokenRate = parseInt(process.env.TOKEN_TO_USD_RATE * 100) || 5; // 5 cents per token
      const tokensToAdd = Math.floor(amountInCents / tokenRate);

      // Get user account
      const accountResult = await client.query(`
        SELECT id, balance_cents FROM accounts
        WHERE owner_id = $1 AND type = 'user'
        FOR UPDATE
      `, [userId]);

      let accountId;
      if (accountResult.rows.length === 0) {
        // Create user account if doesn't exist
        const createResult = await client.query(`
          INSERT INTO accounts (owner_id, type, currency, balance_cents)
          VALUES ($1, 'user', 'USD', 0)
          RETURNING id
        `, [userId]);
        accountId = createResult.rows[0].id;
      } else {
        accountId = accountResult.rows[0].id;
      }

      // Get platform account
      const platformResult = await client.query(`
        SELECT id FROM accounts
        WHERE owner_id = '00000000-0000-0000-0000-000000000000'
        AND type = 'platform'
      `);
      const platformAccountId = platformResult.rows[0].id;

      // Use the transfer_tokens function for double-entry bookkeeping
      const journalResult = await client.query(`
        SELECT transfer_tokens($1, $2, $3, $4, $5, $6, $7) as journal_id
      `, [
        platformAccountId,  // from (platform receives payment)
        accountId,          // to (user account gets tokens)
        amountInCents,     // amount in cents
        'token_purchase',   // transaction type
        paymentIntent.id,   // reference ID
        `Token purchase: ${tokensToAdd} tokens`,
        idempotencyKey
      ]);

      // Update user's token balance in the users table (legacy support)
      await client.query(`
        UPDATE users
        SET token_balance = token_balance + $1
        WHERE supabase_id = $2
      `, [tokensToAdd, userId]);

      // Record in payments table (legacy support)
      await client.query(`
        INSERT INTO payments (
          user_id, stripe_payment_intent_id, amount_cents,
          tokens_purchased, status, idempotency_key
        ) VALUES ($1, $2, $3, $4, 'completed', $5)
      `, [userId, paymentIntent.id, amountInCents, tokensToAdd, idempotencyKey]);

      await client.query('COMMIT');

      logger.info('Token purchase completed', {
        userId,
        amountInCents,
        tokensAdded: tokensToAdd,
        journalId: journalResult.rows[0].journal_id
      });

      res.json({
        success: true,
        tokensAdded: tokensToAdd,
        newBalance: tokensToAdd, // Would need to query for actual balance
        paymentIntentId: paymentIntent.id,
        journalId: journalResult.rows[0].journal_id
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  })
);

/**
 * Withdrawal with strict rate limiting
 */
router.post('/withdraw',
  authenticateToken,
  requireIdempotencyKey,
  withdrawalLimiter,
  idempotency({ ttl: 172800 }), // 48 hour TTL for withdrawals
  asyncHandler(async (req, res) => {
    const { amountInCents, accountId } = req.body;
    const userId = req.user.supabase_id;
    const idempotencyKey = req.headers['idempotency-key'];

    // Validate amount
    if (!amountInCents || amountInCents < 1000) {
      throw new ValidationError('Minimum withdrawal is $10.00');
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check user balance
      const balanceResult = await client.query(`
        SELECT balance_cents FROM accounts
        WHERE owner_id = $1 AND type = 'user'
        FOR UPDATE
      `, [userId]);

      if (balanceResult.rows.length === 0 || balanceResult.rows[0].balance_cents < amountInCents) {
        throw new InsufficientFundsError(
          'Insufficient balance for withdrawal',
          amountInCents,
          balanceResult.rows[0]?.balance_cents || 0
        );
      }

      // Create pending withdrawal
      const withdrawalId = uuidv4();
      await client.query(`
        INSERT INTO pending_transactions (
          idempotency_key, transaction_type, amount_cents,
          from_account_id, status, expires_at, metadata
        ) VALUES ($1, 'withdrawal', $2, $3, 'pending', NOW() + INTERVAL '7 days', $4)
      `, [
        idempotencyKey,
        amountInCents,
        balanceResult.rows[0].id,
        JSON.stringify({ userId, accountId, requestedAt: new Date() })
      ]);

      await client.query('COMMIT');

      res.json({
        success: true,
        withdrawalId,
        status: 'pending',
        message: 'Withdrawal request submitted for review',
        estimatedProcessingTime: '2-3 business days'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  })
);

/**
 * Transfer tokens between users
 */
router.post('/transfer',
  authenticateToken,
  financialEndpointProtection,
  idempotency({ ttl: 3600 }),
  asyncHandler(async (req, res) => {
    const { recipientId, amountInCents, message } = req.body;
    const senderId = req.user.supabase_id;

    if (senderId === recipientId) {
      throw new ValidationError('Cannot transfer to yourself');
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get sender account
      const senderResult = await client.query(`
        SELECT id, balance_cents FROM accounts
        WHERE owner_id = $1 AND type = 'user'
        FOR UPDATE
      `, [senderId]);

      if (senderResult.rows.length === 0 || senderResult.rows[0].balance_cents < amountInCents) {
        throw new InsufficientFundsError('Insufficient balance');
      }

      // Get or create recipient account
      let recipientAccountId;
      const recipientResult = await client.query(`
        SELECT id FROM accounts
        WHERE owner_id = $1 AND type = 'user'
      `, [recipientId]);

      if (recipientResult.rows.length === 0) {
        const createResult = await client.query(`
          INSERT INTO accounts (owner_id, type, currency)
          VALUES ($1, 'user', 'USD')
          RETURNING id
        `, [recipientId]);
        recipientAccountId = createResult.rows[0].id;
      } else {
        recipientAccountId = recipientResult.rows[0].id;
      }

      // Perform transfer
      const transferId = uuidv4();
      const journalResult = await client.query(`
        SELECT transfer_tokens($1, $2, $3, $4, $5, $6, $7) as journal_id
      `, [
        senderResult.rows[0].id,
        recipientAccountId,
        amountInCents,
        'token_transfer',
        transferId,
        message || 'Token transfer',
        `transfer_${transferId}`
      ]);

      await client.query('COMMIT');

      res.json({
        success: true,
        transferId,
        journalId: journalResult.rows[0].journal_id,
        amountInCents,
        message: 'Transfer completed successfully'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  })
);

module.exports = router;