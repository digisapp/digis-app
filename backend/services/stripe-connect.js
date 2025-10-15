const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { pool } = require('../utils/db');

class StripeConnectService {
  // Create a connected account for a creator
  async createConnectedAccount(creatorId, creatorData) {
    try {
      // Check if account already exists
      const existingAccount = await pool.query(
        'SELECT stripe_account_id FROM creator_stripe_accounts WHERE creator_id = $1',
        [creatorId]
      );

      if (existingAccount.rows.length > 0 && existingAccount.rows[0].stripe_account_id) {
        return { accountId: existingAccount.rows[0].stripe_account_id };
      }

      // Create Stripe Connect account with manual payout schedule
      const account = await stripe.accounts.create({
        type: 'express',
        country: creatorData.country || 'US',
        email: creatorData.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        business_type: 'individual',
        settings: {
          payouts: {
            schedule: {
              interval: 'manual' // Manual payouts for 1st & 15th schedule
            }
          }
        },
        metadata: {
          creator_id: creatorId
        }
      });

      // Save account to database
      await pool.query(
        `INSERT INTO creator_stripe_accounts 
         (creator_id, stripe_account_id, country, currency, business_type) 
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (creator_id) DO UPDATE SET
         stripe_account_id = $2,
         updated_at = NOW()`,
        [creatorId, account.id, account.country, account.default_currency, account.business_type]
      );

      return { accountId: account.id };
    } catch (error) {
      console.error('Error creating connected account:', error);
      throw error;
    }
  }

  // Generate account onboarding link
  async createAccountLink(accountId, refreshUrl, returnUrl) {
    try {
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding'
      });

      return accountLink;
    } catch (error) {
      console.error('Error creating account link:', error);
      throw error;
    }
  }

  // Update account status from Stripe
  async updateAccountStatus(accountId) {
    try {
      const account = await stripe.accounts.retrieve(accountId);

      // Ensure manual payout schedule is set
      if (account.settings?.payouts?.schedule?.interval !== 'manual') {
        await stripe.accounts.update(accountId, {
          settings: {
            payouts: {
              schedule: {
                interval: 'manual'
              }
            }
          }
        });
      }

      await pool.query(
        `UPDATE creator_stripe_accounts
         SET account_status = $1,
             charges_enabled = $2,
             payouts_enabled = $3,
             details_submitted = $4,
             updated_at = NOW()
         WHERE stripe_account_id = $5`,
        [
          account.charges_enabled && account.payouts_enabled ? 'active' : 'pending',
          account.charges_enabled,
          account.payouts_enabled,
          account.details_submitted,
          accountId
        ]
      );

      return {
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        requirements: account.requirements
      };
    } catch (error) {
      console.error('Error updating account status:', error);
      throw error;
    }
  }

  // Create a manual payout directly from creator's connected account
  async createPayout(payoutData) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { payoutId, creatorId, amount, stripeAccountId, currency = 'usd', cycleDate } = payoutData;

      // Generate idempotency key for this payout (prevents duplicates)
      const idempotencyKey = `payout:${stripeAccountId}:${cycleDate || new Date().toISOString().split('T')[0]}:${currency}`;

      // First, check the available balance in the connected account
      const balance = await stripe.balance.retrieve({ stripeAccount: stripeAccountId });
      const availableBalance = balance.available.find(b => b.currency === currency);

      if (!availableBalance || availableBalance.amount < amount) {
        throw new Error(`Insufficient balance in connected account. Available: ${availableBalance?.amount || 0}, Required: ${amount}`);
      }

      // Create payout directly from connected account to creator's bank
      const payout = await stripe.payouts.create(
        {
          amount: Math.round(amount), // Amount should already be in cents
          currency: currency,
          description: `Digis creator payout`,
          metadata: {
            payout_id: payoutId,
            creator_id: creatorId,
            cycle_date: cycleDate || new Date().toISOString().split('T')[0]
          }
        },
        {
          stripeAccount: stripeAccountId,
          idempotencyKey: idempotencyKey
        }
      );

      // Update payout record
      await client.query(
        `UPDATE creator_payouts
         SET stripe_payout_id = $1,
             status = 'processing',
             processed_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [payout.id, payoutId]
      );

      // Create notification
      await client.query(
        `INSERT INTO payout_notifications
         (creator_id, payout_id, notification_type, title, message)
         VALUES ($1, $2, 'payout_initiated', 'Payout Initiated',
                 'Your payout of $' || $3 || ' has been initiated and will arrive in 2-5 business days.')`,
        [creatorId, payoutId, (amount / 100).toFixed(2)]
      );

      await client.query('COMMIT');

      return {
        success: true,
        payoutId: payout.id,
        arrivalDate: payout.arrival_date,
        amount: payout.amount / 100
      };
    } catch (error) {
      await client.query('ROLLBACK');

      // Update payout as failed
      await pool.query(
        `UPDATE creator_payouts
         SET status = 'failed',
             failure_reason = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [error.message, payoutData.payoutId]
      );

      throw error;
    } finally {
      client.release();
    }
  }

  // Process all pending payouts
  async processPendingPayouts() {
    const pendingPayouts = await pool.query(
      `SELECT 
        p.*,
        sa.stripe_account_id,
        u.email,
        u.display_name
       FROM creator_payouts p
       JOIN creator_stripe_accounts sa ON sa.creator_id = p.creator_id
       JOIN users u ON u.uid = p.creator_id
       WHERE p.status = 'pending'
         AND sa.payouts_enabled = true
         AND p.net_payout_amount >= 50.00
       ORDER BY p.created_at ASC
       LIMIT 100`
    );

    const results = {
      processed: 0,
      failed: 0,
      errors: []
    };

    for (const payout of pendingPayouts.rows) {
      try {
        await this.createPayout({
          payoutId: payout.id,
          creatorId: payout.creator_id,
          amount: payout.net_payout_amount,
          stripeAccountId: payout.stripe_account_id,
          periodEnd: payout.payout_period_end
        });
        results.processed++;
      } catch (error) {
        console.error(`Failed to process payout ${payout.id}:`, error);
        results.failed++;
        results.errors.push({
          payoutId: payout.id,
          error: error.message
        });
      }
    }

    return results;
  }

  // Get account balance
  async getAccountBalance(stripeAccountId) {
    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: stripeAccountId
      });

      return {
        available: balance.available.map(b => ({
          amount: b.amount / 100,
          currency: b.currency
        })),
        pending: balance.pending.map(b => ({
          amount: b.amount / 100,
          currency: b.currency
        }))
      };
    } catch (error) {
      console.error('Error retrieving balance:', error);
      throw error;
    }
  }

  // Get payout history for a connected account
  async getPayoutHistory(stripeAccountId, options = {}) {
    try {
      const { limit = 50, startingAfter, endingBefore } = options;

      const payouts = await stripe.payouts.list(
        {
          limit,
          ...(startingAfter && { starting_after: startingAfter }),
          ...(endingBefore && { ending_before: endingBefore })
        },
        {
          stripeAccount: stripeAccountId
        }
      );

      return {
        payouts: payouts.data.map(p => ({
          id: p.id,
          amount: p.amount / 100,
          currency: p.currency,
          status: p.status,
          arrival_date: p.arrival_date,
          created: p.created,
          description: p.description,
          failure_code: p.failure_code,
          failure_message: p.failure_message,
          method: p.method,
          type: p.type
        })),
        hasMore: payouts.has_more
      };
    } catch (error) {
      console.error('Error retrieving payout history:', error);
      throw error;
    }
  }

  // Handle webhook events
  async handleWebhook(event) {
    switch (event.type) {
      case 'account.updated':
        await this.updateAccountStatus(event.data.object.id);
        break;
        
      case 'payout.paid':
        await this.handlePayoutPaid(event.data.object);
        break;
        
      case 'payout.failed':
        await this.handlePayoutFailed(event.data.object);
        break;
        
      case 'transfer.created':
        await this.handleTransferCreated(event.data.object);
        break;
    }
  }

  async handlePayoutPaid(payout) {
    const result = await pool.query(
      `UPDATE creator_payouts 
       SET status = 'paid',
           paid_at = NOW(),
           stripe_balance_transaction = $1
       WHERE stripe_payout_id = $2
       RETURNING creator_id, id, net_payout_amount`,
      [payout.balance_transaction, payout.id]
    );

    if (result.rows.length > 0) {
      const { creator_id, id, net_payout_amount } = result.rows[0];
      
      // Create success notification
      await pool.query(
        `INSERT INTO payout_notifications 
         (creator_id, payout_id, notification_type, title, message)
         VALUES ($1, $2, 'payout_completed', 'Payout Completed', 
                 'Your payout of $' || $3 || ' has been deposited to your bank account.')`,
        [creator_id, id, net_payout_amount]
      );
    }
  }

  async handlePayoutFailed(payout) {
    const result = await pool.query(
      `UPDATE creator_payouts 
       SET status = 'failed',
           failure_reason = $1
       WHERE stripe_payout_id = $2
       RETURNING creator_id, id, net_payout_amount`,
      [payout.failure_message || 'Unknown error', payout.id]
    );

    if (result.rows.length > 0) {
      const { creator_id, id, net_payout_amount } = result.rows[0];
      
      // Create failure notification
      await pool.query(
        `INSERT INTO payout_notifications 
         (creator_id, payout_id, notification_type, title, message)
         VALUES ($1, $2, 'payout_failed', 'Payout Failed', 
                 'Your payout of $' || $3 || ' failed. Please check your bank account information.')`,
        [creator_id, id, net_payout_amount]
      );
    }
  }

  async handleTransferCreated(transfer) {
    // Log transfer creation
    console.log('Transfer created:', transfer.id, 'Amount:', transfer.amount / 100);
  }
}

module.exports = new StripeConnectService();