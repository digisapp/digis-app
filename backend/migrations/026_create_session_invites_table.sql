-- Create session invites table
CREATE TABLE IF NOT EXISTS session_invites (
  id SERIAL PRIMARY KEY,
  session_uid VARCHAR(255) UNIQUE NOT NULL,
  creator_id INTEGER NOT NULL REFERENCES users(id),
  fan_id INTEGER NOT NULL REFERENCES users(id),
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

-- Create recurring schedules table
CREATE TABLE IF NOT EXISTS session_recurring_schedules (
  id SERIAL PRIMARY KEY,
  invite_id INTEGER NOT NULL REFERENCES session_invites(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  session_time TIME NOT NULL,
  sequence_number INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_recurring_schedule UNIQUE (invite_id, sequence_number)
);

-- Create indexes for recurring schedules
CREATE INDEX idx_recurring_schedules_invite_id ON session_recurring_schedules(invite_id);
CREATE INDEX idx_recurring_schedules_date ON session_recurring_schedules(session_date);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_session_invites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_session_invites_updated_at_trigger
BEFORE UPDATE ON session_invites
FOR EACH ROW
EXECUTE FUNCTION update_session_invites_updated_at();

-- Add RLS policies
ALTER TABLE session_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_recurring_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies for session_invites
CREATE POLICY session_invites_creator_access ON session_invites
FOR ALL USING (creator_id = current_setting('request.jwt.claims')::json->>'sub'::integer);

CREATE POLICY session_invites_fan_access ON session_invites
FOR SELECT USING (fan_id = current_setting('request.jwt.claims')::json->>'sub'::integer);

CREATE POLICY session_invites_fan_update ON session_invites
FOR UPDATE USING (fan_id = current_setting('request.jwt.claims')::json->>'sub'::integer)
WITH CHECK (fan_id = current_setting('request.jwt.claims')::json->>'sub'::integer);

-- RLS policies for recurring schedules
CREATE POLICY recurring_schedules_access ON session_recurring_schedules
FOR ALL USING (
  invite_id IN (
    SELECT id FROM session_invites 
    WHERE creator_id = current_setting('request.jwt.claims')::json->>'sub'::integer
    OR fan_id = current_setting('request.jwt.claims')::json->>'sub'::integer
  )
);