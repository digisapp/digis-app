import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCircleIcon,
  CameraIcon,
  CheckIcon,
  XMarkIcon,
  ArrowLeftIcon,
  AtSymbolIcon,
  LinkIcon,
  MapPinIcon,
  GlobeAltIcon,
  LockClosedIcon,
  ChevronRightIcon,
  PencilIcon,
  PhotoIcon,
  EyeIcon,
  EyeSlashIcon,
  ShieldCheckIcon,
  BellIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  ChatBubbleLeftRightIcon,
  VideoCameraIcon,
  CurrencyDollarIcon,
  LanguageIcon,
  ClockIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  UserMinusIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  ArrowPathIcon,
  CreditCardIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import '../../styles/mobile-scrollbar-hide.css';
import ImageCropModal from '../media/ImageCropModal';
import { uploadAvatar } from '../../services/imageUploadService';

// Helper function for default avatar
const getDefaultAvatarUrl = (name, size = 100) => {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${size} ${size}'%3E%3Crect width='${size}' height='${size}' fill='%239333ea'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='white' font-size='${size/2}' font-family='system-ui'%3E${initial}%3C/text%3E%3C/svg%3E`;
};

// Available categories (moved outside component)
const availableCategories = [
  { value: 'Gaming', icon: '🎮', label: 'Gaming' },
  { value: 'Music', icon: '🎵', label: 'Music' },
  { value: 'Art', icon: '🎨', label: 'Art' },
  { value: 'Model', icon: '👗', label: 'Model' },
  { value: 'Fashion', icon: '👠', label: 'Fashion' },
  { value: 'Fitness', icon: '💪', label: 'Fitness' },
  { value: 'Food', icon: '🍕', label: 'Food & Cooking' },
  { value: 'Travel', icon: '✈️', label: 'Travel' },
  { value: 'Education', icon: '📚', label: 'Education' },
  { value: 'Comedy', icon: '😂', label: 'Comedy' },
  { value: 'Sports', icon: '⚽', label: 'Sports' },
  { value: 'Tech', icon: '💻', label: 'Technology' },
  { value: 'Beauty', icon: '💄', label: 'Beauty' },
  { value: 'Lifestyle', icon: '🌟', label: 'Lifestyle' },
  { value: 'Wellness', icon: '🧘', label: 'Wellness' },
  { value: 'ASMR', icon: '🎧', label: 'ASMR' }
];

// Social link normalizers
const normalizeSocial = {
  instagram: v => v ? (v.startsWith('http') ? v : `https://instagram.com/${v.replace(/^@/,'').trim()}`) : '',
  twitter: v => v ? (v.startsWith('http') ? v : `https://x.com/${v.replace(/^@/,'').trim()}`) : '',
  youtube: v => v ? (v.startsWith('http') ? v : `https://youtube.com/@${v.replace(/^@/,'').trim()}`) : '',
  tiktok: v => v ? (v.startsWith('http') ? v : `https://www.tiktok.com/@${v.replace(/^@/,'').trim()}`) : '',
};

// Helper to convert to number with validation
const toNum = (v) => Math.max(0.01, Number.parseFloat(v || 0));

// Clean username helper
const cleanUsername = (v) => v.replace(/^@/,'').replace(/[^a-z0-9_]/g, '').trim().toLowerCase();

const MobileEditProfile = ({ user, isCreator, onSave, onNavigate }) => {

  console.log('MobileEditProfile user data:', user);

  // Form state matching desktop
  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.display_name || user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [profileImage, setProfileImage] = useState(user?.profile_pic_url || user?.avatar_url || '');
  const [bannerImage, setBannerImage] = useState(user?.banner_url || '');

  // Location for creators
  const [state, setState] = useState(user?.state || '');
  const [country, setCountry] = useState(user?.country || '');

  // Categories for creators (interests)
  const [interests, setInterests] = useState(user?.interests || []);

  // Social links
  const [socialLinks, setSocialLinks] = useState({
    instagram: user?.social_links?.instagram || '',
    twitter: user?.social_links?.twitter || '',
    youtube: user?.social_links?.youtube || '',
    tiktok: user?.social_links?.tiktok || ''
  });

  // Creator pricing
  const [streamPrice, setStreamPrice] = useState(user?.stream_price ?? 5);
  const [videoPrice, setVideoPrice] = useState(user?.video_price ?? 8);
  const [voicePrice, setVoicePrice] = useState(user?.voice_price ?? 6);
  const [messagePrice, setMessagePrice] = useState(user?.message_price ?? 2);
  const [textMessagePrice, setTextMessagePrice] = useState(user?.text_message_price ?? 1);
  const [imageMessagePrice, setImageMessagePrice] = useState(user?.image_message_price ?? 3);
  const [videoMessagePrice, setVideoMessagePrice] = useState(user?.video_message_price ?? 5);
  const [voiceMemoPrice, setVoiceMemoPrice] = useState(user?.voice_memo_price ?? 2);

  // Privacy & Security Settings
  const [profileVisibility, setProfileVisibility] = useState(user?.privacy_settings?.profile_visibility || 'public');
  const [messagePrivacy, setMessagePrivacy] = useState(user?.privacy_settings?.message_privacy || 'everyone');
  const [showOnlineStatus, setShowOnlineStatus] = useState(user?.privacy_settings?.show_online_status ?? true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.two_factor_enabled || false);
  const [blockedUsers, setBlockedUsers] = useState(user?.blocked_users || []);

  // Notification Settings
  const [emailNotifications, setEmailNotifications] = useState(user?.notification_preferences?.email ?? true);
  const [pushNotifications, setPushNotifications] = useState(user?.notification_preferences?.push ?? true);
  const [messageAlerts, setMessageAlerts] = useState(user?.notification_preferences?.messages ?? true);
  const [streamAlerts, setStreamAlerts] = useState(user?.notification_preferences?.streams ?? true);
  const [tipAlerts, setTipAlerts] = useState(user?.notification_preferences?.tips ?? true);

  // Account Settings
  const [language, setLanguage] = useState(user?.language || 'en');
  const [timezone, setTimezone] = useState(user?.timezone || 'America/New_York');
  const [theme, setTheme] = useState(user?.theme || 'system');

  // Creator-specific settings
  const [availabilitySchedule, setAvailabilitySchedule] = useState(user?.availability_schedule || {
    monday: { available: true, start: '09:00', end: '17:00' },
    tuesday: { available: true, start: '09:00', end: '17:00' },
    wednesday: { available: true, start: '09:00', end: '17:00' },
    thursday: { available: true, start: '09:00', end: '17:00' },
    friday: { available: true, start: '09:00', end: '17:00' },
    saturday: { available: false, start: '09:00', end: '17:00' },
    sunday: { available: false, start: '09:00', end: '17:00' }
  });
  const [autoResponseMessage, setAutoResponseMessage] = useState(user?.auto_response_message || '');
  const [analyticsVisibility, setAnalyticsVisibility] = useState(user?.analytics_visibility || 'public');
  const [watermarkEnabled, setWatermarkEnabled] = useState(user?.watermark_enabled || false);
  const [subscriptionPrice, setSubscriptionPrice] = useState(user?.subscription_price ?? 9.99);

  // UI state
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Auto-Refill Settings
  const [autoRefillEnabled, setAutoRefillEnabled] = useState(user?.auto_refill_enabled || false);
  const [autoRefillAmount, setAutoRefillAmount] = useState(user?.auto_refill_amount || 500);
  const [autoRefillThreshold, setAutoRefillThreshold] = useState(user?.auto_refill_threshold || 100);

  // File input refs
  const profileInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  // Crop modal state
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);
  const [cropType, setCropType] = useState('avatar');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Store initial state for change detection
  const initialRef = useRef(null);

  useEffect(() => {
    if (user && !initialRef.current) {
      initialRef.current = {
        username: user?.username || '',
        displayName: user?.display_name || user?.full_name || user?.name || '',
        bio: user?.bio || '',
        profileImage: user?.profile_pic_url || user?.avatar_url || '',
        bannerImage: user?.banner_url || '',
        state: user?.state || '',
        country: user?.country || '',
        interests: user?.interests || [],
        prices: {
          stream: user?.stream_price ?? 5,
          video: user?.video_price ?? 8,
          voice: user?.voice_price ?? 6,
          msg: user?.message_price ?? 2,
          text: user?.text_message_price ?? 1,
          image: user?.image_message_price ?? 3,
          videoMsg: user?.video_message_price ?? 5,
          voiceMemo: user?.voice_memo_price ?? 2,
        },
        social: user?.social_links ?? { instagram:'', twitter:'', youtube:'', tiktok:'' },
      };
    }
  }, [user]);

  // Compute hasChanges properly
  useEffect(() => {
    if (!initialRef.current) return;

    const changed =
      username !== initialRef.current.username ||
      displayName !== initialRef.current.displayName ||
      bio !== initialRef.current.bio ||
      profileImage !== initialRef.current.profileImage ||
      bannerImage !== initialRef.current.bannerImage ||
      state !== initialRef.current.state ||
      country !== initialRef.current.country ||
      JSON.stringify(interests) !== JSON.stringify(initialRef.current.interests) ||
      JSON.stringify(socialLinks) !== JSON.stringify(initialRef.current.social) ||
      streamPrice !== initialRef.current.prices.stream ||
      videoPrice !== initialRef.current.prices.video ||
      voicePrice !== initialRef.current.prices.voice ||
      messagePrice !== initialRef.current.prices.msg ||
      textMessagePrice !== initialRef.current.prices.text ||
      imageMessagePrice !== initialRef.current.prices.image ||
      videoMessagePrice !== initialRef.current.prices.videoMsg ||
      voiceMemoPrice !== initialRef.current.prices.voiceMemo;

    setHasChanges(changed);
  }, [username, displayName, bio, profileImage, bannerImage, state, country, interests, socialLinks,
      streamPrice, videoPrice, voicePrice, messagePrice, textMessagePrice, imageMessagePrice,
      videoMessagePrice, voiceMemoPrice]);

  // Cleanup object URLs on unmount or change
  useEffect(() => {
    return () => {
      if (profileImage?.startsWith('blob:')) URL.revokeObjectURL(profileImage);
      if (bannerImage?.startsWith('blob:')) URL.revokeObjectURL(bannerImage);
    };
  }, [profileImage, bannerImage]);

  // Safe navigation with unsaved changes check
  const safeNavigateBack = useCallback(() => {
    if (hasChanges) {
      if (!confirm('Discard unsaved changes?')) return;
    }
    onNavigate('dashboard');
  }, [hasChanges, onNavigate]);

  // Handle category selection
  const handleCategoryChange = (value) => {
    if (value && !interests.includes(value)) {
      if (interests.length < 4) {
        setInterests([...interests, value]);
        setErrors(prev => ({ ...prev, categories: null }));
      } else {
        setErrors(prev => ({ ...prev, categories: 'You can only select up to 4 categories' }));
        setTimeout(() => setErrors(prev => ({ ...prev, categories: null })), 3000);
      }
    }
  };

  // Handle category removal
  const removeCategory = (category) => {
    setInterests(interests.filter(i => i !== category));
  };

  // Handle social link change with normalization
  const handleSocialChange = (platform, value) => {
    const normalized = normalizeSocial[platform] ? normalizeSocial[platform](value) : value;
    setSocialLinks(prev => ({ ...prev, [platform]: normalized }));
  };

  // Handle avatar file selection - opens new crop modal
  const handleAvatarFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic validation
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
      toast.error('Please choose a PNG, JPG or WEBP image.');
      e.target.value = '';
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image is larger than 8MB.');
      e.target.value = '';
      return;
    }

    // Open the new crop modal
    const url = URL.createObjectURL(file);
    setCropType('avatar');
    setCropSrc(url);
    setCropOpen(true);
    // Allow re-selecting same file later
    e.target.value = '';
  };

  // Handle cropped avatar -> upload -> update UI
  const handleAvatarCropped = async (croppedFile) => {
    setUploadingAvatar(true);
    try {
      // Upload to backend
      const url = await uploadAvatar(croppedFile);

      // Update local state so the new avatar shows immediately
      setProfileImage(url);

      toast.success('Profile photo updated');
    } catch (err) {
      console.error(err);
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploadingAvatar(false);
      setCropOpen(false);
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    }
  };

  // Handle banner image upload (keep old logic for banner)
  const handleBannerImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a JPG, PNG, GIF, or WebP image.');
      return;
    }

    // Validate file size
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Image is too large. Max size is 10MB.');
      return;
    }

    // Create object URL for preview (more memory efficient)
    const url = URL.createObjectURL(file);

    // Validate dimensions
    const img = new Image();
    img.onload = () => {
      const minW = 1200;
      const minH = 360;

      if (img.width < minW || img.height < minH) {
        toast.error(`Image too small. Minimum ${minW}×${minH} required.`);
        URL.revokeObjectURL(url);
        return;
      }

      // Revoke old URL if exists
      if (bannerImage?.startsWith('blob:')) {
        URL.revokeObjectURL(bannerImage);
      }

      // Set the new image
      setBannerImage(url);
    };

    img.onerror = () => {
      toast.error('Failed to load image');
      URL.revokeObjectURL(url);
    };

    img.src = url;
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    // Trim and validate username
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      newErrors.username = 'Username is required';
    } else if (!/^[a-z0-9_]+$/.test(trimmedUsername)) {
      newErrors.username = 'Username can only contain lowercase letters, numbers, and underscores';
    } else if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      newErrors.username = 'Username must be between 3 and 30 characters';
    }

    // Validate display name
    if (displayName.trim() && displayName.trim().length > 50) {
      newErrors.displayName = 'Display name must be less than 50 characters';
    }

    // Validate bio
    if (bio.length > 500) {
      newErrors.bio = 'Bio must be less than 500 characters';
    }

    // Validate password if changing
    if (showChangePassword && (currentPassword || newPassword || confirmPassword)) {
      if (!currentPassword) {
        newErrors.currentPassword = 'Current password is required';
      }
      if (!newPassword) {
        newErrors.newPassword = 'New password is required';
      } else if (newPassword.length < 8) {
        newErrors.newPassword = 'Password must be at least 8 characters';
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
        newErrors.newPassword = 'Password must contain uppercase, lowercase, and number';
      }
      if (newPassword !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    // Validate creator prices
    if (isCreator) {
      const prices = [streamPrice, videoPrice, voicePrice, messagePrice,
                     textMessagePrice, imageMessagePrice, videoMessagePrice, voiceMemoPrice];
      prices.forEach((price, index) => {
        const numPrice = toNum(price);
        if (numPrice < 0.01 || numPrice > 999) {
          const fieldNames = ['stream', 'video', 'voice', 'message',
                            'textMessage', 'imageMessage', 'videoMessage', 'voiceMemo'];
          newErrors[`${fieldNames[index]}Price`] = 'Price must be between $0.01 and $999';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save with proper number conversion
  const handleSave = async () => {
    if (!validateForm()) {
      toast.error('Please fix the errors before saving');
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
        bio: bio.trim(),
        profile_pic_url: profileImage,
        banner_url: bannerImage,
        social_links: socialLinks,
        // Privacy settings
        privacy_settings: {
          profile_visibility: profileVisibility,
          message_privacy: messagePrivacy,
          show_online_status: showOnlineStatus
        },
        // Notification preferences
        notification_preferences: {
          email: emailNotifications,
          push: pushNotifications,
          messages: messageAlerts,
          streams: streamAlerts,
          tips: tipAlerts
        },
        // Account settings
        language,
        timezone,
        theme,
        two_factor_enabled: twoFactorEnabled,
        blocked_users: blockedUsers,
        // Creator settings
        creatorSettings: isCreator ? {
          interests,
          state: state.trim(),
          country: country.trim(),
          stream_price: toNum(streamPrice),
          video_price: toNum(videoPrice),
          voice_price: toNum(voicePrice),
          message_price: toNum(messagePrice),
          text_message_price: toNum(textMessagePrice),
          image_message_price: toNum(imageMessagePrice),
          video_message_price: toNum(videoMessagePrice),
          voice_memo_price: toNum(voiceMemoPrice),
          subscription_price: toNum(subscriptionPrice),
          availability_schedule: availabilitySchedule,
          auto_response_message: autoResponseMessage,
          analytics_visibility: analyticsVisibility,
          watermark_enabled: watermarkEnabled
        } : {},
      };

      // Only include password change if all fields valid
      if (showChangePassword && currentPassword && newPassword && confirmPassword && newPassword === confirmPassword) {
        payload.passwordChange = {
          currentPassword,
          newPassword
        };
      }

      await onSave(payload);
      toast.success('Profile updated successfully!');

      // Reset initial state after successful save
      initialRef.current = {
        username: payload.username,
        displayName: payload.display_name,
        bio: payload.bio,
        profileImage: payload.profile_pic_url,
        bannerImage: payload.banner_url,
        state: payload.creatorSettings?.state || '',
        country: payload.creatorSettings?.country || '',
        interests: payload.creatorSettings?.interests || [],
        prices: {
          stream: payload.creatorSettings?.stream_price ?? 5,
          video: payload.creatorSettings?.video_price ?? 8,
          voice: payload.creatorSettings?.voice_price ?? 6,
          msg: payload.creatorSettings?.message_price ?? 2,
          text: payload.creatorSettings?.text_message_price ?? 1,
          image: payload.creatorSettings?.image_message_price ?? 3,
          videoMsg: payload.creatorSettings?.video_message_price ?? 5,
          voiceMemo: payload.creatorSettings?.voice_memo_price ?? 2,
        },
        social: payload.social_links,
      };

      setHasChanges(false);

      // Clear password fields on success
      if (showChangePassword) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowChangePassword(false);
      }

      onNavigate('dashboard');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error(error.message ?? 'Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with safe area */}
      <div
        className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Edit Profile
          </h1>

          <button
            onClick={handleSave}
            disabled={isLoading || !hasChanges}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              hasChanges && !isLoading
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
            }`}
            aria-label="Save changes"
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-gray-200 dark:border-gray-700 overflow-x-auto scrollbar-hide">
          {['profile', 'social', isCreator && 'creator', 'auto-refill', 'privacy', 'notifications', 'account'].filter(Boolean).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 py-3 px-4 text-sm font-medium transition-colors relative whitespace-nowrap ${
                activeTab === tab
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {tab === 'notifications' ? 'Notifs' :
               tab === 'auto-refill' ? 'Auto-Refill' :
               tab.charAt(0).toUpperCase() + tab.slice(1)}
              {activeTab === tab && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content with safe area padding */}
      <div
        className="flex-1 overflow-y-auto px-4 py-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}
      >
        {/* Error messages with aria-live */}
        <div aria-live="polite" aria-atomic="true">
          {Object.keys(errors).length > 0 && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                Please fix the following errors:
              </p>
              <ul className="mt-1 text-xs text-red-500 dark:text-red-300">
                {Object.values(errors).map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Profile & Banner Images */}
              <div className="relative">
                {/* Banner Image */}
                <div className="relative h-32 bg-gradient-to-r from-purple-400 to-pink-400 rounded-lg overflow-hidden">
                  {bannerImage ? (
                    <img
                      src={bannerImage}
                      alt="Banner"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-purple-400 to-pink-400" />
                  )}
                  {isCreator && (
                    <>
                      <button
                        onClick={() => bannerInputRef.current?.click()}
                        className="absolute bottom-2 right-2 p-2 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/70 transition-colors"
                        aria-label="Change banner image"
                      >
                        <CameraIcon className="w-5 h-5 text-white" />
                      </button>
                      <input
                        ref={bannerInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleBannerImageUpload}
                        className="hidden"
                        aria-label="Banner image upload"
                      />
                    </>
                  )}
                </div>

                {/* Profile Image */}
                <div className="absolute -bottom-12 left-4 z-10">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-white dark:bg-gray-800 p-1">
                      <img
                        src={profileImage || getDefaultAvatarUrl(displayName || username)}
                        alt="Profile"
                        className="w-full h-full rounded-full object-cover"
                        onError={(e) => {
                          e.target.src = getDefaultAvatarUrl(displayName || username);
                        }}
                      />
                    </div>
                    {isCreator && (
                      <>
                        <button
                          onClick={() => profileInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="absolute bottom-0 right-0 p-2 bg-purple-600 rounded-full hover:bg-purple-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Change profile picture"
                        >
                          {uploadingAvatar ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <CameraIcon className="w-4 h-4 text-white" />
                          )}
                        </button>
                        <input
                          ref={profileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleAvatarFileSelect}
                          className="hidden"
                          aria-label="Profile image upload"
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Spacer for profile image */}
              <div className="h-12" />

              {/* Form Fields */}
              <div className="space-y-4">
                {/* Username */}
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Username
                  </label>
                  <div className="relative">
                    <AtSymbolIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(cleanUsername(e.target.value))}
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors dark:bg-gray-800 ${
                        errors.username
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500'
                      }`}
                      placeholder={username || user?.username || "Enter username"}
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      aria-invalid={!!errors.username}
                      aria-describedby={errors.username ? 'username-error' : undefined}
                    />
                  </div>
                  {errors.username && (
                    <p id="username-error" className="mt-1 text-xs text-red-500">{errors.username}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">Lowercase letters, numbers, and underscores only</p>
                </div>

                {/* Display Name */}
                <div>
                  <label htmlFor="displayname" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Display Name
                  </label>
                  <input
                    id="displayname"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors dark:bg-gray-800 ${
                      errors.displayName
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500'
                    }`}
                    placeholder="Your display name"
                    autoComplete="name"
                    aria-invalid={!!errors.displayName}
                    aria-describedby={errors.displayName ? 'displayname-error' : undefined}
                  />
                  {errors.displayName && (
                    <p id="displayname-error" className="mt-1 text-xs text-red-500">{errors.displayName}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">This is the name that will be shown publicly</p>
                </div>

                {/* Bio */}
                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    About
                  </label>
                  <textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors dark:bg-gray-800 ${
                      errors.bio
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500'
                    }`}
                    placeholder="Tell us about yourself..."
                    inputMode="text"
                    aria-invalid={!!errors.bio}
                    aria-describedby={errors.bio ? 'bio-error' : undefined}
                  />
                  <div className="flex justify-between mt-1">
                    {errors.bio && (
                      <p id="bio-error" className="text-xs text-red-500">{errors.bio}</p>
                    )}
                    <p className="text-xs text-gray-500 ml-auto">{bio.length}/500</p>
                  </div>
                </div>

                {/* Categories for creators */}
                {isCreator && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Categories *<span className="text-xs text-gray-500 ml-2">(Select up to 4)</span>
                    </label>

                    {/* Selected categories */}
                    {interests.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {interests.map((interest) => (
                          <span
                            key={interest}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-sm"
                          >
                            <span>{availableCategories.find(c => c.value === interest)?.icon}</span>
                            <span>{interest}</span>
                            <button
                              onClick={() => removeCategory(interest)}
                              className="ml-1 hover:text-purple-900 dark:hover:text-purple-100"
                              aria-label={`Remove ${interest}`}
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {interests.length === 0 && (
                      <p className="text-sm text-gray-500 mb-2">No categories selected</p>
                    )}

                    {errors.categories && (
                      <p className="text-xs text-red-500 mb-2">{errors.categories}</p>
                    )}

                    {/* Category selector */}
                    <select
                      value=""
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700"
                      disabled={interests.length >= 4}
                    >
                      <option value="">Select a category...</option>
                      {availableCategories
                        .filter(cat => !interests.includes(cat.value))
                        .map(cat => (
                          <option key={cat.value} value={cat.value}>
                            {cat.icon} {cat.label}
                          </option>
                        ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">{interests.length}/4 categories selected</p>
                  </div>
                )}

                {/* Location for creators */}
                {isCreator && (
                  <>
                    <div>
                      <label htmlFor="state" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        State/Province
                      </label>
                      <div className="relative">
                        <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          id="state"
                          type="text"
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700"
                          placeholder="e.g., Florida"
                          autoComplete="address-level1"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="country" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Country
                      </label>
                      <div className="relative">
                        <GlobeAltIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          id="country"
                          type="text"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700"
                          placeholder="e.g., USA"
                          autoComplete="country"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Account Security Section */}
                <div className="border-t pt-4">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                    Account Security
                  </h3>
                  <button
                    onClick={() => setShowChangePassword(!showChangePassword)}
                    className="flex items-center justify-between w-full py-3 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <LockClosedIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white block">
                          Password
                        </span>
                        <span className="text-xs text-gray-500">
                          Keep your account secure with a strong password
                        </span>
                      </div>
                    </div>
                    <ChevronRightIcon className={`w-5 h-5 text-gray-400 transition-transform ${
                      showChangePassword ? 'rotate-90' : ''
                    }`} />
                  </button>

                  <AnimatePresence>
                    {showChangePassword && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3 mt-3"
                      >
                        {/* Current Password */}
                        <div>
                          <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Current Password
                          </label>
                          <div className="relative">
                            <input
                              id="current-password"
                              type={showCurrentPassword ? 'text' : 'password'}
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              className={`w-full pr-10 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors dark:bg-gray-800 ${
                                errors.currentPassword
                                  ? 'border-red-500 focus:ring-red-500'
                                  : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500'
                              }`}
                              autoComplete="current-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                            >
                              {showCurrentPassword ? (
                                <EyeSlashIcon className="w-5 h-5" />
                              ) : (
                                <EyeIcon className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                          {errors.currentPassword && (
                            <p className="mt-1 text-xs text-red-500">{errors.currentPassword}</p>
                          )}
                        </div>

                        {/* New Password */}
                        <div>
                          <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            New Password
                          </label>
                          <div className="relative">
                            <input
                              id="new-password"
                              type={showNewPassword ? 'text' : 'password'}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className={`w-full pr-10 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors dark:bg-gray-800 ${
                                errors.newPassword
                                  ? 'border-red-500 focus:ring-red-500'
                                  : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500'
                              }`}
                              autoComplete="new-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                            >
                              {showNewPassword ? (
                                <EyeSlashIcon className="w-5 h-5" />
                              ) : (
                                <EyeIcon className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                          {errors.newPassword && (
                            <p className="mt-1 text-xs text-red-500">{errors.newPassword}</p>
                          )}
                          <p className="mt-1 text-xs text-gray-500">
                            Min 8 characters, uppercase, lowercase & number
                          </p>
                        </div>

                        {/* Confirm Password */}
                        <div>
                          <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Confirm New Password
                          </label>
                          <div className="relative">
                            <input
                              id="confirm-password"
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className={`w-full pr-10 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors dark:bg-gray-800 ${
                                errors.confirmPassword
                                  ? 'border-red-500 focus:ring-red-500'
                                  : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500'
                              }`}
                              autoComplete="new-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                            >
                              {showConfirmPassword ? (
                                <EyeSlashIcon className="w-5 h-5" />
                              ) : (
                                <EyeIcon className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                          {errors.confirmPassword && (
                            <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {/* Social Tab */}
          {activeTab === 'social' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-purple-600" />
                  Social Links
                </h3>
                <div className="space-y-3">
                  {Object.entries({ instagram: 'Instagram', twitter: 'Twitter/X', youtube: 'YouTube', tiktok: 'TikTok' }).map(([platform, label]) => (
                    <div key={platform}>
                      <label htmlFor={`social-${platform}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {label}
                      </label>
                      <input
                        id={`social-${platform}`}
                        type="text"
                        value={socialLinks[platform] || ''}
                        onChange={(e) => handleSocialChange(platform, e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700"
                        placeholder={platform === 'instagram' ? '@yourinstagram' :
                                    platform === 'twitter' ? '@yourtwitter' :
                                    platform === 'youtube' ? 'youtube.com/yourchannel' :
                                    '@yourtiktok'}
                        autoComplete="off"
                        autoCapitalize="none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Creator Tab */}
          {activeTab === 'creator' && isCreator && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Pricing */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                  Service Pricing (per minute)
                </h3>

                <div className="space-y-3">
                  {/* Stream Price */}
                  <div>
                    <label htmlFor="stream-price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Live Stream
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        id="stream-price"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0.01"
                        max="999"
                        value={streamPrice}
                        onChange={(e) => setStreamPrice(e.target.value)}
                        className={`w-full pl-8 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors dark:bg-gray-700 ${
                          errors.streamPrice
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500'
                        }`}
                      />
                    </div>
                    {streamPrice && (
                      <p className="mt-1 text-xs text-gray-500">
                        10 min = ${(toNum(streamPrice) * 10).toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* Video Call Price */}
                  <div>
                    <label htmlFor="video-price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Video Call
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        id="video-price"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0.01"
                        max="999"
                        value={videoPrice}
                        onChange={(e) => setVideoPrice(e.target.value)}
                        className={`w-full pl-8 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors dark:bg-gray-700 ${
                          errors.videoPrice
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500'
                        }`}
                      />
                    </div>
                    {videoPrice && (
                      <p className="mt-1 text-xs text-gray-500">
                        10 min = ${(toNum(videoPrice) * 10).toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* Voice Call Price */}
                  <div>
                    <label htmlFor="voice-price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Voice Call
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        id="voice-price"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0.01"
                        max="999"
                        value={voicePrice}
                        onChange={(e) => setVoicePrice(e.target.value)}
                        className={`w-full pl-8 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors dark:bg-gray-700 ${
                          errors.voicePrice
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500'
                        }`}
                      />
                    </div>
                    {voicePrice && (
                      <p className="mt-1 text-xs text-gray-500">
                        10 min = ${(toNum(voicePrice) * 10).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Message Pricing */}
                <h4 className="font-medium text-gray-900 dark:text-white mt-6 mb-3">
                  Message Pricing (per message)
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'text', label: 'Text', state: textMessagePrice, setState: setTextMessagePrice },
                    { id: 'image', label: 'Image', state: imageMessagePrice, setState: setImageMessagePrice },
                    { id: 'video', label: 'Video', state: videoMessagePrice, setState: setVideoMessagePrice },
                    { id: 'voice', label: 'Voice', state: voiceMemoPrice, setState: setVoiceMemoPrice }
                  ].map((item) => (
                    <div key={item.id}>
                      <label htmlFor={`${item.id}-msg-price`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {item.label}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          id={`${item.id}-msg-price`}
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0.01"
                          max="999"
                          value={item.state}
                          onChange={(e) => item.setState(e.target.value)}
                          className={`w-full pl-8 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors dark:bg-gray-700 ${
                            errors[`${item.id}MessagePrice`]
                              ? 'border-red-500 focus:ring-red-500'
                              : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500'
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Auto-Refill Tab */}
          {activeTab === 'auto-refill' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <ArrowPathIcon className="w-5 h-5 text-purple-600" />
                  Auto-Refill Settings
                </h3>

                <div className="space-y-4">
                  {/* Enable Auto-Refill */}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">Enable Auto-Refill</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Automatically purchase tokens when balance is low
                      </p>
                    </div>
                    <button
                      onClick={() => setAutoRefillEnabled(!autoRefillEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        autoRefillEnabled ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        autoRefillEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  {autoRefillEnabled && (
                    <>
                      {/* Refill Amount */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Refill Amount (Tokens)
                        </label>
                        <select
                          value={autoRefillAmount}
                          onChange={(e) => setAutoRefillAmount(Number(e.target.value))}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700"
                        >
                          <option value="500">500 tokens ($5.94)</option>
                          <option value="1000">1,000 tokens ($10.33)</option>
                          <option value="2000">2,000 tokens ($18.57)</option>
                          <option value="5000">5,000 tokens ($41.47)</option>
                          <option value="10000">10,000 tokens ($77.16)</option>
                        </select>
                      </div>

                      {/* Refill Threshold */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Refill When Balance Falls Below
                        </label>
                        <select
                          value={autoRefillThreshold}
                          onChange={(e) => setAutoRefillThreshold(Number(e.target.value))}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700"
                        >
                          <option value="50">50 tokens</option>
                          <option value="100">100 tokens</option>
                          <option value="200">200 tokens</option>
                          <option value="500">500 tokens</option>
                        </select>
                      </div>

                      {/* Info Box */}
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                        <p className="text-sm text-purple-700 dark:text-purple-300">
                          When your balance drops below {autoRefillThreshold} tokens, we'll automatically purchase {autoRefillAmount} tokens using your saved payment method.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                  Payment Method
                </h3>
                <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CreditCardIcon className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">No payment method saved</span>
                  </div>
                  <button className="text-purple-600 text-sm font-medium">Add</button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Privacy Tab */}
          {activeTab === 'privacy' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Profile Visibility */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <ShieldCheckIcon className="w-5 h-5 text-purple-600" />
                  Privacy Settings
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Profile Visibility
                    </label>
                    <select
                      value={profileVisibility}
                      onChange={(e) => setProfileVisibility(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700"
                    >
                      <option value="public">Public - Anyone can view</option>
                      <option value="followers">Followers Only</option>
                      <option value="private">Private - Only you</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Who can message you
                    </label>
                    <select
                      value={messagePrivacy}
                      onChange={(e) => setMessagePrivacy(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700"
                    >
                      <option value="everyone">Everyone</option>
                      <option value="followers">Followers Only</option>
                      <option value="subscribers">Subscribers Only</option>
                      <option value="nobody">Nobody</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Show Online Status</p>
                      <p className="text-sm text-gray-500">Let others see when you're active</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowOnlineStatus(!showOnlineStatus)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        showOnlineStatus ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showOnlineStatus ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Two-Factor Authentication</p>
                      <p className="text-sm text-gray-500">Extra security for your account</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        twoFactorEnabled ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <button className="w-full flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div className="flex items-center gap-3">
                      <UserMinusIcon className="w-5 h-5 text-gray-500" />
                      <span className="text-gray-900 dark:text-white">Blocked Users</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">{blockedUsers.length}</span>
                      <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <BellIcon className="w-5 h-5 text-purple-600" />
                  Notification Preferences
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <EnvelopeIcon className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Email Notifications</p>
                        <p className="text-xs text-gray-500">Get updates via email</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEmailNotifications(!emailNotifications)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        emailNotifications ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        emailNotifications ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <DevicePhoneMobileIcon className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Push Notifications</p>
                        <p className="text-xs text-gray-500">Mobile & browser alerts</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPushNotifications(!pushNotifications)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        pushNotifications ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        pushNotifications ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <ChatBubbleLeftRightIcon className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Message Alerts</p>
                        <p className="text-xs text-gray-500">New message notifications</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMessageAlerts(!messageAlerts)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        messageAlerts ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        messageAlerts ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <VideoCameraIcon className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Stream Alerts</p>
                        <p className="text-xs text-gray-500">When creators go live</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStreamAlerts(!streamAlerts)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        streamAlerts ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        streamAlerts ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <CurrencyDollarIcon className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Tips & Gifts</p>
                        <p className="text-xs text-gray-500">When you receive tips</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTipAlerts(!tipAlerts)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        tipAlerts ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        tipAlerts ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* General Settings */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                  General Settings
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <LanguageIcon className="w-4 h-4 inline mr-2" />
                      Language
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="it">Italian</option>
                      <option value="pt">Portuguese</option>
                      <option value="ja">Japanese</option>
                      <option value="ko">Korean</option>
                      <option value="zh">Chinese</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <ClockIcon className="w-4 h-4 inline mr-2" />
                      Timezone
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700"
                    >
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/Denver">Mountain Time (MT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      <option value="Europe/London">London (GMT)</option>
                      <option value="Europe/Paris">Paris (CET)</option>
                      <option value="Asia/Tokyo">Tokyo (JST)</option>
                      <option value="Australia/Sydney">Sydney (AEST)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Theme
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setTheme('light')}
                        className={`flex flex-col items-center p-3 border rounded-lg transition-colors ${
                          theme === 'light'
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        <SunIcon className="w-6 h-6 mb-1" />
                        <span className="text-xs">Light</span>
                      </button>
                      <button
                        onClick={() => setTheme('dark')}
                        className={`flex flex-col items-center p-3 border rounded-lg transition-colors ${
                          theme === 'dark'
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        <MoonIcon className="w-6 h-6 mb-1" />
                        <span className="text-xs">Dark</span>
                      </button>
                      <button
                        onClick={() => setTheme('system')}
                        className={`flex flex-col items-center p-3 border rounded-lg transition-colors ${
                          theme === 'system'
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        <ComputerDesktopIcon className="w-6 h-6 mb-1" />
                        <span className="text-xs">System</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Creator-Specific Settings */}
              {isCreator && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <CalendarDaysIcon className="w-5 h-5 text-purple-600" />
                    Creator Settings
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Monthly Subscription Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.99"
                          max="999.99"
                          value={subscriptionPrice}
                          onChange={(e) => setSubscriptionPrice(e.target.value)}
                          className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Auto-Response Message
                      </label>
                      <textarea
                        value={autoResponseMessage}
                        onChange={(e) => setAutoResponseMessage(e.target.value)}
                        rows={3}
                        placeholder="Message sent when you're unavailable..."
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <ChartBarIcon className="w-4 h-4 inline mr-2" />
                        Analytics Visibility
                      </label>
                      <select
                        value={analyticsVisibility}
                        onChange={(e) => setAnalyticsVisibility(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700"
                      >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Watermark on Content</p>
                        <p className="text-sm text-gray-500">Add watermark to photos/videos</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWatermarkEnabled(!watermarkEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          watermarkEnabled ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          watermarkEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    {/* Availability Schedule */}
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white mb-3">Availability Schedule</p>
                      <div className="space-y-2">
                        {Object.entries(availabilitySchedule).map(([day, schedule]) => (
                          <div key={day} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setAvailabilitySchedule(prev => ({
                                    ...prev,
                                    [day]: { ...prev[day], available: !prev[day].available }
                                  }));
                                }}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                  schedule.available ? 'bg-green-500' : 'bg-gray-300'
                                }`}
                              >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                  schedule.available ? 'translate-x-5' : 'translate-x-1'
                                }`} />
                              </button>
                              <span className="text-sm font-medium capitalize text-gray-700 dark:text-gray-300 w-20">
                                {day.slice(0, 3)}
                              </span>
                            </div>
                            {schedule.available && (
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={schedule.start}
                                  onChange={(e) => {
                                    setAvailabilitySchedule(prev => ({
                                      ...prev,
                                      [day]: { ...prev[day], start: e.target.value }
                                    }));
                                  }}
                                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                                />
                                <span className="text-gray-500">-</span>
                                <input
                                  type="time"
                                  value={schedule.end}
                                  onChange={(e) => {
                                    setAvailabilitySchedule(prev => ({
                                      ...prev,
                                      [day]: { ...prev[day], end: e.target.value }
                                    }));
                                  }}
                                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Account Actions */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                  Account Management
                </h3>

                <div className="space-y-3">
                  <button className="w-full flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-center gap-3">
                      <DocumentDuplicateIcon className="w-5 h-5 text-gray-500" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900 dark:text-white">Download My Data</p>
                        <p className="text-xs text-gray-500">Export your account data</p>
                      </div>
                    </div>
                    <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                  </button>

                  <button className="w-full flex items-center justify-between p-3 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
                    <div className="flex items-center gap-3">
                      <TrashIcon className="w-5 h-5 text-red-500" />
                      <div className="text-left">
                        <p className="font-medium text-red-600 dark:text-red-400">Delete Account</p>
                        <p className="text-xs text-red-500 dark:text-red-400">Permanently delete your account</p>
                      </div>
                    </div>
                    <ChevronRightIcon className="w-5 h-5 text-red-400" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Image Crop Modal */}
      <ImageCropModal
        isOpen={cropOpen}
        cropType="avatar"
        file={cropSrc}
        onClose={() => {
          setCropOpen(false);
          if (cropSrc) URL.revokeObjectURL(cropSrc);
          setCropSrc(null);
        }}
        onSave={handleAvatarCropped}
      />
    </div>
  );
};

export default MobileEditProfile;