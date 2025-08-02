-- Create tables for creator content (pay-per-view pictures and videos)

-- Creator content table
CREATE TABLE IF NOT EXISTS creator_content (
    id VARCHAR(255) PRIMARY KEY,
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('picture', 'video')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url TEXT NOT NULL,
    content_url TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 10.00,
    duration VARCHAR(20), -- For videos only (e.g., "5:30")
    file_size BIGINT,
    mime_type VARCHAR(100),
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    purchases INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT chk_price_positive CHECK (price >= 0)
);

-- Content purchases table
CREATE TABLE IF NOT EXISTS content_purchases (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    content_id VARCHAR(255) NOT NULL REFERENCES creator_content(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    price DECIMAL(10,2) NOT NULL,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate purchases
    UNIQUE(user_id, content_id)
);

-- Content likes table
CREATE TABLE IF NOT EXISTS content_likes (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    content_id VARCHAR(255) NOT NULL REFERENCES creator_content(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate likes
    UNIQUE(user_id, content_id)
);

-- Content views tracking
CREATE TABLE IF NOT EXISTS content_views (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    content_id VARCHAR(255) NOT NULL REFERENCES creator_content(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_creator_content_creator_id ON creator_content(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_content_type ON creator_content(content_type);
CREATE INDEX IF NOT EXISTS idx_creator_content_created_at ON creator_content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_content_price ON creator_content(price);
CREATE INDEX IF NOT EXISTS idx_creator_content_active ON creator_content(is_active);

CREATE INDEX IF NOT EXISTS idx_content_purchases_user_id ON content_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_content_purchases_creator_id ON content_purchases(creator_id);
CREATE INDEX IF NOT EXISTS idx_content_purchases_purchased_at ON content_purchases(purchased_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_likes_content_id ON content_likes(content_id);
CREATE INDEX IF NOT EXISTS idx_content_views_content_id ON content_views(content_id);

-- Add RLS policies
ALTER TABLE creator_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_views ENABLE ROW LEVEL SECURITY;

-- Creators can manage their own content
CREATE POLICY "Creators can view own content" ON creator_content
    FOR SELECT USING (creator_id = auth.uid());

CREATE POLICY "Creators can insert own content" ON creator_content
    FOR INSERT WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Creators can update own content" ON creator_content
    FOR UPDATE USING (creator_id = auth.uid());

CREATE POLICY "Creators can delete own content" ON creator_content
    FOR DELETE USING (creator_id = auth.uid());

-- Public can view active content metadata (not the actual content URL)
CREATE POLICY "Public can view content metadata" ON creator_content
    FOR SELECT USING (is_active = true);

-- Users can view their purchases
CREATE POLICY "Users can view own purchases" ON content_purchases
    FOR SELECT USING (user_id = auth.uid());

-- System can create purchases
CREATE POLICY "System can create purchases" ON content_purchases
    FOR INSERT WITH CHECK (true);

-- Users can manage their likes
CREATE POLICY "Users can view own likes" ON content_likes
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create likes" ON content_likes
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own likes" ON content_likes
    FOR DELETE USING (user_id = auth.uid());

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_creator_content_updated_at BEFORE UPDATE
    ON creator_content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE creator_content IS 'Stores pay-per-view content (pictures and videos) uploaded by creators';
COMMENT ON TABLE content_purchases IS 'Tracks which users have purchased which content';
COMMENT ON TABLE content_likes IS 'Tracks user likes on content';
COMMENT ON TABLE content_views IS 'Tracks content view analytics';