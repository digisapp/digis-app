-- Create tables for creator experiences feature

-- Main experiences table (approved experiences)
CREATE TABLE IF NOT EXISTS creator_experiences (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255) NOT NULL,
    banner_image TEXT,
    token_cost INTEGER NOT NULL DEFAULT 10000,
    date DATE NOT NULL,
    duration VARCHAR(100),
    max_participants INTEGER NOT NULL,
    min_participants INTEGER,
    current_participants INTEGER DEFAULT 0,
    category VARCHAR(50) NOT NULL DEFAULT 'local',
    tier VARCHAR(50) DEFAULT 'bronze',
    perks JSONB,
    requirements JSONB,
    status VARCHAR(50) DEFAULT 'approved',
    organizer_id UUID REFERENCES users(supabase_id),
    deadline DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chk_token_cost_positive CHECK (token_cost > 0),
    CONSTRAINT chk_max_participants CHECK (max_participants > 0),
    CONSTRAINT chk_min_participants CHECK (min_participants IS NULL OR min_participants > 0),
    CONSTRAINT chk_min_max_participants CHECK (min_participants IS NULL OR min_participants <= max_participants)
);

-- Experience submissions from creators (pending approval)
CREATE TABLE IF NOT EXISTS creator_experience_submissions (
    id VARCHAR(255) PRIMARY KEY,
    submitter_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255) NOT NULL,
    proposed_date DATE NOT NULL,
    duration VARCHAR(100),
    estimated_cost INTEGER NOT NULL,
    max_participants INTEGER NOT NULL,
    min_participants INTEGER,
    target_audience TEXT,
    activities JSONB,
    requirements JSONB,
    why_special TEXT,
    co_hosts JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    reviewer_id UUID REFERENCES users(supabase_id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chk_submission_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Experience participants
CREATE TABLE IF NOT EXISTS experience_participants (
    id VARCHAR(255) PRIMARY KEY,
    experience_id VARCHAR(255) NOT NULL REFERENCES creator_experiences(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    token_cost INTEGER NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    attendance_status VARCHAR(50) DEFAULT 'confirmed',
    
    UNIQUE(experience_id, user_id),
    CONSTRAINT chk_attendance_status CHECK (attendance_status IN ('confirmed', 'cancelled', 'attended', 'no-show'))
);

-- Experience reviews (after completion)
CREATE TABLE IF NOT EXISTS experience_reviews (
    id VARCHAR(255) PRIMARY KEY,
    experience_id VARCHAR(255) NOT NULL REFERENCES creator_experiences(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(experience_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_creator_experiences_date ON creator_experiences(date);
CREATE INDEX IF NOT EXISTS idx_creator_experiences_status ON creator_experiences(status);
CREATE INDEX IF NOT EXISTS idx_creator_experiences_category ON creator_experiences(category);
CREATE INDEX IF NOT EXISTS idx_creator_experiences_organizer ON creator_experiences(organizer_id);
CREATE INDEX IF NOT EXISTS idx_creator_experiences_active ON creator_experiences(is_active);

CREATE INDEX IF NOT EXISTS idx_experience_submissions_submitter ON creator_experience_submissions(submitter_id);
CREATE INDEX IF NOT EXISTS idx_experience_submissions_status ON creator_experience_submissions(status);
CREATE INDEX IF NOT EXISTS idx_experience_submissions_created ON creator_experience_submissions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_experience_participants_experience ON experience_participants(experience_id);
CREATE INDEX IF NOT EXISTS idx_experience_participants_user ON experience_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_experience_participants_joined ON experience_participants(joined_at DESC);

CREATE INDEX IF NOT EXISTS idx_experience_reviews_experience ON experience_reviews(experience_id);
CREATE INDEX IF NOT EXISTS idx_experience_reviews_user ON experience_reviews(user_id);

-- Add RLS policies
ALTER TABLE creator_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_experience_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE experience_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE experience_reviews ENABLE ROW LEVEL SECURITY;

-- Public can view active experiences
CREATE POLICY "Public can view active experiences" ON creator_experiences
    FOR SELECT USING (is_active = true AND status = 'approved');

-- Creators can submit experiences
CREATE POLICY "Creators can submit experiences" ON creator_experience_submissions
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND is_creator = true)
    );

-- Submitters can view their own submissions
CREATE POLICY "Users can view own submissions" ON creator_experience_submissions
    FOR SELECT USING (submitter_id = auth.uid());

-- Admins can view all submissions
CREATE POLICY "Admins can view all submissions" ON creator_experience_submissions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND is_super_admin = true)
    );

-- Users can view their participation
CREATE POLICY "Users can view own participation" ON experience_participants
    FOR SELECT USING (user_id = auth.uid());

-- Users can review experiences they participated in
CREATE POLICY "Participants can review experiences" ON experience_reviews
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM experience_participants 
            WHERE experience_id = experience_reviews.experience_id 
            AND user_id = auth.uid()
            AND attendance_status = 'attended'
        )
    );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_experiences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_creator_experiences_updated_at BEFORE UPDATE
    ON creator_experiences FOR EACH ROW EXECUTE FUNCTION update_experiences_updated_at();

-- Add comments
COMMENT ON TABLE creator_experiences IS 'Stores approved creator experiences that users can join with tokens';
COMMENT ON TABLE creator_experience_submissions IS 'Stores experience proposals submitted by creators for admin review';
COMMENT ON TABLE experience_participants IS 'Tracks which users have joined which experiences';
COMMENT ON TABLE experience_reviews IS 'Stores reviews from participants after experiences are completed';