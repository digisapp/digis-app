# Stream Auto-End Feature Documentation

## Overview
The Stream Auto-End feature automatically terminates inactive live streams to prevent creators from accidentally leaving streams running without viewers or interaction. This helps conserve resources and improves the user experience.

## How It Works

### Example Scenarios

#### 1. No Viewers Scenario:
- Stream has 0 viewers for 10 minutes → Warning at 5 minutes → Auto-end at 10 minutes

#### 2. Inactive Viewers Scenario:
- Stream has viewers but no interaction for 15 minutes → Warning at 10 minutes → Auto-end at 15 minutes

### Activity Monitoring
The system continuously monitors all active streams for:
- **Viewer count** - Number of fans currently watching
- **Fan interactions** - Chat messages, gifts, reactions
- **Creator activity** - Manual heartbeats and actions

### Auto-End Triggers

#### 1. No Viewers (Default: 10 minutes)
- Stream has 0 viewers for the configured timeout period
- 5-minute grace period when stream first starts
- Warning sent 5 minutes before auto-end

#### 2. No Interaction (Default: 15 minutes)
- Stream has viewers but no chat/gift activity
- Fixed 15-minute timeout when viewers are present
- Creator can send heartbeat to reset timer

### Configuration Options

#### Creator Settings
```javascript
{
  autoEndEnabled: true,        // Enable/disable auto-end
  autoEndMinutes: 10,          // Minutes before auto-end (5-120)
  warningMinutes: 5            // Warning time before auto-end (2-10)
}
```

#### Preset Options
- **10 minutes** - Quick streams, testing
- **10 minutes** - Recommended default
- **15 minutes** - Extended grace period
- **30 minutes** - Extended grace period
- **60 minutes** - Maximum patience

## Implementation Details

### Backend Components

#### 1. Stream Activity Monitor (`/backend/utils/stream-activity-monitor.js`)
- Runs every minute to check inactive streams
- Tracks activity in memory and database
- Sends warnings and auto-ends streams
- Manages viewer counts and interactions

#### 2. Database Schema
```sql
-- Stream tracking columns
ALTER TABLE streams ADD:
  - last_activity_at         -- Any activity timestamp
  - last_fan_interaction_at  -- Fan-specific activity
  - viewer_count             -- Current viewer count
  - auto_end_enabled         -- Feature toggle
  - auto_end_minutes         -- Timeout setting
  - warning_sent_at          -- Warning timestamp
  - auto_ended               -- Was auto-ended flag
  - auto_end_reason          -- Reason for auto-end

-- Activity log table
CREATE TABLE stream_activity_log:
  - stream_id
  - activity_type  -- fan_joined, chat_message, gift_sent, etc.
  - fan_id
  - details (JSONB)
  - created_at
```

#### 3. API Endpoints
- `POST /api/streaming/activity/:streamId` - Log stream activity
- `POST /api/streaming/heartbeat/:streamId` - Creator keepalive
- `PUT /api/streaming/settings/:streamId` - Update stream settings
- `GET /api/streaming/activity-stats/:streamId` - Get activity statistics

### Frontend Components

#### 1. StreamInactivityWarning Component
- Displays countdown warning to creator
- "I'm Still Here!" button to prevent auto-end
- Shows viewer count and remaining time
- Auto-dismisses on fan interaction

#### 2. StreamAutoEndSettings Component
- Toggle auto-end on/off
- Select timeout duration
- Configure warning time
- Save preferences per creator

### Socket Events

#### Emitted by Server
- `stream_inactivity_warning` - Warning before auto-end
- `stream_auto_ended` - Stream was auto-ended

#### Activity Types Tracked
- `fan_joined` - Fan enters stream
- `fan_left` - Fan leaves stream
- `chat_message` - Chat activity
- `gift_sent` - Virtual gift sent
- `creator_heartbeat` - Creator keepalive
- `creator_action` - Any creator interaction
- `inactivity_warning` - Warning sent
- `auto_ended` - Stream auto-ended

## Usage Examples

### Creator Starting a Stream
```javascript
// Stream starts with default settings
const stream = await createStream({
  title: "My Live Stream",
  auto_end_enabled: true,      // From creator preferences
  auto_end_minutes: 10         // From creator preferences
});
```

### Fan Interaction Resets Timer
```javascript
// Any fan activity resets the inactivity timer
socket.emit('chat_message', { streamId, message });
// Timer resets, warning dismissed if shown
```

### Creator Keeps Stream Alive
```javascript
// Creator clicks "I'm Still Here!" or interacts
await api.post(`/api/streaming/heartbeat/${streamId}`);
// Timer resets, stream continues
```

### Customizing Settings
```javascript
// Creator updates their preferences
await api.put(`/api/creators/${creatorId}/stream-settings`, {
  stream_auto_end_enabled: true,
  stream_auto_end_minutes: 30,
  stream_warning_minutes: 10
});
```

## Benefits

### For Creators
- ✅ Never accidentally leave streams running
- ✅ Save bandwidth and resources
- ✅ Get notified before auto-end
- ✅ Customizable timeout settings
- ✅ Can disable if preferred

### For Platform
- ✅ Reduced server resource usage
- ✅ Better stream quality metrics
- ✅ Improved user experience
- ✅ Prevent zombie streams
- ✅ Accurate viewer analytics

### For Fans
- ✅ Only see active, engaged streams
- ✅ Better discovery of live content
- ✅ No confusion from inactive streams

## Best Practices

1. **Inform Creators** - Make sure creators understand the feature
2. **Reasonable Defaults** - 10 minutes is recommended
3. **Clear Warnings** - Give creators time to respond
4. **Activity Tracking** - Log all interactions properly
5. **Grace Period** - Allow time for viewers to join

## Troubleshooting

### Stream Ending Too Quickly
- Increase `auto_end_minutes` setting
- Ensure fan interactions are tracked
- Check network connectivity

### Warning Not Appearing
- Verify WebSocket connection
- Check browser notifications
- Ensure component is mounted

### Settings Not Saving
- Check API endpoint permissions
- Verify database migrations ran
- Check network requests

## Future Enhancements

1. **Smart Detection** - ML-based activity prediction
2. **Schedule Integration** - Different settings for scheduled streams
3. **Analytics Dashboard** - Show auto-end statistics
4. **Mobile Notifications** - Push notifications for warnings
5. **Viewer Retention** - Track why viewers leave