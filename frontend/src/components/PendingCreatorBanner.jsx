import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SparklesIcon,
  XMarkIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../utils/supabase-auth';
import toast from 'react-hot-toast';
import Confetti from 'react-confetti';

/**
 * PendingCreatorBanner - Shows for users with pending creator applications
 * Displays at top of page, dismissible, with real-time approval detection
 */
const PendingCreatorBanner = ({ user }) => {
  const navigate = useNavigate();
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    checkApplicationStatus();

    // Check status every 30 seconds
    const interval = setInterval(checkApplicationStatus, 30000);

    return () => clearInterval(interval);
  }, [user]);

  const checkApplicationStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setIsLoading(false);
        return;
      }

      // Check current user profile
      const profileResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/profile`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();

        // If already a creator, don't show banner
        if (profileData.is_creator) {
          setApplicationStatus('approved');
          setIsLoading(false);

          // Show celebration if we just detected approval
          if (applicationStatus === 'pending') {
            handleApprovalCelebration();
          }
          return;
        }
      }

      // Check for pending creator application
      const appResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/creators/application/status`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (appResponse.ok) {
        const appData = await appResponse.json();

        if (appData.application) {
          setApplicationStatus(appData.application.status);
        } else {
          setApplicationStatus(null);
        }
      }
    } catch (error) {
      console.error('Error checking application status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprovalCelebration = () => {
    setShowCelebration(true);

    // Show celebration toast
    toast.success(
      '🎉 Congratulations! You\'re now a creator! Access your dashboard to start earning!',
      {
        duration: 8000,
        icon: '✨',
        style: {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontWeight: 'bold'
        }
      }
    );

    // Hide confetti after 5 seconds
    setTimeout(() => {
      setShowCelebration(false);
      setIsDismissed(true);
    }, 5000);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    // Store dismissal in localStorage for this session
    localStorage.setItem(`dismissed_creator_banner_${user?.id}`, Date.now().toString());
  };

  // Don't show if:
  // - Loading
  // - No application or not pending
  // - User is already a creator
  // - Banner is dismissed
  if (isLoading || !applicationStatus || applicationStatus !== 'pending' || isDismissed) {
    return null;
  }

  return (
    <>
      {/* Confetti celebration when approved */}
      <AnimatePresence>
        {showCelebration && (
          <Confetti
            width={window.innerWidth}
            height={window.innerHeight}
            recycle={false}
            numberOfPieces={500}
            gravity={0.3}
          />
        )}
      </AnimatePresence>

      {/* Banner */}
      <AnimatePresence>
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="relative bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 text-white shadow-lg z-50"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              {/* Icon + Message */}
              <div className="flex items-center gap-3 flex-1">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex-shrink-0"
                >
                  <SparklesIcon className="w-6 h-6 text-yellow-300" />
                </motion.div>

                <div className="flex-1">
                  <p className="text-sm sm:text-base font-semibold flex items-center gap-2">
                    <ClockIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    Creator Application Pending
                  </p>
                  <p className="text-xs sm:text-sm text-white/90 mt-0.5">
                    Browse as a fan while we review! You'll be notified when approved (usually 24-48 hours)
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => navigate('/creator/pending')}
                  className="hidden sm:flex items-center gap-1 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg font-medium text-sm transition-all"
                >
                  Check Status
                  <ArrowRightIcon className="w-4 h-4" />
                </button>

                <button
                  onClick={handleDismiss}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                  aria-label="Dismiss"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Animated bottom border */}
          <motion.div
            className="absolute bottom-0 left-0 h-1 bg-yellow-300"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 48, repeat: Infinity }} // 48 hours = 48 seconds animation
          />
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default PendingCreatorBanner;
