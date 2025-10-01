-- =====================================================
-- CREATE CARDS AND STREAM ANALYTICS TABLES
-- =====================================================
-- This migration adds support for trading cards, stream analytics, and milestones

BEGIN;

-- =====================================================
-- CARDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    creator_name VARCHAR(255),
    card_number INTEGER,
    rarity VARCHAR(20) CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    category VARCHAR(50),
    value INTEGER DEFAULT 0,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- CARD TRADES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS card_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    to_user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
    trade_value INTEGER,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    traded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STREAM ANALYTICS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS stream_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    viewer_count INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    reaction_count INTEGER DEFAULT 0,
    gift_count INTEGER DEFAULT 0,
    tip_amount DECIMAL(10,2) DEFAULT 0,
    new_followers INTEGER DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type VARCHAR(20) CHECK (type IN ('snapshot', 'message', 'reaction', 'gift', 'tip', 'follow', 'subscription')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STREAM MILESTONES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS stream_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    milestone_type VARCHAR(30) CHECK (milestone_type IN ('viewers', 'tips', 'gifts', 'followers', 'duration', 'messages')),
    count INTEGER NOT NULL,
    label TEXT,
    icon VARCHAR(50),
    color VARCHAR(20),
    achieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STREAM ALERTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS stream_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    alert_type VARCHAR(30) CHECK (alert_type IN ('new_follower', 'donation', 'subscription', 'raid', 'host', 'milestone')),
    message TEXT,
    metadata JSONB DEFAULT '{}',
    displayed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STREAM GOALS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS stream_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    current_level INTEGER DEFAULT 1,
    level1 JSONB DEFAULT '{}',
    level2 JSONB DEFAULT '{}', 
    level3 JSONB DEFAULT '{}',
    goal_amount INTEGER,
    current_amount INTEGER DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(stream_id)
);

-- =====================================================
-- STREAM RAIDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS stream_raids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    target_channel VARCHAR(255),
    target_creator_id UUID REFERENCES users(supabase_id),
    viewer_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STREAM PARTICIPANTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS stream_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'viewer' CHECK (role IN ('host', 'co-host', 'moderator', 'viewer', 'guest')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(stream_id, user_id)
);

-- =====================================================
-- GIFT TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS gift_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    gift_id VARCHAR(50),
    gift_name VARCHAR(100),
    gift_emoji VARCHAR(10),
    gift_cost INTEGER,
    gift_rarity VARCHAR(20),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_cards_user_id ON cards(user_id);
CREATE INDEX idx_cards_creator_id ON cards(creator_id);
CREATE INDEX idx_cards_rarity ON cards(rarity);
CREATE INDEX idx_card_trades_from_user ON card_trades(from_user_id);
CREATE INDEX idx_card_trades_to_user ON card_trades(to_user_id);
CREATE INDEX idx_card_trades_status ON card_trades(status);

CREATE INDEX idx_stream_analytics_stream_id ON stream_analytics(stream_id);
CREATE INDEX idx_stream_analytics_creator_id ON stream_analytics(creator_id);
CREATE INDEX idx_stream_analytics_timestamp ON stream_analytics(timestamp DESC);
CREATE INDEX idx_stream_analytics_type ON stream_analytics(type);

CREATE INDEX idx_stream_milestones_stream_id ON stream_milestones(stream_id);
CREATE INDEX idx_stream_milestones_creator_id ON stream_milestones(creator_id);
CREATE INDEX idx_stream_milestones_type ON stream_milestones(milestone_type);

CREATE INDEX idx_stream_alerts_stream_id ON stream_alerts(stream_id);
CREATE INDEX idx_stream_alerts_creator_id ON stream_alerts(creator_id);
CREATE INDEX idx_stream_alerts_displayed ON stream_alerts(displayed);

CREATE INDEX idx_stream_goals_stream_id ON stream_goals(stream_id);
CREATE INDEX idx_stream_goals_creator_id ON stream_goals(creator_id);

CREATE INDEX idx_stream_raids_stream_id ON stream_raids(stream_id);
CREATE INDEX idx_stream_raids_creator_id ON stream_raids(creator_id);

CREATE INDEX idx_stream_participants_stream_id ON stream_participants(stream_id);
CREATE INDEX idx_stream_participants_user_id ON stream_participants(user_id);
CREATE INDEX idx_stream_participants_active ON stream_participants(is_active);

CREATE INDEX idx_gift_transactions_sender_id ON gift_transactions(sender_id);
CREATE INDEX idx_gift_transactions_recipient_id ON gift_transactions(recipient_id);
CREATE INDEX idx_gift_transactions_stream_id ON gift_transactions(stream_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp trigger for cards
CREATE TRIGGER update_cards_updated_at 
BEFORE UPDATE ON cards
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update timestamp trigger for stream goals
CREATE TRIGGER update_stream_goals_updated_at 
BEFORE UPDATE ON stream_goals
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_raids ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_transactions ENABLE ROW LEVEL SECURITY;

-- Cards policies
CREATE POLICY cards_own ON cards 
    FOR SELECT USING (user_id = auth.uid() OR creator_id = auth.uid());

CREATE POLICY cards_insert ON cards 
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Card trades policies
CREATE POLICY card_trades_access ON card_trades 
    FOR ALL USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- Stream analytics policies (creators can see their own)
CREATE POLICY stream_analytics_creator ON stream_analytics 
    FOR SELECT USING (creator_id = auth.uid());

-- Stream milestones policies
CREATE POLICY stream_milestones_creator ON stream_milestones 
    FOR ALL USING (creator_id = auth.uid());

-- Stream alerts policies
CREATE POLICY stream_alerts_creator ON stream_alerts 
    FOR ALL USING (creator_id = auth.uid());

-- Stream goals policies
CREATE POLICY stream_goals_creator ON stream_goals 
    FOR ALL USING (creator_id = auth.uid());

-- Stream raids policies
CREATE POLICY stream_raids_creator ON stream_raids 
    FOR ALL USING (creator_id = auth.uid());

-- Stream participants policies (everyone can see)
CREATE POLICY stream_participants_view ON stream_participants 
    FOR SELECT USING (true);

CREATE POLICY stream_participants_manage ON stream_participants 
    FOR ALL USING (user_id = auth.uid());

-- Gift transactions policies
CREATE POLICY gift_transactions_access ON gift_transactions 
    FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY gift_transactions_insert ON gift_transactions 
    FOR INSERT WITH CHECK (sender_id = auth.uid());

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update stream analytics
CREATE OR REPLACE FUNCTION update_stream_analytics(
    p_stream_id UUID,
    p_type VARCHAR,
    p_amount INTEGER DEFAULT 1,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
DECLARE
    v_creator_id UUID;
BEGIN
    -- Get creator ID from stream
    SELECT creator_id INTO v_creator_id 
    FROM streams 
    WHERE id = p_stream_id;
    
    -- Insert analytics record
    INSERT INTO stream_analytics (
        stream_id, 
        creator_id, 
        type, 
        metadata,
        viewer_count,
        message_count,
        reaction_count,
        gift_count,
        tip_amount,
        new_followers
    ) VALUES (
        p_stream_id, 
        v_creator_id, 
        p_type, 
        p_metadata,
        CASE WHEN p_type = 'snapshot' THEN p_amount ELSE 0 END,
        CASE WHEN p_type = 'message' THEN p_amount ELSE 0 END,
        CASE WHEN p_type = 'reaction' THEN p_amount ELSE 0 END,
        CASE WHEN p_type = 'gift' THEN p_amount ELSE 0 END,
        CASE WHEN p_type = 'tip' THEN p_amount ELSE 0 END,
        CASE WHEN p_type = 'follow' THEN p_amount ELSE 0 END
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check and create milestones
CREATE OR REPLACE FUNCTION check_stream_milestone(
    p_stream_id UUID,
    p_type VARCHAR,
    p_current_value INTEGER
)
RETURNS TABLE(
    milestone_achieved BOOLEAN,
    milestone_count INTEGER,
    milestone_label TEXT
) AS $$
DECLARE
    v_creator_id UUID;
    v_milestone_thresholds INTEGER[] := ARRAY[10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    v_threshold INTEGER;
    v_label TEXT;
BEGIN
    -- Get creator ID
    SELECT creator_id INTO v_creator_id 
    FROM streams 
    WHERE id = p_stream_id;
    
    -- Check each threshold
    FOREACH v_threshold IN ARRAY v_milestone_thresholds
    LOOP
        -- Check if milestone already achieved
        IF NOT EXISTS (
            SELECT 1 FROM stream_milestones 
            WHERE stream_id = p_stream_id 
            AND milestone_type = p_type 
            AND count = v_threshold
        ) AND p_current_value >= v_threshold THEN
            
            -- Create label
            v_label := CASE p_type
                WHEN 'viewers' THEN v_threshold || ' Viewers!'
                WHEN 'tips' THEN v_threshold || ' Tips Received!'
                WHEN 'gifts' THEN v_threshold || ' Gifts Received!'
                WHEN 'followers' THEN v_threshold || ' New Followers!'
                WHEN 'messages' THEN v_threshold || ' Chat Messages!'
                ELSE v_threshold || ' ' || p_type
            END;
            
            -- Insert milestone
            INSERT INTO stream_milestones (
                stream_id, 
                creator_id, 
                milestone_type, 
                count, 
                label,
                icon,
                color
            ) VALUES (
                p_stream_id, 
                v_creator_id, 
                p_type, 
                v_threshold, 
                v_label,
                CASE p_type
                    WHEN 'viewers' THEN '👥'
                    WHEN 'tips' THEN '💰'
                    WHEN 'gifts' THEN '🎁'
                    WHEN 'followers' THEN '❤️'
                    WHEN 'messages' THEN '💬'
                    ELSE '🏆'
                END,
                CASE 
                    WHEN v_threshold >= 5000 THEN 'gold'
                    WHEN v_threshold >= 1000 THEN 'purple'
                    WHEN v_threshold >= 100 THEN 'blue'
                    ELSE 'green'
                END
            );
            
            RETURN QUERY SELECT true, v_threshold, v_label;
        END IF;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

COMMIT;