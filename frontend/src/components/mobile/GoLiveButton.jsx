// /src/components/mobile/GoLiveButton.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { RadioIcon } from '@heroicons/react/24/solid'; // or use VideoCameraIcon

/**
 * GoLiveButton - Floating Action Button for mobile creators
 *
 * A clean, tappable FAB with micro-animation for going live.
 * Position: Fixed bottom-right above navigation bar
 *
 * @param {Function} onGoLive - Callback to open mobile live stream modal
 * @param {boolean} disabled - Disable button (e.g., during initialization)
 */
export default function GoLiveButton({ onGoLive, disabled = false }) {
  return (
    <motion.button
      type="button"
      onClick={() => !disabled && onGoLive?.()}
      whileTap={{ scale: 0.95 }}
      initial={{ y: 0, opacity: 1 }}
      animate={{ y: 0, opacity: 1 }}
      className={`fixed bottom-20 right-5 z-[110] rounded-full shadow-xl px-5 h-14 flex items-center gap-2
        ${disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700'}
        text-white transition-all duration-200`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Go Live"
      disabled={disabled}
    >
      <RadioIcon className="w-6 h-6" aria-hidden="true" />
      <span className="font-semibold">Go Live</span>
    </motion.button>
  );
}
