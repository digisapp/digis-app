-- Migration to transition from Firebase to Supabase Auth
-- This migration updates the users table to work with Supabase Auth

-- Step 1: Add new columns for Supabase Auth
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS supabase_id UUID UNIQUE,
ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS raw_user_meta_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS aud VARCHAR(255) DEFAULT 'authenticated',
ADD COLUMN IF NOT EXISTS role VARCHAR(255) DEFAULT 'authenticated',
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invitation_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS confirmation_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS recovery_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS recovery_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS email_change_token_new VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_change VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_change_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS email_change_token_current VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_change_confirm_status SMALLINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS banned_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reauthentication_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS reauthentication_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_sso_user BOOLEAN DEFAULT FALSE;

-- Step 2: Create index on supabase_id for performance
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);

-- Step 3: Create a temporary mapping table for migration
CREATE TABLE IF NOT EXISTS auth_migration_mapping (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,
    supabase_id UUID UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    migrated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    migration_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Step 4: Update foreign key constraints to support both firebase_uid and supabase_id during migration
-- We'll keep firebase_uid for now and gradually transition to supabase_id

-- Add supabase_id column to token_balances
ALTER TABLE token_balances 
ADD COLUMN IF NOT EXISTS supabase_user_id UUID,
ADD CONSTRAINT fk_token_balances_supabase_user 
    FOREIGN KEY (supabase_user_id) 
    REFERENCES users(supabase_id) 
    ON DELETE CASCADE;

-- Add supabase_id column to token_transactions
ALTER TABLE token_transactions 
ADD COLUMN IF NOT EXISTS supabase_user_id UUID,
ADD CONSTRAINT fk_token_transactions_supabase_user 
    FOREIGN KEY (supabase_user_id) 
    REFERENCES users(supabase_id) 
    ON DELETE CASCADE;

-- Add supabase_id column to payments
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS supabase_user_id UUID,
ADD CONSTRAINT fk_payments_supabase_user 
    FOREIGN KEY (supabase_user_id) 
    REFERENCES users(supabase_id) 
    ON DELETE CASCADE;

-- Add supabase_id column to creator_subscriptions
ALTER TABLE creator_subscriptions 
ADD COLUMN IF NOT EXISTS supabase_subscriber_id UUID,
ADD CONSTRAINT fk_creator_subscriptions_supabase_subscriber 
    FOREIGN KEY (supabase_subscriber_id) 
    REFERENCES users(supabase_id) 
    ON DELETE CASCADE;

-- Add supabase_id column to followers
ALTER TABLE followers 
ADD COLUMN IF NOT EXISTS supabase_follower_id UUID,
ADD CONSTRAINT fk_followers_supabase_follower 
    FOREIGN KEY (supabase_follower_id) 
    REFERENCES users(supabase_id) 
    ON DELETE CASCADE;

-- Add supabase_id column to tips
ALTER TABLE tips 
ADD COLUMN IF NOT EXISTS supabase_tipper_id UUID,
ADD CONSTRAINT fk_tips_supabase_tipper 
    FOREIGN KEY (supabase_tipper_id) 
    REFERENCES users(supabase_id) 
    ON DELETE CASCADE;

-- Step 5: Create function to link Supabase auth.users to our users table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if user already exists with this email
    IF EXISTS (SELECT 1 FROM public.users WHERE email = NEW.email) THEN
        -- Update existing user with Supabase ID
        UPDATE public.users
        SET 
            supabase_id = NEW.id,
            email_verified = NEW.email_confirmed_at IS NOT NULL,
            raw_user_meta_data = NEW.raw_user_meta_data,
            aud = NEW.aud,
            role = NEW.role,
            confirmed_at = NEW.email_confirmed_at,
            updated_at = NOW()
        WHERE email = NEW.email;
    ELSE
        -- Insert new user
        INSERT INTO public.users (
            supabase_id,
            email,
            email_verified,
            username,
            display_name,
            auth_provider,
            raw_user_meta_data,
            aud,
            role,
            confirmed_at,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            NEW.email,
            NEW.email_confirmed_at IS NOT NULL,
            COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
            COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
            COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
            NEW.raw_user_meta_data,
            NEW.aud,
            NEW.role,
            NEW.email_confirmed_at,
            NEW.created_at,
            NEW.updated_at
        );
        
        -- Create token balance for new user
        INSERT INTO public.token_balances (
            user_id,
            supabase_user_id,
            balance,
            created_at
        ) VALUES (
            NEW.email, -- Temporarily use email, will be migrated to UUID
            NEW.id,
            0.00,
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create trigger for new Supabase users (will be activated after enabling in Supabase dashboard)
-- Note: This trigger should be created on the auth.users table in Supabase
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--     AFTER INSERT ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 7: Create function to handle user updates
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.users
    SET 
        email = NEW.email,
        email_verified = NEW.email_confirmed_at IS NOT NULL,
        phone = NEW.phone,
        phone_verified = NEW.phone_confirmed_at IS NOT NULL,
        raw_user_meta_data = NEW.raw_user_meta_data,
        aud = NEW.aud,
        role = NEW.role,
        banned_until = NEW.banned_until,
        updated_at = NOW()
    WHERE supabase_id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Create RLS policies for Supabase Auth
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tips ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = supabase_id);

CREATE POLICY "Users can view public creator profiles" ON users
    FOR SELECT USING (is_creator = true);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = supabase_id);

-- Token balances policies
CREATE POLICY "Users can view their own token balance" ON token_balances
    FOR SELECT USING (auth.uid() = supabase_user_id);

-- Token transactions policies
CREATE POLICY "Users can view their own transactions" ON token_transactions
    FOR SELECT USING (auth.uid() = supabase_user_id);

-- Sessions policies
CREATE POLICY "Users can view their own sessions" ON sessions
    FOR SELECT USING (
        auth.uid() IN (
            SELECT supabase_id FROM users WHERE id = sessions.creator_id
            UNION
            SELECT supabase_id FROM users WHERE id = sessions.fan_id
        )
    );

-- Payments policies
CREATE POLICY "Users can view their own payments" ON payments
    FOR SELECT USING (auth.uid() = supabase_user_id);

-- Creator subscriptions policies
CREATE POLICY "Users can view their own subscriptions" ON creator_subscriptions
    FOR SELECT USING (auth.uid() = supabase_subscriber_id);

CREATE POLICY "Creators can view their subscribers" ON creator_subscriptions
    FOR SELECT USING (
        auth.uid() IN (
            SELECT supabase_id FROM users WHERE id = creator_subscriptions.creator_id
        )
    );

-- Followers policies
CREATE POLICY "Anyone can view follower counts" ON followers
    FOR SELECT USING (true);

-- Tips policies
CREATE POLICY "Users can view tips they sent or received" ON tips
    FOR SELECT USING (
        auth.uid() = supabase_tipper_id OR
        auth.uid() IN (
            SELECT supabase_id FROM users WHERE id = tips.creator_id
        )
    );

-- Step 9: Create helper functions for the migration
CREATE OR REPLACE FUNCTION migrate_user_to_supabase(
    p_firebase_uid VARCHAR(255),
    p_supabase_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_email VARCHAR(255);
BEGIN
    -- Get user email
    SELECT email INTO v_user_email
    FROM users
    WHERE firebase_uid = p_firebase_uid;
    
    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'User with firebase_uid % not found', p_firebase_uid;
    END IF;
    
    -- Update user record
    UPDATE users
    SET supabase_id = p_supabase_id
    WHERE firebase_uid = p_firebase_uid;
    
    -- Update related tables
    UPDATE token_balances
    SET supabase_user_id = p_supabase_id
    WHERE user_id = p_firebase_uid;
    
    UPDATE token_transactions
    SET supabase_user_id = p_supabase_id
    WHERE user_id = p_firebase_uid;
    
    UPDATE payments
    SET supabase_user_id = p_supabase_id
    WHERE user_id = p_firebase_uid;
    
    UPDATE creator_subscriptions
    SET supabase_subscriber_id = p_supabase_id
    WHERE subscriber_id = p_firebase_uid;
    
    UPDATE followers
    SET supabase_follower_id = p_supabase_id
    WHERE follower_id = p_firebase_uid;
    
    UPDATE tips
    SET supabase_tipper_id = p_supabase_id
    WHERE tipper_id = p_firebase_uid;
    
    -- Record migration
    INSERT INTO auth_migration_mapping (
        firebase_uid,
        supabase_id,
        email,
        migration_status
    ) VALUES (
        p_firebase_uid,
        p_supabase_id,
        v_user_email,
        'completed'
    )
    ON CONFLICT (firebase_uid) 
    DO UPDATE SET 
        supabase_id = EXCLUDED.supabase_id,
        migration_status = 'completed',
        migrated_at = NOW();
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error
        INSERT INTO auth_migration_mapping (
            firebase_uid,
            supabase_id,
            email,
            migration_status,
            error_message
        ) VALUES (
            p_firebase_uid,
            p_supabase_id,
            v_user_email,
            'failed',
            SQLERRM
        )
        ON CONFLICT (firebase_uid) 
        DO UPDATE SET 
            migration_status = 'failed',
            error_message = SQLERRM,
            migrated_at = NOW();
        
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Add comments for documentation
COMMENT ON COLUMN users.supabase_id IS 'Supabase Auth UUID - primary identifier after migration';
COMMENT ON COLUMN users.firebase_uid IS 'Legacy Firebase UID - to be deprecated after migration';
COMMENT ON TABLE auth_migration_mapping IS 'Temporary table to track Firebase to Supabase auth migration';