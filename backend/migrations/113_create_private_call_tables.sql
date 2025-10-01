-- Create private call requests table
CREATE TABLE IF NOT EXISTS private_call_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id VARCHAR(255) NOT NULL,
    fan_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    price_per_minute DECIMAL(10,2) NOT NULL,
    minimum_minutes INTEGER DEFAULT 5,
    estimated_duration INTEGER DEFAULT 10,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
    token_hold_amount INTEGER NOT NULL, -- Tokens to hold/reserve
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '2 minutes'),
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create private call sessions table
CREATE TABLE IF NOT EXISTS private_call_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES private_call_requests(id) ON DELETE SET NULL,
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    fan_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    channel_name VARCHAR(255) NOT NULL UNIQUE,
    price_per_minute DECIMAL(10,2) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    total_cost DECIMAL(10,2) DEFAULT 0,
    tokens_charged INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'failed')),
    end_reason VARCHAR(50), -- 'user_ended', 'creator_ended', 'tokens_depleted', 'technical_error'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_private_call_requests_stream ON private_call_requests(stream_id);
CREATE INDEX idx_private_call_requests_fan ON private_call_requests(fan_id);
CREATE INDEX idx_private_call_requests_creator ON private_call_requests(creator_id);
CREATE INDEX idx_private_call_requests_status ON private_call_requests(status);
CREATE INDEX idx_private_call_requests_expires ON private_call_requests(expires_at);

CREATE INDEX idx_private_call_sessions_creator ON private_call_sessions(creator_id);
CREATE INDEX idx_private_call_sessions_fan ON private_call_sessions(fan_id);
CREATE INDEX idx_private_call_sessions_status ON private_call_sessions(status);
CREATE INDEX idx_private_call_sessions_channel ON private_call_sessions(channel_name);

-- Add triggers for updated_at
CREATE TRIGGER update_private_call_requests_updated_at BEFORE UPDATE
    ON private_call_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_private_call_sessions_updated_at BEFORE UPDATE
    ON private_call_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE private_call_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_call_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own private call requests
CREATE POLICY "Users can view their private call requests"
    ON private_call_requests FOR SELECT
    USING (creator_id = auth.uid() OR fan_id = auth.uid());

-- Fans can insert private call requests
CREATE POLICY "Fans can create private call requests"
    ON private_call_requests FOR INSERT
    WITH CHECK (fan_id = auth.uid());

-- Creators can update their own private call requests
CREATE POLICY "Creators can respond to private call requests"
    ON private_call_requests FOR UPDATE
    USING (creator_id = auth.uid());

-- Users can view their own private call sessions
CREATE POLICY "Users can view their private call sessions"
    ON private_call_sessions FOR SELECT
    USING (creator_id = auth.uid() OR fan_id = auth.uid());

-- Only system can create/update private call sessions
CREATE POLICY "System manages private call sessions"
    ON private_call_sessions FOR ALL
    USING (false)
    WITH CHECK (false);

-- Add columns to sessions table for private calls
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_private_call BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS private_call_session_id UUID REFERENCES private_call_sessions(id);