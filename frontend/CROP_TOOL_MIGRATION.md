# Image Crop Tool Migration

## Summary
Migrated from `react-easy-crop` to `react-avatar-editor` for better avatar cropping experience.

## Files Updated

### Desktop Edit Profile (ImprovedProfile.js)
- **Changed**: `import ImageCropperModal from './ImageCropperModal'`
- **To**: `import ImageCropModal from './media/ImageCropModal'`
- Updated crop modal API to use new `cropType`, `file`, and `onSave` props
- Simplified `handleCroppedImage` to receive File directly instead of blob/url object

### Mobile Already Using New Tool
- `MobileEditProfile.js` was already using the new `ImageCropModal` correctly

## Legacy Files Still Present (Not Used in Edit Profile)
These files still use the old `ImageCropperModal` but are NOT in the edit profile path:
- `HybridCreatorDashboard.js`
- `SmartImageUploader.js`
- `SimpleProfileImageUploader.js`
- `AvatarUpload.js`

## Old Cropper Location
`/frontend/src/components/ImageCropperModal.js` (react-easy-crop)

## New Cropper Location
- `/frontend/src/components/media/ImageCropModal.jsx` (wrapper)
- `/frontend/src/components/media/AvatarCrop.jsx` (react-avatar-editor)
- `/frontend/src/components/media/CardCrop.jsx` (for cards/banners)

## Service Worker Cache Clearing

If you're still seeing the old cropper after deployment:

### Option 1: Hard Refresh (User Side)
```
- Chrome/Edge: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Safari: Cmd+Option+R
- Firefox: Ctrl+Shift+R
```

### Option 2: Clear Service Worker (Developer)
```javascript
// In browser console:
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister())
})
location.reload(true)
```

### Option 3: Bump Service Worker Version
Edit `vite.config.js` and update the workbox version or add:
```javascript
workbox: {
  // Force new version
  buildId: Date.now().toString()
}
```

## Testing Checklist
- [ ] Desktop: Click Edit Profile → Upload avatar → See react-avatar-editor with zoom/rotation
- [ ] Mobile: Click Edit Profile → Upload avatar → See react-avatar-editor with zoom/rotation
- [ ] Verify circular crop preview during editing
- [ ] Verify uploaded avatar is properly cropped
- [ ] Test banner upload (should use CardCrop for banner)

## API Differences

### Old API (react-easy-crop)
```javascript
<ImageCropperModal
  isOpen={true}
  imageSrc={dataUrl}
  onCropComplete={(croppedImage) => {
    // croppedImage = { blob: File, url: string }
  }}
  aspectRatio={1}
  cropShape="round"
  title="Crop Avatar"
/>
```

### New API (react-avatar-editor)
```javascript
<ImageCropModal
  isOpen={true}
  cropType="avatar"  // or "card"
  file={fileOrDataUrl}
  onSave={(croppedFile) => {
    // croppedFile = File (PNG for avatar)
  }}
  onClose={() => {}}
  aspectRatio="2:3"  // for cards only
/>
```

## Benefits of New Tool
- Better mobile touch support
- Cleaner circular crop with transparent PNG export
- Simpler API (receives File directly)
- More predictable file sizes with clamped DPR
- Better zoom and rotation controls
