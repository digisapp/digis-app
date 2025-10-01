-- Create PPV (Pay-Per-View) messages table
CREATE TABLE IF NOT EXISTS ppv_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID UNIQUE, -- Reference to chat_messages if needed
  sender_id UUID NOT NULL REFERENCES users(supabase_id),
  receiver_id UUID NOT NULL REFERENCES users(supabase_id),
  conversation_id VARCHAR(255) NOT NULL,
  
  -- Content details
  content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('image', 'video', 'audio', 'file')),
  content_url TEXT NOT NULL, -- Encrypted/protected URL
  thumbnail_url TEXT, -- Preview image (blurred or cropped)
  file_name VARCHAR(255),
  file_size BIGINT,
  mime_type VARCHAR(100),
  duration INTEGER, -- For video/audio in seconds
  description TEXT,
  
  -- Pricing
  price INTEGER NOT NULL CHECK (price > 0), -- Price in tokens
  currency VARCHAR(10) DEFAULT 'tokens',
  
  -- Metadata
  is_exclusive BOOLEAN DEFAULT false,
  expires_at TIMESTAMP, -- Optional expiration
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Stats
  unlock_count INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0
);

-- Create indexes separately (PostgreSQL syntax)
CREATE INDEX IF NOT EXISTS idx_ppv_sender ON ppv_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_ppv_receiver ON ppv_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_ppv_conversation ON ppv_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ppv_created ON ppv_messages(created_at DESC);

-- Create PPV unlocks/purchases table
CREATE TABLE IF NOT EXISTS ppv_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ppv_message_id UUID NOT NULL REFERENCES ppv_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(supabase_id),
  price_paid INTEGER NOT NULL, -- Price at time of purchase
  unlocked_at TIMESTAMP DEFAULT NOW(),
  
  -- Prevent duplicate unlocks
  UNIQUE(ppv_message_id, user_id)
);

-- Create indexes for ppv_unlocks table
CREATE INDEX IF NOT EXISTS idx_ppv_unlocks_message ON ppv_unlocks(ppv_message_id);
CREATE INDEX IF NOT EXISTS idx_ppv_unlocks_user ON ppv_unlocks(user_id);
CREATE INDEX IF NOT EXISTS idx_ppv_unlocks_date ON ppv_unlocks(unlocked_at DESC);

-- Create chat_messages table if it doesn't exist (for direct message support)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(supabase_id),
  receiver_id UUID REFERENCES users(supabase_id),
  conversation_id VARCHAR(255),
  content TEXT,
  message_type VARCHAR(50) DEFAULT 'text',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add PPV fields to chat_messages table for integration
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS is_ppv BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ppv_price INTEGER,
ADD COLUMN IF NOT EXISTS ppv_message_id UUID REFERENCES ppv_messages(id),
ADD COLUMN IF NOT EXISTS ppv_unlocked BOOLEAN DEFAULT false;

-- Create view for PPV analytics
CREATE OR REPLACE VIEW ppv_analytics AS
SELECT 
  pm.sender_id as creator_id,
  COUNT(DISTINCT pm.id) as total_ppv_messages,
  COUNT(DISTINCT pu.id) as total_unlocks,
  SUM(pu.price_paid) as total_revenue,
  AVG(pu.price_paid) as avg_price,
  MAX(pu.unlocked_at) as last_unlock,
  COUNT(DISTINCT pm.receiver_id) as unique_recipients,
  COUNT(DISTINCT pu.user_id) as unique_buyers
FROM ppv_messages pm
LEFT JOIN ppv_unlocks pu ON pm.id = pu.ppv_message_id
GROUP BY pm.sender_id;

-- Create function to handle PPV unlock
CREATE OR REPLACE FUNCTION unlock_ppv_message(
  p_user_id UUID,
  p_ppv_message_id UUID
) RETURNS JSON AS $$
DECLARE
  v_message ppv_messages%ROWTYPE;
  v_user_balance INTEGER;
  v_unlock_id UUID;
BEGIN
  -- Get message details
  SELECT * INTO v_message FROM ppv_messages WHERE id = p_ppv_message_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Message not found');
  END IF;
  
  -- Check if already unlocked
  IF EXISTS (SELECT 1 FROM ppv_unlocks WHERE ppv_message_id = p_ppv_message_id AND user_id = p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Already unlocked');
  END IF;
  
  -- Check if user is the sender (creators see their own content free)
  IF v_message.sender_id = p_user_id THEN
    RETURN json_build_object('success', true, 'content_url', v_message.content_url, 'free', true);
  END IF;
  
  -- Check user balance
  SELECT token_balance INTO v_user_balance FROM users WHERE supabase_id = p_user_id;
  
  IF v_user_balance < v_message.price THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient tokens');
  END IF;
  
  -- Check if content expired
  IF v_message.expires_at IS NOT NULL AND v_message.expires_at < NOW() THEN
    RETURN json_build_object('success', false, 'error', 'Content has expired');
  END IF;
  
  -- Start transaction
  BEGIN
    -- Deduct tokens from buyer
    UPDATE users 
    SET token_balance = token_balance - v_message.price
    WHERE supabase_id = p_user_id;
    
    -- Add tokens to creator (100% - no platform fee)
    UPDATE users 
    SET token_balance = token_balance + v_message.price, -- 100% to creator
        total_earned = COALESCE(total_earned, 0) + v_message.price
    WHERE supabase_id = v_message.sender_id;
    
    -- Record the unlock
    INSERT INTO ppv_unlocks (ppv_message_id, user_id, price_paid)
    VALUES (p_ppv_message_id, p_user_id, v_message.price)
    RETURNING id INTO v_unlock_id;
    
    -- Update stats
    UPDATE ppv_messages 
    SET unlock_count = unlock_count + 1,
        total_earned = total_earned + v_message.price
    WHERE id = p_ppv_message_id;
    
    -- Update chat message if linked
    IF v_message.message_id IS NOT NULL THEN
      UPDATE chat_messages 
      SET ppv_unlocked = true 
      WHERE id = v_message.message_id AND receiver_id = p_user_id;
    END IF;
    
    -- Log transaction
    INSERT INTO token_transactions (
      user_id, 
      amount, 
      type, 
      description, 
      reference_id, 
      reference_type
    ) VALUES (
      p_user_id,
      -v_message.price,
      'ppv_unlock',
      CONCAT('Unlocked ', v_message.content_type, ' from creator'),
      p_ppv_message_id,
      'ppv_message'
    );
    
    RETURN json_build_object(
      'success', true, 
      'content_url', v_message.content_url,
      'unlock_id', v_unlock_id,
      'tokens_spent', v_message.price
    );
    
  EXCEPTION WHEN OTHERS THEN
    -- Rollback will happen automatically
    RETURN json_build_object('success', false, 'error', 'Transaction failed');
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies
ALTER TABLE ppv_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppv_unlocks ENABLE ROW LEVEL SECURITY;

-- Creators can see all their PPV messages
CREATE POLICY "Creators view own PPV messages" ON ppv_messages
  FOR SELECT USING (sender_id = auth.uid());

-- Recipients can see PPV messages sent to them
CREATE POLICY "Recipients view PPV messages" ON ppv_messages
  FOR SELECT USING (receiver_id = auth.uid());

-- Creators can create PPV messages
CREATE POLICY "Creators create PPV messages" ON ppv_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- Users can view their own unlocks
CREATE POLICY "Users view own unlocks" ON ppv_unlocks
  FOR SELECT USING (user_id = auth.uid());

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_ppv ON chat_messages(is_ppv) WHERE is_ppv = true;
CREATE INDEX IF NOT EXISTS idx_ppv_messages_expires ON ppv_messages(expires_at) WHERE expires_at IS NOT NULL;