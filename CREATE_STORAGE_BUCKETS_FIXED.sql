-- =====================================================
-- SUPABASE STORAGE BUCKETS SETUP (FIXED VERSION)
-- =====================================================
-- This script creates all necessary storage buckets for the Digis platform
-- Run this in your Supabase SQL editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CREATE MISSING TABLES (if they don't exist)
-- =====================================================

-- Create creator_subscriptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS creator_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tier VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create content_purchases table if it doesn't exist
CREATE TABLE IF NOT EXISTS content_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  amount_tokens INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create creator_content table if it doesn't exist
CREATE TABLE IF NOT EXISTS creator_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT,
  content_type VARCHAR(50),
  title VARCHAR(255),
  description TEXT,
  price_tokens INTEGER,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create conversations table if it doesn't exist
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create stream_recordings table if it doesn't exist
CREATE TABLE IF NOT EXISTS stream_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id UUID,
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT,
  duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create stream_recording_purchases table if it doesn't exist
CREATE TABLE IF NOT EXISTS stream_recording_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_id UUID REFERENCES stream_recordings(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  amount_tokens INTEGER
);

-- Create file_uploads table if it doesn't exist
CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  upload_status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create content_access_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS content_access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  content_id UUID,
  file_path TEXT,
  access_type TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Shop Products (Public) - THIS IS THE IMPORTANT ONE FOR YOUR SHOP
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

-- =====================================================
-- SIMPLIFIED STORAGE POLICIES (No complex table dependencies)
-- =====================================================

-- Drop existing policies first to avoid conflicts
DO $$ 
BEGIN
    -- Profile Pictures Policies
    DROP POLICY IF EXISTS "Anyone can view profile pictures" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload their own profile picture" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own profile picture" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own profile picture" ON storage.objects;
    
    -- Shop Products Policies
    DROP POLICY IF EXISTS "Anyone can view shop products" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload shop products" ON storage.objects;
    DROP POLICY IF EXISTS "Users can manage their own shop products" ON storage.objects;
    
    -- Creator Content Policies
    DROP POLICY IF EXISTS "Creators can upload their own content" ON storage.objects;
    DROP POLICY IF EXISTS "Creators can manage their own content" ON storage.objects;
    DROP POLICY IF EXISTS "Subscribers can view purchased content" ON storage.objects;
    
    -- Message Attachments Policies
    DROP POLICY IF EXISTS "Users can upload message attachments" ON storage.objects;
    DROP POLICY IF EXISTS "Users can view attachments in their conversations" ON storage.objects;
    
    -- Stream Recordings Policies
    DROP POLICY IF EXISTS "Creators can manage their stream recordings" ON storage.objects;
    DROP POLICY IF EXISTS "Users can view purchased stream recordings" ON storage.objects;
    
    -- Identity Verification Policies
    DROP POLICY IF EXISTS "Users can upload verification documents" ON storage.objects;
    DROP POLICY IF EXISTS "Only admins can view verification documents" ON storage.objects;
    
    -- Virtual Gifts Policies
    DROP POLICY IF EXISTS "Anyone can view virtual gifts" ON storage.objects;
    DROP POLICY IF EXISTS "Admins can manage virtual gifts" ON storage.objects;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Profile Pictures - Anyone can view
CREATE POLICY "Anyone can view profile pictures"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-pictures');

-- Profile Pictures - Users can upload their own
CREATE POLICY "Users can upload their own profile picture"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-pictures' 
  AND auth.uid() IS NOT NULL
);

-- Profile Pictures - Users can update their own
CREATE POLICY "Users can update their own profile picture"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-pictures' 
  AND auth.uid() IS NOT NULL
);

-- Shop Products - Anyone can view
CREATE POLICY "Anyone can view shop products"
ON storage.objects FOR SELECT
USING (bucket_id = 'shop-products');

-- Shop Products - Authenticated users can upload
CREATE POLICY "Authenticated users can upload shop products"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'shop-products'
  AND auth.uid() IS NOT NULL
);

-- Shop Products - Users can manage their own
CREATE POLICY "Users can manage their own shop products"
ON storage.objects FOR ALL
USING (
  bucket_id = 'shop-products'
  AND auth.uid() IS NOT NULL
);

-- Creator Content - Authenticated users can upload
CREATE POLICY "Authenticated users can upload creator content"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'creator-content'
  AND auth.uid() IS NOT NULL
);

-- Creator Content - Authenticated users can view
CREATE POLICY "Authenticated users can view creator content"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'creator-content'
  AND auth.uid() IS NOT NULL
);

-- Message Attachments - Authenticated users can upload
CREATE POLICY "Authenticated users can upload message attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'message-attachments'
  AND auth.uid() IS NOT NULL
);

-- Message Attachments - Authenticated users can view
CREATE POLICY "Authenticated users can view message attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'message-attachments'
  AND auth.uid() IS NOT NULL
);

-- Stream Recordings - Authenticated users can manage
CREATE POLICY "Authenticated users can manage stream recordings"
ON storage.objects FOR ALL
USING (
  bucket_id = 'stream-recordings'
  AND auth.uid() IS NOT NULL
);

-- Virtual Gifts - Anyone can view
CREATE POLICY "Anyone can view virtual gifts"
ON storage.objects FOR SELECT
USING (bucket_id = 'virtual-gifts');

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

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Storage buckets created successfully!';
  RAISE NOTICE '📦 Important buckets for your app:';
  RAISE NOTICE '   - shop-products: For product images in your shop';
  RAISE NOTICE '   - profile-pictures: For user profile pictures';
  RAISE NOTICE '   - creator-banners: For creator profile banners';
  RAISE NOTICE '   - stream-thumbnails: For stream preview images';
END $$;