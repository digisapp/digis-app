-- Enhanced Schema Constraints and Indexes for DIGIS Platform
-- This migration adds comprehensive constraints, indexes, and data integrity rules

-- ========================================
-- 1. USERS TABLE ENHANCEMENTS
-- ========================================

-- Add check constraints for data integrity
DO $$
BEGIN
    -- Check if price_per_min column exists before adding constraint
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'price_per_min') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_price_per_min') THEN
            ALTER TABLE users ADD CONSTRAINT chk_price_per_min CHECK (price_per_min >= 0 AND price_per_min <= 1000);
        END IF;
    END IF;
    
    -- Add other constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_total_sessions') THEN
        ALTER TABLE users ADD CONSTRAINT chk_total_sessions CHECK (total_sessions >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_total_earnings') THEN
        ALTER TABLE users ADD CONSTRAINT chk_total_earnings CHECK (total_earnings >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_total_spent') THEN
        ALTER TABLE users ADD CONSTRAINT chk_total_spent CHECK (total_spent >= 0);
    END IF;
END $$;

-- Add unique constraint on supabase_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unq_users_supabase_id'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT unq_users_supabase_id UNIQUE (supabase_id);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);
CREATE INDEX IF NOT EXISTS idx_users_is_creator ON users(is_creator) WHERE is_creator = true;
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_bio_search ON users USING gin(to_tsvector('english', bio));

-- ========================================
-- 2. SESSIONS TABLE ENHANCEMENTS
-- ========================================

-- Add check constraints
ALTER TABLE sessions
ADD CONSTRAINT chk_session_type CHECK (type IN ('video', 'voice', 'stream', 'chat')),
ADD CONSTRAINT chk_session_status CHECK (status IN ('active', 'completed', 'cancelled', 'failed')),
ADD CONSTRAINT chk_session_dates CHECK (start_time <= COALESCE(end_time, start_time + INTERVAL '24 hours'));

-- Add foreign key constraints with proper cascading
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_sessions_creator'
  ) THEN
    ALTER TABLE sessions 
    ADD CONSTRAINT fk_sessions_creator 
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_sessions_member'
  ) THEN
    ALTER TABLE sessions 
    ADD CONSTRAINT fk_sessions_member 
    FOREIGN KEY (fan_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_creator_id ON sessions(creator_id);
CREATE INDEX IF NOT EXISTS idx_sessions_fan_id ON sessions(fan_id);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_end_time ON sessions(end_time) WHERE end_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(creator_id, fan_id) WHERE end_time IS NULL;

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_user_lookup ON sessions(creator_id, fan_id, start_time DESC);

-- ========================================
-- 3. PAYMENTS TABLE ENHANCEMENTS
-- ========================================

-- Add check constraints
ALTER TABLE payments
ADD CONSTRAINT chk_payment_amount CHECK (amount >= 0),
ADD CONSTRAINT chk_payment_tip CHECK (tip >= 0),
ADD CONSTRAINT chk_payment_status CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled'));

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_payments_session'
  ) THEN
    ALTER TABLE payments 
    ADD CONSTRAINT fk_payments_session 
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_session_id ON payments(session_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_id ON payments(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

-- ========================================
-- 4. TOKEN_BALANCES TABLE (if exists)
-- ========================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'token_balances'
  ) THEN
    -- Add constraints
    ALTER TABLE token_balances
    ADD CONSTRAINT chk_token_balance CHECK (balance >= 0);
    
    -- Add indexes
    CREATE INDEX IF NOT EXISTS idx_token_balances_user_id ON token_balances(user_id);
    CREATE INDEX IF NOT EXISTS idx_token_balances_updated_at ON token_balances(updated_at DESC);
  END IF;
END $$;

-- ========================================
-- 5. TOKEN_TRANSACTIONS TABLE (if exists)
-- ========================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'token_transactions'
  ) THEN
    -- Add constraints
    ALTER TABLE token_transactions
    ADD CONSTRAINT chk_token_amount CHECK (tokens != 0),
    ADD CONSTRAINT chk_transaction_type CHECK (type IN ('purchase', 'earning', 'spend', 'refund', 'tip'));
    
    -- Add indexes
    CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON token_transactions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(type);
    
    -- Composite index for user transaction history
    CREATE INDEX IF NOT EXISTS idx_token_transactions_user_history ON token_transactions(user_id, created_at DESC);
  END IF;
END $$;

-- ========================================
-- 6. AUTOMATIC TIMESTAMP TRIGGERS
-- ========================================

-- Create function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to all tables with updated_at columns
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE column_name = 'updated_at' 
    AND table_schema = 'public'
  LOOP
    EXECUTE format('
      CREATE TRIGGER update_%I_updated_at 
      BEFORE UPDATE ON %I 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column()',
      t.table_name, t.table_name
    );
  END LOOP;
END $$;

-- ========================================
-- 7. MATERIALIZED VIEWS FOR PERFORMANCE
-- ========================================

-- Creator statistics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS creator_stats AS
SELECT 
  u.id as creator_id,
  u.supabase_id,
  COUNT(DISTINCT s.id) as total_sessions,
  COUNT(DISTINCT s.fan_id) as unique_members,
  COALESCE(SUM(p.amount), 0) as total_earnings,
  COALESCE(AVG(p.amount), 0) as avg_session_earnings,
  MAX(s.start_time) as last_session_date
FROM users u
LEFT JOIN sessions s ON u.id = s.creator_id AND s.end_time IS NOT NULL
LEFT JOIN payments p ON s.id = p.session_id AND p.status = 'completed'
WHERE u.is_creator = true
GROUP BY u.id, u.supabase_id;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_stats_creator_id ON creator_stats(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_stats_total_earnings ON creator_stats(total_earnings DESC);

-- ========================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================

-- Enable RLS on tables (if using Supabase Auth)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (adjust based on your auth setup)
CREATE POLICY users_select_policy ON users
  FOR SELECT USING (true); -- Public can view users

CREATE POLICY users_update_policy ON users
  FOR UPDATE USING (auth.uid()::text = supabase_id); -- Users can update their own profile

CREATE POLICY sessions_select_policy ON sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.supabase_id = auth.uid()::text 
      AND (users.id = sessions.creator_id OR users.id = sessions.fan_id)
    )
  ); -- Users can view their own sessions

-- ========================================
-- 9. PERFORMANCE OPTIMIZATION SETTINGS
-- ========================================

-- Analyze tables for query optimization
ANALYZE users;
ANALYZE sessions;
ANALYZE payments;

-- Update table statistics
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ANALYZE %I', t.tablename);
  END LOOP;
END $$;

-- ========================================
-- 10. MONITORING AND MAINTENANCE
-- ========================================

-- Create a function to check table health
CREATE OR REPLACE FUNCTION check_table_health()
RETURNS TABLE (
  table_name text,
  row_count bigint,
  table_size text,
  index_size text,
  total_size text,
  last_vacuum timestamp,
  last_analyze timestamp
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    schemaname||'.'||tablename as table_name,
    n_live_tup as row_count,
    pg_size_pretty(pg_table_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    last_vacuum,
    last_analyze
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 11. BACKUP AND RECOVERY HELPERS
-- ========================================

-- Create a function to export critical data
CREATE OR REPLACE FUNCTION export_critical_data()
RETURNS TABLE (
  export_type text,
  record_count bigint,
  export_date timestamp
) AS $$
BEGIN
  -- This is a placeholder for backup logic
  -- In production, you'd implement actual backup procedures
  RETURN QUERY
  SELECT 'users' as export_type, COUNT(*) as record_count, NOW() as export_date FROM users
  UNION ALL
  SELECT 'sessions', COUNT(*), NOW() FROM sessions
  UNION ALL
  SELECT 'payments', COUNT(*), NOW() FROM payments;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 12. GRANT NECESSARY PERMISSIONS
-- ========================================

-- Grant permissions to application user (adjust username as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_app_user;

-- ========================================
-- Migration completed successfully
-- ========================================