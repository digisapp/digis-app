-- Create co-host requests table
CREATE TABLE IF NOT EXISTS co_host_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL,
    requester_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    responded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_stream_requester UNIQUE (stream_id, requester_id)
);

-- Create active co-hosts table
CREATE TABLE IF NOT EXISTS stream_co_hosts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL,
    co_host_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT NOW(),
    left_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_stream_cohost UNIQUE (stream_id, co_host_id)
);

-- Create indexes for performance
CREATE INDEX idx_co_host_requests_stream ON co_host_requests(stream_id);
CREATE INDEX idx_co_host_requests_requester ON co_host_requests(requester_id);
CREATE INDEX idx_co_host_requests_creator ON co_host_requests(creator_id);
CREATE INDEX idx_co_host_requests_status ON co_host_requests(status);
CREATE INDEX idx_stream_co_hosts_stream ON stream_co_hosts(stream_id);
CREATE INDEX idx_stream_co_hosts_co_host ON stream_co_hosts(co_host_id);
CREATE INDEX idx_stream_co_hosts_active ON stream_co_hosts(is_active);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_co_host_requests_updated_at BEFORE UPDATE
    ON co_host_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stream_co_hosts_updated_at BEFORE UPDATE
    ON stream_co_hosts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE co_host_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_co_hosts ENABLE ROW LEVEL SECURITY;

-- Creators can view their own co-host requests
CREATE POLICY "Creators can view their co-host requests"
    ON co_host_requests FOR SELECT
    USING (creator_id = auth.uid() OR requester_id = auth.uid());

-- Creators can update their own co-host requests
CREATE POLICY "Creators can update their co-host requests"
    ON co_host_requests FOR UPDATE
    USING (creator_id = auth.uid());

-- Verified creators can insert co-host requests
CREATE POLICY "Verified creators can request co-host"
    ON co_host_requests FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE supabase_id = auth.uid() 
            AND is_creator = true
        )
    );

-- Anyone can view active co-hosts for public streams
CREATE POLICY "Public can view stream co-hosts"
    ON stream_co_hosts FOR SELECT
    USING (true);

-- Creators can manage their stream co-hosts
CREATE POLICY "Creators can manage stream co-hosts"
    ON stream_co_hosts FOR ALL
    USING (creator_id = auth.uid());