const { supabase, supabaseService } = require('../utils/supabase-client');
const { logger } = require('../utils/secureLogger');
const EventEmitter = require('events');

class SupabaseRealtimeService extends EventEmitter {
  constructor() {
    super();
    this.channels = new Map();
    this.sessionSubscriptions = new Map();
  }

  // Subscribe to session updates
  subscribeToSession(sessionId, callback) {
    const channelName = `session:${sessionId}`;
    
    if (this.channels.has(channelName)) {
      logger.warn(`Already subscribed to session ${sessionId}`);
      return this.channels.get(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          logger.info(`Session update received:`, { sessionId, event: payload.eventType });
          callback(payload);
          this.emit('session:update', { sessionId, ...payload });
        }
      )
      .subscribe((status) => {
        logger.info(`Session subscription status:`, { sessionId, status });
      });

    this.channels.set(channelName, channel);
    return channel;
  }

  // Subscribe to token balance updates
  subscribeToTokenBalance(userId, callback) {
    const channelName = `balance:${userId}`;
    
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'token_balances',
          filter: `supabase_user_id=eq.${userId}`
        },
        (payload) => {
          logger.info(`Token balance update:`, { userId, event: payload.eventType });
          callback(payload);
          this.emit('balance:update', { userId, ...payload });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'token_transactions',
          filter: `supabase_user_id=eq.${userId}`
        },
        (payload) => {
          logger.info(`New token transaction:`, { userId });
          this.emit('transaction:new', { userId, ...payload });
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Subscribe to chat messages in a session
  subscribeToChatMessages(sessionId, callback) {
    const channelName = `chat:${sessionId}`;
    
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          logger.info(`New chat message in session ${sessionId}`);
          callback(payload.new);
          this.emit('chat:message', { sessionId, message: payload.new });
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Subscribe to streaming events
  subscribeToStream(streamId, callback) {
    const channelName = `stream:${streamId}`;
    
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${streamId}`
        },
        (payload) => {
          logger.info(`Stream update:`, { streamId, event: payload.eventType });
          callback(payload);
          this.emit('stream:update', { streamId, ...payload });
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        this.emit('stream:presence', { streamId, presence: state });
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        this.emit('stream:viewer:join', { streamId, viewer: newPresences[0] });
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        this.emit('stream:viewer:leave', { streamId, viewer: leftPresences[0] });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track presence
          await channel.track({
            online_at: new Date().toISOString(),
            user_id: 'system'
          });
        }
      });

    this.channels.set(channelName, channel);
    return channel;
  }

  // Subscribe to creator notifications
  subscribeToCreatorNotifications(creatorId, callback) {
    const channelName = `notifications:creator:${creatorId}`;
    
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${creatorId}`
        },
        (payload) => {
          logger.info(`New notification for creator ${creatorId}`);
          callback(payload.new);
          this.emit('notification:new', { creatorId, notification: payload.new });
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Broadcast to a channel (requires service role)
  async broadcast(channelName, event, payload) {
    try {
      if (!supabaseService) {
        throw new Error('Service role key required for broadcasting');
      }

      const channel = supabaseService.channel(channelName);
      await channel.send({
        type: 'broadcast',
        event,
        payload
      });

      logger.info(`Broadcast sent:`, { channelName, event });
    } catch (error) {
      logger.error(`Broadcast error:`, { channelName, event, error: error.message });
      throw error;
    }
  }

  // Send presence update
  async updatePresence(channelName, presenceData) {
    try {
      const channel = this.channels.get(channelName);
      if (!channel) {
        throw new Error(`Not subscribed to channel: ${channelName}`);
      }

      await channel.track(presenceData);
      logger.info(`Presence updated:`, { channelName });
    } catch (error) {
      logger.error(`Presence update error:`, { channelName, error: error.message });
      throw error;
    }
  }

  // Unsubscribe from a channel
  async unsubscribe(channelName) {
    try {
      const channel = this.channels.get(channelName);
      if (!channel) {
        logger.warn(`Channel not found: ${channelName}`);
        return;
      }

      await supabase.removeChannel(channel);
      this.channels.delete(channelName);
      logger.info(`Unsubscribed from channel: ${channelName}`);
    } catch (error) {
      logger.error(`Unsubscribe error:`, { channelName, error: error.message });
    }
  }

  // Unsubscribe from all channels
  async unsubscribeAll() {
    const promises = Array.from(this.channels.keys()).map(channelName => 
      this.unsubscribe(channelName)
    );
    
    await Promise.all(promises);
    logger.info('Unsubscribed from all channels');
  }

  // Get channel statistics
  getChannelStats() {
    return {
      totalChannels: this.channels.size,
      channels: Array.from(this.channels.keys())
    };
  }

  // Handle session billing updates via real-time
  async handleSessionBillingUpdate(sessionId, duration, tokensSpent) {
    try {
      // This would typically be called from within a transaction
      await this.broadcast(`session:${sessionId}`, 'billing:update', {
        duration,
        tokensSpent,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Session billing broadcast error:', error);
    }
  }

  // Handle streaming tips via real-time
  async handleStreamTip(streamId, tip) {
    try {
      await this.broadcast(`stream:${streamId}`, 'tip:received', {
        amount: tip.amount,
        tipper: tip.tipper_username,
        message: tip.message,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Stream tip broadcast error:', error);
    }
  }
}

// Create singleton instance
const realtimeService = new SupabaseRealtimeService();

// Cleanup on process termination
process.on('SIGINT', async () => {
  logger.info('Cleaning up Supabase realtime subscriptions...');
  await realtimeService.unsubscribeAll();
  process.exit(0);
});

module.exports = realtimeService;