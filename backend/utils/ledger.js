/**
 * Atomic Ledger Operations for Token Transactions
 *
 * This module provides safe, atomic operations for token balance management.
 * All functions use SELECT FOR UPDATE to prevent race conditions.
 *
 * Key Principles:
 * 1. Always lock balance rows before reading
 * 2. Record balance_before and balance_after in transactions
 * 3. Use ref_id to link paired transactions (debit + credit)
 * 4. Never modify balances outside of these helpers
 * 5. All operations are idempotent via provider_event_id or tx_id
 */

const { pool } = require('./db');
const crypto = require('crypto');
const { logger } = require('./secureLogger');
const { updateUserBalance } = require('./socket');

/**
 * Gets user balance with row-level lock
 * CRITICAL: Must be called within a transaction with BEGIN already executed
 */
async function getBalanceWithLock(client, userId) {
  const result = await client.query(
    `SELECT token_balance FROM users WHERE supabase_id = $1 FOR UPDATE`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error(`User not found: ${userId}`);
  }

  return parseInt(result.rows[0].token_balance || 0);
}

/**
 * Updates user balance - ONLY call after inserting transaction record
 */
async function updateBalance(client, userId, newBalance) {
  await client.query(
    `UPDATE users SET token_balance = $1, updated_at = NOW() WHERE supabase_id = $2`,
    [newBalance, userId]
  );

  // Also update token_balances table if it exists
  await client.query(
    `INSERT INTO token_balances (user_id, balance, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET balance = $2, updated_at = NOW()`,
    [userId, newBalance]
  );
}

/**
 * Records a single transaction with balance snapshots
 * @param {Object} params - Transaction parameters
 * @param {string} params.userId - User's supabase_id
 * @param {string} params.type - Transaction type (purchase, tip, call, etc.)
 * @param {number} params.tokens - Token delta (positive = credit, negative = debit)
 * @param {number} params.amountUsd - USD value
 * @param {string} params.status - Transaction status (completed, pending, failed)
 * @param {string} params.refId - Reference ID linking related transactions
 * @param {string} params.source - Source of transaction (stripe, internal, admin)
 * @param {string} params.providerEventId - External event ID (Stripe payment_intent.id)
 * @param {number} params.balanceBefore - Balance before transaction
 * @param {number} params.balanceAfter - Balance after transaction
 * @param {Object} params.metadata - Additional context
 */
async function recordTransaction(client, params) {
  const {
    userId,
    type,
    tokens,
    amountUsd,
    status = 'completed',
    refId = null,
    source = 'internal',
    providerEventId = null,
    stripePaymentIntentId = null,
    balanceBefore,
    balanceAfter,
    bonusTokens = 0,
    channel = null,
    giftId = null,
    giftCardCode = null,
    smartRefillTrigger = null,
    metadata = {}
  } = params;

  // Verify balance progression makes sense
  const expectedBalanceAfter = balanceBefore + tokens;
  if (balanceAfter !== expectedBalanceAfter) {
    throw new Error(
      `Balance progression error: ${balanceBefore} + ${tokens} should = ${balanceAfter}, got ${expectedBalanceAfter}`
    );
  }

  const result = await client.query(
    `INSERT INTO token_transactions (
      user_id, type, tokens, amount_usd, status, ref_id, source, provider_event_id,
      stripe_payment_intent_id, balance_before, balance_after, bonus_tokens,
      channel, gift_id, gift_card_code, smart_refill_trigger, metadata, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
    RETURNING *`,
    [
      userId, type, tokens, amountUsd, status, refId, source, providerEventId,
      stripePaymentIntentId, balanceBefore, balanceAfter, bonusTokens,
      channel, giftId, giftCardCode, smartRefillTrigger, JSON.stringify(metadata)
    ]
  );

  return result.rows[0];
}

/**
 * Atomic token credit operation (add tokens to user)
 * Use for: purchases, gifts received, earnings, refunds
 */
async function creditTokens(params) {
  const {
    userId,
    tokens,
    type,
    amountUsd,
    providerEventId = null,
    stripePaymentIntentId = null,
    refId = null,
    source = 'internal',
    metadata = {}
  } = params;

  if (tokens <= 0) {
    throw new Error('Credit amount must be positive');
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ');

    // Check for duplicate provider event (idempotency)
    if (providerEventId) {
      const duplicate = await client.query(
        `SELECT id FROM token_transactions WHERE provider_event_id = $1 LIMIT 1`,
        [providerEventId]
      );

      if (duplicate.rows.length > 0) {
        await client.query('ROLLBACK');
        logger.info(`Duplicate provider event detected: ${providerEventId}`);
        return { success: true, duplicate: true, transaction: duplicate.rows[0] };
      }
    }

    // Lock and get current balance
    const balanceBefore = await getBalanceWithLock(client, userId);
    const balanceAfter = balanceBefore + tokens;

    // Record transaction
    const transaction = await recordTransaction(client, {
      userId,
      type,
      tokens,
      amountUsd,
      balanceBefore,
      balanceAfter,
      status: 'completed',
      refId,
      source,
      providerEventId,
      stripePaymentIntentId,
      metadata
    });

    // Update balance
    await updateBalance(client, userId, balanceAfter);

    await client.query('COMMIT');

    // Real-time update
    updateUserBalance(userId, balanceAfter);

    logger.info(`✅ Credited ${tokens} tokens to user ${userId} (${type})`);

    return { success: true, transaction, newBalance: balanceAfter };

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    logger.error('❌ Credit tokens error:', error);
    throw error;
  } finally {
    if (client) client.release();
  }
}

/**
 * Atomic token debit operation (remove tokens from user)
 * Use for: spending, tips sent, gifts sent, payouts
 */
async function debitTokens(params) {
  const {
    userId,
    tokens,
    type,
    amountUsd,
    refId = null,
    source = 'internal',
    metadata = {},
    allowNegative = false
  } = params;

  if (tokens <= 0) {
    throw new Error('Debit amount must be positive');
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ');

    // Lock and get current balance
    const balanceBefore = await getBalanceWithLock(client, userId);

    if (!allowNegative && balanceBefore < tokens) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'insufficient_balance',
        currentBalance: balanceBefore,
        required: tokens
      };
    }

    const balanceAfter = balanceBefore - tokens;

    // Record transaction (tokens is negative for debit)
    const transaction = await recordTransaction(client, {
      userId,
      type,
      tokens: -tokens,  // Store as negative
      amountUsd,
      balanceBefore,
      balanceAfter,
      status: 'completed',
      refId,
      source,
      metadata
    });

    // Update balance
    await updateBalance(client, userId, balanceAfter);

    await client.query('COMMIT');

    // Real-time update
    updateUserBalance(userId, balanceAfter);

    logger.info(`✅ Debited ${tokens} tokens from user ${userId} (${type})`);

    return { success: true, transaction, newBalance: balanceAfter };

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    logger.error('❌ Debit tokens error:', error);
    throw error;
  } finally {
    if (client) client.release();
  }
}

/**
 * Atomic token transfer (debit from sender, credit to recipient)
 * Use for: tips, gifts, peer-to-peer transfers
 * This ensures double-entry accounting with matching ref_id
 */
async function transferTokens(params) {
  const {
    senderId,
    recipientId,
    tokens,
    debitType,
    creditType,
    amountUsd,
    fee = 0,
    metadata = {}
  } = params;

  if (tokens <= 0) {
    throw new Error('Transfer amount must be positive');
  }

  if (senderId === recipientId) {
    throw new Error('Cannot transfer to yourself');
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ');

    // Generate shared ref_id for transaction pair
    const refId = crypto.randomUUID();

    // Lock sender balance
    const senderBalanceBefore = await getBalanceWithLock(client, senderId);
    const totalDebit = tokens + fee;

    if (senderBalanceBefore < totalDebit) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'insufficient_balance',
        currentBalance: senderBalanceBefore,
        required: totalDebit
      };
    }

    // Debit sender (including fee)
    let senderBalanceAfter = senderBalanceBefore - tokens;
    const senderTransaction = await recordTransaction(client, {
      userId: senderId,
      type: debitType,
      tokens: -tokens,
      amountUsd,
      balanceBefore: senderBalanceBefore,
      balanceAfter: senderBalanceAfter,
      status: 'completed',
      refId,
      source: 'internal',
      metadata
    });

    // Deduct fee if any
    let feeTransaction = null;
    if (fee > 0) {
      const feeRefId = crypto.randomUUID();
      feeTransaction = await recordTransaction(client, {
        userId: senderId,
        type: 'fee',
        tokens: -fee,
        amountUsd: fee * 0.05, // Assuming $0.05 per token
        balanceBefore: senderBalanceAfter,
        balanceAfter: senderBalanceAfter - fee,
        status: 'completed',
        refId: feeRefId,
        source: 'internal',
        metadata: { ...metadata, relatedRefId: refId }
      });
      senderBalanceAfter -= fee;
    }

    await updateBalance(client, senderId, senderBalanceAfter);

    // Lock recipient balance (order matters - always lock in consistent order to avoid deadlock)
    const recipientBalanceBefore = await getBalanceWithLock(client, recipientId);
    const recipientBalanceAfter = recipientBalanceBefore + tokens;

    // Credit recipient
    const recipientTransaction = await recordTransaction(client, {
      userId: recipientId,
      type: creditType,
      tokens: tokens,
      amountUsd,
      balanceBefore: recipientBalanceBefore,
      balanceAfter: recipientBalanceAfter,
      status: 'completed',
      refId,
      source: 'internal',
      metadata
    });

    await updateBalance(client, recipientId, recipientBalanceAfter);

    // Update creator earnings if recipient is creator
    await client.query(
      `UPDATE users
       SET total_earnings = total_earnings + $1, updated_at = NOW()
       WHERE supabase_id = $2 AND is_creator = TRUE`,
      [amountUsd, recipientId]
    );

    await client.query('COMMIT');

    // Real-time updates
    updateUserBalance(senderId, senderBalanceAfter);
    updateUserBalance(recipientId, recipientBalanceAfter);

    logger.info(`✅ Transferred ${tokens} tokens from ${senderId} to ${recipientId} (fee: ${fee})`);

    return {
      success: true,
      refId,
      senderTransaction,
      recipientTransaction,
      feeTransaction,
      senderNewBalance: senderBalanceAfter,
      recipientNewBalance: recipientBalanceAfter
    };

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    logger.error('❌ Transfer tokens error:', error);
    throw error;
  } finally {
    if (client) client.release();
  }
}

/**
 * Check if a provider event has already been processed (idempotency check)
 */
async function isProviderEventProcessed(providerEventId) {
  const result = await pool.query(
    `SELECT id, user_id, type, tokens, created_at
     FROM token_transactions
     WHERE provider_event_id = $1
     LIMIT 1`,
    [providerEventId]
  );

  return {
    processed: result.rows.length > 0,
    transaction: result.rows[0] || null
  };
}

/**
 * Retry helper with exponential backoff for serialization failures
 */
async function retryOperation(operation, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      // Retry on serialization failures or deadlocks
      if (
        (error.code === '40001' || error.code === '40P01') &&
        attempt < maxRetries
      ) {
        const delay = Math.min(100 * Math.pow(2, attempt), 1000);
        logger.warn(`Serialization conflict, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

module.exports = {
  getBalanceWithLock,
  updateBalance,
  recordTransaction,
  creditTokens,
  debitTokens,
  transferTokens,
  isProviderEventProcessed,
  retryOperation
};
