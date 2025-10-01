-- CHECK DATABASE STRUCTURE
-- Run this FIRST to see what columns exist in your tables

-- Check follows table structure
SELECT 
    'FOLLOWS TABLE COLUMNS:' as info,
    string_agg(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_name = 'follows'
GROUP BY table_name

UNION ALL

-- Check subscriptions table structure  
SELECT 
    'SUBSCRIPTIONS TABLE COLUMNS:' as info,
    string_agg(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_name = 'subscriptions'
GROUP BY table_name

UNION ALL

-- Check notifications table structure
SELECT 
    'NOTIFICATIONS TABLE COLUMNS:' as info,
    string_agg(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_name = 'notifications'
GROUP BY table_name

UNION ALL

-- Check users table for specific columns
SELECT 
    'USERS TABLE KEY COLUMNS:' as info,
    string_agg(column_name, ', ' ORDER BY column_name) as columns
FROM information_schema.columns
WHERE table_name = 'users' 
AND column_name IN ('id', 'email', 'username', 'display_name', 'token_balance', 'is_creator', 'is_admin', 'is_super_admin', 'last_active', 'last_active_at', 'profile_pic_url', 'supabase_id')
GROUP BY table_name;

-- List all tables
SELECT 
    'ALL TABLES IN DATABASE:' as info,
    string_agg(table_name, ', ' ORDER BY table_name) as tables
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE';