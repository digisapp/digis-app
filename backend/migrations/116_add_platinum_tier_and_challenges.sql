-- Add Platinum tier for ultra-high value fans
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loyalty_badges') THEN
    ALTER TABLE loyalty_badges 
    ADD COLUMN IF NOT EXISTS challenges_completed INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS next_tier_progress DECIMAL(5,2) DEFAULT 0;
    
    -- Update level enum to include platinum
    ALTER TABLE loyalty_badges 
    DROP CONSTRAINT IF EXISTS loyalty_badges_level_check;
    
    ALTER TABLE loyalty_badges 
    ADD CONSTRAINT loyalty_badges_level_check 
    CHECK (level IN ('none', 'bronze', 'silver', 'gold', 'diamond', 'platinum'));
  END IF;
END $$;

-- Create challenges table for gamification
CREATE TABLE IF NOT EXISTS loyalty_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    challenge_type VARCHAR(50) NOT NULL, -- 'stream_watch', 'spend', 'engagement', 'referral'
    target_value INTEGER NOT NULL,
    reward_points INTEGER NOT NULL,
    reward_tokens INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Track challenge progress
CREATE TABLE IF NOT EXISTS challenge_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    challenge_id UUID REFERENCES loyalty_challenges(id),
    creator_id UUID REFERENCES users(id),
    current_value INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, challenge_id)
);

-- Retention milestones table
CREATE TABLE IF NOT EXISTS retention_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    creator_id UUID REFERENCES users(id),
    milestone_type VARCHAR(50), -- '6_months', '1_year', '2_years'
    achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reward_delivered BOOLEAN DEFAULT false,
    reward_data JSONB,
    UNIQUE(user_id, creator_id, milestone_type)
);

-- Analytics predictions table
CREATE TABLE IF NOT EXISTS loyalty_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    creator_id UUID REFERENCES users(id),
    churn_risk_percent DECIMAL(5,2),
    upgrade_probability DECIMAL(5,2),
    predicted_ltv DECIMAL(10,2),
    next_likely_action VARCHAR(100),
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, creator_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_loyalty_badges_points ON loyalty_badges(loyalty_points);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_user ON challenge_progress(user_id, completed);
CREATE INDEX IF NOT EXISTS idx_retention_milestones_dates ON retention_milestones(achieved_at);
CREATE INDEX IF NOT EXISTS idx_loyalty_predictions_risk ON loyalty_predictions(churn_risk_percent);

-- Insert default challenges for all creators
INSERT INTO loyalty_challenges (creator_id, name, description, challenge_type, target_value, reward_points, reward_tokens)
VALUES 
    (NULL, 'Stream Enthusiast', 'Watch 5 live streams this month', 'stream_watch', 5, 100, 10),
    (NULL, 'Super Supporter', 'Spend 500 tokens this month', 'spend', 500, 200, 25),
    (NULL, 'Engagement Champion', 'Send 50 chat messages', 'engagement', 50, 50, 5),
    (NULL, 'Loyalty Streak', 'Visit profile 7 days in a row', 'engagement', 7, 150, 15),
    (NULL, 'Referral Master', 'Bring 3 new fans', 'referral', 3, 500, 50)
ON CONFLICT DO NOTHING;

-- Function to calculate tier progress
CREATE OR REPLACE FUNCTION calculate_tier_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate progress to next tier
    IF NEW.level = 'bronze' THEN
        NEW.next_tier_progress = LEAST(100, (NEW.total_spend / 50.0) * 100);
    ELSIF NEW.level = 'silver' THEN
        NEW.next_tier_progress = LEAST(100, (NEW.total_spend / 100.0) * 100);
    ELSIF NEW.level = 'gold' THEN
        NEW.next_tier_progress = LEAST(100, (NEW.total_spend / 500.0) * 100);
    ELSIF NEW.level = 'diamond' THEN
        NEW.next_tier_progress = LEAST(100, (NEW.total_spend / 2000.0) * 100);
    ELSE
        NEW.next_tier_progress = 100;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tier_progress
BEFORE INSERT OR UPDATE ON loyalty_badges
FOR EACH ROW
EXECUTE FUNCTION calculate_tier_progress();