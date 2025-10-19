-- Migration: Add Pay-Per-View Messages System
-- This allows creators to send locked content that fans must unlock with tokens

-- Create PPV messages table
CREATE TABLE IF NOT EXISTS ppv_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  receiver_id UUID,
  conversation_id UUID,
  message_id UUID,

  -- Content details
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('image', 'video', 'audio', 'file')),
  content_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_name VARCHAR(255),
  file_size BIGINT,
  mime_type VARCHAR(100),

  -- Pricing and access
  description TEXT,
  price INTEGER NOT NULL DEFAULT 10, -- Tokens required to unlock
  is_exclusive BOOLEAN DEFAULT false, -- If true, only specific receiver can unlock
  expires_at TIMESTAMPTZ, -- Optional expiration date

  -- Analytics
  unlock_count INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign keys
  CONSTRAINT fk_ppv_sender FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create PPV unlocks table (tracks who unlocked what)
CREATE TABLE IF NOT EXISTS ppv_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ppv_message_id UUID NOT NULL REFERENCES ppv_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  price_paid INTEGER NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate unlocks
  UNIQUE(ppv_message_id, user_id),

  -- Foreign key
  CONSTRAINT fk_ppv_unlock_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add PPV columns to chat_messages if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='is_ppv') THEN
    ALTER TABLE chat_messages ADD COLUMN is_ppv BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='ppv_price') THEN
    ALTER TABLE chat_messages ADD COLUMN ppv_price INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='ppv_message_id') THEN
    ALTER TABLE chat_messages ADD COLUMN ppv_message_id UUID REFERENCES ppv_messages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ppv_messages_sender ON ppv_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_ppv_messages_receiver ON ppv_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_ppv_messages_created ON ppv_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ppv_unlocks_user ON ppv_unlocks(user_id);
CREATE INDEX IF NOT EXISTS idx_ppv_unlocks_message ON ppv_unlocks(ppv_message_id);

-- Drop function if it exists (in case of re-running migration)
DROP FUNCTION IF EXISTS unlock_ppv_message(UUID, UUID);

-- Create function to unlock PPV content
CREATE FUNCTION unlock_ppv_message(
  p_user_id UUID,
  p_message_id UUID
) RETURNS JSON AS $$
DECLARE
  v_ppv_message ppv_messages%ROWTYPE;
  v_sender_id UUID;
  v_price INTEGER;
  v_user_balance INTEGER;
  v_unlock_id UUID;
  v_content_url TEXT;
  v_already_unlocked BOOLEAN;
BEGIN
  -- Get PPV message details
  SELECT * INTO v_ppv_message
  FROM ppv_messages
  WHERE id = p_message_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Message not found');
  END IF;

  -- Check if message has expired
  IF v_ppv_message.expires_at IS NOT NULL AND v_ppv_message.expires_at < NOW() THEN
    RETURN json_build_object('success', false, 'error', 'Content has expired');
  END IF;

  -- Check if user is the sender (senders can always access their own content)
  IF v_ppv_message.sender_id = p_user_id THEN
    RETURN json_build_object(
      'success', true,
      'content_url', v_ppv_message.content_url,
      'tokens_spent', 0,
      'message', 'You are the sender'
    );
  END IF;

  -- Check if already unlocked
  SELECT EXISTS(
    SELECT 1 FROM ppv_unlocks
    WHERE ppv_message_id = p_message_id AND user_id = p_user_id
  ) INTO v_already_unlocked;

  IF v_already_unlocked THEN
    RETURN json_build_object(
      'success', true,
      'content_url', v_ppv_message.content_url,
      'tokens_spent', 0,
      'message', 'Already unlocked'
    );
  END IF;

  -- Check if content is exclusive and user is not the receiver
  IF v_ppv_message.is_exclusive AND v_ppv_message.receiver_id IS NOT NULL AND v_ppv_message.receiver_id != p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'This content is exclusive');
  END IF;

  -- Get user's token balance (check token_balances table first, fall back to users table)
  SELECT COALESCE(
    (SELECT balance FROM token_balances WHERE user_id = p_user_id),
    (SELECT token_balance FROM users WHERE supabase_id = p_user_id)
  ) INTO v_user_balance;

  v_price := v_ppv_message.price;

  -- Check if user has enough tokens
  IF v_user_balance < v_price THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient tokens');
  END IF;

  -- Deduct tokens from user (try token_balances first, then users)
  IF EXISTS (SELECT 1 FROM token_balances WHERE user_id = p_user_id) THEN
    UPDATE token_balances
    SET balance = balance - v_price
    WHERE user_id = p_user_id;
  ELSE
    UPDATE users
    SET token_balance = token_balance - v_price
    WHERE supabase_id = p_user_id;
  END IF;

  -- Add tokens to creator (try token_balances first, then users)
  IF EXISTS (SELECT 1 FROM token_balances WHERE user_id = v_ppv_message.sender_id) THEN
    UPDATE token_balances
    SET balance = balance + v_price
    WHERE user_id = v_ppv_message.sender_id;
  ELSE
    UPDATE users
    SET token_balance = token_balance + v_price
    WHERE supabase_id = v_ppv_message.sender_id;
  END IF;

  -- Record the unlock
  INSERT INTO ppv_unlocks (ppv_message_id, user_id, price_paid)
  VALUES (p_message_id, p_user_id, v_price)
  RETURNING id INTO v_unlock_id;

  -- Update PPV message analytics
  UPDATE ppv_messages
  SET unlock_count = unlock_count + 1,
      total_earned = total_earned + v_price,
      updated_at = NOW()
  WHERE id = p_message_id;

  -- Record token transactions
  IF EXISTS (SELECT 1 FROM token_transactions) THEN
    INSERT INTO token_transactions (user_id, type, amount, description, related_user_id)
    VALUES (p_user_id, 'deduction', v_price, 'Unlocked PPV content', v_ppv_message.sender_id);

    INSERT INTO token_transactions (user_id, type, amount, description, related_user_id)
    VALUES (v_ppv_message.sender_id, 'earning', v_price, 'PPV content unlocked', p_user_id);
  END IF;

  RETURN json_build_object(
    'success', true,
    'content_url', v_ppv_message.content_url,
    'unlock_id', v_unlock_id,
    'tokens_spent', v_price
  );
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE ppv_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppv_unlocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ppv_messages
CREATE POLICY "Users can view PPV messages they sent or received"
  ON ppv_messages FOR SELECT
  USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
    OR is_exclusive = false
  );

CREATE POLICY "Creators can create PPV messages"
  ON ppv_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND is_creator = true)
  );

CREATE POLICY "Senders can update their PPV messages"
  ON ppv_messages FOR UPDATE
  USING (auth.uid() = sender_id);

-- RLS Policies for ppv_unlocks
CREATE POLICY "Users can view their unlocks"
  ON ppv_unlocks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create unlocks"
  ON ppv_unlocks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE ppv_messages IS 'Pay-per-view messages that require tokens to unlock';
COMMENT ON TABLE ppv_unlocks IS 'Tracks which users have unlocked which PPV messages';
COMMENT ON FUNCTION unlock_ppv_message IS 'Handles the complete flow of unlocking PPV content with token deduction';

SELECT 'PPV Messages System created successfully' AS status;
