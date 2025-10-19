import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase-auth.js';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from './ui/Avatar';
import AvatarUpload from './AvatarUpload';
import avatarService from '../services/avatarService';
import { generateAvatarBlob } from '../utils/avatarGenerator';
import {
  UserCircleIcon,
  CameraIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  CogIcon,
  ShieldCheckIcon,
  BellIcon,
  KeyIcon,
  SparklesIcon,
  UserGroupIcon,
  LinkIcon,
  PhotoIcon,
  GlobeAltIcon,
  LockClosedIcon,
  UserMinusIcon,
  ClockIcon,
  LanguageIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  XMarkIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import CreatorSubscriptionSimple from './CreatorSubscriptionSimple';
import ImageCropModal from './media/ImageCropModal';
import { uploadAvatar } from '../services/imageUploadService';
import toast from 'react-hot-toast';

// Upload profile image to backend
const uploadProfileImage = async (file, userId) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/upload-profile-image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token}`
    },
    body: formData
  });
  
  if (!response.ok) {
    throw new Error('Failed to upload image');
  }
  
  const data = await response.json();
  return data.url;
};

const ImprovedProfile = ({ user, isCreator: propIsCreator, onProfileUpdate, setCurrentView, setViewingCreator }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [showChangePassword, setShowChangePassword] = useState(false);
  
  // Use prop to determine if user is creator (don't allow toggling in profile)
  const isCreator = propIsCreator || false;

  // Determine tabs based on whether user is a creator
  const tabs = isCreator ? [
    { id: 'profile', label: 'Profile Settings', icon: UserCircleIcon },
    { id: 'subscriptions', label: 'Subscriptions', icon: SparklesIcon }
  ] : [
    { id: 'profile', label: 'Profile Settings', icon: UserCircleIcon }
  ];
  
  // Basic profile state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [pic, setPic] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [creatorType, setCreatorType] = useState('');
  const [interests, setInterests] = useState([]);
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [socialLinks, setSocialLinks] = useState({
    instagram: '',
    twitter: '',
    youtube: '',
    tiktok: ''
  });
  
  // Image cropper state
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState(null);
  const [cropperMode, setCropperMode] = useState('profile'); // 'profile', 'banner'
  const [cropAspectRatio, setCropAspectRatio] = useState(1);
  
  // Settings state
  const [notificationPrefs, setNotificationPrefs] = useState({
    emailNotifications: true,
    pushNotifications: true,
    messageAlerts: true,
    streamAlerts: true
  });
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: 'public',
    messagePrivacy: 'everyone',
    showOnlineStatus: true
  });
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('America/New_York');
  
  // Creator-specific settings
  const [availabilitySchedule, setAvailabilitySchedule] = useState({
    monday: { available: true, start: '09:00', end: '17:00' },
    tuesday: { available: true, start: '09:00', end: '17:00' },
    wednesday: { available: true, start: '09:00', end: '17:00' },
    thursday: { available: true, start: '09:00', end: '17:00' },
    friday: { available: true, start: '09:00', end: '17:00' },
    saturday: { available: false, start: '09:00', end: '17:00' },
    sunday: { available: false, start: '09:00', end: '17:00' }
  });
  const [autoResponseMessage, setAutoResponseMessage] = useState('');
  const [analyticsVisibility, setAnalyticsVisibility] = useState('public');
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  
  // Creator-specific pricing state (only for creators)
  const [streamPrice, setStreamPrice] = useState(5);
  const [videoPrice, setVideoPrice] = useState(8);
  const [voicePrice, setVoicePrice] = useState(6);
  const [messagePrice, setMessagePrice] = useState(2);
  
  // Creator messaging pricing
  const [textMessagePrice, setTextMessagePrice] = useState(1);
  const [imageMessagePrice, setImageMessagePrice] = useState(3);
  const [videoMessagePrice, setVideoMessagePrice] = useState(5);
  const [voiceMemoPrice, setVoiceMemoPrice] = useState(2);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const [previewBanner, setPreviewBanner] = useState('');
  const [stats, setStats] = useState({
    totalViews: 0,
    totalLikes: 0,
    totalFollowers: 0
  });
  
  // Refs for throttling
  const loadingRef = useRef(false);
  const lastLoadTimeRef = useRef(0);

  useEffect(() => {
    if (user && user.id) {
      // Throttle API calls - min 2 seconds between calls
      const now = Date.now();
      const timeSinceLastLoad = now - lastLoadTimeRef.current;
      
      if (!loadingRef.current && timeSinceLastLoad >= 2000) {
        loadProfile();
      }
    }
  }, [user?.id]); // Only depend on user ID, not the entire object
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const loadProfile = async () => {
    if (!user || !user.id) {
      console.error('No user provided to Profile component');
      return;
    }
    
    // Prevent concurrent calls
    if (loadingRef.current) {
      console.log('⏳ Profile load already in progress, skipping...');
      return;
    }
    
    loadingRef.current = true;
    lastLoadTimeRef.current = Date.now();
    setLoading(true);
    setError('');
    
    try {
      console.log('🔄 Loading profile for user:', user.id);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/users/profile?uid=${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Profile loaded:', data);
        setDisplayName(data.display_name || data.full_name || '');
        setBio(data.bio || '');
        setPic(data.profile_pic_url || '');
        setBannerUrl(data.banner_url || '');
        setUsername(data.username || '');
        setCreatorType(data.creator_type || '');
        setInterests(data.interests || []);
        setState(data.state || '');
        setCountry(data.country || '');
        setPreviewImage(data.profile_pic_url || '');
        setPreviewBanner(data.banner_url || '');
        setSocialLinks(data.social_links || {
          instagram: '',
          twitter: '',
          youtube: '',
          tiktok: ''
        });
        
        // Mock stats for now
        setStats({
          totalViews: data.total_views || 1234,
          totalLikes: data.total_likes || 567,
          totalFollowers: data.total_followers || 89
        });
        
        // Only load pricing if user is actually a creator
        if (isCreator) {
          setStreamPrice(data.stream_price || 5);
          setVideoPrice(data.video_price || 8);
          setVoicePrice(data.voice_price || 6);
          setMessagePrice(data.message_price || 2);
          setTextMessagePrice(data.text_message_price || 1);
          setImageMessagePrice(data.image_message_price || 3);
          setVideoMessagePrice(data.video_message_price || 5);
          setVoiceMemoPrice(data.voice_memo_price || 2);
        }
      } else {
        console.log('ℹ️ No existing profile found');
      }
    } catch (error) {
      console.error('❌ Error loading profile:', error);
      // Silently handle error without showing to user
      setError('');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  const validateProfile = () => {
    // Creator-specific validation
    if (isCreator && (streamPrice <= 0 || videoPrice <= 0 || voicePrice <= 0 || messagePrice <= 0 || 
                      textMessagePrice <= 0 || imageMessagePrice <= 0 || videoMessagePrice <= 0 || voiceMemoPrice <= 0)) {
      setError('All prices must be greater than 0 for creators');
      return false;
    }
    
    // Interests validation for creators
    if (isCreator && interests.length === 0) {
      setError('Please select at least one category that defines you');
      return false;
    }
    
    if (interests.length > 4) {
      setError('Please select up to 4 categories only');
      return false;
    }
    
    // General validation
    if (bio.length > 500) {
      setError('About section must be less than 500 characters');
      return false;
    }
    
    if (pic && !isValidUrl(pic)) {
      setError('Invalid profile picture URL');
      return false;
    }
    
    // Username is required for all users
    if (!username || username.trim().length === 0) {
      setError('Username is required');
      return false;
    }
    
    if (username.length < 3 || username.length > 50) {
      setError('Username must be between 3 and 50 characters');
      return false;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username can only contain letters, numbers, and underscores');
      return false;
    }
    
    return true;
  };

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleImageUpload = async (e, imageType = 'profile') => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a JPG, PNG, GIF, or WebP image.');
      return;
    }

    // Validate file size
    const maxSize = imageType === 'banner' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`Image is too large. Max size is ${imageType === 'banner' ? '10MB' : '5MB'}.`);
      return;
    }

    // Read file and open cropper
    const reader = new FileReader();
    reader.onloadend = () => {
      setTempImageSrc(reader.result);
      setCropperMode(imageType);
      
      // Set aspect ratio based on image type
      if (imageType === 'profile') {
        setCropAspectRatio(1); // Square for profile
      } else if (imageType === 'card') {
        setCropAspectRatio(4/5); // Portrait for creator card
      } else if (imageType === 'banner') {
        setCropAspectRatio(3/1); // Wide for banner
      }
      
      setShowImageCropper(true);
    };
    reader.readAsDataURL(file);
  };
  
  const handleCroppedImage = async (croppedFile) => {
    setSaving(true);
    setError('');

    try {
      // New API returns File directly, no need to convert
      const downloadURL = await uploadAvatar(croppedFile);

      // Update local UI first
      if (cropperMode === 'profile') {
        setPic(downloadURL);
        setPreviewImage(downloadURL);
        toast.success('Profile picture updated!');
      } else {
        setBannerUrl(downloadURL);
        setPreviewBanner(downloadURL);
        toast.success('Banner image updated!');
      }

      // Auto-save the profile
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      // IMPORTANT: avoid state races — use the latest values explicitly
      const nextProfilePicUrl = (cropperMode === 'profile') ? downloadURL : (pic || '');
      const nextBannerUrl = (cropperMode === 'banner') ? downloadURL : (bannerUrl || '');
      const profileData = {
        uid: user.id,
        email: user.email,
        username: username.trim() || user.email.split('@')[0],
        display_name: displayName,
        bio: bio.trim(),
        profile_pic_url: nextProfilePicUrl,
        banner_url: nextBannerUrl,
        is_creator: isCreator,
        social_links: socialLinks
      };

      // Add creator-specific fields if user is a creator
      if (isCreator) {
        profileData.creator_type = creatorType || 'Other';
        profileData.stream_price = parseFloat(streamPrice) || 5;
        profileData.video_price = parseFloat(videoPrice) || 8;
        profileData.voice_price = parseFloat(voicePrice) || 6;
        profileData.message_price = parseFloat(messagePrice) || 2;
        profileData.text_message_price = parseFloat(textMessagePrice) || 1;
        profileData.image_message_price = parseFloat(imageMessagePrice) || 3;
        profileData.video_message_price = parseFloat(videoMessagePrice) || 5;
        profileData.voice_memo_price = parseFloat(voiceMemoPrice) || 2;
      }

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });

      if (response.ok) {
        setSuccess('Profile picture updated successfully!');
        setTimeout(() => setSuccess(''), 3000);
        await loadProfile(); // Reload to get updated data
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save profile picture');
        // Revert on error
        if (cropperMode === 'profile') {
          setPic('');
          setPreviewImage('');
        } else {
          setBannerUrl('');
          setPreviewBanner('');
        }
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setError('Failed to upload image');
      // Revert on error
      if (cropperMode === 'profile') {
        setPic('');
        setPreviewImage('');
      } else {
        setBannerUrl('');
        setPreviewBanner('');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a JPG, PNG, GIF, or WebP image.');
      return;
    }

    // Validate file size (max 10MB for banners)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Banner image is too large. Max size is 10MB.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('Uploading banner...');

    try {
      // Upload banner image
      const downloadURL = await uploadProfileImage(file, user.id);

      // Correct setter name + instant preview
      setBannerUrl(downloadURL);
      setPreviewBanner(downloadURL);
      setSuccess('Banner uploaded successfully!');

      // Don't auto-save, let user save manually
      setTimeout(() => setSuccess(''), 3000);
      return;
    } catch (error) {
      console.error('Error uploading banner:', error);
      setError('Failed to upload banner image');
      // Revert banner on error
      setBannerUrl('');
      setPreviewBanner('');
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    console.log('💾 Saving profile with data:', {
      username,
      displayName,
      bio,
      creatorType,
      interests,
      isCreator,
      pic,
      bannerUrl,
      socialLinks
    });

    if (!validateProfile()) {
      setSaving(false);
      return;
    }

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const profileData = {
        uid: user.id,
        email: user.email,
        username: username.trim(),
        display_name: displayName,
        bio: bio.trim(),
        profile_pic_url: pic,
        banner_url: bannerUrl,
        is_creator: isCreator,
        social_links: socialLinks,
        state: state.trim(),
        country: country.trim()
      };

      // Add creator-specific fields
      if (isCreator) {
        profileData.creator_type = creatorType || interests[0] || 'Other';
        profileData.interests = interests;
        profileData.stream_price = parseFloat(streamPrice);
        profileData.video_price = parseFloat(videoPrice);
        profileData.voice_price = parseFloat(voicePrice);
        profileData.message_price = parseFloat(messagePrice);
        profileData.text_message_price = parseFloat(textMessagePrice);
        profileData.image_message_price = parseFloat(imageMessagePrice);
        profileData.video_message_price = parseFloat(videoMessagePrice);
        profileData.voice_memo_price = parseFloat(voiceMemoPrice);
      }

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });

      if (response.ok) {
        setSuccess('Profile updated successfully!');
        setTimeout(() => setSuccess(''), 3000);
        await loadProfile(); // Reload to get updated data
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save profile');
      }
    } catch (error) {
      console.error('❌ Error saving profile:', error);
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Early return if no user
  if (!user || !user.id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <UserCircleIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Please sign in to view your profile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="max-w-6xl mx-auto">
        {/* Enhanced Profile Header with Banner */}
        <div className="relative">
          {/* Banner Section */}
          <div className="relative h-64 md:h-80 bg-gradient-to-r from-purple-400 to-pink-400 overflow-hidden">
            {(previewBanner || bannerUrl) ? (
              <img
                src={previewBanner || bannerUrl}
                alt="Profile Banner"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 animate-gradient-x" />
            )}
            
            {/* Banner Upload Button - Moved to top right to avoid overlap */}
            {isCreator && (
              <div className="absolute top-4 right-4">
                <label className={`cursor-pointer bg-white/90 dark:bg-gray-700/90 backdrop-blur hover:bg-white dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {saving ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <CameraIcon className="w-5 h-5" />
                      <span>Change Banner</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBannerUpload}
                    className="hidden"
                    disabled={saving}
                    id="banner-upload"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Profile Info Overlay */}
          <div className="relative px-6 pb-6">
            <div className="flex flex-col md:flex-row items-start md:items-end -mt-20">
              {/* Profile Picture */}
              <div className="relative mb-4 md:mb-0">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white shadow-xl overflow-hidden">
                  <AvatarUpload
                    user={{
                      id: user?.id,
                      username: username || user?.email,
                      display_name: displayName,
                      creator_type: creatorType
                    }}
                    currentAvatar={pic}
                    onAvatarUpdate={(newAvatarUrl) => {
                      setPic(newAvatarUrl || '');
                      // Auto-save on avatar update
                      if (onProfileUpdate) {
                        onProfileUpdate();
                      }
                    }}
                    size={160}
                    editable={isCreator}
                    className=""
                  />
                </div>
              </div>

              {/* Name and Stats */}
              <div className="flex-1 md:ml-6">
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded-xl p-4 shadow-lg">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-3">
                    <div>
                      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
                        {displayName || username || 'Your Name'}
                      </h1>
                      <p className="text-gray-600">@{username || 'username'}</p>
                    </div>
                  </div>
                  
                  {/* Creator Stats */}
                  {isCreator && (
                    <div className="flex flex-wrap gap-4 text-sm mt-3">
                      <div className="flex items-center gap-1">
                        <UserGroupIcon className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{stats.totalFollowers}</span>
                        <span className="text-gray-500">followers</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-6 pb-6">
          {/* Tab Navigation */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6">
            <nav className="flex flex-wrap">
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-all relative ${
                    activeTab === tab.id
                      ? 'text-purple-600'
                      : 'text-gray-500 hover:text-gray-700'
                  } ${
                    index !== tabs.length - 1 ? 'border-r border-gray-200' : ''
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"
                    />
                  )}
                </button>
              ))}
              
              {/* View Profile Button for Creators */}
              {isCreator && username && (
                <button
                  onClick={() => {
                    // Navigate to the creator's public profile page
                    if (setViewingCreator) {
                      setViewingCreator(username);
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-4 font-medium text-sm transition-all relative text-gray-500 hover:text-gray-700 border-l border-gray-200 ml-auto"
                >
                  <EyeIcon className="w-5 h-5" />
                  View Public Profile
                </button>
              )}
            </nav>
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >

                {/* Status Messages */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"
                    >
                      <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <span className="text-red-700">{error}</span>
                    </motion.div>
                  )}

                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3"
                    >
                      <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-green-700">{success}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid gap-6">
                  {/* View Profile Button Section - Removed duplicate - now in tab navigation */}

                  {/* Basic Information */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
                  >
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                      <UserCircleIcon className="w-5 h-5 text-purple-600" />
                      Basic Information
                    </h3>

                    <div className="space-y-6">
                      {/* Username */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Username <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => {
                              setUsername(e.target.value);
                              clearMessages();
                            }}
                            placeholder="Choose a unique username"
                            maxLength={50}
                            required
                            className="w-full h-10 pl-10 pr-4 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-medium">@</span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                          This is your unique identifier on the platform
                        </p>
                      </div>

                      {/* Full Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => {
                            setDisplayName(e.target.value);
                            clearMessages();
                          }}
                          placeholder="Your display name"
                          className="w-full h-10 px-4 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        />
                      </div>

                      {/* Categories for Creators - Compact Dropdown */}
                      {isCreator && (
                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Categories <span className="text-red-500">*</span>
                            <span className="text-xs text-gray-500 ml-2">(Select up to 4)</span>
                          </label>
                          
                          {/* Selected Categories Display */}
                          <div className="mb-2">
                            {interests.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {interests.map(interest => {
                                  const category = [
                                    { value: 'Gaming', icon: '🎮', label: 'Gaming' },
                                    { value: 'Music', icon: '🎵', label: 'Music' },
                                    { value: 'Art', icon: '🎨', label: 'Art' },
                                    { value: 'Model', icon: '👗', label: 'Model' },
                                    { value: 'Fitness', icon: '💪', label: 'Fitness' },
                                    { value: 'Cooking', icon: '👨‍🍳', label: 'Cooking' },
                                    { value: 'Dance', icon: '💃', label: 'Dance' },
                                    { value: 'Comedy', icon: '😄', label: 'Comedy' },
                                    { value: 'Education', icon: '📚', label: 'Education' },
                                    { value: 'Lifestyle', icon: '✨', label: 'Lifestyle' },
                                    { value: 'Fashion', icon: '👠', label: 'Fashion' },
                                    { value: 'Tech', icon: '💻', label: 'Tech' },
                                    { value: 'Sports', icon: '⚽', label: 'Sports' },
                                    { value: 'Travel', icon: '✈️', label: 'Travel' },
                                    { value: 'Beauty', icon: '💄', label: 'Beauty' },
                                    { value: 'Business', icon: '💼', label: 'Business' },
                                    { value: 'Wellness', icon: '🧘', label: 'Wellness' },
                                    { value: 'ASMR', icon: '🎧', label: 'ASMR' }
                                  ].find(c => c.value === interest);
                                  return (
                                    <span
                                      key={interest}
                                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm"
                                    >
                                      <span>{category?.icon}</span>
                                      <span>{category?.label || interest}</span>
                                      <button
                                        type="button"
                                        onClick={() => setInterests(interests.filter(i => i !== interest))}
                                        className="ml-1 hover:text-purple-900 dark:hover:text-purple-100"
                                      >
                                        <XMarkIcon className="w-3 h-3" />
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 dark:text-gray-400 italic">No categories selected</p>
                            )}
                          </div>
                          
                          {/* Dropdown Selector */}
                          <div className="relative">
                            <select
                              value=""
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value && !interests.includes(value)) {
                                  if (interests.length < 4) {
                                    setInterests([...interests, value]);
                                    setError('');
                                  } else {
                                    setError('You can only select up to 4 categories');
                                    setTimeout(() => setError(''), 3000);
                                  }
                                }
                              }}
                              className="w-full px-4 py-3 pr-10 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                              disabled={interests.length >= 4}
                            >
                              <option value="">Select a category...</option>
                              {[
                                { value: 'Gaming', icon: '🎮', label: 'Gaming' },
                                { value: 'Music', icon: '🎵', label: 'Music' },
                                { value: 'Art', icon: '🎨', label: 'Art' },
                                { value: 'Model', icon: '👗', label: 'Model' },
                                { value: 'Fitness', icon: '💪', label: 'Fitness' },
                                { value: 'Cooking', icon: '👨‍🍳', label: 'Cooking' },
                                { value: 'Dance', icon: '💃', label: 'Dance' },
                                { value: 'Comedy', icon: '😄', label: 'Comedy' },
                                { value: 'Education', icon: '📚', label: 'Education' },
                                { value: 'Lifestyle', icon: '✨', label: 'Lifestyle' },
                                { value: 'Fashion', icon: '👠', label: 'Fashion' },
                                { value: 'Tech', icon: '💻', label: 'Tech' },
                                { value: 'Sports', icon: '⚽', label: 'Sports' },
                                { value: 'Travel', icon: '✈️', label: 'Travel' },
                                { value: 'Beauty', icon: '💄', label: 'Beauty' },
                                { value: 'Business', icon: '💼', label: 'Business' },
                                { value: 'Wellness', icon: '🧘', label: 'Wellness' },
                                { value: 'ASMR', icon: '🎧', label: 'ASMR' }
                              ].filter(category => !interests.includes(category.value))
                              .map(category => (
                                <option key={category.value} value={category.value}>
                                  {category.icon} {category.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                          </div>
                          
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            {interests.length}/4 categories selected
                          </p>
                        </div>
                      )}

                      {/* Location Fields for Creators */}
                      {isCreator && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              State/Province
                            </label>
                            <input
                              type="text"
                              value={state}
                              onChange={(e) => {
                                setState(e.target.value);
                                clearMessages();
                              }}
                              placeholder="e.g., Florida"
                              className="w-full h-10 px-4 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Country
                            </label>
                            <input
                              type="text"
                              value={country}
                              onChange={(e) => {
                                setCountry(e.target.value);
                                clearMessages();
                              }}
                              placeholder="e.g., USA"
                              className="w-full h-10 px-4 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            />
                          </div>
                        </div>
                      )}

                      {/* About */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          About
                        </label>
                        <textarea
                          value={bio}
                          onChange={(e) => {
                            setBio(e.target.value);
                            clearMessages();
                          }}
                          placeholder="Tell your fans about yourself..."
                          rows={4}
                          maxLength={500}
                          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-right">
                          {bio.length}/500 characters
                        </p>
                      </div>
                    </div>
                  </motion.div>


                  {/* Social Links for Creators */}
                  {isCreator && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
                    >
                      <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        <LinkIcon className="w-5 h-5 text-purple-600" />
                        Social Links
                      </h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Instagram
                          </label>
                          <input
                            type="text"
                            value={socialLinks.instagram}
                            onChange={(e) => setSocialLinks({...socialLinks, instagram: e.target.value})}
                            placeholder="@yourinstagram"
                            className="w-full h-10 px-4 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Twitter/X
                          </label>
                          <input
                            type="text"
                            value={socialLinks.twitter}
                            onChange={(e) => setSocialLinks({...socialLinks, twitter: e.target.value})}
                            placeholder="@yourtwitter"
                            className="w-full h-10 px-4 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            YouTube
                          </label>
                          <input
                            type="text"
                            value={socialLinks.youtube}
                            onChange={(e) => setSocialLinks({...socialLinks, youtube: e.target.value})}
                            placeholder="youtube.com/yourchannel"
                            className="w-full h-10 px-4 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            TikTok
                          </label>
                          <input
                            type="text"
                            value={socialLinks.tiktok}
                            onChange={(e) => setSocialLinks({...socialLinks, tiktok: e.target.value})}
                            placeholder="@yourtiktok"
                            className="w-full h-10 px-4 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}


                  {/* Account Security Section */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
                  >
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                      <KeyIcon className="w-5 h-5 text-purple-600" />
                      Account Security
                    </h3>
                    <div className="space-y-4">
                      {/* Change Password */}
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                          <LockClosedIcon className="w-5 h-5" />
                          Password
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Keep your account secure with a strong password</p>
                        <button
                          onClick={() => setShowChangePassword(true)}
                          className="text-purple-600 hover:text-purple-700 font-medium text-sm transition-colors"
                        >
                          Change Password →
                        </button>
                      </div>

                      {/* Save Profile Button - Moved ABOVE Sign Out */}
                      <div className="pt-6">
                        {/* Success/Error Messages */}
                        {success && (
                          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
                            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {success}
                          </div>
                        )}
                        {error && (
                          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
                            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            {error}
                          </div>
                        )}

                        <button
                          onClick={saveProfile}
                          disabled={saving}
                          className="w-full px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                        >
                          {saving ? (
                            <>
                              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Saving...
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Save Profile
                            </>
                          )}
                        </button>
                      </div>

                      {/* Sign Out */}
                      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                        <button
                          onClick={() => {
                            supabase.auth.signOut();
                            // Navigate to home page
                            window.location.href = '/';
                          }}
                          className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2 w-full justify-center"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {activeTab === 'subscriptions' && isCreator && (
              <motion.div
                key="subscriptions"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <CreatorSubscriptionSimple user={user} isCreator={isCreator} />
              </motion.div>
            )}



          </AnimatePresence>
        </div>
      </div>


      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => {
                setShowChangePassword(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setPasswordError('');
              }}
            />

            {/* Modal content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative inline-block bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full"
            >
              <div className="bg-white px-6 pt-5 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <KeyIcon className="w-5 h-5 text-purple-600" />
                    Change Password
                  </h3>
                  <button
                    onClick={() => {
                      setShowChangePassword(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setPasswordError('');
                    }}
                    className="text-gray-400 hover:text-gray-500 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {passwordError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{passwordError}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter current password"
                    />
                  </div>

                  <div>
                    <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter new password"
                    />
                    <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
                  </div>

                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => {
                      setShowChangePassword(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setPasswordError('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setPasswordError('');
                      
                      // Validation
                      if (!currentPassword || !newPassword || !confirmPassword) {
                        setPasswordError('Please fill in all fields');
                        return;
                      }
                      
                      if (newPassword.length < 6) {
                        setPasswordError('New password must be at least 6 characters');
                        return;
                      }
                      
                      if (newPassword !== confirmPassword) {
                        setPasswordError('New passwords do not match');
                        return;
                      }
                      
                      setPasswordLoading(true);
                      
                      try {
                        // Update password using Supabase Auth
                        const { error } = await supabase.auth.updateUser({
                          password: newPassword
                        });
                        
                        if (error) {
                          setPasswordError(error.message);
                        } else {
                          toast.success('Password updated successfully!');
                          setShowChangePassword(false);
                          setCurrentPassword('');
                          setNewPassword('');
                          setConfirmPassword('');
                        }
                      } catch (error) {
                        setPasswordError('Failed to update password. Please try again.');
                      } finally {
                        setPasswordLoading(false);
                      }
                    }}
                    disabled={passwordLoading}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {passwordLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Updating...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
      
      {/* Image Crop Modal - New react-avatar-editor version */}
      <ImageCropModal
        isOpen={showImageCropper}
        cropType={cropperMode === 'profile' ? 'avatar' : 'card'}
        file={tempImageSrc}
        onClose={() => {
          setShowImageCropper(false);
          setTempImageSrc(null);
        }}
        onSave={handleCroppedImage}
        aspectRatio={cropperMode === 'banner' ? '3:1' : '2:3'}
        allowRatioChange={false}
      />
    </div>
  );
};

export default ImprovedProfile;