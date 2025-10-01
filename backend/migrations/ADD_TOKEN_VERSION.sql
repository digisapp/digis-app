-- Add token_version column for JWT revocation pattern
-- This allows us to invalidate all existing tokens for a user

-- Add column if it doesn't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 0;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_token_version
ON users(id, token_version);

-- Add comment explaining the column
COMMENT ON COLUMN users.token_version IS 'Incremented to invalidate all existing JWT tokens for forced logout';