import React, { useState, useCallback } from 'react';
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

const MobileContent = ({ user, onNavigate }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);

  // Mock content data
  const [allContentItems] = useState([
    {
      id: 1,
      type: 'photo',
      title: 'Beach Sunset',
      thumbnail: '/api/placeholder/150/150',
      views: 234,
      likes: 45,
      price: 50,
      date: '2 days ago',
      status: 'published'
    },
    {
      id: 2,
      type: 'video',
      title: 'Behind the Scenes',
      thumbnail: '/api/placeholder/150/150',
      views: 567,
      likes: 123,
      price: 100,
      date: '1 week ago',
      status: 'published'
    },
    {
      id: 3,
      type: 'photo',
      title: 'New Photoshoot',
      thumbnail: '/api/placeholder/150/150',
      views: 890,
      likes: 234,
      price: 75,
      date: '2 weeks ago',
      status: 'draft'
    },
    {
      id: 4,
      type: 'post',
      title: 'My thoughts on the new update',
      thumbnail: '/api/placeholder/150/150',
      views: 120,
      likes: 45,
      price: 25,
      date: '3 weeks ago',
      status: 'published'
    },
    {
      id: 5,
      type: 'video',
      title: 'Tutorial: Getting Started',
      thumbnail: '/api/placeholder/150/150',
      views: 2340,
      likes: 567,
      price: 150,
      date: '1 month ago',
      status: 'published'
    }
  ]);

  // Filter content based on active tab
  const contentItems = activeTab === 'all'
    ? allContentItems
    : allContentItems.filter(item => {
        if (activeTab === 'photos') return item.type === 'photo';
        if (activeTab === 'videos') return item.type === 'video';
        if (activeTab === 'posts') return item.type === 'post';
        return true;
      });

  const stats = {
    totalContent: 42,
    totalViews: 12500,
    totalEarnings: 3250,
    avgRating: 4.8
  };

  const contentTypes = [
    { id: 'all', label: 'All', count: allContentItems.length },
    { id: 'photos', label: 'Photos', count: allContentItems.filter(item => item.type === 'photo').length },
    { id: 'videos', label: 'Videos', count: allContentItems.filter(item => item.type === 'video').length },
    { id: 'posts', label: 'Posts', count: allContentItems.filter(item => item.type === 'post').length }
  ];

  const handleUpload = () => {
    setShowUploadModal(true);
  };

  const handleDelete = (id) => {
    console.log('Delete content:', id);
  };

  const handleEdit = (item) => {
    setSelectedContent(item);
    console.log('Edit content:', item);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 pb-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white pb-6" style={{ paddingTop: 'env(safe-area-inset-top, 20px)' }}>
        <div className="px-4 pt-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">My Content</h1>
            <button
              onClick={handleUpload}
              className="bg-white/20 backdrop-blur-sm p-2 rounded-full active:scale-95 transition-transform"
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
        </div>

        {/* Empty State */}
        {contentItems.length === 0 && (
          <div className="text-center py-12">
            <PhotoIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No content yet</p>
            <p className="text-gray-400 text-sm mt-1">Upload your first content to get started</p>
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
                    console.log('Upload Photo clicked');
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        console.log('Photo selected:', file.name);
                        setShowUploadModal(false);
                        // Handle file upload here
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
                    console.log('Upload Video clicked');
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'video/*';
                    input.onchange = (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        console.log('Video selected:', file.name);
                        setShowUploadModal(false);
                        // Handle file upload here
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

                <button
                  onClick={() => {
                    console.log('Create Post clicked - this would bundle photos/videos with text');
                    setShowUploadModal(false);
                    // This should open a media post creator that allows:
                    // 1. Selecting multiple photos/videos
                    // 2. Adding captions/descriptions
                    // 3. Setting price for the bundle
                    alert('Post creation will bundle your photos/videos with captions - coming soon!');
                  }}
                  className="w-full flex items-center space-x-3 p-4 bg-purple-50 rounded-xl active:scale-95 transition-transform">
                  <DocumentTextIcon className="w-6 h-6 text-purple-600" />
                  <div className="flex-1 text-left">
                    <p className="font-semibold">Create Post</p>
                    <p className="text-xs text-gray-500">Bundle photos/videos with captions</p>
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