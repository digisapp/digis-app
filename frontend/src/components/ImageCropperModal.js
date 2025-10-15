import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, PhotoIcon, CameraIcon } from '@heroicons/react/24/outline';

const ImageCropperModal = ({ 
  isOpen, 
  onClose, 
  imageSrc, 
  onCropComplete, 
  aspectRatio = 1, 
  cropShape = 'rect',
  title = 'Crop Image',
  showPreview = true 
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [rotation, setRotation] = useState(0);

  const onCropChange = (crop) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom) => {
    setZoom(zoom);
  };

  const onRotationChange = (rotation) => {
    setRotation(rotation);
  };

  const onCropAreaComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getRadianAngle = (degreeValue) => {
    return (degreeValue * Math.PI) / 180;
  };

  const rotateSize = (width, height, rotation) => {
    const rotRad = getRadianAngle(rotation);
    return {
      width:
        Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
      height:
        Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
    };
  };

  const getCroppedImg = async (imageSrc, pixelCrop, rotation = 0) => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

    canvas.width = safeArea;
    canvas.height = safeArea;

    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.rotate(getRadianAngle(rotation));
    ctx.translate(-safeArea / 2, -safeArea / 2);

    ctx.drawImage(
      image,
      safeArea / 2 - image.width * 0.5,
      safeArea / 2 - image.height * 0.5
    );

    const data = ctx.getImageData(0, 0, safeArea, safeArea);

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.putImageData(
      data,
      0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x,
      0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('Canvas is empty');
          return;
        }
        blob.name = 'cropped.jpeg';
        const fileUrl = URL.createObjectURL(blob);
        resolve({ blob, url: fileUrl });
      }, 'image/jpeg', 0.95);
    });
  };

  const handleSave = async () => {
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      onCropComplete(croppedImage);
      onClose();
    } catch (e) {
      console.error('Error cropping image:', e);
    }
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl z-[10000] overflow-y-auto overflow-x-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <CameraIcon className="w-6 h-6" />
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Cropper Area */}
              <div className="relative h-64 sm:h-80 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={aspectRatio}
                  cropShape={cropShape}
                  onCropChange={onCropChange}
                  onCropComplete={onCropAreaComplete}
                  onZoomChange={onZoomChange}
                  onRotationChange={onRotationChange}
                  showGrid={false}
                  style={{
                    containerStyle: {
                      backgroundColor: '#1f2937'
                    }
                  }}
                />
              </div>

              {/* Controls */}
              <div className="space-y-4">
                {/* Zoom Control */}
                <div className="space-y-2">
                  <label className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
                    <span>Zoom</span>
                    <span className="text-xs text-gray-500">{(zoom * 100).toFixed(0)}%</span>
                  </label>
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.05}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 
                               [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                               [&::-webkit-slider-thumb]:bg-purple-600 [&::-webkit-slider-thumb]:rounded-full 
                               [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-purple-700"
                  />
                </div>

                {/* Rotation Control */}
                <div className="space-y-2">
                  <label className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
                    <span>Rotation</span>
                    <span className="text-xs text-gray-500">{rotation}°</span>
                  </label>
                  <input
                    type="range"
                    value={rotation}
                    min={-180}
                    max={180}
                    step={1}
                    onChange={(e) => setRotation(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 
                               [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                               [&::-webkit-slider-thumb]:bg-purple-600 [&::-webkit-slider-thumb]:rounded-full 
                               [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-purple-700"
                  />
                </div>

                {/* Aspect Ratio Info */}
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    {aspectRatio === 1 ? (
                      <>
                        <PhotoIcon className="inline w-4 h-4 mr-1" />
                        Square format (1:1) - Perfect for profile pictures
                      </>
                    ) : (
                      <>
                        <PhotoIcon className="inline w-4 h-4 mr-1" />
                        Custom format ({aspectRatio.toFixed(2)})
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 
                           dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Reset
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 
                             border border-gray-300 dark:border-gray-600 rounded-lg 
                             hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r 
                             from-purple-600 to-pink-600 rounded-lg hover:from-purple-700 
                             hover:to-pink-700 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    Apply Crop
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ImageCropperModal;