-- Migration: Add performance indexes for sessions table
-- Date: 2025-10-10
-- Purpose: Fix slow COUNT(*) queries causing 79+ second timeouts

-- Add last_seen column if it doesn't exist (for time-bounded queries)
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT NOW();

-- Backfill last_seen from updated_at or created_at
UPDATE sessions
SET last_seen = COALESCE(updated_at, created_at, NOW())
WHERE last_seen IS NULL;

-- Create partial index for active sessions (fastest for status='active' queries)
-- CONCURRENTLY allows this to run without blocking writes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_status_active
  ON sessions (status)
  WHERE status = 'active';

-- Create composite index for time-bounded active session queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_status_created_at
  ON sessions (status, created_at DESC);

-- Create index for time-bounded queries (for metrics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_created_at
  ON sessions (created_at DESC);

-- Create composite index for active sessions with last_seen
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_active_lastseen
  ON sessions (last_seen DESC)
  WHERE status = 'active';

-- Add comment to track migration
COMMENT ON INDEX idx_sessions_status_active IS 'Partial index for active sessions - critical for metrics collection';
COMMENT ON INDEX idx_sessions_status_created_at IS 'Composite index for time-bounded status queries';
COMMENT ON INDEX idx_sessions_created_at IS 'Index for time-bounded session queries';
COMMENT ON INDEX idx_sessions_active_lastseen IS 'Selective index for active sessions with time window';

-- Optional: Clean up old sessions to keep table size manageable
-- Uncomment if you want to purge very old sessions (adjust interval as needed)
-- DELETE FROM sessions
-- WHERE last_seen < NOW() - INTERVAL '90 days'
--   AND status != 'active';

-- Run ANALYZE to update query planner statistics
ANALYZE sessions;

-- Verification queries (run these to confirm indexes are being used):
-- EXPLAIN (ANALYZE, BUFFERS) SELECT COUNT(*) FROM sessions WHERE status = 'active';
-- EXPLAIN (ANALYZE, BUFFERS) SELECT EXISTS(SELECT 1 FROM sessions WHERE status = 'active' LIMIT 1);
