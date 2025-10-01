-- Create classes table for live streaming classes
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  max_participants INTEGER NOT NULL DEFAULT 20,
  token_price DECIMAL(10, 2) NOT NULL DEFAULT 15,
  tags JSONB DEFAULT '[]',
  requirements TEXT,
  what_to_expect TEXT,
  cover_image_url TEXT,
  is_live BOOLEAN DEFAULT FALSE,
  recording_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create class participants table
CREATE TABLE IF NOT EXISTS class_participants (
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'joined', -- joined, left, kicked
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(class_id, user_id)
);

-- Create class reviews table
CREATE TABLE IF NOT EXISTS class_reviews (
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(class_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX idx_classes_creator_id ON classes(creator_id);
CREATE INDEX idx_classes_start_time ON classes(start_time);
CREATE INDEX idx_classes_category ON classes(category);
CREATE INDEX idx_class_participants_class_id ON class_participants(class_id);
CREATE INDEX idx_class_participants_user_id ON class_participants(user_id);
CREATE INDEX idx_class_reviews_class_id ON class_reviews(class_id);
CREATE INDEX idx_class_reviews_creator_id ON class_reviews(creator_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();