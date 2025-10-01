const router = require('express').Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../utils/db');
const logger = require('../utils/logger');

// Get calendar events for a user
router.get('/calendar-events/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const requestingUserId = req.user.supabase_id;
  
  try {
    // Verify the user is requesting their own calendar or is the creator
    if (userId !== requestingUserId) {
      return res.status(403).json({ error: 'Unauthorized to view this calendar' });
    }
    
    // Fetch calendar events (excluding cancelled ones by default unless specified)
    const { includeCancelled } = req.query;
    
    let query = `
      SELECT 
        ce.*,
        creator.username as creator_username,
        creator.profile_pic_url as creator_profile_pic,
        fan.username as fan_username,
        fan.profile_pic_url as fan_profile_pic
      FROM calendar_events ce
      LEFT JOIN users creator ON ce.creator_id = creator.supabase_id
      LEFT JOIN users fan ON ce.fan_id = fan.supabase_id
      WHERE (ce.creator_id = $1 OR ce.fan_id = $1)
    `;
    
    const params = [userId];
    
    if (!includeCancelled) {
      query += ` AND ce.status != 'cancelled'`;
    }
    
    query += ` ORDER BY ce.scheduled_date ASC, ce.scheduled_time ASC`;
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      events: result.rows
    });
    
  } catch (error) {
    logger.error('Error fetching calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// Get schedule data (legacy endpoint)
router.get('/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const requestingUserId = req.user.supabase_id;
  
  try {
    // Verify authorization
    if (userId !== requestingUserId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Fetch accepted session invites and private calls
    const query = `
      SELECT * FROM (
        SELECT 
          si.id,
          si.type,
          si.scheduled_date as date,
          si.scheduled_time as time,
          si.duration_minutes as duration,
          si.status,
          u.username as fan_username,
          si.fan_id,
          'session_invite' as source
        FROM session_invites si
        JOIN users u ON si.fan_id = u.supabase_id
        WHERE si.creator_id = $1 AND si.status = 'accepted'
        
        UNION ALL
        
        SELECT 
          pcr.id,
          'video' as type,
          ce.scheduled_date as date,
          ce.scheduled_time as time,
          pcr.estimated_duration as duration,
          pcr.status,
          u.username as fan_username,
          pcr.fan_id,
          'private_call' as source
        FROM private_call_requests pcr
        JOIN users u ON pcr.fan_id = u.supabase_id
        LEFT JOIN calendar_events ce ON ce.reference_id = pcr.id
        WHERE pcr.creator_id = $1 AND pcr.status = 'accepted'
      ) combined
      WHERE date >= CURRENT_DATE
      ORDER BY date ASC, time ASC
    `;
    
    const eventsResult = await db.query(query, [userId]);
    
    // Calculate stats
    const now = new Date();
    const events = eventsResult.rows;
    const upcomingCalls = events.filter(e => 
      new Date(`${e.date} ${e.time}`) > now
    ).length;
    
    const stats = {
      totalEvents: events.length,
      upcomingCalls,
      completedCalls: 0, // Would need to query completed sessions
      revenue: 0 // Would need to calculate from completed sessions
    };
    
    res.json({
      success: true,
      events: eventsResult.rows,
      stats
    });
    
  } catch (error) {
    logger.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// Cancel a calendar event directly
router.delete('/calendar-events/:eventId', authenticateToken, async (req, res) => {
  const { eventId } = req.params;
  const userId = req.user.supabase_id;
  
  try {
    await db.query('BEGIN');
    
    // Get the calendar event
    const eventResult = await db.query(
      'SELECT * FROM calendar_events WHERE id = $1 AND (creator_id = $2 OR fan_id = $2)',
      [eventId, userId]
    );
    
    if (eventResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const event = eventResult.rows[0];
    
    // Update calendar event status
    await db.query(
      'UPDATE calendar_events SET status = $1, updated_at = NOW() WHERE id = $2',
      ['cancelled', eventId]
    );
    
    // If there's a reference, update the source as well
    if (event.reference_id && event.reference_type) {
      if (event.reference_type === 'private_call_request') {
        await db.query(
          'UPDATE private_call_requests SET status = $1 WHERE id = $2',
          ['cancelled', event.reference_id]
        );
      } else if (event.reference_type === 'session_invite') {
        await db.query(
          'UPDATE session_invites SET status = $1 WHERE id = $2',
          ['cancelled', event.reference_id]
        );
      }
    }
    
    await db.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Event cancelled successfully'
    });
    
  } catch (error) {
    await db.query('ROLLBACK');
    logger.error('Error cancelling calendar event:', error);
    res.status(500).json({ error: 'Failed to cancel event' });
  }
});

module.exports = router;