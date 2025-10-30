import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhotoIcon,
  VideoCameraIcon,
  DocumentTextIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  PencilIcon,
  ChevronRightIcon,
  ArrowUpTrayIcon,
  FolderIcon,
  SparklesIcon,
  CloudArrowUpIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import axios from 'axios';
import { isFeatureEnabled } from '../../config/featureFlags';

const MobileContent = ({ user, onNavigate }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);
  const [allContentItems, setAllContentItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3005';

  // Fetch creator's content on mount
  useEffect(() => {
    fetchContent();
  }, [user]);

  const fetchContent = async () => {
    if (!user?.username && !user?.supabase_id) {
      setLoading(false);
      return;
    }

    // Skip API call if content endpoint is not implemented yet
    if (!isFeatureEnabled('CONTENT_API_ENABLED')) {
      console.log('📋 Content API is disabled - using default empty state');
      setAllContentItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const identifier = user.username || user.supabase_id;
      const response = await axios.get(`${backendUrl}/content/creator/${identifier}`);

      if (response.data) {
        const photos = (response.data.pictures || []).map(p => ({
          id: p.id,
          type: 'photo',
          title: p.title,
          thumbnail: p.thumbnail_url,
          contentUrl: p.content_url,
          views: p.views || 0,
          likes: p.likes || 0,
          price: p.price || 0,
          date: formatDate(p.created_at),
          status: p.is_active ? 'published' : 'draft'
        }));

        const videos = (response.data.videos || []).map(v => ({
          id: v.id,
          type: 'video',
          title: v.title,
          thumbnail: v.thumbnail_url,
          contentUrl: v.content_url,
          views: v.views || 0,
          likes: v.likes || 0,
          price: v.price || 0,
          date: formatDate(v.created_at),
          status: v.is_active ? 'published' : 'draft'
        }));

        setAllContentItems([...photos, ...videos]);
      }
    } catch (error) {
      console.error('Error fetching content:', error);
      setAllContentItems([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`;
  };

  // Filter content based on active tab
  const contentItems = activeTab === 'all'
    ? allContentItems
    : allContentItems.filter(item => {
        if (activeTab === 'photos') return item.type === 'photo';
        if (activeTab === 'videos') return item.type === 'video';
        return true;
      });

  // Calculate stats from real data
  const stats = {
    totalContent: allContentItems.length,
    totalViews: allContentItems.reduce((sum, item) => sum + (item.views || 0), 0),
    totalLikes: allContentItems.reduce((sum, item) => sum + (item.likes || 0), 0),
    totalEarnings: allContentItems.reduce((sum, item) => sum + (item.price || 0) * (item.purchases || 0), 0)
  };

  const contentTypes = [
    { id: 'all', label: 'All', count: allContentItems.length },
    { id: 'photos', label: 'Photos', count: allContentItems.filter(item => item.type === 'photo').length },
    { id: 'videos', label: 'Videos', count: allContentItems.filter(item => item.type === 'video').length }
  ];

  const handleUpload = () => {
    setShowUploadModal(true);
  };

  const handleFileUpload = async (file, type) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      setShowUploadModal(false);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      formData.append('title', file.name.split('.')[0]);
      formData.append('price', 0); // Default free content

      const token = localStorage.getItem('token');

      const response = await axios.post(`${backendUrl}/content/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      if (response.data.success) {
        console.log('Upload successful:', response.data);
        // Refresh content list
        await fetchContent();
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload content. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this content?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${backendUrl}/content/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Remove from local state
      setAllContentItems(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete content. Please try again.');
    }
  };

  const handleEdit = (item) => {
    setSelectedContent(item);
    console.log('Edit content:', item);
    // TODO: Implement edit modal
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 pb-4">
      {/* Upload Progress */}
      {uploading && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4">
            <h3 className="font-semibold mb-3">Uploading...</h3>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2 text-center">{uploadProgress}%</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white pb-6" style={{ paddingTop: 'env(safe-area-inset-top, 20px)' }}>
        <div className="px-4 pt-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">My Content</h1>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="bg-white/20 backdrop-blur-sm p-2 rounded-full active:scale-95 transition-transform disabled:opacity-50"
              aria-label="Upload content"
            >
              <PlusIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
              <p className="text-white/80 text-xs">Total Content</p>
              <p className="text-xl font-bold">{stats.totalContent}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
              <p className="text-white/80 text-xs">Total Views</p>
              <p className="text-xl font-bold">{stats.totalViews.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="px-4 -mt-3">
        <div className="bg-white rounded-xl shadow-sm p-1 flex space-x-1">
          {contentTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setActiveTab(type.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === type.id
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {type.label}
              {type.count > 0 && (
                <span className={`ml-1 text-xs ${
                  activeTab === type.id ? 'text-white/80' : 'text-gray-400'
                }`}>
                  ({type.count})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Upload Button */}
      <div className="px-4 mt-4">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleUpload}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl p-4 flex items-center justify-center space-x-2 shadow-lg"
        >
          <CloudArrowUpIcon className="w-6 h-6" />
          <span className="font-semibold">Upload Content</span>
        </motion.button>
      </div>

      {/* Content Grid */}
      <div className="px-4 mt-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
            <p className="text-gray-500">Loading content...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contentItems.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-md overflow-hidden"
            >
              <div className="flex">
                {/* Thumbnail */}
                <div className="relative w-28 h-28 bg-gray-200 flex-shrink-0">
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                  {item.type === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <VideoCameraIcon className="w-8 h-8 text-white" />
                    </div>
                  )}
                  {item.type === 'post' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-purple-600/20">
                      <DocumentTextIcon className="w-8 h-8 text-purple-600" />
                    </div>
                  )}
                  {item.status === 'draft' && (
                    <div className="absolute top-1 left-1 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full">
                      Draft
                    </div>
                  )}
                </div>

                {/* Content Info */}
                <div className="flex-1 p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">{item.title}</h3>
                      <p className="text-xs text-gray-500">{item.date}</p>
                    </div>
                    <span className="text-purple-600 font-bold text-sm">
                      {item.price} tokens
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center space-x-3 text-xs text-gray-600 mb-2">
                    <div className="flex items-center">
                      <EyeIcon className="w-4 h-4 mr-1" />
                      {item.views}
                    </div>
                    <div className="flex items-center">
                      <StarIcon className="w-4 h-4 mr-1 text-yellow-500" />
                      {item.likes}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="flex-1 bg-purple-100 text-purple-600 py-1.5 px-3 rounded-lg text-xs font-medium active:scale-95"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="flex-1 bg-red-100 text-red-600 py-1.5 px-3 rounded-lg text-xs font-medium active:scale-95"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Empty State */}
          {contentItems.length === 0 && !loading && (
            <div className="text-center py-12">
              <PhotoIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No content yet</p>
              <p className="text-gray-400 text-sm mt-1">Upload your first content to get started</p>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowUploadModal(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 p-6"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
              <h2 className="text-lg font-bold mb-4">Upload Content</h2>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        handleFileUpload(file, 'photos');
                      }
                    };
                    input.click();
                  }}
                  className="w-full flex items-center space-x-3 p-4 bg-purple-50 rounded-xl active:scale-95 transition-transform">
                  <PhotoIcon className="w-6 h-6 text-purple-600" />
                  <div className="flex-1 text-left">
                    <p className="font-semibold">Upload Photo</p>
                    <p className="text-xs text-gray-500">JPG, PNG up to 10MB</p>
                  </div>
                  <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                </button>

                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'video/*';
                    input.onchange = (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        handleFileUpload(file, 'videos');
                      }
                    };
                    input.click();
                  }}
                  className="w-full flex items-center space-x-3 p-4 bg-purple-50 rounded-xl active:scale-95 transition-transform">
                  <VideoCameraIcon className="w-6 h-6 text-purple-600" />
                  <div className="flex-1 text-left">
                    <p className="font-semibold">Upload Video</p>
                    <p className="text-xs text-gray-500">MP4, MOV up to 100MB</p>
                  </div>
                  <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                </button>

              </div>

              <button
                onClick={() => setShowUploadModal(false)}
                className="w-full mt-4 py-3 text-gray-600 font-medium"
              >
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileContent;