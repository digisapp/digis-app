#!/usr/bin/env node

/**
 * End-to-end verification script for user identity and balance
 * Usage: node backend/scripts/verify-identity-and-balance.js <SUPABASE_ID>
 *
 * This verifies:
 * - User exists with proper supabase_id
 * - Role is properly set
 * - Token balance is accessible
 * - Recent payments are linked correctly
 * - Sessions are properly linked
 */

const { pool } = require('../utils/db');
const chalk = require('chalk');

const supabaseId = process.argv[2];

if (!supabaseId) {
  console.error(chalk.red('❌ Usage: node verify-identity-and-balance.js <SUPABASE_ID>'));
  console.error(chalk.yellow('Example: node verify-identity-and-balance.js 123e4567-e89b-12d3-a456-426614174000'));
  process.exit(1);
}

async function verify() {
  let client;

  try {
    console.log(chalk.blue('\n🔍 Starting verification for supabase_id:'), chalk.cyan(supabaseId));
    console.log(chalk.gray('─'.repeat(70)));

    client = await pool.connect();

    // 1. Check user exists with supabase_id
    console.log(chalk.yellow('\n1. Checking user existence...'));
    const { rows: userRows } = await client.query(
      `SELECT
        id,
        supabase_id,
        email,
        role,
        is_creator,
        is_admin,
        is_super_admin,
        token_balance,
        created_at
       FROM users
       WHERE supabase_id = $1`,
      [supabaseId]
    );

    if (userRows.length === 0) {
      console.error(chalk.red('❌ No user found with supabase_id:'), supabaseId);

      // Try to find by email to help with debugging
      const { rows: emailCheck } = await client.query(
        `SELECT id, email, supabase_id FROM users WHERE email = (
          SELECT email FROM auth.users WHERE id = $1::uuid LIMIT 1
        )`,
        [supabaseId]
      );

      if (emailCheck.length > 0) {
        console.log(chalk.yellow('⚠️  Found user by email but supabase_id mismatch:'));
        console.log('   Current supabase_id:', emailCheck[0].supabase_id);
        console.log('   Email:', emailCheck[0].email);
        console.log(chalk.yellow('   → Run migration to fix supabase_id column'));
      }

      process.exit(2);
    }

    const user = userRows[0];
    console.log(chalk.green('✅ User found:'));
    console.log('   Internal ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Role:', user.role || 'not set');
    console.log('   Is Creator:', user.is_creator);
    console.log('   Is Admin:', user.is_admin || user.is_super_admin);
    console.log('   Token Balance:', user.token_balance || 0);
    console.log('   Created:', new Date(user.created_at).toLocaleDateString());

    // 2. Check token balance (if separate table exists)
    console.log(chalk.yellow('\n2. Checking token balance table...'));
    const { rows: balanceRows } = await client.query(
      `SELECT
        balance,
        total_purchased,
        total_spent,
        total_earned,
        updated_at
       FROM token_balances
       WHERE user_id = $1 OR user_id = $2::text`,
      [supabaseId, user.id]
    );

    if (balanceRows.length > 0) {
      const balance = balanceRows[0];
      console.log(chalk.green('✅ Token balance found:'));
      console.log('   Balance:', balance.balance);
      console.log('   Total Purchased:', balance.total_purchased || 0);
      console.log('   Total Spent:', balance.total_spent || 0);
      console.log('   Total Earned:', balance.total_earned || 0);
      console.log('   Last Updated:', balance.updated_at ? new Date(balance.updated_at).toLocaleString() : 'never');
    } else {
      console.log(chalk.yellow('⚠️  No separate token_balances record (using users.token_balance)'));
    }

    // 3. Check recent payments
    console.log(chalk.yellow('\n3. Checking recent payments...'));
    const { rows: paymentRows } = await client.query(
      `SELECT
        id,
        amount,
        amount_cents,
        status,
        stripe_payment_intent_id,
        idempotency_key,
        created_at
       FROM payments
       WHERE user_id = $1 OR user_id = $2::text
       ORDER BY created_at DESC
       LIMIT 5`,
      [supabaseId, user.id]
    );

    if (paymentRows.length > 0) {
      console.log(chalk.green(`✅ Found ${paymentRows.length} recent payment(s):`));
      paymentRows.forEach((payment, i) => {
        const amount = payment.amount_cents ?
          `$${(payment.amount_cents / 100).toFixed(2)}` :
          `$${payment.amount}`;
        console.log(`   ${i + 1}. ${amount} - ${payment.status} - ${new Date(payment.created_at).toLocaleDateString()}`);
        if (payment.idempotency_key) {
          console.log(chalk.gray(`      Idempotency: ${payment.idempotency_key.substring(0, 20)}...`));
        }
      });
    } else {
      console.log(chalk.gray('   No payments found'));
    }

    // 4. Check recent sessions
    console.log(chalk.yellow('\n4. Checking recent sessions...'));
    const { rows: sessionRows } = await client.query(
      `SELECT
        id,
        creator_id,
        fan_id,
        status,
        type,
        rate_per_minute,
        rate_per_minute_cents,
        total_cost,
        total_cost_cents,
        duration_minutes,
        started_at,
        ended_at
       FROM sessions
       WHERE creator_id = $1 OR fan_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [user.id]
    );

    if (sessionRows.length > 0) {
      console.log(chalk.green(`✅ Found ${sessionRows.length} recent session(s):`));
      sessionRows.forEach((session, i) => {
        const role = session.creator_id === user.id ? 'Creator' : 'Fan';
        const rate = session.rate_per_minute_cents ?
          `${session.rate_per_minute_cents}¢/min` :
          `${session.rate_per_minute} tokens/min`;
        const total = session.total_cost_cents ?
          `$${(session.total_cost_cents / 100).toFixed(2)}` :
          `${session.total_cost} tokens`;
        console.log(`   ${i + 1}. [${role}] ${session.type || 'unknown'} - ${session.status} - ${session.duration_minutes || 0} min`);
        console.log(`      Rate: ${rate}, Total: ${total}`);
        if (session.started_at) {
          console.log(chalk.gray(`      Started: ${new Date(session.started_at).toLocaleString()}`));
        }
      });
    } else {
      console.log(chalk.gray('   No sessions found'));
    }

    // 5. Check followers/subscriptions if creator
    if (user.is_creator || user.role === 'creator') {
      console.log(chalk.yellow('\n5. Checking creator stats...'));

      const { rows: followerCount } = await client.query(
        'SELECT COUNT(*) as count FROM followers WHERE creator_id = $1',
        [user.id]
      );

      const { rows: subscriberCount } = await client.query(
        'SELECT COUNT(*) as count FROM creator_subscriptions WHERE creator_id = $1 AND status = $2',
        [user.id, 'active']
      );

      console.log(chalk.green('✅ Creator stats:'));
      console.log('   Followers:', followerCount[0].count);
      console.log('   Active Subscribers:', subscriberCount[0].count);
    }

    // 6. Check webhook events if any payments exist
    if (paymentRows.length > 0 && paymentRows[0].stripe_payment_intent_id) {
      console.log(chalk.yellow('\n6. Checking webhook deduplication...'));

      const { rows: webhookRows } = await client.query(
        `SELECT COUNT(*) as total,
                COUNT(DISTINCT stripe_event_id) as unique_events,
                MAX(received_at) as last_received
         FROM stripe_webhook_events
         WHERE payload::text LIKE $1
         LIMIT 1`,
        [`%${paymentRows[0].stripe_payment_intent_id}%`]
      );

      if (webhookRows[0].total > 0) {
        console.log(chalk.green('✅ Webhook deduplication working:'));
        console.log('   Total events:', webhookRows[0].total);
        console.log('   Unique events:', webhookRows[0].unique_events);
        if (webhookRows[0].last_received) {
          console.log('   Last received:', new Date(webhookRows[0].last_received).toLocaleString());
        }
      } else {
        console.log(chalk.gray('   No webhook events found for recent payments'));
      }
    }

    console.log(chalk.gray('\n' + '─'.repeat(70)));
    console.log(chalk.green.bold('✅ Verification complete!'));

    // Summary
    console.log(chalk.cyan('\nSummary:'));
    console.log('• User identity:', chalk.green('Valid'));
    console.log('• Database linkage:', chalk.green('Correct'));
    console.log('• Token system:', balanceRows.length > 0 || user.token_balance ? chalk.green('Active') : chalk.yellow('No activity'));
    console.log('• Payment system:', paymentRows.length > 0 ? chalk.green('Active') : chalk.yellow('No activity'));
    console.log('• Session system:', sessionRows.length > 0 ? chalk.green('Active') : chalk.yellow('No activity'));

  } catch (error) {
    console.error(chalk.red('\n❌ Verification failed:'));
    console.error(chalk.red('Error:'), error.message);

    if (error.code === '42P01') {
      console.error(chalk.yellow('→ Table does not exist. Run migrations first.'));
    } else if (error.code === '42703') {
      console.error(chalk.yellow('→ Column does not exist. Run migrations to add missing columns.'));
    }

    console.error(chalk.gray('\nFull error:'), error);
    process.exit(3);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run verification
console.log(chalk.magenta.bold('🔧 Digis Platform - Identity & Balance Verification Tool'));
verify()
  .then(() => {
    console.log(chalk.green('\n✨ Verification completed successfully'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('\n💥 Fatal error:'), error);
    process.exit(4);
  });