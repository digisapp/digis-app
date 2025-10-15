-- =============================================================================
-- RLS HELPER FUNCTIONS - DRY REUSABLE PREDICATES
-- =============================================================================
-- These functions reduce policy duplication and improve maintainability
-- All functions use SECURITY INVOKER to respect RLS
-- =============================================================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS is_owner(uuid);
DROP FUNCTION IF EXISTS is_creator();
DROP FUNCTION IF EXISTS is_active_subscriber(integer);
DROP FUNCTION IF EXISTS owns_content(integer);
DROP FUNCTION IF EXISTS is_conversation_participant(integer);
DROP FUNCTION IF EXISTS current_user_db_id();

-- -----------------------------------------------------------------------------
-- Get current user's database ID from Supabase auth
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_user_db_id()
RETURNS INTEGER
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT id FROM public.users WHERE supabase_id = auth.uid();
$$;

COMMENT ON FUNCTION current_user_db_id IS
  'Returns the database ID of the currently authenticated user';

-- -----------------------------------------------------------------------------
-- Check if current user owns a resource by supabase_id
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_owner(owner_uuid uuid)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT auth.uid() = owner_uuid;
$$;

COMMENT ON FUNCTION is_owner IS
  'Returns true if the current user is the owner of a resource';

-- -----------------------------------------------------------------------------
-- Check if current user is a creator
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_creator()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.users
    WHERE supabase_id = auth.uid()
      AND is_creator = true
  );
$$;

COMMENT ON FUNCTION is_creator IS
  'Returns true if the current user is a creator';

-- -----------------------------------------------------------------------------
-- Check if current user has an active subscription to a creator
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_active_subscriber(creator_db_id integer)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.subscriptions s
    JOIN public.users u ON u.id = s.subscriber_id
    WHERE s.creator_id = creator_db_id
      AND u.supabase_id = auth.uid()
      AND s.status = 'active'
      AND (s.expires_at IS NULL OR s.expires_at > NOW())
  );
$$;

COMMENT ON FUNCTION is_active_subscriber IS
  'Returns true if current user has active subscription to specified creator';

-- -----------------------------------------------------------------------------
-- Check if current user has an active subscription via creator_subscriptions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_active_creator_subscriber(creator_db_id integer)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.creator_subscriptions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.creator_id = creator_db_id
      AND u.supabase_id = auth.uid()
      AND cs.status = 'active'
      AND (cs.end_date IS NULL OR cs.end_date > NOW())
  );
$$;

COMMENT ON FUNCTION is_active_creator_subscriber IS
  'Returns true if current user has active creator subscription';

-- -----------------------------------------------------------------------------
-- Check if current user owns content
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION owns_content(content_creator_id integer)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.users
    WHERE id = content_creator_id
      AND supabase_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION owns_content IS
  'Returns true if current user owns the specified content';

-- -----------------------------------------------------------------------------
-- Check if current user is a participant in a conversation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_conversation_participant(conversation_id integer)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.conversations c
    JOIN public.users u1 ON u1.id = c.participant1_id
    JOIN public.users u2 ON u2.id = c.participant2_id
    WHERE c.id = conversation_id
      AND (u1.supabase_id = auth.uid() OR u2.supabase_id = auth.uid())
  );
$$;

COMMENT ON FUNCTION is_conversation_participant IS
  'Returns true if current user is a participant in the conversation';

-- -----------------------------------------------------------------------------
-- Check if current user follows a creator
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION follows_creator(creator_db_id integer)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.follows f
    JOIN public.users u ON u.id = f.follower_id
    WHERE f.following_id = creator_db_id
      AND u.supabase_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION follows_creator IS
  'Returns true if current user follows the specified creator';

-- -----------------------------------------------------------------------------
-- Check if current user has purchased specific content
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION has_purchased_content(content_id integer)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.purchases p
    JOIN public.users u ON u.id = p.buyer_id
    WHERE p.content_id = content_id
      AND u.supabase_id = auth.uid()
      AND p.status = 'completed'
  );
$$;

COMMENT ON FUNCTION has_purchased_content IS
  'Returns true if current user has purchased the specified content';

-- -----------------------------------------------------------------------------
-- Check if user is blocked
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_blocked_by(other_user_id integer)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.blocked_users bu
    JOIN public.users u ON u.id = bu.blocked_id
    WHERE bu.blocker_id = other_user_id
      AND u.supabase_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION is_blocked_by IS
  'Returns true if current user is blocked by the specified user';

-- -----------------------------------------------------------------------------
-- Check if current user has blocked another user
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION has_blocked(other_user_id integer)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.blocked_users bu
    JOIN public.users u ON u.id = bu.blocker_id
    WHERE bu.blocked_id = other_user_id
      AND u.supabase_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION has_blocked IS
  'Returns true if current user has blocked the specified user';

-- =============================================================================
-- GRANT EXECUTE TO AUTHENTICATED USERS
-- =============================================================================
GRANT EXECUTE ON FUNCTION current_user_db_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_creator() TO authenticated;
GRANT EXECUTE ON FUNCTION is_active_subscriber(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION is_active_creator_subscriber(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION owns_content(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION is_conversation_participant(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION follows_creator(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION has_purchased_content(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION is_blocked_by(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION has_blocked(integer) TO authenticated;

-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- Test the functions (replace with actual test UUIDs)
-- SELECT current_user_db_id();
-- SELECT is_creator();
-- SELECT is_active_subscriber(123);
-- =============================================================================
