-- Migration: Create Content Management Tables for Supabase Storage
-- This migration creates all necessary tables for creator content management

-- Create creator_content table
CREATE TABLE IF NOT EXISTS creator_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('photo', 'video')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  content_url TEXT NOT NULL,
  price INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  file_size BIGINT,
  mime_type VARCHAR(100),
  bundle_id UUID,
  is_premium BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  category VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create content_purchases table
CREATE TABLE IF NOT EXISTS content_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  content_id UUID NOT NULL REFERENCES creator_content(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL,
  price INTEGER NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create content_likes table
CREATE TABLE IF NOT EXISTS content_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  content_id UUID NOT NULL REFERENCES creator_content(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);

-- Create content_bundles table (for bulk uploads)
CREATE TABLE IF NOT EXISTS content_bundles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  is_premium BOOLEAN DEFAULT FALSE,
  price INTEGER DEFAULT 0,
  photo_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_creator_content_creator_id ON creator_content(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_content_type ON creator_content(content_type);
CREATE INDEX IF NOT EXISTS idx_creator_content_active ON creator_content(is_active);
CREATE INDEX IF NOT EXISTS idx_content_purchases_user_id ON content_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_content_purchases_content_id ON content_purchases(content_id);
CREATE INDEX IF NOT EXISTS idx_content_purchases_creator_id ON content_purchases(creator_id);
CREATE INDEX IF NOT EXISTS idx_content_likes_user_id ON content_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_content_likes_content_id ON content_likes(content_id);
CREATE INDEX IF NOT EXISTS idx_content_bundles_creator_id ON content_bundles(creator_id);

-- Add comment for documentation
COMMENT ON TABLE creator_content IS 'Stores creator uploaded photos and videos with metadata';
COMMENT ON TABLE content_purchases IS 'Tracks user purchases of creator content';
COMMENT ON TABLE content_likes IS 'Stores user likes for creator content';
COMMENT ON TABLE content_bundles IS 'Groups multiple photos/videos into bundles';
