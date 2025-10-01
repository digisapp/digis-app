import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShareIcon, 
  LinkIcon, 
  FilmIcon,
  CheckIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline';
import { 
  FaTwitter, 
  FaFacebook, 
  FaInstagram, 
  FaDiscord,
  FaTiktok,
  FaWhatsapp 
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const StreamQuickShare = ({ streamTitle, streamerName, streamUrl, onCreateClip, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showClipCreated, setShowClipCreated] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const shareOptions = [
    { 
      name: 'Twitter', 
      icon: FaTwitter, 
      color: 'hover:bg-[#1DA1F2]/20 hover:text-[#1DA1F2]',
      action: () => shareToTwitter()
    },
    { 
      name: 'Facebook', 
      icon: FaFacebook, 
      color: 'hover:bg-[#4267B2]/20 hover:text-[#4267B2]',
      action: () => shareToFacebook()
    },
    { 
      name: 'Instagram', 
      icon: FaInstagram, 
      color: 'hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-pink-500/20 hover:text-pink-500',
      action: () => shareToInstagram()
    },
    { 
      name: 'Discord', 
      icon: FaDiscord, 
      color: 'hover:bg-[#5865F2]/20 hover:text-[#5865F2]',
      action: () => shareToDiscord()
    },
    { 
      name: 'TikTok', 
      icon: FaTiktok, 
      color: 'hover:bg-black/20 hover:text-white',
      action: () => shareToTikTok()
    },
    { 
      name: 'WhatsApp', 
      icon: FaWhatsapp, 
      color: 'hover:bg-[#25D366]/20 hover:text-[#25D366]',
      action: () => shareToWhatsApp()
    }
  ];

  const shareToTwitter = () => {
    const text = `🔴 LIVE NOW: ${streamTitle} by @${streamerName} on @DigisLive`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(streamUrl)}`;
    window.open(url, '_blank');
  };

  const shareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(streamUrl)}`;
    window.open(url, '_blank');
  };

  const shareToInstagram = () => {
    // Instagram doesn't have direct URL sharing, so copy link
    copyStreamLink();
    // toast.success('Link copied! Share it on Instagram Stories or DM');
  };

  const shareToDiscord = () => {
    copyStreamLink();
    // toast.success('Link copied! Paste it in your Discord server');
  };

  const shareToTikTok = () => {
    copyStreamLink();
    // toast.success('Link copied! Share it on TikTok');
  };

  const shareToWhatsApp = () => {
    const text = `🔴 LIVE NOW: ${streamTitle} by ${streamerName}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text + ' ' + streamUrl)}`;
    window.open(url, '_blank');
  };

  const copyStreamLink = async () => {
    try {
      await navigator.clipboard.writeText(streamUrl);
      setCopiedLink(true);
      // toast.success('Stream link copied!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const createClip = () => {
    setShowClipCreated(true);
    if (onCreateClip) {
      onCreateClip();
    }
    
    toast.custom((t) => (
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3"
      >
        <FilmIcon className="w-6 h-6" />
        <div>
          <p className="font-bold">Clip Created!</p>
          <p className="text-sm opacity-90">Last 30 seconds saved</p>
        </div>
      </motion.div>
    ), { duration: 3000 });

    setTimeout(() => setShowClipCreated(false), 3000);
  };

  return (
    <>
      {/* Share Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 bg-black/60 backdrop-blur-md rounded-lg hover:bg-black/80 transition-colors border border-white/10 ${className}`}
      >
        <ShareIcon className="w-5 h-5 text-white" />
      </motion.button>

      {/* Share Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-purple-500/20 z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="relative p-6 pb-4 border-b border-gray-800">
                <h2 className="text-2xl font-bold text-white">Share Stream</h2>
                <p className="text-gray-400 text-sm mt-1">Share this live stream with your friends</p>
                
                <button
                  onClick={() => setIsOpen(false)}
                  className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Quick Actions */}
                <div className="space-y-3">
                  {/* Copy Link */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={copyStreamLink}
                    className="w-full flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-800 rounded-xl transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-600/20 rounded-lg">
                        <LinkIcon className="w-5 h-5 text-purple-400" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-white">Copy Stream Link</p>
                        <p className="text-xs text-gray-400">Share anywhere</p>
                      </div>
                    </div>
                    {copiedLink ? (
                      <CheckIcon className="w-5 h-5 text-green-400" />
                    ) : (
                      <span className="text-xs text-gray-500 group-hover:text-gray-300">Click to copy</span>
                    )}
                  </motion.button>

                  {/* Create Clip */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={createClip}
                    className="w-full flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-800 rounded-xl transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-pink-600/20 rounded-lg">
                        <FilmIcon className="w-5 h-5 text-pink-400" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-white">Create Clip</p>
                        <p className="text-xs text-gray-400">Save last 30 seconds</p>
                      </div>
                    </div>
                    {showClipCreated ? (
                      <CheckIcon className="w-5 h-5 text-green-400" />
                    ) : (
                      <span className="text-xs text-gray-500 group-hover:text-gray-300">Create</span>
                    )}
                  </motion.button>
                </div>

                {/* Social Share */}
                <div>
                  <p className="text-sm text-gray-400 mb-3">Share on social media</p>
                  <div className="grid grid-cols-3 gap-3">
                    {shareOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <motion.button
                          key={option.name}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={option.action}
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-800/30 transition-all ${option.color}`}
                        >
                          <Icon className="w-6 h-6" />
                          <span className="text-xs font-medium">{option.name}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default StreamQuickShare;