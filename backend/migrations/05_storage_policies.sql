-- =============================================================================
-- SUPABASE STORAGE BUCKET POLICIES
-- =============================================================================
-- Table RLS does NOT protect Storage!
-- Storage buckets need their own policies
-- =============================================================================

-- Check existing buckets
SELECT id, name, public FROM storage.buckets ORDER BY name;

-- =============================================================================
-- AVATARS BUCKET POLICIES
-- =============================================================================
-- Pattern: Public read, users can upload/update/delete own avatars only

-- Public read access
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
CREATE POLICY "Avatars are publicly accessible"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Users can upload their own avatars
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update own avatars
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete own avatars
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- COVERS BUCKET POLICIES
-- =============================================================================
-- Pattern: Public read, creators can manage own covers

DROP POLICY IF EXISTS "Covers are publicly accessible" ON storage.objects;
CREATE POLICY "Covers are publicly accessible"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'covers');

DROP POLICY IF EXISTS "Creators can upload covers" ON storage.objects;
CREATE POLICY "Creators can upload covers"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Creators can update covers" ON storage.objects;
CREATE POLICY "Creators can update covers"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Creators can delete covers" ON storage.objects;
CREATE POLICY "Creators can delete covers"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- PRIVATE CONTENT BUCKET POLICIES (if you have one)
-- =============================================================================
-- Pattern: Private - only authenticated users who own or purchased can access

DROP POLICY IF EXISTS "Users can view purchased content" ON storage.objects;
CREATE POLICY "Users can view purchased content"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'private-content'
    AND (
      -- User owns the content
      (storage.foldername(name))[1] = auth.uid()::text
      -- OR user has purchased it (would need a helper function)
    )
  );

DROP POLICY IF EXISTS "Creators can upload private content" ON storage.objects;
CREATE POLICY "Creators can upload private content"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'private-content'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Creators can manage private content" ON storage.objects;
CREATE POLICY "Creators can manage private content"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'private-content'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Creators can delete private content" ON storage.objects;
CREATE POLICY "Creators can delete private content"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'private-content'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- BEST PRACTICES FOR STORAGE
-- =============================================================================
-- 1. Always use path structure: {user_id}/{filename}
--    Example: 550e8400-e29b-41d4-a716-446655440000/avatar.jpg
--
-- 2. Create buckets with proper settings:
--    - Public buckets: avatars, covers (set public = true)
--    - Private buckets: private-content (set public = false)
--
-- 3. Enforce file size limits in your app (Storage doesn't enforce via RLS)
--
-- 4. Use signed URLs for temporary access to private content:
--    const { data } = await supabase.storage
--      .from('private-content')
--      .createSignedUrl('path/to/file.jpg', 60) // 60 second expiry
-- =============================================================================

-- =============================================================================
-- VERIFICATION
-- =============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;

-- =============================================================================
-- CREATE MISSING BUCKETS (if needed)
-- =============================================================================
-- Run these in Supabase Dashboard → Storage or via SQL:

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES
--   ('avatars', 'avatars', true),
--   ('covers', 'covers', true),
--   ('private-content', 'private-content', false)
-- ON CONFLICT (id) DO NOTHING;
-- =============================================================================
