-- Initial database schema for Digis platform
-- Creates core tables for users, sessions, tokens, and payments

-- Users table - stores user profiles and creator information
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    display_name VARCHAR(255),
    is_creator BOOLEAN DEFAULT FALSE,
    is_super_admin BOOLEAN DEFAULT FALSE,
    bio TEXT DEFAULT '',
    profile_pic_url TEXT DEFAULT '',
    price_per_min DECIMAL(10,2) DEFAULT 1.00,
    total_sessions INTEGER DEFAULT 0,
    total_earnings DECIMAL(15,2) DEFAULT 0.00,
    total_spent DECIMAL(15,2) DEFAULT 0.00,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_price_per_min_positive CHECK (price_per_min >= 0),
    CONSTRAINT chk_total_sessions_positive CHECK (total_sessions >= 0),
    CONSTRAINT chk_total_earnings_positive CHECK (total_earnings >= 0),
    CONSTRAINT chk_total_spent_positive CHECK (total_spent >= 0)
);

-- Sessions table - stores video/voice call sessions
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_uid VARCHAR(255) UNIQUE NOT NULL,
    creator_id INTEGER NOT NULL,
    fan_id INTEGER NOT NULL,
    type VARCHAR(50) DEFAULT 'video', -- 'video', 'voice', 'stream'
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'ended', 'cancelled'
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER DEFAULT 0,
    rate_per_min DECIMAL(10,2) DEFAULT 1.00,
    total_cost DECIMAL(15,2) DEFAULT 0.00,
    agora_channel VARCHAR(255),
    agora_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign keys
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (fan_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT chk_duration_positive CHECK (duration_minutes >= 0),
    CONSTRAINT chk_rate_positive CHECK (rate_per_min >= 0),
    CONSTRAINT chk_total_cost_positive CHECK (total_cost >= 0),
    CONSTRAINT chk_end_time_after_start CHECK (end_time IS NULL OR end_time >= start_time)
);

-- Token balances table - stores user token balances
CREATE TABLE IF NOT EXISTS token_balances (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    balance DECIMAL(15,2) DEFAULT 0.00,
    total_purchased DECIMAL(15,2) DEFAULT 0.00,
    total_spent DECIMAL(15,2) DEFAULT 0.00,
    total_earned DECIMAL(15,2) DEFAULT 0.00,
    last_transaction_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key to users table
    FOREIGN KEY (user_id) REFERENCES users(firebase_uid) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT chk_balance_non_negative CHECK (balance >= 0),
    CONSTRAINT chk_total_purchased_positive CHECK (total_purchased >= 0),
    CONSTRAINT chk_total_spent_positive CHECK (total_spent >= 0),
    CONSTRAINT chk_total_earned_positive CHECK (total_earned >= 0)
);

-- Token transactions table - logs all token movements
CREATE TABLE IF NOT EXISTS token_transactions (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'purchase', 'spend', 'earn', 'tip', 'refund'
    amount DECIMAL(15,2) NOT NULL,
    balance_before DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,
    session_id INTEGER,
    payment_id VARCHAR(255), -- Stripe payment ID
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(firebase_uid) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT chk_amount_not_zero CHECK (amount != 0),
    CONSTRAINT chk_balance_before_positive CHECK (balance_before >= 0),
    CONSTRAINT chk_balance_after_positive CHECK (balance_after >= 0)
);

-- Payments table - stores Stripe payment information
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    payment_id VARCHAR(255) UNIQUE NOT NULL, -- Stripe payment intent ID
    user_id VARCHAR(255) NOT NULL,
    session_id INTEGER,
    amount_usd DECIMAL(10,2) NOT NULL,
    tokens_amount DECIMAL(15,2) NOT NULL,
    stripe_payment_intent_id VARCHAR(255),
    stripe_client_secret VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
    payment_method VARCHAR(100), -- 'card', 'paypal', etc.
    currency VARCHAR(3) DEFAULT 'USD',
    metadata JSONB DEFAULT '{}',
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(firebase_uid) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT chk_amount_usd_positive CHECK (amount_usd > 0),
    CONSTRAINT chk_tokens_amount_positive CHECK (tokens_amount > 0)
);

-- Creator subscriptions table
CREATE TABLE IF NOT EXISTS creator_subscriptions (
    id SERIAL PRIMARY KEY,
    subscriber_id VARCHAR(255) NOT NULL,
    creator_id INTEGER NOT NULL,
    tier_name VARCHAR(100) DEFAULT 'basic',
    monthly_price DECIMAL(10,2) NOT NULL,
    tokens_per_month DECIMAL(15,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'cancelled', 'expired'
    current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE,
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign keys
    FOREIGN KEY (subscriber_id) REFERENCES users(firebase_uid) ON DELETE CASCADE,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT chk_monthly_price_positive CHECK (monthly_price > 0),
    CONSTRAINT chk_tokens_per_month_positive CHECK (tokens_per_month >= 0),
    
    -- Unique constraint to prevent duplicate subscriptions
    UNIQUE (subscriber_id, creator_id, tier_name)
);

-- Followers table for social features
CREATE TABLE IF NOT EXISTS followers (
    id SERIAL PRIMARY KEY,
    follower_id VARCHAR(255) NOT NULL,
    creator_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign keys
    FOREIGN KEY (follower_id) REFERENCES users(firebase_uid) ON DELETE CASCADE,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Unique constraint to prevent duplicate follows
    UNIQUE (follower_id, creator_id)
);

-- Tips table for one-time donations
CREATE TABLE IF NOT EXISTS tips (
    id SERIAL PRIMARY KEY,
    tip_id VARCHAR(255) UNIQUE NOT NULL,
    tipper_id VARCHAR(255) NOT NULL,
    creator_id INTEGER NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    message TEXT DEFAULT '',
    session_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign keys
    FOREIGN KEY (tipper_id) REFERENCES users(firebase_uid) ON DELETE CASCADE,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT chk_tip_amount_positive CHECK (amount > 0)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_creator ON users(is_creator);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_sessions_creator_id ON sessions(creator_id);
CREATE INDEX IF NOT EXISTS idx_sessions_fan_id ON sessions(fan_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_agora_channel ON sessions(agora_channel);

CREATE INDEX IF NOT EXISTS idx_token_balances_user_id ON token_balances(user_id);

CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(type);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON token_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_token_transactions_session_id ON token_transactions(session_id);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

CREATE INDEX IF NOT EXISTS idx_creator_subscriptions_subscriber_id ON creator_subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_creator_subscriptions_creator_id ON creator_subscriptions(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_subscriptions_status ON creator_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_creator_id ON followers(creator_id);

CREATE INDEX IF NOT EXISTS idx_tips_tipper_id ON tips(tipper_id);
CREATE INDEX IF NOT EXISTS idx_tips_creator_id ON tips(creator_id);
CREATE INDEX IF NOT EXISTS idx_tips_created_at ON tips(created_at);

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at 
    BEFORE UPDATE ON sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_token_balances_updated_at 
    BEFORE UPDATE ON token_balances 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at 
    BEFORE UPDATE ON payments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_creator_subscriptions_updated_at 
    BEFORE UPDATE ON creator_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add table comments for documentation
COMMENT ON TABLE users IS 'User profiles and creator accounts';
COMMENT ON TABLE sessions IS 'Video/voice call sessions between creators and members';
COMMENT ON TABLE token_balances IS 'User token balances for the creator economy';
COMMENT ON TABLE token_transactions IS 'Log of all token movements and transactions';
COMMENT ON TABLE payments IS 'Stripe payment records for token purchases';
COMMENT ON TABLE creator_subscriptions IS 'Monthly subscriptions to creators';
COMMENT ON TABLE followers IS 'Social following relationships';
COMMENT ON TABLE tips IS 'One-time token tips to creators';