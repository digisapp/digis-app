// src/components/media/CardCrop.jsx
// Card/banner cropper with fixed aspect ratios using react-image-crop
// Supports presets: 2:3 (vertical), 4:5 (IG-ish), 9:16 (stories)
// Exports JPEG for smaller file sizes

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { canvasToFile } from '../../utils/cropExport';

/**
 * @typedef {'2:3' | '4:5' | '9:16' | '16:9' | '1:1'} AspectRatio
 */

/**
 * Convert ratio string to decimal
 * @param {AspectRatio} ratio
 * @returns {number}
 */
function ratioToNumber(ratio) {
  const [w, h] = ratio.split(':').map(Number);
  return w / h;
}

/**
 * @typedef {Object} CardCropProps
 * @property {File | string} file - File or image URL
 * @property {AspectRatio} [ratio='2:3'] - Aspect ratio preset
 * @property {number} [exportHeight=1400] - Target height in pixels for export
 * @property {() => void} onCancel - Cancel callback
 * @property {(file: File) => Promise<void> | void} onSave - Save callback (receives JPEG)
 * @property {boolean} [allowRatioChange=false] - Allow changing aspect ratio
 */

/**
 * Card crop component for creating images with fixed aspect ratios
 * - Exports JPEG for smaller file sizes
 * - High-quality canvas rendering
 * - Multiple aspect ratio presets
 */
export default function CardCrop({
  file,
  ratio = '2:3',
  exportHeight = 1400,
  onCancel,
  onSave,
  allowRatioChange = false
}) {
  const imgRef = useRef(null);
  const previewCanvasRef = useRef(null);

  const [currentRatio, setCurrentRatio] = useState(ratio);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const [saving, setSaving] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const aspect = ratioToNumber(currentRatio);

  // Available aspect ratio presets
  const ratioPresets = [
    { value: '2:3', label: '2:3 Vertical' },
    { value: '4:5', label: '4:5 Instagram' },
    { value: '9:16', label: '9:16 Stories' },
    { value: '16:9', label: '16:9 Landscape' },
    { value: '1:1', label: '1:1 Square' }
  ];

  // Initialize crop when image loads
  const onImageLoad = useCallback((e) => {
    const { naturalWidth: width, naturalHeight: height } = e.currentTarget;
    const initial = centerCrop(
      makeAspectCrop(
        { unit: '%', width: 90 }, // Start with 90% width of image
        aspect,
        width,
        height
      ),
      width,
      height
    );
    setCrop(initial);
    setImageLoaded(true);
  }, [aspect]);

  // Draw high-quality preview canvas as the user crops
  useEffect(() => {
    const image = imgRef.current;
    const canvas = previewCanvasRef.current;
    if (!image || !canvas || !completedCrop?.width || !completedCrop?.height) return;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = Math.floor(completedCrop.width * scaleX);
    canvas.height = Math.floor(completedCrop.height * scaleY);

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );
  }, [completedCrop]);

  // Handle aspect ratio change
  const handleRatioChange = (newRatio) => {
    setCurrentRatio(newRatio);
    setCrop(undefined); // Reset crop to trigger re-initialization
    setImageLoaded(false);
  };

  async function handleSave() {
    if (!previewCanvasRef.current) return;
    setSaving(true);
    try {
      const fileOut = await canvasToFile(previewCanvasRef.current, {
        type: 'image/jpeg',
        quality: 0.92,
        filename: `card_${Date.now()}.jpg`,
        maxSize: exportHeight, // Clamp tallest edge
      });
      await onSave(fileOut);
    } catch (error) {
      console.error('Card crop save error:', error);
      alert('Failed to save image. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 bg-white rounded-2xl max-w-6xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">
        Crop Image
      </h2>

      <div className="grid gap-6 md:grid-cols-[1fr,380px]">
        {/* Crop Area */}
        <div className="flex items-center justify-center bg-gray-50 rounded-xl p-4 min-h-[400px]">
          {!imageLoaded && (
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <svg className="animate-spin h-10 w-10" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm">Loading image...</p>
            </div>
          )}
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            ruleOfThirds
            keepSelection
            locked={false}
            minWidth={50}
            className={!imageLoaded ? 'hidden' : ''}
          >
            <img
              ref={imgRef}
              src={typeof file === 'string' ? file : URL.createObjectURL(file)}
              alt="Crop source"
              onLoad={onImageLoad}
              className="max-h-[70vh] object-contain"
              crossOrigin="anonymous"
            />
          </ReactCrop>
        </div>

        {/* Controls & Preview Sidebar */}
        <div className="space-y-6">
          {/* Aspect Ratio Info */}
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
            <div className="text-sm font-medium text-purple-900 mb-1">Current Ratio</div>
            <div className="text-2xl font-bold text-purple-600">{currentRatio}</div>
            <div className="text-xs text-purple-700 mt-1">
              Export height: ~{exportHeight}px
            </div>
          </div>

          {/* Aspect Ratio Presets */}
          {allowRatioChange && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 block">
                Aspect Ratio
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ratioPresets.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handleRatioChange(preset.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentRatio === preset.value
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview Canvas */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 block">
              Preview
            </label>
            <div className="bg-white border-2 border-gray-200 rounded-lg p-2">
              <canvas
                ref={previewCanvasRef}
                className="w-full rounded shadow-sm"
                style={{
                  display: completedCrop?.width ? 'block' : 'none'
                }}
                aria-label="Crop preview"
              />
              {!completedCrop?.width && (
                <div className="aspect-[2/3] flex items-center justify-center text-gray-400 text-sm">
                  Adjust crop area
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving || !completedCrop?.width}
              className="w-full px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </span>
              ) : (
                'Save Image'
              )}
            </button>
            <button
              onClick={onCancel}
              disabled={saving}
              className="w-full px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Helper Text */}
      <p className="text-xs text-gray-500 text-center mt-6">
        Drag corners to resize • Drag center to reposition • Output: JPEG ~90% quality
      </p>
    </div>
  );
}
