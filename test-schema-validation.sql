-- ============================================
-- SCHEMA VALIDATION TEST SCRIPT FOR DIGIS
-- ============================================
-- This script validates that your database schema
-- is correctly set up with all required tables,
-- columns, constraints, and functions
-- 
-- Run this in your Supabase SQL editor after
-- applying both schema update scripts
-- ============================================

DO $$
DECLARE
  v_test_user_id UUID;
  v_test_balance INTEGER;
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_warnings TEXT[] := ARRAY[]::TEXT[];
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Starting DIGIS Schema Validation Tests';
  RAISE NOTICE '============================================';
  
  -- ============================================
  -- TEST 1: Check Required Tables
  -- ============================================
  RAISE NOTICE 'Test 1: Checking required tables...';
  
  -- Check users table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    v_errors := array_append(v_errors, '❌ Missing table: users');
  ELSE
    RAISE NOTICE '✅ Table exists: users';
  END IF;
  
  -- Check token_balances table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'token_balances') THEN
    v_errors := array_append(v_errors, '❌ Missing table: token_balances');
  ELSE
    RAISE NOTICE '✅ Table exists: token_balances';
  END IF;
  
  -- Check sessions table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions') THEN
    v_errors := array_append(v_errors, '❌ Missing table: sessions');
  ELSE
    RAISE NOTICE '✅ Table exists: sessions';
  END IF;
  
  -- Check token_transactions table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'token_transactions') THEN
    v_errors := array_append(v_errors, '❌ Missing table: token_transactions');
  ELSE
    RAISE NOTICE '✅ Table exists: token_transactions';
  END IF;
  
  -- Check virtual_gifts table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'virtual_gifts') THEN
    v_errors := array_append(v_errors, '❌ Missing table: virtual_gifts');
  ELSE
    RAISE NOTICE '✅ Table exists: virtual_gifts';
  END IF;
  
  -- ============================================
  -- TEST 2: Check Critical Columns
  -- ============================================
  RAISE NOTICE '';
  RAISE NOTICE 'Test 2: Checking critical columns...';
  
  -- Check users.supabase_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'supabase_id' 
                 AND data_type = 'uuid') THEN
    v_errors := array_append(v_errors, '❌ Missing or incorrect column: users.supabase_id (should be UUID)');
  ELSE
    RAISE NOTICE '✅ Column exists: users.supabase_id (UUID)';
  END IF;
  
  -- Check token_balances.supabase_user_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'token_balances' AND column_name = 'supabase_user_id' 
                 AND data_type = 'uuid') THEN
    v_errors := array_append(v_errors, '❌ Missing or incorrect column: token_balances.supabase_user_id (should be UUID)');
  ELSE
    RAISE NOTICE '✅ Column exists: token_balances.supabase_user_id (UUID)';
  END IF;
  
  -- ============================================
  -- TEST 3: Check Foreign Key Constraints
  -- ============================================
  RAISE NOTICE '';
  RAISE NOTICE 'Test 3: Checking foreign key constraints...';
  
  -- Check token_balances FK
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'fk_token_balances_supabase_user_id' 
                 AND table_name = 'token_balances') THEN
    v_warnings := array_append(v_warnings, '⚠️ Missing FK: token_balances.supabase_user_id -> users.supabase_id');
  ELSE
    RAISE NOTICE '✅ FK exists: token_balances -> users';
  END IF;
  
  -- Check sessions FK
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'fk_sessions_creator_id' 
                 AND table_name = 'sessions') THEN
    v_warnings := array_append(v_warnings, '⚠️ Missing FK: sessions.creator_id -> users.id');
  ELSE
    RAISE NOTICE '✅ FK exists: sessions -> users (creator)';
  END IF;
  
  -- ============================================
  -- TEST 4: Check Indexes
  -- ============================================
  RAISE NOTICE '';
  RAISE NOTICE 'Test 4: Checking performance indexes...';
  
  -- Check users supabase_id index
  IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                 WHERE tablename = 'users' 
                 AND indexname = 'idx_users_supabase_id') THEN
    v_warnings := array_append(v_warnings, '⚠️ Missing index: idx_users_supabase_id');
  ELSE
    RAISE NOTICE '✅ Index exists: idx_users_supabase_id';
  END IF;
  
  -- Check token_transactions composite index
  IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                 WHERE tablename = 'token_transactions' 
                 AND indexname = 'idx_token_transactions_user_created') THEN
    v_warnings := array_append(v_warnings, '⚠️ Missing index: idx_token_transactions_user_created');
  ELSE
    RAISE NOTICE '✅ Index exists: idx_token_transactions_user_created';
  END IF;
  
  -- ============================================
  -- TEST 5: Check Triggers
  -- ============================================
  RAISE NOTICE '';
  RAISE NOTICE 'Test 5: Checking auth sync triggers...';
  
  -- Check handle_new_user trigger
  IF NOT EXISTS (SELECT 1 FROM information_schema.triggers 
                 WHERE trigger_name = 'on_auth_user_created' 
                 AND event_object_table = 'users' 
                 AND event_object_schema = 'auth') THEN
    v_errors := array_append(v_errors, '❌ Missing trigger: on_auth_user_created');
  ELSE
    RAISE NOTICE '✅ Trigger exists: on_auth_user_created';
  END IF;
  
  -- ============================================
  -- TEST 6: Check Functions
  -- ============================================
  RAISE NOTICE '';
  RAISE NOTICE 'Test 6: Checking utility functions...';
  
  -- Check update_token_balance function
  IF NOT EXISTS (SELECT 1 FROM information_schema.routines 
                 WHERE routine_name = 'update_token_balance' 
                 AND routine_type = 'FUNCTION') THEN
    v_warnings := array_append(v_warnings, '⚠️ Missing function: update_token_balance');
  ELSE
    RAISE NOTICE '✅ Function exists: update_token_balance';
  END IF;
  
  -- ============================================
  -- TEST 7: Data Integrity Test
  -- ============================================
  RAISE NOTICE '';
  RAISE NOTICE 'Test 7: Testing data integrity...';
  
  BEGIN
    -- Create test user in auth.users (simulated)
    v_test_user_id := gen_random_uuid();
    
    -- Check if trigger would create public.users record
    INSERT INTO auth.users (id, email, created_at) 
    VALUES (v_test_user_id, 'test_' || v_test_user_id || '@example.com', now())
    ON CONFLICT (id) DO NOTHING;
    
    -- Wait for trigger
    PERFORM pg_sleep(0.1);
    
    -- Check if user was synced
    IF EXISTS (SELECT 1 FROM public.users WHERE supabase_id = v_test_user_id) THEN
      RAISE NOTICE '✅ User sync trigger working';
      
      -- Check if token balance was created
      IF EXISTS (SELECT 1 FROM public.token_balances WHERE supabase_user_id = v_test_user_id) THEN
        RAISE NOTICE '✅ Token balance auto-creation working';
      ELSE
        v_warnings := array_append(v_warnings, '⚠️ Token balance not auto-created for new user');
      END IF;
      
      -- Cleanup
      DELETE FROM public.token_balances WHERE supabase_user_id = v_test_user_id;
      DELETE FROM public.users WHERE supabase_id = v_test_user_id;
      DELETE FROM auth.users WHERE id = v_test_user_id;
    ELSE
      v_warnings := array_append(v_warnings, '⚠️ User sync trigger may not be working');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_warnings := array_append(v_warnings, '⚠️ Could not test user sync: ' || SQLERRM);
  END;
  
  -- ============================================
  -- TEST 8: Check Constraints
  -- ============================================
  RAISE NOTICE '';
  RAISE NOTICE 'Test 8: Checking data constraints...';
  
  -- Check chat message length constraint
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'chat_message_length') THEN
    v_warnings := array_append(v_warnings, '⚠️ Missing constraint: chat_message_length');
  ELSE
    RAISE NOTICE '✅ Constraint exists: chat_message_length';
  END IF;
  
  -- Check positive amount constraint
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'positive_amount') THEN
    v_warnings := array_append(v_warnings, '⚠️ Missing constraint: positive_amount on token_transactions');
  ELSE
    RAISE NOTICE '✅ Constraint exists: positive_amount';
  END IF;
  
  -- ============================================
  -- SUMMARY
  -- ============================================
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'VALIDATION SUMMARY';
  RAISE NOTICE '============================================';
  
  IF array_length(v_errors, 1) IS NULL OR array_length(v_errors, 1) = 0 THEN
    RAISE NOTICE '✅ All critical tests passed!';
  ELSE
    RAISE NOTICE '❌ Critical errors found:';
    FOR i IN 1..array_length(v_errors, 1) LOOP
      RAISE NOTICE '  %', v_errors[i];
    END LOOP;
  END IF;
  
  IF array_length(v_warnings, 1) IS NOT NULL AND array_length(v_warnings, 1) > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ Warnings (non-critical):';
    FOR i IN 1..array_length(v_warnings, 1) LOOP
      RAISE NOTICE '  %', v_warnings[i];
    END LOOP;
  END IF;
  
  -- ============================================
  -- RECOMMENDATIONS
  -- ============================================
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'RECOMMENDATIONS';
  RAISE NOTICE '============================================';
  RAISE NOTICE '1. Run supabase-complete-schema-update-fixed.sql first';
  RAISE NOTICE '2. Run supabase-schema-improvements.sql second';
  RAISE NOTICE '3. Run this validation script to verify';
  RAISE NOTICE '4. Check Supabase Dashboard for RLS policies';
  RAISE NOTICE '============================================';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Validation script error: %', SQLERRM;
END;
$$;