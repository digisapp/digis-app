-- ============================================
-- SUPABASE SCHEMA IMPROVEMENTS FOR DIGIS
-- ============================================
-- This script adds critical improvements to your database schema
-- for better data integrity, performance, and reliability
-- 
-- Run this AFTER supabase-complete-schema-update-fixed.sql
-- in your Supabase SQL editor
-- ============================================

-- ============================================
-- STEP 1: Add Foreign Key Constraints
-- ============================================
-- Ensures referential integrity and automatic cleanup

-- Token balances foreign key
ALTER TABLE public.token_balances
DROP CONSTRAINT IF EXISTS fk_token_balances_supabase_user_id;

ALTER TABLE public.token_balances
ADD CONSTRAINT fk_token_balances_supabase_user_id 
FOREIGN KEY (supabase_user_id) 
REFERENCES public.users(supabase_id) 
ON DELETE CASCADE;

-- Token transactions foreign keys
ALTER TABLE public.token_transactions
DROP CONSTRAINT IF EXISTS fk_token_transactions_supabase_user_id;

ALTER TABLE public.token_transactions
ADD CONSTRAINT fk_token_transactions_supabase_user_id 
FOREIGN KEY (supabase_user_id) 
REFERENCES public.users(supabase_id) 
ON DELETE CASCADE;

-- Tips foreign keys
ALTER TABLE public.tips
DROP CONSTRAINT IF EXISTS fk_tips_sender_id,
DROP CONSTRAINT IF EXISTS fk_tips_receiver_id;

ALTER TABLE public.tips
ADD CONSTRAINT fk_tips_sender_id 
FOREIGN KEY (sender_id) 
REFERENCES public.users(id) 
ON DELETE CASCADE,
ADD CONSTRAINT fk_tips_receiver_id 
FOREIGN KEY (receiver_id) 
REFERENCES public.users(id) 
ON DELETE CASCADE;

-- Gifts sent foreign keys
ALTER TABLE public.gifts_sent
DROP CONSTRAINT IF EXISTS fk_gifts_sent_sender_id,
DROP CONSTRAINT IF EXISTS fk_gifts_sent_receiver_id,
DROP CONSTRAINT IF EXISTS fk_gifts_sent_gift_id;

ALTER TABLE public.gifts_sent
ADD CONSTRAINT fk_gifts_sent_sender_id 
FOREIGN KEY (sender_id) 
REFERENCES public.users(id) 
ON DELETE CASCADE,
ADD CONSTRAINT fk_gifts_sent_receiver_id 
FOREIGN KEY (receiver_id) 
REFERENCES public.users(id) 
ON DELETE CASCADE,
ADD CONSTRAINT fk_gifts_sent_gift_id 
FOREIGN KEY (gift_id) 
REFERENCES public.virtual_gifts(id) 
ON DELETE RESTRICT;

-- Sessions foreign keys (ensure cascade for creator)
ALTER TABLE public.sessions
DROP CONSTRAINT IF EXISTS fk_sessions_creator_id;

ALTER TABLE public.sessions
ADD CONSTRAINT fk_sessions_creator_id 
FOREIGN KEY (creator_id) 
REFERENCES public.users(id) 
ON DELETE CASCADE;

-- Chat messages foreign keys
ALTER TABLE public.chat_messages
DROP CONSTRAINT IF EXISTS fk_chat_messages_session_id,
DROP CONSTRAINT IF EXISTS fk_chat_messages_sender_id;

ALTER TABLE public.chat_messages
ADD CONSTRAINT fk_chat_messages_session_id 
FOREIGN KEY (session_id) 
REFERENCES public.sessions(id) 
ON DELETE CASCADE,
ADD CONSTRAINT fk_chat_messages_sender_id 
FOREIGN KEY (sender_id) 
REFERENCES public.users(id) 
ON DELETE CASCADE;

-- ============================================
-- STEP 2: Add Performance Indexes
-- ============================================
-- Composite indexes for common query patterns

-- Token transactions: frequently queried by user and date
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_created 
ON public.token_transactions(supabase_user_id, created_at DESC);

-- Sessions: lookup by channel for active sessions
CREATE INDEX IF NOT EXISTS idx_sessions_channel 
ON public.sessions(agora_channel) 
WHERE status = 'active';

-- Sessions: lookup by user_uid for user's sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_uid 
ON public.sessions(user_uid);

-- Chat messages: frequently queried by session
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created 
ON public.chat_messages(session_id, created_at DESC);

-- Tips: lookup by receiver for earnings
CREATE INDEX IF NOT EXISTS idx_tips_receiver_created 
ON public.tips(receiver_id, created_at DESC);

-- Gifts sent: lookup by receiver
CREATE INDEX IF NOT EXISTS idx_gifts_sent_receiver_created 
ON public.gifts_sent(receiver_id, created_at DESC);

-- ============================================
-- STEP 3: Add Data Validation Constraints
-- ============================================

-- Limit chat message length to prevent storage abuse
ALTER TABLE public.chat_messages
DROP CONSTRAINT IF EXISTS chat_message_length;

ALTER TABLE public.chat_messages
ADD CONSTRAINT chat_message_length 
CHECK (char_length(message) <= 1000);

-- Ensure positive amounts for transactions
ALTER TABLE public.token_transactions
DROP CONSTRAINT IF EXISTS positive_amount;

ALTER TABLE public.token_transactions
ADD CONSTRAINT positive_amount 
CHECK (amount > 0);

-- Ensure valid session duration
ALTER TABLE public.sessions
DROP CONSTRAINT IF EXISTS valid_duration;

ALTER TABLE public.sessions
ADD CONSTRAINT valid_duration 
CHECK (duration >= 0);

-- Ensure valid token prices
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS valid_price_per_min;

ALTER TABLE public.users
ADD CONSTRAINT valid_price_per_min 
CHECK (price_per_min >= 0 AND price_per_min <= 1000);

-- ============================================
-- STEP 4: Improve Trigger Error Handling
-- ============================================

-- Enhanced user sync trigger with error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  BEGIN
    -- Validate raw_user_meta_data
    IF new.raw_user_meta_data IS NULL OR jsonb_typeof(new.raw_user_meta_data) != 'object' THEN
      new.raw_user_meta_data = '{}'::jsonb;
    END IF;

    -- Insert or update user
    INSERT INTO public.users (
      supabase_id, 
      email, 
      username, 
      email_verified, 
      auth_provider, 
      raw_user_meta_data, 
      aud, 
      role, 
      confirmed_at, 
      created_at, 
      updated_at
    ) VALUES (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
      COALESCE(new.email_confirmed_at IS NOT NULL, FALSE),
      COALESCE(new.raw_app_meta_data->>'provider', 'email'),
      new.raw_user_meta_data,
      new.aud,
      new.role,
      new.confirmed_at,
      now(),
      now()
    ) ON CONFLICT (supabase_id) DO UPDATE SET
      email = EXCLUDED.email,
      email_verified = EXCLUDED.email_verified,
      raw_user_meta_data = EXCLUDED.raw_user_meta_data,
      updated_at = now();
    
    -- Create token balance for new user
    INSERT INTO public.token_balances (
      supabase_user_id, 
      balance, 
      created_at, 
      updated_at
    ) VALUES (
      new.id, 
      0, 
      now(), 
      now()
    ) ON CONFLICT (supabase_user_id) DO NOTHING;
    
    RETURN new;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail auth
    RAISE LOG 'Error syncing user %: %', new.id, SQLERRM;
    RETURN new;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 5: Add Utility Functions
-- ============================================

-- Function to safely update token balance
CREATE OR REPLACE FUNCTION public.update_token_balance(
  p_user_id UUID,
  p_amount INTEGER,
  p_type VARCHAR(50),
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, new_balance INTEGER, error TEXT) AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Lock the balance row
  SELECT balance INTO v_current_balance
  FROM public.token_balances
  WHERE supabase_user_id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'User balance not found';
    RETURN;
  END IF;
  
  -- Calculate new balance
  IF p_type IN ('purchase', 'earn', 'refund', 'gift_received') THEN
    v_new_balance := v_current_balance + p_amount;
  ELSIF p_type IN ('spend', 'tip', 'gift_sent') THEN
    v_new_balance := v_current_balance - p_amount;
  ELSE
    RETURN QUERY SELECT FALSE, v_current_balance, 'Invalid transaction type';
    RETURN;
  END IF;
  
  -- Check for negative balance
  IF v_new_balance < 0 THEN
    RETURN QUERY SELECT FALSE, v_current_balance, 'Insufficient balance';
    RETURN;
  END IF;
  
  -- Update balance
  UPDATE public.token_balances
  SET balance = v_new_balance,
      updated_at = now()
  WHERE supabase_user_id = p_user_id;
  
  -- Record transaction
  INSERT INTO public.token_transactions (
    supabase_user_id,
    type,
    amount,
    balance_before,
    balance_after,
    description,
    created_at
  ) VALUES (
    p_user_id,
    p_type,
    p_amount,
    v_current_balance,
    v_new_balance,
    p_description,
    now()
  );
  
  RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, v_current_balance, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 6: Add Missing Indexes for Session Lookups
-- ============================================

-- Index for finding active sessions by creator
CREATE INDEX IF NOT EXISTS idx_sessions_creator_active 
ON public.sessions(creator_id, status) 
WHERE status = 'active';

-- Index for session billing queries
CREATE INDEX IF NOT EXISTS idx_sessions_ended_at 
ON public.sessions(ended_at) 
WHERE ended_at IS NOT NULL;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Schema improvements applied successfully!';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Foreign keys added: ✓';
  RAISE NOTICE 'Performance indexes added: ✓';
  RAISE NOTICE 'Data validation constraints added: ✓';
  RAISE NOTICE 'Error handling improved: ✓';
  RAISE NOTICE 'Utility functions added: ✓';
  RAISE NOTICE '============================================';
END $$;