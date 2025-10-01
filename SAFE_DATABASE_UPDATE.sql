-- ============================================
-- SAFE DATABASE UPDATE FOR DIGIS
-- ============================================
-- This version carefully checks table/column existence
-- before creating any objects
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
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'fan_id') THEN
    CREATE INDEX IF NOT EXISTS idx_sessions_fan_id ON public.sessions(fan_id);
  END IF;
END $$;

-- ============================================
-- STEP 2: Create Core Tables (Safe)
-- ============================================

-- Create each table only if it doesn't exist
DO $$
BEGIN
  -- Loyalty Badges System
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loyalty_badges') THEN
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
  END IF;

  -- Analytics Events
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics_events') THEN
    CREATE TABLE analytics_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID,
        session_id VARCHAR(255),
        event_type VARCHAR(100) NOT NULL,
        event_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        batch_id VARCHAR(255),
        creator_id UUID
    );
    RAISE NOTICE '✅ Created table: analytics_events';
  END IF;

  -- Session Metrics
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'session_metrics') THEN
    CREATE TABLE session_metrics (
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
    RAISE NOTICE '✅ Created table: session_metrics';
  END IF;

  -- Creator Fan Notes
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'creator_fan_notes') THEN
    CREATE TABLE creator_fan_notes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        creator_id UUID NOT NULL,
        fan_id UUID NOT NULL,
        note TEXT,
        tags JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(creator_id, fan_id)
    );
    RAISE NOTICE '✅ Created table: creator_fan_notes';
  END IF;

  -- Private Call Requests
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'private_call_requests') THEN
    CREATE TABLE private_call_requests (
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
    RAISE NOTICE '✅ Created table: private_call_requests';
  END IF;

  -- Notifications
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    CREATE TABLE notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255),
        message TEXT,
        data JSONB,
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    RAISE NOTICE '✅ Created table: notifications';
  END IF;

  -- Follows
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follows') THEN
    CREATE TABLE follows (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        follower_id UUID,
        creator_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, creator_id)
    );
    RAISE NOTICE '✅ Created table: follows';
  END IF;

  -- Token Transactions
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'token_transactions') THEN
    CREATE TABLE token_transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID,
        amount INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        description TEXT,
        reference_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    RAISE NOTICE '✅ Created table: token_transactions';
  END IF;

  -- Memberships
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memberships') THEN
    CREATE TABLE memberships (
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
    RAISE NOTICE '✅ Created table: memberships';
  END IF;

  -- Membership Tiers
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'membership_tiers') THEN
    CREATE TABLE membership_tiers (
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
    RAISE NOTICE '✅ Created table: membership_tiers';
  END IF;

  -- Show Tickets (without foreign key to avoid issues)
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'show_tickets') THEN
    CREATE TABLE show_tickets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        show_id UUID NOT NULL,
        fan_id UUID NOT NULL,
        purchase_price DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'valid',
        purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        used_at TIMESTAMP,
        UNIQUE(show_id, fan_id)
    );
    RAISE NOTICE '✅ Created table: show_tickets';
  END IF;

END $$;

-- ============================================
-- STEP 3: Handle ticketed_shows separately
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticketed_shows') THEN
    -- Create new table with all columns
    CREATE TABLE ticketed_shows (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        creator_id UUID,
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
    RAISE NOTICE '✅ Created table: ticketed_shows with creator_id';
  ELSE
    -- Table exists, check if creator_id column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ticketed_shows' AND column_name = 'creator_id') THEN
      ALTER TABLE ticketed_shows ADD COLUMN creator_id UUID;
      RAISE NOTICE '✅ Added creator_id column to ticketed_shows';
    END IF;
    
    -- Add other columns if missing
    ALTER TABLE ticketed_shows
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
  END IF;
END $$;

-- ============================================
-- STEP 4: Update existing tables with new columns
-- ============================================
DO $$
BEGIN
  -- Update users table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS is_creator BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS creator_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS stream_price DECIMAL(10,2) DEFAULT 5,
    ADD COLUMN IF NOT EXISTS video_price DECIMAL(10,2) DEFAULT 8,
    ADD COLUMN IF NOT EXISTS voice_price DECIMAL(10,2) DEFAULT 6,
    ADD COLUMN IF NOT EXISTS message_price DECIMAL(10,2) DEFAULT 2,
    ADD COLUMN IF NOT EXISTS message_price_enabled BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Updated users table with new columns';
  END IF;

  -- Update streams table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'streams') THEN
    ALTER TABLE streams 
    ADD COLUMN IF NOT EXISTS auto_end_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS auto_end_minutes INTEGER DEFAULT 10,
    ADD COLUMN IF NOT EXISTS warning_sent_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS auto_ended BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS auto_end_reason VARCHAR(50),
    ADD COLUMN IF NOT EXISTS last_fan_interaction_at TIMESTAMP;
    RAISE NOTICE '✅ Updated streams table with new columns';
  END IF;

  -- Update messages table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    ALTER TABLE messages 
    ADD COLUMN IF NOT EXISTS price_paid DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Updated messages table with pricing columns';
  END IF;
END $$;

-- ============================================
-- STEP 5: Create indexes safely
-- ============================================
DO $$
BEGIN
  -- Create indexes only if columns exist
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_badges' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_loyalty_badges_user_creator ON loyalty_badges(user_id, creator_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics_events' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follows' AND column_name = 'follower_id') THEN
    CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
    CREATE INDEX IF NOT EXISTS idx_follows_creator_id ON follows(creator_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticketed_shows' AND column_name = 'creator_id') THEN
    CREATE INDEX IF NOT EXISTS idx_ticketed_shows_creator ON ticketed_shows(creator_id);
  END IF;
  
  RAISE NOTICE '✅ Created all necessary indexes';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ℹ️ Some indexes could not be created: %', SQLERRM;
END $$;

-- ============================================
-- STEP 6: Enable RLS on tables (safe)
-- ============================================
DO $$
BEGIN
  -- Enable RLS only on existing tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loyalty_badges') THEN
    ALTER TABLE loyalty_badges ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics_events') THEN
    ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follows') THEN
    ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'token_transactions') THEN
    ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memberships') THEN
    ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'membership_tiers') THEN
    ALTER TABLE membership_tiers ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticketed_shows') THEN
    ALTER TABLE ticketed_shows ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'show_tickets') THEN
    ALTER TABLE show_tickets ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  END IF;
  
  RAISE NOTICE '✅ Enabled RLS on all existing tables';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ℹ️ Some RLS could not be enabled: %', SQLERRM;
END $$;

-- ============================================
-- STEP 7: Create RLS policies (very safe)
-- ============================================
DO $$
BEGIN
  -- Only create policies if tables and columns exist
  
  -- Loyalty badges
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_badges' AND column_name = 'user_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_badges' AND column_name = 'creator_id') THEN
    BEGIN
      CREATE POLICY "Users can view own loyalty badges" ON loyalty_badges
        FOR SELECT USING (auth.uid() = user_id OR auth.uid() = creator_id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  -- Analytics
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics_events' AND column_name = 'user_id') THEN
    BEGIN
      CREATE POLICY "Users can view own analytics" ON analytics_events
        FOR SELECT USING (auth.uid() = user_id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  -- Notifications
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'user_id') THEN
    BEGIN
      CREATE POLICY "Users can view own notifications" ON notifications
        FOR ALL USING (auth.uid() = user_id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  -- Token transactions
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'token_transactions' AND column_name = 'user_id') THEN
    BEGIN
      CREATE POLICY "Users can view own token transactions" ON token_transactions
        FOR SELECT USING (auth.uid() = user_id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  -- Follows
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follows' AND column_name = 'follower_id') THEN
    BEGIN
      CREATE POLICY "Users can view creators they follow" ON follows
        FOR ALL USING (auth.uid() = follower_id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follows' AND column_name = 'creator_id') THEN
    BEGIN
      CREATE POLICY "Creators can view their followers" ON follows
        FOR SELECT USING (auth.uid() = creator_id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  -- Memberships
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memberships' AND column_name = 'user_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memberships' AND column_name = 'creator_id') THEN
    BEGIN
      CREATE POLICY "Users can view own memberships" ON memberships
        FOR SELECT USING (auth.uid() = user_id OR auth.uid() = creator_id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  -- Show tickets
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'show_tickets' AND column_name = 'fan_id') THEN
    BEGIN
      CREATE POLICY "Users can view own tickets" ON show_tickets
        FOR SELECT USING (auth.uid() = fan_id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  -- Public policies
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_creator') THEN
    BEGIN
      CREATE POLICY "Public can view creator profiles" ON users
        FOR SELECT USING (is_creator = true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membership_tiers' AND column_name = 'is_active') THEN
    BEGIN
      CREATE POLICY "Public can view active membership tiers" ON membership_tiers
        FOR SELECT USING (is_active = true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  -- Ticketed shows (special handling)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticketed_shows') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticketed_shows' AND column_name = 'creator_id') THEN
      BEGIN
        CREATE POLICY "Public can view scheduled shows" ON ticketed_shows
          FOR SELECT USING (status = 'scheduled' AND (is_private = false OR auth.uid() = creator_id));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    ELSE
      BEGIN
        CREATE POLICY "Public can view scheduled shows" ON ticketed_shows
          FOR SELECT USING (status = 'scheduled' AND is_private = false);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END IF;

  RAISE NOTICE '✅ Created all RLS policies';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ℹ️ Error creating policies: %', SQLERRM;
END $$;

-- ============================================
-- FINAL: Summary
-- ============================================
DO $$
DECLARE
  table_count INTEGER;
  index_count INTEGER;
  policy_count INTEGER;
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
  
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ DATABASE UPDATE COMPLETE';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  • Tables: %', table_count;
  RAISE NOTICE '  • Indexes: %', index_count;
  RAISE NOTICE '  • RLS Policies: %', policy_count;
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Test your application';
  RAISE NOTICE '2. Create storage buckets in Supabase dashboard:';
  RAISE NOTICE '   - profile-images';
  RAISE NOTICE '   - content-uploads';
  RAISE NOTICE '   - stream-recordings';
  RAISE NOTICE '   - chat-attachments';
  RAISE NOTICE '   - verification-documents';
  RAISE NOTICE '============================================';
END $$;

-- Show key tables summary
SELECT 
  table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'users', 'sessions', 'loyalty_badges', 'analytics_events',
    'notifications', 'ticketed_shows', 'memberships'
  )
GROUP BY table_name
ORDER BY table_name;