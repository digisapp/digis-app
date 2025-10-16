# Image Cropping Setup - ALMOST DONE! ✅

## What I've Completed For You

✅ **Database Migration** - Added avatar_url, card_image_url columns to users table
✅ **Frontend Dependencies** - Installed react-avatar-editor and react-image-crop  
✅ **Storage Buckets** - Created 'avatars' and 'cards' buckets in Supabase
✅ **File Size Limits** - Set 8MB limit on both buckets
✅ **Code Integration** - All routes, components, and services are wired up

## ⚠️ ONE MANUAL STEP REQUIRED

Storage policies need superuser permissions. **Run this in Supabase SQL Editor:**

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
2. Copy/paste this SQL:

```sql
-- Storage policies for avatars bucket
CREATE POLICY "avatars_owner_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');

-- Storage policies for cards bucket
CREATE POLICY "cards_owner_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cards' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "cards_owner_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'cards' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "cards_owner_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'cards' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "cards_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'cards');
```

3. Click "Run"
4. You're done!

## Test It Works

After running the SQL above, test the upload endpoint:

```bash
cd backend && npm run dev

# In another terminal:
curl -i http://localhost:3005/api/uploads/avatar
# Should return: 401 Unauthorized (proves route is registered)
```

## How to Use in Your UI

See `CROP_SETUP_COMPLETE.md` for full examples. Quick version:

```jsx
import ImageCropModal from './components/media/ImageCropModal';
import { uploadAvatar } from './services/imageUploadService';

<ImageCropModal
  isOpen={true}
  file={selectedFile}
  cropType="avatar"  // or "card"
  onSave={async (croppedFile) => {
    const url = await uploadAvatar(croppedFile);
    console.log('Uploaded:', url);
  }}
  onClose={() => setOpen(false)}
/>
```

---

**That's it!** Everything else is ready. Just run that SQL and you're live.
