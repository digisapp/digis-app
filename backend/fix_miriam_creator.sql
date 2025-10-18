-- Fix Miriam's account to be a creator
-- Run this to immediately update her account

-- Update Miriam to be a creator
UPDATE users
SET
  is_creator = true,
  role = 'creator',
  updated_at = NOW()
WHERE supabase_id = '963af068-edb0-4d12-8e8e-cfdb270eea26';

-- Verify the update
SELECT
  supabase_id,
  email,
  username,
  display_name,
  role,
  is_creator,
  video_rate_cents,
  voice_rate_cents,
  stream_rate_cents,
  message_price_cents,
  created_at,
  updated_at
FROM users
WHERE supabase_id = '963af068-edb0-4d12-8e8e-cfdb270eea26';
