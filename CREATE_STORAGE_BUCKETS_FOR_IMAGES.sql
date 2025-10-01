-- Create storage buckets for Digis application
-- Run this in Supabase SQL Editor

-- Enable the storage extension if not already enabled
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('profile-pictures', 'profile-pictures', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('creator-banners', 'creator-banners', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('stream-thumbnails', 'stream-thumbnails', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('shop-products', 'shop-products', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('creator-content', 'creator-content', false, 104857600, ARRAY['image/*', 'video/*', 'audio/*']),
  ('message-attachments', 'message-attachments', false, 52428800, ARRAY['image/*', 'video/*', 'audio/*', 'application/pdf']),
  ('stream-recordings', 'stream-recordings', false, 5368709120, ARRAY['video/*']),
  ('session-recordings', 'session-recordings', false, 5368709120, ARRAY['video/*']),
  ('identity-verification', 'identity-verification', false, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf']),
  ('analytics-reports', 'analytics-reports', false, 10485760, ARRAY['application/pdf', 'text/csv']),
  ('virtual-gifts', 'virtual-gifts', true, 5242880, ARRAY['image/gif', 'image/png', 'image/svg+xml']),
  ('ticketed-shows', 'ticketed-shows', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Creators can manage their banners" ON storage.objects;
DROP POLICY IF EXISTS "Creators can manage their content" ON storage.objects;
DROP POLICY IF EXISTS "Users can view purchased content" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage their message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all storage" ON storage.objects;

-- Create RLS policies for public buckets
CREATE POLICY "Public read access" ON storage.objects 
  FOR SELECT USING (bucket_id IN ('profile-pictures', 'creator-banners', 'stream-thumbnails', 'shop-products', 'virtual-gifts', 'ticketed-shows'));

CREATE POLICY "Authenticated users can upload their own profile pictures" ON storage.objects 
  FOR INSERT WITH CHECK (
    bucket_id = 'profile-pictures' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own profile pictures" ON storage.objects 
  FOR UPDATE USING (
    bucket_id = 'profile-pictures' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own profile pictures" ON storage.objects 
  FOR DELETE USING (
    bucket_id = 'profile-pictures' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Creator-specific policies
CREATE POLICY "Creators can manage their banners" ON storage.objects 
  FOR ALL USING (
    bucket_id = 'creator-banners' AND 
    auth.uid()::text = (storage.foldername(name))[1] AND
    EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND is_creator = true)
  );

CREATE POLICY "Creators can manage their content" ON storage.objects 
  FOR ALL USING (
    bucket_id = 'creator-content' AND 
    auth.uid()::text = (storage.foldername(name))[1] AND
    EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND is_creator = true)
  );

-- Private content access policies (simplified)
CREATE POLICY "Users can view purchased content" ON storage.objects 
  FOR SELECT USING (
    bucket_id = 'creator-content' AND 
    -- Allow authenticated users to view creator content
    -- In production, add more specific checks based on your subscription model
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can manage their message attachments" ON storage.objects 
  FOR ALL USING (
    bucket_id = 'message-attachments' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admin policies
CREATE POLICY "Admins can manage all storage" ON storage.objects 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND is_super_admin = true)
  );

-- Add column for avatar thumbnail if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_thumbnail TEXT;

-- Success message
SELECT 'Storage buckets created successfully! Profile pictures will now be saved to Supabase Storage.' as message;