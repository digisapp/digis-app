-- Add interests/categories field for creators
-- This allows creators to tag their content and helps with discovery

-- Add interests column to users table (array of text, max 5 items)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}' 
CHECK (array_length(interests, 1) <= 5);

-- Add index for better search performance
CREATE INDEX IF NOT EXISTS idx_users_interests ON users USING GIN (interests);

-- Add comment for clarity
COMMENT ON COLUMN users.interests IS 'Creator interests/categories for discovery (max 5)';

-- Migrate existing specialties data if it exists
UPDATE users 
SET interests = ARRAY(
  SELECT DISTINCT unnest(specialties)
  LIMIT 5
)
WHERE specialties IS NOT NULL 
AND array_length(specialties, 1) > 0
AND interests = '{}';

-- Predefined categories that creators can choose from
-- Store this as a reference (could be moved to application config)
COMMENT ON COLUMN users.interests IS 'Creator interests/categories for discovery (max 5).
Available options: Gaming, Music, Art, Model, Fitness, Cooking, Dance, Comedy,
Education, Lifestyle, Fashion, Tech, Sports, Travel, Photography, Crafts, Beauty,
Business, Meditation, ASMR, Wellness, Other';