# Supabase Storage Setup for Content Management

## 1. Create Storage Buckets

Go to Supabase Dashboard → Storage and create these buckets:

### Bucket: `creator-photos`
- **Public**: Yes
- **File size limit**: 10MB
- **Allowed MIME types**: `image/jpeg, image/png, image/gif, image/webp`

### Bucket: `creator-videos`
- **Public**: Yes
- **File size limit**: 100MB
- **Allowed MIME types**: `video/mp4, video/quicktime, video/webm`

## 2. Set Bucket Policies

For each bucket, add these RLS policies:

### Policy: "Creators can upload"
```sql
CREATE POLICY "Creators can upload to their folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'creator-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### Policy: "Public can view"
```sql
CREATE POLICY "Anyone can view public content"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'creator-photos');
```

### Policy: "Creators can delete their own"
```sql
CREATE POLICY "Creators can delete their own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'creator-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

## 3. Database Schema

Run this SQL in Supabase SQL Editor:

```sql
-- Create creator_content table
CREATE TABLE IF NOT EXISTS creator_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content_id UUID NOT NULL REFERENCES creator_content(id),
  creator_id UUID NOT NULL REFERENCES auth.users(id),
  price INTEGER NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create content_likes table
CREATE TABLE IF NOT EXISTS content_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content_id UUID NOT NULL REFERENCES creator_content(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);

-- Create content_bundles table (for bulk uploads)
CREATE TABLE IF NOT EXISTS content_bundles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES auth.users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  is_premium BOOLEAN DEFAULT FALSE,
  price INTEGER DEFAULT 0,
  photo_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_creator_content_creator_id ON creator_content(creator_id);
CREATE INDEX idx_creator_content_type ON creator_content(content_type);
CREATE INDEX idx_content_purchases_user_id ON content_purchases(user_id);
CREATE INDEX idx_content_purchases_content_id ON content_purchases(content_id);
CREATE INDEX idx_content_likes_user_id ON content_likes(user_id);
CREATE INDEX idx_content_likes_content_id ON content_likes(content_id);

-- Enable RLS
ALTER TABLE creator_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_bundles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for creator_content
CREATE POLICY "Public can view active content"
  ON creator_content FOR SELECT
  USING (is_active = true);

CREATE POLICY "Creators can manage their own content"
  ON creator_content FOR ALL
  USING (auth.uid() = creator_id);

-- RLS Policies for content_purchases
CREATE POLICY "Users can view their own purchases"
  ON content_purchases FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = creator_id);

CREATE POLICY "Users can create purchases"
  ON content_purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for content_likes
CREATE POLICY "Anyone can view likes"
  ON content_likes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can manage their own likes"
  ON content_likes FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for content_bundles
CREATE POLICY "Public can view bundles"
  ON content_bundles FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Creators can manage their own bundles"
  ON content_bundles FOR ALL
  USING (auth.uid() = creator_id);
```

## 4. Environment Variables

Add to `.env`:
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 5. Test the Setup

1. Upload a test image to `creator-photos` bucket
2. Verify you can access it via public URL
3. Test the database tables by inserting a record
4. Verify RLS policies work correctly
