-- ============================================
-- Enhanced Avatar System Migration
-- ============================================
-- Adds multi-image gallery, cover photos, verification badges,
-- online status, and image optimization support
-- ============================================

-- Add cover photo and gallery images to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS cover_photo_url TEXT,
ADD COLUMN IF NOT EXISTS gallery_images JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS online_status VARCHAR(20) DEFAULT 'offline' CHECK (online_status IN ('online', 'busy', 'away', 'offline')),
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS profile_pic_sizes JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS cover_photo_sizes JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS tier_badge VARCHAR(20) CHECK (tier_badge IN ('bronze', 'silver', 'gold', 'platinum', 'diamond'));

-- Create image optimization tracking table
CREATE TABLE IF NOT EXISTS user_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    image_type VARCHAR(20) NOT NULL CHECK (image_type IN ('avatar', 'cover', 'gallery')),
    original_url TEXT NOT NULL,
    thumbnail_url TEXT,
    medium_url TEXT,
    large_url TEXT,
    webp_url TEXT,
    file_size INTEGER,
    width INTEGER,
    height INTEGER,
    format VARCHAR(10),
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster image queries
CREATE INDEX IF NOT EXISTS idx_user_images_user_id ON user_images(user_id);
CREATE INDEX IF NOT EXISTS idx_user_images_type ON user_images(image_type);
CREATE INDEX IF NOT EXISTS idx_users_online_status ON users(online_status);
CREATE INDEX IF NOT EXISTS idx_users_is_verified ON users(is_verified);

-- Function to update last_seen_at
CREATE OR REPLACE FUNCTION update_user_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.online_status = 'offline' AND OLD.online_status != 'offline' THEN
        NEW.last_seen_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for last_seen_at
DROP TRIGGER IF EXISTS update_last_seen_trigger ON users;
CREATE TRIGGER update_last_seen_trigger
BEFORE UPDATE ON users
FOR EACH ROW
WHEN (OLD.online_status IS DISTINCT FROM NEW.online_status)
EXECUTE FUNCTION update_user_last_seen();

-- Function to calculate tier badge based on earnings
CREATE OR REPLACE FUNCTION calculate_tier_badge()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.total_earnings >= 100000 THEN
        NEW.tier_badge = 'diamond';
    ELSIF NEW.total_earnings >= 50000 THEN
        NEW.tier_badge = 'platinum';
    ELSIF NEW.total_earnings >= 20000 THEN
        NEW.tier_badge = 'gold';
    ELSIF NEW.total_earnings >= 5000 THEN
        NEW.tier_badge = 'silver';
    ELSIF NEW.total_earnings >= 1000 THEN
        NEW.tier_badge = 'bronze';
    ELSE
        NEW.tier_badge = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tier badge calculation
DROP TRIGGER IF EXISTS calculate_tier_badge_trigger ON users;
CREATE TRIGGER calculate_tier_badge_trigger
BEFORE INSERT OR UPDATE OF total_earnings ON users
FOR EACH ROW
EXECUTE FUNCTION calculate_tier_badge();

-- Add comment for documentation
COMMENT ON COLUMN users.gallery_images IS 'Array of image URLs for creator gallery, max 5 images';
COMMENT ON COLUMN users.profile_pic_sizes IS 'JSON object with thumbnail, medium, large URLs';
COMMENT ON COLUMN users.is_verified IS 'Verified creator status';
COMMENT ON COLUMN users.online_status IS 'Current online status: online, busy, away, offline';
COMMENT ON COLUMN users.tier_badge IS 'Achievement badge based on total earnings';