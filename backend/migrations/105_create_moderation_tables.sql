-- =====================================================
-- CREATE CONTENT MODERATION TABLES
-- =====================================================
-- This migration adds tables for AI-based content moderation and user management

BEGIN;

-- =====================================================
-- CONTENT MODERATION
-- =====================================================

CREATE TABLE IF NOT EXISTS content_moderation (
    id SERIAL PRIMARY KEY,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('message', 'profile', 'image', 'video', 'stream', 'bio', 'username')),
    content_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    original_content TEXT NOT NULL,
    sanitized_content TEXT,
    moderation_result JSONB DEFAULT '{}',
    is_violation BOOLEAN DEFAULT false,
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    violation_categories TEXT[],
    action_taken VARCHAR(50) CHECK (action_taken IN ('none', 'warning', 'content_removed', 'user_suspended', 'user_banned', 'pending_review')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected', 'escalated')),
    auto_moderated BOOLEAN DEFAULT true,
    admin_notes TEXT,
    admin_review TEXT,
    reviewed_by UUID REFERENCES users(supabase_id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blocked content archive
CREATE TABLE IF NOT EXISTS blocked_content (
    id SERIAL PRIMARY KEY,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('message', 'profile', 'image', 'video', 'stream', 'bio', 'username')),
    content_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    original_content TEXT,
    reason TEXT NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    moderation_id INTEGER REFERENCES content_moderation(id),
    blocked_by UUID REFERENCES users(supabase_id),
    appeal_status VARCHAR(50) DEFAULT 'none' CHECK (appeal_status IN ('none', 'pending', 'approved', 'rejected')),
    appeal_reason TEXT,
    appeal_reviewed_by UUID REFERENCES users(supabase_id),
    appeal_reviewed_at TIMESTAMP WITH TIME ZONE,
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- User penalties and sanctions
CREATE TABLE IF NOT EXISTS user_penalties (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    penalty_type VARCHAR(50) NOT NULL CHECK (penalty_type IN ('warning', 'mute', 'suspension', 'ban', 'content_restriction', 'rate_limit')),
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    duration_days INTEGER,
    reason TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    related_content_id INTEGER REFERENCES content_moderation(id),
    issued_by UUID REFERENCES users(supabase_id),
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    lifted_by UUID REFERENCES users(supabase_id),
    lifted_at TIMESTAMP WITH TIME ZONE,
    lifted_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Moderation rules and thresholds
CREATE TABLE IF NOT EXISTS moderation_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(255) NOT NULL UNIQUE,
    content_type VARCHAR(50) CHECK (content_type IN ('message', 'profile', 'image', 'video', 'stream', 'bio', 'username', 'all')),
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('keyword', 'pattern', 'ai_threshold', 'rate_limit', 'reputation')),
    rule_config JSONB NOT NULL DEFAULT '{}',
    action VARCHAR(50) NOT NULL CHECK (action IN ('flag', 'block', 'shadow_ban', 'require_review', 'auto_remove')),
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(supabase_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User reputation scores
CREATE TABLE IF NOT EXISTS user_reputation (
    user_id UUID PRIMARY KEY REFERENCES users(supabase_id) ON DELETE CASCADE,
    reputation_score INTEGER DEFAULT 100 CHECK (reputation_score >= 0 AND reputation_score <= 100),
    total_violations INTEGER DEFAULT 0,
    warnings_count INTEGER DEFAULT 0,
    suspensions_count INTEGER DEFAULT 0,
    bans_count INTEGER DEFAULT 0,
    positive_actions INTEGER DEFAULT 0,
    last_violation_at TIMESTAMP WITH TIME ZONE,
    risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    is_trusted BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Moderation queue for manual review
CREATE TABLE IF NOT EXISTS moderation_queue (
    id SERIAL PRIMARY KEY,
    moderation_id INTEGER REFERENCES content_moderation(id),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    assigned_to UUID REFERENCES users(supabase_id),
    assigned_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'completed', 'escalated')),
    review_deadline TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Content moderation indexes
CREATE INDEX idx_content_moderation_user_id ON content_moderation(user_id);
CREATE INDEX idx_content_moderation_content_type ON content_moderation(content_type);
CREATE INDEX idx_content_moderation_status ON content_moderation(status);
CREATE INDEX idx_content_moderation_is_violation ON content_moderation(is_violation);
CREATE INDEX idx_content_moderation_created_at ON content_moderation(created_at DESC);

-- Blocked content indexes
CREATE INDEX idx_blocked_content_user_id ON blocked_content(user_id);
CREATE INDEX idx_blocked_content_content_type ON blocked_content(content_type);
CREATE INDEX idx_blocked_content_appeal_status ON blocked_content(appeal_status);

-- User penalties indexes
CREATE INDEX idx_user_penalties_user_id ON user_penalties(user_id);
CREATE INDEX idx_user_penalties_penalty_type ON user_penalties(penalty_type);
CREATE INDEX idx_user_penalties_is_active ON user_penalties(is_active);
CREATE INDEX idx_user_penalties_expires_at ON user_penalties(expires_at);

-- Moderation rules indexes
CREATE INDEX idx_moderation_rules_content_type ON moderation_rules(content_type);
CREATE INDEX idx_moderation_rules_rule_type ON moderation_rules(rule_type);
CREATE INDEX idx_moderation_rules_is_active ON moderation_rules(is_active);

-- User reputation indexes
CREATE INDEX idx_user_reputation_risk_level ON user_reputation(risk_level);
CREATE INDEX idx_user_reputation_reputation_score ON user_reputation(reputation_score);

-- Moderation queue indexes
CREATE INDEX idx_moderation_queue_status ON moderation_queue(status);
CREATE INDEX idx_moderation_queue_priority ON moderation_queue(priority);
CREATE INDEX idx_moderation_queue_assigned_to ON moderation_queue(assigned_to);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp triggers
CREATE TRIGGER update_content_moderation_updated_at BEFORE UPDATE ON content_moderation
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_moderation_rules_updated_at BEFORE UPDATE ON moderation_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_reputation_updated_at BEFORE UPDATE ON user_reputation
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update user reputation on new penalty
CREATE OR REPLACE FUNCTION update_user_reputation_on_penalty()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = true THEN
        INSERT INTO user_reputation (user_id, total_violations)
        VALUES (NEW.user_id, 1)
        ON CONFLICT (user_id) DO UPDATE
        SET 
            total_violations = user_reputation.total_violations + 1,
            warnings_count = CASE WHEN NEW.penalty_type = 'warning' 
                            THEN user_reputation.warnings_count + 1 
                            ELSE user_reputation.warnings_count END,
            suspensions_count = CASE WHEN NEW.penalty_type = 'suspension' 
                               THEN user_reputation.suspensions_count + 1 
                               ELSE user_reputation.suspensions_count END,
            bans_count = CASE WHEN NEW.penalty_type = 'ban' 
                         THEN user_reputation.bans_count + 1 
                         ELSE user_reputation.bans_count END,
            last_violation_at = NOW(),
            reputation_score = GREATEST(0, user_reputation.reputation_score - 
                             CASE NEW.severity 
                                 WHEN 'low' THEN 5
                                 WHEN 'medium' THEN 10
                                 WHEN 'high' THEN 20
                                 WHEN 'critical' THEN 30
                                 ELSE 5
                             END),
            risk_level = CASE 
                         WHEN user_reputation.reputation_score <= 20 THEN 'critical'
                         WHEN user_reputation.reputation_score <= 40 THEN 'high'
                         WHEN user_reputation.reputation_score <= 60 THEN 'medium'
                         ELSE 'low'
                         END,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reputation_on_penalty
AFTER INSERT ON user_penalties
FOR EACH ROW EXECUTE FUNCTION update_user_reputation_on_penalty();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE content_moderation ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;

-- Content moderation policies
CREATE POLICY content_moderation_select_own ON content_moderation FOR SELECT 
    USING (auth.uid() = user_id);
CREATE POLICY content_moderation_select_admin ON content_moderation FOR SELECT 
    USING (EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND (role = 'admin' OR role = 'moderator')));
CREATE POLICY content_moderation_insert_system ON content_moderation FOR INSERT 
    WITH CHECK (true); -- System can insert for any user
CREATE POLICY content_moderation_update_admin ON content_moderation FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND (role = 'admin' OR role = 'moderator')));

-- Blocked content policies
CREATE POLICY blocked_content_select_own ON blocked_content FOR SELECT 
    USING (auth.uid() = user_id);
CREATE POLICY blocked_content_select_admin ON blocked_content FOR SELECT 
    USING (EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND (role = 'admin' OR role = 'moderator')));
CREATE POLICY blocked_content_insert_admin ON blocked_content FOR INSERT 
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND (role = 'admin' OR role = 'moderator')));

-- User penalties policies
CREATE POLICY user_penalties_select_own ON user_penalties FOR SELECT 
    USING (auth.uid() = user_id);
CREATE POLICY user_penalties_select_admin ON user_penalties FOR SELECT 
    USING (EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND (role = 'admin' OR role = 'moderator')));
CREATE POLICY user_penalties_insert_admin ON user_penalties FOR INSERT 
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND (role = 'admin' OR role = 'moderator')));
CREATE POLICY user_penalties_update_admin ON user_penalties FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND (role = 'admin' OR role = 'moderator')));

-- Moderation rules policies (admin only)
CREATE POLICY moderation_rules_select_admin ON moderation_rules FOR SELECT 
    USING (EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND role = 'admin'));
CREATE POLICY moderation_rules_all_admin ON moderation_rules FOR ALL 
    USING (EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND role = 'admin'));

-- User reputation policies
CREATE POLICY user_reputation_select_own ON user_reputation FOR SELECT 
    USING (auth.uid() = user_id);
CREATE POLICY user_reputation_select_admin ON user_reputation FOR SELECT 
    USING (EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND (role = 'admin' OR role = 'moderator')));

-- Moderation queue policies (moderator/admin only)
CREATE POLICY moderation_queue_all_moderator ON moderation_queue FOR ALL 
    USING (EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND (role = 'admin' OR role = 'moderator')));

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to check if user is currently penalized
CREATE OR REPLACE FUNCTION is_user_penalized(check_user_id UUID, check_penalty_type VARCHAR DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    penalty_exists BOOLEAN;
BEGIN
    IF check_penalty_type IS NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM user_penalties 
            WHERE user_id = check_user_id 
            AND is_active = true 
            AND (expires_at IS NULL OR expires_at > NOW())
        ) INTO penalty_exists;
    ELSE
        SELECT EXISTS(
            SELECT 1 FROM user_penalties 
            WHERE user_id = check_user_id 
            AND penalty_type = check_penalty_type
            AND is_active = true 
            AND (expires_at IS NULL OR expires_at > NOW())
        ) INTO penalty_exists;
    END IF;
    
    RETURN penalty_exists;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-expire penalties
CREATE OR REPLACE FUNCTION expire_user_penalties()
RETURNS void AS $$
BEGIN
    UPDATE user_penalties 
    SET is_active = false,
        lifted_reason = 'Auto-expired'
    WHERE is_active = true 
    AND expires_at IS NOT NULL 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get user risk assessment
CREATE OR REPLACE FUNCTION get_user_risk_assessment(check_user_id UUID)
RETURNS TABLE(
    reputation_score INTEGER,
    risk_level VARCHAR,
    total_violations INTEGER,
    active_penalties INTEGER,
    is_trusted BOOLEAN,
    can_chat BOOLEAN,
    can_stream BOOLEAN,
    can_create_content BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ur.reputation_score,
        ur.risk_level,
        ur.total_violations,
        (SELECT COUNT(*)::INTEGER FROM user_penalties 
         WHERE user_id = check_user_id AND is_active = true) as active_penalties,
        ur.is_trusted,
        NOT is_user_penalized(check_user_id, 'mute') as can_chat,
        NOT is_user_penalized(check_user_id, 'content_restriction') as can_stream,
        NOT is_user_penalized(check_user_id, 'content_restriction') as can_create_content
    FROM user_reputation ur
    WHERE ur.user_id = check_user_id
    UNION ALL
    -- Default values for users without reputation record
    SELECT 
        100,
        'low'::VARCHAR,
        0,
        0,
        false,
        true,
        true,
        true
    WHERE NOT EXISTS (SELECT 1 FROM user_reputation WHERE user_id = check_user_id);
END;
$$ LANGUAGE plpgsql;

-- Sample moderation rules
INSERT INTO moderation_rules (rule_name, content_type, rule_type, rule_config, action, severity, is_active)
VALUES 
    ('Profanity Filter', 'message', 'keyword', '{"keywords": ["badword1", "badword2"], "match_type": "exact"}', 'flag', 'medium', true),
    ('Spam Detection', 'message', 'pattern', '{"pattern": "(.*)\\1{3,}", "description": "Repeated characters"}', 'block', 'low', true),
    ('High Risk Content', 'all', 'ai_threshold', '{"min_confidence": 85, "categories": ["violence", "adult"]}', 'require_review', 'high', true),
    ('Rate Limiting', 'message', 'rate_limit', '{"max_messages": 10, "window_seconds": 60}', 'flag', 'low', true)
ON CONFLICT (rule_name) DO NOTHING;

COMMIT;