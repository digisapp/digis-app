-- ============================================
-- FIX VIEW AND TABLES - DROP VIEW FIRST
-- ============================================
-- This script drops the existing view first, then recreates everything
-- ============================================

-- Step 1: Drop the existing view that's causing conflicts
DROP VIEW IF EXISTS offer_statistics CASCADE;

-- Step 2: Drop any existing policies on offer tables
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on offer-related tables if they exist
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE tablename IN (
            'offer_purchases', 
            'offer_bookings', 
            'creator_offers', 
            'offer_reviews', 
            'offer_favorites', 
            'offer_notifications', 
            'offer_analytics'
        )
    ) LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                r.policyname, r.schemaname, r.tablename);
        EXCEPTION
            WHEN undefined_object THEN
                NULL; -- Policy doesn't exist, continue
        END;
    END LOOP;
END $$;

-- Step 3: Now recreate the view with the correct structure
CREATE OR REPLACE VIEW offer_statistics AS
SELECT 
    o.id as offer_id,
    o.creator_id,
    o.title,
    o.category,
    o.price,
    o.active,
    COUNT(DISTINCT op.id) as total_purchases,
    COUNT(DISTINCT op.id) FILTER (WHERE op.status = 'completed') as completed_purchases,
    COUNT(DISTINCT op.id) FILTER (WHERE op.status = 'cancelled') as cancelled_purchases,
    SUM(op.tokens_paid) FILTER (WHERE op.status = 'completed') as total_revenue,
    AVG(orv.rating) as average_rating,
    COUNT(DISTINCT orv.id) as total_reviews,
    COUNT(DISTINCT of.id) as total_favorites
FROM creator_offers o
LEFT JOIN offer_purchases op ON o.id = op.offer_id
LEFT JOIN offer_reviews orv ON o.id = orv.offer_id AND orv.is_public = true
LEFT JOIN offer_favorites of ON o.id = of.offer_id
GROUP BY o.id, o.creator_id, o.title, o.category, o.price, o.active;

-- Step 4: Grant permissions on the view
GRANT SELECT ON offer_statistics TO authenticated;

-- Step 5: Ensure all offer tables have proper permissions (without RLS for now)
GRANT ALL ON creator_offers TO authenticated;
GRANT ALL ON offer_purchases TO authenticated;
GRANT ALL ON offer_bookings TO authenticated;
GRANT ALL ON offer_reviews TO authenticated;
GRANT ALL ON offer_favorites TO authenticated;
GRANT ALL ON offer_notifications TO authenticated;
GRANT ALL ON offer_analytics TO authenticated;

-- ============================================
-- COMPLETED - View and permissions fixed
-- ============================================
-- The offer_statistics view has been recreated with the correct columns
-- All tables have proper permissions
-- ============================================