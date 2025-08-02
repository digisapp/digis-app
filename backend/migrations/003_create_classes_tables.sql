-- Migration: Create classes and related tables
-- Created: 2025-07-23

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
    id SERIAL PRIMARY KEY,
    creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    max_participants INTEGER NOT NULL DEFAULT 50,
    token_price DECIMAL(10, 2) NOT NULL,
    tags JSONB DEFAULT '[]',
    is_live BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Class participants table
CREATE TABLE IF NOT EXISTS class_participants (
    id SERIAL PRIMARY KEY,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'joined',
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(class_id, user_id)
);

-- Class reviews table
CREATE TABLE IF NOT EXISTS class_reviews (
    id SERIAL PRIMARY KEY,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(class_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_classes_creator_id ON classes(creator_id);
CREATE INDEX IF NOT EXISTS idx_classes_start_time ON classes(start_time);
CREATE INDEX IF NOT EXISTS idx_classes_category ON classes(category);
CREATE INDEX IF NOT EXISTS idx_class_participants_class_id ON class_participants(class_id);
CREATE INDEX IF NOT EXISTS idx_class_participants_user_id ON class_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_class_reviews_class_id ON class_reviews(class_id);
CREATE INDEX IF NOT EXISTS idx_class_reviews_creator_id ON class_reviews(creator_id);

-- Add some sample categories for reference
COMMENT ON COLUMN classes.category IS 'Categories: fitness, wellness, fashion, business, creative, cooking, tech, music';

-- Insert migration record
INSERT INTO migrations (version, name, executed_at) 
VALUES (3, '003_create_classes_tables', NOW())
ON CONFLICT (version) DO NOTHING;