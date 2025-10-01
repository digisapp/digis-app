-- Add indexes for improved performance
-- Run this migration to optimize database queries

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_creator ON users(is_creator);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Sessions table indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'creator_id') THEN
            CREATE INDEX IF NOT EXISTS idx_sessions_creator_id ON sessions(creator_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'status') THEN
            CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'type') THEN
            CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);
        END IF;
    END IF;
END $$;

-- Token transactions table indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'token_transactions') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'token_transactions' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'token_transactions' AND column_name = 'sender_id') THEN
            CREATE INDEX IF NOT EXISTS idx_token_transactions_sender_id ON token_transactions(sender_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'token_transactions' AND column_name = 'recipient_id') THEN
            CREATE INDEX IF NOT EXISTS idx_token_transactions_recipient_id ON token_transactions(recipient_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'token_transactions' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON token_transactions(created_at);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'token_transactions' AND column_name = 'type') THEN
            CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(type);
        END IF;
    END IF;
END $$;

-- Token balances table indexes
CREATE INDEX IF NOT EXISTS idx_token_balances_user_id ON token_balances(user_id);

-- Payments table indexes
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- Messages table indexes (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'sender_id') THEN
            CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'recipient_id') THEN
            CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'conversation_id') THEN
            CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
        END IF;
    END IF;
END $$;

-- Creator profiles table indexes (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'creator_profiles') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'creator_profiles' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_creator_profiles_user_id ON creator_profiles(user_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'creator_profiles' AND column_name = 'rating') THEN
            CREATE INDEX IF NOT EXISTS idx_creator_profiles_rating ON creator_profiles(rating);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'creator_profiles' AND column_name = 'total_earnings') THEN
            CREATE INDEX IF NOT EXISTS idx_creator_profiles_total_earnings ON creator_profiles(total_earnings);
        END IF;
    END IF;
END $$;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_creator_created ON sessions(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_created ON sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_created ON token_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user_created ON payments(user_id, created_at DESC);

-- Full text search indexes (if needed)
CREATE INDEX IF NOT EXISTS idx_users_search ON users USING gin(to_tsvector('english', coalesce(display_name, '') || ' ' || coalesce(username, '') || ' ' || coalesce(bio, '')));

-- Performance optimization for token balance lookups
CREATE INDEX IF NOT EXISTS idx_token_balances_user_balance ON token_balances(user_id, balance);

-- Index for finding active sessions
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(status) WHERE status IN ('active', 'in_progress');

-- Index for finding pending payments
CREATE INDEX IF NOT EXISTS idx_payments_pending ON payments(status) WHERE status = 'pending';

-- Add foreign key constraints if not exists
ALTER TABLE sessions 
  ADD CONSTRAINT fk_sessions_user_id 
  FOREIGN KEY (user_id) 
  REFERENCES users(id) 
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE sessions 
  ADD CONSTRAINT fk_sessions_creator_id 
  FOREIGN KEY (creator_id) 
  REFERENCES users(id) 
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE token_balances 
  ADD CONSTRAINT fk_token_balances_user_id 
  FOREIGN KEY (user_id) 
  REFERENCES users(id) 
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE token_transactions 
  ADD CONSTRAINT fk_token_transactions_user_id 
  FOREIGN KEY (user_id) 
  REFERENCES users(id) 
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE payments 
  ADD CONSTRAINT fk_payments_user_id 
  FOREIGN KEY (user_id) 
  REFERENCES users(id) 
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- Analyze tables to update statistics
ANALYZE users;
ANALYZE sessions;
ANALYZE token_transactions;
ANALYZE token_balances;
ANALYZE payments;

-- Show index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM 
    pg_stat_user_indexes
ORDER BY 
    idx_scan DESC;