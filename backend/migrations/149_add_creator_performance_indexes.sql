-- Performance indexes for /api/users/creators endpoint
-- Speeds up supabase_id lookups, followers queries, and creator filtering

-- Speed up supabase_id lookups (critical for auth user -> db id conversion)
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON public.users(supabase_id);

-- Followers table lookups for "following" filter
-- Note: follower_id is VARCHAR (supabase_id), creator_id is INTEGER (users.id)
CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON public.followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_creator_id ON public.followers(creator_id);

-- Composite index for "who I follow" pages (optimal for JOIN queries)
CREATE INDEX IF NOT EXISTS idx_followers_follower_creator ON public.followers(follower_id, creator_id);

-- Speed up creator queries (is_creator filter)
CREATE INDEX IF NOT EXISTS idx_users_is_creator ON public.users(is_creator) WHERE is_creator = TRUE;

-- Speed up online status checks
CREATE INDEX IF NOT EXISTS idx_users_last_active ON public.users(last_active DESC) WHERE is_creator = TRUE;

-- Composite index for common creator queries
CREATE INDEX IF NOT EXISTS idx_users_creator_active ON public.users(is_creator, last_active DESC) WHERE is_creator = TRUE;
