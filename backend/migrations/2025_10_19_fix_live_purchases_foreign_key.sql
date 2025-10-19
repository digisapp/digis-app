-- Fix live_purchases buyer_id foreign key to reference users(supabase_id) instead of users(id)
-- This is necessary because the backend uses supabase_id for all user references

-- Drop the old foreign key constraint
ALTER TABLE live_purchases
DROP CONSTRAINT IF EXISTS live_purchases_buyer_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE live_purchases
ADD CONSTRAINT live_purchases_buyer_id_fkey
FOREIGN KEY (buyer_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

-- Also fix product_showcase_events viewer_id if it exists
ALTER TABLE product_showcase_events
DROP CONSTRAINT IF EXISTS product_showcase_events_viewer_id_fkey;

ALTER TABLE product_showcase_events
ADD CONSTRAINT product_showcase_events_viewer_id_fkey
FOREIGN KEY (viewer_id) REFERENCES users(supabase_id) ON DELETE SET NULL;

-- Fix shopping_interactions creator_id
ALTER TABLE shopping_interactions
DROP CONSTRAINT IF EXISTS shopping_interactions_creator_id_fkey;

ALTER TABLE shopping_interactions
ADD CONSTRAINT shopping_interactions_creator_id_fkey
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

-- Fix shopping_interaction_responses viewer_id
ALTER TABLE shopping_interaction_responses
DROP CONSTRAINT IF EXISTS shopping_interaction_responses_viewer_id_fkey;

ALTER TABLE shopping_interaction_responses
ADD CONSTRAINT shopping_interaction_responses_viewer_id_fkey
FOREIGN KEY (viewer_id) REFERENCES users(supabase_id) ON DELETE CASCADE;
