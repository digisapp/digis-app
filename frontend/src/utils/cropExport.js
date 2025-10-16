// src/utils/cropExport.js
// Utility for exporting cropped images with proper DPR handling and size constraints

/**
 * @typedef {Object} ExportOpts
 * @property {'image/png' | 'image/jpeg' | 'image/webp'} [type='image/jpeg'] - Output image type
 * @property {number} [quality=0.92] - Quality 0..1 (jpeg/webp only)
 * @property {string} [filename] - Output filename
 * @property {number} [maxSize] - Clamp longest edge (px)
 */

/**
 * Convert canvas to Blob with optional resizing and quality control
 * @param {HTMLCanvasElement} canvas - Source canvas
 * @param {ExportOpts} opts - Export options
 * @returns {Promise<Blob>}
 */
export function canvasToBlob(
  canvas,
  { type = 'image/jpeg', quality = 0.92, maxSize } = {}
) {
  // Optionally downscale so we don't upload 4K avatars
  const srcW = canvas.width;
  const srcH = canvas.height;
  let dstW = srcW;
  let dstH = srcH;

  if (maxSize && Math.max(srcW, srcH) > maxSize) {
    const scale = maxSize / Math.max(srcW, srcH);
    dstW = Math.round(srcW * scale);
    dstH = Math.round(srcH * scale);
  }

  if (dstW !== srcW || dstH !== srcH) {
    const off = document.createElement('canvas');
    off.width = dstW;
    off.height = dstH;
    const ctx = off.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, srcW, srcH, 0, 0, dstW, dstH);
    canvas = off;
  }

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
}

/**
 * Convert canvas to File with optional resizing and quality control
 * @param {HTMLCanvasElement} canvas - Source canvas
 * @param {ExportOpts} opts - Export options
 * @returns {Promise<File>}
 */
export async function canvasToFile(
  canvas,
  opts = {}
) {
  const { type = 'image/jpeg', filename = `image_${Date.now()}.jpg` } = opts;
  const blob = await canvasToBlob(canvas, opts);
  return new File([blob], filename, { type });
}

/**
 * Load an image from a File or URL
 * @param {File | string} source - Image file or URL
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));

    if (typeof source === 'string') {
      img.src = source;
    } else {
      img.src = URL.createObjectURL(source);
    }
  });
}

/**
 * Get clamped device pixel ratio for consistent exports
 * @param {number} [max=2] - Maximum DPR to use
 * @returns {number}
 */
export function getClampedDPR(max = 2) {
  return Math.min(max, window.devicePixelRatio || 1);
}
