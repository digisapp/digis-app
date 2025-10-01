-- =====================================================
-- SUPABASE STORAGE BUCKETS SETUP
-- =====================================================
-- This script creates all necessary storage buckets for the Digis platform
-- Run this in your Supabase SQL editor

-- Enable storage extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PUBLIC BUCKETS (CDN-optimized, publicly accessible)
-- =====================================================

-- Profile Pictures (Public)
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'profile-pictures',
  'profile-pictures', 
  true,
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  avif_autodetection = true,
  file_size_limit = 5242880;

-- Creator Banners (Public)
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'creator-banners',
  'creator-banners',
  true,
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  avif_autodetection = true,
  file_size_limit = 10485760;

-- Stream Thumbnails (Public)
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'stream-thumbnails',
  'stream-thumbnails',
  true,
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  avif_autodetection = true,
  file_size_limit = 5242880;

-- Shop Products (Public)
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'shop-products',
  'shop-products',
  true,
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  avif_autodetection = true,
  file_size_limit = 10485760;

-- =====================================================
-- PRIVATE BUCKETS (Authenticated access only)
-- =====================================================

-- Creator Content (Private - Premium content)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creator-content',
  'creator-content',
  false,
  104857600, -- 100MB limit
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/mpeg', 'audio/wav', 'audio/ogg',
    'application/pdf'
  ]
) ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 104857600;

-- Private Messages Attachments (Private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false,
  26214400, -- 25MB limit
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/quicktime',
    'audio/mpeg', 'audio/wav',
    'application/pdf', 'application/zip',
    'text/plain', 'text/csv'
  ]
) ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 26214400;

-- Stream Recordings (Private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stream-recordings',
  'stream-recordings',
  false,
  5368709120, -- 5GB limit for recordings
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
) ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5368709120;

-- Session Recordings (Private - Video/Voice calls)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'session-recordings',
  'session-recordings',
  false,
  2147483648, -- 2GB limit
  ARRAY['video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav']
) ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 2147483648;

-- Identity Verification Documents (Private - KYC)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'identity-verification',
  'identity-verification',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
) ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760;

-- Creator Analytics Reports (Private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'analytics-reports',
  'analytics-reports',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
) ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800;

-- Virtual Gifts Assets (Public)
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'virtual-gifts',
  'virtual-gifts',
  true,
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/gif', 'image/svg+xml', 'image/webp']
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  avif_autodetection = true,
  file_size_limit = 5242880;

-- Ticketed Shows Media (Mixed access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticketed-shows',
  'ticketed-shows',
  false,
  524288000, -- 500MB limit
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/webm',
    'audio/mpeg', 'audio/wav'
  ]
) ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 524288000;

-- =====================================================
-- STORAGE POLICIES (RLS)
-- =====================================================

-- Profile Pictures Policy
CREATE POLICY "Anyone can view profile pictures"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-pictures');

CREATE POLICY "Users can upload their own profile picture"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-pictures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own profile picture"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-pictures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own profile picture"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-pictures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Creator Content Policy
CREATE POLICY "Creators can upload their own content"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'creator-content'
  AND auth.uid() IN (
    SELECT id FROM users WHERE id = auth.uid() AND is_creator = true
  )
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Creators can manage their own content"
ON storage.objects FOR ALL
USING (
  bucket_id = 'creator-content'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Subscribers can view purchased content"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'creator-content'
  AND (
    -- Creator can view their own content
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Check if user has active subscription or has purchased this content
    EXISTS (
      SELECT 1 FROM creator_subscriptions
      WHERE user_id = auth.uid()
      AND creator_id = (storage.foldername(name))[1]::uuid
      AND status = 'active'
      AND expires_at > NOW()
    )
    OR
    EXISTS (
      SELECT 1 FROM content_purchases
      WHERE user_id = auth.uid()
      AND content_id IN (
        SELECT id FROM creator_content 
        WHERE file_path = storage.objects.name
      )
    )
  )
);

-- Message Attachments Policy
CREATE POLICY "Users can upload message attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'message-attachments'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view attachments in their conversations"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'message-attachments'
  AND EXISTS (
    SELECT 1 FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE m.attachment_url LIKE '%' || storage.objects.name || '%'
    AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
  )
);

-- Stream Recordings Policy
CREATE POLICY "Creators can manage their stream recordings"
ON storage.objects FOR ALL
USING (
  bucket_id = 'stream-recordings'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view purchased stream recordings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'stream-recordings'
  AND EXISTS (
    SELECT 1 FROM stream_recording_purchases
    WHERE user_id = auth.uid()
    AND recording_id IN (
      SELECT id FROM stream_recordings 
      WHERE file_path = storage.objects.name
    )
  )
);

-- Identity Verification Policy (Strict)
CREATE POLICY "Users can upload verification documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'identity-verification'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Only admins can view verification documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'identity-verification'
  AND EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Virtual Gifts Policy
CREATE POLICY "Anyone can view virtual gifts"
ON storage.objects FOR SELECT
USING (bucket_id = 'virtual-gifts');

CREATE POLICY "Admins can manage virtual gifts"
ON storage.objects FOR ALL
USING (
  bucket_id = 'virtual-gifts'
  AND EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get storage usage for a user
CREATE OR REPLACE FUNCTION get_user_storage_usage(user_id UUID)
RETURNS TABLE (
  bucket_name TEXT,
  file_count BIGINT,
  total_size BIGINT,
  total_size_mb NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.bucket_id::TEXT as bucket_name,
    COUNT(*) as file_count,
    COALESCE(SUM(s.metadata->>'size')::BIGINT, 0) as total_size,
    ROUND(COALESCE(SUM(s.metadata->>'size')::NUMERIC, 0) / 1048576, 2) as total_size_mb
  FROM storage.objects s
  WHERE s.owner = user_id
  GROUP BY s.bucket_id
  ORDER BY total_size DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old temporary files
CREATE OR REPLACE FUNCTION cleanup_old_temp_files()
RETURNS void AS $$
BEGIN
  -- Delete temporary files older than 24 hours
  DELETE FROM storage.objects
  WHERE bucket_id IN ('message-attachments', 'creator-content')
  AND name LIKE '%/temp/%'
  AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate signed URL (for backend use)
CREATE OR REPLACE FUNCTION generate_signed_url(
  p_bucket_id TEXT,
  p_path TEXT,
  p_expires_in INTEGER DEFAULT 3600
)
RETURNS TEXT AS $$
DECLARE
  v_url TEXT;
BEGIN
  -- This is a placeholder - actual implementation depends on Supabase client
  -- The backend will handle signed URL generation
  v_url := 'https://' || current_setting('app.settings.supabase_project_ref') || 
           '.supabase.co/storage/v1/object/sign/' || 
           p_bucket_id || '/' || p_path;
  RETURN v_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STORAGE TABLES FOR METADATA
-- =====================================================

-- Create table to track file uploads
CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bucket_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  upload_status TEXT DEFAULT 'pending', -- pending, completed, failed
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_file_uploads_user_id ON file_uploads(user_id);
CREATE INDEX idx_file_uploads_bucket_id ON file_uploads(bucket_id);
CREATE INDEX idx_file_uploads_status ON file_uploads(upload_status);
CREATE INDEX idx_file_uploads_created_at ON file_uploads(created_at DESC);

-- Create table for content access logs
CREATE TABLE IF NOT EXISTS content_access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL, -- 'creator_content', 'stream_recording', etc.
  content_id UUID,
  file_path TEXT,
  access_type TEXT NOT NULL, -- 'view', 'download'
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for access logs
CREATE INDEX idx_content_access_logs_user_id ON content_access_logs(user_id);
CREATE INDEX idx_content_access_logs_content_type ON content_access_logs(content_type);
CREATE INDEX idx_content_access_logs_created_at ON content_access_logs(created_at DESC);

-- =====================================================
-- SCHEDULED JOBS (Optional - requires pg_cron)
-- =====================================================

-- Uncomment if pg_cron is enabled
/*
-- Schedule cleanup of old temporary files (runs daily at 2 AM)
SELECT cron.schedule(
  'cleanup-temp-files',
  '0 2 * * *',
  'SELECT cleanup_old_temp_files();'
);

-- Schedule storage usage report (runs weekly on Sunday at 3 AM)
SELECT cron.schedule(
  'storage-usage-report',
  '0 3 * * 0',
  $$
    INSERT INTO analytics_reports (report_type, data, created_at)
    SELECT 
      'storage_usage',
      jsonb_build_object(
        'total_storage_gb', ROUND(SUM((metadata->>'size')::NUMERIC) / 1073741824, 2),
        'total_files', COUNT(*),
        'by_bucket', jsonb_agg(
          jsonb_build_object(
            'bucket', bucket_id,
            'count', file_count,
            'size_gb', size_gb
          )
        )
      ),
      NOW()
    FROM (
      SELECT 
        bucket_id,
        COUNT(*) as file_count,
        ROUND(SUM((metadata->>'size')::NUMERIC) / 1073741824, 2) as size_gb
      FROM storage.objects
      GROUP BY bucket_id
    ) bucket_stats;
  $$
);
*/

-- =====================================================
-- GRANTS AND PERMISSIONS
-- =====================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;

-- Grant permissions on custom tables
GRANT ALL ON file_uploads TO authenticated;
GRANT ALL ON content_access_logs TO authenticated;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check all buckets are created
SELECT 
  id,
  name,
  public,
  file_size_limit,
  avif_autodetection,
  created_at
FROM storage.buckets
ORDER BY created_at DESC;

-- Check storage policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
ORDER BY tablename, policyname;