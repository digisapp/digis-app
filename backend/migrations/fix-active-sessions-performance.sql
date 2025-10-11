-- CRITICAL FIX: Active sessions query performance
-- Problem: COUNT(*) on sessions table scans entire table (79 seconds)
-- Solution: Partial index + cached counts

-- 1. Create partial index for active sessions (safe for production)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_active
ON sessions (status)
WHERE status = 'active';

-- 2. Create index for creator's active sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_creator_active
ON sessions (creator_id, status)
WHERE status = 'active';

-- 3. Create index for fan's active sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_fan_active
ON sessions (fan_id, status)
WHERE status = 'active';

-- 4. Add materialized view for quick active session counts (optional)
CREATE MATERIALIZED VIEW IF NOT EXISTS active_sessions_summary AS
SELECT
  COUNT(*) as total_active,
  COUNT(DISTINCT creator_id) as active_creators,
  COUNT(DISTINCT fan_id) as active_fans
FROM sessions
WHERE status = 'active';

-- Refresh this view every minute with a cron job
CREATE INDEX ON active_sessions_summary (total_active);

-- Usage in queries:
-- Instead of: SELECT COUNT(*) FROM sessions WHERE status = 'active'
-- Use: SELECT total_active FROM active_sessions_summary
