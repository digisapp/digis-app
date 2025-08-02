import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase-auth.js';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserCircleIcon, 
  CameraIcon, 
  CheckIcon, 
  ExclamationTriangleIcon,
  CogIcon,
  QuestionMarkCircleIcon,
  ShieldCheckIcon,
  BellIcon,
  KeyIcon,
  SparklesIcon,
  UserGroupIcon,
  LinkIcon,
  EyeIcon,
  HeartIcon
} from '@heroicons/react/24/outline';
import CreatorSubscriptionManagement from './CreatorSubscriptionManagement';

// Upload profile image to backend
const uploadProfileImage = async (file, userId) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/upload-profile-image`, {
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

const ImprovedProfile = ({ user, isCreator: propIsCreator }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [showFanView, setShowFanView] = useState(false);
  
  // Use prop to determine if user is creator (don't allow toggling in profile)
  const isCreator = propIsCreator || false;

  // Determine tabs based on whether user is a creator
  const tabs = isCreator ? [
    { id: 'profile', label: 'Profile', icon: UserCircleIcon },
    { id: 'subscriptions', label: 'Subscriptions', icon: SparklesIcon },
    { id: 'settings', label: 'Settings', icon: CogIcon },
    { id: 'support', label: 'Support', icon: QuestionMarkCircleIcon }
  ] : [
    { id: 'profile', label: 'Profile', icon: UserCircleIcon },
    { id: 'settings', label: 'Settings', icon: CogIcon },
    { id: 'support', label: 'Support', icon: QuestionMarkCircleIcon }
  ];
  
  // Basic profile state
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [pic, setPic] = useState('');
  const [bannerPic, setBannerPic] = useState('');
  const [username, setUsername] = useState('');
  const [industryType, setIndustryType] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [socialLinks, setSocialLinks] = useState({
    instagram: '',
    twitter: '',
    youtube: '',
    tiktok: ''
  });
  
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
        `${import.meta.env.VITE_BACKEND_URL}/api/users/profile?uid=${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Profile loaded:', data);
        setFullName(data.full_name || '');
        setBio(data.bio || '');
        setPic(data.profile_pic_url || '');
        setBannerPic(data.banner_pic_url || '');
        setUsername(data.username || '');
        setIndustryType(data.industry_type || '');
        setState(data.state || '');
        setCountry(data.country || '');
        setPreviewImage(data.profile_pic_url || '');
        setPreviewBanner(data.banner_pic_url || '');
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
      setError('Failed to load profile. Please try again.');
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
    
    // Industry type validation for creators
    if (isCreator && (!industryType || industryType.trim().length === 0)) {
      setError('Industry type is required for creators');
      return false;
    }
    
    // General validation
    if (bio.length > 500) {
      setError('Bio must be less than 500 characters');
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

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a JPG, PNG, GIF, or WebP image.');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Image is too large. Max size is 5MB.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('Uploading profile picture...');
    
    try {
      const downloadURL = await uploadProfileImage(file, user.id);
      
      setPic(downloadURL);
      setPreviewImage(downloadURL);
      
      // Auto-save the profile with the new profile picture
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const profileData = {
        uid: user.id,
        email: user.email,
        username: username.trim() || user.email.split('@')[0],
        full_name: fullName,
        bio: bio.trim(),
        profile_pic_url: downloadURL, // Use the new profile pic URL
        banner_pic_url: bannerPic,
        is_creator: isCreator,
        social_links: socialLinks
      };

      // Add creator-specific fields if user is a creator
      if (isCreator) {
        profileData.industry_type = industryType || 'Other';
        profileData.stream_price = parseFloat(streamPrice) || 5;
        profileData.video_price = parseFloat(videoPrice) || 8;
        profileData.voice_price = parseFloat(voicePrice) || 6;
        profileData.message_price = parseFloat(messagePrice) || 2;
        profileData.text_message_price = parseFloat(textMessagePrice) || 1;
        profileData.image_message_price = parseFloat(imageMessagePrice) || 3;
        profileData.video_message_price = parseFloat(videoMessagePrice) || 5;
        profileData.voice_memo_price = parseFloat(voiceMemoPrice) || 2;
      }

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/profile`, {
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
        // Revert profile pic on error
        setPic('');
        setPreviewImage('');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setError('Failed to upload image');
      // Revert profile pic on error
      setPic('');
      setPreviewImage('');
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
      
      setBannerPic(downloadURL);
      setPreviewBanner(downloadURL);
      setSuccess('Banner uploaded successfully!');
      setSaving(false);
      
      // Don't auto-save, let user save manually
      setTimeout(() => setSuccess(''), 3000);
      return;
    } catch (error) {
      console.error('Error uploading banner:', error);
      setError('Failed to upload banner image');
      // Revert banner on error
      setBannerPic('');
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
      fullName,
      bio,
      industryType,
      isCreator,
      pic,
      bannerPic,
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
        full_name: fullName,
        bio: bio.trim(),
        profile_pic_url: pic,
        banner_pic_url: bannerPic,
        is_creator: isCreator,
        social_links: socialLinks,
        state: state.trim(),
        country: country.trim()
      };

      // Add creator-specific fields
      if (isCreator) {
        profileData.industry_type = industryType;
        profileData.stream_price = parseFloat(streamPrice);
        profileData.video_price = parseFloat(videoPrice);
        profileData.voice_price = parseFloat(voicePrice);
        profileData.message_price = parseFloat(messagePrice);
        profileData.text_message_price = parseFloat(textMessagePrice);
        profileData.image_message_price = parseFloat(imageMessagePrice);
        profileData.video_message_price = parseFloat(videoMessagePrice);
        profileData.voice_memo_price = parseFloat(voiceMemoPrice);
      }

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/profile`, {
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
            {(previewBanner || bannerPic) ? (
              <img
                src={previewBanner || bannerPic}
                alt="Profile Banner"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 animate-gradient-x" />
            )}
            
            {/* Banner Upload Button - Moved to top right to avoid overlap */}
            {isCreator && (
              <div className="absolute top-4 right-4">
                <label className={`cursor-pointer bg-white/90 backdrop-blur hover:bg-white text-gray-700 px-4 py-2 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}>
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
                <div className="relative">
                  {(previewImage || pic) ? (
                    <img
                      src={previewImage || pic}
                      alt="Profile"
                      className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white shadow-xl object-cover"
                    />
                  ) : (
                    <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white shadow-xl bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                      <UserCircleIcon className="w-16 h-16 md:w-20 md:h-20 text-white" />
                    </div>
                  )}
                  
                  {/* Profile Picture Upload */}
                  {isCreator && (
                    <label className={`absolute bottom-0 right-0 cursor-pointer bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition-all ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {saving ? (
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <CameraIcon className="w-5 h-5" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={saving}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Name and Stats */}
              <div className="flex-1 md:ml-6">
                <div className="bg-white/90 backdrop-blur rounded-xl p-4 shadow-lg">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-3">
                    <div>
                      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
                        {fullName || username || 'Your Name'}
                      </h1>
                      <p className="text-gray-600">@{username || 'username'}</p>
                    </div>
                  </div>
                  
                  {/* Creator Stats */}
                  {isCreator && (
                    <div className="flex flex-wrap gap-4 text-sm mt-3">
                      <div className="flex items-center gap-1">
                        <EyeIcon className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{stats.totalViews.toLocaleString()}</span>
                        <span className="text-gray-500">views</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <HeartIcon className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{stats.totalLikes.toLocaleString()}</span>
                        <span className="text-gray-500">likes</span>
                      </div>
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
          <div className="bg-white rounded-xl shadow-sm mb-6">
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
                  onClick={() => setShowFanView(true)}
                  className="flex items-center gap-2 px-6 py-4 font-medium text-sm transition-all relative text-gray-500 hover:text-gray-700 border-l border-gray-200 ml-auto"
                >
                  <EyeIcon className="w-5 h-5" />
                  View Profile
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
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
                  >
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                      <UserCircleIcon className="w-5 h-5 text-purple-600" />
                      Basic Information
                    </h3>

                    <div className="space-y-6">
                      {/* Username */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
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
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          />
                          <span className="absolute left-3 top-3.5 text-gray-400 font-medium">@</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-2">
                          This is your unique identifier on the platform
                        </p>
                      </div>

                      {/* Full Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => {
                            setFullName(e.target.value);
                            clearMessages();
                          }}
                          placeholder="Your display name"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        />
                      </div>

                      {/* Industry Type for Creators */}
                      {isCreator && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Industry Type <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={industryType}
                            onChange={(e) => {
                              setIndustryType(e.target.value);
                              clearMessages();
                            }}
                            required={isCreator}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          >
                            <option value="">Select your industry</option>
                            <option value="Model">🎨 Model</option>
                            <option value="Influencer">⭐ Influencer</option>
                            <option value="Artist">🎨 Artist</option>
                            <option value="Singer">🎤 Singer</option>
                            <option value="Health Coach">💪 Health Coach</option>
                            <option value="Mentor">🧠 Mentor</option>
                            <option value="Fitness">🏋️ Fitness</option>
                            <option value="College">🎓 College</option>
                            <option value="Gaming">🎮 Gaming</option>
                            <option value="Tech">💻 Tech</option>
                            <option value="Cooking">👨‍🍳 Cooking</option>
                            <option value="Music">🎵 Music</option>
                            <option value="Comedy">😄 Comedy</option>
                            <option value="Education">📚 Education</option>
                            <option value="Business">💼 Business</option>
                            <option value="Other">🌟 Other</option>
                          </select>
                          <p className="text-sm text-gray-500 mt-2">
                            Helps fans find you in the right category
                          </p>
                        </div>
                      )}

                      {/* Location Fields for Creators */}
                      {isCreator && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
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
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
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
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            />
                          </div>
                        </div>
                      )}

                      {/* Bio */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Bio
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
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
                        />
                        <p className="text-sm text-gray-500 mt-2 text-right">
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
                      className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
                    >
                      <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        <LinkIcon className="w-5 h-5 text-purple-600" />
                        Social Links
                      </h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Instagram
                          </label>
                          <input
                            type="text"
                            value={socialLinks.instagram}
                            onChange={(e) => setSocialLinks({...socialLinks, instagram: e.target.value})}
                            placeholder="@yourinstagram"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Twitter/X
                          </label>
                          <input
                            type="text"
                            value={socialLinks.twitter}
                            onChange={(e) => setSocialLinks({...socialLinks, twitter: e.target.value})}
                            placeholder="@yourtwitter"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            YouTube
                          </label>
                          <input
                            type="text"
                            value={socialLinks.youtube}
                            onChange={(e) => setSocialLinks({...socialLinks, youtube: e.target.value})}
                            placeholder="youtube.com/yourchannel"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            TikTok
                          </label>
                          <input
                            type="text"
                            value={socialLinks.tiktok}
                            onChange={(e) => setSocialLinks({...socialLinks, tiktok: e.target.value})}
                            placeholder="@yourtiktok"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}


                  {/* Save Button */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex justify-end"
                  >
                    <button
                      onClick={saveProfile}
                      disabled={saving}
                      className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {saving ? 'Saving...' : 'Save Profile'}
                    </button>
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
                <CreatorSubscriptionManagement auth={user} />
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
              >
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <CogIcon className="w-5 h-5 text-purple-600" />
                  Account Settings
                </h3>
                <div className="space-y-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <BellIcon className="w-5 h-5" />
                      Notifications
                    </h4>
                    <p className="text-sm text-gray-600">Manage your notification preferences</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <ShieldCheckIcon className="w-5 h-5" />
                      Privacy & Security
                    </h4>
                    <p className="text-sm text-gray-600">Control your privacy settings and account security</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <KeyIcon className="w-5 h-5" />
                      Change Password
                    </h4>
                    <p className="text-sm text-gray-600">Update your account password</p>
                  </div>
                  
                  {/* Logout Button */}
                  <div className="pt-6 border-t border-gray-200">
                    <button
                      onClick={() => {
                        supabase.auth.signOut();
                        window.location.href = '/';
                      }}
                      className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2 w-full justify-center"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'support' && (
              <motion.div
                key="support"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
              >
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <QuestionMarkCircleIcon className="w-5 h-5 text-purple-600" />
                  Help & Support
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-medium text-purple-900 mb-2">Need Help?</h4>
                    <p className="text-sm text-purple-700 mb-3">
                      Our support team is here to help you with any questions or issues.
                    </p>
                    <button className="text-purple-600 font-medium text-sm hover:text-purple-700">
                      Contact Support →
                    </button>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">FAQs</h4>
                    <p className="text-sm text-gray-600">Find answers to commonly asked questions</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Documentation</h4>
                    <p className="text-sm text-gray-600">Learn how to make the most of our platform</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Fan View Modal */}
      {showFanView && username && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-75 transition-opacity"
              onClick={() => setShowFanView(false)}
            />

            {/* Modal content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative inline-block w-full max-w-7xl text-left align-middle transition-all transform"
            >
              <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <EyeIcon className="w-6 h-6 text-white" />
                      <h3 className="text-xl font-semibold text-white">
                        Preview: How Fans See Your Profile
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowFanView(false)}
                      className="text-white hover:text-gray-200 transition-colors p-2 hover:bg-white/20 rounded-lg"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Fan View Content - Preview */}
                <div className="max-h-[80vh] overflow-y-auto bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500">
                  <div className="p-6">
                    <div className="max-w-7xl mx-auto">
                      {/* Creator Info Card */}
                      <motion.div 
                        className="bg-white/10 backdrop-blur-md rounded-2xl p-8 mb-8"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                          {/* Profile Picture */}
                          <div className="relative">
                            {(previewImage || pic) ? (
                              <img 
                                src={previewImage || pic} 
                                alt={username}
                                className="w-32 h-32 rounded-full object-cover border-4 border-white/50"
                              />
                            ) : (
                              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center text-4xl font-bold text-white">
                                {username?.[0]?.toUpperCase() || '?'}
                              </div>
                            )}
                            {/* Online Status */}
                            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-white"></div>
                          </div>

                          {/* Creator Details */}
                          <div className="flex-1 text-center md:text-left">
                            <h1 className="text-3xl font-bold text-white mb-2">
                              {fullName || 'Creator Name'}
                            </h1>
                            <p className="text-xl text-white/90 mb-2">@{username}</p>
                            
                            {bio && (
                              <p className="text-white/80 text-lg mb-4 max-w-2xl">
                                {bio}
                              </p>
                            )}

                            {/* Industry Type Badge */}
                            {industryType && (
                              <div className="inline-block bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white mb-4">
                                {industryType}
                              </div>
                            )}

                            {/* Stats */}
                            <div className="flex flex-wrap gap-6 justify-center md:justify-start mb-6">
                              <div className="text-center">
                                <div className="text-2xl font-bold text-white">{stats.totalFollowers}</div>
                                <div className="text-white/60 text-sm">Followers</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-white">{stats.totalViews.toLocaleString()}</div>
                                <div className="text-white/60 text-sm">Views</div>
                              </div>
                            </div>

                            {/* Pricing Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                              <div className="bg-white/10 p-3 rounded-lg text-center">
                                <div className="text-2xl mb-1">📡</div>
                                <div className="text-white font-semibold">{streamPrice} tokens</div>
                                <div className="text-white/60 text-xs">Stream/min</div>
                              </div>
                              <div className="bg-white/10 p-3 rounded-lg text-center">
                                <div className="text-2xl mb-1">📹</div>
                                <div className="text-white font-semibold">{videoPrice} tokens</div>
                                <div className="text-white/60 text-xs">Video Call/min</div>
                              </div>
                              <div className="bg-white/10 p-3 rounded-lg text-center">
                                <div className="text-2xl mb-1">📱</div>
                                <div className="text-white font-semibold">{voicePrice} tokens</div>
                                <div className="text-white/60 text-xs">Voice Call/min</div>
                              </div>
                              <div className="bg-white/10 p-3 rounded-lg text-center">
                                <div className="text-2xl mb-1">💬</div>
                                <div className="text-white font-semibold">{messagePrice} tokens</div>
                                <div className="text-white/60 text-xs">Chat/min</div>
                              </div>
                            </div>

                            {/* Social Links */}
                            {(socialLinks.instagram || socialLinks.twitter || socialLinks.youtube || socialLinks.tiktok) && (
                              <div className="flex gap-4 justify-center md:justify-start mb-6">
                                {socialLinks.instagram && (
                                  <span className="text-white/80 hover:text-white">📷 @{socialLinks.instagram}</span>
                                )}
                                {socialLinks.twitter && (
                                  <span className="text-white/80 hover:text-white">🐦 @{socialLinks.twitter}</span>
                                )}
                                {socialLinks.youtube && (
                                  <span className="text-white/80 hover:text-white">📺 {socialLinks.youtube}</span>
                                )}
                                {socialLinks.tiktok && (
                                  <span className="text-white/80 hover:text-white">🎵 @{socialLinks.tiktok}</span>
                                )}
                              </div>
                            )}

                            {/* Action Buttons (Preview Only) */}
                            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                              <button className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-xl shadow-lg cursor-not-allowed opacity-80">
                                Join Stream
                              </button>
                              <button className="px-6 py-3 bg-white/20 backdrop-blur-sm text-white font-semibold rounded-xl hover:bg-white/30 cursor-not-allowed opacity-80">
                                Follow
                              </button>
                              <button className="px-6 py-3 bg-white/20 backdrop-blur-sm text-white font-semibold rounded-xl hover:bg-white/30 cursor-not-allowed opacity-80">
                                Send Tip
                              </button>
                            </div>

                            {/* Preview Notice */}
                            <div className="mt-6 bg-yellow-500/20 backdrop-blur-sm rounded-lg p-3 text-center">
                              <p className="text-yellow-100 text-sm">
                                ⚠️ This is a preview. Buttons are disabled. Your actual profile will be fully interactive.
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImprovedProfile;