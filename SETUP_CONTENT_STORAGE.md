# Content Storage Setup - Production Ready Guide

## ✅ Storage Buckets Already Exist!

You already have the `creator-content` bucket created and public. We'll use this existing bucket with subfolders:
- `creator-content/photos/` - For photo uploads
- `creator-content/videos/` - For video uploads

**No bucket creation needed!** ✅

## Step 1: Verify Bucket Configuration

Go to your Supabase Dashboard → Storage → `creator-content` and verify:
- ✅ **Public**: Yes (already configured)
- ✅ **File size limit**: Should be at least 100MB for videos

If the file size limit is too low, update it in the bucket settings.

## Step 2: Create Database Tables

Go to Supabase Dashboard → SQL Editor and run this SQL:

```sql
-- Create creator_content table
CREATE TABLE IF NOT EXISTS creator_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('photo', 'video')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  content_url TEXT NOT NULL,
  price INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  file_size BIGINT,
  mime_type VARCHAR(100),
  bundle_id UUID,
  is_premium BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  category VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create content_purchases table
CREATE TABLE IF NOT EXISTS content_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  content_id UUID NOT NULL REFERENCES creator_content(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL,
  price INTEGER NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create content_likes table
CREATE TABLE IF NOT EXISTS content_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  content_id UUID NOT NULL REFERENCES creator_content(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);

-- Create content_bundles table
CREATE TABLE IF NOT EXISTS content_bundles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  is_premium BOOLEAN DEFAULT FALSE,
  price INTEGER DEFAULT 0,
  photo_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_creator_content_creator_id ON creator_content(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_content_type ON creator_content(content_type);
CREATE INDEX IF NOT EXISTS idx_creator_content_active ON creator_content(is_active);
CREATE INDEX IF NOT EXISTS idx_content_purchases_user_id ON content_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_content_purchases_content_id ON content_purchases(content_id);
CREATE INDEX IF NOT EXISTS idx_content_purchases_creator_id ON content_purchases(creator_id);
CREATE INDEX IF NOT EXISTS idx_content_likes_user_id ON content_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_content_likes_content_id ON content_likes(content_id);
CREATE INDEX IF NOT EXISTS idx_content_bundles_creator_id ON content_bundles(creator_id);
```

## Step 3: Verify Environment Variables

Your backend `.env` already has:

```bash
SUPABASE_URL=https://lpphsjowsivjtcmafxnj.supabase.co ✅
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... ✅
```

**No changes needed!**

## Step 4: Test the Setup

After running the SQL in Step 2:

1. Start your backend: `cd backend && npm run dev`
2. Open your app and log in as a creator
3. Go to "My Content" page on mobile
4. Click "Upload Content"
5. Select a photo or video
6. Watch the upload progress bar
7. Verify the content appears in your content list
8. Check Supabase Storage → `creator-content` bucket to see the uploaded file
9. Check Supabase → Table Editor → `creator_content` to see the database record

## What's Already Done

✅ Backend routes updated to use Supabase storage (`/backend/routes/content-supabase.js`)
✅ Backend configured to use existing `creator-content` bucket
✅ Mobile Content component connected to real API (`MobileContent.js`)
✅ Upload functionality with progress tracking
✅ Delete functionality
✅ Real-time stats from database
✅ Environment variables already configured

## What You Need to Do

1. ⏳ Run the SQL above in Supabase Dashboard (Step 2)
2. ⏳ Test the upload flow (Step 4)

That's it! The system will use your existing `creator-content` bucket with subfolders for organization.

## Storage Structure

Your files will be organized like this:
```
creator-content/
├── photos/
│   └── {userId}/
│       ├── 1234567890-uuid.jpg
│       ├── 1234567891-uuid.png
│       └── ...
└── videos/
    └── {userId}/
        ├── 1234567890-uuid.mp4
        ├── 1234567891-uuid.mov
        └── ...
```

## API Endpoints Available

- `GET /api/content/creator/:username` - Get creator's content (public)
- `POST /api/content/upload` - Upload single photo/video (auth required)
- `POST /api/content/upload-bundle` - Bulk upload photos (auth required)
- `DELETE /api/content/:contentId` - Delete content (auth required)
- `GET /api/content/purchased` - Get purchased content (auth required)
- `POST /api/content/:contentId/like` - Like/unlike content (auth required)
- `POST /api/content/purchase` - Purchase content with tokens (auth required)

## Desktop Compatibility

The existing `EnhancedContentGallery.js` component already calls these endpoints, so desktop content management will work automatically once the backend is deployed.
