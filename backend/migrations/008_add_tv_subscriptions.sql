-- Create table for Digis TV subscriptions
CREATE TABLE IF NOT EXISTS tv_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    subscription_type VARCHAR(50) NOT NULL DEFAULT 'monthly', -- 'trial' or 'monthly'
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'expired', 'cancelled'
    start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    token_amount INTEGER DEFAULT 1000,
    auto_renew BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_tv_subscriptions_user_id ON tv_subscriptions(user_id);
CREATE INDEX idx_tv_subscriptions_status ON tv_subscriptions(status);
CREATE INDEX idx_tv_subscriptions_end_date ON tv_subscriptions(end_date);

-- Create function to check if subscription is active
CREATE OR REPLACE FUNCTION is_tv_subscription_active(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM tv_subscriptions 
        WHERE user_id = p_user_id 
        AND status = 'active' 
        AND end_date > NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to get days remaining in trial
CREATE OR REPLACE FUNCTION get_tv_trial_days_remaining(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    days_remaining INTEGER;
BEGIN
    SELECT GREATEST(0, EXTRACT(DAY FROM (end_date - NOW()))::INTEGER)
    INTO days_remaining
    FROM tv_subscriptions
    WHERE user_id = p_user_id
    AND subscription_type = 'trial'
    AND status = 'active'
    LIMIT 1;
    
    RETURN COALESCE(days_remaining, 0);
END;
$$ LANGUAGE plpgsql;

-- Add column to users table to track if trial has been used
ALTER TABLE users ADD COLUMN IF NOT EXISTS tv_trial_used BOOLEAN DEFAULT false;

-- Create table for subscription transactions
CREATE TABLE IF NOT EXISTS tv_subscription_transactions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    subscription_id INTEGER REFERENCES tv_subscriptions(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- 'purchase', 'renewal', 'refund'
    status VARCHAR(50) NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE tv_subscriptions IS 'Stores Digis TV subscription information';
COMMENT ON COLUMN tv_subscriptions.subscription_type IS 'Type of subscription: trial or monthly';
COMMENT ON COLUMN tv_subscriptions.status IS 'Current status: active, expired, or cancelled';
COMMENT ON COLUMN tv_subscriptions.token_amount IS 'Number of tokens charged for subscription';