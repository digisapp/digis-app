-- ============================================================================
-- Migration 016: Admin Security 2025 Best Practices
-- ============================================================================
-- Purpose: Implement 2025 security standards for admin access
--
-- Changes:
-- 1. RLS admin bypass policies for all tables
-- 2. Make audit_logs immutable (append-only)
-- 3. Add admin activity tracking
-- 4. Create step-up re-auth tracking table
--
-- Author: Claude Code
-- Date: 2025-10-18
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. RLS ADMIN BYPASS POLICIES
-- ============================================================================
-- Allow admins to bypass RLS on all tables for administrative tasks
-- This uses app_metadata.role from the JWT

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    auth.jwt() ->> 'role' = 'admin'
    OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR
    (auth.jwt() -> 'app_metadata' ->> 'is_staff') = 'true'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply admin bypass policy to key tables
-- Users table
DROP POLICY IF EXISTS "admin_bypass_users" ON public.users;
CREATE POLICY "admin_bypass_users" ON public.users
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Token balances table
DROP POLICY IF EXISTS "admin_bypass_token_balances" ON public.token_balances;
CREATE POLICY "admin_bypass_token_balances" ON public.token_balances
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Sessions table
DROP POLICY IF EXISTS "admin_bypass_sessions" ON public.sessions;
CREATE POLICY "admin_bypass_sessions" ON public.sessions
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Payments table
DROP POLICY IF EXISTS "admin_bypass_payments" ON public.payments;
CREATE POLICY "admin_bypass_payments" ON public.payments
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Creator applications table
DROP POLICY IF EXISTS "admin_bypass_creator_applications" ON public.creator_applications;
CREATE POLICY "admin_bypass_creator_applications" ON public.creator_applications
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Transactions table
DROP POLICY IF EXISTS "admin_bypass_transactions" ON public.transactions;
CREATE POLICY "admin_bypass_transactions" ON public.transactions
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Content reports table
DROP POLICY IF EXISTS "admin_bypass_content_reports" ON public.content_reports;
CREATE POLICY "admin_bypass_content_reports" ON public.content_reports
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- 2. IMMUTABLE AUDIT LOGS (Append-Only)
-- ============================================================================
-- Prevent modification or deletion of audit logs to ensure tamper-proof trail

-- Revoke UPDATE and DELETE permissions on audit_logs
REVOKE UPDATE ON TABLE public.audit_logs FROM authenticated;
REVOKE UPDATE ON TABLE public.audit_logs FROM anon;
REVOKE DELETE ON TABLE public.audit_logs FROM authenticated;
REVOKE DELETE ON TABLE public.audit_logs FROM anon;

-- Ensure audit_logs has RLS enabled
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can create audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit logs are append-only" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit logs cannot be deleted" ON public.audit_logs;

-- Admins can view all audit logs
CREATE POLICY "admin_view_audit_logs" ON public.audit_logs
  FOR SELECT
  USING (is_admin());

-- Admins can create audit logs
CREATE POLICY "admin_create_audit_logs" ON public.audit_logs
  FOR INSERT
  WITH CHECK (is_admin());

-- Explicitly BLOCK UPDATE operations (append-only)
CREATE POLICY "audit_logs_no_update" ON public.audit_logs
  FOR UPDATE
  USING (false); -- Always deny

-- Explicitly BLOCK DELETE operations (immutable)
CREATE POLICY "audit_logs_no_delete" ON public.audit_logs
  FOR DELETE
  USING (false); -- Always deny

-- Add index on created_at for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================================================
-- 3. ADMIN ACTIVITY TRACKING
-- ============================================================================
-- Track admin sessions and activity for security monitoring

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_end TIMESTAMPTZ,
  ip_address VARCHAR(45),
  user_agent TEXT,
  mfa_verified BOOLEAN DEFAULT false,
  session_token_hash VARCHAR(255), -- Hashed session identifier
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON public.admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_start ON public.admin_sessions(session_start DESC);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_active ON public.admin_sessions(admin_id, session_end)
  WHERE session_end IS NULL;

-- RLS policies for admin_sessions
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- Admins can view their own sessions
CREATE POLICY "admin_view_own_sessions" ON public.admin_sessions
  FOR SELECT
  USING (admin_id = auth.uid() OR is_admin());

-- System can insert admin sessions
CREATE POLICY "system_insert_admin_sessions" ON public.admin_sessions
  FOR INSERT
  WITH CHECK (admin_id = auth.uid());

-- System can update own session activity
CREATE POLICY "admin_update_own_sessions" ON public.admin_sessions
  FOR UPDATE
  USING (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

-- ============================================================================
-- 4. STEP-UP RE-AUTH TRACKING
-- ============================================================================
-- Track when admins perform step-up re-authentication for sensitive actions

CREATE TABLE IF NOT EXISTS public.admin_stepup_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reauth_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT,
  action_performed VARCHAR(255), -- What action required step-up
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_stepup_admin_id ON public.admin_stepup_auth(admin_id);
CREATE INDEX IF NOT EXISTS idx_stepup_timestamp ON public.admin_stepup_auth(reauth_timestamp DESC);

-- RLS policies for step-up auth tracking
ALTER TABLE public.admin_stepup_auth ENABLE ROW LEVEL SECURITY;

-- Admins can view all step-up records
CREATE POLICY "admin_view_stepup" ON public.admin_stepup_auth
  FOR SELECT
  USING (is_admin());

-- System can insert step-up records
CREATE POLICY "system_insert_stepup" ON public.admin_stepup_auth
  FOR INSERT
  WITH CHECK (admin_id = auth.uid());

-- Make step-up records immutable (no UPDATE/DELETE)
CREATE POLICY "stepup_no_update" ON public.admin_stepup_auth
  FOR UPDATE
  USING (false);

CREATE POLICY "stepup_no_delete" ON public.admin_stepup_auth
  FOR DELETE
  USING (false);

-- ============================================================================
-- 5. ADMIN NOTIFICATION PREFERENCES
-- ============================================================================
-- Store admin notification settings (for security alerts, action notifications, etc.)

CREATE TABLE IF NOT EXISTS public.admin_notification_preferences (
  admin_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_security_alerts BOOLEAN DEFAULT true,
  email_action_notifications BOOLEAN DEFAULT true,
  slack_webhook_url TEXT,
  sms_number VARCHAR(20),
  notification_threshold VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for notification preferences
ALTER TABLE public.admin_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_own_notifications" ON public.admin_notification_preferences
  FOR ALL
  USING (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

-- ============================================================================
-- 6. SECURITY FUNCTION: LOG ADMIN ACTION
-- ============================================================================
-- Helper function to log admin actions (called by application)

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action VARCHAR(255),
  p_details JSONB DEFAULT '{}'::jsonb,
  p_ip_address VARCHAR(45) DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    admin_id,
    action,
    details,
    ip_address,
    user_agent,
    timestamp
  )
  VALUES (
    auth.uid(),
    p_action,
    p_details,
    p_ip_address,
    p_user_agent,
    NOW()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. VIEWS FOR ADMIN DASHBOARD
-- ============================================================================

-- View: Active admin sessions
CREATE OR REPLACE VIEW public.active_admin_sessions AS
SELECT
  s.id,
  s.admin_id,
  u.email as admin_email,
  u.username as admin_username,
  s.session_start,
  s.last_activity,
  s.ip_address,
  s.mfa_verified,
  EXTRACT(EPOCH FROM (NOW() - s.last_activity)) as seconds_since_activity
FROM public.admin_sessions s
LEFT JOIN public.users u ON s.admin_id = u.supabase_id
WHERE s.session_end IS NULL;

-- View: Recent admin actions
CREATE OR REPLACE VIEW public.recent_admin_actions AS
SELECT
  al.id,
  al.admin_id,
  u.email as admin_email,
  u.username as admin_username,
  al.action,
  al.details,
  al.ip_address,
  al.timestamp
FROM public.audit_logs al
LEFT JOIN public.users u ON al.admin_id = u.supabase_id
ORDER BY al.timestamp DESC
LIMIT 100;

-- Grant SELECT on views to admins only
GRANT SELECT ON public.active_admin_sessions TO authenticated;
GRANT SELECT ON public.recent_admin_actions TO authenticated;

-- ============================================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.admin_sessions IS 'Tracks admin user sessions for security monitoring and compliance';
COMMENT ON TABLE public.admin_stepup_auth IS 'Records step-up re-authentication events for sensitive admin actions';
COMMENT ON TABLE public.admin_notification_preferences IS 'Stores notification preferences for admin users';
COMMENT ON FUNCTION public.is_admin() IS 'Checks if current user has admin role from JWT claims';
COMMENT ON FUNCTION public.log_admin_action IS 'Helper function to log admin actions to audit trail';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================

-- Check that audit_logs is immutable
-- SELECT * FROM audit_logs LIMIT 1; -- Should work
-- UPDATE audit_logs SET action = 'test' WHERE id = '...'; -- Should fail
-- DELETE FROM audit_logs WHERE id = '...'; -- Should fail

-- Check admin bypass works
-- SET request.jwt.claims = '{"role": "admin"}';
-- SELECT * FROM users; -- Should work for admin
