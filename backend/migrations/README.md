# Database Migrations

This directory contains all database schema migrations for the Digis platform. Migrations are organized sequentially and should be run in order.

## Migration Numbering System

- **001-099**: Core schema and features
- **100-199**: Major system migrations and feature additions
- **200-299**: Critical fixes and data integrity improvements
- **300-399**: Financial system migrations (cents conversion)
- **400-499**: Advanced features (double-entry ledger)

## Running Migrations

```bash
# Run all pending migrations
npm run migrate

# Rollback last migration
npm run migrate:down

# Check migration status
npm run migrate:status
```

## Migration Order

### Core Schema (001-030)

- **001_initial_schema.sql** - Base tables (users, tokens, sessions, payments)
- **003_create_classes_tables.sql** - Classes and scheduling
- **004_create_call_requests.sql** - Call request system
- **004_supabase_auth_migration.sql** - Supabase authentication integration
- **005_call_requests.sql** - Enhanced call requests
- **005_create_classes_tables.sql** - Classes feature expansion
- **005_creator_applications.sql** - Creator application system
- **006_enhanced_call_features.sql** - Advanced call features
- **006_supabase_functions.sql** - Supabase stored procedures
- **007_add_location_fields.sql** - Location-based features
- **007_remove_firebase_columns.sql** - Firebase to Supabase migration cleanup
- **008_add_tv_subscriptions.sql** - TV subscription feature
- **008_create_recordings_table.sql** - Stream recording storage
- **009_create_connect_features.sql** - Creator-fan connection features
- **010_create_creator_payouts.sql** - Payout system foundation
- **015_add_analytics_tables.sql** - Analytics tracking
- **016_virtual_gifts.sql** - Virtual gift system
- **017_chat_tips_gifts_integration.sql** - Chat monetization
- **018_create_tips_tables.sql** - Tipping system
- **019_fix_notifications_table.sql** - Notification system fixes
- **020_create_content_tables.sql** - Content management
- **021_create_experiences_tables.sql** - Creator experiences (DEPRECATED)
- **022_create_withdrawals_table.sql** - Withdrawal management
- **023_rename_member_id_to_fan_id.sql** - Member → Fan terminology
- **024_create_creator_offers_table.sql** - Special offers system
- **025_rename_industry_type_to_creator_type.sql** - Creator categorization
- **026_create_session_invites_table.sql** - Session invitation system
- **027_create_follows_table.sql** - Follow/unfollow system
- **028_create_missing_tables.sql** - Schema completeness
- **030_create_stream_recordings.sql** - VOD recordings
- **031_create_stream_chat_tables.sql** - Live stream chat

### Feature Expansions (099-147)

- **099_pre_migration_validation.sql** - Pre-migration checks
- **100_complete_supabase_migration.sql** - Full Supabase migration
- **101_complete_rls_policies.sql** - Row Level Security
- **102_add_partitioning_and_fix_fkeys.sql** - Performance optimization
- **103_rollback_supabase_migration.sql** - Migration rollback script
- **104_create_missing_streaming_tables.sql** - Streaming infrastructure
- **105_create_moderation_tables.sql** - Content moderation
- **106_create_gamification_tables.sql** - Badges and achievements
- **107_create_content_and_moderation_tables.sql** - Content moderation v2
- **108_create_push_notifications_tables.sql** - Push notification system
- **109_create_cards_and_stream_tables.sql** - Collectible cards
- **111_create_analytics_tables.sql** - Advanced analytics
- **112_create_co_host_tables.sql** - Co-hosting features
- **113_create_private_call_tables.sql** - Private call sessions
- **114_create_stream_activity_tracking.sql** - Stream engagement tracking
- **115_create_dual_badge_system.sql** - Gifter + Fan badges
- **116_add_platinum_tier_and_challenges.sql** - Premium tier + challenges
- **117_standardized_subscription_tiers.sql** - Subscription standardization
- **118_create_shop_tables.sql** - Creator shop system
- **119_add_platform_fee_columns.sql** - Platform fee tracking
- **120_create_content_tables.sql** - Enhanced content management
- **121_add_mentions_to_stream_messages.sql** - @mention functionality
- **122_create_ticketed_shows.sql** - Ticketed event system
- **123_add_message_price_columns.sql** - Paid messaging
- **124_create_creator_fan_notes.sql** - Fan CRM notes
- **125_enhanced_avatar_system.sql** - Avatar upload system
- **126_create_calendar_events.sql** - Calendar integration
- **127_create_session_invites_supabase.sql** - Supabase session invites
- **127a_add_missing_pricing_columns.sql** - Additional pricing fields
- **128_update_default_token_rates.sql** - Token pricing updates
- **129_add_age_verification.sql** - Age verification system
- **130_add_kyc_verification.sql** - KYC/compliance system
- **131_add_creator_card_image.sql** - Creator card images
- **131_create_admin_audit_tables.sql** - Admin audit logging
- **132_add_tv_trial_fields.sql** - TV subscription trials
- **133_add_vod_purchases.sql** - VOD purchase system
- **134_create_digitals_tables.sql** - Digital content sales
- **135_create_creator_notification_preferences.sql** - Notification settings
- **136_add_creator_profile_fields.sql** - Extended profile fields
- **137_add_creator_interests.sql** - Creator interest tags
- **138_create_session_metrics.sql** - Session analytics
- **139_add_missing_stream_columns.sql** - Stream metadata
- **140_add_gifter_tiers.sql** - Gifter tier system
- **141_create_ppv_messages.sql** - Pay-per-view messages
- **142_create_live_shopping_tables.sql** - Live shopping feature
- **143_create_refresh_tokens.sql** - JWT refresh token system
- **144_create_webhook_idempotency.sql** - Webhook deduplication
- **145_critical_data_integrity.sql** - Data integrity constraints
- **146_set_default_subscription_price.sql** - Subscription price defaults
- **147_create_saved_creators.sql** - Saved/bookmarked creators

### Critical Fixes (200-299)

- **200_create_analytics_buckets.sql** - Supabase storage buckets
- **200_fix_identity_mismatch.sql** - Auth.users → public.users sync
- **201_stripe_webhook_dedupe.sql** - Webhook idempotency
- **202_drop_decimals_enforce_cents.sql** - Financial data type fix

### Financial Migration (300-399)

- **300_migrate_to_cents.sql** - Convert all money to integer cents
- **301_backfill_cents.sql** - Backfill existing data
- **302_verification_queries.sql** - Verify cents migration

### Advanced Features (400+)

- **400_create_double_entry_ledger.sql** - Double-entry accounting system

### Utility Migrations

- **add_indexes.sql** - Performance indexes
- **add-enhanced-constraints-and-indexes.sql** - Additional constraints
- **ADD_TOKEN_VERSION.sql** - Token versioning system

## Known Duplicate Numbers

⚠️ The following migrations have duplicate numbers due to parallel development:

- **004**: `004_create_call_requests.sql` AND `004_supabase_auth_migration.sql`
- **005**: `005_call_requests.sql` AND `005_create_classes_tables.sql` AND `005_creator_applications.sql`
- **006**: `006_enhanced_call_features.sql` AND `006_supabase_functions.sql`
- **007**: `007_add_location_fields.sql` AND `007_remove_firebase_columns.sql`
- **008**: `008_add_tv_subscriptions.sql` AND `008_create_recordings_table.sql`
- **131**: `131_add_creator_card_image.sql` AND `131_create_admin_audit_tables.sql`
- **200**: `200_create_analytics_buckets.sql` AND `200_fix_identity_mismatch.sql`

**Note:** All migrations have been applied to the database. These duplicates exist in the file system only and do not affect database state.

## Archive Directory

The `archive/` directory contains:

- **emergency-fixes/** - Ad-hoc database fixes applied during development
- **diagnostics/** - Debug queries and structure checks
- **duplicates/** - Deprecated duplicate migrations

These files are kept for historical reference but should NOT be run in production.

## Best Practices

1. **Never modify existing migrations** - Always create a new migration
2. **Test migrations locally first** - Use a dev database
3. **Migrations should be idempotent** - Safe to run multiple times
4. **Include rollback logic** - Add `-- Down Migration` comments
5. **One change per migration** - Easier to debug and rollback
6. **Use transactions** - Wrap DDL in `BEGIN`/`COMMIT`
7. **Document dependencies** - Note which migrations depend on others

## Creating New Migrations

```bash
# Create a new migration
npm run migrate:create <migration-name>

# Example
npm run migrate:create add_user_preferences_table
```

Migration template:

```sql
-- Migration: <number>_<descriptive_name>
-- Description: What this migration does and why
-- Dependencies: List any required prior migrations

BEGIN;

-- Up Migration
CREATE TABLE IF NOT EXISTS example_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;

-- Down Migration (for reference)
-- BEGIN;
-- DROP TABLE IF EXISTS example_table;
-- COMMIT;
```

## Validation

Run the validation script to check for issues:

```bash
node migrations/validate.js
```

This checks for:
- Duplicate migration numbers
- Missing dependencies
- Invalid SQL syntax
- Non-idempotent migrations

## Troubleshooting

### Migration Failed

```bash
# Check current migration state
npm run migrate:status

# View migration logs
tail -f backend/logs/migrations.log

# Manually rollback if needed
psql $DATABASE_URL -f migrations/<migration-file>.sql
```

### Database Out of Sync

```bash
# Check which migrations have been applied
SELECT * FROM schema_migrations ORDER BY version;

# Manually mark migration as applied (if already run)
INSERT INTO schema_migrations (version) VALUES (<migration-number>);
```

## Production Deployment

1. **Backup database first**: `pg_dump > backup.sql`
2. **Test migrations in staging**: Run on staging environment
3. **Run migrations during low traffic**: Schedule maintenance window
4. **Monitor application logs**: Watch for errors after migration
5. **Have rollback plan ready**: Keep backup and rollback scripts

## Security Notes

⚠️ Never commit:
- Database credentials
- API keys
- Sensitive data in migrations
- Real user data in seed files

## Support

For migration issues:
1. Check logs in `backend/logs/migrations.log`
2. Review migration file for errors
3. Check database state with `\d+ table_name` in psql
4. Consult team before modifying applied migrations

---

**Last Updated:** 2025-10-01
**Migration Count:** 93 numbered migrations
**Status:** Production-ready
