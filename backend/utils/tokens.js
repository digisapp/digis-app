const logger = require('./logger');
const { supabaseAdmin } = require('./supabase-admin');

class TokenService {
  constructor() {
    this.tokenCache = new Map();
  }

  async getUserBalance(userId) {
    try {
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('token_balances')
          .select('balance')
          .eq('user_id', userId)
          .single();

        if (error && error.code !== 'PGRST116') {
          logger.error('Error fetching token balance:', error);
          return 0;
        }

        return data?.balance || 0;
      }

      // Fallback to cache
      return this.tokenCache.get(userId) || 0;
    } catch (error) {
      logger.error('Error in getUserBalance:', error);
      return 0;
    }
  }

  async updateBalance(userId, amount, type = 'add') {
    try {
      const currentBalance = await this.getUserBalance(userId);
      const newBalance = type === 'add' 
        ? currentBalance + amount 
        : Math.max(0, currentBalance - amount);

      if (supabaseAdmin) {
        const { error } = await supabaseAdmin
          .from('token_balances')
          .upsert({
            user_id: userId,
            balance: newBalance,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        if (error) {
          logger.error('Error updating token balance:', error);
          return false;
        }
      }

      // Update cache
      this.tokenCache.set(userId, newBalance);
      return true;
    } catch (error) {
      logger.error('Error in updateBalance:', error);
      return false;
    }
  }

  async addTokens(userId, amount) {
    return this.updateBalance(userId, amount, 'add');
  }

  async deductTokens(userId, amount) {
    const balance = await this.getUserBalance(userId);
    if (balance < amount) {
      return { success: false, error: 'Insufficient balance' };
    }
    
    const success = await this.updateBalance(userId, amount, 'deduct');
    return { success, error: success ? null : 'Failed to deduct tokens' };
  }

  async recordTransaction(userId, amount, type, description, metadata = {}) {
    try {
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('token_transactions')
          .insert({
            user_id: userId,
            amount,
            type,
            description,
            metadata,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          logger.error('Error recording transaction:', error);
          return null;
        }

        return data;
      }

      // Fallback - just log
      logger.info('Token transaction:', { userId, amount, type, description });
      return { id: Date.now(), userId, amount, type, description };
    } catch (error) {
      logger.error('Error in recordTransaction:', error);
      return null;
    }
  }

  async getTransactionHistory(userId, limit = 50) {
    try {
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('token_transactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          logger.error('Error fetching transaction history:', error);
          return [];
        }

        return data || [];
      }

      return [];
    } catch (error) {
      logger.error('Error in getTransactionHistory:', error);
      return [];
    }
  }

  async transferTokens(fromUserId, toUserId, amount, description) {
    try {
      // Check sender balance
      const senderBalance = await this.getUserBalance(fromUserId);
      if (senderBalance < amount) {
        return { success: false, error: 'Insufficient balance' };
      }

      // Deduct from sender
      const deductResult = await this.deductTokens(fromUserId, amount);
      if (!deductResult.success) {
        return deductResult;
      }

      // Add to receiver
      const addResult = await this.addTokens(toUserId, amount);
      if (!addResult) {
        // Rollback - add tokens back to sender
        await this.addTokens(fromUserId, amount);
        return { success: false, error: 'Transfer failed' };
      }

      // Record transactions
      await this.recordTransaction(fromUserId, -amount, 'transfer_out', description, { to_user: toUserId });
      await this.recordTransaction(toUserId, amount, 'transfer_in', description, { from_user: fromUserId });

      return { success: true };
    } catch (error) {
      logger.error('Error in transferTokens:', error);
      return { success: false, error: 'Transfer failed' };
    }
  }
}

// Export singleton instance
const tokenService = new TokenService();
module.exports = tokenService;