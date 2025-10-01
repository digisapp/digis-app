# Supabase Storage Setup Guide

## Overview
Complete storage solution for the Digis platform using Supabase Storage buckets to handle all digital content including images, videos, documents, and streaming recordings.

## Storage Architecture

### Public Buckets (CDN-optimized)
- **profile-pictures** - User avatars (5MB limit)
- **creator-banners** - Creator profile banners (10MB limit)
- **stream-thumbnails** - Live stream thumbnails (5MB limit)
- **shop-products** - Product images (10MB limit)
- **virtual-gifts** - Gift animations and images (5MB limit)

### Private Buckets (Authenticated access)
- **creator-content** - Premium creator content (100MB limit)
- **message-attachments** - Chat file attachments (25MB limit)
- **stream-recordings** - Live stream recordings (5GB limit)
- **session-recordings** - Video/voice call recordings (2GB limit)
- **identity-verification** - KYC documents (10MB limit)
- **analytics-reports** - Generated reports (50MB limit)
- **ticketed-shows** - Ticketed event media (500MB limit)

## Setup Instructions

### Step 1: Run SQL Script in Supabase

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and run the entire contents of `CREATE_STORAGE_BUCKETS.sql`
4. Verify buckets are created in Storage section

### Step 2: Configure Backend

1. Install required dependencies:
```bash
cd backend
npm install sharp
```

2. The storage routes are already configured at `/api/storage/*`

3. Verify environment variables:
```env
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Step 3: Frontend Integration

The storage client and FileUpload component are ready to use:

```javascript
import FileUpload from './components/FileUpload';
import storageClient from './utils/storage-client';

// Example: Upload profile picture
<FileUpload
  endpoint="profile-picture"
  accept="image/*"
  maxSize={5 * 1024 * 1024} // 5MB
  onUpload={(result) => console.log('Uploaded:', result)}
  buttonText="Upload Profile Picture"
/>

// Example: Upload creator content
<FileUpload
  endpoint="creator-content"
  accept="image/*,video/*,audio/*"
  maxSize={100 * 1024 * 1024} // 100MB
  maxFiles={10}
  onUpload={(results) => console.log('Uploaded files:', results)}
/>
```

## API Endpoints

### Upload Endpoints

#### POST `/api/storage/profile-picture`
Upload user profile picture with automatic resizing
- Creates multiple sizes: original, large (1280px), medium (640px), thumbnail (150px)
- Auto-converts to WebP format

#### POST `/api/storage/creator-banner`
Upload creator banner image
- Resizes to 1920x480px
- Optimizes for web display

#### POST `/api/storage/creator-content`
Upload premium creator content
- Supports images, videos, audio, PDFs
- Metadata: title, description, price, subscription_only

#### POST `/api/storage/message-attachment`
Upload chat attachments
- Returns signed URL valid for 1 hour
- Supports various file types

#### POST `/api/storage/shop-product`
Upload product images
- Creates multiple sizes for gallery display
- Optimized for e-commerce

### Management Endpoints

#### POST `/api/storage/signed-url`
Generate signed URL for private content
- Validates user access permissions
- Configurable expiration time

#### GET `/api/storage/my-files/:bucket`
List user's files in a bucket
- Pagination support
- Sorting options

#### GET `/api/storage/usage`
Get storage usage statistics
- Per-bucket breakdown
- Total usage metrics

#### DELETE `/api/storage/file`
Delete a file
- Only file owner can delete
- Removes from storage and database

## Security Features

### Row Level Security (RLS)
- Users can only upload to their own folders
- Creators control access to premium content
- Subscribers can view purchased content
- Admin-only access to verification documents

### Access Control
- Token-based authentication
- Signed URLs for temporary access
- Content purchase verification
- Subscription status checking

### File Validation
- MIME type restrictions per bucket
- File size limits
- Extension validation
- Virus scanning (optional)

## Usage Examples

### Profile Picture Upload
```javascript
// Frontend
const handleProfilePictureUpload = async (file) => {
  try {
    const result = await storageClient.uploadProfilePicture(file);
    console.log('Profile updated:', result);
    // URLs available: original, large, medium, thumbnail
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

### Creator Content Upload
```javascript
// Frontend
const uploadContent = async (files, metadata) => {
  try {
    const result = await storageClient.uploadCreatorContent(files, {
      title: 'Exclusive Content',
      description: 'Special content for subscribers',
      price: 50, // in tokens
      subscription_only: true
    });
    console.log('Content uploaded:', result);
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

### Get Private Content URL
```javascript
// Frontend
const getPrivateContent = async (bucket, path) => {
  try {
    const url = await storageClient.getSignedUrl(
      bucket,
      path,
      3600 // expires in 1 hour
    );
    // Use URL to display/download content
    window.open(url);
  } catch (error) {
    console.error('Access denied:', error);
  }
};
```

### Message Attachment
```javascript
// In chat component
const sendAttachment = async (file) => {
  try {
    const attachment = await storageClient.uploadMessageAttachment(file);
    
    // Send message with attachment
    await sendMessage({
      text: 'Check out this file',
      attachment: {
        url: attachment.url,
        name: attachment.fileName,
        type: attachment.fileType,
        size: attachment.fileSize
      }
    });
  } catch (error) {
    console.error('Failed to send attachment:', error);
  }
};
```

## Storage Limits

### Per-Bucket Limits
| Bucket | File Size Limit | Allowed Types |
|--------|----------------|---------------|
| profile-pictures | 5MB | Images |
| creator-banners | 10MB | Images |
| stream-thumbnails | 5MB | Images |
| shop-products | 10MB | Images |
| creator-content | 100MB | Images, Videos, Audio, PDFs |
| message-attachments | 25MB | Various |
| stream-recordings | 5GB | Videos |
| session-recordings | 2GB | Videos, Audio |
| identity-verification | 10MB | Images, PDFs |
| analytics-reports | 50MB | PDFs, CSVs, Excel |
| virtual-gifts | 5MB | Images, Animations |
| ticketed-shows | 500MB | Images, Videos, Audio |

### Platform Limits
- Max 10 files per upload request
- 100GB total storage per creator
- 1TB monthly bandwidth included
- Automatic CDN distribution for public buckets

## Monitoring & Analytics

### Storage Metrics
- Track usage per user/creator
- Monitor bandwidth consumption
- File access logs
- Popular content analytics

### Database Tables
- `file_uploads` - Track all uploads
- `content_access_logs` - Monitor content access
- `storage_usage` - Usage statistics

## Best Practices

### Image Optimization
- Auto-convert to WebP format
- Generate multiple sizes
- Lazy load thumbnails
- Use CDN URLs for public content

### Video Handling
- Compress before upload
- Generate preview thumbnails
- Stream instead of download
- Consider HLS for large videos

### Security
- Validate files client-side first
- Use signed URLs for sensitive content
- Implement rate limiting
- Regular security audits

### Performance
- Use resumable uploads for large files
- Implement chunked uploads
- Cache signed URLs
- Optimize database queries

## Troubleshooting

### Common Issues

1. **Upload fails with CORS error**
   - Check Supabase CORS settings
   - Verify allowed origins

2. **File size limit exceeded**
   - Check bucket configuration
   - Implement client-side validation

3. **Access denied to private content**
   - Verify RLS policies
   - Check user permissions

4. **Slow uploads**
   - Implement progress tracking
   - Use compression
   - Consider chunked uploads

## Migration from Existing Storage

If migrating from another storage solution:

1. Export existing file metadata
2. Use batch upload scripts
3. Update database references
4. Verify all links work
5. Clean up old storage

## Cost Optimization

- Use appropriate file size limits
- Implement automatic cleanup of old files
- Compress images and videos
- Use caching strategies
- Monitor bandwidth usage

## Future Enhancements

- [ ] Video transcoding pipeline
- [ ] AI-powered content moderation
- [ ] Automatic image optimization
- [ ] Advanced analytics dashboard
- [ ] Backup and disaster recovery
- [ ] Edge caching optimization
- [ ] WebRTC recording integration