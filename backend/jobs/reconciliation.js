/**
 * Automated Ledger Reconciliation Job
 *
 * Runs hourly to verify token ledger integrity:
 * 1. Balance reconciliation: Purchased - Burned = Current Balances
 * 2. Double-entry verification: All transaction pairs sum to zero
 * 3. Stripe sync check: All payment_intents recorded in ledger
 *
 * Usage:
 *   node backend/jobs/reconciliation.js
 *
 * Or via cron (add to vercel.json or use Upstash QStash):
 *   0 * * * * node backend/jobs/reconciliation.js
 */

const { pool } = require('../utils/db');
const { logger } = require('../utils/secureLogger');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Main reconciliation check
 */
async function runReconciliation() {
  const startTime = Date.now();
  logger.info('🔍 Starting ledger reconciliation...');

  const results = {
    timestamp: new Date().toISOString(),
    checks: [],
    overallStatus: 'passed'
  };

  try {
    // Check 1: Balance reconciliation
    const balanceCheck = await checkBalanceReconciliation();
    results.checks.push(balanceCheck);
    if (balanceCheck.status !== 'passed') results.overallStatus = 'failed';

    // Check 2: Double-entry verification
    const doubleEntryCheck = await checkDoubleEntryIntegrity();
    results.checks.push(doubleEntryCheck);
    if (doubleEntryCheck.status !== 'passed') results.overallStatus = 'warning';

    // Check 3: Stripe reconciliation (last 24 hours)
    const stripeCheck = await checkStripeSync();
    results.checks.push(stripeCheck);
    if (stripeCheck.status !== 'passed') results.overallStatus = 'warning';

    // Record results in audit table
    await recordReconciliationResults(results);

    const duration = Date.now() - startTime;
    logger.info(`✅ Reconciliation complete in ${duration}ms - Status: ${results.overallStatus}`);

    // Alert if failed
    if (results.overallStatus === 'failed') {
      await sendAlert(results);
    }

    return results;

  } catch (error) {
    logger.error('❌ Reconciliation job failed:', error);
    results.overallStatus = 'failed';
    results.error = error.message;

    await recordReconciliationResults(results);
    await sendAlert(results);

    throw error;
  }
}

/**
 * Check 1: Verify total tokens in circulation matches ledger
 */
async function checkBalanceReconciliation() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      WITH
        purchased AS (
          SELECT COALESCE(SUM(tokens), 0) AS total
          FROM token_transactions
          WHERE type IN ('purchase', 'quick_purchase', 'smart_refill', 'gift_card_redeemed')
            AND status = 'completed'
        ),
        burned AS (
          SELECT COALESCE(SUM(tokens), 0) AS total
          FROM token_transactions
          WHERE type IN ('payout', 'chargeback', 'burn')
            AND status = 'completed'
            AND tokens < 0
        ),
        fees AS (
          SELECT COALESCE(SUM(ABS(tokens)), 0) AS total
          FROM token_transactions
          WHERE type = 'fee'
            AND status = 'completed'
        ),
        user_balances AS (
          SELECT COALESCE(SUM(token_balance), 0) AS total
          FROM users
        )
      SELECT
        purchased.total AS total_purchased,
        burned.total AS total_burned,
        fees.total AS total_fees,
        user_balances.total AS total_in_circulation,
        (purchased.total + burned.total - fees.total) AS expected_circulation,
        (user_balances.total - (purchased.total + burned.total - fees.total)) AS discrepancy
      FROM purchased, burned, fees, user_balances
    `);

    const data = result.rows[0];
    const isBalanced = Math.abs(data.discrepancy) < 1; // Allow 1 token rounding error

    const status = isBalanced ? 'passed' : 'failed';

    logger.info(`Balance Check: ${status}`);
    logger.info(`  Purchased: ${data.total_purchased}`);
    logger.info(`  Burned: ${data.total_burned}`);
    logger.info(`  Fees: ${data.total_fees}`);
    logger.info(`  In Circulation: ${data.total_in_circulation}`);
    logger.info(`  Expected: ${data.expected_circulation}`);
    logger.info(`  Discrepancy: ${data.discrepancy}`);

    return {
      checkType: 'balance_reconciliation',
      status,
      details: {
        totalPurchased: parseInt(data.total_purchased),
        totalBurned: parseInt(data.total_burned),
        totalFees: parseInt(data.total_fees),
        totalInCirculation: parseInt(data.total_in_circulation),
        expectedCirculation: parseInt(data.expected_circulation),
        discrepancy: parseInt(data.discrepancy)
      },
      message: isBalanced
        ? 'Ledger balanced correctly'
        : `CRITICAL: Discrepancy of ${data.discrepancy} tokens detected`
    };

  } finally {
    client.release();
  }
}

/**
 * Check 2: Verify all transaction pairs (tips, gifts) sum to zero
 */
async function checkDoubleEntryIntegrity() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        ref_id,
        SUM(tokens) AS total_sum,
        COUNT(*) AS transaction_count,
        ARRAY_AGG(user_id::TEXT) AS user_ids,
        ARRAY_AGG(type) AS types
      FROM token_transactions
      WHERE ref_id IS NOT NULL
        AND type IN ('tip', 'call', 'gift_sent', 'gift_received')
      GROUP BY ref_id
      HAVING SUM(tokens) != 0
      ORDER BY ABS(SUM(tokens)) DESC
      LIMIT 10
    `);

    const unbalancedPairs = result.rows;
    const status = unbalancedPairs.length === 0 ? 'passed' : 'warning';

    if (unbalancedPairs.length > 0) {
      logger.warn(`⚠️  Found ${unbalancedPairs.length} unbalanced transaction pairs:`);
      unbalancedPairs.forEach(pair => {
        logger.warn(`  ref_id: ${pair.ref_id}, sum: ${pair.total_sum}, count: ${pair.transaction_count}`);
      });
    } else {
      logger.info('✅ All transaction pairs balanced');
    }

    return {
      checkType: 'double_entry_integrity',
      status,
      details: {
        unbalancedCount: unbalancedPairs.length,
        unbalancedPairs: unbalancedPairs.map(p => ({
          refId: p.ref_id,
          sum: parseInt(p.total_sum),
          count: parseInt(p.transaction_count),
          userIds: p.user_ids,
          types: p.types
        }))
      },
      message: status === 'passed'
        ? 'All transaction pairs balanced'
        : `${unbalancedPairs.length} unbalanced pairs found`
    };

  } finally {
    client.release();
  }
}

/**
 * Check 3: Verify Stripe payments are recorded in ledger
 */
async function checkStripeSync() {
  const client = await pool.connect();
  try {
    // Get all payment intents from last 24 hours from Stripe
    const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;

    const stripePayments = await stripe.paymentIntents.list({
      created: { gte: oneDayAgo },
      limit: 100
    });

    // Get all recorded payment intents from ledger
    const ledgerResult = await client.query(`
      SELECT DISTINCT stripe_payment_intent_id
      FROM token_transactions
      WHERE stripe_payment_intent_id IS NOT NULL
        AND created_at > NOW() - INTERVAL '24 hours'
    `);

    const ledgerPaymentIds = new Set(ledgerResult.rows.map(r => r.stripe_payment_intent_id));
    const stripePaymentIds = new Set(stripePayments.data.map(p => p.id));

    // Find missing payments
    const missingInLedger = stripePayments.data
      .filter(p => p.status === 'succeeded' && !ledgerPaymentIds.has(p.id))
      .map(p => p.id);

    // Find extra payments (in ledger but not in Stripe - could be old)
    const extraInLedger = [...ledgerPaymentIds]
      .filter(id => !stripePaymentIds.has(id));

    const status = missingInLedger.length === 0 ? 'passed' : 'warning';

    if (missingInLedger.length > 0) {
      logger.warn(`⚠️  ${missingInLedger.length} Stripe payments not found in ledger:`);
      missingInLedger.forEach(id => logger.warn(`  ${id}`));
    }

    if (extraInLedger.length > 0) {
      logger.info(`ℹ️  ${extraInLedger.length} old payments in ledger (expected)`);
    }

    return {
      checkType: 'stripe_sync',
      status,
      details: {
        stripePaymentCount: stripePayments.data.length,
        ledgerPaymentCount: ledgerPaymentIds.size,
        missingInLedger: missingInLedger,
        extraInLedger: extraInLedger.slice(0, 10) // Limit to first 10
      },
      message: status === 'passed'
        ? 'Stripe and ledger in sync'
        : `${missingInLedger.length} payments missing from ledger`
    };

  } catch (error) {
    logger.error('Stripe sync check failed:', error);
    return {
      checkType: 'stripe_sync',
      status: 'warning',
      details: { error: error.message },
      message: 'Stripe API check failed (non-critical)'
    };
  } finally {
    client.release();
  }
}

/**
 * Record reconciliation results in audit table
 */
async function recordReconciliationResults(results) {
  const client = await pool.connect();
  try {
    const balanceCheck = results.checks.find(c => c.checkType === 'balance_reconciliation');
    const doubleEntryCheck = results.checks.find(c => c.checkType === 'double_entry_integrity');
    const stripeCheck = results.checks.find(c => c.checkType === 'stripe_sync');

    await client.query(`
      INSERT INTO reconciliation_audit (
        check_timestamp,
        check_type,
        status,
        total_purchased,
        total_burned,
        total_user_balances,
        total_fees,
        expected_balance,
        actual_balance,
        discrepancy,
        stripe_total_payments,
        ledger_total_purchases,
        missing_events,
        unbalanced_ref_ids,
        details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      results.timestamp,
      'automated_hourly',
      results.overallStatus,
      balanceCheck?.details.totalPurchased || 0,
      balanceCheck?.details.totalBurned || 0,
      balanceCheck?.details.totalInCirculation || 0,
      balanceCheck?.details.totalFees || 0,
      balanceCheck?.details.expectedCirculation || 0,
      balanceCheck?.details.totalInCirculation || 0,
      balanceCheck?.details.discrepancy || 0,
      stripeCheck?.details.stripePaymentCount || 0,
      stripeCheck?.details.ledgerPaymentCount || 0,
      stripeCheck?.details.missingInLedger || [],
      doubleEntryCheck?.details.unbalancedPairs?.map(p => p.refId) || [],
      JSON.stringify(results)
    ]);

    logger.info('📊 Reconciliation results recorded in audit table');

  } catch (error) {
    logger.error('Failed to record reconciliation results:', error);
  } finally {
    client.release();
  }
}

/**
 * Send alert for failed reconciliation
 * TODO: Integrate with your alerting system (Slack, PagerDuty, email, etc.)
 */
async function sendAlert(results) {
  logger.error('🚨 RECONCILIATION ALERT:', JSON.stringify(results, null, 2));

  // TODO: Send to Slack webhook
  // await fetch(process.env.SLACK_WEBHOOK_URL, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     text: `🚨 Ledger Reconciliation Failed`,
  //     blocks: [
  //       {
  //         type: 'section',
  //         text: { type: 'mrkdwn', text: `*Status:* ${results.overallStatus}` }
  //       },
  //       ...results.checks.map(check => ({
  //         type: 'section',
  //         text: { type: 'mrkdwn', text: `*${check.checkType}:* ${check.message}` }
  //       }))
  //     ]
  //   })
  // });

  // TODO: Send email via SendGrid/AWS SES
}

/**
 * Run reconciliation immediately (for testing or manual runs)
 */
if (require.main === module) {
  runReconciliation()
    .then(results => {
      console.log('\n=== Reconciliation Complete ===');
      console.log(`Status: ${results.overallStatus}`);
      console.log('\nChecks:');
      results.checks.forEach(check => {
        console.log(`  ${check.checkType}: ${check.status}`);
        console.log(`    ${check.message}`);
      });
      process.exit(results.overallStatus === 'passed' ? 0 : 1);
    })
    .catch(error => {
      console.error('Reconciliation failed:', error);
      process.exit(1);
    });
}

module.exports = { runReconciliation };
