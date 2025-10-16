-- Add avatar and card image columns to users table
-- Migration: 2025_10_15_avatar_card_columns.sql
-- Purpose: Add columns for user avatar and creator card images with timestamps

-- Add columns if they don't exist
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS card_image_url text,
ADD COLUMN IF NOT EXISTS avatar_updated_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS card_image_updated_at timestamptz DEFAULT now();

-- Add indexes for performance (optional but recommended for sorting/filtering)
CREATE INDEX IF NOT EXISTS idx_users_avatar_updated_at
ON public.users(avatar_updated_at DESC NULLS LAST)
WHERE avatar_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_card_updated_at
ON public.users(card_image_updated_at DESC NULLS LAST)
WHERE card_image_url IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.users.avatar_url IS 'Public URL to user avatar image (circular profile picture)';
COMMENT ON COLUMN public.users.card_image_url IS 'Public URL to creator card/banner image (vertical card)';
COMMENT ON COLUMN public.users.avatar_updated_at IS 'Timestamp of last avatar upload';
COMMENT ON COLUMN public.users.card_image_updated_at IS 'Timestamp of last card image upload';

-- Note: RLS policies are inherited from existing users table policies
-- Users can update their own avatar_url and card_image_url via the existing
-- "Users can update own profile" policy
