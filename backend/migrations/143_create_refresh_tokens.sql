-- Create refresh tokens table for JWT security
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE, -- Store hashed token
  token_id VARCHAR(255) NOT NULL UNIQUE, -- Unique ID for token rotation
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  ip_address INET,
  user_agent TEXT,
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP,
  revoked_reason TEXT
);

-- Create indexes for performance (PostgreSQL syntax)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_is_revoked ON refresh_tokens (is_revoked);

-- Create a function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM refresh_tokens
  WHERE expires_at < CURRENT_TIMESTAMP
    OR (is_revoked = TRUE AND revoked_at < CURRENT_TIMESTAMP - INTERVAL '7 days');
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup daily (requires pg_cron extension)
-- If pg_cron is available, uncomment the following:
-- SELECT cron.schedule('cleanup-refresh-tokens', '0 3 * * *', 'SELECT cleanup_expired_refresh_tokens();');

-- Add column to users table for tracking refresh token usage
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_token_refresh TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token_version INTEGER DEFAULT 0;