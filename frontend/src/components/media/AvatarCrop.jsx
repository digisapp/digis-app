// src/components/media/AvatarCrop.jsx
// Circle avatar cropper using react-avatar-editor
// Always renders to a square canvas with borderRadius for circle display
// Exports as PNG to preserve transparent corners

import React, { useMemo, useRef, useState } from 'react';
import AvatarEditor from 'react-avatar-editor';
import { canvasToFile, getClampedDPR } from '../../utils/cropExport';

/**
 * @typedef {Object} AvatarCropProps
 * @property {File | string} file - File or image URL
 * @property {number} [initialZoom=1.2] - Initial zoom level (1 = no zoom)
 * @property {number} [size=320] - Viewport size in pixels
 * @property {() => void} onCancel - Cancel callback
 * @property {(file: File) => Promise<void> | void} onSave - Save callback (receives PNG file)
 */

/**
 * Avatar crop component for creating circular profile pictures
 * - Always exports square PNG with transparent corners
 * - Clamped DPR for predictable file sizes
 * - Zoom and rotation controls
 */
export default function AvatarCrop({
  file,
  initialZoom = 1.2,
  size = 320,
  onCancel,
  onSave
}) {
  const editorRef = useRef(null);
  const [scale, setScale] = useState(initialZoom);
  const [rotation, setRotation] = useState(0);
  const [saving, setSaving] = useState(false);

  // Cap DPR for predictable files (avoid 4K exports on retina displays)
  const dpr = useMemo(() => getClampedDPR(2), []);

  async function handleSave() {
    if (!editorRef.current) return;
    setSaving(true);
    try {
      const canvas = editorRef.current.getImageScaledToCanvas();
      const fileOut = await canvasToFile(canvas, {
        type: 'image/png',
        filename: `avatar_${Date.now()}.png`,
        maxSize: 512, // Sane cap for avatars
      });
      await onSave(fileOut);
    } catch (error) {
      console.error('Avatar crop save error:', error);
      alert('Failed to save avatar. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 bg-white rounded-2xl max-w-md mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">
        Crop Avatar
      </h2>

      <div className="flex flex-col items-center gap-6">
        {/* Avatar Editor with circular border */}
        <div className="relative">
          <AvatarEditor
            ref={editorRef}
            image={file}
            width={size}
            height={size}
            border={20}
            borderRadius={size / 2} // Makes it circular
            color={[0, 0, 0, 0.4]} // Dim edge overlay
            scale={scale}
            rotate={rotation}
            crossOrigin="anonymous"
            imageSmoothingEnabled={true}
            imageSmoothingQuality="high"
            pixelRatio={dpr}
            className="rounded-full shadow-lg"
          />
        </div>

        {/* Zoom Control */}
        <div className="w-full space-y-2">
          <label className="flex items-center justify-between text-sm font-medium text-gray-700">
            <span>Zoom</span>
            <span className="text-gray-500">{scale.toFixed(2)}x</span>
          </label>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
          />
        </div>

        {/* Rotation Control */}
        <div className="w-full space-y-2">
          <label className="flex items-center justify-between text-sm font-medium text-gray-700">
            <span>Rotate</span>
            <span className="text-gray-500">{rotation}°</span>
          </label>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={rotation}
            onChange={(e) => setRotation(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 w-full pt-4 border-t border-gray-200">
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              'Save Avatar'
            )}
          </button>
        </div>
      </div>

      {/* Helper Text */}
      <p className="text-xs text-gray-500 text-center mt-4">
        Drag to reposition • Scroll to zoom • Output: {size}×{size}px PNG
      </p>
    </div>
  );
}
