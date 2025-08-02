import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  XMarkIcon,
  CalendarDaysIcon,
  ClockIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  VideoCameraIcon,
  TagIcon,
  InformationCircleIcon,
  PhotoIcon,
  CloudArrowUpIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../utils/supabase-auth.js';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const ClassScheduler = ({ isOpen, onClose, onClassScheduled, user }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'wellness',
    date: '',
    time: '',
    duration: 60,
    maxParticipants: 20,
    tokenPrice: 15,
    tags: '',
    requirements: '',
    whatToExpect: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverImage, setCoverImage] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState(null);

  const categories = [
    { id: 'fitness', label: 'Fitness & Workout', icon: '💪' },
    { id: 'wellness', label: 'Health & Wellness', icon: '🧘' },
    { id: 'fashion', label: 'Fashion & Style', icon: '👗' },
    { id: 'business', label: 'Business & Consulting', icon: '💼' },
    { id: 'creative', label: 'Creative Arts', icon: '🎨' },
    { id: 'cooking', label: 'Cooking & Nutrition', icon: '🍳' },
    { id: 'tech', label: 'Technology', icon: '💻' },
    { id: 'music', label: 'Music & Performance', icon: '🎵' }
  ];

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      
      setCoverImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title.trim()) {
      toast.error('Class title is required');
      return;
    }
    
    if (!formData.description.trim()) {
      toast.error('Class description is required');
      return;
    }
    
    if (!formData.date) {
      toast.error('Class date is required');
      return;
    }
    
    if (!formData.time) {
      toast.error('Class time is required');
      return;
    }
    
    // Check if the scheduled time is in the future
    const classDateTime = new Date(`${formData.date}T${formData.time}`);
    const now = new Date();
    
    if (classDateTime <= now) {
      toast.error('Class must be scheduled for a future date and time');
      return;
    }
    
    // Check if it's at least 1 hour in the future
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    if (classDateTime < oneHourFromNow) {
      toast.error('Class must be scheduled at least 1 hour in advance');
      return;
    }

    try {
      setIsSubmitting(true);
      const authToken = await getAuthToken();
      
      // Parse tags
      const tags = formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      
      let coverImageUrl = null;
      
      // Upload cover image if provided
      if (coverImage) {
        const imageFormData = new FormData();
        imageFormData.append('image', coverImage);
        imageFormData.append('type', 'class_cover');
        
        try {
          const uploadResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            body: imageFormData
          });
          
          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            coverImageUrl = uploadData.url;
          } else {
            console.error('Failed to upload cover image');
            // Continue without image if upload fails
          }
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          // Continue without image
        }
      }
      
      // Create the class data structure that matches what ClassesPage expects
      const classData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        startTime: classDateTime.toISOString(),
        duration: formData.duration,
        maxParticipants: formData.maxParticipants,
        currentParticipants: 0, // New class starts with 0 participants
        tokenPrice: formData.tokenPrice,
        tags: tags,
        requirements: formData.requirements,
        whatToExpect: formData.whatToExpect,
        coverImage: coverImageUrl,
        isLive: false,
        creator: {
          id: user.id,
          username: user.email?.split('@')[0] || 'creator',
          displayName: user.displayName || user.email?.split('@')[0] || 'Creator',
          avatar: user.photoURL,
          rating: 0, // Will be updated as reviews come in
          reviewCount: 0
        }
      };

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(classData)
      });

      if (response.ok) {
        const result = await response.json();
        // toast.success('Class scheduled successfully!');
        
        // Reset form
        setFormData({
          title: '',
          description: '',
          category: 'wellness',
          date: '',
          time: '',
          duration: 60,
          maxParticipants: 20,
          tokenPrice: 15,
          tags: '',
          requirements: '',
          whatToExpect: ''
        });
        setCoverImage(null);
        setCoverImagePreview(null);
        
        // Notify parent component
        if (onClassScheduled) {
          onClassScheduled(result.class);
        }
        
        onClose();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to schedule class');
      }
    } catch (error) {
      console.error('Error scheduling class:', error);
      toast.error('Failed to schedule class. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get minimum date (today)
  const today = new Date();
  const minDate = today.toISOString().split('T')[0];
  
  // Get minimum time (if today, current hour + 1)
  const now = new Date();
  const selectedDate = new Date(formData.date);
  const isToday = selectedDate.toDateString() === today.toDateString();
  const minTime = isToday ? 
    `${String(now.getHours() + 1).padStart(2, '0')}:00` : 
    '00:00';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <VideoCameraIcon className="w-8 h-8 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Schedule New Class</h2>
              <p className="text-sm text-gray-600">Create a live streaming class for your audience</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Cover Image Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cover Image (Optional but Recommended)
            </label>
            <div className="relative">
              {coverImagePreview ? (
                <div className="relative rounded-lg overflow-hidden border-2 border-gray-300">
                  <img 
                    src={coverImagePreview} 
                    alt="Cover preview" 
                    className="w-full h-48 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCoverImage(null);
                      setCoverImagePreview(null);
                    }}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <CloudArrowUpIcon className="w-10 h-10 mb-3 text-gray-400" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={handleImageChange}
                    accept="image/*"
                  />
                </label>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              A good cover image helps attract more students to your class
            </p>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Class Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g., Morning Yoga Flow, HIIT Bootcamp, Fashion Styling Tips"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                placeholder="Describe what students will learn and what makes your class special..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              >
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                name="tags"
                value={formData.tags}
                onChange={handleInputChange}
                placeholder="e.g., Beginner Friendly, Equipment Free, Stretching"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Schedule */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CalendarDaysIcon className="w-5 h-5" />
              Schedule
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  min={minDate}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time * (EST)
                </label>
                <input
                  type="time"
                  name="time"
                  value={formData.time}
                  onChange={handleInputChange}
                  min={minTime}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (minutes)
                </label>
                <select
                  name="duration"
                  value={formData.duration}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
            </div>
          </div>

          {/* Class Settings */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <UserGroupIcon className="w-5 h-5" />
              Class Settings
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Participants
                </label>
                <input
                  type="number"
                  name="maxParticipants"
                  value={formData.maxParticipants}
                  onChange={handleInputChange}
                  min={1}
                  max={100}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price (Tokens)
                </label>
                <input
                  type="number"
                  name="tokenPrice"
                  value={formData.tokenPrice}
                  onChange={handleInputChange}
                  min={1}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <InformationCircleIcon className="w-5 h-5" />
              Additional Information
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Requirements or Prerequisites
                </label>
                <textarea
                  name="requirements"
                  value={formData.requirements}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Any equipment, experience level, or preparation needed..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What to Expect
                </label>
                <textarea
                  name="whatToExpect"
                  value={formData.whatToExpect}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="What will students learn or achieve in this class..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="border-t border-gray-200 pt-6 flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-3 font-medium rounded-lg transition-colors flex items-center gap-2 ${
                isSubmitting
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  Scheduling...
                </>
              ) : (
                <>
                  <CalendarDaysIcon className="w-5 h-5" />
                  Schedule Class
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default ClassScheduler;