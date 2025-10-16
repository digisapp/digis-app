-- Supabase Storage Setup for Avatar & Card Images
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new)

-- 1. Create storage buckets (if they don't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('cards', 'cards', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Set bucket limits (optional but recommended)
UPDATE storage.buckets
SET file_size_limit = 8388608, -- 8MB in bytes
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
WHERE id IN ('avatars', 'cards');

-- 3. Storage policies for avatars bucket

-- Allow authenticated users to insert files ONLY into their own folder
CREATE POLICY "avatars_owner_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update ONLY their own files
CREATE POLICY "avatars_owner_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete ONLY their own files
CREATE POLICY "avatars_owner_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access (bucket is public)
CREATE POLICY "avatars_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 4. Storage policies for cards bucket

-- Allow authenticated users to insert files ONLY into their own folder
CREATE POLICY "cards_owner_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cards'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update ONLY their own files
CREATE POLICY "cards_owner_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'cards'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete ONLY their own files
CREATE POLICY "cards_owner_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'cards'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access (bucket is public)
CREATE POLICY "cards_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'cards');

-- 5. Verify setup
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id IN ('avatars', 'cards');

SELECT
  policyname,
  tablename,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%avatar%' OR policyname LIKE '%card%'
ORDER BY policyname;

-- Done! You should see:
-- - 2 buckets (avatars, cards) marked as public
-- - 8 policies (4 per bucket: insert, update, delete, select)
