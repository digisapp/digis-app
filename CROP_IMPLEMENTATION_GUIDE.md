# Image Crop Implementation Guide

## Executive Summary

This document provides your tech team with everything needed to implement battle-tested image cropping that avoids the "stuck in corner" bug.

**What changed**: Replaced custom crop modal with specialized, stable libraries:
- `react-avatar-editor` for circular avatars
- `react-image-crop` for aspect-ratio cards

**Why**: The previous implementation had pointer offset issues due to CSS transforms. These libraries handle their own pointer math reliably.

## Installation

Already completed:
```bash
✅ npm install react-avatar-editor react-image-crop --legacy-peer-deps
```

## Files Added

### Frontend
```
frontend/src/
├── utils/
│   └── cropExport.js              # Canvas → File conversion utilities
├── components/media/
│   ├── AvatarCrop.jsx             # Circle avatar cropper
│   ├── CardCrop.jsx               # Aspect ratio card cropper
│   ├── ImageCropModal.jsx         # Unified modal wrapper
│   └── README.md                  # Detailed documentation
```

### Backend
```
backend/utils/
└── imageProcessor.js              # Sharp-based server validation
```

## Quick Start

### 1. Avatar Upload (Circular)

```jsx
import React, { useState } from 'react';
import ImageCropModal from './components/media/ImageCropModal';

function ProfileSettings() {
  const [cropModal, setCropModal] = useState({ open: false, file: null });

  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setCropModal({ open: true, file });
    }
  };

  const handleSave = async (croppedFile) => {
    const formData = new FormData();
    formData.append('avatar', croppedFile);

    const response = await fetch('/api/upload/avatar', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${yourAuthToken}`
      }
    });

    const { url } = await response.json();
    // Update your UI with new avatar URL
  };

  return (
    <>
      <input
        type="file"
        accept="image/*"
        onChange={handleAvatarSelect}
        style={{ display: 'none' }}
        id="avatar-input"
      />
      <label htmlFor="avatar-input">
        <img src={currentAvatar} alt="Avatar" className="w-32 h-32 rounded-full cursor-pointer" />
      </label>

      <ImageCropModal
        isOpen={cropModal.open}
        onClose={() => setCropModal({ open: false, file: null })}
        file={cropModal.file}
        cropType="avatar"
        onSave={handleSave}
      />
    </>
  );
}
```

### 2. Banner Upload (Aspect Ratio)

```jsx
import React, { useState } from 'react';
import ImageCropModal from './components/media/ImageCropModal';

function BannerSettings() {
  const [cropModal, setCropModal] = useState({ open: false, file: null });

  const handleBannerSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setCropModal({ open: true, file });
    }
  };

  const handleSave = async (croppedFile) => {
    const formData = new FormData();
    formData.append('banner', croppedFile);

    const response = await fetch('/api/upload/banner', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${yourAuthToken}`
      }
    });

    const { url } = await response.json();
    // Update your UI with new banner URL
  };

  return (
    <>
      <input
        type="file"
        accept="image/*"
        onChange={handleBannerSelect}
        style={{ display: 'none' }}
        id="banner-input"
      />
      <label htmlFor="banner-input">
        <div className="w-full h-48 bg-gray-200 cursor-pointer">
          <img src={currentBanner} alt="Banner" className="w-full h-full object-cover" />
        </div>
      </label>

      <ImageCropModal
        isOpen={cropModal.open}
        onClose={() => setCropModal({ open: false, file: null })}
        file={cropModal.file}
        cropType="card"
        aspectRatio="16:9"
        allowRatioChange={true}
        onSave={handleSave}
      />
    </>
  );
}
```

## Server Integration

### Option 1: Add to Existing Routes

If you already have upload routes, integrate the image processor:

```javascript
// In your existing routes/users.js or routes/uploads.js
const { processAvatar, processCard } = require('../utils/imageProcessor');

router.post('/upload/avatar', authenticateToken, uploadImage.single('avatar'), async (req, res) => {
  try {
    // Process with Sharp (strips EXIF, validates, resizes)
    const { buffer, metadata } = await processAvatar(req.file);

    // Upload to your storage (Supabase, S3, etc.)
    const { uploadImage } = require('../utils/supabase-storage');
    const { publicUrl } = await uploadImage(buffer, {
      bucket: 'avatars',
      path: `${req.user.id}/avatar_${Date.now()}.png`
    });

    // Update user profile
    await pool.query(
      'UPDATE users SET profile_pic_url = $1 WHERE id = $2',
      [publicUrl, req.user.id]
    );

    res.json({
      success: true,
      url: publicUrl,
      metadata
    });
  } catch (error) {
    logger.error('Avatar upload failed:', error);
    res.status(400).json({ error: error.message });
  }
});
```

### Option 2: New Upload Routes File

Create `backend/routes/media.js`:

```javascript
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { processAvatar, processCard } = require('../utils/imageProcessor');
const { uploadImage } = require('../utils/supabase-storage');
const { pool } = require('../utils/db');
const { logger } = require('../utils/secureLogger');

const upload = multer({ storage: multer.memoryStorage() });

// Avatar upload
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    const { buffer, metadata } = await processAvatar(req.file);

    const { publicUrl } = await uploadImage(buffer, {
      bucket: 'avatars',
      path: `${req.user.supabase_id}/avatar_${Date.now()}.png`
    });

    await pool.query(
      'UPDATE users SET profile_pic_url = $1 WHERE id = $2',
      [publicUrl, req.user.supabase_id]
    );

    logger.info('Avatar uploaded successfully', { userId: req.user.supabase_id });

    res.json({ success: true, url: publicUrl, metadata });
  } catch (error) {
    logger.error('Avatar upload error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Banner upload
router.post('/banner', authenticateToken, upload.single('banner'), async (req, res) => {
  try {
    const { buffer, metadata } = await processCard(req.file);

    const { publicUrl } = await uploadImage(buffer, {
      bucket: 'banners',
      path: `${req.user.supabase_id}/banner_${Date.now()}.jpg`
    });

    await pool.query(
      'UPDATE users SET banner_url = $1 WHERE id = $2',
      [publicUrl, req.user.supabase_id]
    );

    logger.info('Banner uploaded successfully', { userId: req.user.supabase_id });

    res.json({ success: true, url: publicUrl, metadata });
  } catch (error) {
    logger.error('Banner upload error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
```

Then in `api/index.js`:
```javascript
const mediaRoutes = require('../routes/media');
app.use('/api/upload', mediaRoutes);
```

## Component Props Reference

### ImageCropModal

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | boolean | Yes | Modal visibility |
| `onClose` | function | Yes | Close handler |
| `file` | File \| string | Yes | Image to crop |
| `cropType` | 'avatar' \| 'card' | Yes | Type of crop |
| `aspectRatio` | string | No | For cards: '2:3', '4:5', '9:16', '16:9', '1:1' |
| `allowRatioChange` | boolean | No | Allow user to change aspect ratio |
| `onSave` | function | Yes | Receives cropped File object |

### AvatarCrop

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `file` | File \| string | Yes | Image to crop |
| `initialZoom` | number | No | Default: 1.2 |
| `size` | number | No | Viewport size (default: 320px) |
| `onCancel` | function | Yes | Cancel handler |
| `onSave` | function | Yes | Save handler (receives PNG File) |

### CardCrop

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `file` | File \| string | Yes | Image to crop |
| `ratio` | string | No | '2:3', '4:5', '9:16', etc. (default: '2:3') |
| `exportHeight` | number | No | Max height in pixels (default: 1400) |
| `allowRatioChange` | boolean | No | Show ratio presets (default: false) |
| `onCancel` | function | Yes | Cancel handler |
| `onSave` | function | Yes | Save handler (receives JPEG File) |

## Critical Rules (Prevent Bugs)

### 1. No CSS Transforms on Crop Parents
❌ **BAD**:
```jsx
<div className="transform scale-95 transition-transform">
  <AvatarCrop ... />
</div>
```

✅ **GOOD**:
```jsx
<div className="opacity-100 transition-opacity">
  <AvatarCrop ... />
</div>
```

### 2. Fixed Container Sizes
Components need measured dimensions, not flexible layouts.

❌ **BAD**:
```jsx
<div className="flex-1 w-full">
  <CardCrop ... />
</div>
```

✅ **GOOD**:
```jsx
<div className="w-full max-w-6xl mx-auto">
  <CardCrop ... />
</div>
```

### 3. Server Always Re-encodes
Never trust client output directly. Always process server-side.

## File Size Outputs

| Type | Format | Max Dimensions | Typical Size |
|------|--------|----------------|--------------|
| Avatar | PNG | 512×512 | 150-300 KB |
| Card | JPEG | 1400px tall | 300-800 KB |

## Testing Checklist

Copy this to your QA ticket:

**Avatar Crop**:
- [ ] Upload JPG (3-10MB) → crops & saves successfully
- [ ] Upload PNG with transparency → preserves alpha channel
- [ ] Zoom in/out → image scales correctly
- [ ] Rotate ±180° → orientation preserved
- [ ] Retina iPhone → output ≤512×512px
- [ ] Tiny image (200px) → no upscaling artifacts

**Card Crop**:
- [ ] Upload tall image (portrait) → crops correctly
- [ ] Upload wide image (landscape) → crops correctly
- [ ] Drag crop corners → preview updates
- [ ] Change aspect ratio → crop resets appropriately
- [ ] Export → JPEG < 1MB

**Server**:
- [ ] EXIF stripped from output
- [ ] Orientation corrected (auto-rotate)
- [ ] File size capped correctly
- [ ] Invalid MIME rejected (400 error)
- [ ] Oversized file rejected (400 error)

**Browser Compatibility**:
- [ ] Chrome (desktop & mobile)
- [ ] Safari (desktop & mobile)
- [ ] Firefox
- [ ] No pointer offset issues

## Migration from Old Crop Modal

If replacing an existing implementation:

1. **Find all crop modal usages**:
   ```bash
   cd frontend
   grep -r "CropModal" src/
   ```

2. **Update imports**:
   ```jsx
   // Old
   import CropModal from './CropModal';

   // New
   import ImageCropModal from './components/media/ImageCropModal';
   ```

3. **Update component usage**:
   ```jsx
   // Old
   <CropModal
     image={image}
     onCrop={(dataUrl) => handleCrop(dataUrl)}
     aspectRatio={16/9}
   />

   // New
   <ImageCropModal
     isOpen={modalOpen}
     onClose={() => setModalOpen(false)}
     file={file}
     cropType="card"
     aspectRatio="16:9"
     onSave={(file) => handleSave(file)}
   />
   ```

4. **Update save handlers**:
   ```jsx
   // Old (data URL)
   const handleCrop = async (dataUrl) => {
     const blob = await fetch(dataUrl).then(r => r.blob());
     const file = new File([blob], 'image.jpg');
     // upload
   };

   // New (already File object)
   const handleSave = async (file) => {
     const formData = new FormData();
     formData.append('image', file);
     // upload
   };
   ```

## Troubleshooting

### Issue: Crop area stuck in top-left corner
**Solution**: Check for CSS transforms on parent elements. Use opacity-only animations.

### Issue: Large file sizes (>2MB)
**Solution**:
- Check `maxSize` parameter in `cropExport.js`
- Verify server-side caps in `imageProcessor.js`
- Check DPR clamping in `getClampedDPR()`

### Issue: Images rotated incorrectly
**Solution**: Ensure Sharp's `.rotate()` is called to auto-rotate based on EXIF

### Issue: Preview not updating in CardCrop
**Solution**: Check that `completedCrop` state updates and canvas ref is set

## Performance Notes

- DPR clamped to 2 max (prevents 4K canvases on retina)
- Client-side downscaling before upload
- Server-side caps as final safeguard
- PNG for avatars (transparent corners)
- JPEG for cards (smaller files)
- Sharp mozjpeg compression enabled

## Support

See full documentation in `frontend/src/components/media/README.md`

Questions? Check:
1. Component JSDoc comments
2. README.md examples
3. Console errors (detailed logging included)

## Summary for Tech Team

**What to integrate**:
1. Use `ImageCropModal` component in your upload flows
2. Add image processor to server upload routes
3. Ensure no CSS transforms on modal content

**Key files**:
- Frontend: `src/components/media/ImageCropModal.jsx`
- Backend: `utils/imageProcessor.js`
- Docs: `src/components/media/README.md`

**Testing**: See checklist above

**Timeline**: Should be drop-in replacement, ~1-2 hours integration + testing
