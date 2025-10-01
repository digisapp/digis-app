-- ============================================
-- CREATOR FAN NOTES FEATURE
-- Run this in your Supabase SQL Editor
-- ============================================

-- Create table for creators to store private notes about their fans
CREATE TABLE IF NOT EXISTS creator_fan_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  fan_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique notes per creator-fan pair
  UNIQUE(creator_id, fan_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_creator_fan_notes_creator ON creator_fan_notes(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_fan_notes_fan ON creator_fan_notes(fan_id);

-- Add comment
COMMENT ON TABLE creator_fan_notes IS 'Private notes that creators can keep about their fans for better relationship management';
COMMENT ON COLUMN creator_fan_notes.notes IS 'Private notes visible only to the creator';

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_creator_fan_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_creator_fan_notes_updated_at
BEFORE UPDATE ON creator_fan_notes
FOR EACH ROW
EXECUTE FUNCTION update_creator_fan_notes_updated_at();

-- Verify the table was created
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'creator_fan_notes'
ORDER BY ordinal_position;