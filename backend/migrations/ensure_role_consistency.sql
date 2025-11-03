-- Migration: Ensure role column is the single source of truth for user roles
-- This migration ensures all users have a consistent role set based on their current permissions

-- Start transaction
BEGIN;

-- 1. Set role='admin' for users who are marked as admin
UPDATE users
SET role = 'admin'
WHERE (is_super_admin = true OR is_admin = true)
  AND role IS DISTINCT FROM 'admin';

-- 2. Set role='creator' for users who are creators but not admins
UPDATE users
SET role = 'creator'
WHERE is_creator = true
  AND role IS DISTINCT FROM 'admin'
  AND role IS DISTINCT FROM 'creator';

-- 3. Fix invalid roles - set to 'fan' for any role not in (admin, creator, fan)
UPDATE users
SET role = 'fan'
WHERE role NOT IN ('admin', 'creator', 'fan') OR role IS NULL;

-- 4. Ensure role column is NOT NULL (make it required)
ALTER TABLE users
ALTER COLUMN role SET DEFAULT 'fan';

ALTER TABLE users
ALTER COLUMN role SET NOT NULL;

-- 5. Add check constraint to ensure valid roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'creator', 'fan'));
  END IF;
END $$;

-- Log the changes
DO $$
DECLARE
  admin_count INT;
  creator_count INT;
  fan_count INT;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM users WHERE role = 'admin';
  SELECT COUNT(*) INTO creator_count FROM users WHERE role = 'creator';
  SELECT COUNT(*) INTO fan_count FROM users WHERE role = 'fan';

  RAISE NOTICE 'Role migration complete:';
  RAISE NOTICE '  Admins: %', admin_count;
  RAISE NOTICE '  Creators: %', creator_count;
  RAISE NOTICE '  Fans: %', fan_count;
END $$;

COMMIT;

-- Verify the migration
SELECT
  role,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM users
GROUP BY role
ORDER BY role;
