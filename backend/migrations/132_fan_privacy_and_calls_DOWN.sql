-- Rollback migration 132: Fan Privacy and Call Management
-- WARNING: This will delete all call history and fan privacy settings

-- Drop triggers first
DROP TRIGGER IF EXISTS trigger_auto_call_relationship ON calls;
DROP TRIGGER IF EXISTS trigger_auto_tip_relationship ON tips;
DROP TRIGGER IF EXISTS trigger_auto_follow_relationship ON followers;
DROP TRIGGER IF EXISTS update_calls_updated_at ON calls;

-- Drop functions
DROP FUNCTION IF EXISTS auto_create_call_relationship();
DROP FUNCTION IF EXISTS auto_create_tip_relationship();
DROP FUNCTION IF EXISTS auto_create_follow_relationship();
DROP FUNCTION IF EXISTS can_creator_call_fan(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS can_creator_message_fan(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS creator_has_relationship(VARCHAR, VARCHAR);

-- Drop indexes
DROP INDEX IF EXISTS idx_call_invitations_expires;
DROP INDEX IF EXISTS idx_call_invitations_fan;
DROP INDEX IF EXISTS idx_calls_channel;
DROP INDEX IF EXISTS idx_calls_state;
DROP INDEX IF EXISTS idx_calls_fan;
DROP INDEX IF EXISTS idx_calls_creator;
DROP INDEX IF EXISTS idx_creator_fan_rel_type;
DROP INDEX IF EXISTS idx_creator_fan_rel_fan;
DROP INDEX IF EXISTS idx_creator_fan_rel_creator;
DROP INDEX IF EXISTS idx_users_fan_share_token;
DROP INDEX IF EXISTS idx_users_fan_privacy;

-- Drop tables
DROP TABLE IF EXISTS call_invitations;
DROP TABLE IF EXISTS calls;
DROP TABLE IF EXISTS creator_fan_relationships;

-- Remove columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS fan_allow_search;
ALTER TABLE users DROP COLUMN IF EXISTS fan_share_token_expires_at;
ALTER TABLE users DROP COLUMN IF EXISTS fan_share_token;
ALTER TABLE users DROP COLUMN IF EXISTS fan_allow_calls;
ALTER TABLE users DROP COLUMN IF EXISTS fan_allow_dm;
ALTER TABLE users DROP COLUMN IF EXISTS fan_privacy_visibility;

-- Note: This rollback is destructive and will delete all:
-- - Call history
-- - Call invitations
-- - Creator-fan relationships
-- - Fan privacy settings
-- - Share tokens
