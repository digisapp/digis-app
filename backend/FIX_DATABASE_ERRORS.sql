-- Fix missing columns and permissions

-- 1. Add average_rating column to users table if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0.00;

-- 2. Add expires_at column to notifications table if it doesn't exist
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- 3. Grant permissions on digitals table
GRANT ALL ON TABLE digitals TO postgres;
GRANT ALL ON TABLE digitals TO authenticated;
GRANT ALL ON TABLE digitals TO anon;
GRANT ALL ON TABLE digitals TO service_role;

-- 4. Also grant permissions on the digitals sequence if it exists
GRANT ALL ON SEQUENCE digitals_id_seq TO postgres;
GRANT ALL ON SEQUENCE digitals_id_seq TO authenticated;
GRANT ALL ON SEQUENCE digitals_id_seq TO anon;
GRANT ALL ON SEQUENCE digitals_id_seq TO service_role;

-- 5. Add any other missing columns that might be needed
ALTER TABLE users
ADD COLUMN IF NOT EXISTS what_i_offer TEXT,
ADD COLUMN IF NOT EXISTS availability TEXT;

-- 6. Update average_rating for existing users
UPDATE users 
SET average_rating = COALESCE(
  (SELECT AVG(rating) FROM sessions WHERE creator_id = users.id AND rating IS NOT NULL),
  4.5
)
WHERE is_creator = true AND average_rating IS NULL;

-- 7. Create index for better performance
CREATE INDEX IF NOT EXISTS idx_users_average_rating ON users(average_rating);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_digitals_creator_id ON digitals(creator_id);