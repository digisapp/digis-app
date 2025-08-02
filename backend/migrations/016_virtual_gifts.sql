-- Virtual Gifts Tables and Functions
-- This migration adds support for virtual gifts that fans can send to creators

-- Virtual gifts catalog
CREATE TABLE IF NOT EXISTS virtual_gifts (
    id SERIAL PRIMARY KEY,
    gift_id UUID UNIQUE DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url VARCHAR(500),
    animation_url VARCHAR(500),
    token_cost DECIMAL(10,2) NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    is_active BOOLEAN DEFAULT true,
    rarity VARCHAR(20) DEFAULT 'common', -- common, rare, epic, legendary
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_gift_cost_positive CHECK (token_cost > 0),
    CONSTRAINT chk_gift_rarity CHECK (rarity IN ('common', 'rare', 'epic', 'legendary'))
);

-- Gifts sent by fans to creators
CREATE TABLE IF NOT EXISTS gifts_sent (
    id SERIAL PRIMARY KEY,
    sent_id UUID UNIQUE DEFAULT gen_random_uuid(),
    fan_id INTEGER NOT NULL,
    creator_id INTEGER NOT NULL,
    gift_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL, -- Total cost (gift_cost * quantity)
    quantity INTEGER DEFAULT 1,
    message TEXT,
    stream_id UUID, -- Link to live stream if sent during stream
    session_id INTEGER, -- Link to video/voice session if sent during call
    chat_message_id UUID, -- Link to chat message if sent with message
    is_anonymous BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign keys
    FOREIGN KEY (fan_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (gift_id) REFERENCES virtual_gifts(gift_id) ON DELETE RESTRICT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT chk_gift_quantity_positive CHECK (quantity > 0),
    CONSTRAINT chk_gift_amount_positive CHECK (amount > 0)
);

-- Gift transaction tracking for analytics
CREATE TABLE IF NOT EXISTS gift_transactions (
    id SERIAL PRIMARY KEY,
    transaction_id UUID UNIQUE DEFAULT gen_random_uuid(),
    sent_id UUID NOT NULL,
    fan_id INTEGER NOT NULL,
    creator_id INTEGER NOT NULL,
    gift_id UUID NOT NULL,
    token_amount DECIMAL(10,2) NOT NULL,
    transaction_type VARCHAR(20) DEFAULT 'gift_sent',
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign keys
    FOREIGN KEY (sent_id) REFERENCES gifts_sent(sent_id) ON DELETE CASCADE,
    FOREIGN KEY (fan_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (gift_id) REFERENCES virtual_gifts(gift_id) ON DELETE RESTRICT
);

-- Creator gift settings
CREATE TABLE IF NOT EXISTS creator_gift_settings (
    id SERIAL PRIMARY KEY,
    creator_id INTEGER UNIQUE NOT NULL,
    gifts_enabled BOOLEAN DEFAULT true,
    min_gift_amount DECIMAL(10,2) DEFAULT 1.00,
    gift_message_max_length INTEGER DEFAULT 200,
    show_gift_alerts BOOLEAN DEFAULT true,
    alert_min_amount DECIMAL(10,2) DEFAULT 10.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign keys
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT chk_min_gift_amount_positive CHECK (min_gift_amount >= 0),
    CONSTRAINT chk_alert_min_amount_positive CHECK (alert_min_amount >= 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_virtual_gifts_active ON virtual_gifts(is_active);
CREATE INDEX IF NOT EXISTS idx_virtual_gifts_category ON virtual_gifts(category);
CREATE INDEX IF NOT EXISTS idx_virtual_gifts_rarity ON virtual_gifts(rarity);
CREATE INDEX IF NOT EXISTS idx_gifts_sent_fan_id ON gifts_sent(fan_id);
CREATE INDEX IF NOT EXISTS idx_gifts_sent_creator_id ON gifts_sent(creator_id);
CREATE INDEX IF NOT EXISTS idx_gifts_sent_gift_id ON gifts_sent(gift_id);
CREATE INDEX IF NOT EXISTS idx_gifts_sent_stream_id ON gifts_sent(stream_id);
CREATE INDEX IF NOT EXISTS idx_gifts_sent_session_id ON gifts_sent(session_id);
CREATE INDEX IF NOT EXISTS idx_gifts_sent_created_at ON gifts_sent(created_at);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_fan_id ON gift_transactions(fan_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_creator_id ON gift_transactions(creator_id);

-- Function to process gift sending
CREATE OR REPLACE FUNCTION process_gift_send(
    p_fan_id INTEGER,
    p_creator_id INTEGER,
    p_gift_id UUID,
    p_quantity INTEGER DEFAULT 1,
    p_message TEXT DEFAULT NULL,
    p_stream_id UUID DEFAULT NULL,
    p_session_id INTEGER DEFAULT NULL,
    p_is_anonymous BOOLEAN DEFAULT false
)
RETURNS TABLE (
    success BOOLEAN,
    sent_id UUID,
    new_balance DECIMAL,
    error_message TEXT
) AS $$
DECLARE
    v_gift_cost DECIMAL;
    v_total_cost DECIMAL;
    v_fan_balance DECIMAL;
    v_fan_supabase_id UUID;
    v_creator_supabase_id UUID;
    v_sent_id UUID;
    v_gift_name VARCHAR(100);
BEGIN
    -- Get gift cost
    SELECT token_cost, name INTO v_gift_cost, v_gift_name
    FROM virtual_gifts
    WHERE gift_id = p_gift_id AND is_active = true;
    
    IF v_gift_cost IS NULL THEN
        RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 'Gift not found or inactive'::TEXT;
        RETURN;
    END IF;
    
    -- Calculate total cost
    v_total_cost := v_gift_cost * p_quantity;
    
    -- Get fan's Supabase ID and check balance
    SELECT u.supabase_id, tb.balance 
    INTO v_fan_supabase_id, v_fan_balance
    FROM users u
    JOIN token_balances tb ON tb.supabase_user_id = u.supabase_id
    WHERE u.id = p_fan_id;
    
    IF v_fan_balance < v_total_cost THEN
        RETURN QUERY SELECT false, NULL::UUID, v_fan_balance, 'Insufficient token balance'::TEXT;
        RETURN;
    END IF;
    
    -- Get creator's Supabase ID
    SELECT supabase_id INTO v_creator_supabase_id
    FROM users WHERE id = p_creator_id;
    
    -- Generate sent ID
    v_sent_id := gen_random_uuid();
    
    -- Deduct tokens from fan
    UPDATE token_balances 
    SET balance = balance - v_total_cost,
        updated_at = NOW()
    WHERE supabase_user_id = v_fan_supabase_id;
    
    -- Add tokens to creator
    UPDATE token_balances 
    SET balance = balance + v_total_cost,
        updated_at = NOW()
    WHERE supabase_user_id = v_creator_supabase_id;
    
    -- Record gift sent
    INSERT INTO gifts_sent (
        sent_id, fan_id, creator_id, gift_id, amount, 
        quantity, message, stream_id, session_id, is_anonymous
    ) VALUES (
        v_sent_id, p_fan_id, p_creator_id, p_gift_id, v_total_cost,
        p_quantity, p_message, p_stream_id, p_session_id, p_is_anonymous
    );
    
    -- Record gift transaction
    INSERT INTO gift_transactions (
        sent_id, fan_id, creator_id, gift_id, token_amount
    ) VALUES (
        v_sent_id, p_fan_id, p_creator_id, p_gift_id, v_total_cost
    );
    
    -- Record token transactions
    INSERT INTO token_transactions (
        transaction_id, supabase_user_id, type, amount, 
        balance_after, description, reference_id, reference_type
    ) VALUES (
        gen_random_uuid(), v_fan_supabase_id, 'gift_sent', -v_total_cost,
        v_fan_balance - v_total_cost, 
        'Sent ' || p_quantity || 'x ' || v_gift_name || ' gift',
        v_sent_id::VARCHAR, 'gift'
    );
    
    INSERT INTO token_transactions (
        transaction_id, supabase_user_id, type, amount, 
        balance_after, description, reference_id, reference_type
    ) VALUES (
        gen_random_uuid(), v_creator_supabase_id, 'gift_received', v_total_cost,
        (SELECT balance FROM token_balances WHERE supabase_user_id = v_creator_supabase_id),
        'Received ' || p_quantity || 'x ' || v_gift_name || ' gift',
        v_sent_id::VARCHAR, 'gift'
    );
    
    -- Create notification for creator
    INSERT INTO notifications (
        user_id, type, title, message, data, is_read
    ) VALUES (
        p_creator_id, 'gift_received', 'You received a gift!',
        CASE 
            WHEN p_is_anonymous THEN 'Someone sent you ' || p_quantity || 'x ' || v_gift_name
            ELSE (SELECT username FROM users WHERE id = p_fan_id) || ' sent you ' || p_quantity || 'x ' || v_gift_name
        END,
        jsonb_build_object(
            'sent_id', v_sent_id,
            'gift_id', p_gift_id,
            'gift_name', v_gift_name,
            'quantity', p_quantity,
            'amount', v_total_cost,
            'fan_id', CASE WHEN p_is_anonymous THEN NULL ELSE p_fan_id END,
            'message', p_message
        ),
        false
    );
    
    RETURN QUERY SELECT true, v_sent_id, v_fan_balance - v_total_cost, NULL::TEXT;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT false, NULL::UUID, v_fan_balance, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Insert some default virtual gifts
INSERT INTO virtual_gifts (name, description, icon_url, token_cost, category, rarity) VALUES
    ('Rose', 'A beautiful red rose', '/gifts/rose.png', 1.00, 'flowers', 'common'),
    ('Heart', 'Show your love', '/gifts/heart.png', 2.00, 'emotions', 'common'),
    ('Star', 'You''re a star!', '/gifts/star.png', 5.00, 'appreciation', 'common'),
    ('Diamond', 'Precious like a diamond', '/gifts/diamond.png', 10.00, 'luxury', 'rare'),
    ('Crown', 'For the king/queen', '/gifts/crown.png', 25.00, 'luxury', 'epic'),
    ('Rocket', 'To the moon!', '/gifts/rocket.png', 50.00, 'special', 'epic'),
    ('Rainbow', 'Spread the colors', '/gifts/rainbow.png', 15.00, 'special', 'rare'),
    ('Champagne', 'Let''s celebrate!', '/gifts/champagne.png', 20.00, 'celebration', 'rare'),
    ('Trophy', 'You''re the champion', '/gifts/trophy.png', 30.00, 'achievement', 'epic'),
    ('Unicorn', 'Magical and rare', '/gifts/unicorn.png', 100.00, 'mythical', 'legendary')
ON CONFLICT (gift_id) DO NOTHING;

-- RLS Policies for Supabase
ALTER TABLE virtual_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_gift_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can view active gifts
CREATE POLICY "Public can view active gifts" ON virtual_gifts
    FOR SELECT USING (is_active = true);

-- Users can view gifts they sent
CREATE POLICY "Users can view their sent gifts" ON gifts_sent
    FOR SELECT USING (
        auth.uid() IN (
            SELECT supabase_id FROM users WHERE id = gifts_sent.fan_id
        )
    );

-- Creators can view gifts they received
CREATE POLICY "Creators can view received gifts" ON gifts_sent
    FOR SELECT USING (
        auth.uid() IN (
            SELECT supabase_id FROM users WHERE id = gifts_sent.creator_id
        )
    );

-- Users can view their gift transactions
CREATE POLICY "Users can view their gift transactions" ON gift_transactions
    FOR SELECT USING (
        auth.uid() IN (
            SELECT supabase_id FROM users WHERE id IN (gift_transactions.fan_id, gift_transactions.creator_id)
        )
    );

-- Creators can manage their gift settings
CREATE POLICY "Creators can manage their gift settings" ON creator_gift_settings
    FOR ALL USING (
        auth.uid() IN (
            SELECT supabase_id FROM users WHERE id = creator_gift_settings.creator_id AND is_creator = true
        )
    );

-- Comments
COMMENT ON TABLE virtual_gifts IS 'Catalog of virtual gifts available for purchase';
COMMENT ON TABLE gifts_sent IS 'Record of all gifts sent from fans to creators';
COMMENT ON TABLE gift_transactions IS 'Financial transactions for gift purchases';
COMMENT ON TABLE creator_gift_settings IS 'Per-creator gift preferences and settings';