-- =====================================================
-- COMPLETE RLS POLICIES FOR ALL REMAINING TABLES
-- =====================================================
-- This migration adds RLS policies for all tables not covered in the main migration

BEGIN;

-- =====================================================
-- ENABLE RLS ON ALL REMAINING TABLES
-- =====================================================

-- Creator subscriptions
ALTER TABLE creator_subscriptions ENABLE ROW LEVEL SECURITY;

-- Followers
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

-- Tips
ALTER TABLE tips ENABLE ROW LEVEL SECURITY;

-- Creator payouts and related tables
ALTER TABLE creator_stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_payout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_notifications ENABLE ROW LEVEL SECURITY;

-- Analytics tables
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_aggregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_time_metrics ENABLE ROW LEVEL SECURITY;

-- Virtual gifts
ALTER TABLE virtual_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_gift_settings ENABLE ROW LEVEL SECURITY;

-- Streaming
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_analytics ENABLE ROW LEVEL SECURITY;

-- Content
ALTER TABLE creator_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_views ENABLE ROW LEVEL SECURITY;

-- Experiences
ALTER TABLE creator_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_experience_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE experience_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE experience_reviews ENABLE ROW LEVEL SECURITY;

-- TV Subscriptions
ALTER TABLE tv_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv_subscription_transactions ENABLE ROW LEVEL SECURITY;

-- Creator applications
ALTER TABLE creator_applications ENABLE ROW LEVEL SECURITY;

-- Recordings
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_recordings ENABLE ROW LEVEL SECURITY;

-- Call features
ALTER TABLE creator_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fan_engagement ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_peak_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_reports ENABLE ROW LEVEL SECURITY;

-- Offers
ALTER TABLE creator_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_redemptions ENABLE ROW LEVEL SECURITY;

-- Memberships
ALTER TABLE membership_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- Withdrawals
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

-- Chat messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Session participants
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;

-- Connect features
ALTER TABLE creator_connect_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborations ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_meetups ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetup_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorship_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorship_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_replies ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES
-- =====================================================

-- Creator subscriptions policies
CREATE POLICY creator_subs_select ON creator_subscriptions FOR SELECT 
    USING (auth.uid() IN (user_id, creator_id));
CREATE POLICY creator_subs_insert ON creator_subscriptions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY creator_subs_update ON creator_subscriptions FOR UPDATE 
    USING (auth.uid() IN (user_id, creator_id));

-- Followers policies
CREATE POLICY followers_select ON followers FOR SELECT 
    USING (auth.uid() IN (follower_id, creator_id));
CREATE POLICY followers_insert ON followers FOR INSERT 
    WITH CHECK (auth.uid() = follower_id);
CREATE POLICY followers_delete ON followers FOR DELETE 
    USING (auth.uid() = follower_id);

-- Tips policies
CREATE POLICY tips_select ON tips FOR SELECT 
    USING (auth.uid() IN (supabase_tipper_id, (SELECT supabase_id FROM users WHERE id = creator_id)));
CREATE POLICY tips_insert ON tips FOR INSERT 
    WITH CHECK (auth.uid() = supabase_tipper_id);

-- Creator payouts policies (creators can only view their own)
CREATE POLICY stripe_accounts_select ON creator_stripe_accounts FOR SELECT 
    USING (auth.uid() = creator_id);
CREATE POLICY stripe_accounts_insert ON creator_stripe_accounts FOR INSERT 
    WITH CHECK (auth.uid() = creator_id);
CREATE POLICY stripe_accounts_update ON creator_stripe_accounts FOR UPDATE 
    USING (auth.uid() = creator_id);

CREATE POLICY bank_accounts_select ON creator_bank_accounts FOR SELECT 
    USING (auth.uid() = (SELECT creator_id FROM creator_stripe_accounts WHERE id = stripe_account_id));
CREATE POLICY bank_accounts_insert ON creator_bank_accounts FOR INSERT 
    WITH CHECK (auth.uid() = (SELECT creator_id FROM creator_stripe_accounts WHERE id = stripe_account_id));
CREATE POLICY bank_accounts_update ON creator_bank_accounts FOR UPDATE 
    USING (auth.uid() = (SELECT creator_id FROM creator_stripe_accounts WHERE id = stripe_account_id));

CREATE POLICY payouts_select ON creator_payouts FOR SELECT 
    USING (auth.uid() = creator_id);

CREATE POLICY earnings_select ON creator_earnings FOR SELECT 
    USING (auth.uid() = creator_id);

CREATE POLICY payout_settings_select ON creator_payout_settings FOR SELECT 
    USING (auth.uid() = creator_id);
CREATE POLICY payout_settings_update ON creator_payout_settings FOR UPDATE 
    USING (auth.uid() = creator_id);

-- Analytics policies (users can view their own data)
CREATE POLICY analytics_events_select ON analytics_events FOR SELECT 
    USING (auth.uid() IN (user_id, creator_id));
CREATE POLICY analytics_events_insert ON analytics_events FOR INSERT 
    WITH CHECK (auth.uid() IN (user_id, creator_id));

CREATE POLICY session_metrics_select ON session_metrics FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY analytics_aggregations_select ON analytics_aggregations FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY real_time_metrics_select ON real_time_metrics FOR SELECT 
    USING (auth.uid() = user_id);

-- Virtual gifts policies
CREATE POLICY virtual_gifts_select ON virtual_gifts FOR SELECT USING (TRUE); -- Public catalog

CREATE POLICY gifts_sent_select ON gifts_sent FOR SELECT 
    USING (auth.uid() IN (fan_id, creator_id));
CREATE POLICY gifts_sent_insert ON gifts_sent FOR INSERT 
    WITH CHECK (auth.uid() = fan_id);

CREATE POLICY gift_transactions_select ON gift_transactions FOR SELECT 
    USING (auth.uid() IN (fan_id, creator_id));

CREATE POLICY creator_gift_settings_select ON creator_gift_settings FOR SELECT 
    USING (auth.uid() = creator_id);
CREATE POLICY creator_gift_settings_update ON creator_gift_settings FOR UPDATE 
    USING (auth.uid() = creator_id);

-- Streaming policies
CREATE POLICY streams_select ON streams FOR SELECT USING (TRUE); -- Public viewing
CREATE POLICY streams_insert ON streams FOR INSERT 
    WITH CHECK (auth.uid() = creator_id);
CREATE POLICY streams_update ON streams FOR UPDATE 
    USING (auth.uid() = creator_id);
CREATE POLICY streams_delete ON streams FOR DELETE 
    USING (auth.uid() = creator_id);

CREATE POLICY stream_viewers_select ON stream_viewers FOR SELECT 
    USING (auth.uid() = viewer_id OR auth.uid() = (SELECT creator_id FROM streams WHERE id = stream_id));
CREATE POLICY stream_viewers_insert ON stream_viewers FOR INSERT 
    WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY stream_messages_select ON stream_messages FOR SELECT 
    USING (auth.uid() IN (SELECT viewer_id FROM stream_viewers WHERE stream_id = stream_messages.stream_id));
CREATE POLICY stream_messages_insert ON stream_messages FOR INSERT 
    WITH CHECK (auth.uid() = sender_id);

CREATE POLICY stream_analytics_select ON stream_analytics FOR SELECT 
    USING (auth.uid() = (SELECT creator_id FROM streams WHERE id = stream_id));

-- Content policies
CREATE POLICY creator_content_select_public ON creator_content FOR SELECT 
    USING (is_public = TRUE OR auth.uid() = creator_id);
CREATE POLICY creator_content_select_purchased ON creator_content FOR SELECT 
    USING (auth.uid() IN (SELECT user_id FROM content_purchases WHERE content_id = creator_content.id));
CREATE POLICY creator_content_insert ON creator_content FOR INSERT 
    WITH CHECK (auth.uid() = creator_id);
CREATE POLICY creator_content_update ON creator_content FOR UPDATE 
    USING (auth.uid() = creator_id);
CREATE POLICY creator_content_delete ON creator_content FOR DELETE 
    USING (auth.uid() = creator_id);

CREATE POLICY content_purchases_select ON content_purchases FOR SELECT 
    USING (auth.uid() IN (user_id, (SELECT creator_id FROM creator_content WHERE id = content_id)));
CREATE POLICY content_purchases_insert ON content_purchases FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY content_likes_select ON content_likes FOR SELECT USING (TRUE);
CREATE POLICY content_likes_insert ON content_likes FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY content_likes_delete ON content_likes FOR DELETE 
    USING (auth.uid() = user_id);

CREATE POLICY content_views_select ON content_views FOR SELECT 
    USING (auth.uid() = user_id OR auth.uid() = (SELECT creator_id FROM creator_content WHERE id = content_id));
CREATE POLICY content_views_insert ON content_views FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Experiences policies
CREATE POLICY experiences_select ON creator_experiences FOR SELECT USING (TRUE);
CREATE POLICY experiences_insert ON creator_experiences FOR INSERT 
    WITH CHECK (auth.uid() = creator_id);
CREATE POLICY experiences_update ON creator_experiences FOR UPDATE 
    USING (auth.uid() = creator_id);

CREATE POLICY experience_submissions_select ON creator_experience_submissions FOR SELECT 
    USING (auth.uid() IN (user_id, (SELECT creator_id FROM creator_experiences WHERE id = experience_id)));
CREATE POLICY experience_submissions_insert ON creator_experience_submissions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY experience_participants_select ON experience_participants FOR SELECT 
    USING (auth.uid() IN (user_id, (SELECT creator_id FROM creator_experiences WHERE id = experience_id)));

CREATE POLICY experience_reviews_select ON experience_reviews FOR SELECT USING (TRUE);
CREATE POLICY experience_reviews_insert ON experience_reviews FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- TV Subscriptions policies
CREATE POLICY tv_subscriptions_select ON tv_subscriptions FOR SELECT 
    USING (auth.uid() = user_id);
CREATE POLICY tv_subscriptions_insert ON tv_subscriptions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY tv_subscriptions_update ON tv_subscriptions FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY tv_subscription_trans_select ON tv_subscription_transactions FOR SELECT 
    USING (auth.uid() = user_id);

-- Creator applications policies
CREATE POLICY creator_apps_select_own ON creator_applications FOR SELECT 
    USING (auth.uid() = supabase_user_id);
CREATE POLICY creator_apps_select_admin ON creator_applications FOR SELECT 
    USING (EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND role = 'admin'));
CREATE POLICY creator_apps_insert ON creator_applications FOR INSERT 
    WITH CHECK (auth.uid() = supabase_user_id);
CREATE POLICY creator_apps_update_own ON creator_applications FOR UPDATE 
    USING (auth.uid() = supabase_user_id);
CREATE POLICY creator_apps_update_admin ON creator_applications FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND role = 'admin'));

-- Recordings policies
CREATE POLICY recordings_select ON recordings FOR SELECT 
    USING (auth.uid() = creator_id OR auth.uid() IN (
        SELECT fan_id FROM sessions WHERE id = (
            SELECT session_id FROM recordings WHERE id = recordings.id
        )
    ));
CREATE POLICY recordings_insert ON recordings FOR INSERT 
    WITH CHECK (auth.uid() = creator_id);

CREATE POLICY session_recordings_select ON session_recordings FOR SELECT 
    USING (auth.uid() IN (
        SELECT creator_id FROM sessions WHERE id = session_id
        UNION
        SELECT fan_id FROM sessions WHERE id = session_id
    ));

-- Call features policies
CREATE POLICY creator_pricing_select ON creator_pricing FOR SELECT USING (TRUE);
CREATE POLICY creator_pricing_update ON creator_pricing FOR UPDATE 
    USING (auth.uid() = creator_id);

CREATE POLICY call_queue_select ON call_queue FOR SELECT 
    USING (auth.uid() IN (creator_id, fan_id));
CREATE POLICY call_queue_insert ON call_queue FOR INSERT 
    WITH CHECK (auth.uid() = fan_id);

CREATE POLICY blocked_users_select ON creator_blocked_users FOR SELECT 
    USING (auth.uid() = creator_id);
CREATE POLICY blocked_users_insert ON creator_blocked_users FOR INSERT 
    WITH CHECK (auth.uid() = creator_id);
CREATE POLICY blocked_users_delete ON creator_blocked_users FOR DELETE 
    USING (auth.uid() = creator_id);

-- Offers policies
CREATE POLICY offers_select_active ON creator_offers FOR SELECT 
    USING (is_active = TRUE AND valid_until > NOW());
CREATE POLICY offers_select_creator ON creator_offers FOR SELECT 
    USING (auth.uid() = creator_id);
CREATE POLICY offers_insert ON creator_offers FOR INSERT 
    WITH CHECK (auth.uid() = creator_id);
CREATE POLICY offers_update ON creator_offers FOR UPDATE 
    USING (auth.uid() = creator_id);

CREATE POLICY redemptions_select ON offer_redemptions FOR SELECT 
    USING (auth.uid() IN (user_id, (SELECT creator_id FROM creator_offers WHERE id = offer_id)));
CREATE POLICY redemptions_insert ON offer_redemptions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Memberships policies
CREATE POLICY membership_tiers_select ON membership_tiers FOR SELECT USING (TRUE);
CREATE POLICY membership_tiers_insert ON membership_tiers FOR INSERT 
    WITH CHECK (auth.uid() = creator_id);
CREATE POLICY membership_tiers_update ON membership_tiers FOR UPDATE 
    USING (auth.uid() = creator_id);

CREATE POLICY memberships_select ON memberships FOR SELECT 
    USING (auth.uid() IN (user_id, creator_id));
CREATE POLICY memberships_insert ON memberships FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY memberships_update ON memberships FOR UPDATE 
    USING (auth.uid() IN (user_id, creator_id));

-- Withdrawals policies
CREATE POLICY withdrawals_select ON withdrawals FOR SELECT 
    USING (auth.uid() = creator_id);
CREATE POLICY withdrawals_insert ON withdrawals FOR INSERT 
    WITH CHECK (auth.uid() = creator_id);
CREATE POLICY withdrawals_update_creator ON withdrawals FOR UPDATE 
    USING (auth.uid() = creator_id AND status = 'pending');
CREATE POLICY withdrawals_update_admin ON withdrawals FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND role = 'admin'));

-- Chat messages policies
CREATE POLICY chat_messages_select ON chat_messages FOR SELECT 
    USING (auth.uid() IN (sender_id, recipient_id));
CREATE POLICY chat_messages_insert ON chat_messages FOR INSERT 
    WITH CHECK (auth.uid() = sender_id);
CREATE POLICY chat_messages_update ON chat_messages FOR UPDATE 
    USING (auth.uid() = sender_id AND created_at > NOW() - INTERVAL '5 minutes');

-- Session participants policies
CREATE POLICY session_participants_select ON session_participants FOR SELECT 
    USING (auth.uid() = user_id OR auth.uid() IN (
        SELECT creator_id FROM sessions WHERE id = session_id
    ));
CREATE POLICY session_participants_insert ON session_participants FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Connect features policies
CREATE POLICY connect_profiles_select ON creator_connect_profiles FOR SELECT USING (TRUE);
CREATE POLICY connect_profiles_insert ON creator_connect_profiles FOR INSERT 
    WITH CHECK (auth.uid() = creator_id);
CREATE POLICY connect_profiles_update ON creator_connect_profiles FOR UPDATE 
    USING (auth.uid() = creator_id);

CREATE POLICY collaborations_select ON collaborations FOR SELECT USING (TRUE);
CREATE POLICY collaborations_insert ON collaborations FOR INSERT 
    WITH CHECK (auth.uid() = creator_id);
CREATE POLICY collaborations_update ON collaborations FOR UPDATE 
    USING (auth.uid() = creator_id);

CREATE POLICY collab_apps_select ON collaboration_applications FOR SELECT 
    USING (auth.uid() IN (applicant_id, (SELECT creator_id FROM collaborations WHERE id = collaboration_id)));
CREATE POLICY collab_apps_insert ON collaboration_applications FOR INSERT 
    WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY forum_categories_select ON forum_categories FOR SELECT USING (TRUE);
CREATE POLICY forum_topics_select ON forum_topics FOR SELECT USING (TRUE);
CREATE POLICY forum_topics_insert ON forum_topics FOR INSERT 
    WITH CHECK (auth.uid() = creator_id);
CREATE POLICY forum_topics_update ON forum_topics FOR UPDATE 
    USING (auth.uid() = creator_id);

CREATE POLICY forum_replies_select ON forum_replies FOR SELECT USING (TRUE);
CREATE POLICY forum_replies_insert ON forum_replies FOR INSERT 
    WITH CHECK (auth.uid() = creator_id);
CREATE POLICY forum_replies_update ON forum_replies FOR UPDATE 
    USING (auth.uid() = creator_id AND created_at > NOW() - INTERVAL '30 minutes');

COMMIT;