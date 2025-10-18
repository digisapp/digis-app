import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  VideoCameraIcon,
  PlayIcon,
  LockClosedIcon,
  EyeIcon,
  ClockIcon,
  CurrencyDollarIcon,
  TrashIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Button from './ui/Button';
import Card from './ui/Card';
import { getAuthToken } from '../utils/auth-helpers';

const CreatorSavedStreams = ({
  user,
  creatorId,
  isOwnProfile = false,
  onPlayStream
}) => {
  const [savedStreams, setSavedStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStream, setSelectedStream] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    fetchSavedStreams();
  }, [creatorId]);

  const fetchSavedStreams = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/streams/creator/${creatorId}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setSavedStreams(data.streams || []);
      }
    } catch (error) {
      console.error('Error fetching saved streams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStreamClick = async (stream) => {
    if (stream.accessType === 'free' || isOwnProfile) {
      // Play directly
      onPlayStream(stream);
    } else {
      // Check if user has already purchased
      const hasPurchased = await checkPurchaseStatus(stream.id);
      if (hasPurchased) {
        onPlayStream(stream);
      } else {
        setSelectedStream(stream);
        setShowPaymentModal(true);
      }
    }
  };

  const checkPurchaseStatus = async (streamId) => {
    if (!user) return false;
    
    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/streams/${streamId}/purchase-status`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        return data.hasPurchased;
      }
    } catch (error) {
      console.error('Error checking purchase status:', error);
    }
    return false;
  };

  const handlePurchaseStream = async () => {
    if (!selectedStream || !user) return;

    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/streams/${selectedStream.id}/purchase`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (response.ok) {
        // toast.success('Stream purchased successfully!');
        setShowPaymentModal(false);
        onPlayStream(selectedStream);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to purchase stream');
      }
    } catch (error) {
      console.error('Error purchasing stream:', error);
      toast.error('Failed to purchase stream');
    }
  };

  const handleDeleteStream = async (streamId) => {
    if (!confirm('Are you sure you want to delete this stream?')) return;

    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/streams/${streamId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (response.ok) {
        // toast.success('Stream deleted successfully');
        setSavedStreams(prev => prev.filter(s => s.id !== streamId));
      } else {
        toast.error('Failed to delete stream');
      }
    } catch (error) {
      console.error('Error deleting stream:', error);
      toast.error('Failed to delete stream');
    }
  };

  const StreamCard = ({ stream }) => {
    const isPaid = stream.accessType === 'paid';
    const canPlay = !isPaid || isOwnProfile;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="group relative"
      >
        <Card className="overflow-hidden hover:shadow-xl transition-all duration-300">
          {/* Thumbnail */}
          <div 
            className="relative aspect-video bg-gradient-to-br from-purple-600 to-pink-600 cursor-pointer"
            onClick={() => handleStreamClick(stream)}
          >
            {stream.thumbnail ? (
              <img
                src={stream.thumbnail}
                alt={stream.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <VideoCameraIcon className="w-16 h-16 text-white/50" />
              </div>
            )}

            {/* Play Overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center">
                <PlayIcon className="w-8 h-8 text-purple-600 ml-1" />
              </div>
            </div>

            {/* Duration Badge */}
            <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-white text-sm">
              {stream.duration || '00:00'}
            </div>

            {/* Access Type Badge */}
            {isPaid && (
              <div className="absolute top-2 left-2 bg-purple-600 px-2 py-1 rounded text-white text-sm flex items-center gap-1">
                <LockClosedIcon className="w-3 h-3" />
                <span>{stream.tokenPrice} tokens</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="font-semibold text-lg mb-2 line-clamp-2">
              {stream.title}
            </h3>
            
            {stream.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                {stream.description}
              </p>
            )}

            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <EyeIcon className="w-4 h-4" />
                  <span>{stream.viewCount || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ClockIcon className="w-4 h-4" />
                  <span>{new Date(stream.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {isOwnProfile && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Handle edit
                      toast.info('Edit functionality coming soon');
                    }}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteStream(stream.id);
                    }}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 dark:bg-gray-700 aspect-video rounded-t-lg" />
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-b-lg">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (savedStreams.length === 0) {
    return (
      <Card className="text-center py-12">
        <VideoCameraIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No Saved Streams
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          {isOwnProfile 
            ? "Your saved streams will appear here after you finish a live stream."
            : "This creator hasn't saved any streams yet."}
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {savedStreams.map((stream) => (
            <StreamCard key={stream.id} stream={stream} />
          ))}
        </AnimatePresence>
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && selectedStream && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPaymentModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <Card className="p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <LockClosedIcon className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Purchase Stream
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Unlock this stream to watch anytime
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
                  <h4 className="font-medium mb-2">{selectedStream.title}</h4>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Price:</span>
                    <div className="flex items-center gap-1 font-semibold">
                      <CurrencyDollarIcon className="w-4 h-4" />
                      <span>{selectedStream.tokenPrice} tokens</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        (${(selectedStream.tokenPrice * 0.05).toFixed(2)})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => setShowPaymentModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={handlePurchaseStream}
                    icon={<CurrencyDollarIcon className="w-5 h-5" />}
                  >
                    Purchase
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CreatorSavedStreams;