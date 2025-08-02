-- Integration of Tips and Gifts with Live Chat and Streaming
-- This migration enhances chat messages and streams to support tips and gifts

-- Add support for tips and gifts in chat messages
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'text',
ADD COLUMN IF NOT EXISTS tip_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS gift_sent_id UUID,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD CONSTRAINT fk_chat_tip FOREIGN KEY (tip_id) REFERENCES tips(tip_id) ON DELETE SET NULL,
ADD CONSTRAINT fk_chat_gift FOREIGN KEY (gift_sent_id) REFERENCES gifts_sent(sent_id) ON DELETE SET NULL,
ADD CONSTRAINT chk_message_type CHECK (message_type IN ('text', 'tip', 'gift', 'system', 'announcement'));

-- Create streams table if not exists
CREATE TABLE IF NOT EXISTS streams (
    id SERIAL PRIMARY KEY,
    stream_id UUID UNIQUE DEFAULT gen_random_uuid(),
    creator_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url VARCHAR(500),
    agora_channel VARCHAR(255) UNIQUE,
    stream_key VARCHAR(255) UNIQUE DEFAULT gen_random_uuid()::text,
    status VARCHAR(20) DEFAULT 'preparing',
    category VARCHAR(50),
    is_private BOOLEAN DEFAULT false,
    viewer_count INTEGER DEFAULT 0,
    peak_viewer_count INTEGER DEFAULT 0,
    tips_enabled BOOLEAN DEFAULT true,
    gifts_enabled BOOLEAN DEFAULT true,
    chat_enabled BOOLEAN DEFAULT true,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign keys
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT chk_stream_status CHECK (status IN ('preparing', 'live', 'ended', 'cancelled'))
);

-- Stream viewers tracking
CREATE TABLE IF NOT EXISTS stream_viewers (
    id SERIAL PRIMARY KEY,
    stream_id UUID NOT NULL,
    viewer_id INTEGER NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    watch_duration_seconds INTEGER DEFAULT 0,
    
    -- Foreign keys
    FOREIGN KEY (stream_id) REFERENCES streams(stream_id) ON DELETE CASCADE,
    FOREIGN KEY (viewer_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Unique constraint to prevent duplicate active viewers
    CONSTRAINT uk_stream_viewer UNIQUE (stream_id, viewer_id, left_at)
);

-- Stream chat messages (separate from direct messages)
CREATE TABLE IF NOT EXISTS stream_messages (
    id SERIAL PRIMARY KEY,
    message_id UUID UNIQUE DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL,
    sender_id INTEGER NOT NULL,
    content TEXT,
    message_type VARCHAR(20) DEFAULT 'text',
    tip_id VARCHAR(255),
    gift_sent_id UUID,
    is_highlighted BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign keys
    FOREIGN KEY (stream_id) REFERENCES streams(stream_id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tip_id) REFERENCES tips(tip_id) ON DELETE SET NULL,
    FOREIGN KEY (gift_sent_id) REFERENCES gifts_sent(sent_id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT chk_stream_message_type CHECK (message_type IN ('text', 'tip', 'gift', 'system', 'announcement', 'join', 'leave'))
);

-- Stream analytics
CREATE TABLE IF NOT EXISTS stream_analytics (
    id SERIAL PRIMARY KEY,
    stream_id UUID NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    viewer_count INTEGER DEFAULT 0,
    chat_message_count INTEGER DEFAULT 0,
    tip_count INTEGER DEFAULT 0,
    tip_amount DECIMAL(10,2) DEFAULT 0,
    gift_count INTEGER DEFAULT 0,
    gift_amount DECIMAL(10,2) DEFAULT 0,
    new_followers INTEGER DEFAULT 0,
    
    -- Foreign keys
    FOREIGN KEY (stream_id) REFERENCES streams(stream_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_type ON chat_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tip_id ON chat_messages(tip_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_gift_id ON chat_messages(gift_sent_id);
CREATE INDEX IF NOT EXISTS idx_streams_creator_id ON streams(creator_id);
CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status);
CREATE INDEX IF NOT EXISTS idx_streams_agora_channel ON streams(agora_channel);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_stream_id ON stream_viewers(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_viewer_id ON stream_viewers(viewer_id);
CREATE INDEX IF NOT EXISTS idx_stream_messages_stream_id ON stream_messages(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_messages_sender_id ON stream_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_stream_messages_created_at ON stream_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_stream_id ON stream_analytics(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_timestamp ON stream_analytics(timestamp);

-- Function to create a chat message with tip
CREATE OR REPLACE FUNCTION create_tip_message(
    p_sender_id INTEGER,
    p_receiver_id INTEGER,
    p_tip_id VARCHAR(255),
    p_amount DECIMAL,
    p_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_message_id UUID;
    v_sender_name VARCHAR(255);
BEGIN
    -- Get sender name
    SELECT COALESCE(display_name, username) INTO v_sender_name
    FROM users WHERE id = p_sender_id;
    
    -- Create chat message
    INSERT INTO chat_messages (
        sender_id, receiver_id, content, message_type, tip_id, metadata
    ) VALUES (
        p_sender_id, 
        p_receiver_id,
        COALESCE(p_message, v_sender_name || ' sent you ' || p_amount || ' tokens'),
        'tip',
        p_tip_id,
        jsonb_build_object(
            'amount', p_amount,
            'original_message', p_message
        )
    ) RETURNING id INTO v_message_id;
    
    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create a chat message with gift
CREATE OR REPLACE FUNCTION create_gift_message(
    p_sender_id INTEGER,
    p_receiver_id INTEGER,
    p_gift_sent_id UUID,
    p_gift_name VARCHAR(255),
    p_quantity INTEGER,
    p_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_message_id UUID;
    v_sender_name VARCHAR(255);
BEGIN
    -- Get sender name
    SELECT COALESCE(display_name, username) INTO v_sender_name
    FROM users WHERE id = p_sender_id;
    
    -- Create chat message
    INSERT INTO chat_messages (
        sender_id, receiver_id, content, message_type, gift_sent_id, metadata
    ) VALUES (
        p_sender_id, 
        p_receiver_id,
        COALESCE(p_message, v_sender_name || ' sent you ' || p_quantity || 'x ' || p_gift_name),
        'gift',
        p_gift_sent_id,
        jsonb_build_object(
            'gift_name', p_gift_name,
            'quantity', p_quantity,
            'original_message', p_message
        )
    ) RETURNING id INTO v_message_id;
    
    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create a stream message with tip
CREATE OR REPLACE FUNCTION create_stream_tip_message(
    p_stream_id UUID,
    p_sender_id INTEGER,
    p_tip_id VARCHAR(255),
    p_amount DECIMAL,
    p_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_message_id UUID;
    v_sender_name VARCHAR(255);
BEGIN
    -- Get sender name
    SELECT COALESCE(display_name, username) INTO v_sender_name
    FROM users WHERE id = p_sender_id;
    
    -- Create stream message
    v_message_id := gen_random_uuid();
    
    INSERT INTO stream_messages (
        message_id, stream_id, sender_id, content, message_type, 
        tip_id, is_highlighted, metadata
    ) VALUES (
        v_message_id,
        p_stream_id,
        p_sender_id,
        COALESCE(p_message, v_sender_name || ' tipped ' || p_amount || ' tokens'),
        'tip',
        p_tip_id,
        true, -- Highlight tip messages
        jsonb_build_object(
            'amount', p_amount,
            'original_message', p_message
        )
    );
    
    -- Update stream analytics
    UPDATE stream_analytics
    SET tip_count = tip_count + 1,
        tip_amount = tip_amount + p_amount
    WHERE stream_id = p_stream_id
      AND timestamp >= DATE_TRUNC('hour', NOW());
    
    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create a stream message with gift
CREATE OR REPLACE FUNCTION create_stream_gift_message(
    p_stream_id UUID,
    p_sender_id INTEGER,
    p_gift_sent_id UUID,
    p_gift_name VARCHAR(255),
    p_quantity INTEGER,
    p_amount DECIMAL,
    p_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_message_id UUID;
    v_sender_name VARCHAR(255);
BEGIN
    -- Get sender name
    SELECT COALESCE(display_name, username) INTO v_sender_name
    FROM users WHERE id = p_sender_id;
    
    -- Create stream message
    v_message_id := gen_random_uuid();
    
    INSERT INTO stream_messages (
        message_id, stream_id, sender_id, content, message_type, 
        gift_sent_id, is_highlighted, metadata
    ) VALUES (
        v_message_id,
        p_stream_id,
        p_sender_id,
        COALESCE(p_message, v_sender_name || ' sent ' || p_quantity || 'x ' || p_gift_name),
        'gift',
        p_gift_sent_id,
        true, -- Highlight gift messages
        jsonb_build_object(
            'gift_name', p_gift_name,
            'quantity', p_quantity,
            'amount', p_amount,
            'original_message', p_message
        )
    );
    
    -- Update stream analytics
    UPDATE stream_analytics
    SET gift_count = gift_count + 1,
        gift_amount = gift_amount + p_amount
    WHERE stream_id = p_stream_id
      AND timestamp >= DATE_TRUNC('hour', NOW());
    
    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stream analytics on new viewer
CREATE OR REPLACE FUNCTION update_stream_viewer_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Update current viewer count
        UPDATE streams
        SET viewer_count = (
            SELECT COUNT(DISTINCT viewer_id)
            FROM stream_viewers
            WHERE stream_id = NEW.stream_id
              AND left_at IS NULL
        ),
        updated_at = NOW()
        WHERE stream_id = NEW.stream_id;
        
        -- Update peak viewer count if necessary
        UPDATE streams
        SET peak_viewer_count = GREATEST(peak_viewer_count, viewer_count)
        WHERE stream_id = NEW.stream_id;
        
    ELSIF TG_OP = 'UPDATE' AND NEW.left_at IS NOT NULL AND OLD.left_at IS NULL THEN
        -- Update viewer count when someone leaves
        UPDATE streams
        SET viewer_count = GREATEST(0, viewer_count - 1),
            updated_at = NOW()
        WHERE stream_id = NEW.stream_id;
        
        -- Update watch duration
        NEW.watch_duration_seconds = EXTRACT(EPOCH FROM (NEW.left_at - NEW.joined_at))::INTEGER;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stream_viewers_trigger
AFTER INSERT OR UPDATE ON stream_viewers
FOR EACH ROW EXECUTE FUNCTION update_stream_viewer_count();

-- RLS Policies
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_analytics ENABLE ROW LEVEL SECURITY;

-- Everyone can view public streams
CREATE POLICY "Public can view live streams" ON streams
    FOR SELECT USING (is_private = false AND status = 'live');

-- Creators can manage their own streams
CREATE POLICY "Creators can manage their streams" ON streams
    FOR ALL USING (
        auth.uid() IN (
            SELECT supabase_id FROM users WHERE id = streams.creator_id
        )
    );

-- Viewers can view streams they have access to
CREATE POLICY "Viewers can access joined streams" ON stream_viewers
    FOR ALL USING (
        auth.uid() IN (
            SELECT supabase_id FROM users WHERE id = stream_viewers.viewer_id
        )
    );

-- Users can view messages in streams they're watching
CREATE POLICY "Users can view stream messages" ON stream_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM stream_viewers sv
            JOIN users u ON sv.viewer_id = u.id
            WHERE sv.stream_id = stream_messages.stream_id
              AND u.supabase_id = auth.uid()
        )
    );

-- Users can send messages in streams they're watching
CREATE POLICY "Users can send stream messages" ON stream_messages
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT supabase_id FROM users WHERE id = stream_messages.sender_id
        )
        AND EXISTS (
            SELECT 1 FROM stream_viewers sv
            WHERE sv.stream_id = stream_messages.stream_id
              AND sv.viewer_id = stream_messages.sender_id
              AND sv.left_at IS NULL
        )
    );

-- Creators can view their stream analytics
CREATE POLICY "Creators can view stream analytics" ON stream_analytics
    FOR SELECT USING (
        auth.uid() IN (
            SELECT u.supabase_id 
            FROM streams s
            JOIN users u ON s.creator_id = u.id
            WHERE s.stream_id = stream_analytics.stream_id
        )
    );

-- Comments
COMMENT ON TABLE streams IS 'Live streaming sessions';
COMMENT ON TABLE stream_viewers IS 'Track viewers in live streams';
COMMENT ON TABLE stream_messages IS 'Chat messages in live streams';
COMMENT ON TABLE stream_analytics IS 'Real-time analytics for streams';
COMMENT ON COLUMN chat_messages.message_type IS 'Type of message: text, tip, gift, system, announcement';
COMMENT ON COLUMN stream_messages.is_highlighted IS 'Whether message should be highlighted (tips/gifts are auto-highlighted)';