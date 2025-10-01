-- Create digitals table for model portfolio photos and videos
CREATE TABLE IF NOT EXISTS digitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  title VARCHAR(255),
  description TEXT,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('image', 'video')),
  category VARCHAR(100) DEFAULT 'general',
  tags TEXT[],
  
  -- Metadata
  width INTEGER,
  height INTEGER,
  duration INTEGER, -- for videos, in seconds
  file_size BIGINT,
  mime_type VARCHAR(100),
  
  -- Settings
  is_public BOOLEAN DEFAULT true,
  allow_download BOOLEAN DEFAULT false,
  watermarked BOOLEAN DEFAULT false,
  
  -- Stats
  view_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  
  -- Ordering
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create digital categories table
CREATE TABLE IF NOT EXISTS digital_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(creator_id, slug)
);

-- Create digital views tracking table  
CREATE TABLE IF NOT EXISTS digital_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  digital_id UUID NOT NULL REFERENCES digitals(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES users(supabase_id) ON DELETE SET NULL,
  viewer_type VARCHAR(50), -- 'agency', 'brand', 'scout', 'public'
  viewer_info JSONB, -- Store additional info like company name
  ip_address INET,
  user_agent TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create digitals access table for private sharing
CREATE TABLE IF NOT EXISTS digital_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  access_code VARCHAR(20) UNIQUE NOT NULL,
  password VARCHAR(255),
  recipient_email VARCHAR(255),
  recipient_name VARCHAR(255),
  recipient_company VARCHAR(255),
  access_type VARCHAR(50) DEFAULT 'view', -- 'view', 'download'
  expires_at TIMESTAMP WITH TIME ZONE,
  max_views INTEGER,
  current_views INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_digitals_creator_id ON digitals(creator_id);
CREATE INDEX IF NOT EXISTS idx_digitals_category ON digitals(category);
CREATE INDEX IF NOT EXISTS idx_digitals_is_public ON digitals(is_public);
CREATE INDEX IF NOT EXISTS idx_digitals_created_at ON digitals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_digital_categories_creator_id ON digital_categories(creator_id);
CREATE INDEX IF NOT EXISTS idx_digital_views_digital_id ON digital_views(digital_id);
CREATE INDEX IF NOT EXISTS idx_digital_views_viewer_id ON digital_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_digital_views_viewed_at ON digital_views(viewed_at);

-- Add RLS policies
ALTER TABLE digitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_access ENABLE ROW LEVEL SECURITY;

-- Policies for digitals
CREATE POLICY "Public digitals are viewable by everyone" ON digitals
  FOR SELECT USING (is_public = true);

CREATE POLICY "Creators can manage their own digitals" ON digitals
  FOR ALL USING (auth.uid() = creator_id);

-- Policies for categories
CREATE POLICY "Categories are viewable by everyone" ON digital_categories
  FOR SELECT USING (true);

CREATE POLICY "Creators can manage their own categories" ON digital_categories
  FOR ALL USING (auth.uid() = creator_id);

-- Policies for views (creators can see their own analytics)
CREATE POLICY "Creators can view their digital analytics" ON digital_views
  FOR SELECT USING (
    digital_id IN (SELECT id FROM digitals WHERE creator_id = auth.uid())
  );

-- Policies for access codes
CREATE POLICY "Creators can manage their access codes" ON digital_access
  FOR ALL USING (auth.uid() = creator_id);