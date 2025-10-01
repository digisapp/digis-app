-- ============================================
-- TICKETED PRIVATE SHOWS FEATURE
-- ============================================
-- Allows creators to announce paid shows during public streams
-- Viewers buy tickets to access video, non-payers can still see chat

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
  max_tickets INTEGER, -- Optional ticket limit
  early_bird_price INTEGER, -- Optional early bird pricing
  early_bird_deadline TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create show_tickets table for purchases
CREATE TABLE IF NOT EXISTS show_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID REFERENCES ticketed_shows(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  token_price INTEGER NOT NULL, -- Price paid (may vary with early bird)
  purchase_type VARCHAR(20) DEFAULT 'regular' CHECK (purchase_type IN ('regular', 'early_bird', 'gift')),
  gifted_by UUID REFERENCES users(supabase_id),
  joined_at TIMESTAMP WITH TIME ZONE, -- When they actually joined the show
  watch_duration INTEGER DEFAULT 0, -- Seconds watched
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(show_id, viewer_id) -- Prevent duplicate tickets
);

-- Create analytics table for show performance
CREATE TABLE IF NOT EXISTS show_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID REFERENCES ticketed_shows(id) ON DELETE CASCADE,
  peak_viewers INTEGER DEFAULT 0,
  average_watch_time INTEGER DEFAULT 0,
  chat_messages_count INTEGER DEFAULT 0,
  tips_received INTEGER DEFAULT 0,
  gifts_received INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2), -- Percentage of stream viewers who bought tickets
  revenue_per_viewer DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for show announcements/notifications
CREATE TABLE IF NOT EXISTS show_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID REFERENCES ticketed_shows(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  announcement_type VARCHAR(30) DEFAULT 'general' CHECK (announcement_type IN ('general', 'starting_soon', 'last_chance', 'started', 'ending_soon')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticketed_shows_stream_id ON ticketed_shows(stream_id);
CREATE INDEX IF NOT EXISTS idx_ticketed_shows_creator_id ON ticketed_shows(creator_id);
CREATE INDEX IF NOT EXISTS idx_ticketed_shows_status ON ticketed_shows(status);
CREATE INDEX IF NOT EXISTS idx_ticketed_shows_start_time ON ticketed_shows(start_time);
CREATE INDEX IF NOT EXISTS idx_show_tickets_viewer_id ON show_tickets(viewer_id);
CREATE INDEX IF NOT EXISTS idx_show_tickets_show_id ON show_tickets(show_id);
CREATE INDEX IF NOT EXISTS idx_show_tickets_purchased_at ON show_tickets(purchased_at);

-- Enable RLS
ALTER TABLE ticketed_shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE show_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE show_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE show_announcements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ticketed_shows
CREATE POLICY ticketed_shows_creator_all ON ticketed_shows
  FOR ALL
  USING (auth.uid() = creator_id);

CREATE POLICY ticketed_shows_public_read ON ticketed_shows
  FOR SELECT
  USING (status != 'cancelled');

-- RLS Policies for show_tickets
CREATE POLICY show_tickets_viewer_access ON show_tickets
  FOR ALL
  USING (auth.uid() = viewer_id);

CREATE POLICY show_tickets_creator_read ON show_tickets
  FOR SELECT
  USING (
    auth.uid() = (SELECT creator_id FROM ticketed_shows WHERE id = show_id)
  );

-- RLS Policies for show_analytics
CREATE POLICY show_analytics_creator_access ON show_analytics
  FOR ALL
  USING (
    auth.uid() = (SELECT creator_id FROM ticketed_shows WHERE id = show_id)
  );

-- RLS Policies for show_announcements
CREATE POLICY show_announcements_public_read ON show_announcements
  FOR SELECT
  USING (true);

CREATE POLICY show_announcements_creator_write ON show_announcements
  FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT creator_id FROM ticketed_shows WHERE id = show_id)
  );

-- Create function to update total tickets and revenue
CREATE OR REPLACE FUNCTION update_show_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total tickets sold and revenue
  UPDATE ticketed_shows
  SET 
    total_tickets_sold = (
      SELECT COUNT(*) FROM show_tickets WHERE show_id = NEW.show_id
    ),
    total_revenue = (
      SELECT COALESCE(SUM(token_price), 0) FROM show_tickets WHERE show_id = NEW.show_id
    ),
    updated_at = NOW()
  WHERE id = NEW.show_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating stats
CREATE TRIGGER update_show_stats_trigger
AFTER INSERT OR DELETE ON show_tickets
FOR EACH ROW
EXECUTE FUNCTION update_show_stats();

-- Create function to check ticket availability
CREATE OR REPLACE FUNCTION check_ticket_availability(p_show_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_max_tickets INTEGER;
  v_sold_tickets INTEGER;
BEGIN
  SELECT max_tickets INTO v_max_tickets
  FROM ticketed_shows
  WHERE id = p_show_id;
  
  -- If no limit, always available
  IF v_max_tickets IS NULL THEN
    RETURN true;
  END IF;
  
  SELECT COUNT(*) INTO v_sold_tickets
  FROM show_tickets
  WHERE show_id = p_show_id;
  
  RETURN v_sold_tickets < v_max_tickets;
END;
$$ LANGUAGE plpgsql;

-- Create function to get current ticket price (handles early bird)
CREATE OR REPLACE FUNCTION get_current_ticket_price(p_show_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_regular_price INTEGER;
  v_early_bird_price INTEGER;
  v_early_bird_deadline TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT token_price, early_bird_price, early_bird_deadline
  INTO v_regular_price, v_early_bird_price, v_early_bird_deadline
  FROM ticketed_shows
  WHERE id = p_show_id;
  
  -- Check if early bird pricing is active
  IF v_early_bird_price IS NOT NULL 
     AND v_early_bird_deadline IS NOT NULL 
     AND NOW() < v_early_bird_deadline THEN
    RETURN v_early_bird_price;
  END IF;
  
  RETURN v_regular_price;
END;
$$ LANGUAGE plpgsql;

-- Create view for show statistics
CREATE OR REPLACE VIEW show_statistics AS
SELECT 
  ts.*,
  COUNT(DISTINCT st.viewer_id) as unique_viewers,
  AVG(st.watch_duration) as avg_watch_duration,
  COUNT(DISTINCT CASE WHEN st.purchase_type = 'early_bird' THEN st.viewer_id END) as early_bird_sales,
  COUNT(DISTINCT CASE WHEN st.purchase_type = 'gift' THEN st.viewer_id END) as gifted_tickets
FROM ticketed_shows ts
LEFT JOIN show_tickets st ON ts.id = st.show_id
GROUP BY ts.id;

-- Grant permissions
GRANT SELECT ON show_statistics TO authenticated;
GRANT ALL ON ticketed_shows TO authenticated;
GRANT ALL ON show_tickets TO authenticated;
GRANT ALL ON show_analytics TO authenticated;
GRANT SELECT ON show_announcements TO authenticated;
GRANT INSERT ON show_announcements TO authenticated;