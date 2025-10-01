-- Add age verification fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS age_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMP WITH TIME ZONE;

-- Add check constraint to ensure users are 18+
ALTER TABLE users 
ADD CONSTRAINT check_user_age 
CHECK (
  date_of_birth IS NULL OR 
  date_of_birth <= CURRENT_DATE - INTERVAL '18 years'
);

-- Create index for age verification status
CREATE INDEX IF NOT EXISTS idx_users_age_verified ON users(age_verified);

-- Add comment explaining the fields
COMMENT ON COLUMN users.date_of_birth IS 'User date of birth for age verification';
COMMENT ON COLUMN users.age_verified IS 'Whether user has confirmed they are 18+';
COMMENT ON COLUMN users.age_verified_at IS 'Timestamp when user confirmed their age';