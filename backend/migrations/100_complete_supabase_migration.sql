-- =====================================================
-- COMPLETE SUPABASE MIGRATION - REMOVE ALL FIREBASE
-- =====================================================
-- This migration consolidates all tables, removes Firebase completely,
-- standardizes on supabase_id, adds RLS policies, and optimizes performance

-- Start transaction for atomicity
BEGIN;

-- =====================================================
-- STEP 1: DROP DUPLICATE TABLES AND CONSOLIDATE
-- =====================================================

-- Drop old class tables if they exist (we'll recreate with supabase_id)
DROP TABLE IF EXISTS class_reviews CASCADE;
DROP TABLE IF EXISTS class_participants CASCADE;
DROP TABLE IF EXISTS classes CASCADE;

-- Drop old call_requests if exists (we'll recreate with supabase_id)
DROP TABLE IF EXISTS call_requests CASCADE;

-- Drop old notifications if exists (we'll recreate with proper structure)
DROP TABLE IF EXISTS notifications CASCADE;

-- Drop migration tracking tables
DROP TABLE IF EXISTS migrations CASCADE;
DROP TABLE IF EXISTS auth_migration_mapping CASCADE;

-- =====================================================
-- STEP 2: UPDATE USERS TABLE TO REMOVE FIREBASE
-- =====================================================

-- First ensure supabase_id exists and is populated
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS supabase_id UUID UNIQUE;

-- Create a temporary mapping if firebase_uid still exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' AND column_name = 'firebase_uid') THEN
        -- For any users without supabase_id, generate one
        UPDATE users 
        SET supabase_id = gen_random_uuid() 
        WHERE supabase_id IS NULL;
    END IF;
END $$;

-- Make supabase_id the primary identifier
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_pkey CASCADE;

ALTER TABLE users 
ADD PRIMARY KEY (supabase_id);

-- Drop firebase_uid if it exists
ALTER TABLE users 
DROP COLUMN IF EXISTS firebase_uid CASCADE;

-- Ensure id column is SERIAL for backward compatibility
ALTER TABLE users 
ALTER COLUMN id SET DEFAULT nextval('users_id_seq'::regclass);

-- =====================================================
-- STEP 3: UPDATE ALL TABLES TO USE SUPABASE_ID
-- =====================================================

-- Update token_balances
ALTER TABLE token_balances 
ADD COLUMN IF NOT EXISTS supabase_user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE;

UPDATE token_balances tb
SET supabase_user_id = u.supabase_id
FROM users u 
WHERE u.id = tb.user_id::integer;

ALTER TABLE token_balances 
DROP COLUMN IF EXISTS user_id CASCADE;

ALTER TABLE token_balances 
RENAME COLUMN supabase_user_id TO user_id;

-- Update token_transactions
ALTER TABLE token_transactions 
ADD COLUMN IF NOT EXISTS supabase_user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE;

UPDATE token_transactions tt
SET supabase_user_id = u.supabase_id
FROM users u 
WHERE u.id = tt.user_id::integer;

ALTER TABLE token_transactions 
DROP COLUMN IF EXISTS user_id CASCADE;

ALTER TABLE token_transactions 
RENAME COLUMN supabase_user_id TO user_id;

-- Update sessions table
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS supabase_creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS supabase_fan_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE;

UPDATE sessions s
SET supabase_creator_id = u1.supabase_id,
    supabase_fan_id = u2.supabase_id
FROM users u1, users u2
WHERE u1.id = s.creator_id AND u2.id = s.fan_id;

ALTER TABLE sessions 
DROP COLUMN IF EXISTS creator_id CASCADE,
DROP COLUMN IF EXISTS fan_id CASCADE;

ALTER TABLE sessions 
RENAME COLUMN supabase_creator_id TO creator_id;
ALTER TABLE sessions 
RENAME COLUMN supabase_fan_id TO fan_id;

-- Update payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS supabase_user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE;

UPDATE payments p
SET supabase_user_id = u.supabase_id
FROM users u 
WHERE u.id = p.user_id::integer;

ALTER TABLE payments 
DROP COLUMN IF EXISTS user_id CASCADE;

ALTER TABLE payments 
RENAME COLUMN supabase_user_id TO user_id;

-- =====================================================
-- STEP 4: CREATE OPTIMIZED TABLES WITH SUPABASE_ID
-- =====================================================

-- Create partitioned token_transactions table
CREATE TABLE token_transactions_new (
    id SERIAL,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    balance_before DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,
    session_id INTEGER REFERENCES sessions(id),
    payment_id VARCHAR(255),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for 2025
CREATE TABLE token_transactions_2025_q1 PARTITION OF token_transactions_new
    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
CREATE TABLE token_transactions_2025_q2 PARTITION OF token_transactions_new
    FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
CREATE TABLE token_transactions_2025_q3 PARTITION OF token_transactions_new
    FOR VALUES FROM ('2025-07-01') TO ('2025-10-01');
CREATE TABLE token_transactions_2025_q4 PARTITION OF token_transactions_new
    FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');

-- Copy data from old table
INSERT INTO token_transactions_new 
SELECT * FROM token_transactions;

-- Drop old table and rename new one
DROP TABLE token_transactions CASCADE;
ALTER TABLE token_transactions_new RENAME TO token_transactions;

-- Create indexes
CREATE INDEX idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX idx_token_transactions_type ON token_transactions(type);
CREATE INDEX idx_token_transactions_created_at ON token_transactions(created_at);

-- Create classes table with Supabase structure
CREATE TABLE classes (
    id SERIAL PRIMARY KEY,
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    max_participants INTEGER NOT NULL DEFAULT 20,
    token_price DECIMAL(10, 2) NOT NULL DEFAULT 15,
    tags JSONB DEFAULT '[]',
    requirements TEXT,
    what_to_expect TEXT,
    cover_image_url TEXT,
    is_live BOOLEAN DEFAULT FALSE,
    recording_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE class_participants (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'joined',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(class_id, user_id)
);

CREATE TABLE class_reviews (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(class_id, user_id)
);

-- Create call_requests table (consolidated version)
CREATE TABLE call_requests (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    requester_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    session_type VARCHAR(20) NOT NULL CHECK (session_type IN ('video', 'voice')),
    requester_username VARCHAR(255),
    requester_profile_pic_url TEXT,
    requester_bio TEXT,
    message TEXT,
    estimated_duration INTEGER DEFAULT 10,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    channel_name VARCHAR(255),
    session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '5 minutes'
);

-- Create notifications table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(supabase_id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    is_read BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    action_url TEXT,
    action_type VARCHAR(50)
);

-- Create notification preferences
CREATE TABLE notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT FALSE,
    call_requests BOOLEAN DEFAULT TRUE,
    new_messages BOOLEAN DEFAULT TRUE,
    tips_received BOOLEAN DEFAULT TRUE,
    gifts_received BOOLEAN DEFAULT TRUE,
    new_followers BOOLEAN DEFAULT TRUE,
    class_reminders BOOLEAN DEFAULT TRUE,
    payment_alerts BOOLEAN DEFAULT TRUE,
    system_updates BOOLEAN DEFAULT TRUE,
    marketing_emails BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- =====================================================
-- STEP 5: ADD COMPREHENSIVE INDEXES
-- =====================================================

-- Classes indexes
CREATE INDEX idx_classes_creator_id ON classes(creator_id);
CREATE INDEX idx_classes_start_time ON classes(start_time);
CREATE INDEX idx_classes_category ON classes(category);
CREATE INDEX idx_classes_is_live ON classes(is_live);

-- Call requests indexes
CREATE INDEX idx_call_requests_requester_id ON call_requests(requester_id);
CREATE INDEX idx_call_requests_target_id ON call_requests(target_id);
CREATE INDEX idx_call_requests_status ON call_requests(status);
CREATE INDEX idx_call_requests_expires_at ON call_requests(expires_at);

-- Notifications indexes
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(recipient_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- =====================================================
-- STEP 6: CREATE UPDATE TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 7: ENABLE ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 8: CREATE RLS POLICIES
-- =====================================================

-- Users policies
CREATE POLICY users_select_own ON users FOR SELECT USING (auth.uid() = supabase_id);
CREATE POLICY users_update_own ON users FOR UPDATE USING (auth.uid() = supabase_id);

-- Token balance policies
CREATE POLICY token_balance_select_own ON token_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY token_balance_update_system ON token_balances FOR UPDATE USING (auth.uid() = user_id);

-- Token transactions policies
CREATE POLICY token_transactions_select_own ON token_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY token_transactions_insert_system ON token_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Sessions policies
CREATE POLICY sessions_select_participant ON sessions FOR SELECT 
    USING (auth.uid() IN (creator_id, fan_id));
CREATE POLICY sessions_insert_participant ON sessions FOR INSERT 
    WITH CHECK (auth.uid() IN (creator_id, fan_id));
CREATE POLICY sessions_update_participant ON sessions FOR UPDATE 
    USING (auth.uid() IN (creator_id, fan_id));

-- Classes policies
CREATE POLICY classes_select_all ON classes FOR SELECT USING (TRUE);
CREATE POLICY classes_insert_creator ON classes FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY classes_update_creator ON classes FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY classes_delete_creator ON classes FOR DELETE USING (auth.uid() = creator_id);

-- Class participants policies
CREATE POLICY class_participants_select ON class_participants FOR SELECT 
    USING (auth.uid() = user_id OR auth.uid() IN (SELECT creator_id FROM classes WHERE id = class_id));
CREATE POLICY class_participants_insert ON class_participants FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY class_participants_update ON class_participants FOR UPDATE 
    USING (auth.uid() = user_id);

-- Call requests policies
CREATE POLICY call_requests_select ON call_requests FOR SELECT 
    USING (auth.uid() IN (requester_id, target_id));
CREATE POLICY call_requests_insert ON call_requests FOR INSERT 
    WITH CHECK (auth.uid() = requester_id);
CREATE POLICY call_requests_update ON call_requests FOR UPDATE 
    USING (auth.uid() IN (requester_id, target_id));

-- Notifications policies
CREATE POLICY notifications_select_own ON notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY notifications_update_own ON notifications FOR UPDATE USING (auth.uid() = recipient_id);
CREATE POLICY notifications_delete_own ON notifications FOR DELETE USING (auth.uid() = recipient_id);

-- Notification preferences policies
CREATE POLICY notification_prefs_select_own ON notification_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY notification_prefs_insert_own ON notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY notification_prefs_update_own ON notification_preferences FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- STEP 9: CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to expire old call requests
CREATE OR REPLACE FUNCTION expire_old_call_requests()
RETURNS void AS $$
BEGIN
    UPDATE call_requests 
    SET status = 'expired' 
    WHERE status = 'pending' 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old notifications
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM notifications 
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND is_archived = TRUE;
    
    UPDATE notifications 
    SET is_archived = TRUE 
    WHERE created_at < NOW() - INTERVAL '7 days'
    AND is_read = TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 10: GRANT PERMISSIONS
-- =====================================================

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant permissions to service role
GRANT ALL ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

COMMIT;

-- =====================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- =====================================================

-- Run these queries to verify the migration:
/*
-- Check all tables have RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Check all foreign keys reference supabase_id
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- Check for any remaining firebase_uid references
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND column_name LIKE '%firebase%';
*/