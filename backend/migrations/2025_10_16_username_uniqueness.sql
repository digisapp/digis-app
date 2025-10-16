-- ============================================================================
-- Username Uniqueness & Vanity URL Migration
-- ============================================================================
-- Purpose: Ensure every creator has a unique, lowercase username for vanity URLs
-- like digis.cc/miriam (Instagram-style)
--
-- This migration:
-- 1. Normalizes existing usernames to lowercase
-- 2. Enforces format (3-30 chars, a-z 0-9 . _ -)
-- 3. Creates case-insensitive unique index
-- 4. Adds username change tracking
-- 5. Creates released username quarantine table
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Normalize existing usernames
-- ============================================================================

-- Ensure username column exists (should already be there)
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT;

-- Normalize any existing values to lowercase + trimmed (safe if null)
UPDATE public.users
SET username = NULLIF(TRIM(LOWER(username)), '')
WHERE username IS NOT NULL;

-- ============================================================================
-- 2. Format constraint: 3-30 chars, only a-z 0-9 . _ -
-- Must start and end with letter or number
-- ============================================================================

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_username_format_chk;

ALTER TABLE public.users
  ADD CONSTRAINT users_username_format_chk CHECK (
    username IS NULL OR (
      length(username) BETWEEN 3 AND 30
      AND username ~ '^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$'
    )
  );

COMMENT ON CONSTRAINT users_username_format_chk ON public.users IS
  'Username must be 3-30 chars, lowercase a-z/0-9/dot/underscore/hyphen, start/end with alphanumeric';

-- ============================================================================
-- 3. Case-insensitive uniqueness (the critical piece!)
-- Prevents @Miriam vs @miriam duplicates
-- ============================================================================

-- Drop old index if it exists
DROP INDEX IF EXISTS users_username_lower_key;
DROP INDEX IF EXISTS users_username_lower_uidx;

-- Create new unique index on lowercase username
CREATE UNIQUE INDEX users_username_lower_uidx
ON public.users (LOWER(username))
WHERE username IS NOT NULL;

COMMENT ON INDEX users_username_lower_uidx IS
  'Ensures username uniqueness (case-insensitive) for vanity URLs';

-- ============================================================================
-- 4. Username change tracking (cooldown enforcement)
-- ============================================================================

-- Add column to track when username was last changed
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ;

-- Set initial value for existing users (allow immediate change)
UPDATE public.users
SET username_changed_at = NOW() - INTERVAL '31 days'
WHERE username_changed_at IS NULL;

COMMENT ON COLUMN public.users.username_changed_at IS
  'Last time username was changed; enforces 30-day cooldown';

-- Add column to track previous username (for redirects)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS previous_username TEXT;

COMMENT ON COLUMN public.users.previous_username IS
  'Previous username (for 301 redirects and audit trail)';

-- ============================================================================
-- 5. Released username quarantine table
-- Prevents immediate reuse of abandoned usernames (anti-squatting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.username_quarantine (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  released_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  released_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  available_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  claimed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,

  CONSTRAINT username_quarantine_lowercase_chk CHECK (username = LOWER(username))
);

CREATE INDEX IF NOT EXISTS username_quarantine_username_idx
ON public.username_quarantine (LOWER(username), available_at);

COMMENT ON TABLE public.username_quarantine IS
  'Quarantines released usernames for 30 days to prevent immediate sniping';

-- ============================================================================
-- 6. Username change audit log
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.username_changes (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  old_username TEXT,
  new_username TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,

  CONSTRAINT username_changes_new_lowercase_chk CHECK (new_username = LOWER(new_username))
);

CREATE INDEX IF NOT EXISTS username_changes_user_id_idx
ON public.username_changes (user_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS username_changes_new_username_idx
ON public.username_changes (new_username, changed_at DESC);

COMMENT ON TABLE public.username_changes IS
  'Audit log of all username changes for security and analytics';

-- ============================================================================
-- 7. Helper function: Check if username is in quarantine
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_username_quarantined(check_username TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.username_quarantine
    WHERE LOWER(username) = LOWER(check_username)
      AND available_at > NOW()
      AND claimed_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.is_username_quarantined IS
  'Returns true if username is in quarantine period (not yet available)';

-- ============================================================================
-- 8. Verify migration
-- ============================================================================

DO $$
DECLARE
  constraint_count integer;
  index_count integer;
  table_count integer;
BEGIN
  -- Check constraints
  SELECT COUNT(*)::integer INTO constraint_count
  FROM information_schema.check_constraints
  WHERE constraint_name = 'users_username_format_chk'
    AND constraint_schema = 'public';

  -- Check unique index
  SELECT COUNT(*)::integer INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'users'
    AND indexname = 'users_username_lower_uidx';

  -- Check quarantine table
  SELECT COUNT(*)::integer INTO table_count
  FROM information_schema.tables
  WHERE table_name = 'username_quarantine'
    AND table_schema = 'public';

  RAISE NOTICE '✅ Username format constraint: %', CASE WHEN constraint_count > 0 THEN 'created' ELSE 'MISSING' END;
  RAISE NOTICE '✅ Username unique index: %', CASE WHEN index_count > 0 THEN 'created' ELSE 'MISSING' END;
  RAISE NOTICE '✅ Quarantine table: %', CASE WHEN table_count > 0 THEN 'created' ELSE 'MISSING' END;
  RAISE NOTICE '✅ Username tracking columns added to users table';
  RAISE NOTICE '✅ Username change audit log created';
END $$;

COMMIT;

-- ============================================================================
-- Rollback (if needed):
-- ============================================================================
--
-- BEGIN;
-- DROP TABLE IF EXISTS public.username_changes CASCADE;
-- DROP TABLE IF EXISTS public.username_quarantine CASCADE;
-- DROP FUNCTION IF EXISTS public.is_username_quarantined(TEXT);
-- DROP INDEX IF EXISTS users_username_lower_uidx;
-- ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_username_format_chk;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS username_changed_at;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS previous_username;
-- COMMIT;
--
-- ============================================================================
