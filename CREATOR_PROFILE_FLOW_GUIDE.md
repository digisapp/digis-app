# Creator Profile Page - Complete Feature Flow Guide

## Page Load Performance Issues

### Current Issues:
1. **Multiple API calls on load** - The page makes 3+ parallel API calls:
   - `/api/content/creator/{username}` - Fetches creator info, pictures, videos
   - `/api/recording/creator/{username}/recordings` - Fetches stream recordings
   - `/api/shop/{username}/products` - Fetches shop products
   
2. **Missing error handling** - Some routes return 404/500 errors which slow down loading
3. **No caching** - Data is fetched fresh every time

### Solutions:
- Implement API response caching
- Add proper error boundaries
- Use React Query for data fetching with automatic caching
- Lazy load non-critical content

## Content Flow Architecture

### 1. Content Studio → Exclusive Content Section

**How it works:**
- Creators upload content in Content Studio (`/content-studio`)
- Content is saved to the `content` table in the database
- When a fan visits the creator's profile, the `Exclusive Content` section fetches from `/api/content/creator/{username}`
- Content types displayed:
  - **Photos** - Images uploaded by creator
  - **Videos** - Video content uploaded by creator
  - **Streams** - Recorded live streams (after save)

**Database Flow:**
```
content table → API endpoint → CreatorPublicProfile → Exclusive Content Display
```

### 2. Live Stream Save Process

**Stream Recording Flow:**
1. Creator goes live using StreamingLayout component
2. Stream is recorded using Agora Cloud Recording
3. When creator clicks "Save Stream":
   - Recording is saved to `stream_recordings` table
   - Recording appears in Content Studio under "Recordings"
   - Recording is displayed in Exclusive Content under "Streams" tab

**Database Tables:**
- `streams` - Active/past stream sessions
- `stream_recordings` - Saved stream recordings
- `content` - Can also store stream recordings as content

### 3. Creator Shop Sync

**Shop Products Flow:**
1. Creator adds products in Shop Management (`/shop`)
2. Products saved to `shop_items` table with:
   - `is_active` flag
   - `creator_id` reference
3. Profile page fetches active products via `/api/shop/{username}/products`
4. Only products with `is_active = true` are displayed

**Sync Process:**
```
Shop Management → shop_items table → API → Creator Profile Shop Section
```

## Interactive Features Flow

### 4. Video Call Process

**Complete Flow:**
1. **Fan initiates:**
   - Clicks "Video Call" button
   - Sees confirmation modal with rate ($5.5/min, 5 min minimum)
   - Clicks "Confirm"

2. **Creator notification:**
   - Creator receives real-time notification via WebSocket
   - Notification shows in NotificationBell component
   - Creator can Accept/Decline from notification

3. **Call establishment:**
   - If accepted: Both redirected to `/video-call/{session-id}`
   - VideoCall component uses Agora SDK
   - Session billing starts automatically
   - Tokens deducted per minute

4. **Database updates:**
   - `sessions` table tracks call duration
   - `token_transactions` records charges
   - `payments` table for billing

### 5. Message System Flow

**Message Initiation:**
1. **Fan clicks Message:**
   - Sees modal with $5 one-time conversation fee
   - Clicks "Continue"

2. **Payment & Redirect:**
   - $5 charged to fan's token balance
   - Creates entry in `messages` table
   - Redirects to `/messages/{creator-username}`

3. **Ongoing messaging:**
   - After initial $5 fee, messages may have per-message cost
   - Creator can set message prices:
     - Text: $X per message
     - Image: $Y per message
     - Video: $Z per message

### 6. Tipping System

**Tip Flow:**
1. Fan clicks "Tip" button
2. Modal shows with preset amounts (5, 10, 20, 50 tokens)
3. Fan can enter custom amount
4. On confirm:
   - Tokens deducted from fan balance
   - Added to creator balance
   - Recorded in `tips` table
   - Creator gets notification

## Real-time Updates

### WebSocket Events:
- `stream_started` - When creator goes live
- `stream_ended` - When stream ends
- `new_tip` - When tip received
- `call_request` - Video/voice call requests
- `new_message` - Message notifications

## Database Schema Overview

### Key Tables:
```sql
-- Content Management
content (id, creator_id, type, title, url, price, is_active)
stream_recordings (id, stream_id, creator_id, url, duration)

-- Shop
shop_items (id, creator_id, name, price, is_active, is_digital)

-- Communication
sessions (id, creator_id, fan_id, type, duration, total_amount)
messages (id, sender_id, receiver_id, content, price)
tips (id, fan_id, creator_id, amount)

-- Billing
token_transactions (id, user_id, amount, type, reference_id)
payments (id, session_id, amount, status)
```

## API Endpoints

### Profile Page APIs:
- `GET /api/content/creator/{username}` - Creator content
- `GET /api/recording/creator/{username}/recordings` - Stream recordings
- `GET /api/shop/{username}/products` - Shop products
- `GET /api/users/creator/{username}` - Creator details

### Action APIs:
- `POST /api/sessions/video-call` - Initiate video call
- `POST /api/messages/start` - Start conversation
- `POST /api/tips/send` - Send tip
- `POST /api/streaming/save-recording` - Save stream

## Performance Optimizations

### Recommended Improvements:
1. **Implement Redis caching** for creator profiles
2. **Use React Query** for data fetching with cache
3. **Lazy load** shop products and recordings
4. **Paginate** content in Exclusive Content section
5. **WebSocket connection pooling** for real-time updates
6. **CDN** for media content delivery

## Security Considerations

- All financial transactions require authentication
- Token balance checked before any paid action
- Rate limiting on API endpoints
- Content access control based on purchase status
- WebSocket authentication for real-time events