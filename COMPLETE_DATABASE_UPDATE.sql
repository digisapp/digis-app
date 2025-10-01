-- ============================================
-- COMPLETE DATABASE UPDATE FOR DIGIS
-- ============================================
-- Run this ENTIRE file in your Supabase SQL editor
-- Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
-- This consolidates all necessary updates in the correct order
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- STEP 1: Fix member_id to fan_id rename
-- ============================================
DO $$
BEGIN
  -- Check and fix sessions table
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'sessions' AND column_name = 'member_id') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'sessions' AND column_name = 'fan_id') THEN
    ALTER TABLE public.sessions RENAME COLUMN member_id TO fan_id;
    RAISE NOTICE '✅ Renamed column: member_id → fan_id';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sessions' AND column_name = 'fan_id') THEN
    RAISE NOTICE '✅ Column already exists: fan_id';
  END IF;
  
  -- Drop old index if exists
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sessions_member_id') THEN
    DROP INDEX idx_sessions_member_id;
  END IF;
  
  -- Create new index if doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sessions_fan_id') THEN
    CREATE INDEX idx_sessions_fan_id ON public.sessions(fan_id);
  END IF;
END $$;

-- ============================================
-- STEP 2: Core Tables
-- ============================================

-- Loyalty Badges System
CREATE TABLE IF NOT EXISTS loyalty_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    creator_id UUID,
    level VARCHAR(20) DEFAULT 'bronze',
    total_spend DECIMAL(10,2) DEFAULT 0,
    interaction_count INTEGER DEFAULT 0,
    support_duration_days INTEGER DEFAULT 0,
    first_interaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_interaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    perks JSONB DEFAULT '[]'::jsonb,
    challenges_completed INTEGER DEFAULT 0,
    loyalty_points INTEGER DEFAULT 0,
    next_tier_progress DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, creator_id)
);

-- Analytics Events
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    session_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    batch_id VARCHAR(255),
    creator_id UUID
);

-- Session Metrics
CREATE TABLE IF NOT EXISTS session_metrics (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id UUID,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration INTEGER,
    quality_metrics JSONB,
    revenue_metrics JSONB,
    technical_metrics JSONB,
    interactions_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Creator Fan Notes
CREATE TABLE IF NOT EXISTS creator_fan_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL,
    fan_id UUID NOT NULL,
    note TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(creator_id, fan_id)
);

-- Private Call Requests
CREATE TABLE IF NOT EXISTS private_call_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fan_id UUID,
    creator_id UUID,
    status VARCHAR(20) DEFAULT 'pending',
    requested_duration INTEGER DEFAULT 10,
    offered_tokens INTEGER,
    message TEXT,
    scheduled_time TIMESTAMP,
    decline_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    expires_at TIMESTAMP
);

-- Private Call Availability
CREATE TABLE IF NOT EXISTS private_call_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID UNIQUE,
    is_available BOOLEAN DEFAULT false,
    min_duration INTEGER DEFAULT 5,
    max_duration INTEGER DEFAULT 60,
    tokens_per_minute INTEGER DEFAULT 30,
    auto_accept BOOLEAN DEFAULT false,
    availability_hours JSONB DEFAULT '[]'::jsonb,
    blocked_users JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stream Activity Log
CREATE TABLE IF NOT EXISTS stream_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID,
    activity_type VARCHAR(50) NOT NULL,
    fan_id UUID,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Co-Host Sessions
CREATE TABLE IF NOT EXISTS co_host_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID,
    host_id UUID,
    co_host_id UUID,
    status VARCHAR(20) DEFAULT 'pending',
    revenue_split DECIMAL(5,2) DEFAULT 50.00,
    joined_at TIMESTAMP,
    left_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Co-Host Invites
CREATE TABLE IF NOT EXISTS co_host_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID,
    host_id UUID,
    co_host_id UUID,
    status VARCHAR(20) DEFAULT 'pending',
    message TEXT,
    revenue_split DECIMAL(5,2) DEFAULT 50.00,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    message TEXT,
    data JSONB,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Follows
CREATE TABLE IF NOT EXISTS follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID,
    creator_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, creator_id)
);

-- Session Ratings
CREATE TABLE IF NOT EXISTS session_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID,
    user_id UUID,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, user_id)
);

-- Token Transactions
CREATE TABLE IF NOT EXISTS token_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    amount INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    reference_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loyalty Challenges
CREATE TABLE IF NOT EXISTS loyalty_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    challenge_type VARCHAR(50) NOT NULL,
    target_value INTEGER NOT NULL,
    reward_points INTEGER NOT NULL,
    reward_tokens INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Challenge Progress
CREATE TABLE IF NOT EXISTS challenge_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    challenge_id UUID,
    creator_id UUID,
    current_value INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, challenge_id)
);

-- Perk Deliveries
CREATE TABLE IF NOT EXISTS perk_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    creator_id UUID,
    perk_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    delivery_data JSONB,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Membership Tiers
CREATE TABLE IF NOT EXISTS membership_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID,
    name VARCHAR(50) NOT NULL,
    display_name VARCHAR(100),
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    perks JSONB DEFAULT '[]'::jsonb,
    color VARCHAR(7) DEFAULT '#6B46C1',
    badge_icon VARCHAR(50),
    session_discount_percent INTEGER DEFAULT 0,
    tokens_included INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    max_subscribers INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Memberships
CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    creator_id UUID,
    tier_id UUID,
    status VARCHAR(20) DEFAULT 'active',
    stripe_subscription_id VARCHAR(255),
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, creator_id)
);

-- Ticketed Shows (with safe column addition)
DO $$
BEGIN
  -- Create table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticketed_shows') THEN
    CREATE TABLE ticketed_shows (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        creator_id UUID NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        scheduled_time TIMESTAMP NOT NULL,
        duration_minutes INTEGER DEFAULT 60,
        ticket_price DECIMAL(10,2) NOT NULL,
        max_attendees INTEGER,
        is_private BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'scheduled',
        stream_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    RAISE NOTICE '✅ Created table: ticketed_shows';
  ELSE
    -- Table exists, add missing columns
    ALTER TABLE ticketed_shows
    ADD COLUMN IF NOT EXISTS creator_id UUID,
    ADD COLUMN IF NOT EXISTS title VARCHAR(255),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMP,
    ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60,
    ADD COLUMN IF NOT EXISTS ticket_price DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS max_attendees INTEGER,
    ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'scheduled',
    ADD COLUMN IF NOT EXISTS stream_id UUID,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    RAISE NOTICE '✅ Updated table: ticketed_shows';
  END IF;
END $$;

-- Show Tickets
CREATE TABLE IF NOT EXISTS show_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    show_id UUID NOT NULL REFERENCES ticketed_shows(id) ON DELETE CASCADE,
    fan_id UUID NOT NULL,
    purchase_price DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'valid',
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP,
    UNIQUE(show_id, fan_id)
);

-- ============================================
-- STEP 3: Update existing tables with new columns
-- ============================================

-- Update users table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS is_creator BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS creator_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS stream_price DECIMAL(10,2) DEFAULT 5,
    ADD COLUMN IF NOT EXISTS video_price DECIMAL(10,2) DEFAULT 8,
    ADD COLUMN IF NOT EXISTS voice_price DECIMAL(10,2) DEFAULT 6,
    ADD COLUMN IF NOT EXISTS message_price DECIMAL(10,2) DEFAULT 2,
    ADD COLUMN IF NOT EXISTS message_price_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS loyalty_badges_enabled BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS private_calls_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS co_hosting_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS analytics_enabled BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS stream_auto_end_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS stream_auto_end_minutes INTEGER DEFAULT 10;
    RAISE NOTICE '✅ Updated users table with new columns';
  END IF;
END $$;

-- Update streams table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'streams') THEN
    ALTER TABLE streams 
    ADD COLUMN IF NOT EXISTS auto_end_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS auto_end_minutes INTEGER DEFAULT 10,
    ADD COLUMN IF NOT EXISTS warning_sent_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS auto_ended BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS auto_end_reason VARCHAR(50),
    ADD COLUMN IF NOT EXISTS last_fan_interaction_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS co_host_id UUID,
    ADD COLUMN IF NOT EXISTS co_host_revenue_split DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS is_ticketed_show BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS show_id UUID;
    RAISE NOTICE '✅ Updated streams table with new columns';
  END IF;
END $$;

-- Update messages table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    ALTER TABLE messages 
    ADD COLUMN IF NOT EXISTS price_paid DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Updated messages table with pricing columns';
  END IF;
END $$;

-- ============================================
-- STEP 4: Create all indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_loyalty_badges_user_creator ON loyalty_badges(user_id, creator_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_badges_creator_id ON loyalty_badges(creator_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_creator_id ON analytics_events(creator_id);
CREATE INDEX IF NOT EXISTS idx_session_metrics_user_id ON session_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_fan_notes_creator ON creator_fan_notes(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_fan_notes_fan ON creator_fan_notes(fan_id);
CREATE INDEX IF NOT EXISTS idx_private_call_requests_creator ON private_call_requests(creator_id);
CREATE INDEX IF NOT EXISTS idx_private_call_requests_fan ON private_call_requests(fan_id);
CREATE INDEX IF NOT EXISTS idx_private_call_requests_status ON private_call_requests(status);
CREATE INDEX IF NOT EXISTS idx_stream_activity_stream_id ON stream_activity_log(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_activity_created_at ON stream_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_creator_id ON follows(creator_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(type);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON token_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_creator_id ON memberships(creator_id);
CREATE INDEX IF NOT EXISTS idx_co_host_sessions_stream ON co_host_sessions(stream_id);
CREATE INDEX IF NOT EXISTS idx_co_host_invites_co_host ON co_host_invites(co_host_id);
-- Ticketed shows indexes (check column existence first)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'ticketed_shows' AND column_name = 'creator_id') THEN
    CREATE INDEX IF NOT EXISTS idx_ticketed_shows_creator ON ticketed_shows(creator_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'ticketed_shows' AND column_name = 'scheduled_time') THEN
    CREATE INDEX IF NOT EXISTS idx_ticketed_shows_scheduled ON ticketed_shows(scheduled_time);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ℹ️ Could not create ticketed_shows indexes: %', SQLERRM;
END $$;
CREATE INDEX IF NOT EXISTS idx_show_tickets_show ON show_tickets(show_id);
CREATE INDEX IF NOT EXISTS idx_show_tickets_fan ON show_tickets(fan_id);

-- ============================================
-- STEP 5: Add constraints
-- ============================================
DO $$
BEGIN
  -- Loyalty badge level constraint
  ALTER TABLE loyalty_badges 
  DROP CONSTRAINT IF EXISTS loyalty_badges_level_check;
  
  ALTER TABLE loyalty_badges 
  ADD CONSTRAINT loyalty_badges_level_check 
  CHECK (level IN ('none', 'bronze', 'silver', 'gold', 'diamond', 'platinum'));
  
  RAISE NOTICE '✅ Added all constraints';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ℹ️ Some constraints could not be added - this is OK';
END $$;

-- ============================================
-- STEP 6: Enable Row Level Security (RLS)
-- ============================================
-- Enable RLS on all tables
ALTER TABLE loyalty_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_fan_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_call_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_call_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE co_host_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE co_host_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE perk_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticketed_shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE show_tickets ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies with error handling
DO $$
BEGIN
  -- Loyalty badges policy
  BEGIN
    CREATE POLICY "Users can view own loyalty badges" ON loyalty_badges
      FOR SELECT USING (auth.uid() = user_id OR auth.uid() = creator_id);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- Analytics policy
  BEGIN
    CREATE POLICY "Users can view own analytics" ON analytics_events
      FOR SELECT USING (auth.uid() = user_id);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- Notifications policy
  BEGIN
    CREATE POLICY "Users can view own notifications" ON notifications
      FOR ALL USING (auth.uid() = user_id);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- Token transactions policy
  BEGIN
    CREATE POLICY "Users can view own token transactions" ON token_transactions
      FOR SELECT USING (auth.uid() = user_id);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- Follows policies
  BEGIN
    CREATE POLICY "Users can view creators they follow" ON follows
      FOR ALL USING (auth.uid() = follower_id);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE POLICY "Creators can view their followers" ON follows
      FOR SELECT USING (auth.uid() = creator_id);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- Memberships policy
  BEGIN
    CREATE POLICY "Users can view own memberships" ON memberships
      FOR SELECT USING (auth.uid() = user_id OR auth.uid() = creator_id);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- Show tickets policy
  BEGIN
    CREATE POLICY "Users can view own tickets" ON show_tickets
      FOR SELECT USING (auth.uid() = fan_id);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- Public policies
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' AND column_name = 'is_creator') THEN
      CREATE POLICY "Public can view creator profiles" ON users
        FOR SELECT USING (is_creator = true);
    END IF;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE POLICY "Public can view active membership tiers" ON membership_tiers
      FOR SELECT USING (is_active = true);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  RAISE NOTICE '✅ Created RLS policies (skipped duplicates)';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ℹ️ Some policies could not be created: %', SQLERRM;
END $$;

-- Check if creator_id column exists in ticketed_shows before creating policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'ticketed_shows' AND column_name = 'creator_id') THEN
    CREATE POLICY "Public can view scheduled shows" ON ticketed_shows
      FOR SELECT USING (status = 'scheduled' AND (is_private = false OR auth.uid() = creator_id));
  ELSE
    CREATE POLICY "Public can view scheduled shows" ON ticketed_shows
      FOR SELECT USING (status = 'scheduled' AND is_private = false);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Policy already exists
END $$;

-- Log RLS completion
DO $$
BEGIN
  RAISE NOTICE '✅ Enabled Row Level Security with basic policies';
END $$;

-- ============================================
-- STEP 7: Create storage buckets (if using Supabase Storage)
-- ============================================
-- Note: These need to be created in the Supabase dashboard or via the storage API
-- This is just documentation of what buckets are needed:
-- 1. profile-images - for user avatars and profile pictures
-- 2. content-uploads - for creator content (videos, images)
-- 3. stream-recordings - for recorded streams
-- 4. chat-attachments - for chat file uploads
-- 5. verification-documents - for creator verification

-- ============================================
-- FINAL: Verification Query
-- ============================================
DO $$
DECLARE
  table_count INTEGER;
  index_count INTEGER;
BEGIN
  -- Count tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';
  
  -- Count indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public';
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ DATABASE UPDATE COMPLETE';
  RAISE NOTICE '✅ Total tables: %', table_count;
  RAISE NOTICE '✅ Total indexes: %', index_count;
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Review any warnings above';
  RAISE NOTICE '2. Test your application';
  RAISE NOTICE '3. Create storage buckets in Supabase dashboard';
  RAISE NOTICE '============================================';
END $$;

-- Show final summary of key tables
SELECT 
  table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'users', 'sessions', 'loyalty_badges', 'analytics_events',
    'private_call_requests', 'ticketed_shows', 'memberships'
  )
GROUP BY table_name
ORDER BY table_name;