# Image Cropping Feature - Complete Setup Guide

## Overview

This feature allows creators to upload and crop their profile avatars and creator card images with a professional cropping experience.

### Features

- **Avatar Cropper**: Circle cropper for profile pictures
  - Exports PNG with transparent corners
  - Max size: 512×512px
  - Includes zoom and rotation controls

- **Card Cropper**: Rectangle cropper for creator cards/banners
  - Multiple aspect ratios: 2:3, 4:5, 9:16, 16:9, 1:1
  - Exports JPEG for optimal file size
  - Target height: ~1400-1600px

- **Server-Side Processing**: Sharp-based image processing
  - Strips EXIF metadata
  - Auto-rotates based on EXIF orientation
  - Enforces size limits
  - Validates MIME types

---

## 🚀 Setup Instructions

### 1. Database Migration

Run the migration to add avatar and card columns to the `users` table:

\`\`\`bash
cd backend
npm run migrate
\`\`\`

Or manually run in Supabase SQL Editor:
\`\`\`sql
-- Copy contents of backend/migrations/2025_10_15_avatar_card_columns.sql
\`\`\`

### 2. Supabase Storage Setup

**IMPORTANT**: You must create storage buckets and policies in Supabase.

1. Go to your Supabase Dashboard → SQL Editor
2. Copy and paste the entire contents of `backend/migrations/SUPABASE_STORAGE_SETUP.sql`
3. Execute the SQL
4. Verify that 2 buckets were created (`avatars` and `cards`)
5. Verify that 8 storage policies were created

### 3. Environment Variables

Ensure these are set in your backend `.env` or Vercel environment:

\`\`\`bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # NOT the anon key!
\`\`\`

### 4. Backend Dependencies

Dependencies are already installed (Sharp, Multer). If needed:

\`\`\`bash
cd backend
npm install sharp multer
\`\`\`

### 5. Frontend Dependencies

Install React crop libraries:

\`\`\`bash
cd frontend
npm install react-avatar-editor react-image-crop
\`\`\`

---

## 📁 File Structure

### Backend

\`\`\`
backend/
├── migrations/
│   ├── 2025_10_15_avatar_card_columns.sql     # DB migration for users table
│   └── SUPABASE_STORAGE_SETUP.sql             # Storage buckets & policies
├── middleware/
│   └── upload.js                               # Multer configuration
├── utils/
│   ├── imageProcessor.js                       # Sharp image processing
│   └── storageClient.js                        # Supabase Storage client
└── routes/
    └── uploads.js                              # Upload endpoints
\`\`\`

### Frontend

\`\`\`
frontend/src/
├── components/media/
│   ├── AvatarCrop.jsx                          # Circle avatar cropper
│   ├── CardCrop.jsx                            # Rectangle card cropper
│   └── ImageCropModal.jsx                      # Unified modal wrapper
├── utils/
│   └── cropExport.js                           # Canvas export utilities
└── services/
    └── imageUploadService.js                   # Upload service wrapper
\`\`\`

---

## 🔌 API Endpoints

### POST `/api/uploads/avatar`

Upload cropped avatar image.

**Headers:**
- `Authorization: Bearer {token}` (required)
- `Content-Type: multipart/form-data`

**Body:**
- `file`: PNG image file (already cropped by client)

**Response:**
\`\`\`json
{
  "success": true,
  "url": "https://your-project.supabase.co/storage/v1/object/public/avatars/...",
  "metadata": {
    "width": 512,
    "height": 512,
    "format": "png",
    "size": 245678
  },
  "duration": 1234
}
\`\`\`

### POST `/api/uploads/card`

Upload cropped creator card image.

**Headers:**
- `Authorization: Bearer {token}` (required)
- `Content-Type: multipart/form-data`

**Body:**
- `file`: JPEG image file (already cropped by client)

**Response:**
\`\`\`json
{
  "success": true,
  "url": "https://your-project.supabase.co/storage/v1/object/public/cards/...",
  "metadata": {
    "width": 1080,
    "height": 1620,
    "format": "jpeg",
    "size": 678912
  },
  "duration": 1456
}
\`\`\`

---

## 🎨 Frontend Integration

### Example: Avatar Upload

\`\`\`jsx
import { useState } from 'react';
import ImageCropModal from '../components/media/ImageCropModal';
import { uploadAvatar } from '../services/imageUploadService';

function ProfileSettings() {
  const [showAvatarCrop, setShowAvatarCrop] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowAvatarCrop(true);
    }
  };

  const handleAvatarSave = async (croppedFile) => {
    try {
      const url = await uploadAvatar(croppedFile, (progress) => {
        console.log('Upload progress:', progress + '%');
      });
      console.log('New avatar URL:', url);
      // Update UI with new avatar
      setShowAvatarCrop(false);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload avatar');
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        hidden
        id="avatar-input"
      />
      <label htmlFor="avatar-input" className="btn">
        Change Avatar
      </label>

      {showAvatarCrop && selectedFile && (
        <ImageCropModal
          isOpen={showAvatarCrop}
          onClose={() => setShowAvatarCrop(false)}
          file={selectedFile}
          cropType="avatar"
          onSave={handleAvatarSave}
        />
      )}
    </div>
  );
}
\`\`\`

### Example: Card Upload

\`\`\`jsx
import { useState } from 'react';
import ImageCropModal from '../components/media/ImageCropModal';
import { uploadCard } from '../services/imageUploadService';

function CreatorSettings() {
  const [showCardCrop, setShowCardCrop] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowCardCrop(true);
    }
  };

  const handleCardSave = async (croppedFile) => {
    try {
      const url = await uploadCard(croppedFile);
      console.log('New card URL:', url);
      // Update UI with new card
      setShowCardCrop(false);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload card');
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        hidden
        id="card-input"
      />
      <label htmlFor="card-input" className="btn">
        Change Card Image
      </label>

      {showCardCrop && selectedFile && (
        <ImageCropModal
          isOpen={showCardCrop}
          onClose={() => setShowCardCrop(false)}
          file={selectedFile}
          cropType="card"
          aspectRatio="4:5"
          allowRatioChange={true}
          onSave={handleCardSave}
        />
      )}
    </div>
  );
}
\`\`\`

---

## ✅ Testing Checklist

### Desktop Testing
- [ ] Chrome: Avatar crop, zoom, rotate → upload → verify circle PNG
- [ ] Firefox: Card crop with different ratios → upload → verify JPEG
- [ ] Safari: Upload large image (5MB+) → verify server re-encodes

### Mobile Testing
- [ ] iPhone Safari: Take photo → crop → upload → verify orientation correct
- [ ] Android Chrome: Upload from gallery → pinch-zoom works → upload succeeds
- [ ] Mobile Safari: Drag/zoom never "sticks" or jumps to corners

### Server Validation
- [ ] Upload 10MB+ file → rejected with 413 error
- [ ] Upload non-image file → rejected with 400 error
- [ ] Check uploaded files have EXIF stripped
- [ ] Verify avatar is ≤ 512×512px
- [ ] Verify card is ≤ 1600px tall

### Database & Storage
- [ ] Check `users` table has `avatar_url` and `card_image_url` populated
- [ ] Verify files exist in Supabase Storage under correct bucket
- [ ] Confirm public URLs are accessible without auth
- [ ] Test uploading new image overwrites old one (upsert: true)

---

## 🐛 Troubleshooting

### "Failed to upload: 401 Unauthorized"
- Check that `Authorization: Bearer {token}` header is present
- Verify token is valid (not expired)
- Check `verifySupabaseToken` middleware is working

### "Failed to upload: 500 Internal Server Error"
- Check backend logs for Sharp processing errors
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Ensure `sharp` package is installed (`npm list sharp`)

### "Storage bucket not found"
- Run `SUPABASE_STORAGE_SETUP.sql` in Supabase SQL Editor
- Verify buckets exist in Supabase Dashboard → Storage
- Check bucket names are exactly `avatars` and `cards`

### "Permission denied" when uploading
- Verify storage policies were created correctly
- Check that policy uses `auth.uid()` not `auth.email()`
- Test with Supabase Storage Explorer (manual upload)

### Image quality is poor
- Check Sharp quality settings in `imageProcessor.js`
- For avatars: PNG compression level is 9 (lossless)
- For cards: JPEG quality is 90, mozjpeg enabled

### Upload fails on iPhone (HEIC files)
- Client should convert HEIC → JPEG before upload
- Or add HEIC support to Sharp (`npm install sharp-heif`)
- Currently only JPG/PNG/WebP/GIF are allowed

---

## 📊 Performance Notes

### Client-Side
- Avatar exports PNG ≈ 150-300KB (512×512px transparent)
- Card exports JPEG ≈ 300-800KB (1400-1600px tall, q=90)
- DPR clamped to 2× max to avoid 4K exports on retina displays

### Server-Side
- Sharp processing takes ~200-500ms for typical images
- Supabase Storage upload takes ~300-800ms (depends on file size)
- Total latency: ~500-1300ms for avatar, ~800-1500ms for card

### Storage Costs
- Supabase Free Tier: 1GB storage, 2GB bandwidth/month
- Each avatar: ~250KB → ~4,000 avatars per GB
- Each card: ~500KB → ~2,000 cards per GB

---

## 🚀 Next Steps (Optional Enhancements)

1. **Add upload progress indicators** in the UI (use `onProgress` callback)
2. **Generate thumbnail sizes** on server (e.g., 128px, 256px, 512px)
3. **Add client-side crop preview** before opening modal
4. **Implement image caching** with CDN (Cloudflare, CloudFront)
5. **Add file type auto-detection** for HEIC/HEIF support
6. **Create admin panel** to manage uploaded images
7. **Add image moderation** (check for NSFW content)
8. **Implement drag-and-drop** file upload UI

---

## 📝 Summary

You now have a complete, production-ready image cropping and upload system with:

- ✅ Client-side crop components (avatar + card)
- ✅ Server-side validation and processing (Sharp)
- ✅ Secure storage with Supabase Storage
- ✅ Database integration (avatar_url, card_image_url)
- ✅ Rate limiting and file size validation
- ✅ EXIF stripping and orientation correction
- ✅ Mobile-friendly touch gestures

**All files are created and ready to use.** Just follow the setup instructions above!

---

*Generated by Claude Code*
*Last updated: 2025-10-15*
