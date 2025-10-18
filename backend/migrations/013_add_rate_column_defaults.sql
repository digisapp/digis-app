-- Migration: Add safe defaults for rate columns
-- Prevents NOT NULL errors when creating new users

-- Add defaults to rate columns
ALTER TABLE users
  ALTER COLUMN video_rate_cents SET DEFAULT 0,
  ALTER COLUMN voice_rate_cents SET DEFAULT 0,
  ALTER COLUMN stream_rate_cents SET DEFAULT 0,
  ALTER COLUMN message_price_cents SET DEFAULT 0;

-- Backfill any existing NULL values to 0
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

-- Optional: Make columns NOT NULL now that we have defaults and backfilled
-- ALTER TABLE users
--   ALTER COLUMN video_rate_cents SET NOT NULL,
--   ALTER COLUMN voice_rate_cents SET NOT NULL,
--   ALTER COLUMN stream_rate_cents SET NOT NULL,
--   ALTER COLUMN message_price_cents SET NOT NULL;
