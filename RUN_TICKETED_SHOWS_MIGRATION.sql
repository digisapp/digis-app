-- ============================================
-- TICKETED PRIVATE SHOWS FEATURE
-- Run this in your Supabase SQL Editor
-- ============================================

-- Create ticketed_shows table
CREATE TABLE IF NOT EXISTS ticketed_shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  title VARCHAR(255),
  description TEXT,
  token_price INTEGER NOT NULL CHECK (token_price > 0),
  status VARCHAR(20) DEFAULT 'announced' CHECK (status IN ('announced', 'started', 'ended', 'cancelled')),
  private_mode BOOLEAN DEFAULT false,
  start_time TIMESTAMP WITH TIME ZONE,
  actual_start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  total_tickets_sold INTEGER DEFAULT 0,
  total_revenue INTEGER DEFAULT 0,
  max_tickets INTEGER,
  early_bird_price INTEGER,
  early_bird_deadline TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create show_tickets table for purchases
CREATE TABLE IF NOT EXISTS show_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID REFERENCES ticketed_shows(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  tokens_paid INTEGER NOT NULL,
  purchase_type VARCHAR(20) DEFAULT 'regular' CHECK (purchase_type IN ('regular', 'early_bird', 'gift')),
  gifted_by UUID REFERENCES users(supabase_id),
  joined_at TIMESTAMP WITH TIME ZONE,
  watch_duration INTEGER DEFAULT 0,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(show_id, viewer_id)
);

-- Create analytics table for show performance
CREATE TABLE IF NOT EXISTS show_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID REFERENCES ticketed_shows(id) ON DELETE CASCADE UNIQUE,
  tickets_sold INTEGER DEFAULT 0,
  revenue_generated INTEGER DEFAULT 0,
  peak_viewers INTEGER DEFAULT 0,
  avg_watch_time_seconds INTEGER DEFAULT 0,
  early_bird_sales INTEGER DEFAULT 0,
  regular_sales INTEGER DEFAULT 0,
  gift_sales INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  chat_messages_during_show INTEGER DEFAULT 0,
  tips_during_show INTEGER DEFAULT 0,
  new_followers_during_show INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create announcements table for notifications
CREATE TABLE IF NOT EXISTS show_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID REFERENCES ticketed_shows(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  announcement_type VARCHAR(50) CHECK (announcement_type IN ('show_announced', 'show_starting', 'show_started', 'show_ended', 'early_bird_ending')),
  seen BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(show_id, user_id, announcement_type)
);

-- Create indexes for performance
CREATE INDEX idx_ticketed_shows_stream_id ON ticketed_shows(stream_id);
CREATE INDEX idx_ticketed_shows_creator_id ON ticketed_shows(creator_id);
CREATE INDEX idx_ticketed_shows_status ON ticketed_shows(status);
CREATE INDEX idx_show_tickets_show_id ON show_tickets(show_id);
CREATE INDEX idx_show_tickets_viewer_id ON show_tickets(viewer_id);
CREATE INDEX idx_show_announcements_user_id ON show_announcements(user_id);

-- Enable Row Level Security
ALTER TABLE ticketed_shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE show_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE show_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE show_announcements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ticketed_shows
CREATE POLICY "Anyone can view announced shows" ON ticketed_shows
  FOR SELECT USING (status = 'announced' OR status = 'started');

CREATE POLICY "Creators can manage their shows" ON ticketed_shows
  FOR ALL USING (auth.uid() = creator_id);

-- RLS Policies for show_tickets
CREATE POLICY "Users can view their own tickets" ON show_tickets
  FOR SELECT USING (auth.uid() = viewer_id);

CREATE POLICY "Users can purchase tickets" ON show_tickets
  FOR INSERT WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Creators can view ticket sales" ON show_tickets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ticketed_shows 
      WHERE ticketed_shows.id = show_tickets.show_id 
      AND ticketed_shows.creator_id = auth.uid()
    )
  );

-- RLS Policies for show_analytics
CREATE POLICY "Creators can view their analytics" ON show_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ticketed_shows 
      WHERE ticketed_shows.id = show_analytics.show_id 
      AND ticketed_shows.creator_id = auth.uid()
    )
  );

-- RLS Policies for show_announcements
CREATE POLICY "Users can view their announcements" ON show_announcements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create announcements" ON show_announcements
  FOR INSERT WITH CHECK (true);

-- Function to calculate current ticket price
CREATE OR REPLACE FUNCTION get_current_ticket_price(show_id UUID)
RETURNS INTEGER AS $$
DECLARE
  show_record RECORD;
BEGIN
  SELECT * INTO show_record FROM ticketed_shows WHERE id = show_id;
  
  IF show_record.early_bird_price IS NOT NULL 
     AND show_record.early_bird_deadline IS NOT NULL 
     AND NOW() < show_record.early_bird_deadline THEN
    RETURN show_record.early_bird_price;
  ELSE
    RETURN show_record.token_price;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has ticket
CREATE OR REPLACE FUNCTION user_has_ticket(p_show_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM show_tickets 
    WHERE show_id = p_show_id AND viewer_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger to update analytics when ticket is purchased
CREATE OR REPLACE FUNCTION update_show_analytics_on_ticket()
RETURNS TRIGGER AS $$
BEGIN
  -- Update ticketed_shows totals
  UPDATE ticketed_shows 
  SET 
    total_tickets_sold = total_tickets_sold + 1,
    total_revenue = total_revenue + NEW.tokens_paid,
    updated_at = NOW()
  WHERE id = NEW.show_id;
  
  -- Update or insert analytics
  INSERT INTO show_analytics (
    show_id, 
    tickets_sold, 
    revenue_generated,
    early_bird_sales,
    regular_sales
  ) VALUES (
    NEW.show_id, 
    1, 
    NEW.tokens_paid,
    CASE WHEN NEW.purchase_type = 'early_bird' THEN 1 ELSE 0 END,
    CASE WHEN NEW.purchase_type = 'regular' THEN 1 ELSE 0 END
  )
  ON CONFLICT (show_id) DO UPDATE SET
    tickets_sold = show_analytics.tickets_sold + 1,
    revenue_generated = show_analytics.revenue_generated + NEW.tokens_paid,
    early_bird_sales = show_analytics.early_bird_sales + 
      CASE WHEN NEW.purchase_type = 'early_bird' THEN 1 ELSE 0 END,
    regular_sales = show_analytics.regular_sales + 
      CASE WHEN NEW.purchase_type = 'regular' THEN 1 ELSE 0 END,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_analytics_on_ticket_purchase
AFTER INSERT ON show_tickets
FOR EACH ROW
EXECUTE FUNCTION update_show_analytics_on_ticket();

-- Add notification for @mentions in stream messages (if not exists)
ALTER TABLE stream_messages 
ADD COLUMN IF NOT EXISTS mentions JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_stream_messages_mentions ON stream_messages USING gin(mentions);

-- Success message
SELECT 'Ticketed Shows tables created successfully!' AS status;

-- Verify tables were created
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND (tablename LIKE '%ticketed%' OR tablename LIKE 'show_%')
ORDER BY tablename;