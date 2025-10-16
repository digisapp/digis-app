# PR Handoff: Replace Legacy Crop Modal

## PR Title & Description

**Title**: Replace legacy crop modal with stable avatar & card croppers; add server-side re-encode & validation

### Summary

- New avatar cropper (`react-avatar-editor`) for perfect circle exports
- New card cropper (`react-image-crop`) with 2:3 / 4:5 / 9:16 presets
- Client export utils with DPR clamp + size caps
- Server re-encode (Sharp): strip EXIF, clamp size, enforce MIME
- Removes old "stuck in corner" crop modal

### Scope

**Frontend**:
- `src/components/media/AvatarCrop.jsx`
- `src/components/media/CardCrop.jsx`
- `src/components/media/ImageCropModal.jsx`
- `src/utils/cropExport.js`

**Backend**:
- `backend/utils/imageProcessor.js`

**Docs**:
- `CROP_IMPLEMENTATION_GUIDE.md`
- `HANDOFF_SUMMARY.md`
- `src/components/media/README.md`

### How to Test

**Avatar**:
- Upload a large JPG/PNG/WebP, crop, save → see transparent circle PNG ≤ 512×512
- Check UI renders as a circle; no jagged edges; file size ~150–300 KB

**Card**:
- Try 2:3, 4:5, 9:16 crops; export ≈ 1200–1600 px height JPEG < 1 MB
- Orientation correct for iPhone photos (no sideways)

**Server**:
- Verify stored files have EXIF removed; dimensions clamped; type enforced

**Regressions**:
- Open modals on Safari iOS, Chrome, Firefox; drag/zoom never "snaps" to top-left

### Rollout Notes

- No breaking API changes; new UI only
- If anything goes sideways, switch back to the previous modal component while keeping server validation in place (it's safe to keep)

---

## 2. Wiring Instructions

### Avatar Upload (Client → API)

Use the provided modal; wire `onSave` to your existing uploader:

```jsx
// e.g. src/components/profile/AvatarUploader.jsx
import AvatarCrop from '@/components/media/AvatarCrop';
import { uploadAvatar } from '@/services/uploads'; // existing API call

<AvatarCrop
  file={file}
  onCancel={() => setOpen(false)}
  onSave={async (croppedFile) => {
    await uploadAvatar(croppedFile); // multipart/form-data
    setOpen(false);
  }}
/>
```

### Card Upload (Client → API)

```jsx
import CardCrop from '@/components/media/CardCrop';
import { uploadCreatorCard } from '@/services/uploads';

<CardCrop
  file={file}
  ratio="4:5"
  onCancel={() => setOpen(false)}
  onSave={async (croppedFile) => {
    await uploadCreatorCard(croppedFile);
    setOpen(false);
  }}
/>
```

### Server Handlers (Node / Sharp)

Call the utilities you added:

```javascript
// backend/routes/uploads.js (example)
const { processAvatar, processCard } = require('../utils/imageProcessor');

router.post('/avatar', upload.single('file'), async (req, res) => {
  const { buffer, metadata } = await processAvatar(req.file);
  // store to S3/Supabase Storage, then save URL on user
  res.json({ ok: true, url: publicUrl, metadata });
});

router.post('/card', upload.single('file'), async (req, res) => {
  const { buffer, metadata } = await processCard(req.file);
  // store and persist URL
  res.json({ ok: true, url: publicUrl, metadata });
});
```

---

## 3. Remove Legacy Cropper

**Action Items**:
1. Delete/retire the old file: `ImageCropperModal.js` (and any wrapper that imports it)
2. Search for usages and replace with `ImageCropModal.jsx` or direct `AvatarCrop`/`CardCrop`
3. In the modal container **do not animate with CSS transforms** on the crop area (opacity transitions only)

**Search command**:
```bash
# Find all usages of old crop modal
grep -r "ImageCropperModal\|CropModal" src/
```

---

## 4. UX Decisions (Lock These)

Everyone should align on:

- **Avatar**: exports PNG (keeps transparent corners), max 512×512, DPR capped at 2
- **Card**: exports JPEG, target height ≈ 1400–1600 px, quality ~0.9
- **Presets exposed**: 2:3, 4:5, 9:16 (can add 1:1, 16:9 later by prop)
- **Rotation**: allowed on avatar; not needed on card (server fixes EXIF anyway)

---

## 5. Performance & Correctness Checklist

### Client
- [ ] No parent transforms around the cropper
- [ ] Preview canvas updates smoothly while dragging

### Server
- [ ] Reject >10MB or non-image MIME with a 400
- [ ] Strip EXIF, auto-rotate, clamp longest edge (avatar 512, card 1600)

### Storage
- [ ] Use cacheable public URLs (immutable if versioned filenames)
- [ ] Add a tiny CDN TTL (e.g., 1h) and cache-buster query on profile save

---

## 6. QA Script

Copy/paste to QA ticket:

### Desktop Testing
- [ ] **Chrome/Firefox/Safari desktop**: crop, zoom, rotate avatar → saved image is crisp circle, no pixelation
- [ ] **Chrome desktop**: card crop with 2:3 ratio → export is correct dimensions
- [ ] **Firefox desktop**: card crop with 4:5 ratio → no pointer offset
- [ ] **Safari desktop**: card crop with 9:16 ratio → smooth drag/zoom

### Mobile Testing
- [ ] **iPhone Safari**: pinch-zoom works; export isn't massive; upload completes < 1s on LTE
- [ ] **Android Chrome**: drag/zoom never "jumps" or sticks at edges
- [ ] **iPhone Safari**: HEIC/Live Photo gracefully fails on client (accepts only jpg/png/webp); message is friendly

### Edge Cases
- [ ] **Tiny source image** (≤256px): still centers and saves; server doesn't upscale past 512
- [ ] **Very large image** (>10MB): rejected with friendly 400 error
- [ ] **Portrait iPhone photo**: server auto-rotates based on EXIF (no sideways images)
- [ ] **Landscape photo**: crops correctly; content centered; no unexpected letterboxing

### Server Validation
- [ ] Upload PNG → server re-encodes, strips EXIF, returns optimized version
- [ ] Upload JPEG → server re-encodes with mozjpeg, dimensions capped
- [ ] Upload WebP → server accepts and processes correctly
- [ ] Upload invalid file (PDF, TXT) → 400 error with clear message

---

## 7. Follow-ups (Optional)

Your team may want to tackle:

1. **Add crop preset switcher** above CardCrop (prop-driven)
2. **Show upload progress bar** when posting to storage
3. **Auto-regenerate smaller thumb sizes** on server (e.g., 320, 640) for lists
4. **Add video preview support** for card crops (for future video features)
5. **Implement bulk upload** for gallery photos using CardCrop

---

## File Locations Quick Reference

### Must Read First
1. `CROP_IMPLEMENTATION_GUIDE.md` - Complete integration guide
2. `HANDOFF_SUMMARY.md` - Quick overview

### Components to Use
```
frontend/src/
├── components/media/
│   ├── ImageCropModal.jsx      ← Use this for modal wrapper
│   ├── AvatarCrop.jsx          ← Direct use for avatars
│   └── CardCrop.jsx            ← Direct use for cards
└── utils/
    └── cropExport.js           ← Don't call directly (used by components)
```

### Server Integration
```
backend/utils/
└── imageProcessor.js           ← Use processAvatar() and processCard()
```

---

## Migration Checklist

- [ ] Review `CROP_IMPLEMENTATION_GUIDE.md`
- [ ] Find all usages of old crop modal (`grep -r "CropModal" src/`)
- [ ] Replace with `ImageCropModal` or direct component
- [ ] Add server endpoints using `imageProcessor.js`
- [ ] Remove old crop modal file
- [ ] Test avatar upload flow
- [ ] Test card/banner upload flow
- [ ] Run QA script above
- [ ] Verify no CSS transforms on crop parents
- [ ] Check file sizes are correct (~300KB for avatars, <1MB for cards)
- [ ] Deploy to staging
- [ ] Smoke test on production

---

## Example Integration Points

### Where to Add This

Look for these patterns in your codebase and replace:

**Profile Avatar**:
- `src/components/profile/ProfileSettings.jsx`
- `src/components/profile/AvatarUpload.jsx`
- Search: `profile.*pic\|avatar.*upload`

**Creator Banner**:
- `src/components/creator/CreatorSettings.jsx`
- `src/components/creator/BannerUpload.jsx`
- Search: `banner.*upload\|cover.*image`

**Gallery Photos**:
- `src/components/creator/GalleryManager.jsx`
- Use `CardCrop` with `allowRatioChange={true}`

---

## Critical: CSS Transform Rule

### ❌ DON'T DO THIS
```jsx
// BAD - transforms break pointer math
<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
>
  <AvatarCrop ... />
</motion.div>
```

### ✅ DO THIS
```jsx
// GOOD - opacity only
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
>
  <AvatarCrop ... />
</motion.div>
```

---

## Support During Integration

If the team hits issues:

1. **Component not rendering**: Check `file` prop is File object or valid URL
2. **Crop stuck in corner**: Check for CSS transforms on parent
3. **Large file sizes**: Check DPR clamping and `maxSize` in exports
4. **Server errors**: Check Sharp is installed (`npm list sharp`)
5. **Images rotated**: Ensure `.rotate()` is called on Sharp instance

All components have detailed JSDoc comments and inline documentation.

---

## Estimated Timeline

- **Review docs**: 30 min
- **Backend integration**: 1 hour
- **Frontend replacement**: 1 hour
- **QA testing**: 1 hour
- **Fixes & polish**: 30 min

**Total**: ~4 hours for full integration and testing

---

## Success Criteria

Deployment is successful when:

1. ✅ Users can upload avatars → see crisp circles
2. ✅ Users can upload banners → correct aspect ratios
3. ✅ No "stuck in corner" reports
4. ✅ File sizes reasonable (~300KB avatars, <1MB cards)
5. ✅ Server strips EXIF and fixes orientation
6. ✅ Works across Chrome, Safari, Firefox (desktop & mobile)
7. ✅ No regressions in existing upload flows

---

## Rollback Plan

If issues arise:

1. **Keep server validation** (`imageProcessor.js`) - it's safe and beneficial
2. **Revert frontend components** - switch back to old modal temporarily
3. **File issue** with reproduction steps
4. **Schedule fix** for next sprint

The server-side improvements can stay regardless of frontend component choice.
