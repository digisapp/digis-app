-- Add attendance tracking fields to class_participants
ALTER TABLE class_participants
ADD COLUMN IF NOT EXISTS attended BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS attended_at TIMESTAMP WITH TIME ZONE;

-- Create class_materials table for pre/post class resources
CREATE TABLE IF NOT EXISTS class_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50), -- 'pdf', 'video', 'image', 'document'
  material_type VARCHAR(20) NOT NULL, -- 'pre-class' or 'post-class'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create recording_access table for granting replay access
CREATE TABLE IF NOT EXISTS recording_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id INTEGER NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(recording_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_class_materials_class_id ON class_materials(class_id);
CREATE INDEX IF NOT EXISTS idx_class_materials_type ON class_materials(material_type);
CREATE INDEX IF NOT EXISTS idx_recording_access_recording_id ON recording_access(recording_id);
CREATE INDEX IF NOT EXISTS idx_recording_access_user_id ON recording_access(user_id);
CREATE INDEX IF NOT EXISTS idx_class_participants_attended ON class_participants(class_id, attended);

-- Add comment
COMMENT ON TABLE class_materials IS 'Stores pre-class and post-class materials/resources for classes';
COMMENT ON TABLE recording_access IS 'Tracks which users have free access to class recording replays';
COMMENT ON COLUMN class_participants.attended IS 'True if user joined the live stream';
COMMENT ON COLUMN class_participants.attended_at IS 'Timestamp when user joined the class stream';
