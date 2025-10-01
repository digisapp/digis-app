-- Create creator applications table for tracking creator registration requests
CREATE TABLE IF NOT EXISTS creator_applications (
    id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER,
    supabase_user_id UUID,
    firebase_user_id VARCHAR(255),
    application_reason TEXT NOT NULL,
    content_types JSONB DEFAULT '[]',
    social_media_links JSONB DEFAULT '{}',
    portfolio_url TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'under_review'
    reviewed_by VARCHAR(255),
    review_notes TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (supabase_user_id) REFERENCES users(supabase_id) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT chk_status CHECK (status IN ('pending', 'approved', 'rejected', 'under_review'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_creator_applications_user_id ON creator_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_applications_supabase_user_id ON creator_applications(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_creator_applications_firebase_user_id ON creator_applications(firebase_user_id);
CREATE INDEX IF NOT EXISTS idx_creator_applications_status ON creator_applications(status);
CREATE INDEX IF NOT EXISTS idx_creator_applications_created_at ON creator_applications(created_at);

-- Add trigger for updated_at
CREATE TRIGGER update_creator_applications_updated_at 
    BEFORE UPDATE ON creator_applications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE creator_applications ENABLE ROW LEVEL SECURITY;

-- Users can view their own applications
CREATE POLICY "Users can view own applications" ON creator_applications
    FOR SELECT USING (
        auth.uid() = supabase_user_id OR
        auth.uid() IN (SELECT supabase_id FROM users WHERE id = creator_applications.user_id)
    );

-- Users can create their own applications
CREATE POLICY "Users can create applications" ON creator_applications
    FOR INSERT WITH CHECK (
        auth.uid() = supabase_user_id OR
        auth.uid() IN (SELECT supabase_id FROM users WHERE id = creator_applications.user_id)
    );

-- Only admins can update applications
CREATE POLICY "Admins can update applications" ON creator_applications
    FOR UPDATE USING (
        auth.uid() IN (SELECT supabase_id FROM users WHERE is_super_admin = true)
    );

-- Add comment for documentation
COMMENT ON TABLE creator_applications IS 'Tracks applications from users who want to become creators on the platform';