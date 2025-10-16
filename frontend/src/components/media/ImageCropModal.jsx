// src/components/media/ImageCropModal.jsx
// Unified modal wrapper for avatar and card cropping
// Routes to appropriate crop component based on cropType

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AvatarCrop from './AvatarCrop';
import CardCrop from './CardCrop';

/**
 * @typedef {Object} ImageCropModalProps
 * @property {boolean} isOpen - Whether modal is open
 * @property {() => void} onClose - Close callback
 * @property {File | string} file - Image file or URL to crop
 * @property {'avatar' | 'card'} cropType - Type of crop to perform
 * @property {string} [aspectRatio='2:3'] - Aspect ratio for card crop
 * @property {boolean} [allowRatioChange=false] - Allow changing aspect ratio for cards
 * @property {(file: File) => Promise<void>} onSave - Save callback
 */

/**
 * Unified image crop modal
 * - Handles avatar (circle) and card (aspect ratio) crops
 * - No transforms on modal content to prevent pointer offset bugs
 * - Opacity-only animations for stability
 */
export default function ImageCropModal({
  isOpen,
  onClose,
  file,
  cropType = 'avatar',
  aspectRatio = '2:3',
  allowRatioChange = false,
  onSave
}) {
  if (!isOpen || !file) return null;

  const handleSave = async (croppedFile) => {
    await onSave(croppedFile);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop - opacity animation only */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal Content - no transforms, opacity only */}
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-6xl"
              onClick={(e) => e.stopPropagation()}
            >
              {cropType === 'avatar' ? (
                <AvatarCrop
                  file={file}
                  onCancel={onClose}
                  onSave={handleSave}
                />
              ) : (
                <CardCrop
                  file={file}
                  ratio={aspectRatio}
                  allowRatioChange={allowRatioChange}
                  onCancel={onClose}
                  onSave={handleSave}
                />
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
