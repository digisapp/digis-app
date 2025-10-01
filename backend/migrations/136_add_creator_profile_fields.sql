-- Add new fields for creator profile enhancement
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS what_i_offer TEXT,
ADD COLUMN IF NOT EXISTS availability TEXT;

-- Add comments for clarity
COMMENT ON COLUMN users.what_i_offer IS 'Creator description of services offered';
COMMENT ON COLUMN users.availability IS 'Creator availability schedule text';