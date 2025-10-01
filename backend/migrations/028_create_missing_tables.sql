-- Create chat_messages table for Agora chat integration
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id SERIAL PRIMARY KEY,
  channel VARCHAR(64) NOT NULL,
  sender_id UUID REFERENCES public.users(supabase_id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'text' CHECK (type IN ('text', 'image', 'file', 'system')),
  file_url VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON public.chat_messages(channel);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_created ON public.chat_messages(channel, created_at DESC);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_messages
CREATE POLICY chat_messages_select ON public.chat_messages
  FOR SELECT USING (
    sender_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.users creator ON s.creator_id = creator.id
      JOIN public.users fan ON s.fan_id = fan.id
      WHERE s.agora_channel = chat_messages.channel
      AND (creator.supabase_id = auth.uid() OR fan.supabase_id = auth.uid())
    )
  );

CREATE POLICY chat_messages_insert ON public.chat_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY chat_messages_update ON public.chat_messages
  FOR UPDATE USING (sender_id = auth.uid());

-- Create token_balances table
CREATE TABLE IF NOT EXISTS public.token_balances (
  user_id UUID PRIMARY KEY REFERENCES public.users(supabase_id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0 CHECK (balance >= 0),
  total_purchased INTEGER DEFAULT 0 CHECK (total_purchased >= 0),
  total_spent INTEGER DEFAULT 0 CHECK (total_spent >= 0),
  total_earned INTEGER DEFAULT 0 CHECK (total_earned >= 0),
  total_tipped INTEGER DEFAULT 0 CHECK (total_tipped >= 0),
  last_transaction_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.token_balances ENABLE ROW LEVEL SECURITY;

-- RLS policies for token_balances
CREATE POLICY token_balances_select ON public.token_balances
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY token_balances_update ON public.token_balances
  FOR UPDATE USING (user_id = auth.uid());

-- Create membership_tiers table
CREATE TABLE IF NOT EXISTS public.membership_tiers (
  id SERIAL PRIMARY KEY,
  creator_id UUID REFERENCES public.users(supabase_id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  benefits JSONB DEFAULT '[]',
  tier_level INTEGER DEFAULT 1,
  color VARCHAR(7) DEFAULT '#6366F1',
  tokens_included INTEGER DEFAULT 0 CHECK (tokens_included >= 0),
  session_discount_percent INTEGER DEFAULT 0 CHECK (session_discount_percent >= 0 AND session_discount_percent <= 100),
  exclusive_content BOOLEAN DEFAULT false,
  priority_support BOOLEAN DEFAULT false,
  custom_emojis BOOLEAN DEFAULT false,
  badge_icon VARCHAR(255),
  max_members INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_creator_tier_name UNIQUE (creator_id, name)
);

-- Indexes for membership_tiers
CREATE INDEX IF NOT EXISTS idx_membership_tiers_creator ON public.membership_tiers(creator_id);
CREATE INDEX IF NOT EXISTS idx_membership_tiers_active ON public.membership_tiers(is_active);

-- Enable RLS
ALTER TABLE public.membership_tiers ENABLE ROW LEVEL SECURITY;

-- RLS policies for membership_tiers
CREATE POLICY membership_tiers_select ON public.membership_tiers
  FOR SELECT USING (true); -- Public read

CREATE POLICY membership_tiers_insert ON public.membership_tiers
  FOR INSERT WITH CHECK (creator_id = auth.uid());

CREATE POLICY membership_tiers_update ON public.membership_tiers
  FOR UPDATE USING (creator_id = auth.uid());

CREATE POLICY membership_tiers_delete ON public.membership_tiers
  FOR DELETE USING (creator_id = auth.uid());

-- Create memberships table
CREATE TABLE IF NOT EXISTS public.memberships (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(supabase_id) ON DELETE CASCADE,
  tier_id INTEGER REFERENCES public.membership_tiers(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES public.users(supabase_id) ON DELETE CASCADE,
  price_paid DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'tokens',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'paused')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  tokens_remaining INTEGER DEFAULT 0 CHECK (tokens_remaining >= 0),
  auto_renew BOOLEAN DEFAULT true,
  cancellation_reason TEXT,
  upgraded_from INTEGER REFERENCES public.membership_tiers(id),
  upgraded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_creator_active UNIQUE (user_id, creator_id, status)
);

-- Indexes for memberships
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_creator ON public.memberships(creator_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tier ON public.memberships(tier_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON public.memberships(status);
CREATE INDEX IF NOT EXISTS idx_memberships_next_billing ON public.memberships(next_billing_date);

-- Enable RLS
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- RLS policies for memberships
CREATE POLICY memberships_select ON public.memberships
  FOR SELECT USING (user_id = auth.uid() OR creator_id = auth.uid());

CREATE POLICY memberships_insert ON public.memberships
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY memberships_update ON public.memberships
  FOR UPDATE USING (user_id = auth.uid() OR creator_id = auth.uid());

-- Create classes table
CREATE TABLE IF NOT EXISTS public.classes (
  id SERIAL PRIMARY KEY,
  creator_id UUID REFERENCES public.users(supabase_id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  max_participants INTEGER DEFAULT 100 CHECK (max_participants > 0),
  current_participants INTEGER DEFAULT 0 CHECK (current_participants >= 0),
  token_price DECIMAL(10,2) DEFAULT 0 CHECK (token_price >= 0),
  tags JSONB DEFAULT '[]',
  requirements TEXT,
  what_to_expect TEXT,
  cover_image_url VARCHAR(255),
  meeting_url VARCHAR(255),
  is_live BOOLEAN DEFAULT false,
  is_cancelled BOOLEAN DEFAULT false,
  cancellation_reason TEXT,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for classes
CREATE INDEX IF NOT EXISTS idx_classes_creator ON public.classes(creator_id);
CREATE INDEX IF NOT EXISTS idx_classes_start_time ON public.classes(start_time);
CREATE INDEX IF NOT EXISTS idx_classes_status ON public.classes(status);
CREATE INDEX IF NOT EXISTS idx_classes_category ON public.classes(category);

-- Enable RLS
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- RLS policies for classes
CREATE POLICY classes_select ON public.classes
  FOR SELECT USING (true); -- Public read

CREATE POLICY classes_insert ON public.classes
  FOR INSERT WITH CHECK (creator_id = auth.uid());

CREATE POLICY classes_update ON public.classes
  FOR UPDATE USING (creator_id = auth.uid());

CREATE POLICY classes_delete ON public.classes
  FOR DELETE USING (creator_id = auth.uid());

-- Create class_participants table
CREATE TABLE IF NOT EXISTS public.class_participants (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(supabase_id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  tokens_paid DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'joined', 'left', 'completed')),
  CONSTRAINT unique_class_participant UNIQUE (class_id, user_id)
);

-- Indexes for class_participants
CREATE INDEX IF NOT EXISTS idx_class_participants_class ON public.class_participants(class_id);
CREATE INDEX IF NOT EXISTS idx_class_participants_user ON public.class_participants(user_id);

-- Enable RLS
ALTER TABLE public.class_participants ENABLE ROW LEVEL SECURITY;

-- RLS policies for class_participants
CREATE POLICY class_participants_select ON public.class_participants
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_participants.class_id
      AND c.creator_id = auth.uid()
    )
  );

CREATE POLICY class_participants_insert ON public.class_participants
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY class_participants_update ON public.class_participants
  FOR UPDATE USING (user_id = auth.uid());

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all new tables
CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_token_balances_updated_at BEFORE UPDATE ON public.token_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_membership_tiers_updated_at BEFORE UPDATE ON public.membership_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memberships_updated_at BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update class participant count
CREATE OR REPLACE FUNCTION update_class_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.classes 
    SET current_participants = current_participants + 1
    WHERE id = NEW.class_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.classes 
    SET current_participants = GREATEST(0, current_participants - 1)
    WHERE id = OLD.class_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_participant_count 
AFTER INSERT OR DELETE ON public.class_participants
FOR EACH ROW EXECUTE FUNCTION update_class_participant_count();