import React, { useState, useEffect, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import { useDebouncedCallback } from '../utils/debounce';
import { useAccessibleModal, useAccessibleButton } from '../hooks/useAccessibility';
import {
  XMarkIcon,
  VideoCameraIcon,
  PhoneIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  PaperAirplaneIcon,
  CurrencyDollarIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  InformationCircleIcon,
  BellIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import Button from './ui/Button';
import { customToast } from './ui/EnhancedToaster';
import { getAuthToken } from '../utils/supabase-auth';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import PackageDealsSection from './PackageDealsSection';

const CallInviteModal = memo(({ 
  isOpen, 
  onClose, 
  fanData = null, // Optional pre-selected user (fan or creator)
  onInviteSent,
  creatorType = 'general' // general, health-coach, yoga, fitness, wellness, consultant
}) => {
  const [inviteType, setInviteType] = useState('video'); // video or voice
  const [scheduleType, setScheduleType] = useState('now'); // now or scheduled
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [duration, setDuration] = useState(30); // minutes
  const [message, setMessage] = useState('');
  const [selectedFan, setSelectedFan] = useState(fanData);
  const [fanSearch, setFanSearch] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState('weekly'); // weekly, biweekly, monthly
  const [recurringCount, setRecurringCount] = useState(4);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [usePackage, setUsePackage] = useState(false);

  // Get personalized message based on creator type
  const getDefaultMessage = () => {
    const messages = {
      'health-coach': "Hi! I'd like to invite you for a health coaching session where we can discuss your wellness goals and create a personalized plan.",
      'yoga': "Hello! I'd love to invite you for a personal yoga session where we can work on your practice and alignment.",
      'fitness': "Hey! Let's schedule a training session where I can help you reach your fitness goals with a customized workout.",
      'wellness': "Hello! I'd like to invite you for a wellness consultation to discuss your holistic health journey.",
      'consultant': "Hi! I'd like to schedule a consultation session to understand your needs and how I can best support you.",
      'general': "Hi! I'd like to invite you for a one-on-one session."
    };
    
    return messages[creatorType] || messages.general;
  };

  // Set default message on mount
  useEffect(() => {
    if (!message) {
      setMessage(getDefaultMessage());
    }
  }, []);

  // Debounced user search (fans or creators)
  const searchUsers = useCallback(async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        customToast.error('Authentication required');
        return;
      }
      
      // Replace with actual API call when endpoint is ready
      // const response = await fetchWithRetry(`${import.meta.env.VITE_BACKEND_URL}/users/search`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${token}`
      //   },
      //   body: JSON.stringify({ query, type: 'all' }) // Search both fans and creators
      // });
      
      // Simulate API delay for now
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock results
      const mockFans = getMockFans();
      const filtered = mockFans.filter(fan => 
        fan.displayName.toLowerCase().includes(query.toLowerCase()) ||
        fan.username.toLowerCase().includes(query.toLowerCase())
      );

      setSearchResults(filtered);
    } catch (error) {
      console.error('Error searching fans:', error);
      customToast.error('Failed to search users');
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search handler
  const debouncedSearch = useDebouncedCallback(searchUsers, 300);

  const handleFanSearch = (e) => {
    const query = e.target.value;
    setFanSearch(query);
    debouncedSearch(query);
  };
  
  // Helper function for mock data
  const getMockFans = () => [
    { id: 1, username: 'alice123', displayName: 'Alice Johnson', tier: 'VIP', totalSpent: 2450, lastSession: '2024-03-01', sessionCount: 12 },
    { id: 2, username: 'bob_smith', displayName: 'Bob Smith', tier: 'Gold', totalSpent: 1890, lastSession: '2024-03-05', sessionCount: 8 },
    { id: 3, username: 'carol_w', displayName: 'Carol Williams', tier: 'Silver', totalSpent: 1340, lastSession: '2024-02-28', sessionCount: 6 },
    { id: 4, username: 'david_chen', displayName: 'David Chen', tier: 'Bronze', totalSpent: 890, lastSession: '2024-03-10', sessionCount: 4 },
    { id: 5, username: 'emma_davis', displayName: 'Emma Davis', tier: 'VIP', totalSpent: 3200, lastSession: '2024-03-12', sessionCount: 15 }
  ];

  const selectFan = (fan) => {
    setSelectedFan(fan);
    setFanSearch('');
    setSearchResults([]);
  };

  const calculateCost = () => {
    if (usePackage && selectedPackage) {
      return selectedPackage.pricing.final;
    }
    const ratePerMin = inviteType === 'video' ? 8 : 6;
    return duration * ratePerMin;
  };

  const calculateUSD = (tokens) => {
    return (tokens * 0.05).toFixed(2);
  };
  
  // Modal accessibility
  const modalProps = useAccessibleModal(isOpen, onClose, 'Invite fan to session');

  const handleSendInvite = async () => {
    if (!selectedFan) {
      customToast.error('Please select a fan to invite');
      return;
    }

    if (scheduleType === 'scheduled' && (!selectedDate || !selectedTime)) {
      customToast.error('Please select date and time for the scheduled call');
      return;
    }

    setSending(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        customToast.error('Authentication required');
        return;
      }

      // API call with retry logic
      const response = await fetchWithRetry(`${import.meta.env.VITE_BACKEND_URL}/sessions/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: inviteType,
          fanId: selectedFan.id,
          scheduled: scheduleType === 'scheduled',
          date: selectedDate,
          time: selectedTime,
          duration: usePackage && selectedPackage ? selectedPackage.duration : duration,
          message,
          isRecurring,
          recurringFrequency: isRecurring ? recurringFrequency : null,
          recurringCount: isRecurring ? recurringCount : null,
          totalCost: isRecurring ? calculateCost() * recurringCount : calculateCost(),
          package: usePackage && selectedPackage ? selectedPackage : null
        })
      });

      if (response.ok) {
        // Show different success messages based on invite type
        if (scheduleType === 'scheduled') {
          customToast.success(
            <div>
              <p className="font-medium">Scheduled invite sent!</p>
              <p className="text-sm text-green-600 mt-1">
                <CheckIcon className="w-3 h-3 inline mr-1" />
                Will be added to your calendar when accepted
              </p>
            </div>,
            { icon: '📅' }
          );
        } else {
          customToast.success(
            `${inviteType === 'video' ? 'Video' : 'Voice'} call invite sent to ${selectedFan.displayName}!`,
            { icon: '📨' }
          );
        }
      } else {
        customToast.error('Failed to send invite');
        return;
      }

      if (onInviteSent) {
        onInviteSent({
          type: inviteType,
          fan: selectedFan,
          scheduled: scheduleType === 'scheduled',
          date: selectedDate,
          time: selectedTime,
          duration: usePackage && selectedPackage ? selectedPackage.duration : duration,
          message,
          isRecurring,
          recurringFrequency: isRecurring ? recurringFrequency : null,
          recurringCount: isRecurring ? recurringCount : null,
          totalCost: isRecurring ? calculateCost() * recurringCount : calculateCost(),
          package: usePackage && selectedPackage ? selectedPackage : undefined
        });
      }

      onClose();
      resetForm();
    } catch (error) {
      console.error('Error sending invite:', error);
      customToast.error('Failed to send invite. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setInviteType('video');
    setScheduleType('now');
    setSelectedDate('');
    setSelectedTime('');
    setDuration(30);
    setMessage('');
    setSelectedFan(null);
    setFanSearch('');
    setSearchResults([]);
    setIsRecurring(false);
    setRecurringFrequency('weekly');
    setRecurringCount(4);
    setSelectedPackage(null);
    setUsePackage(false);
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'VIP': return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'Gold': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Silver': return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'Bronze': return 'bg-orange-100 text-orange-700 border-orange-300';
      default: return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            {...modalProps}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <PaperAirplaneIcon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Send Session Invite</h2>
                  <p className="text-purple-100 text-sm">
                    Invite someone to join a personal session with you
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Close invite modal"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Call Type Selection */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">
                Call Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setInviteType('video')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    inviteType === 'video'
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                  aria-label="Select video call option"
                  aria-pressed={inviteType === 'video'}
                >
                  <VideoCameraIcon className="w-6 h-6 mx-auto mb-2" />
                  <p className="font-medium">Video Call</p>
                  <p className="text-sm mt-1">
                    <span className="font-bold">8 tokens/min</span>
                    <span className="text-gray-500 text-xs block">$0.40/min</span>
                  </p>
                </button>
                <button
                  onClick={() => setInviteType('voice')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    inviteType === 'voice'
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                  aria-label="Select voice call option"
                  aria-pressed={inviteType === 'voice'}
                >
                  <PhoneIcon className="w-6 h-6 mx-auto mb-2" />
                  <p className="font-medium">Voice Call</p>
                  <p className="text-sm mt-1">
                    <span className="font-bold">6 tokens/min</span>
                    <span className="text-gray-500 text-xs block">$0.30/min</span>
                  </p>
                </button>
              </div>
            </div>

            {/* Schedule Type */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">
                When
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setScheduleType('now')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    scheduleType === 'now'
                      ? 'border-purple-600 bg-purple-50 text-purple-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <ClockIcon className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-sm font-medium">Start Now</p>
                </button>
                <button
                  onClick={() => setScheduleType('scheduled')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    scheduleType === 'scheduled'
                      ? 'border-purple-600 bg-purple-50 text-purple-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <CalendarDaysIcon className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-sm font-medium">Schedule</p>
                </button>
              </div>
            </div>

            {/* Date/Time Selection for Scheduled Calls */}
            {scheduleType === 'scheduled' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Time
                  </label>
                  <select
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select time</option>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i;
                      const time24 = `${hour.toString().padStart(2, '0')}:00`;
                      const time12 = new Date(`2000-01-01 ${time24}`).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        hour12: true
                      });
                      return (
                        <option key={hour} value={time24}>{time12}</option>
                      );
                    })}
                  </select>
                </div>

                {/* Calendar Integration Notice */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                  <CalendarDaysIcon className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="text-xs text-blue-700">
                    <p className="font-medium">Calendar Integration</p>
                    <p>When the fan accepts this scheduled invite, it will automatically be added to your calendar.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Fan Selection */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Select Fan or Creator
              </label>
              {!selectedFan ? (
                <div>
                  <div className="relative">
                    <input
                      type="text"
                      value={fanSearch}
                      onChange={handleFanSearch}
                      placeholder="Search username in Digis..."
                      className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      aria-label="Search for users"
                      aria-describedby="fan-search-results"
                      autoComplete="off"
                    />
                    <UserIcon className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                  </div>
                  
                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div id="fan-search-results" className="mt-2 border border-gray-200 rounded-lg overflow-hidden shadow-lg">
                      {searchResults.map((fan) => (
                        <button
                          key={fan.id}
                          onClick={() => selectFan(fan)}
                          className="w-full p-3 hover:bg-gray-50 flex items-center gap-3 text-left border-b last:border-b-0"
                        >
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
                              {fan.displayName.charAt(0)}
                            </div>
                            {fan.tier === 'VIP' && (
                              <StarIcon className="w-4 h-4 text-yellow-500 absolute -top-1 -right-1" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{fan.displayName}</p>
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getTierColor(fan.tier)}`}>
                                {fan.tier}
                              </span>
                              <span>{fan.sessionCount} sessions</span>
                              <span>{fan.totalSpent} tokens spent</span>
                            </div>
                            {fan.lastSession && (
                              <p className="text-xs text-gray-400 mt-1">
                                Last session: {new Date(fan.lastSession).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {isSearching && (
                    <p className="text-sm text-gray-500 mt-2">Searching...</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
                      {selectedFan.displayName.charAt(0)}
                    </div>
                    {selectedFan.tier === 'VIP' && (
                      <StarIcon className="w-4 h-4 text-yellow-500 absolute -top-1 -right-1" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{selectedFan.displayName}</p>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getTierColor(selectedFan.tier)}`}>
                        {selectedFan.tier}
                      </span>
                      <span>{selectedFan.sessionCount} sessions</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFan(null)}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Package or Individual Session */}
            <div>
              <div className="flex items-center gap-4 mb-3">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!usePackage}
                    onChange={() => setUsePackage(false)}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Single Session</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={usePackage}
                    onChange={() => setUsePackage(true)}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Package Deal</span>
                </label>
              </div>

              {!usePackage ? (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Call Duration
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={90}>90 minutes</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
              ) : (
                <PackageDealsSection
                  creatorType={creatorType}
                  basePrice={{ video: inviteType === 'video' ? 8 : 6, voice: 6 }}
                  onPackageSelect={setSelectedPackage}
                />
              )}
            </div>

            {/* Recurring Sessions */}
            {scheduleType === 'scheduled' && !usePackage && (
              <div>
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Schedule recurring sessions
                  </span>
                </label>

                {isRecurring && (
                  <div className="ml-6 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">
                          Frequency
                        </label>
                        <select
                          value={recurringFrequency}
                          onChange={(e) => setRecurringFrequency(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                        >
                          <option value="weekly">Weekly</option>
                          <option value="biweekly">Bi-weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">
                          Number of Sessions
                        </label>
                        <select
                          value={recurringCount}
                          onChange={(e) => setRecurringCount(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                        >
                          <option value={4}>4 sessions</option>
                          <option value={8}>8 sessions</option>
                          <option value={12}>12 sessions</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      Perfect for ongoing coaching! Sessions will be scheduled {recurringFrequency} on the same day and time.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Personal Message */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Personal Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a personal message to your invite..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Cost Summary */}
            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Call Type</span>
                  <span className="font-medium">{inviteType === 'video' ? 'Video' : 'Voice'} Call</span>
                </div>
                
                {usePackage && selectedPackage ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Package</span>
                      <span className="font-medium">{selectedPackage.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Sessions</span>
                      <span className="font-medium">{selectedPackage.sessions} x {selectedPackage.duration} min</span>
                    </div>
                    {selectedPackage.discount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Discount</span>
                        <span className="font-medium text-green-600">{selectedPackage.discount}% off</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Duration</span>
                      <span className="font-medium">{duration} minutes</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Rate</span>
                      <span className="font-medium">
                        {inviteType === 'video' ? '8' : '6'} tokens/min 
                        <span className="text-gray-500 text-sm ml-1">
                          (${inviteType === 'video' ? '0.40' : '0.30'}/min)
                        </span>
                      </span>
                    </div>
                  </>
                )}
                
                {isRecurring && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Recurring</span>
                      <span className="font-medium">{recurringCount} sessions {recurringFrequency}</span>
                    </div>
                    <div className="border-t pt-2 mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">Per Session</span>
                        <span className="text-sm font-medium">
                          {calculateCost()} tokens
                          <span className="text-gray-500 ml-1">(${calculateUSD(calculateCost())})</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">Total Program Cost</span>
                        <div className="text-right">
                          <p className="text-lg font-bold text-purple-600">{calculateCost() * recurringCount} tokens</p>
                          <p className="text-sm text-gray-600">${calculateUSD(calculateCost() * recurringCount)} USD</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                
                {!isRecurring && (
                  <div className="border-t pt-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">Total Cost for Fan</span>
                      <div className="text-right">
                        <p className="text-lg font-bold text-purple-600">{calculateCost()} tokens</p>
                        <p className="text-sm text-gray-600">${calculateUSD(calculateCost())} USD</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Info Note */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
              <InformationCircleIcon className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How invites work:</p>
                <ul className="space-y-1 text-xs">
                  <li>• The fan will receive a notification about your invite</li>
                  <li>• They can accept or decline the invitation</li>
                  {scheduleType === 'scheduled' && (
                    <li className="font-medium">• If accepted, the call will be added to your calendar</li>
                  )}
                  <li>• The fan will be charged only if they join the call</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex gap-3">
            <Button
              variant="secondary"
              onClick={onClose}
              className="flex-1"
              aria-label="Cancel invite"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSendInvite}
              disabled={!selectedFan || sending}
              className="flex-1"
              icon={sending ? null : <PaperAirplaneIcon className="w-5 h-5" />}
              aria-label="Send session invite"
            >
              {sending ? 'Sending...' : 'Send Invite'}
            </Button>
          </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

CallInviteModal.displayName = 'CallInviteModal';

CallInviteModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  fanData: PropTypes.object,
  onInviteSent: PropTypes.func,
  creatorType: PropTypes.oneOf(['general', 'health-coach', 'yoga', 'fitness', 'wellness', 'consultant'])
};

export default CallInviteModal;