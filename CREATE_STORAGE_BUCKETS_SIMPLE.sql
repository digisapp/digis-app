-- Simple Storage Buckets Setup for Digis
-- Run this in Supabase SQL Editor

-- Create storage buckets (if they don't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('profile-pictures', 'profile-pictures', true),
  ('creator-banners', 'creator-banners', true),
  ('stream-thumbnails', 'stream-thumbnails', true),
  ('shop-products', 'shop-products', true),
  ('creator-content', 'creator-content', false),
  ('message-attachments', 'message-attachments', false),
  ('stream-recordings', 'stream-recordings', false),
  ('session-recordings', 'session-recordings', false),
  ('identity-verification', 'identity-verification', false),
  ('analytics-reports', 'analytics-reports', false),
  ('virtual-gifts', 'virtual-gifts', true),
  ('ticketed-shows', 'ticketed-shows', true),
  ('digitals', 'digitals', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Owner Access" ON storage.objects;

-- Simple public read policy for public buckets
CREATE POLICY "Public Access" ON storage.objects 
  FOR SELECT 
  USING (
    bucket_id IN (
      'profile-pictures', 
      'creator-banners', 
      'stream-thumbnails', 
      'shop-products', 
      'virtual-gifts', 
      'ticketed-shows',
      'digitals'
    )
  );

-- Allow authenticated users to upload to any bucket
CREATE POLICY "Authenticated Upload" ON storage.objects 
  FOR INSERT 
  WITH CHECK (
    auth.role() = 'authenticated'
  );

-- Allow users to manage their own uploads (based on the folder structure)
CREATE POLICY "Owner Access" ON storage.objects 
  FOR ALL 
  USING (
    auth.uid()::text = (string_to_array(name, '/'))[1]
    OR 
    auth.role() = 'authenticated'
  );

-- Success message
SELECT 'Storage buckets created successfully!' as message,
       'Public buckets: profile-pictures, creator-banners, shop-products, digitals' as public_buckets,
       'Private buckets: creator-content, message-attachments, recordings' as private_buckets;