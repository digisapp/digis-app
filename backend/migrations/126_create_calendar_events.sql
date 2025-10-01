-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create calendar events table for syncing accepted calls and classes
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    fan_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('video', 'voice', 'call', 'class', 'stream', 'custom')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
    reference_id UUID, -- ID of the related request/invite/class
    reference_type VARCHAR(50), -- 'private_call_request', 'session_invite', 'class', etc.
    location VARCHAR(255),
    meeting_link TEXT,
    reminder_sent BOOLEAN DEFAULT false,
    reminder_sent_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_calendar_events_creator ON calendar_events(creator_id);
CREATE INDEX idx_calendar_events_fan ON calendar_events(fan_id);
CREATE INDEX idx_calendar_events_date ON calendar_events(scheduled_date);
CREATE INDEX idx_calendar_events_status ON calendar_events(status);
CREATE INDEX idx_calendar_events_reference ON calendar_events(reference_id, reference_type);

-- Add trigger for updated_at
CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE
    ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own calendar events
CREATE POLICY "Users can view their calendar events"
    ON calendar_events FOR SELECT
    USING (creator_id = auth.uid() OR fan_id = auth.uid());

-- Creators can insert their own calendar events
CREATE POLICY "Creators can create calendar events"
    ON calendar_events FOR INSERT
    WITH CHECK (creator_id = auth.uid());

-- Creators can update their own calendar events
CREATE POLICY "Creators can update their calendar events"
    ON calendar_events FOR UPDATE
    USING (creator_id = auth.uid());

-- Creators can delete their own calendar events
CREATE POLICY "Creators can delete their calendar events"
    ON calendar_events FOR DELETE
    USING (creator_id = auth.uid());