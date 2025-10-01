-- Migration: Rename industry_type to creator_type
-- Purpose: Better naming convention for creator categorization

-- Rename the column in users table
ALTER TABLE users 
RENAME COLUMN industry_type TO creator_type;

-- Add comment to document the change
COMMENT ON COLUMN users.creator_type IS 'Type of creator (e.g., Health Coach, Yoga Instructor, Fitness Trainer, etc.)';

-- Update any indexes that might reference the old column name
-- (None exist in current schema, but good practice to check)

-- Note: All application code must be updated to use 'creator_type' instead of 'industry_type'