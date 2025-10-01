import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import {
  ArrowDownTrayIcon,
  ShareIcon,
  PencilIcon,
  CameraIcon,
  UserCircleIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const CompCard = ({ 
  user, 
  digitals = [], 
  isEditable = false,
  onSave 
}) => {
  const cardRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedImages, setSelectedImages] = useState({
    main: null,
    look1: null,
    look2: null,
    look3: null,
    look4: null
  });
  
  const [modelStats, setModelStats] = useState({
    height: user?.model_stats?.height || '',
    bust: user?.model_stats?.bust || '',
    waist: user?.model_stats?.waist || '',
    hips: user?.model_stats?.hips || '',
    shoe: user?.model_stats?.shoe || '',
    hair: user?.model_stats?.hair || '',
    eyes: user?.model_stats?.eyes || '',
    agency: user?.agency || ''
  });

  const [cardSide, setCardSide] = useState('front'); // front or back

  // Auto-select best images if not already selected
  useEffect(() => {
    if (digitals.length > 0 && !selectedImages.main) {
      const headshots = digitals.filter(d => d.category === 'headshots');
      const fullBody = digitals.filter(d => d.category === 'full-body');
      const editorial = digitals.filter(d => d.category === 'editorial');
      const commercial = digitals.filter(d => d.category === 'commercial');
      
      setSelectedImages({
        main: headshots[0] || digitals[0],
        look1: fullBody[0] || digitals[1],
        look2: editorial[0] || digitals[2],
        look3: commercial[0] || digitals[3],
        look4: digitals[4] || null
      });
    }
  }, [digitals]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    
    try {
      // Capture front side
      const frontCanvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2
      });
      
      // Flip to back
      setCardSide('back');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Capture back side
      const backCanvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2
      });
      
      // Create combined image
      const combinedCanvas = document.createElement('canvas');
      combinedCanvas.width = frontCanvas.width;
      combinedCanvas.height = frontCanvas.height * 2;
      const ctx = combinedCanvas.getContext('2d');
      
      ctx.drawImage(frontCanvas, 0, 0);
      ctx.drawImage(backCanvas, 0, frontCanvas.height);
      
      // Download
      const link = document.createElement('a');
      link.download = `${user?.username || 'model'}-comp-card.png`;
      link.href = combinedCanvas.toDataURL();
      link.click();
      
      // Reset to front
      setCardSide('front');
      toast.success('Comp card downloaded!');
    } catch (error) {
      console.error('Error downloading comp card:', error);
      toast.error('Failed to download comp card');
    }
  };

  const handleShare = async () => {
    try {
      const shareUrl = `${window.location.origin}/${user?.username}/digitals`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Portfolio link copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleSaveStats = async () => {
    if (onSave) {
      await onSave(modelStats, selectedImages);
      setIsEditing(false);
      toast.success('Comp card updated!');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Comp Card
        </h2>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-1 flex">
            <button
              onClick={() => setCardSide('front')}
              className={`px-3 py-1.5 rounded transition-all text-sm font-medium ${
                cardSide === 'front'
                  ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Front
            </button>
            <button
              onClick={() => setCardSide('back')}
              className={`px-3 py-1.5 rounded transition-all text-sm font-medium ${
                cardSide === 'back'
                  ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Back
            </button>
          </div>
          
          {isEditable && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <PencilIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          )}
          
          <button
            onClick={handleShare}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ShareIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all flex items-center gap-2"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            Download
          </button>
        </div>
      </div>

      {/* Comp Card */}
      <div 
        ref={cardRef}
        className="bg-white rounded-xl shadow-2xl overflow-hidden"
        style={{ aspectRatio: '8.5/5.5' }} // Standard comp card ratio
      >
        <AnimatePresence mode="wait">
          {cardSide === 'front' ? (
            /* Front Side */
            <motion.div
              key="front"
              initial={{ rotateY: 180, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: -180, opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="w-full h-full p-8 flex items-center justify-between"
            >
              {/* Main Photo */}
              <div className="w-2/3 h-full">
                {selectedImages.main ? (
                  <img
                    src={selectedImages.main.file_url}
                    alt="Main headshot"
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
                    <CameraIcon className="w-20 h-20 text-gray-400" />
                  </div>
                )}
              </div>
              
              {/* Info Section */}
              <div className="w-1/3 h-full flex flex-col justify-center px-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                  {user?.display_name || user?.username}
                </h1>
                <div className="space-y-2 text-gray-600">
                  <p className="text-lg">Height: <span className="font-semibold">{modelStats.height || 'N/A'}</span></p>
                  <p className="text-lg">Bust: <span className="font-semibold">{modelStats.bust || 'N/A'}</span></p>
                  <p className="text-lg">Waist: <span className="font-semibold">{modelStats.waist || 'N/A'}</span></p>
                  <p className="text-lg">Hips: <span className="font-semibold">{modelStats.hips || 'N/A'}</span></p>
                  <p className="text-lg">Shoe: <span className="font-semibold">{modelStats.shoe || 'N/A'}</span></p>
                  <p className="text-lg">Hair: <span className="font-semibold">{modelStats.hair || 'N/A'}</span></p>
                  <p className="text-lg">Eyes: <span className="font-semibold">{modelStats.eyes || 'N/A'}</span></p>
                </div>
                {modelStats.agency && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <p className="text-sm text-gray-500">AGENCY</p>
                    <p className="text-lg font-semibold text-gray-900">{modelStats.agency}</p>
                  </div>
                )}
                <div className="mt-auto pt-6">
                  <p className="text-sm text-gray-500">digis.cc/{user?.username}</p>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Back Side */
            <motion.div
              key="back"
              initial={{ rotateY: -180, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: 180, opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="w-full h-full p-8"
            >
              {/* Grid of Additional Looks */}
              <div className="grid grid-cols-2 gap-4 h-full">
                {['look1', 'look2', 'look3', 'look4'].map((look, index) => (
                  <div key={look} className="relative group">
                    {selectedImages[look] ? (
                      <img
                        src={selectedImages[look].file_url}
                        alt={`Look ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
                        <CameraIcon className="w-16 h-16 text-gray-400" />
                      </div>
                    )}
                    {isEditing && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <button className="p-2 bg-white rounded-lg">
                          <ArrowPathIcon className="w-5 h-5 text-gray-900" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Footer */}
              <div className="absolute bottom-8 left-8 right-8 flex justify-between items-center">
                <p className="text-2xl font-bold text-gray-900">
                  {user?.display_name || user?.username}
                </p>
                <p className="text-gray-600">digis.cc/{user?.username}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Edit Panel */}
      {isEditing && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Edit Model Stats
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Height (e.g., 5'10)"
              value={modelStats.height}
              onChange={(e) => setModelStats({...modelStats, height: e.target.value})}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              placeholder="Bust"
              value={modelStats.bust}
              onChange={(e) => setModelStats({...modelStats, bust: e.target.value})}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              placeholder="Waist"
              value={modelStats.waist}
              onChange={(e) => setModelStats({...modelStats, waist: e.target.value})}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              placeholder="Hips"
              value={modelStats.hips}
              onChange={(e) => setModelStats({...modelStats, hips: e.target.value})}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              placeholder="Shoe Size"
              value={modelStats.shoe}
              onChange={(e) => setModelStats({...modelStats, shoe: e.target.value})}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              placeholder="Hair Color"
              value={modelStats.hair}
              onChange={(e) => setModelStats({...modelStats, hair: e.target.value})}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              placeholder="Eye Color"
              value={modelStats.eyes}
              onChange={(e) => setModelStats({...modelStats, eyes: e.target.value})}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              placeholder="Agency"
              value={modelStats.agency}
              onChange={(e) => setModelStats({...modelStats, agency: e.target.value})}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Select Images from Your Digitals
            </h4>
            <div className="grid grid-cols-4 gap-3">
              {digitals.slice(0, 12).map((digital) => (
                <button
                  key={digital.id}
                  onClick={() => {
                    // Logic to assign image to a position
                    toast.success('Click on a position to assign this image');
                  }}
                  className="aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500 transition-all"
                >
                  <img
                    src={digital.thumbnail_url || digital.file_url}
                    alt={digital.title}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveStats}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all"
            >
              Save Changes
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default CompCard;