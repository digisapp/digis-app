-- Create creator_content table for pay-per-view content
CREATE TABLE IF NOT EXISTS creator_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id),
  content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('video', 'photo', 'audio', 'class', 'stream', 'picture')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  content_url TEXT,
  price INTEGER DEFAULT 0, -- Price in tokens
  duration INTEGER, -- Duration in seconds for videos
  file_size BIGINT,
  mime_type VARCHAR(100),
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_downloadable BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create content_purchases table to track who bought what
CREATE TABLE IF NOT EXISTS content_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(supabase_id),
  content_id UUID NOT NULL REFERENCES creator_content(id),
  creator_id UUID NOT NULL REFERENCES users(supabase_id),
  price INTEGER NOT NULL, -- Price paid at time of purchase
  purchased_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, content_id) -- Prevent duplicate purchases
);

-- Create content_likes table
CREATE TABLE IF NOT EXISTS content_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(supabase_id),
  content_id UUID NOT NULL REFERENCES creator_content(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);

-- Create content_views table for tracking views
CREATE TABLE IF NOT EXISTS content_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  content_id UUID NOT NULL REFERENCES creator_content(id),
  viewed_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_creator_content_creator ON creator_content(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_content_type ON creator_content(content_type);
CREATE INDEX IF NOT EXISTS idx_creator_content_active ON creator_content(is_active);
CREATE INDEX IF NOT EXISTS idx_content_purchases_user ON content_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_content_purchases_content ON content_purchases(content_id);
CREATE INDEX IF NOT EXISTS idx_content_likes_user ON content_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_content_likes_content ON content_likes(content_id);
CREATE INDEX IF NOT EXISTS idx_content_views_content ON content_views(content_id);

-- Add RLS policies
ALTER TABLE creator_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_views ENABLE ROW LEVEL SECURITY;

-- Creators can manage their own content
CREATE POLICY "Creators can manage own content" ON creator_content
  FOR ALL USING (creator_id = auth.uid());

-- Anyone can view active content
CREATE POLICY "Anyone can view active content" ON creator_content
  FOR SELECT USING (is_active = true);

-- Users can view their own purchases
CREATE POLICY "Users can view own purchases" ON content_purchases
  FOR SELECT USING (user_id = auth.uid());

-- Users can manage their own likes
CREATE POLICY "Users can manage own likes" ON content_likes
  FOR ALL USING (user_id = auth.uid());

-- Anyone can insert views
CREATE POLICY "Anyone can insert views" ON content_views
  FOR INSERT WITH CHECK (true);