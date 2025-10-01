-- Add TV trial fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS tv_trial_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tv_trial_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tv_trial_days INTEGER DEFAULT 60;

-- Create an index for efficient trial status queries
CREATE INDEX IF NOT EXISTS idx_users_tv_trial_end_date ON users(tv_trial_end_date);

-- Update existing users to have 60-day trial from their creation date
-- This gives existing users the benefit too
UPDATE users 
SET 
  tv_trial_start_date = COALESCE(created_at, NOW()),
  tv_trial_end_date = COALESCE(created_at, NOW()) + INTERVAL '60 days'
WHERE tv_trial_start_date IS NULL;

-- Create a function to automatically set trial dates for new users
CREATE OR REPLACE FUNCTION set_tv_trial_on_user_creation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tv_trial_start_date IS NULL THEN
    NEW.tv_trial_start_date := NOW();
    NEW.tv_trial_end_date := NOW() + INTERVAL '60 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set trial dates when a user is created
DROP TRIGGER IF EXISTS set_tv_trial_trigger ON users;
CREATE TRIGGER set_tv_trial_trigger
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION set_tv_trial_on_user_creation();

-- Add a function to check if user's trial is active
CREATE OR REPLACE FUNCTION check_tv_trial_status(user_id UUID)
RETURNS TABLE(
  is_active BOOLEAN,
  days_remaining INTEGER,
  trial_end_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN u.tv_trial_end_date > NOW() THEN true
      ELSE false
    END as is_active,
    CASE 
      WHEN u.tv_trial_end_date > NOW() 
      THEN EXTRACT(DAY FROM u.tv_trial_end_date - NOW())::INTEGER
      ELSE 0
    END as days_remaining,
    u.tv_trial_end_date as trial_end_date
  FROM users u
  WHERE u.id = user_id;
END;
$$ LANGUAGE plpgsql;