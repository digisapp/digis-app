-- =====================================================
-- ROLLBACK SCRIPT FOR SUPABASE MIGRATION
-- =====================================================
-- USE WITH EXTREME CAUTION - This will undo the Supabase migration
-- Make sure you have a complete backup before running this

BEGIN;

-- =====================================================
-- STEP 1: DISABLE RLS ON ALL TABLES
-- =====================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND rowsecurity = true
    LOOP
        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;
END $$;

-- =====================================================
-- STEP 2: DROP ALL RLS POLICIES
-- =====================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- =====================================================
-- STEP 3: RESTORE PARTITIONED TABLES TO NON-PARTITIONED
-- =====================================================

-- Restore token_transactions
CREATE TABLE token_transactions_restore AS 
SELECT * FROM token_transactions;

DROP TABLE token_transactions CASCADE;

CREATE TABLE token_transactions (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    balance_before DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,
    session_id INTEGER,
    payment_id VARCHAR(255),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO token_transactions 
SELECT * FROM token_transactions_restore;

DROP TABLE token_transactions_restore;

-- Restore stream_messages
CREATE TABLE stream_messages_restore AS 
SELECT * FROM stream_messages;

DROP TABLE stream_messages CASCADE;

CREATE TABLE stream_messages (
    id SERIAL PRIMARY KEY,
    message_id UUID UNIQUE DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL,
    sender_id INTEGER NOT NULL,
    content TEXT,
    message_type VARCHAR(20) DEFAULT 'text',
    tip_id VARCHAR(255),
    gift_sent_id UUID,
    is_highlighted BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO stream_messages 
SELECT * FROM stream_messages_restore;

DROP TABLE stream_messages_restore;

-- Restore memberships
CREATE TABLE memberships_restore AS 
SELECT * FROM memberships;

DROP TABLE memberships CASCADE;

CREATE TABLE memberships (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    tier_id INTEGER NOT NULL,
    creator_id INTEGER NOT NULL,
    price_paid DECIMAL(10,2),
    payment_method VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    next_billing_date TIMESTAMP WITH TIME ZONE,
    tokens_remaining INTEGER DEFAULT 0,
    cancellation_reason TEXT,
    upgraded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO memberships 
SELECT * FROM memberships_restore;

DROP TABLE memberships_restore;

-- Restore content_views
CREATE TABLE content_views_restore AS 
SELECT * FROM content_views;

DROP TABLE content_views CASCADE;

CREATE TABLE content_views (
    id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER,
    content_id VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO content_views 
SELECT * FROM content_views_restore;

DROP TABLE content_views_restore;

-- Restore analytics_events
CREATE TABLE analytics_events_restore AS 
SELECT * FROM analytics_events;

DROP TABLE analytics_events CASCADE;

CREATE TABLE analytics_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255),
    creator_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(100),
    event_action VARCHAR(100),
    event_label VARCHAR(255),
    event_value DECIMAL(10,2),
    properties JSONB DEFAULT '{}',
    session_id VARCHAR(255),
    device_info JSONB DEFAULT '{}',
    location_info JSONB DEFAULT '{}',
    referrer_info JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO analytics_events 
SELECT * FROM analytics_events_restore;

DROP TABLE analytics_events_restore;

-- =====================================================
-- STEP 4: RESTORE FIREBASE_UID AND ORIGINAL STRUCTURE
-- =====================================================

-- Add firebase_uid back to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(255) UNIQUE;

-- If we have supabase_id values, try to restore firebase_uid from them
-- (This assumes you saved a mapping somewhere - if not, you'll need to restore from backup)
UPDATE users 
SET firebase_uid = 'fb_' || substr(supabase_id::text, 1, 28) 
WHERE firebase_uid IS NULL AND supabase_id IS NOT NULL;

-- Restore original foreign key relationships
ALTER TABLE token_balances 
ADD COLUMN IF NOT EXISTS user_id_old VARCHAR(255);

UPDATE token_balances 
SET user_id_old = u.firebase_uid 
FROM users u 
WHERE token_balances.user_id = u.supabase_id;

ALTER TABLE token_balances 
DROP COLUMN user_id CASCADE;

ALTER TABLE token_balances 
RENAME COLUMN user_id_old TO user_id;

-- Repeat for token_transactions
ALTER TABLE token_transactions 
ADD COLUMN IF NOT EXISTS user_id_old VARCHAR(255);

UPDATE token_transactions 
SET user_id_old = u.firebase_uid 
FROM users u 
WHERE token_transactions.user_id::uuid = u.supabase_id;

ALTER TABLE token_transactions 
DROP COLUMN user_id CASCADE;

ALTER TABLE token_transactions 
RENAME COLUMN user_id_old TO user_id;

-- =====================================================
-- STEP 5: DROP NEW TABLES CREATED IN MIGRATION
-- =====================================================

DROP TABLE IF EXISTS call_requests CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS notification_preferences CASCADE;
DROP TABLE IF EXISTS class_reviews CASCADE;
DROP TABLE IF EXISTS class_participants CASCADE;
DROP TABLE IF EXISTS classes CASCADE;

-- =====================================================
-- STEP 6: RESTORE ORIGINAL CONSTRAINTS
-- =====================================================

-- Re-add original foreign key constraints
ALTER TABLE token_balances 
ADD CONSTRAINT token_balances_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(firebase_uid);

ALTER TABLE token_transactions 
ADD CONSTRAINT token_transactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(firebase_uid);

ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS creator_id_old INTEGER,
ADD COLUMN IF NOT EXISTS fan_id_old INTEGER;

UPDATE sessions s
SET creator_id_old = u1.id::INTEGER,
    fan_id_old = u2.id::INTEGER
FROM users u1, users u2
WHERE s.creator_id = u1.supabase_id 
AND s.fan_id = u2.supabase_id;

ALTER TABLE sessions 
DROP COLUMN creator_id CASCADE,
DROP COLUMN fan_id CASCADE;

ALTER TABLE sessions 
RENAME COLUMN creator_id_old TO creator_id;
ALTER TABLE sessions 
RENAME COLUMN fan_id_old TO fan_id;

-- =====================================================
-- STEP 7: RESTORE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_token_balances_user_id ON token_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_creator_id ON sessions(creator_id);
CREATE INDEX IF NOT EXISTS idx_sessions_fan_id ON sessions(fan_id);

-- =====================================================
-- STEP 8: DROP SUPABASE-SPECIFIC COLUMNS (OPTIONAL)
-- =====================================================

-- Only do this if you're completely abandoning Supabase
-- ALTER TABLE users DROP COLUMN IF EXISTS supabase_id CASCADE;
-- ALTER TABLE users DROP COLUMN IF EXISTS supabase_user_id CASCADE;
-- ALTER TABLE users DROP COLUMN IF EXISTS raw_user_meta_data CASCADE;
-- ALTER TABLE users DROP COLUMN IF EXISTS raw_app_meta_data CASCADE;

-- =====================================================
-- STEP 9: RECREATE MIGRATION TRACKING TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS migrations (
    version INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP DEFAULT NOW()
);

-- Mark that we've rolled back
INSERT INTO migrations (version, name, executed_at) 
VALUES (-1, 'ROLLBACK_EXECUTED', NOW());

COMMIT;

-- =====================================================
-- POST-ROLLBACK VERIFICATION
-- =====================================================

-- Check rollback status
SELECT 
    'Tables with firebase_uid' as check_type,
    COUNT(*) as count
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND column_name = 'firebase_uid'

UNION ALL

SELECT 
    'Tables with supabase_id' as check_type,
    COUNT(*) as count
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND column_name = 'supabase_id'

UNION ALL

SELECT 
    'Tables with RLS enabled' as check_type,
    COUNT(*) as count
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true

UNION ALL

SELECT 
    'Active RLS policies' as check_type,
    COUNT(*) as count
FROM pg_policies 
WHERE schemaname = 'public';

-- =====================================================
-- IMPORTANT NOTES
-- =====================================================
/*
1. This rollback script attempts to reverse the migration, but data loss is possible
2. Always test on a copy of your database first
3. Some data relationships may not be perfectly restored
4. You may need to restore from a backup for complete data integrity
5. This script assumes you haven't deleted the original data

If the rollback fails:
1. Stop immediately
2. Restore from your backup
3. Do not attempt to fix manually without understanding the implications

After successful rollback:
1. Verify all application functionality
2. Check data integrity
3. Update your application code to work with the old schema
4. Document what went wrong for future migration attempts
*/