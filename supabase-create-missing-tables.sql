-- ============================================
-- CREATE MISSING TABLES FOR DIGIS
-- ============================================
-- This SQL script creates the missing tables that are causing 500 errors
-- 
-- Run this in your Supabase SQL editor:
-- https://supabase.com/dashboard/project/lpphsjowsivjtcmafxnj/sql/new
-- ============================================

-- ============================================
-- 1. Create Classes Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.classes (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  class_type VARCHAR(50) CHECK (class_type IN ('live', 'recorded')),
  category VARCHAR(100),
  level VARCHAR(50) CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  duration_minutes INTEGER DEFAULT 60,
  price_tokens INTEGER DEFAULT 50,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),
  max_participants INTEGER DEFAULT 20,
  current_participants INTEGER DEFAULT 0,
  thumbnail_url TEXT,
  video_url TEXT,
  agora_channel VARCHAR(255),
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. Create Class Participants Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.class_participants (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  tokens_paid INTEGER,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. Create TV Subscriptions Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.tv_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) UNIQUE,
  plan_type VARCHAR(50) CHECK (plan_type IN ('basic', 'premium', 'vip')),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  price_per_month DECIMAL(10,2),
  tokens_per_month INTEGER,
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. Create Notifications Table (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id SERIAL PRIMARY KEY,
  recipient_id INTEGER REFERENCES users(id),
  sender_id INTEGER REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. Create User Preferences Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) UNIQUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT TRUE,
  sms_notifications BOOLEAN DEFAULT FALSE,
  notification_new_follower BOOLEAN DEFAULT TRUE,
  notification_new_message BOOLEAN DEFAULT TRUE,
  notification_session_request BOOLEAN DEFAULT TRUE,
  notification_payment BOOLEAN DEFAULT TRUE,
  preferred_categories JSONB DEFAULT '[]',
  preferred_creators JSONB DEFAULT '[]',
  language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. Create Recommendations Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.recommendations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  creator_id INTEGER REFERENCES users(id),
  score DECIMAL(5,2) DEFAULT 0.00,
  reason VARCHAR(255),
  clicked BOOLEAN DEFAULT FALSE,
  converted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 7. Create Indexes
-- ============================================

-- Classes indexes
CREATE INDEX IF NOT EXISTS idx_classes_creator_id ON public.classes(creator_id);
CREATE INDEX IF NOT EXISTS idx_classes_scheduled_at ON public.classes(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_classes_status ON public.classes(status);

-- Class participants indexes
CREATE INDEX IF NOT EXISTS idx_class_participants_class_id ON public.class_participants(class_id);
CREATE INDEX IF NOT EXISTS idx_class_participants_user_id ON public.class_participants(user_id);

-- TV subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_tv_subscriptions_user_id ON public.tv_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_tv_subscriptions_status ON public.tv_subscriptions(status);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sender_id ON public.notifications(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);

-- User preferences index
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Recommendations indexes
CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON public.recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_creator_id ON public.recommendations(creator_id);

-- ============================================
-- 8. Verify Tables Created
-- ============================================
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('classes', 'class_participants', 'tv_subscriptions', 'notifications', 'user_preferences', 'recommendations');
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Created/verified % tables', table_count;
  RAISE NOTICE '============================================';
END $$;