-- =====================================================
-- PRE-MIGRATION VALIDATION SCRIPT
-- =====================================================
-- Run this before executing the main migration to check for potential issues

-- Create a temporary function for validation reports
CREATE OR REPLACE FUNCTION validate_migration_readiness()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- Check 1: Verify users table exists
    RETURN QUERY
    SELECT 
        'Users table exists'::TEXT,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') 
             THEN 'PASS' ELSE 'FAIL' END,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
             THEN 'Users table found' ELSE 'Users table not found - critical error' END;

    -- Check 2: Check for firebase_uid column
    RETURN QUERY
    SELECT 
        'Firebase UID column check'::TEXT,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'users' AND column_name = 'firebase_uid') 
             THEN 'INFO' ELSE 'INFO' END,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'users' AND column_name = 'firebase_uid')
             THEN 'Firebase UID column exists - will be migrated' 
             ELSE 'Firebase UID column not found - may already be migrated' END;

    -- Check 3: Check for supabase_id column
    RETURN QUERY
    SELECT 
        'Supabase ID column check'::TEXT,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'users' AND column_name = 'supabase_id') 
             THEN 'INFO' ELSE 'WARNING' END,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'users' AND column_name = 'supabase_id')
             THEN 'Supabase ID column exists' 
             ELSE 'Supabase ID column will be created' END;

    -- Check 4: Check for duplicate migration files
    RETURN QUERY
    SELECT 
        'Duplicate classes tables'::TEXT,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'classes') 
             THEN 'WARNING' ELSE 'PASS' END,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'classes')
             THEN 'Classes table exists - will be dropped and recreated' 
             ELSE 'No existing classes table' END;

    -- Check 5: Check for null user IDs
    RETURN QUERY
    SELECT 
        'Null user IDs check'::TEXT,
        CASE WHEN EXISTS (SELECT 1 FROM users WHERE id IS NULL) 
             THEN 'FAIL' ELSE 'PASS' END,
        'Found ' || COALESCE((SELECT COUNT(*) FROM users WHERE id IS NULL)::TEXT, '0') || ' users with null IDs';

    -- Check 6: Check for orphaned foreign keys
    RETURN QUERY
    SELECT 
        'Orphaned token_balances'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM token_balances tb 
            LEFT JOIN users u ON tb.user_id::TEXT = u.firebase_uid OR tb.user_id::TEXT = u.id::TEXT
            WHERE u.id IS NULL
        ) THEN 'WARNING' ELSE 'PASS' END,
        'Found ' || COALESCE((
            SELECT COUNT(*) FROM token_balances tb 
            LEFT JOIN users u ON tb.user_id::TEXT = u.firebase_uid OR tb.user_id::TEXT = u.id::TEXT
            WHERE u.id IS NULL
        )::TEXT, '0') || ' orphaned token_balances records';

    -- Check 7: Check for RLS enabled on critical tables
    RETURN QUERY
    SELECT 
        'RLS status check'::TEXT,
        'INFO'::TEXT,
        'Tables with RLS enabled: ' || COALESCE((
            SELECT COUNT(*)::TEXT FROM pg_tables 
            WHERE schemaname = 'public' AND rowsecurity = true
        ), '0') || ' out of ' || (
            SELECT COUNT(*)::TEXT FROM pg_tables 
            WHERE schemaname = 'public'
        );

    -- Check 8: Check for existing partitioned tables
    RETURN QUERY
    SELECT 
        'Existing partitions'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'p' AND n.nspname = 'public'
        ) THEN 'INFO' ELSE 'INFO' END,
        'Found ' || COALESCE((
            SELECT COUNT(*)::TEXT FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'p' AND n.nspname = 'public'
        ), '0') || ' partitioned tables';

    -- Check 9: Check database size
    RETURN QUERY
    SELECT 
        'Database size'::TEXT,
        'INFO'::TEXT,
        'Current database size: ' || pg_size_pretty(pg_database_size(current_database()));

    -- Check 10: Check for active connections
    RETURN QUERY
    SELECT 
        'Active connections'::TEXT,
        CASE WHEN (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active' AND pid != pg_backend_pid()) > 10
             THEN 'WARNING' ELSE 'PASS' END,
        'Active connections: ' || (
            SELECT COUNT(*)::TEXT FROM pg_stat_activity 
            WHERE state = 'active' AND pid != pg_backend_pid()
        ) || ' (high activity may slow migration)';

    -- Check 11: Check for long-running transactions
    RETURN QUERY
    SELECT 
        'Long transactions'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM pg_stat_activity 
            WHERE state != 'idle' 
            AND query_start < NOW() - INTERVAL '5 minutes'
            AND pid != pg_backend_pid()
        ) THEN 'WARNING' ELSE 'PASS' END,
        'Found ' || COALESCE((
            SELECT COUNT(*)::TEXT FROM pg_stat_activity 
            WHERE state != 'idle' 
            AND query_start < NOW() - INTERVAL '5 minutes'
            AND pid != pg_backend_pid()
        ), '0') || ' transactions running > 5 minutes';

    -- Check 12: Estimate migration time based on table sizes
    RETURN QUERY
    SELECT 
        'Migration time estimate'::TEXT,
        'INFO'::TEXT,
        'Estimated time: ' || 
        CASE 
            WHEN (SELECT COUNT(*) FROM users) < 1000 THEN '< 1 minute'
            WHEN (SELECT COUNT(*) FROM users) < 10000 THEN '1-5 minutes'
            WHEN (SELECT COUNT(*) FROM users) < 100000 THEN '5-15 minutes'
            ELSE '> 15 minutes'
        END || ' (based on ' || (SELECT COUNT(*)::TEXT FROM users) || ' users)';

END;
$$ LANGUAGE plpgsql;

-- Run the validation
SELECT * FROM validate_migration_readiness() ORDER BY 
    CASE status 
        WHEN 'FAIL' THEN 1 
        WHEN 'WARNING' THEN 2 
        WHEN 'PASS' THEN 3 
        WHEN 'INFO' THEN 4 
    END;

-- Additional detailed checks

-- Check for tables that will be affected
CREATE OR REPLACE FUNCTION list_affected_tables()
RETURNS TABLE(
    table_name TEXT,
    has_firebase_uid BOOLEAN,
    has_supabase_id BOOLEAN,
    row_count BIGINT
) AS $$
BEGIN
    FOR table_name IN 
        SELECT t.table_name::TEXT 
        FROM information_schema.tables t
        WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
    LOOP
        has_firebase_uid := EXISTS (
            SELECT 1 FROM information_schema.columns c
            WHERE c.table_name = list_affected_tables.table_name 
            AND c.column_name LIKE '%firebase%'
        );
        
        has_supabase_id := EXISTS (
            SELECT 1 FROM information_schema.columns c
            WHERE c.table_name = list_affected_tables.table_name 
            AND c.column_name LIKE '%supabase%'
        );
        
        EXECUTE format('SELECT COUNT(*) FROM %I', list_affected_tables.table_name) 
        INTO row_count;
        
        IF has_firebase_uid OR has_supabase_id THEN
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- List affected tables
SELECT * FROM list_affected_tables() ORDER BY row_count DESC;

-- Check for potential data loss scenarios
CREATE OR REPLACE FUNCTION check_data_integrity()
RETURNS TABLE(
    issue_type TEXT,
    table_name TEXT,
    issue_count BIGINT,
    severity TEXT
) AS $$
BEGIN
    -- Check for duplicate firebase_uids
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'firebase_uid') THEN
        RETURN QUERY
        SELECT 
            'Duplicate firebase_uid'::TEXT,
            'users'::TEXT,
            COUNT(*)::BIGINT,
            'HIGH'::TEXT
        FROM (
            SELECT firebase_uid 
            FROM users 
            WHERE firebase_uid IS NOT NULL
            GROUP BY firebase_uid 
            HAVING COUNT(*) > 1
        ) dupes;
    END IF;

    -- Check for users without email
    RETURN QUERY
    SELECT 
        'Users without email'::TEXT,
        'users'::TEXT,
        COUNT(*)::BIGINT,
        CASE WHEN COUNT(*) > 0 THEN 'MEDIUM' ELSE 'LOW' END::TEXT
    FROM users 
    WHERE email IS NULL OR email = '';

    -- Check for orphaned sessions
    RETURN QUERY
    SELECT 
        'Orphaned sessions'::TEXT,
        'sessions'::TEXT,
        COUNT(*)::BIGINT,
        CASE WHEN COUNT(*) > 0 THEN 'MEDIUM' ELSE 'LOW' END::TEXT
    FROM sessions s
    LEFT JOIN users u1 ON s.creator_id = u1.id
    LEFT JOIN users u2 ON s.fan_id = u2.id
    WHERE u1.id IS NULL OR u2.id IS NULL;

    -- Check for orphaned token transactions
    RETURN QUERY
    SELECT 
        'Orphaned token transactions'::TEXT,
        'token_transactions'::TEXT,
        COUNT(*)::BIGINT,
        CASE WHEN COUNT(*) > 0 THEN 'HIGH' ELSE 'LOW' END::TEXT
    FROM token_transactions tt
    LEFT JOIN users u ON tt.user_id::TEXT = u.id::TEXT OR tt.user_id::TEXT = u.firebase_uid
    WHERE u.id IS NULL;

END;
$$ LANGUAGE plpgsql;

-- Run integrity checks
SELECT * FROM check_data_integrity() WHERE issue_count > 0 ORDER BY 
    CASE severity 
        WHEN 'HIGH' THEN 1 
        WHEN 'MEDIUM' THEN 2 
        WHEN 'LOW' THEN 3 
    END;

-- Summary recommendation
CREATE OR REPLACE FUNCTION migration_recommendation()
RETURNS TEXT AS $$
DECLARE
    fail_count INTEGER;
    warning_count INTEGER;
    recommendation TEXT;
BEGIN
    SELECT COUNT(*) INTO fail_count 
    FROM validate_migration_readiness() 
    WHERE status = 'FAIL';
    
    SELECT COUNT(*) INTO warning_count 
    FROM validate_migration_readiness() 
    WHERE status = 'WARNING';
    
    IF fail_count > 0 THEN
        recommendation := 'DO NOT PROCEED - Critical issues found. Fix FAIL items before migration.';
    ELSIF warning_count > 5 THEN
        recommendation := 'PROCEED WITH CAUTION - Many warnings found. Review and address if needed.';
    ELSIF warning_count > 0 THEN
        recommendation := 'SAFE TO PROCEED - Minor warnings found. Migration should complete successfully.';
    ELSE
        recommendation := 'SAFE TO PROCEED - All checks passed. Migration ready.';
    END IF;
    
    RETURN recommendation || E'\n\nAlways backup your database before proceeding!';
END;
$$ LANGUAGE plpgsql;

-- Get final recommendation
SELECT migration_recommendation();

-- Cleanup
DROP FUNCTION IF EXISTS validate_migration_readiness();
DROP FUNCTION IF EXISTS list_affected_tables();
DROP FUNCTION IF EXISTS check_data_integrity();
DROP FUNCTION IF EXISTS migration_recommendation();