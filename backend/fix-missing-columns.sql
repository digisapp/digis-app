-- Fix missing columns in database tables

-- Add missing columns to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10,2) DEFAULT 0;

-- Add missing columns to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT 0;

-- Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_rate DECIMAL(10,2) DEFAULT 0;

-- Create subscription_tiers table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscription_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tier_name VARCHAR(100) NOT NULL,
    tier_level INTEGER DEFAULT 1,
    price DECIMAL(10,2) DEFAULT 0,
    video_call_price DECIMAL(10,2) DEFAULT 0,
    voice_call_price DECIMAL(10,2) DEFAULT 0,
    text_message_price DECIMAL(10,2) DEFAULT 0,
    benefits TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on creator_id for better performance
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_creator_id ON subscription_tiers(creator_id);

-- Add video_call_price to subscription_tiers if it doesn't exist
ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS video_call_price DECIMAL(10,2) DEFAULT 0;

-- Update any null values to defaults
UPDATE sessions SET total_cost = 0 WHERE total_cost IS NULL;
UPDATE payments SET total_amount = amount_cents / 100.0 WHERE total_amount IS NULL AND amount_cents IS NOT NULL;
UPDATE users SET creator_rate = 100 WHERE creator_rate IS NULL AND is_creator = true;