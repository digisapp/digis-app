-- Supabase database functions for token operations and real-time features

-- Function to deduct tokens from a user (atomic operation)
CREATE OR REPLACE FUNCTION deduct_tokens(
  p_user_id UUID,
  p_amount DECIMAL,
  p_session_id INTEGER DEFAULT NULL,
  p_description TEXT DEFAULT ''
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance DECIMAL;
  v_new_balance DECIMAL;
  v_transaction_id VARCHAR(255);
BEGIN
  -- Lock the balance row for update
  SELECT balance INTO v_current_balance
  FROM token_balances
  WHERE supabase_user_id = p_user_id
  FOR UPDATE;
  
  -- Check if user has sufficient balance
  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient token balance',
      'current_balance', v_current_balance,
      'required_amount', p_amount
    );
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_current_balance - p_amount;
  v_transaction_id := gen_random_uuid()::text;
  
  -- Update balance
  UPDATE token_balances
  SET 
    balance = v_new_balance,
    total_spent = total_spent + p_amount,
    last_transaction_at = NOW(),
    updated_at = NOW()
  WHERE supabase_user_id = p_user_id;
  
  -- Record transaction
  INSERT INTO token_transactions (
    transaction_id,
    user_id,
    supabase_user_id,
    type,
    amount,
    balance_before,
    balance_after,
    session_id,
    description,
    created_at
  ) VALUES (
    v_transaction_id,
    p_user_id::text,
    p_user_id,
    'spend',
    -p_amount,
    v_current_balance,
    v_new_balance,
    p_session_id,
    p_description,
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'amount_deducted', p_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to credit tokens to a user (atomic operation)
CREATE OR REPLACE FUNCTION credit_tokens(
  p_user_id UUID,
  p_amount DECIMAL,
  p_session_id INTEGER DEFAULT NULL,
  p_description TEXT DEFAULT ''
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance DECIMAL;
  v_new_balance DECIMAL;
  v_transaction_id VARCHAR(255);
BEGIN
  -- Lock the balance row for update
  SELECT balance INTO v_current_balance
  FROM token_balances
  WHERE supabase_user_id = p_user_id
  FOR UPDATE;
  
  -- Calculate new balance
  v_new_balance := v_current_balance + p_amount;
  v_transaction_id := gen_random_uuid()::text;
  
  -- Update balance
  UPDATE token_balances
  SET 
    balance = v_new_balance,
    total_earned = total_earned + p_amount,
    last_transaction_at = NOW(),
    updated_at = NOW()
  WHERE supabase_user_id = p_user_id;
  
  -- Record transaction
  INSERT INTO token_transactions (
    transaction_id,
    user_id,
    supabase_user_id,
    type,
    amount,
    balance_before,
    balance_after,
    session_id,
    description,
    created_at
  ) VALUES (
    v_transaction_id,
    p_user_id::text,
    p_user_id,
    'earn',
    p_amount,
    v_current_balance,
    v_new_balance,
    p_session_id,
    p_description,
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'amount_credited', p_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to transfer tokens between users
CREATE OR REPLACE FUNCTION transfer_tokens(
  p_from_user_id UUID,
  p_to_user_id UUID,
  p_amount DECIMAL,
  p_type VARCHAR(50) DEFAULT 'tip',
  p_message TEXT DEFAULT ''
)
RETURNS JSONB AS $$
DECLARE
  v_from_balance DECIMAL;
  v_to_balance DECIMAL;
  v_transaction_id VARCHAR(255);
  v_tip_id VARCHAR(255);
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount must be positive'
    );
  END IF;
  
  -- Lock both balance rows
  SELECT balance INTO v_from_balance
  FROM token_balances
  WHERE supabase_user_id = p_from_user_id
  FOR UPDATE;
  
  SELECT balance INTO v_to_balance
  FROM token_balances
  WHERE supabase_user_id = p_to_user_id
  FOR UPDATE;
  
  -- Check sufficient balance
  IF v_from_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'current_balance', v_from_balance,
      'required_amount', p_amount
    );
  END IF;
  
  v_transaction_id := gen_random_uuid()::text;
  
  -- Deduct from sender
  UPDATE token_balances
  SET 
    balance = balance - p_amount,
    total_spent = total_spent + p_amount,
    last_transaction_at = NOW(),
    updated_at = NOW()
  WHERE supabase_user_id = p_from_user_id;
  
  -- Credit to receiver
  UPDATE token_balances
  SET 
    balance = balance + p_amount,
    total_earned = total_earned + p_amount,
    last_transaction_at = NOW(),
    updated_at = NOW()
  WHERE supabase_user_id = p_to_user_id;
  
  -- Record sender transaction
  INSERT INTO token_transactions (
    transaction_id,
    user_id,
    supabase_user_id,
    type,
    amount,
    balance_before,
    balance_after,
    description,
    metadata,
    created_at
  ) VALUES (
    v_transaction_id || '_from',
    p_from_user_id::text,
    p_from_user_id,
    p_type,
    -p_amount,
    v_from_balance,
    v_from_balance - p_amount,
    COALESCE(p_message, 'Token transfer'),
    jsonb_build_object('to_user_id', p_to_user_id, 'transfer_type', p_type),
    NOW()
  );
  
  -- Record receiver transaction
  INSERT INTO token_transactions (
    transaction_id,
    user_id,
    supabase_user_id,
    type,
    amount,
    balance_before,
    balance_after,
    description,
    metadata,
    created_at
  ) VALUES (
    v_transaction_id || '_to',
    p_to_user_id::text,
    p_to_user_id,
    p_type,
    p_amount,
    v_to_balance,
    v_to_balance + p_amount,
    COALESCE(p_message, 'Token transfer received'),
    jsonb_build_object('from_user_id', p_from_user_id, 'transfer_type', p_type),
    NOW()
  );
  
  -- If it's a tip, record it in tips table
  IF p_type = 'tip' THEN
    v_tip_id := gen_random_uuid()::text;
    
    INSERT INTO tips (
      tip_id,
      tipper_id,
      supabase_tipper_id,
      creator_id,
      amount,
      message,
      created_at
    ) VALUES (
      v_tip_id,
      p_from_user_id::text,
      p_from_user_id,
      (SELECT id FROM users WHERE supabase_id = p_to_user_id),
      p_amount,
      p_message,
      NOW()
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'from_balance', v_from_balance - p_amount,
    'to_balance', v_to_balance + p_amount,
    'amount', p_amount,
    'tip_id', v_tip_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's token balance with transaction summary
CREATE OR REPLACE FUNCTION get_token_summary(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_balance RECORD;
  v_recent_transactions JSONB;
BEGIN
  -- Get balance info
  SELECT * INTO v_balance
  FROM token_balances
  WHERE supabase_user_id = p_user_id;
  
  -- Get recent transactions
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', transaction_id,
      'type', type,
      'amount', amount,
      'description', description,
      'created_at', created_at
    ) ORDER BY created_at DESC
  ) INTO v_recent_transactions
  FROM (
    SELECT * FROM token_transactions
    WHERE supabase_user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 10
  ) t;
  
  RETURN jsonb_build_object(
    'balance', COALESCE(v_balance.balance, 0),
    'total_purchased', COALESCE(v_balance.total_purchased, 0),
    'total_spent', COALESCE(v_balance.total_spent, 0),
    'total_earned', COALESCE(v_balance.total_earned, 0),
    'last_transaction_at', v_balance.last_transaction_at,
    'recent_transactions', COALESCE(v_recent_transactions, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end a session and calculate final billing
CREATE OR REPLACE FUNCTION end_session_with_billing(
  p_session_id INTEGER,
  p_end_reason VARCHAR(50) DEFAULT 'normal'
)
RETURNS JSONB AS $$
DECLARE
  v_session RECORD;
  v_duration_minutes INTEGER;
  v_total_cost DECIMAL;
  v_deduct_result JSONB;
  v_credit_result JSONB;
BEGIN
  -- Get session details
  SELECT * INTO v_session
  FROM sessions
  WHERE id = p_session_id AND status = 'active'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Active session not found'
    );
  END IF;
  
  -- Calculate duration
  v_duration_minutes := GREATEST(
    1, 
    CEIL(EXTRACT(EPOCH FROM (NOW() - v_session.start_time)) / 60)
  );
  
  v_total_cost := v_duration_minutes * v_session.rate_per_min;
  
  -- Update session
  UPDATE sessions
  SET 
    status = 'ended',
    end_time = NOW(),
    duration_minutes = v_duration_minutes,
    total_cost = v_total_cost,
    updated_at = NOW()
  WHERE id = p_session_id;
  
  -- Get member's Supabase ID
  DECLARE
    v_member_supabase_id UUID;
    v_creator_supabase_id UUID;
  BEGIN
    SELECT supabase_id INTO v_member_supabase_id
    FROM users WHERE id = v_session.fan_id;
    
    SELECT supabase_id INTO v_creator_supabase_id
    FROM users WHERE id = v_session.creator_id;
    
    -- Deduct tokens from member
    v_deduct_result := deduct_tokens(
      v_member_supabase_id,
      v_total_cost,
      p_session_id,
      format('%s session with creator - %s minutes', v_session.type, v_duration_minutes)
    );
    
    IF (v_deduct_result->>'success')::boolean THEN
      -- Credit tokens to creator (100% - no platform fee)
      v_credit_result := credit_tokens(
        v_creator_supabase_id,
        v_total_cost,
        p_session_id,
        format('Earnings from %s session - %s minutes', v_session.type, v_duration_minutes)
      );
    END IF;
  END;
  
  RETURN jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'duration_minutes', v_duration_minutes,
    'total_cost', v_total_cost,
    'billing', jsonb_build_object(
      'deduct_result', v_deduct_result,
      'credit_result', v_credit_result
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION deduct_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION credit_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION get_token_summary TO authenticated;
GRANT EXECUTE ON FUNCTION end_session_with_billing TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_token_transactions_supabase_user_id 
  ON token_transactions(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at_desc 
  ON token_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tips_supabase_tipper_id 
  ON tips(supabase_tipper_id);

-- Add table for session participants (for Agora webhook tracking)
CREATE TABLE IF NOT EXISTS session_participants (
    id SERIAL PRIMARY KEY,
    session_channel VARCHAR(255) NOT NULL,
    user_uid VARCHAR(255) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_session_participants_channel (session_channel),
    INDEX idx_session_participants_status (status)
);

-- Add table for session recordings
CREATE TABLE IF NOT EXISTS session_recordings (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    recording_url TEXT NOT NULL,
    file_size BIGINT,
    duration_seconds INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    
    -- Index
    INDEX idx_session_recordings_session_id (session_id)
);

-- Enable RLS on new tables
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_recordings ENABLE ROW LEVEL SECURITY;

-- RLS policies for session_participants
CREATE POLICY "Creators can view their session participants" ON session_participants
    FOR SELECT USING (
        session_channel IN (
            SELECT agora_channel FROM sessions 
            WHERE creator_id IN (
                SELECT id FROM users WHERE supabase_id = auth.uid()
            )
        )
    );

-- RLS policies for session_recordings
CREATE POLICY "Users can view recordings of their sessions" ON session_recordings
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM sessions 
            WHERE creator_id IN (SELECT id FROM users WHERE supabase_id = auth.uid())
            OR fan_id IN (SELECT id FROM users WHERE supabase_id = auth.uid())
        )
    );