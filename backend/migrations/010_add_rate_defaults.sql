-- Migration: Add default values to rate columns
-- Prevents NULL constraint violations when inserting users

-- Add default values (0 cents = free by default)
ALTER TABLE users
  ALTER COLUMN video_rate_cents SET DEFAULT 0,
  ALTER COLUMN voice_rate_cents SET DEFAULT 0,
  ALTER COLUMN stream_rate_cents SET DEFAULT 0,
  ALTER COLUMN message_price_cents SET DEFAULT 0;

-- Ensure NOT NULL constraints exist (they should already, but being explicit)
ALTER TABLE users
  ALTER COLUMN video_rate_cents SET NOT NULL,
  ALTER COLUMN voice_rate_cents SET NOT NULL,
  ALTER COLUMN stream_rate_cents SET NOT NULL,
  ALTER COLUMN message_price_cents SET NOT NULL;

-- Update any existing NULL values to 0 (just in case)
UPDATE users
SET
  video_rate_cents = COALESCE(video_rate_cents, 0),
  voice_rate_cents = COALESCE(voice_rate_cents, 0),
  stream_rate_cents = COALESCE(stream_rate_cents, 0),
  message_price_cents = COALESCE(message_price_cents, 0)
WHERE
  video_rate_cents IS NULL
  OR voice_rate_cents IS NULL
  OR stream_rate_cents IS NULL
  OR message_price_cents IS NULL;
