import React, { useState, useRef } from 'react';
import { Camera, X, Check } from 'lucide-react';
import { supabase } from '../utils/supabase-auth';
import { generateAvatar } from '../utils/avatarGenerator';
import toast from 'react-hot-toast';
import ImageCropModal from './media/ImageCropModal';

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

  const uploadAvatar = async (croppedImageUrl) => {
    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }

    setUploading(true);
    try {
      // Convert cropped image URL to blob
      const response = await fetch(croppedImageUrl);
      const croppedBlob = await response.blob();

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
        <ImageCropModal
          isOpen={showCropper}
          file={previewUrl}
          cropType="avatar"
          aspectRatio="1:1"
          allowRatioChange={false}
          onClose={() => {
            setShowCropper(false);
            setPreviewUrl(null);
            setOriginalFile(null);
          }}
          onSave={uploadAvatar}
        />
      )}
    </>
  );
};

export default AvatarUpload;