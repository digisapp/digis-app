-- ================================================
-- COMPREHENSIVE SUPABASE MIGRATION SCRIPT
-- Run this in Supabase SQL Editor to ensure all tables and columns exist
-- ================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================
-- 0. BASE TABLES (Ensure core tables exist first)
-- ================================================

-- Create sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  fan_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('video', 'voice', 'chat')),
  status VARCHAR(20) DEFAULT 'pending',
  scheduled_time TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  total_cost INTEGER,
  agora_channel VARCHAR(255),
  agora_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create streams table if it doesn't exist
CREATE TABLE IF NOT EXISTS streams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  title VARCHAR(255),
  description TEXT,
  status VARCHAR(20) DEFAULT 'scheduled',
  scheduled_start TIMESTAMP WITH TIME ZONE,
  actual_start TIMESTAMP WITH TIME ZONE,
  actual_end TIMESTAMP WITH TIME ZONE,
  viewer_count INTEGER DEFAULT 0,
  peak_viewers INTEGER DEFAULT 0,
  total_tips INTEGER DEFAULT 0,
  agora_channel VARCHAR(255),
  agora_token TEXT,
  thumbnail_url TEXT,
  is_private BOOLEAN DEFAULT false,
  ticket_price INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stream_recordings table if it doesn't exist
CREATE TABLE IF NOT EXISTS stream_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  recording_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  file_size BIGINT,
  status VARCHAR(50) DEFAULT 'processing',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stream_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS stream_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_tip BOOLEAN DEFAULT false,
  tip_amount INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create creator_earnings table if it doesn't exist
CREATE TABLE IF NOT EXISTS creator_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL,
  source_id UUID,
  amount DECIMAL(10,2) NOT NULL,
  tokens INTEGER,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create creator_payouts table if it doesn't exist
CREATE TABLE IF NOT EXISTS creator_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  payout_method VARCHAR(50),
  payout_details JSONB,
  processed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create badges table if it doesn't exist
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  badge_name VARCHAR(50) NOT NULL,
  badge_level VARCHAR(50),
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_creator_badge UNIQUE (user_id, creator_id, badge_name)
);

-- ================================================
-- 1. DIGITALS TABLES (Migration 134)
-- ================================================

-- Create digitals table for model portfolio photos and videos
CREATE TABLE IF NOT EXISTS digitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  title VARCHAR(255),
  description TEXT,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('image', 'video')),
  category VARCHAR(100) DEFAULT 'general',
  tags TEXT[],
  
  -- Metadata
  width INTEGER,
  height INTEGER,
  duration INTEGER, -- for videos, in seconds
  file_size BIGINT,
  mime_type VARCHAR(100),
  
  -- Settings
  is_public BOOLEAN DEFAULT true,
  allow_download BOOLEAN DEFAULT false,
  watermarked BOOLEAN DEFAULT false,
  
  -- Stats
  view_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  
  -- Ordering
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add category column if it doesn't exist (in case table already exists without it)
ALTER TABLE digitals ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'general';

-- Create digital categories table
CREATE TABLE IF NOT EXISTS digital_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(creator_id, slug)
);

-- Create digital views tracking table  
CREATE TABLE IF NOT EXISTS digital_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  digital_id UUID NOT NULL REFERENCES digitals(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES users(supabase_id) ON DELETE SET NULL,
  viewer_type VARCHAR(50), -- 'agency', 'brand', 'scout', 'public'
  viewer_info JSONB, -- Store additional info like company name
  ip_address INET,
  user_agent TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create digitals access table for private sharing
CREATE TABLE IF NOT EXISTS digital_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  access_code VARCHAR(20) UNIQUE NOT NULL,
  password VARCHAR(255),
  recipient_email VARCHAR(255),
  recipient_name VARCHAR(255),
  recipient_company VARCHAR(255),
  access_type VARCHAR(50) DEFAULT 'view', -- 'view', 'download'
  expires_at TIMESTAMP WITH TIME ZONE,
  max_views INTEGER,
  current_views INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at TIMESTAMP WITH TIME ZONE
);

-- ================================================
-- 2. CREATOR NOTIFICATION PREFERENCES (Migration 135)
-- ================================================

CREATE TABLE IF NOT EXISTS creator_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fan_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN DEFAULT true,
  live_notifications BOOLEAN DEFAULT true,
  content_notifications BOOLEAN DEFAULT true,
  announcement_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_fan_creator_notification UNIQUE (fan_id, creator_id),
  CONSTRAINT no_self_notification CHECK (fan_id != creator_id)
);

-- ================================================
-- 3. VOD PURCHASES (Migration 133)
-- ================================================

-- Add VOD fields to stream_recordings if not exists
ALTER TABLE stream_recordings 
ADD COLUMN IF NOT EXISTS is_vod BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS vod_price INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS vod_description TEXT,
ADD COLUMN IF NOT EXISTS vod_thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS vod_view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS vod_enabled BOOLEAN DEFAULT false;

-- Create VOD purchases table
CREATE TABLE IF NOT EXISTS vod_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recording_id UUID NOT NULL REFERENCES stream_recordings(id) ON DELETE CASCADE,
  fan_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  price_tokens INTEGER NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_vod_purchase UNIQUE (recording_id, fan_id)
);

-- ================================================
-- 4. TV SUBSCRIPTIONS AND TRIAL FIELDS (Migration 132)
-- ================================================

-- Create tv_subscriptions table first if it doesn't exist
CREATE TABLE IF NOT EXISTS tv_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'active',
  plan_type VARCHAR(50) DEFAULT 'monthly',
  current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  price_paid INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_tv_subscription UNIQUE (user_id)
);

-- Add trial fields to tv_subscriptions
ALTER TABLE tv_subscriptions
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS converted_from_trial BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_duration_days INTEGER DEFAULT 7;

-- Create index for tv_subscriptions
CREATE INDEX IF NOT EXISTS idx_tv_subscriptions_user_id ON tv_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_tv_subscriptions_status ON tv_subscriptions(status);

-- ================================================
-- 5. CREATOR CARD IMAGE (Migration 131)
-- ================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS card_image_url TEXT,
ADD COLUMN IF NOT EXISTS card_image_position VARCHAR(50) DEFAULT 'center',
ADD COLUMN IF NOT EXISTS card_overlay_opacity DECIMAL(3,2) DEFAULT 0.3,
ADD COLUMN IF NOT EXISTS card_text_color VARCHAR(7) DEFAULT '#FFFFFF';

-- ================================================
-- 6. KYC VERIFICATION (Migration 130)
-- ================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(50) DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS kyc_submission_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS kyc_data JSONB;

-- ================================================
-- 7. AGE VERIFICATION (Migration 129)
-- ================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS age_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS age_verification_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS age_verification_method VARCHAR(50);

-- ================================================
-- 8. DEFAULT TOKEN RATES (Migration 128)
-- ================================================

UPDATE users 
SET 
  video_rate = COALESCE(video_rate, 100),
  voice_rate = COALESCE(voice_rate, 50),
  chat_rate = COALESCE(chat_rate, 10),
  stream_rate = COALESCE(stream_rate, 25)
WHERE role = 'creator';

-- ================================================
-- 9. MISSING PRICING COLUMNS (Migration 127a)
-- ================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS message_price INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS collaboration_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS collaboration_rate INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS intake_form_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS intake_form_questions JSONB DEFAULT '[]'::jsonb;

-- ================================================
-- 10. SESSION INVITES (Migration 127)
-- ================================================

-- First ensure the table has all necessary columns
CREATE TABLE IF NOT EXISTS session_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add all columns if they don't exist
ALTER TABLE session_invites 
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS inviter_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS invitee_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS message TEXT,
ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS price_tokens INTEGER,
ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS response_message TEXT,
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- Add constraint if it doesn't exist and columns are present
DO $$
BEGIN
  -- First check if both columns exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'session_invites' 
    AND column_name = 'session_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'session_invites' 
    AND column_name = 'invitee_id'
  ) THEN
    -- Then add constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'session_invites' 
      AND constraint_name = 'unique_session_invite'
    ) THEN
      ALTER TABLE session_invites 
      ADD CONSTRAINT unique_session_invite UNIQUE (session_id, invitee_id);
    END IF;
  END IF;
END $$;

-- ================================================
-- 11. CALENDAR EVENTS (Migration 126)
-- ================================================

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_type VARCHAR(50) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  color VARCHAR(7) DEFAULT '#3B82F6',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns if they don't exist (in case table already exists without them)
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS event_type VARCHAR(50);

-- Update any NULL values to defaults if columns were just added
UPDATE calendar_events 
SET start_time = COALESCE(start_time, NOW()),
    end_time = COALESCE(end_time, NOW() + INTERVAL '1 hour'),
    event_type = COALESCE(event_type, 'general')
WHERE start_time IS NULL OR end_time IS NULL OR event_type IS NULL;

-- ================================================
-- 12. ENHANCED AVATAR SYSTEM (Migration 125)
-- ================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_type VARCHAR(50) DEFAULT 'image',
ADD COLUMN IF NOT EXISTS avatar_animation_url TEXT,
ADD COLUMN IF NOT EXISTS avatar_gif_url TEXT,
ADD COLUMN IF NOT EXISTS avatar_video_url TEXT,
ADD COLUMN IF NOT EXISTS avatar_thumbnail_url TEXT;

-- ================================================
-- 13. CREATOR FAN NOTES (Migration 124)
-- ================================================

CREATE TABLE IF NOT EXISTS creator_fan_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  fan_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  tags TEXT[],
  importance VARCHAR(20) DEFAULT 'normal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_creator_fan_note UNIQUE (creator_id, fan_id)
);

-- Add columns if they don't exist (in case table already exists without them)
ALTER TABLE creator_fan_notes
ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS fan_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS note TEXT;

-- ================================================
-- 14. MESSAGE PRICE COLUMNS (Migration 123)
-- ================================================

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS price_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_transaction_id UUID;

-- ================================================
-- 15. TICKETED SHOWS (Migration 122)
-- ================================================

CREATE TABLE IF NOT EXISTS ticketed_shows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
  scheduled_end TIMESTAMP WITH TIME ZONE,
  actual_start TIMESTAMP WITH TIME ZONE,
  actual_end TIMESTAMP WITH TIME ZONE,
  ticket_price INTEGER NOT NULL DEFAULT 0,
  max_tickets INTEGER,
  tickets_sold INTEGER DEFAULT 0,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern VARCHAR(50),
  tags TEXT[],
  status VARCHAR(50) DEFAULT 'scheduled',
  stream_id VARCHAR(255),
  agora_channel VARCHAR(255),
  recording_enabled BOOLEAN DEFAULT true,
  chat_enabled BOOLEAN DEFAULT true,
  tips_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT
);

-- Add columns if they don't exist (in case table already exists without them)
ALTER TABLE ticketed_shows 
ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS title VARCHAR(255),
ADD COLUMN IF NOT EXISTS ticket_price INTEGER DEFAULT 0;

-- Update any NULL values to defaults if columns were just added
UPDATE ticketed_shows 
SET scheduled_start = COALESCE(scheduled_start, NOW()),
    title = COALESCE(title, 'Untitled Show'),
    ticket_price = COALESCE(ticket_price, 0)
WHERE scheduled_start IS NULL OR title IS NULL;

CREATE TABLE IF NOT EXISTS show_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  show_id UUID NOT NULL REFERENCES ticketed_shows(id) ON DELETE CASCADE,
  fan_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  purchase_price INTEGER NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE,
  refund_reason TEXT,
  access_token VARCHAR(255) UNIQUE,
  CONSTRAINT unique_show_ticket UNIQUE (show_id, fan_id)
);

-- Add fan_id column if it doesn't exist (in case table already exists without it)
ALTER TABLE show_tickets 
ADD COLUMN IF NOT EXISTS fan_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS show_id UUID REFERENCES ticketed_shows(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS purchase_price INTEGER;

-- Update any NULL values to defaults if columns were just added
UPDATE show_tickets 
SET purchase_price = COALESCE(purchase_price, 0)
WHERE purchase_price IS NULL;

-- ================================================
-- 16. STREAM MENTIONS (Migration 121)
-- ================================================

ALTER TABLE stream_messages
ADD COLUMN IF NOT EXISTS mentions UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS replied_to_id UUID REFERENCES stream_messages(id);

-- ================================================
-- 17. CONTENT TABLES (Migration 120)
-- ================================================

CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  description TEXT,
  file_url TEXT,
  thumbnail_url TEXT,
  price_tokens INTEGER DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  fan_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  price_paid INTEGER NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_content_purchase UNIQUE (content_id, fan_id)
);

CREATE TABLE IF NOT EXISTS content_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_content_like UNIQUE (content_id, user_id)
);

-- ================================================
-- 18. PLATFORM FEE COLUMNS (Migration 119)
-- ================================================

ALTER TABLE creator_earnings
ADD COLUMN IF NOT EXISTS platform_fee_percentage DECIMAL(5,2) DEFAULT 20.00,
ADD COLUMN IF NOT EXISTS platform_fee_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_earnings DECIMAL(10,2) DEFAULT 0;

ALTER TABLE creator_payouts
ADD COLUMN IF NOT EXISTS platform_fee_percentage DECIMAL(5,2) DEFAULT 20.00,
ADD COLUMN IF NOT EXISTS platform_fee_amount DECIMAL(10,2) DEFAULT 0;

-- ================================================
-- 19. SHOP TABLES (Migration 118)
-- ================================================

CREATE TABLE IF NOT EXISTS shop_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  price_tokens INTEGER NOT NULL,
  images TEXT[],
  is_digital BOOLEAN DEFAULT false,
  is_limited BOOLEAN DEFAULT false,
  stock_quantity INTEGER,
  sold_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add category column if it doesn't exist (in case table already exists without it)
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS category VARCHAR(100);

CREATE TABLE IF NOT EXISTS shop_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  price_paid INTEGER NOT NULL,
  delivery_status VARCHAR(50) DEFAULT 'pending',
  delivery_details JSONB,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- ================================================
-- 20. STANDARDIZED SUBSCRIPTION TIERS (Migration 117)
-- ================================================

CREATE TABLE IF NOT EXISTS subscription_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  tier_level INTEGER NOT NULL CHECK (tier_level BETWEEN 1 AND 5),
  price_monthly INTEGER NOT NULL,
  price_yearly INTEGER,
  description TEXT,
  perks JSONB DEFAULT '[]',
  badge_color VARCHAR(7),
  badge_icon VARCHAR(50),
  max_subscribers INTEGER,
  current_subscribers INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_creator_tier_level UNIQUE (creator_id, tier_level)
);

CREATE TABLE IF NOT EXISTS tier_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier_id UUID NOT NULL REFERENCES subscription_tiers(id) ON DELETE CASCADE,
  subscriber_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'active',
  billing_period VARCHAR(20) DEFAULT 'monthly',
  current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_tier_subscription UNIQUE (tier_id, subscriber_id)
);

-- ================================================
-- 21. PLATINUM TIER AND CHALLENGES (Migration 116)
-- ================================================

ALTER TABLE badges
ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'bronze',
ADD COLUMN IF NOT EXISTS tier_progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tier_threshold INTEGER DEFAULT 100;

CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  points INTEGER DEFAULT 0,
  requirement_type VARCHAR(50),
  requirement_value INTEGER,
  icon_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_challenge UNIQUE (user_id, challenge_id)
);

-- ================================================
-- 22. DUAL BADGE SYSTEM (Migration 115)
-- ================================================

ALTER TABLE badges
ADD COLUMN IF NOT EXISTS badge_type VARCHAR(20) DEFAULT 'loyalty',
ADD COLUMN IF NOT EXISTS multiplier DECIMAL(3,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS perks JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS auto_upgrade BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS badge_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  badge_name VARCHAR(50) NOT NULL,
  badge_type VARCHAR(20) NOT NULL,
  action VARCHAR(50) NOT NULL,
  previous_level VARCHAR(50),
  new_level VARCHAR(50),
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- 23. STREAM ACTIVITY TRACKING (Migration 114)
-- ================================================

CREATE TABLE IF NOT EXISTS stream_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  viewer_count INTEGER DEFAULT 0,
  chat_message_count INTEGER DEFAULT 0,
  tip_count INTEGER DEFAULT 0,
  gift_count INTEGER DEFAULT 0,
  total_earnings INTEGER DEFAULT 0,
  peak_viewers INTEGER DEFAULT 0,
  average_watch_time INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- 24. PRIVATE CALL TABLES (Migration 113)
-- ================================================

CREATE TABLE IF NOT EXISTS private_call_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  call_type VARCHAR(20) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  proposed_time TIMESTAMP WITH TIME ZONE,
  message TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  response_message TEXT,
  scheduled_time TIMESTAMP WITH TIME ZONE,
  total_cost INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Add columns if they don't exist (in case table already exists without them)
ALTER TABLE private_call_requests
ADD COLUMN IF NOT EXISTS requester_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS call_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS total_cost INTEGER,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

-- ================================================
-- 25. CO-HOST TABLES (Migration 112)
-- ================================================

CREATE TABLE IF NOT EXISTS stream_co_hosts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  co_host_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'co-host',
  permissions JSONB DEFAULT '{"can_mute": false, "can_kick": false, "can_end": false}',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  earnings_percentage DECIMAL(5,2) DEFAULT 0,
  CONSTRAINT unique_stream_co_host UNIQUE (stream_id, co_host_id)
);

-- ================================================
-- 26. ANALYTICS TABLES (Migration 111)
-- ================================================

-- Create analytics_events table (simplified without partitioning for now)
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  event_category VARCHAR(50),
  event_data JSONB DEFAULT '{}',
  session_id VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns if they don't exist (in case table already exists without them)
ALTER TABLE analytics_events
ADD COLUMN IF NOT EXISTS event_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS event_category VARCHAR(50),
ADD COLUMN IF NOT EXISTS event_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);

-- Note: Partitioning can be added later if needed for performance
-- For now, we'll use a simple table with proper indexes

-- ================================================
-- 27. PUSH NOTIFICATIONS TABLES (Migration 108)
-- ================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_type VARCHAR(50),
  device_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_push_endpoint UNIQUE (user_id, endpoint)
);

-- ================================================
-- 28. CREATE ALL INDEXES
-- ================================================

-- Digitals indexes
CREATE INDEX IF NOT EXISTS idx_digitals_creator_id ON digitals(creator_id);
CREATE INDEX IF NOT EXISTS idx_digitals_category ON digitals(category);
CREATE INDEX IF NOT EXISTS idx_digitals_is_public ON digitals(is_public);
CREATE INDEX IF NOT EXISTS idx_digitals_created_at ON digitals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_digital_categories_creator_id ON digital_categories(creator_id);
CREATE INDEX IF NOT EXISTS idx_digital_views_digital_id ON digital_views(digital_id);
CREATE INDEX IF NOT EXISTS idx_digital_views_viewer_id ON digital_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_digital_views_viewed_at ON digital_views(viewed_at);

-- Creator notification preferences indexes (create only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'creator_notification_preferences' AND column_name = 'fan_id') THEN
    CREATE INDEX IF NOT EXISTS idx_creator_notif_pref_fan_id ON creator_notification_preferences(fan_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'creator_notification_preferences' AND column_name = 'creator_id') THEN
    CREATE INDEX IF NOT EXISTS idx_creator_notif_pref_creator_id ON creator_notification_preferences(creator_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'creator_notification_preferences' AND column_name = 'notifications_enabled') THEN
    CREATE INDEX IF NOT EXISTS idx_creator_notif_pref_enabled ON creator_notification_preferences(notifications_enabled) WHERE notifications_enabled = true;
  END IF;
END $$;

-- VOD indexes (create only if table and columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vod_purchases') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vod_purchases' AND column_name = 'recording_id') THEN
      CREATE INDEX IF NOT EXISTS idx_vod_purchases_recording_id ON vod_purchases(recording_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vod_purchases' AND column_name = 'fan_id') THEN
      CREATE INDEX IF NOT EXISTS idx_vod_purchases_fan_id ON vod_purchases(fan_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vod_purchases' AND column_name = 'creator_id') THEN
      CREATE INDEX IF NOT EXISTS idx_vod_purchases_creator_id ON vod_purchases(creator_id);
    END IF;
  END IF;
END $$;

-- Session invites indexes (create only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_invites' AND column_name = 'session_id') THEN
    CREATE INDEX IF NOT EXISTS idx_session_invites_session_id ON session_invites(session_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_invites' AND column_name = 'invitee_id') THEN
    CREATE INDEX IF NOT EXISTS idx_session_invites_invitee_id ON session_invites(invitee_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_invites' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_session_invites_status ON session_invites(status);
  END IF;
END $$;

-- Calendar events indexes (create only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'creator_id') THEN
    CREATE INDEX IF NOT EXISTS idx_calendar_events_creator_id ON calendar_events(creator_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'start_time') THEN
    CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'event_type') THEN
    CREATE INDEX IF NOT EXISTS idx_calendar_events_event_type ON calendar_events(event_type);
  END IF;
END $$;

-- Creator fan notes indexes (create only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'creator_fan_notes' AND column_name = 'creator_id') THEN
    CREATE INDEX IF NOT EXISTS idx_creator_fan_notes_creator_id ON creator_fan_notes(creator_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'creator_fan_notes' AND column_name = 'fan_id') THEN
    CREATE INDEX IF NOT EXISTS idx_creator_fan_notes_fan_id ON creator_fan_notes(fan_id);
  END IF;
END $$;

-- Ticketed shows indexes (create only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticketed_shows' AND column_name = 'creator_id') THEN
    CREATE INDEX IF NOT EXISTS idx_ticketed_shows_creator_id ON ticketed_shows(creator_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticketed_shows' AND column_name = 'scheduled_start') THEN
    CREATE INDEX IF NOT EXISTS idx_ticketed_shows_scheduled_start ON ticketed_shows(scheduled_start);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticketed_shows' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_ticketed_shows_status ON ticketed_shows(status);
  END IF;
END $$;

-- Show tickets indexes (create only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'show_tickets' AND column_name = 'show_id') THEN
    CREATE INDEX IF NOT EXISTS idx_show_tickets_show_id ON show_tickets(show_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'show_tickets' AND column_name = 'fan_id') THEN
    CREATE INDEX IF NOT EXISTS idx_show_tickets_fan_id ON show_tickets(fan_id);
  END IF;
END $$;

-- Content indexes (create only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_items' AND column_name = 'creator_id') THEN
    CREATE INDEX IF NOT EXISTS idx_content_items_creator_id ON content_items(creator_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_items' AND column_name = 'type') THEN
    CREATE INDEX IF NOT EXISTS idx_content_items_type ON content_items(type);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_purchases' AND column_name = 'fan_id') THEN
    CREATE INDEX IF NOT EXISTS idx_content_purchases_fan_id ON content_purchases(fan_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_likes' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_content_likes_user_id ON content_likes(user_id);
  END IF;
END $$;

-- Shop indexes (create only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_items' AND column_name = 'creator_id') THEN
    CREATE INDEX IF NOT EXISTS idx_shop_items_creator_id ON shop_items(creator_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_items' AND column_name = 'category') THEN
    CREATE INDEX IF NOT EXISTS idx_shop_items_category ON shop_items(category);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_purchases' AND column_name = 'buyer_id') THEN
    CREATE INDEX IF NOT EXISTS idx_shop_purchases_buyer_id ON shop_purchases(buyer_id);
  END IF;
END $$;

-- Subscription tiers indexes
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_creator_id ON subscription_tiers(creator_id);
CREATE INDEX IF NOT EXISTS idx_tier_subscriptions_subscriber_id ON tier_subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_tier_subscriptions_creator_id ON tier_subscriptions(creator_id);

-- Stream activity indexes (create only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_activity' AND column_name = 'stream_id') THEN
    CREATE INDEX IF NOT EXISTS idx_stream_activity_stream_id ON stream_activity(stream_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_activity' AND column_name = 'creator_id') THEN
    CREATE INDEX IF NOT EXISTS idx_stream_activity_creator_id ON stream_activity(creator_id);
  END IF;
END $$;

-- Private call requests indexes (create only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'private_call_requests' AND column_name = 'requester_id') THEN
    CREATE INDEX IF NOT EXISTS idx_private_call_requests_requester_id ON private_call_requests(requester_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'private_call_requests' AND column_name = 'creator_id') THEN
    CREATE INDEX IF NOT EXISTS idx_private_call_requests_creator_id ON private_call_requests(creator_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'private_call_requests' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_private_call_requests_status ON private_call_requests(status);
  END IF;
END $$;

-- Analytics events indexes (create only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics_events' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics_events' AND column_name = 'event_type') THEN
    CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics_events' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);
  END IF;
END $$;

-- Push subscriptions indexes (create only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'push_subscriptions' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
  END IF;
END $$;

-- ================================================
-- 29. ENABLE ROW LEVEL SECURITY
-- ================================================

-- Enable RLS on base tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

-- Enable RLS on new tables
ALTER TABLE digitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE vod_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_fan_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticketed_shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE show_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_call_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_co_hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ================================================
-- 30. CREATE RLS POLICIES
-- ================================================

-- Policies for digitals
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'digitals' 
    AND policyname = 'Public digitals are viewable by everyone'
  ) THEN
    CREATE POLICY "Public digitals are viewable by everyone" ON digitals
      FOR SELECT USING (is_public = true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'digitals' 
    AND policyname = 'Creators can manage their own digitals'
  ) THEN
    CREATE POLICY "Creators can manage their own digitals" ON digitals
      FOR ALL USING (auth.uid() = creator_id);
  END IF;
END $$;

-- Policies for categories
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'digital_categories' 
    AND policyname = 'Categories are viewable by everyone'
  ) THEN
    CREATE POLICY "Categories are viewable by everyone" ON digital_categories
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'digital_categories' 
    AND policyname = 'Creators can manage their own categories'
  ) THEN
    CREATE POLICY "Creators can manage their own categories" ON digital_categories
      FOR ALL USING (auth.uid() = creator_id);
  END IF;
END $$;

-- Policies for creator notification preferences
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'creator_notification_preferences' 
    AND policyname = 'creator_notif_pref_select_own'
  ) THEN
    CREATE POLICY creator_notif_pref_select_own ON creator_notification_preferences
      FOR SELECT USING (fan_id = auth.uid());
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'creator_notification_preferences' 
    AND policyname = 'creator_notif_pref_insert_own'
  ) THEN
    CREATE POLICY creator_notif_pref_insert_own ON creator_notification_preferences
      FOR INSERT WITH CHECK (fan_id = auth.uid());
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'creator_notification_preferences' 
    AND policyname = 'creator_notif_pref_update_own'
  ) THEN
    CREATE POLICY creator_notif_pref_update_own ON creator_notification_preferences
      FOR UPDATE USING (fan_id = auth.uid());
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'creator_notification_preferences' 
    AND policyname = 'creator_notif_pref_delete_own'
  ) THEN
    CREATE POLICY creator_notif_pref_delete_own ON creator_notification_preferences
      FOR DELETE USING (fan_id = auth.uid());
  END IF;
END $$;

-- ================================================
-- 31. CREATE TRIGGER FUNCTIONS
-- ================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at (drop and recreate to ensure correct function)
DROP TRIGGER IF EXISTS update_digitals_updated_at ON digitals;
CREATE TRIGGER update_digitals_updated_at BEFORE UPDATE ON digitals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_creator_notif_pref_updated_at ON creator_notification_preferences;
CREATE TRIGGER update_creator_notif_pref_updated_at BEFORE UPDATE ON creator_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON calendar_events;
CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_creator_fan_notes_updated_at ON creator_fan_notes;
CREATE TRIGGER update_creator_fan_notes_updated_at BEFORE UPDATE ON creator_fan_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ticketed_shows_updated_at ON ticketed_shows;
CREATE TRIGGER update_ticketed_shows_updated_at BEFORE UPDATE ON ticketed_shows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_content_items_updated_at ON content_items;
CREATE TRIGGER update_content_items_updated_at BEFORE UPDATE ON content_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shop_items_updated_at ON shop_items;
CREATE TRIGGER update_shop_items_updated_at BEFORE UPDATE ON shop_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_tiers_updated_at ON subscription_tiers;
CREATE TRIGGER update_subscription_tiers_updated_at BEFORE UPDATE ON subscription_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tier_subscriptions_updated_at ON tier_subscriptions;
CREATE TRIGGER update_tier_subscriptions_updated_at BEFORE UPDATE ON tier_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stream_activity_updated_at ON stream_activity;
CREATE TRIGGER update_stream_activity_updated_at BEFORE UPDATE ON stream_activity
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- 32. GRANT PERMISSIONS
-- ================================================

-- Grant permissions to authenticated users
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT, UPDATE, DELETE ON 
  digitals, digital_categories, digital_views, digital_access,
  creator_notification_preferences, vod_purchases, session_invites,
  calendar_events, creator_fan_notes, ticketed_shows, show_tickets,
  content_items, content_purchases, content_likes, shop_items,
  shop_purchases, subscription_tiers, tier_subscriptions,
  challenges, user_challenges, badge_history, stream_activity,
  private_call_requests, stream_co_hosts, analytics_events,
  push_subscriptions
TO authenticated;

-- ================================================
-- MIGRATION COMPLETE
-- ================================================
-- All tables and columns should now be created
-- The backend should no longer fail due to missing database elements