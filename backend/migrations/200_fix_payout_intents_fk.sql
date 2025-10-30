-- Migration: Fix creator_payout_intents foreign key to allow updates
--
-- Issue: The FK constraint only has ON DELETE CASCADE, not ON UPDATE CASCADE
-- This prevents updating users.supabase_id when merging duplicate accounts
-- Error: "update or delete on table "users" violates foreign key constraint"
--
-- Solution: Drop and recreate the FK with both ON DELETE CASCADE and ON UPDATE CASCADE

-- Drop existing constraint
ALTER TABLE creator_payout_intents
  DROP CONSTRAINT IF EXISTS fk_creator_payout_intents_user;

-- Recreate with ON UPDATE CASCADE
-- First, determine which column to reference
DO $$
BEGIN
  -- Check if users table uses supabase_id as the primary key
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'supabase_id'
  ) THEN
    -- Add FK with both ON DELETE CASCADE and ON UPDATE CASCADE
    EXECUTE 'ALTER TABLE creator_payout_intents
             ADD CONSTRAINT fk_creator_payout_intents_user
             FOREIGN KEY (user_id) REFERENCES users(supabase_id)
             ON DELETE CASCADE ON UPDATE CASCADE';
    RAISE NOTICE 'Added FK referencing users(supabase_id) with ON UPDATE CASCADE';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    -- Add FK with both ON DELETE CASCADE and ON UPDATE CASCADE
    EXECUTE 'ALTER TABLE creator_payout_intents
             ADD CONSTRAINT fk_creator_payout_intents_user
             FOREIGN KEY (user_id) REFERENCES users(id)
             ON DELETE CASCADE ON UPDATE CASCADE';
    RAISE NOTICE 'Added FK referencing users(id) with ON UPDATE CASCADE';
  ELSE
    RAISE EXCEPTION 'Could not find suitable users column (id or supabase_id)';
  END IF;
END $$;
