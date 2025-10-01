-- Row Level Security (RLS) Configuration for DIGIS Platform
-- This script enables RLS and creates security policies for all tables
-- Run this after the main schema is created

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gifts_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Users table policies
-- Users can read their own profile and public creator profiles
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT
    USING (
        supabase_id = auth.uid() 
        OR is_creator = TRUE 
        OR is_super_admin = TRUE
    );

-- Users can update their own profile
CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE
    USING (supabase_id = auth.uid())
    WITH CHECK (supabase_id = auth.uid());

-- Only service role can insert new users (handled by auth triggers)
CREATE POLICY "users_insert_policy" ON public.users
    FOR INSERT
    WITH CHECK (FALSE);

-- Token balances policies
-- Users can only see their own balance
CREATE POLICY "token_balances_select_policy" ON public.token_balances
    FOR SELECT
    USING (supabase_user_id = auth.uid());

-- Only service role can update balances (handled by backend)
CREATE POLICY "token_balances_update_policy" ON public.token_balances
    FOR UPDATE
    WITH CHECK (FALSE);

CREATE POLICY "token_balances_insert_policy" ON public.token_balances
    FOR INSERT
    WITH CHECK (FALSE);

-- Sessions policies
-- Users can see sessions they're part of (as creator or member)
CREATE POLICY "sessions_select_policy" ON public.sessions
    FOR SELECT
    USING (
        creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
        OR fan_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    );

-- Only service role can create/update sessions
CREATE POLICY "sessions_insert_policy" ON public.sessions
    FOR INSERT
    WITH CHECK (FALSE);

CREATE POLICY "sessions_update_policy" ON public.sessions
    FOR UPDATE
    WITH CHECK (FALSE);

-- Token transactions policies
-- Users can only see their own transactions
CREATE POLICY "token_transactions_select_policy" ON public.token_transactions
    FOR SELECT
    USING (supabase_user_id = auth.uid());

-- Only service role can create transactions
CREATE POLICY "token_transactions_insert_policy" ON public.token_transactions
    FOR INSERT
    WITH CHECK (FALSE);

-- Virtual gifts policies (public read)
-- Everyone can see available gifts
CREATE POLICY "virtual_gifts_select_policy" ON public.virtual_gifts
    FOR SELECT
    USING (is_active = TRUE);

-- Only admins can manage gifts
CREATE POLICY "virtual_gifts_insert_policy" ON public.virtual_gifts
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE supabase_id = auth.uid() 
            AND is_super_admin = TRUE
        )
    );

CREATE POLICY "virtual_gifts_update_policy" ON public.virtual_gifts
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE supabase_id = auth.uid() 
            AND is_super_admin = TRUE
        )
    );

-- Gifts sent policies
-- Users can see gifts they sent or received
CREATE POLICY "gifts_sent_select_policy" ON public.gifts_sent
    FOR SELECT
    USING (
        sender_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
        OR receiver_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    );

-- Only service role can create gift records
CREATE POLICY "gifts_sent_insert_policy" ON public.gifts_sent
    FOR INSERT
    WITH CHECK (FALSE);

-- Tips policies
-- Users can see tips they sent or received
CREATE POLICY "tips_select_policy" ON public.tips
    FOR SELECT
    USING (
        sender_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
        OR receiver_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    );

-- Only service role can create tip records
CREATE POLICY "tips_insert_policy" ON public.tips
    FOR INSERT
    WITH CHECK (FALSE);

-- Chat messages policies
-- Users can see messages from sessions they're part of
CREATE POLICY "chat_messages_select_policy" ON public.chat_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.sessions s
            WHERE s.id = session_id
            AND (
                s.creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
                OR s.fan_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
            )
        )
    );

-- Users can send messages in their sessions
CREATE POLICY "chat_messages_insert_policy" ON public.chat_messages
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sessions s
            WHERE s.id = session_id
            AND (
                s.creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
                OR s.fan_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
            )
            AND s.status = 'active'
        )
    );

-- Withdrawals policies
-- Creators can only see their own withdrawals
CREATE POLICY "withdrawals_select_policy" ON public.withdrawals
    FOR SELECT
    USING (
        creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    );

-- Only service role can create/update withdrawals
CREATE POLICY "withdrawals_insert_policy" ON public.withdrawals
    FOR INSERT
    WITH CHECK (FALSE);

CREATE POLICY "withdrawals_update_policy" ON public.withdrawals
    FOR UPDATE
    WITH CHECK (FALSE);

-- Notifications policies
-- Users can only see their own notifications
CREATE POLICY "notifications_select_policy" ON public.notifications
    FOR SELECT
    USING (
        user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    );

-- Users can update their own notifications (mark as read)
CREATE POLICY "notifications_update_policy" ON public.notifications
    FOR UPDATE
    USING (
        user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    )
    WITH CHECK (
        user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    );

-- Only service role can create notifications
CREATE POLICY "notifications_insert_policy" ON public.notifications
    FOR INSERT
    WITH CHECK (FALSE);

-- Creator analytics policies
-- Creators can only see their own analytics
CREATE POLICY "creator_analytics_select_policy" ON public.creator_analytics
    FOR SELECT
    USING (
        creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    );

-- Only service role can update analytics
CREATE POLICY "creator_analytics_insert_policy" ON public.creator_analytics
    FOR INSERT
    WITH CHECK (FALSE);

CREATE POLICY "creator_analytics_update_policy" ON public.creator_analytics
    FOR UPDATE
    WITH CHECK (FALSE);

-- Fan favorites policies
-- Users can see their own favorites
CREATE POLICY "fan_favorites_select_policy" ON public.fan_favorites
    FOR SELECT
    USING (
        fan_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    );

-- Users can manage their own favorites
CREATE POLICY "fan_favorites_insert_policy" ON public.fan_favorites
    FOR INSERT
    WITH CHECK (
        fan_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    );

CREATE POLICY "fan_favorites_delete_policy" ON public.fan_favorites
    FOR DELETE
    USING (
        fan_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    );

-- Subscription tiers policies
-- Everyone can see active subscription tiers
CREATE POLICY "subscription_tiers_select_policy" ON public.subscription_tiers
    FOR SELECT
    USING (is_active = TRUE);

-- Creators can manage their own tiers
CREATE POLICY "subscription_tiers_insert_policy" ON public.subscription_tiers
    FOR INSERT
    WITH CHECK (
        creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid() AND is_creator = TRUE)
    );

CREATE POLICY "subscription_tiers_update_policy" ON public.subscription_tiers
    FOR UPDATE
    USING (
        creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid() AND is_creator = TRUE)
    );

-- Creator subscriptions policies
-- Users can see their own subscriptions
CREATE POLICY "creator_subscriptions_select_policy" ON public.creator_subscriptions
    FOR SELECT
    USING (
        fan_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
        OR tier_id IN (
            SELECT id FROM public.subscription_tiers 
            WHERE creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
        )
    );

-- Only service role can manage subscriptions
CREATE POLICY "creator_subscriptions_insert_policy" ON public.creator_subscriptions
    FOR INSERT
    WITH CHECK (FALSE);

CREATE POLICY "creator_subscriptions_update_policy" ON public.creator_subscriptions
    FOR UPDATE
    WITH CHECK (FALSE);

-- Stream sessions policies
-- Users can see public streams and streams they're part of
CREATE POLICY "stream_sessions_select_policy" ON public.stream_sessions
    FOR SELECT
    USING (
        is_public = TRUE
        OR creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
        OR auth.uid() IN (
            SELECT unnest(viewer_ids) FROM public.stream_sessions WHERE id = stream_sessions.id
        )
    );

-- Only creators can create their own streams
CREATE POLICY "stream_sessions_insert_policy" ON public.stream_sessions
    FOR INSERT
    WITH CHECK (
        creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid() AND is_creator = TRUE)
    );

-- Creators can update their own streams
CREATE POLICY "stream_sessions_update_policy" ON public.stream_sessions
    FOR UPDATE
    USING (
        creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid() AND is_creator = TRUE)
    );

-- Content reports policies
-- Only service role and admins can see reports
CREATE POLICY "content_reports_select_policy" ON public.content_reports
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE supabase_id = auth.uid() 
            AND is_super_admin = TRUE
        )
    );

-- Users can create reports
CREATE POLICY "content_reports_insert_policy" ON public.content_reports
    FOR INSERT
    WITH CHECK (
        reporter_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    );

-- Grant necessary permissions to authenticated users
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (username, display_name, bio, avatar_url, cover_image_url, social_links, location, timezone, language_preference, privacy_settings, notification_settings, profile_complete, last_seen, theme_preference) ON public.users TO authenticated;

GRANT SELECT ON public.token_balances TO authenticated;
GRANT SELECT ON public.sessions TO authenticated;
GRANT SELECT ON public.token_transactions TO authenticated;
GRANT SELECT ON public.virtual_gifts TO authenticated;
GRANT SELECT ON public.gifts_sent TO authenticated;
GRANT SELECT ON public.tips TO authenticated;
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT SELECT ON public.withdrawals TO authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT ON public.creator_analytics TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.fan_favorites TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.subscription_tiers TO authenticated;
GRANT SELECT ON public.creator_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.stream_sessions TO authenticated;
GRANT SELECT, INSERT ON public.content_reports TO authenticated;

-- Create indexes for better RLS performance
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON public.users(supabase_id);
CREATE INDEX IF NOT EXISTS idx_token_balances_user ON public.token_balances(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_creator ON public.sessions(creator_id);
CREATE INDEX IF NOT EXISTS idx_sessions_fan ON public.sessions(fan_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user ON public.token_transactions(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_gifts_sent_sender ON public.gifts_sent(sender_id);
CREATE INDEX IF NOT EXISTS idx_gifts_sent_receiver ON public.gifts_sent(receiver_id);
CREATE INDEX IF NOT EXISTS idx_tips_sender ON public.tips(sender_id);
CREATE INDEX IF NOT EXISTS idx_tips_receiver ON public.tips(receiver_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_creator ON public.withdrawals(creator_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_analytics_creator ON public.creator_analytics(creator_id);
CREATE INDEX IF NOT EXISTS idx_fan_favorites_fan ON public.fan_favorites(fan_id);
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_creator ON public.subscription_tiers(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_subscriptions_fan ON public.creator_subscriptions(fan_id);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_creator ON public.stream_sessions(creator_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter ON public.content_reports(reporter_id);

-- Note: After running this script, ensure that your backend services use the 
-- Supabase service role key for operations that bypass RLS (like token updates)