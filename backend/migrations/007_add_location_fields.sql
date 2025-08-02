-- Add location fields (state and country) to users table
-- This allows creators to display their location on their profiles

-- Add state column
ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100);

-- Add country column
ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100);

-- Add indexes for location searches
CREATE INDEX IF NOT EXISTS idx_users_state ON users(state);
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);

-- Add comments for documentation
COMMENT ON COLUMN users.state IS 'State/Province where the user is located (e.g., Florida, California)';
COMMENT ON COLUMN users.country IS 'Country where the user is located (e.g., USA, Canada)';