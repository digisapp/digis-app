-- Migration: Create content_bundles table for bulk photo uploads
-- This allows creators to upload multiple photos as a single bundle with one price

-- Create content_bundles table
CREATE TABLE IF NOT EXISTS content_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'general',
  is_premium BOOLEAN DEFAULT FALSE,
  price DECIMAL(10, 2) DEFAULT 0,
  photo_count INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_bundle_creator FOREIGN KEY (creator_id)
    REFERENCES users(id) ON DELETE CASCADE
);

-- Add bundle_id column to creator_content table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'creator_content' AND column_name = 'bundle_id'
  ) THEN
    ALTER TABLE creator_content
    ADD COLUMN bundle_id UUID REFERENCES content_bundles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add category column to creator_content if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'creator_content' AND column_name = 'category'
  ) THEN
    ALTER TABLE creator_content
    ADD COLUMN category VARCHAR(100) DEFAULT 'general';
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_content_bundles_creator
  ON content_bundles(creator_id);

CREATE INDEX IF NOT EXISTS idx_content_bundles_created
  ON content_bundles(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_bundles_premium
  ON content_bundles(is_premium) WHERE is_premium = TRUE;

CREATE INDEX IF NOT EXISTS idx_creator_content_bundle
  ON creator_content(bundle_id) WHERE bundle_id IS NOT NULL;

-- Create updated_at trigger for content_bundles
CREATE OR REPLACE FUNCTION update_content_bundles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_content_bundles_updated_at
  BEFORE UPDATE ON content_bundles
  FOR EACH ROW
  EXECUTE FUNCTION update_content_bundles_updated_at();

-- Add comment describing the table
COMMENT ON TABLE content_bundles IS 'Stores photo bundles for creators - allows selling multiple photos as a single package';
COMMENT ON COLUMN content_bundles.is_premium IS 'If true, fans must pay the bundle price to unlock all photos';
COMMENT ON COLUMN content_bundles.price IS 'Price in tokens to unlock the entire bundle';
COMMENT ON COLUMN content_bundles.photo_count IS 'Number of photos in this bundle';
