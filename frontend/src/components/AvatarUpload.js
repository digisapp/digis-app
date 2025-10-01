import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Check, RotateCw } from 'lucide-react';
import { supabase } from '../utils/supabase-auth';
import { generateAvatar } from '../utils/avatarGenerator';
import toast from 'react-hot-toast';

const AvatarUpload = ({ 
  user, 
  currentAvatar, 
  onAvatarUpdate, 
  size = 150,
  editable = true,
  className = "" 
}) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [originalFile, setOriginalFile] = useState(null);
  const fileInputRef = useRef(null);

  // Generate fallback avatar
  const fallbackAvatar = generateAvatar(
    user?.username || user?.display_name || 'User',
    user?.creator_type,
    size * 2, // Higher res for quality
    'circle'
  );

  const displayAvatar = previewUrl || currentAvatar || fallbackAvatar;

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setOriginalFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async (croppedBlob) => {
    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }

    setUploading(true);
    try {
      // Create unique filename
      const fileExt = originalFile.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(filePath, croppedBlob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(filePath);

      // Update user profile in database
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          profile_pic_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('supabase_id', user.id);

      if (updateError) throw updateError;

      // Call parent callback
      if (onAvatarUpdate) {
        onAvatarUpdate(publicUrl);
      }

      toast.success('Profile picture updated successfully!');
      setShowCropper(false);
      setPreviewUrl(null);
      setOriginalFile(null);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user?.id || !currentAvatar) return;

    try {
      // Update database to remove avatar
      const { error } = await supabase
        .from('users')
        .update({ 
          profile_pic_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('supabase_id', user.id);

      if (error) throw error;

      if (onAvatarUpdate) {
        onAvatarUpdate(null);
      }

      toast.success('Profile picture removed');
    } catch (error) {
      console.error('Error removing avatar:', error);
      toast.error('Failed to remove profile picture');
    }
  };

  return (
    <>
      <div className={`relative inline-block ${className}`}>
        <div 
          className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 to-pink-500/10"
          style={{
            width: size,
            height: size,
            borderRadius: '50%'
          }}
        >
          <img
            src={displayAvatar}
            alt={user?.username || 'Avatar'}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src = fallbackAvatar;
            }}
          />
          
          {editable && (
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-white/90 rounded-full hover:bg-white transition-colors"
                disabled={uploading}
              >
                <Camera className="w-5 h-5 text-gray-800" />
              </button>
              {currentAvatar && (
                <button
                  onClick={handleRemoveAvatar}
                  className="p-3 bg-red-500/90 rounded-full hover:bg-red-500 transition-colors ml-2"
                  disabled={uploading}
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Online indicator */}
        {user?.is_online && (
          <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
        )}

        {/* Verified badge */}
        {user?.is_verified && (
          <div className="absolute top-0 right-0 bg-blue-500 rounded-full p-1">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Image Cropper Modal */}
      {showCropper && previewUrl && (
        <ImageCropperModal
          imageUrl={previewUrl}
          onCrop={uploadAvatar}
          onCancel={() => {
            setShowCropper(false);
            setPreviewUrl(null);
            setOriginalFile(null);
          }}
          uploading={uploading}
        />
      )}
    </>
  );
};

// Image Cropper Modal Component
const ImageCropperModal = ({ imageUrl, onCrop, onCancel, uploading }) => {
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, size: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [rotation, setRotation] = useState(0);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  const handleCrop = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    const size = 400; // Output size
    canvas.width = size;
    canvas.height = size;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Save context state
    ctx.save();

    // Apply rotation
    if (rotation !== 0) {
      ctx.translate(size / 2, size / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-size / 2, -size / 2);
    }

    // Create circular clipping path
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Calculate source rectangle
    const scale = image.naturalWidth / image.width;
    const sx = cropArea.x * scale;
    const sy = cropArea.y * scale;
    const sSize = cropArea.size * scale;

    // Draw image
    ctx.drawImage(
      image,
      sx, sy, sSize, sSize,
      0, 0, size, size
    );

    // Restore context
    ctx.restore();

    // Convert to blob and upload
    canvas.toBlob((blob) => {
      if (blob) {
        onCrop(blob);
      }
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Crop Profile Picture
          </h3>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden mb-4" style={{ height: '400px' }}>
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Crop preview"
            className="max-w-full max-h-full mx-auto"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: 'transform 0.3s ease'
            }}
          />
          
          {/* Crop overlay */}
          <div 
            className="absolute border-2 border-white shadow-lg rounded-full cursor-move"
            style={{
              left: cropArea.x,
              top: cropArea.y,
              width: cropArea.size,
              height: cropArea.size,
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }}
            onMouseDown={() => setIsDragging(true)}
          >
            <div className="absolute inset-0 border-2 border-dashed border-white/50 rounded-full" />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setRotation((r) => r - 90)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            <RotateCw className="w-4 h-4" />
            Rotate
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Size:</span>
            <input
              type="range"
              min="100"
              max="300"
              value={cropArea.size}
              onChange={(e) => setCropArea(prev => ({ ...prev, size: parseInt(e.target.value) }))}
              className="w-32"
            />
          </div>
        </div>

        {/* Hidden canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            onClick={handleCrop}
            disabled={uploading}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Apply & Upload
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvatarUpload;