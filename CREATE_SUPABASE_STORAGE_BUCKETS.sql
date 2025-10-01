-- Create Supabase Storage Buckets for Stream Recordings
-- Run this in your Supabase SQL Editor

-- Create the stream-recordings bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stream-recordings',
  'stream-recordings',
  true, -- Public bucket so recorded streams can be accessed via URL
  5368709120, -- 5GB max file size
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET 
  public = true,
  file_size_limit = 5368709120,
  allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp']::text[];

-- Create RLS policies for the bucket
CREATE POLICY "Allow authenticated users to upload recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'stream-recordings');

CREATE POLICY "Allow public to view recordings"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'stream-recordings');

CREATE POLICY "Allow creators to delete their own recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'stream-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Allow creators to update their own recordings"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'stream-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create additional buckets for other content types if needed
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]),
  ('media', 'media', true, 104857600, ARRAY['image/*', 'video/*']::text[]),
  ('documents', 'documents', false, 20971520, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[])
ON CONFLICT (id) DO NOTHING;

-- Verify buckets were created
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id IN ('stream-recordings', 'avatars', 'media', 'documents');