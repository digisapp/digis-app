const logger = require('./logger');
const { supabaseAdmin } = require('./supabase-admin');

class NotificationService {
  constructor() {
    this.notifications = new Map();
  }

  async createNotification(userId, type, message, metadata = {}) {
    try {
      const notification = {
        user_id: userId,
        type,
        message,
        metadata,
        read: false,
        created_at: new Date().toISOString()
      };

      // Store in database if available
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('notifications')
          .insert([notification])
          .select()
          .single();

        if (error) {
          logger.error('Error creating notification:', error);
        } else {
          return data;
        }
      }

      // Fallback to in-memory storage
      const id = Date.now().toString();
      const notificationWithId = { ...notification, id };
      
      if (!this.notifications.has(userId)) {
        this.notifications.set(userId, []);
      }
      
      this.notifications.get(userId).push(notificationWithId);
      
      return notificationWithId;
    } catch (error) {
      logger.error('Error in createNotification:', error);
      return null;
    }
  }

  async getNotifications(userId, limit = 50, unreadOnly = false) {
    try {
      if (supabaseAdmin) {
        let query = supabaseAdmin
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (unreadOnly) {
          query = query.eq('read', false);
        }

        const { data, error } = await query;

        if (error) {
          logger.error('Error fetching notifications:', error);
          return [];
        }

        return data || [];
      }

      // Fallback to in-memory storage
      const userNotifications = this.notifications.get(userId) || [];
      let filtered = unreadOnly ? userNotifications.filter(n => !n.read) : userNotifications;
      return filtered.slice(0, limit);
    } catch (error) {
      logger.error('Error in getNotifications:', error);
      return [];
    }
  }

  async markAsRead(userId, notificationId) {
    try {
      if (supabaseAdmin) {
        const { error } = await supabaseAdmin
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId)
          .eq('user_id', userId);

        if (error) {
          logger.error('Error marking notification as read:', error);
          return false;
        }

        return true;
      }

      // Fallback to in-memory storage
      const userNotifications = this.notifications.get(userId);
      if (userNotifications) {
        const notification = userNotifications.find(n => n.id === notificationId);
        if (notification) {
          notification.read = true;
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Error in markAsRead:', error);
      return false;
    }
  }

  async markAllAsRead(userId) {
    try {
      if (supabaseAdmin) {
        const { error } = await supabaseAdmin
          .from('notifications')
          .update({ read: true })
          .eq('user_id', userId)
          .eq('read', false);

        if (error) {
          logger.error('Error marking all as read:', error);
          return false;
        }

        return true;
      }

      // Fallback to in-memory storage
      const userNotifications = this.notifications.get(userId);
      if (userNotifications) {
        userNotifications.forEach(n => { n.read = true; });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error in markAllAsRead:', error);
      return false;
    }
  }

  async getUnreadCount(userId) {
    try {
      if (supabaseAdmin) {
        const { count, error } = await supabaseAdmin
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('read', false);

        if (error) {
          logger.error('Error getting unread count:', error);
          return 0;
        }

        return count || 0;
      }

      // Fallback to in-memory storage
      const userNotifications = this.notifications.get(userId) || [];
      return userNotifications.filter(n => !n.read).length;
    } catch (error) {
      logger.error('Error in getUnreadCount:', error);
      return 0;
    }
  }
}

// Export singleton instance
const notificationService = new NotificationService();
module.exports = notificationService;