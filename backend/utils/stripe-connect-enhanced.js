/**
 * Enhanced Stripe Connect implementation with retry logic and supabase_id support
 */

const winston = require('winston');
const { db } = require('./db');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/stripe.log' })
  ]
});

// Initialize Stripe (use real Stripe in production)
let stripe;
try {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} catch (error) {
  logger.warn('Stripe SDK not available, using mock implementation');
  // Mock Stripe client for development
  stripe = {
    accounts: {
      create: async (params) => ({
        id: `acct_${Date.now()}`,
        ...params,
        created: Date.now() / 1000
      }),
      retrieve: async (accountId) => ({
        id: accountId,
        charges_enabled: true,
        payouts_enabled: true,
        requirements: {
          currently_due: [],
          eventually_due: [],
          past_due: []
        }
      }),
      update: async (accountId, params) => ({
        id: accountId,
        ...params
      }),
      del: async (accountId) => ({
        id: accountId,
        deleted: true
      }),
      createLoginLink: async (accountId) => ({
        url: `https://dashboard.stripe.com/express/${accountId}`,
        created: Date.now() / 1000
      })
    },
    accountLinks: {
      create: async (params) => ({
        url: `https://connect.stripe.com/express/${params.account}/onboarding`,
        expires_at: Date.now() / 1000 + 300
      })
    },
    payouts: {
      create: async (params, options) => ({
        id: `po_${Date.now()}`,
        amount: params.amount,
        currency: params.currency || 'usd',
        status: 'pending',
        created: Date.now() / 1000,
        metadata: params.metadata || {}
      }),
      retrieve: async (payoutId, options) => ({
        id: payoutId,
        status: 'paid',
        paid_at: Date.now() / 1000
      })
    },
    transfers: {
      create: async (params) => ({
        id: `tr_${Date.now()}`,
        amount: params.amount,
        currency: params.currency || 'usd',
        destination: params.destination,
        created: Date.now() / 1000
      })
    },
    balance: {
      retrieve: async (options) => ({
        available: [{ amount: 10000, currency: 'usd' }],
        pending: [{ amount: 5000, currency: 'usd' }]
      })
    }
  };
}

/**
 * Retry wrapper for Stripe API calls
 */
const retryStripeCall = async (fn, maxRetries = 3) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.type === 'StripeInvalidRequestError' || 
          error.statusCode === 400 ||
          error.statusCode === 404) {
        throw error;
      }
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      logger.warn(`Stripe API call failed, retry ${i + 1}/${maxRetries} in ${delay}ms`, {
        error: error.message,
        type: error.type
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

class StripeConnect {
  constructor() {
    this.stripe = stripe;
    logger.info('StripeConnect enhanced initialized');
  }

  /**
   * Create a connected account with retry logic
   * @param {string} creatorId - UUID (supabase_id)
   * @param {object} creatorData - Creator information
   */
  async createConnectedAccount(creatorId, creatorData) {
    try {
      // Check for existing account using supabase_id
      const existingAccount = await db.query(
        'SELECT stripe_account_id FROM creator_stripe_accounts WHERE creator_id = $1',
        [creatorId]
      );

      if (existingAccount.rows.length > 0 && existingAccount.rows[0].stripe_account_id) {
        logger.info('Existing Stripe account found', { 
          creatorId,
          accountId: existingAccount.rows[0].stripe_account_id 
        });
        return { 
          accountId: existingAccount.rows[0].stripe_account_id,
          existing: true 
        };
      }

      // Create new account with retry
      const account = await retryStripeCall(async () => {
        return await this.stripe.accounts.create({
          type: 'express',
          country: creatorData.country || 'US',
          email: creatorData.email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true }
          },
          business_type: 'individual',
          business_profile: {
            url: creatorData.profile_url,
            mcc: '5815' // Digital goods
          },
          metadata: {
            creator_id: creatorId,
            platform: 'digis',
            username: creatorData.username
          }
        });
      });

      // Save to database
      await db.query(
        `INSERT INTO creator_stripe_accounts
         (creator_id, stripe_account_id, country, currency, business_type, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (creator_id) DO UPDATE SET
         stripe_account_id = $2,
         updated_at = NOW()`,
        [creatorId, account.id, account.country, account.default_currency || 'usd', account.business_type]
      );

      logger.info('Connected account created', { 
        accountId: account.id,
        creatorId 
      });

      return { 
        accountId: account.id,
        account,
        existing: false 
      };
    } catch (error) {
      logger.error('Failed to create connected account', { 
        error: error.message,
        creatorId 
      });
      throw error;
    }
  }

  /**
   * Create account link for onboarding
   */
  async createAccountLink(accountId, refreshUrl, returnUrl) {
    try {
      const link = await retryStripeCall(async () => {
        return await this.stripe.accountLinks.create({
          account: accountId,
          refresh_url: refreshUrl,
          return_url: returnUrl,
          type: 'account_onboarding'
        });
      });

      logger.info('Account link created', { 
        accountId,
        expiresAt: new Date(link.expires_at * 1000) 
      });
      
      return link;
    } catch (error) {
      logger.error('Failed to create account link', { 
        error: error.message,
        accountId 
      });
      throw error;
    }
  }

  /**
   * Create a payout with retry and validation
   */
  async createPayout(accountId, amount, metadata = {}) {
    try {
      // Validate amount
      if (amount < 1) {
        throw new Error('Payout amount must be at least $1');
      }

      logger.info('Creating payout', { accountId, amount, metadata });

      const payout = await retryStripeCall(async () => {
        return await this.stripe.payouts.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: 'usd',
          method: 'standard',
          metadata: {
            ...metadata,
            platform: 'digis',
            created_at: new Date().toISOString()
          }
        }, {
          stripeAccount: accountId
        });
      });

      logger.info('Payout created', { 
        payoutId: payout.id,
        accountId,
        amount,
        status: payout.status
      });

      return payout;
    } catch (error) {
      logger.error('Failed to create payout', { 
        error: error.message,
        accountId,
        amount 
      });
      throw error;
    }
  }

  /**
   * Retry a failed payout
   */
  async retryFailedPayout(payoutId, accountId) {
    try {
      logger.info('Retrying failed payout', { payoutId, accountId });

      // In production, you might need to cancel and recreate
      // For now, just check status
      const payout = await retryStripeCall(async () => {
        return await this.stripe.payouts.retrieve(payoutId, {
          stripeAccount: accountId
        });
      });
      
      if (payout.status === 'failed') {
        throw new Error(`Payout still failed: ${payout.failure_message}`);
      }

      logger.info('Payout status', { 
        payoutId,
        status: payout.status 
      });

      return payout;
    } catch (error) {
      logger.error('Failed to retry payout', { 
        error: error.message,
        payoutId 
      });
      throw error;
    }
  }

  /**
   * Update account status with retry
   */
  async updateAccountStatus(accountId) {
    try {
      logger.info('Updating account status', { accountId });

      const account = await retryStripeCall(async () => {
        return await this.stripe.accounts.retrieve(accountId);
      });
      
      const status = {
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        requirements: account.requirements,
        created: account.created,
        id: account.id,
        details_submitted: account.details_submitted
      };

      // Update database
      await db.query(
        `UPDATE creator_stripe_accounts 
         SET charges_enabled = $1,
             payouts_enabled = $2,
             requirements = $3,
             details_submitted = $4,
             last_status_check = NOW()
         WHERE stripe_account_id = $5`,
        [
          status.charges_enabled,
          status.payouts_enabled,
          JSON.stringify(status.requirements),
          status.details_submitted,
          accountId
        ]
      );

      logger.info('Account status updated', { 
        accountId,
        chargesEnabled: status.charges_enabled,
        payoutsEnabled: status.payouts_enabled 
      });

      return status;
    } catch (error) {
      logger.error('Failed to update account status', { 
        error: error.message,
        accountId 
      });
      throw error;
    }
  }

  /**
   * Create a transfer to connected account
   */
  async createTransfer(accountId, amount, metadata = {}) {
    try {
      logger.info('Creating transfer', { accountId, amount, metadata });

      const transfer = await retryStripeCall(async () => {
        return await this.stripe.transfers.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: 'usd',
          destination: accountId,
          transfer_group: metadata.session_id || `transfer_${Date.now()}`,
          metadata: {
            ...metadata,
            platform: 'digis'
          }
        });
      });

      logger.info('Transfer created', { 
        transferId: transfer.id,
        accountId,
        amount 
      });

      return transfer;
    } catch (error) {
      logger.error('Failed to create transfer', { 
        error: error.message,
        accountId,
        amount 
      });
      throw error;
    }
  }

  /**
   * Get account balance with retry
   */
  async getAccountBalance(accountId) {
    try {
      const balance = await retryStripeCall(async () => {
        return await this.stripe.balance.retrieve({
          stripeAccount: accountId
        });
      });

      const available = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;
      const pending = balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100;

      logger.info('Balance retrieved', { 
        accountId,
        available,
        pending
      });

      return {
        available,
        pending,
        currency: balance.available[0]?.currency || 'usd'
      };
    } catch (error) {
      logger.error('Failed to get account balance', { 
        error: error.message,
        accountId 
      });
      throw error;
    }
  }

  /**
   * Create dashboard login link
   */
  async createLoginLink(accountId) {
    try {
      const link = await retryStripeCall(async () => {
        return await this.stripe.accounts.createLoginLink(accountId);
      });

      logger.info('Login link created', { accountId });
      return link;
    } catch (error) {
      logger.error('Failed to create login link', { 
        error: error.message,
        accountId 
      });
      throw error;
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(event) {
    logger.info('Processing webhook', { 
      type: event.type,
      id: event.id 
    });

    try {
      switch (event.type) {
        case 'account.updated':
          return await this.handleAccountUpdated(event.data.object);
        
        case 'payout.paid':
          return await this.handlePayoutPaid(event.data.object);
        
        case 'payout.failed':
          return await this.handlePayoutFailed(event.data.object);
        
        case 'transfer.created':
          return await this.handleTransferCreated(event.data.object);
        
        case 'account.application.authorized':
          return await this.handleAccountAuthorized(event.data.object);
        
        default:
          logger.info('Unhandled webhook event type', { type: event.type });
          return { processed: false, type: event.type };
      }
    } catch (error) {
      logger.error('Webhook processing failed', {
        error: error.message,
        eventType: event.type,
        eventId: event.id
      });
      throw error;
    }
  }

  /**
   * Handle account updated webhook
   */
  async handleAccountUpdated(account) {
    logger.info('Account updated webhook', { 
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled 
    });
    
    // Update account status in database
    await this.updateAccountStatus(account.id);
    
    return { processed: true, accountId: account.id };
  }

  /**
   * Handle account authorized
   */
  async handleAccountAuthorized(account) {
    logger.info('Account authorized webhook', { accountId: account.id });
    
    // Update account status
    await this.updateAccountStatus(account.id);
    
    // Notify creator
    const creatorQuery = await db.query(
      'SELECT creator_id FROM creator_stripe_accounts WHERE stripe_account_id = $1',
      [account.id]
    );
    
    if (creatorQuery.rows.length > 0) {
      const creatorId = creatorQuery.rows[0].creator_id;
      await db.query(
        `INSERT INTO notifications (recipient_id, type, title, message, data, created_at)
         VALUES ($1, 'stripe_authorized', 'Payment Account Activated', 
                 'Your payment account is now active and ready to receive payouts!', 
                 $2, NOW())`,
        [creatorId, JSON.stringify({ account_id: account.id })]
      );
    }
    
    return { processed: true, accountId: account.id };
  }

  /**
   * Handle payout paid webhook
   */
  async handlePayoutPaid(payout) {
    logger.info('Payout paid webhook', { 
      payoutId: payout.id,
      amount: payout.amount / 100 
    });
    
    // Update payout status in database
    await db.query(
      `UPDATE creator_payouts 
       SET status = 'completed',
           completed_at = NOW(),
           stripe_arrival_date = $1
       WHERE stripe_payout_id = $2`,
      [new Date(payout.arrival_date * 1000), payout.id]
    );
    
    // Update related earnings
    await db.query(
      `UPDATE creator_earnings 
       SET status = 'paid'
       WHERE payout_id IN (
         SELECT id FROM creator_payouts WHERE stripe_payout_id = $1
       )`,
      [payout.id]
    );
    
    return { processed: true, payoutId: payout.id };
  }

  /**
   * Handle payout failed webhook
   */
  async handlePayoutFailed(payout) {
    logger.error('Payout failed webhook', { 
      payoutId: payout.id,
      failureCode: payout.failure_code,
      failureMessage: payout.failure_message 
    });
    
    // Update payout status
    await db.query(
      `UPDATE creator_payouts 
       SET status = 'failed',
           failed_at = NOW(),
           failure_reason = $1,
           failure_code = $2
       WHERE stripe_payout_id = $3`,
      [payout.failure_message, payout.failure_code, payout.id]
    );
    
    // Revert earnings status
    await db.query(
      `UPDATE creator_earnings 
       SET status = 'pending',
           payout_id = NULL
       WHERE payout_id IN (
         SELECT id FROM creator_payouts WHERE stripe_payout_id = $1
       )`,
      [payout.id]
    );
    
    return { processed: true, payoutId: payout.id };
  }

  /**
   * Handle transfer created webhook
   */
  async handleTransferCreated(transfer) {
    logger.info('Transfer created webhook', { 
      transferId: transfer.id,
      amount: transfer.amount / 100,
      destination: transfer.destination 
    });
    
    // Record transfer in database if needed
    if (transfer.metadata && transfer.metadata.session_id) {
      await db.query(
        `UPDATE sessions 
         SET transfer_id = $1,
             transfer_status = 'created'
         WHERE session_id = $2`,
        [transfer.id, transfer.metadata.session_id]
      );
    }
    
    return { processed: true, transferId: transfer.id };
  }

  /**
   * Delete connected account
   */
  async deleteAccount(accountId) {
    try {
      logger.info('Deleting account', { accountId });

      const result = await retryStripeCall(async () => {
        return await this.stripe.accounts.del(accountId);
      });
      
      // Update database
      await db.query(
        `UPDATE creator_stripe_accounts 
         SET status = 'deleted',
             deleted_at = NOW()
         WHERE stripe_account_id = $1`,
        [accountId]
      );
      
      logger.info('Account deleted', { 
        accountId,
        deleted: result.deleted 
      });

      return result;
    } catch (error) {
      logger.error('Failed to delete account', { 
        error: error.message,
        accountId 
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new StripeConnect();