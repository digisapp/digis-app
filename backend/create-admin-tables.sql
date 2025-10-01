-- Create audit_logs table for admin dashboard
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(supabase_id),
  action VARCHAR(255) NOT NULL,
  details JSONB,
  timestamp TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create content_reports table for moderation
CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES users(supabase_id),
  reported_user_id UUID REFERENCES users(supabase_id),
  content_type VARCHAR(50),
  content_id UUID,
  reason VARCHAR(255),
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(supabase_id),
  review_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_reported_user ON content_reports(reported_user_id);

-- Insert sample audit log
INSERT INTO audit_logs (admin_id, action, details, timestamp)
SELECT 
  supabase_id,
  'admin_dashboard_setup',
  '{"message": "Admin dashboard initialized with Supabase integration"}'::jsonb,
  NOW()
FROM users 
WHERE email = 'admin@digis.cc'
LIMIT 1;
