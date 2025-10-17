const { pool } = require('./db');
const { logger } = require('./logger');
const { publishToChannel } = require('./ably-adapter');
// Socket.io removed - using Ably
// const { io } = require('./socket');

class StreamActivityMonitor {
  constructor() {
    this.checkInterval = null;
    this.activeStreams = new Map(); // streamId -> { lastActivity, viewerCount, warningState }
  }

  // Start monitoring all active streams
  start() {
    // Check every minute for inactive streams
    this.checkInterval = setInterval(() => {
      this.checkInactiveStreams();
    }, 60000); // 1 minute

    console.log('Stream activity monitor started');
  }

  // Stop monitoring
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('Stream activity monitor stopped');
  }

  // Log stream activity
  async logActivity(streamId, activityType, fanId = null, details = {}) {
    try {
      await pool.query(
        `INSERT INTO stream_activity_log (stream_id, activity_type, fan_id, details)
         VALUES ($1, $2, $3, $4)`,
        [streamId, activityType, fanId, details]
      );

      // Update in-memory tracking
      if (!this.activeStreams.has(streamId)) {
        this.activeStreams.set(streamId, {
          lastActivity: new Date(),
          viewerCount: 0,
          warningState: 'none'
        });
      }

      const streamData = this.activeStreams.get(streamId);
      streamData.lastActivity = new Date();

      // Update viewer count for join/leave
      if (activityType === 'fan_joined') {
        streamData.viewerCount++;
        await this.updateViewerCount(streamId, streamData.viewerCount);
      } else if (activityType === 'fan_left') {
        streamData.viewerCount = Math.max(0, streamData.viewerCount - 1);
        await this.updateViewerCount(streamId, streamData.viewerCount);
      }

      // Reset warning state on fan interaction
      if (['chat_message', 'gift_sent', 'fan_joined'].includes(activityType)) {
        streamData.warningState = 'none';
        await this.clearWarning(streamId);
      }

    } catch (error) {
      console.error('Error logging stream activity:', error);
    }
  }

  // Update viewer count in database
  async updateViewerCount(streamId, count) {
    try {
      await pool.query(
        `UPDATE streams SET viewer_count = $1 WHERE id = $2`,
        [count, streamId]
      );
    } catch (error) {
      console.error('Error updating viewer count:', error);
    }
  }

  // Clear warning state
  async clearWarning(streamId) {
    try {
      await pool.query(
        `UPDATE streams SET warning_sent_at = NULL WHERE id = $1`,
        [streamId]
      );
    } catch (error) {
      console.error('Error clearing warning:', error);
    }
  }

  // Check for inactive streams
  async checkInactiveStreams() {
    try {
      // Get all active streams
      const { rows: streams } = await pool.query(`
        SELECT 
          s.id,
          s.creator_id,
          s.title,
          s.viewer_count,
          s.created_at,
          s.started_at,
          u.username as creator_username,
          30 as stream_warning_minutes
        FROM streams s
        JOIN users u ON s.creator_id = u.supabase_id
        WHERE s.is_live = true
      `);

      for (const stream of streams) {
        await this.checkStreamActivity(stream);
      }
    } catch (error) {
      console.error('Error checking inactive streams:', error);
    }
  }

  // Check individual stream activity
  async checkStreamActivity(stream) {
    const now = new Date();
    const lastInteraction = stream.last_fan_interaction_at || stream.created_at;
    const minutesSinceInteraction = Math.floor((now - new Date(lastInteraction)) / 60000);
    const warningMinutes = stream.stream_warning_minutes || 5;
    const autoEndMinutes = stream.auto_end_minutes || 10;

    // If no viewers and been live for more than 5 minutes
    if (stream.viewer_count === 0) {
      const minutesSinceLive = Math.floor((now - new Date(stream.created_at)) / 60000);
      
      // Give creators 5 minutes grace period when starting
      if (minutesSinceLive < 5) {
        return;
      }

      // Check if it's time to warn
      if (minutesSinceInteraction >= (autoEndMinutes - warningMinutes) && !stream.warning_sent_at) {
        await this.sendInactivityWarning(stream, warningMinutes);
      }
      
      // Check if it's time to auto-end
      if (minutesSinceInteraction >= autoEndMinutes) {
        await this.autoEndStream(stream, 'no_viewers');
      }
    } 
    // If has viewers but no interaction for extended period (15 minutes)
    else if (minutesSinceInteraction >= 15) {
      // Fixed 15 minute timeout when viewers are present
      if (!stream.warning_sent_at && minutesSinceInteraction >= (15 - warningMinutes)) {
        await this.sendInactivityWarning(stream, warningMinutes);
      }
      
      if (minutesSinceInteraction >= 15) {
        await this.autoEndStream(stream, 'no_interaction');
      }
    }
  }

  // Send inactivity warning to creator
  async sendInactivityWarning(stream, minutesRemaining) {
    try {
      // Update warning sent timestamp
      await pool.query(
        `UPDATE streams SET warning_sent_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [stream.id]
      );

      // Send socket notification to creator
      // STANDARDIZED: Use user:${id} format consistently
      try {
        await publishToChannel(`user:${stream.creator_id}`, 'stream_inactivity_warning', {
          streamId: stream.id,
          message: `Your stream will end in ${minutesRemaining} minutes due to inactivity`,
          minutesRemaining,
          viewerCount: stream.viewer_count
        });
      } catch (ablyError) {
        console.error('Failed to publish stream_inactivity_warning to Ably:', ablyError.message);
      }

      // Log the warning
      await this.logActivity(stream.id, 'inactivity_warning', null, {
        minutesRemaining,
        viewerCount: stream.viewer_count
      });

      console.log(`Inactivity warning sent for stream ${stream.id}`, {
        streamId: stream.id,
        creatorUsername: stream.creator_username,
        minutesRemaining
      });
    } catch (error) {
      console.error('Error sending inactivity warning:', error);
    }
  }

  // Auto-end inactive stream
  async autoEndStream(stream, reason) {
    try {
      // End the stream
      await pool.query(`
        UPDATE streams 
        SET 
          status = 'ended',
          ended_at = CURRENT_TIMESTAMP,
          auto_ended = true,
          auto_end_reason = $1
        WHERE id = $2
      `, [reason, stream.id]);

      // Log the auto-end
      await this.logActivity(stream.id, 'auto_ended', null, {
        reason,
        viewerCount: stream.viewer_count,
        duration: Math.floor((new Date() - new Date(stream.created_at)) / 60000)
      });

      // Notify creator and viewers
      try {
        await publishToChannel(`stream_${stream.id}`, 'stream_auto_ended', {
          streamId: stream.id,
          reason: reason === 'no_viewers'
            ? 'Stream ended due to no viewers'
            : 'Stream ended due to inactivity',
          message: this.getAutoEndMessage(reason)
        });
      } catch (ablyError) {
        console.error('Failed to publish stream_auto_ended to Ably:', ablyError.message);
      }

      // Clean up from active streams
      this.activeStreams.delete(stream.id);

      console.log(`Stream auto-ended: ${stream.id}`, {
        streamId: stream.id,
        creatorUsername: stream.creator_username,
        reason,
        duration: Math.floor((new Date() - new Date(stream.created_at)) / 60000)
      });

      // Send notification to creator
      await this.notifyCreatorStreamEnded(stream, reason);
    } catch (error) {
      console.error('Error auto-ending stream:', error);
    }
  }

  // Get user-friendly auto-end message
  getAutoEndMessage(reason) {
    const messages = {
      'no_viewers': 'Your stream has been automatically ended due to no viewers. Try scheduling your streams or notifying your fans in advance!',
      'no_interaction': 'Your stream has been automatically ended due to inactivity. Keep your audience engaged with regular interaction!',
      'creator_inactive': 'Your stream has been automatically ended because you appeared to be away.',
      'technical_timeout': 'Your stream has been automatically ended due to technical issues.'
    };
    return messages[reason] || 'Your stream has been automatically ended.';
  }

  // Notify creator about stream ending
  async notifyCreatorStreamEnded(stream, reason) {
    try {
      // Create a notification in the database
      await pool.query(`
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        stream.creator_id,
        'stream_auto_ended',
        'Stream Automatically Ended',
        this.getAutoEndMessage(reason),
        { streamId: stream.id, reason }
      ]);
    } catch (error) {
      console.error('Error notifying creator about stream end:', error);
    }
  }

  // Manual activity ping from creator (heartbeat)
  async creatorHeartbeat(streamId, creatorId) {
    try {
      await this.logActivity(streamId, 'creator_heartbeat', creatorId);
      
      // Reset any warning state
      const streamData = this.activeStreams.get(streamId);
      if (streamData) {
        streamData.warningState = 'none';
      }
      
      await this.clearWarning(streamId);
    } catch (error) {
      console.error('Error processing creator heartbeat:', error);
    }
  }

  // Get stream activity stats
  async getStreamActivityStats(streamId) {
    try {
      const { rows } = await pool.query(`
        SELECT 
          activity_type,
          COUNT(*) as count,
          MAX(created_at) as last_occurrence
        FROM stream_activity_log
        WHERE stream_id = $1
        GROUP BY activity_type
        ORDER BY count DESC
      `, [streamId]);

      return rows;
    } catch (error) {
      console.error('Error getting stream activity stats:', error);
      return [];
    }
  }
}

// Create singleton instance
const streamActivityMonitor = new StreamActivityMonitor();

module.exports = streamActivityMonitor;