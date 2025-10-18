import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import {
  TicketIcon,
  ClockIcon,
  UsersIcon,
  SparklesIcon,
  XMarkIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  BoltIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import Button from './ui/Button';
import { getAuthToken } from '../utils/auth-helpers';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import toast from 'react-hot-toast';

const PrivateShowAnnouncement = ({
  streamId,
  isCreator,
  onShowAnnounced,
  onShowStarted,
  onClose,
  className = ''
}) => {
  // Creator states - Show setup modal immediately when component mounts
  const [showSetupModal, setShowSetupModal] = useState(true);
  const [title, setTitle] = useState('Exclusive Private Show');
  const [description, setDescription] = useState('');
  const [tokenPrice, setTokenPrice] = useState(500);
  const [startTime, setStartTime] = useState('');
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  
  // Shared states
  const [activeShow, setActiveShow] = useState(null);
  const [hasTicket, setHasTicket] = useState(false);
  const [ticketsSold, setTicketsSold] = useState(0);
  const [countdown, setCountdown] = useState('');
  const [currentPrice, setCurrentPrice] = useState(0);
  const [isBuyingTicket, setIsBuyingTicket] = useState(false);
  const [analytics, setAnalytics] = useState(null);

  // Load active show details
  useEffect(() => {
    if (streamId) {
      loadActiveShow();
    }
  }, [streamId]);

  // Countdown timer
  useEffect(() => {
    if (activeShow?.start_time && activeShow.status === 'announced') {
      const interval = setInterval(() => {
        const timeLeft = new Date(activeShow.start_time) - new Date();
        if (timeLeft > 0) {
          const hours = Math.floor(timeLeft / 3600000);
          const minutes = Math.floor((timeLeft % 3600000) / 60000);
          const seconds = Math.floor((timeLeft % 60000) / 1000);
          
          if (hours > 0) {
            setCountdown(`${hours}h ${minutes}m ${seconds}s`);
          } else if (minutes > 0) {
            setCountdown(`${minutes}m ${seconds}s`);
          } else {
            setCountdown(`${seconds}s`);
          }
        } else {
          setCountdown('Starting soon!');
          clearInterval(interval);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [activeShow]);

  const loadActiveShow = async () => {
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/ticketed-shows/stream/${streamId}/active`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );
      
      const data = await response.json();
      if (data.hasActiveShow && data.show) {
        setActiveShow(data.show);
        loadShowDetails(data.show.id);
      }
    } catch (error) {
      console.error('Error loading active show:', error);
    }
  };

  const loadShowDetails = async (showId) => {
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/ticketed-shows/${showId}/details`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );
      
      const data = await response.json();
      if (data.success) {
        setActiveShow(data.show);
        setHasTicket(data.hasTicket);
        setTicketsSold(data.ticketsSold);
        setCurrentPrice(data.show.current_price);
        
        if (isCreator) {
          loadAnalytics(showId);
        }
      }
    } catch (error) {
      console.error('Error loading show details:', error);
    }
  };

  const loadAnalytics = async (showId) => {
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/ticketed-shows/${showId}/analytics`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );
      
      const data = await response.json();
      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const handleAnnounceShow = async () => {
    if (!title || tokenPrice < 1) {
      toast.error('Please fill in required fields');
      return;
    }
    
    if (!streamId) {
      // Use toast.dismiss to clear any existing toasts before showing new one
      toast.dismiss();
      toast.error('You need to be live streaming to announce a private show', {
        id: 'stream-required', // Unique ID prevents duplicates
        duration: 4000
      });
      return;
    }
    
    setIsAnnouncing(true);
    
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/ticketed-shows/announce`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            streamId,
            title,
            description,
            tokenPrice,
            startTime: startTime || null
          })
        }
      );
      
      const data = await response.json();
      if (data.success) {
        setActiveShow(data.show);
        setShowSetupModal(false);
        toast.success('Private show announced! 🎉');
        
        if (onShowAnnounced) {
          onShowAnnounced(data.show);
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to announce show');
    } finally {
      setIsAnnouncing(false);
    }
  };

  const handleStartShow = async () => {
    if (!activeShow) return;
    
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/ticketed-shows/start`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            showId: activeShow.id
          })
        }
      );
      
      const data = await response.json();
      if (data.success) {
        setActiveShow({ ...activeShow, status: 'started', private_mode: true });
        toast.success(`Private show started! ${data.ticketHolders} viewers have access`);
        
        if (onShowStarted) {
          onShowStarted(activeShow.id);
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to start private show');
    }
  };

  const handleEndShow = async () => {
    if (!activeShow) return;
    
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/ticketed-shows/end`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            showId: activeShow.id
          })
        }
      );
      
      const data = await response.json();
      if (data.success) {
        setActiveShow({ ...activeShow, status: 'ended', private_mode: false });
        toast.success('Private show ended');
        
        // Reload to reset state
        loadActiveShow();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to end private show');
    }
  };

  const handleBuyTicket = async () => {
    if (!activeShow || hasTicket) return;
    
    setIsBuyingTicket(true);
    
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/ticketed-shows/buy-ticket`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            showId: activeShow.id
          })
        }
      );
      
      const data = await response.json();
      if (data.success) {
        setHasTicket(true);
        setTicketsSold(ticketsSold + 1);
        toast.success('Ticket purchased! Enjoy the show! 🎫');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      if (error.message.includes('Insufficient tokens')) {
        toast.error('Not enough tokens! Please purchase more tokens.');
      } else {
        toast.error(error.message || 'Failed to buy ticket');
      }
    } finally {
      setIsBuyingTicket(false);
    }
  };

  // Creator view - announcement controls
  if (isCreator) {
    return (
      <>
        {/* Announcement Button - Hidden since modal shows directly */}

        {/* Active Show Controls */}
        {activeShow && (
          <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-xl p-4 border border-purple-500/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold flex items-center gap-2">
                <TicketIcon className="w-5 h-5 text-purple-400" />
                {activeShow.title}
              </h3>
              {activeShow.status === 'announced' && (
                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                  Announced
                </span>
              )}
              {activeShow.status === 'started' && (
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                  Live
                </span>
              )}
            </div>

            {/* Analytics */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                <p className="text-2xl font-bold text-white">{ticketsSold}</p>
                <p className="text-xs text-gray-400">Tickets Sold</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                <p className="text-2xl font-bold text-green-400">
                  {activeShow.total_revenue || 0}
                </p>
                <p className="text-xs text-gray-400">Tokens Earned</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                <p className="text-2xl font-bold text-purple-400">
                  {activeShow.token_price}
                </p>
                <p className="text-xs text-gray-400">Price/Ticket</p>
              </div>
            </div>

            {/* Start Button */}
            {activeShow.status === 'announced' && (
              <div className="space-y-2">
                <Button
                  onClick={handleStartShow}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Start Private Show Now
                </Button>
                
                {/* Show scheduled time if set */}
                {activeShow.start_time && (
                  <div className="text-center">
                    <div className="text-yellow-400 text-sm">
                      Scheduled for: {countdown}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Click "Start Now" to begin immediately
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* End Button */}
            {activeShow.status === 'started' && (
              <Button
                onClick={handleEndShow}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                End Private Show
              </Button>
            )}
          </div>
        )}

        {/* Setup Modal */}
        <AnimatePresence mode="wait">
          {showSetupModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  y: 0,
                  transition: {
                    type: "spring",
                    stiffness: 300,
                    damping: 25,
                    delay: 0.1
                  }
                }}
                exit={{
                  scale: 0.95,
                  opacity: 0,
                  y: 10,
                  transition: {
                    duration: 0.15
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto border border-purple-500/20 shadow-2xl shadow-purple-500/10 pointer-events-auto"
              >
                {/* Gradient Header */}
                <div className="flex items-center justify-between mb-6">
                  <motion.h2
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-3"
                  >
                    <motion.div
                      initial={{ rotate: -180, scale: 0 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{ type: "spring", delay: 0.3 }}
                    >
                      <SparklesIcon className="w-7 h-7 text-purple-400" />
                    </motion.div>
                    Private Show
                  </motion.h2>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowSetupModal(false)}
                    className="p-2 hover:bg-gray-800/50 rounded-full transition-all"
                  >
                    <XMarkIcon className="w-5 h-5 text-gray-400 hover:text-white" />
                  </motion.button>
                </div>

                <div className="space-y-4">
                  {/* Title */}
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <label className="text-sm text-gray-400 mb-2 block flex items-center gap-2">
                      <TicketIcon className="w-4 h-4 text-purple-400" />
                      Show Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Exclusive Q&A Session"
                      className="w-full bg-gray-800/50 backdrop-blur text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-gray-800 transition-all border border-gray-700/50 hover:border-purple-500/50"
                    />
                  </motion.div>

                  {/* Description */}
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Tell viewers what to expect..."
                      rows={3}
                      className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {/* Token Price */}
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">
                      Ticket Price (Tokens) *
                    </label>
                    <input
                      type="number"
                      value={tokenPrice}
                      onChange={(e) => setTokenPrice(parseInt(e.target.value) || 0)}
                      min="1"
                      className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {/* Start Time */}
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">
                      When will the private show start?
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setStartTime('')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          !startTime 
                            ? 'bg-purple-600 text-white' 
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        Start Now
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const in15min = new Date(Date.now() + 15 * 60000);
                          setStartTime(in15min.toISOString().slice(0, 16));
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          startTime && new Date(startTime).getTime() === new Date(Date.now() + 15 * 60000).getTime()
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        In 15 min
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const in30min = new Date(Date.now() + 30 * 60000);
                          setStartTime(in30min.toISOString().slice(0, 16));
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          startTime && new Date(startTime).getTime() === new Date(Date.now() + 30 * 60000).getTime()
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        In 30 min
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const in1hour = new Date(Date.now() + 60 * 60000);
                          setStartTime(in1hour.toISOString().slice(0, 16));
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          startTime && new Date(startTime).getTime() === new Date(Date.now() + 60 * 60000).getTime()
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        In 1 hour
                      </button>
                    </div>
                    {startTime && (
                      <div className="text-xs text-purple-400 mt-2">
                        Starts: {new Date(startTime).toLocaleString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => setShowSetupModal(false)}
                      variant="secondary"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAnnounceShow}
                      disabled={isAnnouncing || !title || tokenPrice < 1}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                    >
                      {isAnnouncing ? 'Announcing...' : 'Announce Show'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Viewer view - ticket purchase
  if (activeShow && !isCreator) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-xl p-4 border border-purple-500/30 ${className}`}
      >
        {/* Show Info */}
        <div className="mb-3">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-yellow-400" />
            {activeShow.title}
          </h3>
          {activeShow.description && (
            <p className="text-gray-300 text-sm mt-1">{activeShow.description}</p>
          )}
        </div>

        {/* Show Stats */}
        <div className="flex items-center gap-4 mb-3 text-sm">
          <div className="flex items-center gap-1 text-gray-300">
            <UsersIcon className="w-4 h-4" />
            <span>{ticketsSold} attending</span>
          </div>
          {countdown && activeShow.status === 'announced' && (
            <div className="flex items-center gap-1 text-yellow-400">
              <ClockIcon className="w-4 h-4" />
              <span>{countdown}</span>
            </div>
          )}
        </div>

        {/* Purchase Section */}
        {!hasTicket ? (
          <div className="bg-gray-800/50 rounded-lg p-3">
            {/* Price Display */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-white">{activeShow.token_price}</span>
                <span className="text-sm text-gray-400">tokens</span>
              </div>
            </div>

            {/* Buy Button */}
            <Button
              onClick={handleBuyTicket}
              disabled={isBuyingTicket || (activeShow.status === 'ended')}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {isBuyingTicket ? (
                'Processing...'
              ) : activeShow.status === 'started' ? (
                'Buy Ticket & Join Now'
              ) : (
                'Buy Ticket'
              )}
            </Button>

            {activeShow.status === 'started' && (
              <p className="text-xs text-yellow-400 text-center mt-2">
                Show in progress - join now!
              </p>
            )}
          </div>
        ) : (
          <div className="bg-green-900/30 rounded-lg p-3 border border-green-500/30">
            <div className="flex items-center gap-2 text-green-400">
              <TicketIcon className="w-5 h-5" />
              <span className="font-semibold">You have a ticket!</span>
            </div>
            {activeShow.status === 'announced' && (
              <p className="text-sm text-gray-300 mt-1">
                You'll get full access when the show starts
              </p>
            )}
            {activeShow.status === 'started' && (
              <p className="text-sm text-yellow-400 mt-1">
                Private show is live - enjoy full access!
              </p>
            )}
          </div>
        )}
      </motion.div>
    );
  }

  return null;
};

PrivateShowAnnouncement.propTypes = {
  streamId: PropTypes.string.isRequired,
  isCreator: PropTypes.bool.isRequired,
  onShowAnnounced: PropTypes.func,
  onShowStarted: PropTypes.func,
  onClose: PropTypes.func,
  className: PropTypes.string
};

export default PrivateShowAnnouncement;