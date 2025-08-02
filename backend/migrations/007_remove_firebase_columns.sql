-- Migration to remove Firebase columns after complete migration to Supabase

-- Drop foreign key constraints that reference firebase_uid
ALTER TABLE token_balances DROP CONSTRAINT IF EXISTS token_balances_user_id_fkey;
ALTER TABLE token_transactions DROP CONSTRAINT IF EXISTS token_transactions_user_id_fkey;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;
ALTER TABLE creator_subscriptions DROP CONSTRAINT IF EXISTS creator_subscriptions_subscriber_id_fkey;
ALTER TABLE followers DROP CONSTRAINT IF EXISTS followers_follower_id_fkey;
ALTER TABLE tips DROP CONSTRAINT IF EXISTS tips_tipper_id_fkey;

-- Update foreign keys to use supabase_id instead
ALTER TABLE token_balances 
  ADD CONSTRAINT token_balances_supabase_user_id_fkey 
  FOREIGN KEY (supabase_user_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE token_transactions 
  ADD CONSTRAINT token_transactions_supabase_user_id_fkey 
  FOREIGN KEY (supabase_user_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE payments 
  ADD CONSTRAINT payments_supabase_user_id_fkey 
  FOREIGN KEY (supabase_user_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE creator_subscriptions 
  ADD CONSTRAINT creator_subscriptions_supabase_subscriber_id_fkey 
  FOREIGN KEY (supabase_subscriber_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE followers 
  ADD CONSTRAINT followers_supabase_follower_id_fkey 
  FOREIGN KEY (supabase_follower_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE tips 
  ADD CONSTRAINT tips_supabase_tipper_id_fkey 
  FOREIGN KEY (supabase_tipper_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

-- Drop Firebase-specific columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS firebase_uid;

-- Drop old user_id columns that referenced firebase_uid
ALTER TABLE token_balances DROP COLUMN IF EXISTS user_id;
ALTER TABLE token_transactions DROP COLUMN IF EXISTS user_id;
ALTER TABLE payments DROP COLUMN IF EXISTS user_id;
ALTER TABLE creator_subscriptions DROP COLUMN IF EXISTS subscriber_id;
ALTER TABLE followers DROP COLUMN IF EXISTS follower_id;
ALTER TABLE tips DROP COLUMN IF EXISTS tipper_id;

-- Drop firebase_user_id from creator_applications
ALTER TABLE creator_applications DROP COLUMN IF EXISTS firebase_user_id;

-- Drop migration tracking table as it's no longer needed
DROP TABLE IF EXISTS auth_migration_mapping;

-- Make supabase_id required (remove NULL constraint)
ALTER TABLE users ALTER COLUMN supabase_id SET NOT NULL;

-- Update indexes
DROP INDEX IF EXISTS idx_users_firebase_uid;
DROP INDEX IF EXISTS idx_creator_applications_firebase_user_id;

-- Add comment
COMMENT ON COLUMN users.supabase_id IS 'Primary authentication identifier from Supabase Auth';