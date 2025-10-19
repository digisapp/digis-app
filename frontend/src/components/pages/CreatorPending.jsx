import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  EnvelopeIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../../utils/supabase-auth';

/**
 * CreatorPending - Waiting room for creator applications
 * Shows application status while waiting for admin approval
 */
const CreatorPending = () => {
  const navigate = useNavigate();
  const [applicationStatus, setApplicationStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    checkApplicationStatus();
  }, []);

  const checkApplicationStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Not logged in, redirect to login
        navigate('/login');
        return;
      }

      setUserEmail(user.email);

      // Check if user is already approved as creator
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/profile`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();

        if (data.is_creator) {
          // Already approved! Redirect to creator dashboard
          setApplicationStatus('approved');
          setTimeout(() => {
            navigate('/dashboard');
          }, 2000);
        } else {
          // Still pending
          setApplicationStatus('pending');
        }
      }
    } catch (error) {
      console.error('Error checking application status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Checking application status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-purple-900 flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full"
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 md:p-12">
          {/* Status Icon */}
          <div className="text-center mb-8">
            {applicationStatus === 'pending' && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full mb-4"
              >
                <ClockIcon className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
              </motion.div>
            )}

            {applicationStatus === 'approved' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full mb-4"
              >
                <CheckCircleIcon className="w-10 h-10 text-green-600 dark:text-green-400" />
              </motion.div>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-4 bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
            {applicationStatus === 'pending' ? 'Application Under Review' : 'Application Approved!'}
          </h1>

          {/* Description */}
          <div className="text-center mb-8">
            {applicationStatus === 'pending' && (
              <>
                <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                  Thank you for applying to become a Digis creator!
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  Your application is currently being reviewed by our team. This typically takes 24-48 hours.
                </p>
              </>
            )}

            {applicationStatus === 'approved' && (
              <>
                <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                  Congratulations! Your creator application has been approved.
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  Redirecting you to your creator dashboard...
                </p>
              </>
            )}
          </div>

          {/* What Happens Next */}
          {applicationStatus === 'pending' && (
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <EnvelopeIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                What Happens Next?
              </h2>
              <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">1</span>
                  </div>
                  <span>Our admin team will review your application</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">2</span>
                  </div>
                  <span>You'll receive an email notification with the decision</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">3</span>
                  </div>
                  <span>Once approved, you can start streaming and earning!</span>
                </li>
              </ul>
            </div>
          )}

          {/* Email Notification */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-8">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              We'll send updates to: <span className="font-semibold text-gray-900 dark:text-white">{userEmail}</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => navigate('/explore')}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-200 flex items-center justify-center gap-2"
            >
              Browse Creators
              <ArrowRightIcon className="w-5 h-5" />
            </button>

            {applicationStatus === 'pending' && (
              <button
                onClick={checkApplicationStatus}
                className="flex-1 px-6 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-2 border-purple-200 dark:border-purple-800 rounded-lg font-semibold hover:bg-purple-50 dark:hover:bg-gray-600 transition-all duration-200"
              >
                Refresh Status
              </button>
            )}
          </div>

          {/* Help Text */}
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            Questions? Contact us at <a href="mailto:support@digis.cc" className="text-purple-600 dark:text-purple-400 hover:underline">support@digis.cc</a>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default CreatorPending;
