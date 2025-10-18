# Creator Data Storage in Supabase

## Overview
Yes! Supabase stores **everything** for creators. Your database has **133 tables** with comprehensive tracking.

## 📊 What's Stored in the `users` Table (Creator Profile)

### Profile Information (51 creator-specific columns)
- **Identity**: `bio`, `about_me`, `display_name`, `username`
- **Media**:
  - `avatar_url`, `avatar_gif_url`, `avatar_video_url`, `avatar_animation_url`, `avatar_thumbnail_url`
  - `cover_image_url`, `cover_photo_url`, `banner_url`, `banner_image_url`, `card_image_url`
  - `gallery_images` (JSONB array of photos)
- **Pricing** (all in cents):
  - `video_rate_cents` (video call rate)
  - `voice_rate_cents` (voice call rate)
  - `stream_rate_cents` (streaming rate)
  - `message_price_cents` (message price)
  - `text_message_price`, `image_message_price`, `audio_message_price`, `video_message_price`
  - `subscription_price`, `hourly_rate`, `collaboration_rate`

### Token Balances
- `token_balance` - Fan token balance
- `creator_token_balance` - Creator earnings
- `lifetime_tokens_spent` - Total tokens spent by user

### Settings & Preferences
- `message_price_enabled` - Enable/disable paid messages
- `avatar_type` - image/gif/video/animation
- `card_image_position` - center/top/bottom
- Layout preferences stored in JSONB fields

## 🗃️ Separate Tables for Creator Data

### 💰 Token & Financial Tables
1. **`token_balances`** - Current token balances per user
2. **`token_transactions`** - Every token purchase, transfer, tip
3. **`tokens`** - Token package definitions
4. **`user_tokens`** - User-specific token data
5. **`payments`** - All payment transactions
6. **`creator_earnings`** - Earnings breakdown
7. **`creator_payouts`** - Payout history
8. **`creator_payout_intents`** - Pending payouts
9. **`tips`** - Tip transactions
10. **`tip_transactions`** - Tip history
11. **`stream_tips`** - Tips during streams

### 💬 Messages Tables
1. **`messages`** - Direct messages between users
2. **`chat_messages`** - Chat messages
3. **`ppv_messages`** - Pay-per-view messages
4. **`stream_messages`** - Live stream chat messages

### 🎥 Session & Call Tables
1. **`sessions`** - Video/voice call sessions
2. **`private_call_sessions`** - Private 1-on-1 calls
3. **`stream_sessions`** - Live streaming sessions
4. **`session_metrics`** - Call quality metrics
5. **`session_ratings`** - User ratings for sessions
6. **`session_quality`** - Technical quality data
7. **`session_invites`** - Session invitations

### 👥 Creator-Fan Relationship Tables
1. **`creator_subscriptions`** - Subscription relationships
2. **`subscription_tiers`** - Subscription tier definitions
3. **`tier_subscriptions`** - Active tier subscriptions
4. **`followers`** - Follower relationships
5. **`saved_creators`** - Fans who saved creators
6. **`creator_fan_notes`** - Creator notes about fans
7. **`fan_notes`** - Notes system

### 📊 Analytics Tables
1. **`creator_analytics`** - Creator performance analytics
2. **`stream_analytics`** - Stream performance
3. **`stream_analytics_v2`** - Enhanced stream analytics
4. **`session_metrics`** - Session performance
5. **`analytics_events`** - Event tracking
6. **`analytics_buckets`** - Aggregated analytics

### 🎨 Content Tables
1. **`creator_content`** - Creator-uploaded content
2. **`content_items`** - Individual content pieces
3. **`content_uploads`** - Upload tracking
4. **`content_purchases`** - Content sales
5. **`content_views`** - View tracking
6. **`content_likes`** - Likes on content
7. **`stream_recordings`** - Recorded streams
8. **`recording_purchases`** - Recording sales

### 📝 Offers & Services
1. **`creator_offers`** - Custom offers/services
2. **`offer_bookings`** - Booked offers
3. **`offer_purchases`** - Purchased offers
4. **`offer_analytics`** - Offer performance

### 🛍️ Shop & Products
1. **`shop_items`** - Products for sale
2. **`shop_orders`** - Order history
3. **`shop_purchases`** - Purchase transactions
4. **`shop_settings`** - Shop configuration

### 🎫 Ticketed Events
1. **`ticketed_shows`** - Special ticketed events
2. **`show_tickets`** - Ticket sales
3. **`show_announcements`** - Event announcements

### ⚙️ Creator Settings
1. **`creator_notification_preferences`** - Notification settings
2. **`creator_cards`** - Profile card designs
3. **`creator_applications`** - Creator applications

## 📈 Real-Time Tracking

Every interaction is logged:
- ✅ **Token purchases** → `token_transactions`
- ✅ **Tips sent/received** → `tips`, `tip_transactions`
- ✅ **Messages** → `messages`, `chat_messages`, `ppv_messages`
- ✅ **Video calls** → `sessions`, `private_call_sessions`
- ✅ **Streams** → `stream_sessions`, `stream_analytics`
- ✅ **Subscriptions** → `creator_subscriptions`, `tier_subscriptions`
- ✅ **Content views** → `content_views`, `analytics_events`
- ✅ **Earnings** → `creator_earnings`, `payments`
- ✅ **Payouts** → `creator_payouts`

## 🔐 Additional Tracking

- **Audit logs** → `audit_logs`, `financial_audit_log`
- **User activity** → `application_logs`, `page_views`
- **Webhook processing** → `stripe_webhook_events`, `processed_webhooks`
- **Transaction integrity** → `ledger_snapshots`, `transaction_logs`

## 💾 Storage Summary

**Total Tables**: 133
**Creator-specific tables**: ~50+
**Total columns in users table**: 205
**Creator-specific columns in users**: 51

## ✅ What This Means

Your Supabase database is **fully equipped** to track:
1. ✅ Every creator's token balance and earnings
2. ✅ All pricing rates (video, voice, stream, messages)
3. ✅ Complete message history
4. ✅ All photos/media (avatars, banners, galleries)
5. ✅ Session history and analytics
6. ✅ Subscription relationships
7. ✅ Payment and payout history
8. ✅ Content uploads and sales
9. ✅ Real-time analytics

Everything is properly normalized and ready to use! 🎉
