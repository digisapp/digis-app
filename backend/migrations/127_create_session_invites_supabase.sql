-- Create session invites table with Supabase IDs
CREATE TABLE IF NOT EXISTS session_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_uid VARCHAR(255) UNIQUE NOT NULL,
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  fan_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('video', 'voice')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  scheduled BOOLEAN DEFAULT false,
  scheduled_date DATE,
  scheduled_time TIME,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 180),
  rate_per_min DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  message TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurring_frequency VARCHAR(20) CHECK (recurring_frequency IN ('weekly', 'biweekly', 'monthly')),
  recurring_count INTEGER CHECK (recurring_count >= 1 AND recurring_count <= 12),
  preparations JSONB,
  package JSONB,
  request_intake_form BOOLEAN DEFAULT false,
  decline_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_schedule CHECK (
    (scheduled = false) OR 
    (scheduled = true AND scheduled_date IS NOT NULL AND scheduled_time IS NOT NULL)
  ),
  CONSTRAINT valid_recurring CHECK (
    (is_recurring = false) OR
    (is_recurring = true AND recurring_frequency IS NOT NULL AND recurring_count IS NOT NULL)
  )
);

-- Create indexes for performance
CREATE INDEX idx_session_invites_creator_id ON session_invites(creator_id);
CREATE INDEX idx_session_invites_fan_id ON session_invites(fan_id);
CREATE INDEX idx_session_invites_status ON session_invites(status);
CREATE INDEX idx_session_invites_scheduled_date ON session_invites(scheduled_date) WHERE scheduled = true;
CREATE INDEX idx_session_invites_created_at ON session_invites(created_at);

-- Create trigger to update updated_at
CREATE TRIGGER update_session_invites_updated_at BEFORE UPDATE
    ON session_invites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE session_invites ENABLE ROW LEVEL SECURITY;

-- Users can view their own session invites
CREATE POLICY "Users can view their session invites"
    ON session_invites FOR SELECT
    USING (creator_id = auth.uid() OR fan_id = auth.uid());

-- Creators can create session invites
CREATE POLICY "Creators can create session invites"
    ON session_invites FOR INSERT
    WITH CHECK (creator_id = auth.uid());

-- Creators can update their own session invites
CREATE POLICY "Creators can update their session invites"
    ON session_invites FOR UPDATE
    USING (creator_id = auth.uid());

-- Fans can update invites sent to them
CREATE POLICY "Fans can respond to session invites"
    ON session_invites FOR UPDATE
    USING (fan_id = auth.uid());