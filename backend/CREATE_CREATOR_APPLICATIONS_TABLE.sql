-- Create creator_applications table if it doesn't exist
CREATE TABLE IF NOT EXISTS creator_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(supabase_id),
    display_name VARCHAR(255),
    email VARCHAR(255),
    username VARCHAR(100),
    phone_number VARCHAR(20),
    location VARCHAR(255),
    specialty VARCHAR(100),
    bio TEXT,
    social_links JSONB,
    portfolio_url TEXT,
    experience_years INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_creator_applications_user_id ON creator_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_applications_status ON creator_applications(status);
CREATE INDEX IF NOT EXISTS idx_creator_applications_created_at ON creator_applications(created_at);

-- Also fix the missing column in streams table
ALTER TABLE streams ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;

-- Ensure the column exists in subscription_tiers
ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;
