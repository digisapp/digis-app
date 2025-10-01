-- Create Tips table if it doesn't exist
CREATE TABLE IF NOT EXISTS tips (
    id SERIAL PRIMARY KEY,
    tip_id VARCHAR(255) UNIQUE NOT NULL,
    supabase_tipper_id UUID NOT NULL,
    creator_id INTEGER NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    message TEXT DEFAULT '',
    session_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign keys
    FOREIGN KEY (supabase_tipper_id) REFERENCES users(supabase_id) ON DELETE CASCADE,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT chk_tip_amount_positive CHECK (amount > 0)
);

-- Create indexes for tips table
CREATE INDEX IF NOT EXISTS idx_tips_tipper_id ON tips(supabase_tipper_id);
CREATE INDEX IF NOT EXISTS idx_tips_creator_id ON tips(creator_id);
CREATE INDEX IF NOT EXISTS idx_tips_created_at ON tips(created_at);
CREATE INDEX IF NOT EXISTS idx_tips_session_id ON tips(session_id);

-- RLS Policies for tips
ALTER TABLE tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tips they sent" ON tips
    FOR SELECT USING (supabase_tipper_id = auth.uid());

CREATE POLICY "Creators can view tips they received" ON tips
    FOR SELECT USING (
        auth.uid() IN (
            SELECT supabase_id FROM users WHERE id = tips.creator_id
        )
    );

-- Function to process token tip (if not exists)
CREATE OR REPLACE FUNCTION process_token_tip(
    p_fan_id INTEGER,
    p_creator_id INTEGER,
    p_amount DECIMAL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_fan_supabase_id UUID;
    v_creator_supabase_id UUID;
    v_fan_balance DECIMAL;
BEGIN
    -- Get Supabase IDs
    SELECT supabase_id INTO v_fan_supabase_id
    FROM users WHERE id = p_fan_id;
    
    SELECT supabase_id INTO v_creator_supabase_id
    FROM users WHERE id = p_creator_id;
    
    -- Check fan balance
    SELECT balance INTO v_fan_balance
    FROM token_balances WHERE supabase_user_id = v_fan_supabase_id;
    
    IF v_fan_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;
    
    -- Deduct from fan
    UPDATE token_balances 
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE supabase_user_id = v_fan_supabase_id;
    
    -- Add to creator
    UPDATE token_balances 
    SET balance = balance + p_amount,
        updated_at = NOW()
    WHERE supabase_user_id = v_creator_supabase_id;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Add columns to users table for Supabase if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS supabase_id UUID UNIQUE,
ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email';

-- Create index on supabase_id
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);

-- Update token_balances to use supabase_user_id if not already done
ALTER TABLE token_balances 
ADD COLUMN IF NOT EXISTS supabase_user_id UUID;

-- Add foreign key constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_token_balances_supabase_user'
    ) THEN
        ALTER TABLE token_balances 
        ADD CONSTRAINT fk_token_balances_supabase_user 
        FOREIGN KEY (supabase_user_id) 
        REFERENCES users(supabase_id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- Add supabase_user_id to token_transactions if not exists
ALTER TABLE token_transactions 
ADD COLUMN IF NOT EXISTS supabase_user_id UUID;

-- Add foreign key constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_token_transactions_supabase_user'
    ) THEN
        ALTER TABLE token_transactions 
        ADD CONSTRAINT fk_token_transactions_supabase_user 
        FOREIGN KEY (supabase_user_id) 
        REFERENCES users(supabase_id) 
        ON DELETE CASCADE;
    END IF;
END $$;