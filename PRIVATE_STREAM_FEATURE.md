# Private Stream Feature Implementation

## Overview
The Private Stream feature allows fans to request exclusive 1-on-1 streaming sessions with creators during live streams. This feature enhances monetization opportunities for creators while providing intimate, personalized experiences for fans.

## Feature Components

### 1. Creator Settings (Creator Studio)
- **Location**: `CreatorStudio.js` - Settings Tab
- **Configuration Options**:
  - Private Stream Rate (tokens per minute)
  - Minimum Session Time (1-60 minutes)
  - Auto-accept Mode:
    - Manual Approval (default)
    - Auto-accept All
    - Auto-accept Subscribers Only
  - Enable/Disable Private Stream button visibility

### 2. Fan Request Interface
- **Location**: `StreamingLayout.js`
- **Features**:
  - 🔒 Private Stream button visible during live streams
  - Request modal with:
    - Pricing information
    - Minimum duration requirements
    - Total minimum cost calculation
    - Feature benefits explanation
  - Real-time token balance validation

### 3. Creator Request Management
- **Location**: `StreamingLayout.js` - Creator Controls
- **Features**:
  - Private Requests button with count badge
  - Request panel showing:
    - Fan information
    - Requested duration
    - Potential earnings
    - Accept/Decline actions
  - Warning about transitioning from public to private stream

### 4. Backend API Endpoints
- **Location**: `backend/routes/streaming.js`
- **Endpoints**:
  - `GET /api/streaming/private-settings/:creatorId` - Get creator's settings
  - `POST /api/streaming/private-request` - Fan submits request
  - `POST /api/streaming/private-accept` - Creator accepts request
  - `GET /api/streaming/private-requests` - Get pending requests

## User Flow

### For Fans:
1. Join a creator's live stream
2. Click "🔒 Private Stream" button
3. Review pricing and minimum duration
4. Confirm request (tokens reserved)
5. Wait for creator approval
6. If accepted, transition to private 1-on-1 stream

### For Creators:
1. Configure Private Stream settings in Creator Studio
2. Start a live stream
3. Receive private stream requests in real-time
4. Review requests in the Private Requests panel
5. Accept or decline requests
6. Upon acceptance:
   - Other viewers disconnected
   - Stream becomes private
   - Billing starts based on configured rate

## Billing Logic

### Token Calculation:
```
Total Cost = Rate per Minute × Maximum(Requested Minutes, Minimum Required Minutes)
```

### Billing Features:
- Minimum time prevents short wasteful sessions
- Tokens deducted upfront when request accepted
- Creator earns full minimum duration even if fan leaves early
- Automatic refund if creator declines

## Security & Privacy

- Only authenticated users can request private streams
- Token balance verified before request
- Creator identity protected until acceptance
- Private stream content isolated from public viewers
- No recording without explicit permission

## Demo Features

For demonstration purposes, the implementation includes:
- Mock private stream requests that appear 3 seconds after a creator starts streaming
- Default pricing: 100 tokens/minute, 5-minute minimum
- Simulated request notifications

## Future Enhancements

1. **Queue Management**: Allow multiple pending requests with queue priority
2. **Scheduling**: Pre-book private stream sessions
3. **Loyalty Discounts**: Reduced rates for subscribers
4. **Time Extensions**: Extend private sessions in real-time
5. **Recording Options**: Optional recording with revenue sharing
6. **Analytics**: Private stream performance metrics

## Technical Notes

- Uses existing Agora.io infrastructure for video streaming
- Leverages WebSocket for real-time request notifications
- Integrates with token economy system
- Compatible with existing session billing

## Database Schema (Future)

```sql
-- Creator settings table
CREATE TABLE creator_settings (
  creator_id VARCHAR PRIMARY KEY,
  private_stream_rate INTEGER DEFAULT 100,
  private_stream_min_time INTEGER DEFAULT 5,
  private_stream_auto_accept VARCHAR DEFAULT 'manual',
  private_stream_enabled BOOLEAN DEFAULT true
);

-- Private stream requests table
CREATE TABLE private_stream_requests (
  id SERIAL PRIMARY KEY,
  fan_id VARCHAR NOT NULL,
  creator_id VARCHAR NOT NULL,
  stream_id VARCHAR NOT NULL,
  minimum_minutes INTEGER NOT NULL,
  rate_per_minute INTEGER NOT NULL,
  total_cost INTEGER NOT NULL,
  status VARCHAR DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Private stream sessions table
CREATE TABLE private_stream_sessions (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES private_stream_requests(id),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  actual_duration_minutes INTEGER,
  total_earnings INTEGER
);
```