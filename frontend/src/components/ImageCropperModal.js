import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  const [ready, setReady] = useState(false);
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const onCropChange = (crop) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom) => {
    setZoom(zoom);
  };

  const onRotationChange = (rotation) => {
    setRotation(rotation);
  };

  // Lock body scroll while modal is open (iOS/Safari friendly)
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Observe container to compute an explicit cropSize (prevents top-left "stuck" bug)
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const cr = entry.contentRect;
      setContainerSize({ w: cr.width, h: cr.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [isOpen]);

  const cropSize = React.useMemo(() => {
    const s = Math.round(Math.min(containerSize.w, containerSize.h) * 0.9); // 90% of the shortest side
    return s > 0 ? { width: s, height: s } : undefined;
  }, [containerSize]);

  const onCropAreaComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const onMediaLoaded = useCallback(({ naturalWidth, naturalHeight }) => {
    // Center
    setCrop({ x: 0, y: 0 });
    // Fit image into the computed cropSize
    if (cropSize) {
      const fitW = cropSize.width / naturalWidth;
      const fitH = cropSize.height / naturalHeight;
      const fit = Math.max(fitW, fitH); // ensure the crop area is fully covered
      setZoom(Math.max(1, Number(fit.toFixed(3))));
    } else {
      setZoom(1);
    }
  }, [cropSize]);

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

    // draw rotated image to a large temp area
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

    // Respect device pixel ratio for crisp avatars
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    canvas.width = Math.floor(pixelCrop.width * dpr);
    canvas.height = Math.floor(pixelCrop.height * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform

    ctx.putImageData(
      data,
      Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x) * dpr,
      Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y) * dpr
    );

    // If round avatar requested, mask to a circle and export PNG (transparent)
    if (cropShape === 'round') {
      const circleCanvas = document.createElement('canvas');
      const cctx = circleCanvas.getContext('2d');
      circleCanvas.width = canvas.width;
      circleCanvas.height = canvas.height;

      // Draw circular mask
      cctx.save();
      cctx.beginPath();
      cctx.arc(circleCanvas.width / 2, circleCanvas.height / 2, Math.min(circleCanvas.width, circleCanvas.height) / 2, 0, Math.PI * 2);
      cctx.closePath();
      cctx.clip();
      cctx.drawImage(canvas, 0, 0);
      cctx.restore();

      return new Promise((resolve) => {
        circleCanvas.toBlob((blob) => {
          if (!blob) {
            console.error('Canvas is empty');
            return;
          }
          const file = new File([blob], 'avatar.png', { type: 'image/png' });
          const fileUrl = URL.createObjectURL(file);
          resolve({ blob: file, url: fileUrl });
        }, 'image/png');
      });
    }

    // Otherwise export high-quality JPEG rectangle
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('Canvas is empty');
          return;
        }
        const file = new File([blob], 'cropped.jpeg', { type: 'image/jpeg' });
        const fileUrl = URL.createObjectURL(file);
        resolve({ blob: file, url: fileUrl });
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

          {/* Modal Wrapper - NO transforms to avoid breaking cropper positioning */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onAnimationComplete={() => {
              setReady(true);
              // Force react-easy-crop to recompute layout (iOS Safari)
              window.requestAnimationFrame(() => {
                window.dispatchEvent(new Event('resize'));
              });
            }}
            className="fixed inset-0 z-[10000] grid place-items-center"
          >
            <div className="w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-y-auto overflow-x-hidden"
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
              <div
                ref={containerRef}
                className="relative h-64 sm:h-80 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden"
              >
                {ready && (
                  <Cropper
                    key={imageSrc}
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    rotation={rotation}
                    aspect={aspectRatio}
                    cropShape={cropShape}
                    cropSize={cropSize}
                    onCropChange={onCropChange}
                    onCropComplete={onCropAreaComplete}
                    onZoomChange={onZoomChange}
                    onRotationChange={onRotationChange}
                    onMediaLoaded={onMediaLoaded}
                    showGrid={false}
                    objectFit="contain"
                    style={{
                      containerStyle: {
                        backgroundColor: '#1f2937',
                        touchAction: 'none',
                        pointerEvents: 'auto'
                      }
                    }}
                  />
                )}
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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ImageCropperModal;