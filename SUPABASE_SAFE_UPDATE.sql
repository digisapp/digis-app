-- ============================================
-- SAFE SUPABASE DATABASE UPDATE FOR DIGIS
-- ============================================
-- This version checks your existing structure first
-- Run this ENTIRE file in your Supabase SQL editor
-- Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- FIRST: Let's check what tables and columns exist
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Checking existing database structure...';
  RAISE NOTICE '============================================';
END $$;

-- ============================================
-- SECTION 1: Fix member_id to fan_id rename (if needed)
-- ============================================
DO $$
BEGIN
  -- Only rename if member_id exists and fan_id doesn't
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'sessions' AND column_name = 'member_id') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'sessions' AND column_name = 'fan_id') THEN
    
    ALTER TABLE public.sessions RENAME COLUMN member_id TO fan_id;
    RAISE NOTICE '✅ Renamed column: member_id → fan_id';
    
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sessions' AND column_name = 'fan_id') THEN
    RAISE NOTICE '✅ Column already exists: fan_id';
  ELSE
    RAISE NOTICE 'ℹ️ Sessions table may not exist yet or has different structure';
  END IF;
END $$;

-- ============================================
-- SECTION 2: Create Loyalty Badges System (Safe)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_name = 'loyalty_badges') THEN
    CREATE TABLE loyalty_badges (
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
    RAISE NOTICE '✅ Created table: loyalty_badges';
  ELSE
    -- Add missing columns if table exists
    ALTER TABLE loyalty_badges 
    ADD COLUMN IF NOT EXISTS challenges_completed INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS next_tier_progress DECIMAL(5,2) DEFAULT 0;
    RAISE NOTICE '✅ Table loyalty_badges already exists - added any missing columns';
  END IF;
END $$;

-- Add constraint for badge levels (safe)
DO $$
BEGIN
  ALTER TABLE loyalty_badges 
  DROP CONSTRAINT IF EXISTS loyalty_badges_level_check;
  
  ALTER TABLE loyalty_badges 
  ADD CONSTRAINT loyalty_badges_level_check 
  CHECK (level IN ('none', 'bronze', 'silver', 'gold', 'diamond', 'platinum'));
  
  RAISE NOTICE '✅ Updated loyalty badge level constraints';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ℹ️ Could not update constraints - may already be correct';
END $$;

-- ============================================
-- SECTION 3: Create Challenges System (Safe)
-- ============================================
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

-- ============================================
-- SECTION 4: Create Perk Deliveries System (Safe)
-- ============================================
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

-- ============================================
-- SECTION 5: Stream Activity Tracking (Safe)
-- ============================================
CREATE TABLE IF NOT EXISTS stream_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID,
    activity_type VARCHAR(50) NOT NULL,
    fan_id UUID,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add columns to streams table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'streams') THEN
    ALTER TABLE streams 
    ADD COLUMN IF NOT EXISTS auto_end_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS auto_end_minutes INTEGER DEFAULT 10,
    ADD COLUMN IF NOT EXISTS warning_sent_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS auto_ended BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS auto_end_reason VARCHAR(50),
    ADD COLUMN IF NOT EXISTS last_fan_interaction_at TIMESTAMP;
    RAISE NOTICE '✅ Updated streams table with auto-end columns';
  ELSE
    RAISE NOTICE 'ℹ️ Streams table does not exist yet';
  END IF;
END $$;

-- ============================================
-- SECTION 6: Private Call System (Safe)
-- ============================================
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

-- ============================================
-- SECTION 7: Co-Host System (Safe)
-- ============================================
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

-- ============================================
-- SECTION 8: Analytics Tables (Safe)
-- ============================================
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

-- ============================================
-- SECTION 9: Subscription Management (Safe)
-- ============================================
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

-- ============================================
-- SECTION 10: Other Essential Tables (Safe)
-- ============================================
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

CREATE TABLE IF NOT EXISTS follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID,
    creator_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, creator_id)
);

CREATE TABLE IF NOT EXISTS session_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID,
    user_id UUID,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, user_id)
);

CREATE TABLE IF NOT EXISTS token_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    amount INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    reference_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SECTION 11: Create Safe Indexes (Won't fail if columns don't exist)
-- ============================================
DO $$
BEGIN
  -- Sessions indexes
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'fan_id') THEN
    CREATE INDEX IF NOT EXISTS idx_sessions_fan_id ON sessions(fan_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'creator_id') THEN
    CREATE INDEX IF NOT EXISTS idx_sessions_creator_id ON sessions(creator_id);
  END IF;
  
  -- Loyalty badges indexes
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loyalty_badges') THEN
    CREATE INDEX IF NOT EXISTS idx_loyalty_badges_user_creator ON loyalty_badges(user_id, creator_id);
    CREATE INDEX IF NOT EXISTS idx_loyalty_badges_creator_id ON loyalty_badges(creator_id);
  END IF;
  
  -- Analytics indexes
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics_events') THEN
    CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);
  END IF;
  
  -- Other indexes
  CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
  CREATE INDEX IF NOT EXISTS idx_memberships_creator_id ON memberships(creator_id);
  CREATE INDEX IF NOT EXISTS idx_private_call_requests_creator ON private_call_requests(creator_id);
  CREATE INDEX IF NOT EXISTS idx_private_call_requests_fan ON private_call_requests(fan_id);
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
  
  RAISE NOTICE '✅ Created all necessary indexes';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ℹ️ Some indexes could not be created - this is OK';
END $$;

-- ============================================
-- SECTION 12: Update Users Table (Safe)
-- ============================================
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
    ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS show_token_balance BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS auto_refill_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS auto_refill_package INTEGER DEFAULT 500;
    RAISE NOTICE '✅ Updated users table with additional columns';
  ELSE
    RAISE NOTICE 'ℹ️ Users table does not exist - may be using Supabase auth.users';
  END IF;
END $$;

-- ============================================
-- FINAL: Summary Report
-- ============================================
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name IN (
    'loyalty_badges',
    'loyalty_challenges',
    'challenge_progress',
    'perk_deliveries',
    'stream_activity_log',
    'private_call_requests',
    'private_call_availability',
    'co_host_sessions',
    'co_host_invites',
    'analytics_events',
    'session_metrics',
    'membership_tiers',
    'memberships',
    'notifications',
    'follows',
    'session_ratings',
    'token_transactions'
  );
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ DATABASE UPDATE COMPLETE!';
  RAISE NOTICE '✅ Successfully created/verified % tables', table_count;
  RAISE NOTICE '✅ Your database is now ready to use';
  RAISE NOTICE '============================================';
END $$;

-- Show what tables were created
SELECT 
  table_name as "Table",
  CASE 
    WHEN table_name IN ('loyalty_badges', 'loyalty_challenges', 'challenge_progress') THEN 'Loyalty System'
    WHEN table_name IN ('membership_tiers', 'memberships') THEN 'Subscriptions'
    WHEN table_name IN ('private_call_requests', 'private_call_availability') THEN 'Private Calls'
    WHEN table_name IN ('co_host_sessions', 'co_host_invites') THEN 'Co-Hosting'
    WHEN table_name IN ('analytics_events', 'session_metrics') THEN 'Analytics'
    WHEN table_name IN ('stream_activity_log') THEN 'Stream Tracking'
    ELSE 'Core Features'
  END as "Feature Group"
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'loyalty_badges',
  'loyalty_challenges', 
  'challenge_progress',
  'perk_deliveries',
  'stream_activity_log',
  'private_call_requests',
  'private_call_availability',
  'co_host_sessions',
  'co_host_invites',
  'analytics_events',
  'session_metrics',
  'membership_tiers',
  'memberships',
  'notifications',
  'follows',
  'session_ratings',
  'token_transactions'
)
ORDER BY "Feature Group", "Table";