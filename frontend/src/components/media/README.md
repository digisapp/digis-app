# Image Crop Components

Battle-tested image cropping solution that avoids the "crop stuck in corner" bug by design.

## Why This Implementation?

The previous crop modal had issues with:
- Pointer offset bugs due to CSS transforms on parent elements
- Crop area getting locked to top-left corner
- Inconsistent behavior across different animated/transformed contexts

This implementation uses:
- **react-avatar-editor**: Dead-simple, reliable circle cropping for avatars
- **react-image-crop**: Great at fixed aspect ratios for cards/banners
- **No CSS transforms**: Only opacity animations to prevent pointer math issues
- **Server-side re-encoding**: Strips EXIF, validates formats, enforces size caps

## Components

### AvatarCrop
Circle avatar cropper with zoom and rotation controls.
- **Output**: PNG with transparent corners (512×512px max)
- **Features**: Zoom, rotation, clamped DPR for predictable file sizes
- **Use for**: Profile pictures

### CardCrop
Rectangular image cropper with aspect ratio presets.
- **Output**: JPEG optimized for web (~1400px tall max)
- **Presets**: 2:3 (vertical), 4:5 (Instagram), 9:16 (stories), 16:9 (landscape), 1:1 (square)
- **Features**: Live preview, aspect ratio switching (optional)
- **Use for**: Banners, cards, cover images

### ImageCropModal
Unified modal wrapper that routes to the appropriate crop component.
- **Animations**: Opacity-only (no transforms to prevent bugs)
- **Props**: See JSDoc in file

## Usage Examples

### Example 1: Avatar Upload

```jsx
import React, { useState } from 'react';
import ImageCropModal from '@/components/media/ImageCropModal';
import { uploadAvatar } from '@/services/uploads';

export default function AvatarUploader() {
  const [file, setFile] = useState(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setCropModalOpen(true);
    }
  };

  const handleSave = async (croppedFile) => {
    try {
      await uploadAvatar(croppedFile);
      // Update UI with new avatar
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        id="avatar-upload"
      />
      <label htmlFor="avatar-upload" className="cursor-pointer">
        <div className="w-32 h-32 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors">
          {/* Your avatar display */}
        </div>
      </label>

      <ImageCropModal
        isOpen={cropModalOpen}
        onClose={() => setCropModalOpen(false)}
        file={file}
        cropType="avatar"
        onSave={handleSave}
      />
    </>
  );
}
```

### Example 2: Banner Upload with Aspect Ratio Selection

```jsx
import React, { useState } from 'react';
import ImageCropModal from '@/components/media/ImageCropModal';
import { uploadBanner } from '@/services/uploads';

export default function BannerUploader() {
  const [file, setFile] = useState(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setCropModalOpen(true);
    }
  };

  const handleSave = async (croppedFile) => {
    try {
      await uploadBanner(croppedFile);
      // Update UI with new banner
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        id="banner-upload"
      />
      <label htmlFor="banner-upload" className="cursor-pointer">
        <div className="w-full h-48 bg-gray-200 hover:bg-gray-300 transition-colors">
          {/* Your banner display */}
        </div>
      </label>

      <ImageCropModal
        isOpen={cropModalOpen}
        onClose={() => setCropModalOpen(false)}
        file={file}
        cropType="card"
        aspectRatio="16:9"
        allowRatioChange={true}
        onSave={handleSave}
      />
    </>
  );
}
```

## Server-Side Integration

### Express Route Example

```javascript
const express = require('express');
const multer = require('multer');
const { processAvatar, processCard } = require('../utils/imageProcessor');
const { uploadToSupabase } = require('../utils/supabase-storage');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Avatar upload endpoint
router.post('/upload/avatar', upload.single('avatar'), async (req, res) => {
  try {
    // Process with Sharp
    const { buffer, metadata } = await processAvatar(req.file);

    // Upload to storage
    const url = await uploadToSupabase(buffer, {
      bucket: 'avatars',
      path: `${req.user.id}/avatar_${Date.now()}.png`,
      contentType: 'image/png'
    });

    res.json({
      success: true,
      url,
      metadata
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

// Banner upload endpoint
router.post('/upload/banner', upload.single('banner'), async (req, res) => {
  try {
    // Process with Sharp
    const { buffer, metadata } = await processCard(req.file);

    // Upload to storage
    const url = await uploadToSupabase(buffer, {
      bucket: 'banners',
      path: `${req.user.id}/banner_${Date.now()}.jpg`,
      contentType: 'image/jpeg'
    });

    res.json({
      success: true,
      url,
      metadata
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

module.exports = router;
```

## What Gets Prevented

### The "Stuck in Corner" Bug
- ❌ **Old issue**: Crop area locks to top-left, can't drag
- ✅ **Fixed**: No CSS transforms on crop area parents
- ✅ **Fixed**: Libraries handle their own pointer math

### File Size Bloat
- ❌ **Old issue**: 4K+ images on retina displays
- ✅ **Fixed**: Clamped DPR (max 2x)
- ✅ **Fixed**: Server-side resize caps

### EXIF Issues
- ❌ **Old issue**: Photos sideways, metadata bloat
- ✅ **Fixed**: Sharp auto-rotates and strips EXIF

## Performance Notes

- Avatar exports capped at 512×512 PNG (~150-300KB)
- Card exports capped at 1400px tall JPEG (<1MB)
- DPR clamped to 2 to prevent huge canvases on mobile
- Server re-encodes everything for consistency

## Architecture Rules

1. **No transforms on crop parents**: Use opacity-only animations
2. **Fixed container sizes**: Provide measured dimensions, not flexible layouts
3. **Client caps sizes**: Don't rely on server alone
4. **Server validates everything**: MIME, size, re-encode

## Testing Checklist

- [ ] Upload JPG/PNG/WebP (3-10MB) → crops & saves
- [ ] Retina iPhone → zoom/rotate works, output ≤512×512
- [ ] Tiny image (200px) → no upscaling artifacts
- [ ] Extremely tall/wide source → correct letterboxed crop
- [ ] EXIF orientation → corrected server-side
- [ ] No pointer offset across Chrome/Safari/Firefox
- [ ] Modal animations → no layout shift in crop area

## Migration from Old Crop Modal

If you have an existing crop modal:

1. **Replace imports**:
   ```jsx
   // Old
   import CropModal from './CropModal';

   // New
   import ImageCropModal from '@/components/media/ImageCropModal';
   ```

2. **Update props**:
   ```jsx
   // Old
   <CropModal
     image={image}
     onCrop={handleCrop}
     aspectRatio={16/9}
   />

   // New
   <ImageCropModal
     isOpen={open}
     onClose={() => setOpen(false)}
     file={file}
     cropType="card"
     aspectRatio="16:9"
     onSave={handleSave}
   />
   ```

3. **Update save handler**:
   The new components pass a File object, not a data URL:
   ```jsx
   // Old
   const handleCrop = async (dataUrl) => {
     const blob = await fetch(dataUrl).then(r => r.blob());
     // upload blob
   };

   // New
   const handleSave = async (file) => {
     // file is already a File object
     await uploadAvatar(file);
   };
   ```

## Troubleshooting

**Q: Crop area stuck in corner**
- A: Check for CSS transforms on modal or crop parent elements. Use opacity-only animations.

**Q: Files too large**
- A: Check `maxSize` in cropExport.js and server-side caps in imageProcessor.js

**Q: Images rotated incorrectly**
- A: Server-side Sharp should auto-rotate. Check `rotate()` is called on sharp instance.

**Q: Preview not updating**
- A: Check `completedCrop` state in CardCrop. Ensure canvas ref is set.
