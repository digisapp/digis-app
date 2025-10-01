-- =====================================================
-- CREATE GAMIFICATION AND INTERACTIVE FEATURE TABLES
-- =====================================================
-- This migration adds tables for badges, challenges, goals, subscriptions, polls, and Q&A

BEGIN;

-- =====================================================
-- BADGES SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS user_badges (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    badge_name VARCHAR(50) NOT NULL,
    badge_type VARCHAR(50) NOT NULL CHECK (badge_type IN ('achievement', 'milestone', 'special', 'subscription')),
    description TEXT,
    icon_url TEXT,
    points INTEGER DEFAULT 0,
    rarity VARCHAR(20) DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    awarded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Badge definitions (catalog of available badges)
CREATE TABLE IF NOT EXISTS badge_definitions (
    id SERIAL PRIMARY KEY,
    badge_name VARCHAR(50) UNIQUE NOT NULL,
    badge_type VARCHAR(50) NOT NULL,
    description TEXT,
    icon_url TEXT,
    points INTEGER DEFAULT 0,
    rarity VARCHAR(20) DEFAULT 'common',
    requirements JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- CHALLENGES SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS user_challenges (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    challenge_id VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('daily', 'weekly', 'monthly', 'special')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_value JSONB NOT NULL DEFAULT '{}',
    current_progress INTEGER DEFAULT 0,
    reward_tokens INTEGER NOT NULL DEFAULT 0,
    reward_points INTEGER NOT NULL DEFAULT 0,
    reward_badge VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'claimed')),
    date_assigned DATE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    claimed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Achievements tracking
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    points INTEGER NOT NULL DEFAULT 0,
    challenge_id VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STREAM GOALS
-- =====================================================

CREATE TABLE IF NOT EXISTS stream_goals (
    id SERIAL PRIMARY KEY,
    stream_id UUID NOT NULL REFERENCES streams(stream_id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    goal_type VARCHAR(50) DEFAULT 'tokens' CHECK (goal_type IN ('tokens', 'viewers', 'followers', 'custom')),
    goal_amount DECIMAL(10,2) NOT NULL CHECK (goal_amount > 0),
    current_amount DECIMAL(10,2) DEFAULT 0,
    description TEXT,
    reward_description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    is_active BOOLEAN DEFAULT true,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SUBSCRIPTION SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    billing_interval VARCHAR(20) NOT NULL CHECK (billing_interval IN ('month', 'year')),
    features JSONB DEFAULT '{}',
    perks JSONB DEFAULT '{}',
    max_subscribers INTEGER,
    stripe_product_id VARCHAR(255),
    stripe_price_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(creator_id, name)
);

CREATE TABLE IF NOT EXISTS creator_subscriptions (
    id SERIAL PRIMARY KEY,
    subscriber_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
    stripe_subscription_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'incomplete', 'trialing')),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    cancel_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(subscriber_id, creator_id)
);

-- =====================================================
-- POLLS SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS polls (
    poll_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    channel_id UUID REFERENCES streams(stream_id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    allow_multiple BOOLEAN DEFAULT false,
    duration INTEGER NOT NULL DEFAULT 300, -- seconds
    expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired')),
    total_votes INTEGER DEFAULT 0,
    results JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES polls(poll_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    option_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(poll_id, user_id)
);

-- =====================================================
-- Q&A SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS questions (
    question_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES streams(stream_id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'featured', 'ignored')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'featured')),
    upvotes INTEGER DEFAULT 0,
    answered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS question_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    vote_type VARCHAR(10) DEFAULT 'up' CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(question_id, user_id)
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Badges indexes
CREATE INDEX idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX idx_user_badges_badge_name ON user_badges(badge_name);
CREATE INDEX idx_user_badges_awarded_at ON user_badges(awarded_at DESC);

-- Challenges indexes
CREATE INDEX idx_user_challenges_user_id ON user_challenges(user_id);
CREATE INDEX idx_user_challenges_status ON user_challenges(status);
CREATE INDEX idx_user_challenges_date_assigned ON user_challenges(date_assigned);
CREATE INDEX idx_user_challenges_expires_at ON user_challenges(expires_at);

-- Achievements indexes
CREATE INDEX idx_achievements_user_id ON achievements(user_id);
CREATE INDEX idx_achievements_type ON achievements(type);

-- Stream goals indexes
CREATE INDEX idx_stream_goals_stream_id ON stream_goals(stream_id);
CREATE INDEX idx_stream_goals_creator_id ON stream_goals(creator_id);
CREATE INDEX idx_stream_goals_is_active ON stream_goals(is_active);

-- Subscription indexes
CREATE INDEX idx_subscription_plans_creator_id ON subscription_plans(creator_id);
CREATE INDEX idx_subscription_plans_is_active ON subscription_plans(is_active);
CREATE INDEX idx_creator_subscriptions_subscriber_id ON creator_subscriptions(subscriber_id);
CREATE INDEX idx_creator_subscriptions_creator_id ON creator_subscriptions(creator_id);
CREATE INDEX idx_creator_subscriptions_status ON creator_subscriptions(status);

-- Polls indexes
CREATE INDEX idx_polls_creator_id ON polls(creator_id);
CREATE INDEX idx_polls_channel_id ON polls(channel_id);
CREATE INDEX idx_polls_status ON polls(status);
CREATE INDEX idx_polls_expires_at ON polls(expires_at);
CREATE INDEX idx_poll_votes_poll_id ON poll_votes(poll_id);
CREATE INDEX idx_poll_votes_user_id ON poll_votes(user_id);

-- Questions indexes
CREATE INDEX idx_questions_channel_id ON questions(channel_id);
CREATE INDEX idx_questions_creator_id ON questions(creator_id);
CREATE INDEX idx_questions_user_id ON questions(user_id);
CREATE INDEX idx_questions_status ON questions(status);
CREATE INDEX idx_questions_priority ON questions(priority);
CREATE INDEX idx_question_votes_question_id ON question_votes(question_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp triggers
CREATE TRIGGER update_user_challenges_updated_at BEFORE UPDATE ON user_challenges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stream_goals_updated_at BEFORE UPDATE ON stream_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_creator_subscriptions_updated_at BEFORE UPDATE ON creator_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_polls_updated_at BEFORE UPDATE ON polls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-expire challenges
CREATE OR REPLACE FUNCTION expire_old_challenges()
RETURNS void AS $$
BEGIN
    UPDATE user_challenges 
    SET status = 'expired' 
    WHERE status = 'active' 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Auto-close expired polls
CREATE OR REPLACE FUNCTION close_expired_polls()
RETURNS void AS $$
BEGIN
    UPDATE polls 
    SET status = 'expired' 
    WHERE status = 'active' 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Update poll results on vote
CREATE OR REPLACE FUNCTION update_poll_results()
RETURNS TRIGGER AS $$
DECLARE
    vote_counts JSONB;
BEGIN
    -- Calculate vote counts
    SELECT jsonb_object_agg(option_index::text, count)
    INTO vote_counts
    FROM (
        SELECT option_index, COUNT(*) as count
        FROM poll_votes
        WHERE poll_id = NEW.poll_id
        GROUP BY option_index
    ) as counts;
    
    -- Update poll with results and total votes
    UPDATE polls 
    SET results = COALESCE(vote_counts, '{}'),
        total_votes = (SELECT COUNT(*) FROM poll_votes WHERE poll_id = NEW.poll_id)
    WHERE poll_id = NEW.poll_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_poll_results
AFTER INSERT OR UPDATE OR DELETE ON poll_votes
FOR EACH ROW EXECUTE FUNCTION update_poll_results();

-- Update question upvotes
CREATE OR REPLACE FUNCTION update_question_votes()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE questions 
    SET upvotes = (
        SELECT COUNT(*) 
        FROM question_votes 
        WHERE question_id = COALESCE(NEW.question_id, OLD.question_id) 
        AND vote_type = 'up'
    ) - (
        SELECT COUNT(*) 
        FROM question_votes 
        WHERE question_id = COALESCE(NEW.question_id, OLD.question_id) 
        AND vote_type = 'down'
    )
    WHERE question_id = COALESCE(NEW.question_id, OLD.question_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_question_votes
AFTER INSERT OR UPDATE OR DELETE ON question_votes
FOR EACH ROW EXECUTE FUNCTION update_question_votes();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_votes ENABLE ROW LEVEL SECURITY;

-- Badges policies
CREATE POLICY user_badges_select ON user_badges FOR SELECT USING (true); -- Public badges
CREATE POLICY user_badges_insert ON user_badges FOR INSERT 
    WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND role = 'admin'));

CREATE POLICY badge_definitions_select ON badge_definitions FOR SELECT USING (is_active = true);
CREATE POLICY badge_definitions_admin ON badge_definitions FOR ALL 
    USING (EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND role = 'admin'));

-- Challenges policies
CREATE POLICY user_challenges_select_own ON user_challenges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_challenges_update_own ON user_challenges FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY achievements_select_own ON achievements FOR SELECT USING (auth.uid() = user_id);

-- Stream goals policies
CREATE POLICY stream_goals_select ON stream_goals FOR SELECT USING (is_active = true);
CREATE POLICY stream_goals_manage ON stream_goals FOR ALL USING (auth.uid() = creator_id);

-- Subscription policies
CREATE POLICY subscription_plans_select ON subscription_plans FOR SELECT USING (is_active = true);
CREATE POLICY subscription_plans_manage ON subscription_plans FOR ALL USING (auth.uid() = creator_id);

CREATE POLICY creator_subscriptions_select ON creator_subscriptions FOR SELECT 
    USING (auth.uid() IN (subscriber_id, creator_id));
CREATE POLICY creator_subscriptions_insert ON creator_subscriptions FOR INSERT 
    WITH CHECK (auth.uid() = subscriber_id);
CREATE POLICY creator_subscriptions_update ON creator_subscriptions FOR UPDATE 
    USING (auth.uid() IN (subscriber_id, creator_id));

-- Polls policies
CREATE POLICY polls_select ON polls FOR SELECT USING (true); -- Public polls
CREATE POLICY polls_manage ON polls FOR ALL USING (auth.uid() = creator_id);

CREATE POLICY poll_votes_select_own ON poll_votes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY poll_votes_insert ON poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Questions policies
CREATE POLICY questions_select ON questions FOR SELECT USING (true); -- Public questions
CREATE POLICY questions_insert ON questions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY questions_update_creator ON questions FOR UPDATE 
    USING (auth.uid() = creator_id);

CREATE POLICY question_votes_select_own ON question_votes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY question_votes_manage ON question_votes FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- SAMPLE DATA
-- =====================================================

-- Insert default badge definitions
INSERT INTO badge_definitions (badge_name, badge_type, description, points, rarity, requirements) VALUES
('first_stream', 'achievement', 'Completed your first stream', 100, 'common', '{"type": "stream_count", "value": 1}'),
('stream_veteran', 'milestone', 'Streamed 100 times', 1000, 'epic', '{"type": "stream_count", "value": 100}'),
('fan_favorite', 'achievement', 'Reached 1000 followers', 500, 'rare', '{"type": "follower_count", "value": 1000}'),
('token_master', 'milestone', 'Earned 10000 tokens', 2000, 'legendary', '{"type": "tokens_earned", "value": 10000}'),
('early_adopter', 'special', 'Joined during beta', 300, 'rare', '{"type": "join_date", "before": "2025-01-01"}')
ON CONFLICT (badge_name) DO NOTHING;

COMMIT;