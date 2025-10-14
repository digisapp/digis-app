import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CalendarDaysIcon,
  ClockIcon,
  UserGroupIcon,
  StarIcon,
  CurrencyDollarIcon,
  VideoCameraIcon,
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  SparklesIcon,
  FireIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  BellIcon,
  CalendarIcon,
  InformationCircleIcon,
  TagIcon
} from '@heroicons/react/24/outline';
import { 
  StarIcon as StarIconSolid,
  CalendarDaysIcon as CalendarDaysIconSolid
} from '@heroicons/react/24/solid';
import { supabase } from '../../utils/supabase-auth';
import toast from 'react-hot-toast';
import ClassScheduler from '../ClassScheduler';
import ClassReviewModal from '../ClassReviewModal';
import ClassReviews from '../ClassReviews';

const ClassesPage = ({ user, isCreator, tokenBalance, onTokenUpdate }) => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('daily'); // 'daily' or 'weekly'
  const [showScheduler, setShowScheduler] = useState(false);
  // Removed selectedDate - always show from current date
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedClassForReview, setSelectedClassForReview] = useState(null);
  const [showReviews, setShowReviews] = useState(false);
  const [selectedClassForReviews, setSelectedClassForReviews] = useState(null);
  const [showMyClasses, setShowMyClasses] = useState(false);
  const [enrolledClasses, setEnrolledClasses] = useState([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedClassForDetails, setSelectedClassForDetails] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const categories = [
    { id: 'all', label: 'All Classes', icon: StarIcon, color: 'from-purple-500 to-indigo-600' },
    { id: 'fitness', label: 'Fitness & Workout', icon: FireIcon, color: 'from-red-500 to-orange-600' },
    { id: 'wellness', label: 'Health & Wellness', icon: SparklesIcon, color: 'from-green-500 to-emerald-600' },
    { id: 'fashion', label: 'Fashion & Style', icon: StarIcon, color: 'from-pink-500 to-rose-600' },
    { id: 'business', label: 'Business & Consulting', icon: CurrencyDollarIcon, color: 'from-blue-500 to-cyan-600' },
    { id: 'creative', label: 'Creative Arts', icon: SparklesIcon, color: 'from-purple-500 to-pink-600' },
    { id: 'cooking', label: 'Cooking & Nutrition', icon: FireIcon, color: 'from-amber-500 to-orange-600' },
    { id: 'tech', label: 'Technology', icon: StarIcon, color: 'from-indigo-500 to-purple-600' },
    { id: 'music', label: 'Music & Performance', icon: SparklesIcon, color: 'from-rose-500 to-pink-600' }
  ];

  useEffect(() => {
    fetchClasses();
  }, [activeView]); // Refetch when switching between daily/weekly

  // Update current time every minute for countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  // Fetch enrolled classes
  useEffect(() => {
    if (user) {
      fetchEnrolledClasses();
    }
  }, [user]);

  const fetchEnrolledClasses = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/classes/enrolled`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setEnrolledClasses(data.enrolledClassIds || []);
      }
    } catch (error) {
      console.error('Error fetching enrolled classes:', error);
    }
  };

  const fetchClasses = async () => {
    try {
      setLoading(true);
      let authToken = null;
      if (user) {
        const { data: { session } } = await supabase.auth.getSession();
        authToken = session?.access_token;
      }
      
      // Calculate date range based on active view - always starting from today
      const startDate = new Date();
      const endDate = new Date();
      
      if (activeView === 'daily') {
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else {
        // Weekly view - start from Sunday
        const dayOfWeek = startDate.getDay();
        startDate.setDate(startDate.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      }

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/classes?${params}`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });

      if (response.ok) {
        const data = await response.json();
        setClasses(data.classes || []);
      } else {
        console.error('Failed to fetch classes');
        setClasses([]);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClass = async (classItem) => {
    if (!user) {
      toast.error('Please sign in to join classes');
      return;
    }

    if (tokenBalance < classItem.tokenPrice) {
      toast.error(`Insufficient tokens. You need ${classItem.tokenPrice} tokens to join this class.`);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/classes/${classItem.id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          userId: user.id,
          classId: classItem.id,
          tokenAmount: classItem.tokenPrice
        })
      });

      if (response.ok) {
        const data = await response.json();
        // toast.success(`Successfully joined "${classItem.title}"! Class starts at ${formatTime(classItem.startTime)}`);
        
        // Update token balance
        if (onTokenUpdate) {
          onTokenUpdate();
        }
        
        // Refresh classes to show updated participant count
        fetchClasses();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to join class');
      }
    } catch (error) {
      console.error('Error joining class:', error);
      toast.error('Failed to join class. Please try again.');
    }
  };

  const handleShowReviews = (classItem) => {
    setSelectedClassForReviews(classItem);
    setShowReviews(true);
  };

  const handleLeaveReview = (classItem) => {
    setSelectedClassForReview(classItem);
    setShowReviewModal(true);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
      timeZone: 'America/New_York' // Eastern Time
    });
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/New_York'
    });
  };

  const getTimeUntilClass = (startTime) => {
    const now = currentTime;
    const classTime = new Date(startTime);
    const diffMs = classTime - now;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 0) return { text: 'Started', isLive: true };
    if (diffMinutes === 0) return { text: 'Starting now', isLive: true };
    if (diffMinutes < 60) return { text: `Starts in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`, isSoon: true };
    if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      return { text: `Starts in ${hours}h ${mins > 0 ? `${mins}m` : ''}`, isSoon: hours < 2 };
    }
    const days = Math.floor(diffMinutes / 1440);
    return { text: `In ${days} day${days !== 1 ? 's' : ''}`, isSoon: false };
  };

  // Sort classes by start time (soonest first) and filter for enrolled classes if needed
  const filteredClasses = classes
    .filter(classItem => {
      if (showMyClasses && user) {
        return enrolledClasses.includes(classItem.id);
      }
      return true;
    })
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  const ClassCard = ({ classItem }) => {
    const category = categories.find(cat => cat.id === classItem.category) || categories[0];
    const Icon = category.icon;
    const timeInfo = getTimeUntilClass(classItem.startTime);
    const isEnrolled = user && enrolledClasses.includes(classItem.id);
    
    // Generate a beautiful class image based on category
    const classImages = {
      wellness: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=600&fit=crop',
      fitness: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&h=600&fit=crop',
      fashion: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&h=600&fit=crop',
      cooking: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop',
      business: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=600&fit=crop',
      creative: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&h=600&fit=crop',
      tech: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&h=600&fit=crop',
      music: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop'
    };
    
    const classImage = classItem.coverImage || classImages[classItem.category] || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop';
    
    return (
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2 }}
        className="group cursor-pointer"
      >
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-xl transition-all duration-300">
          {/* Image Container */}
          <div className="relative h-64 overflow-hidden">
            <img 
              src={classImage} 
              alt={classItem.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            
            {/* Enrolled Badge - Top Left */}
            {isEnrolled && (
              <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 z-10">
                <CheckCircleIcon className="w-3 h-3" />
                Enrolled
              </div>
            )}
            
            {/* Time Badge - Below Enrolled Badge if enrolled, otherwise top left */}
            {(timeInfo.isLive || timeInfo.isSoon) && (
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className={`absolute ${isEnrolled ? 'top-12' : 'top-4'} left-4 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 z-10 ${
                  timeInfo.isLive ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                }`}
              >
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                {timeInfo.text}
              </motion.div>
            )}
            
            {/* Category Badge */}
            <div className="absolute top-4 right-4">
              <span className="px-3 py-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full text-xs font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1">
                <Icon className="w-3 h-3" />
                {category.label.split(' ')[0]}
              </span>
            </div>

            {/* Token Price */}
            <div className="absolute bottom-4 right-4">
              <div className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-white font-bold text-sm flex items-center gap-1">
                <CurrencyDollarIcon className="w-4 h-4" />
                {classItem.tokenPrice}
              </div>
            </div>

            {/* Title & Time Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="text-xl font-bold text-white mb-1">{classItem.title}</h3>
              <div className="flex items-center gap-3 text-white/90 text-sm">
                <div className="flex items-center gap-1">
                  <ClockIcon className="w-4 h-4" />
                  <span>{formatTime(classItem.startTime)}</span>
                </div>
                <span>•</span>
                <span>{classItem.duration} min</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            {/* Creator Info */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold">
                  {classItem.creator.displayName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{classItem.creator.displayName}</p>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <StarIconSolid
                        key={i}
                        className={`w-3 h-3 ${i < Math.floor(classItem.creator.rating) ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                      />
                    ))}
                    <span className="text-xs text-gray-600 dark:text-gray-400 ml-1">{classItem.creator.rating}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(classItem.startTime).split(',')[0]}</p>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{classItem.currentParticipants} joined</p>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
              {classItem.description}
            </p>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>{classItem.currentParticipants} / {classItem.maxParticipants} spots</span>
                <span>{Math.round((classItem.currentParticipants / classItem.maxParticipants) * 100)}% filled</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full transition-all duration-500"
                  style={{ width: `${(classItem.currentParticipants / classItem.maxParticipants) * 100}%` }}
                />
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-4">
              {classItem.tags.slice(0, 2).map((tag, index) => (
                <span 
                  key={index} 
                  className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setSelectedClassForDetails(classItem);
                  setShowDetailsModal(true);
                }}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors duration-200"
              >
                View Details
              </button>
              {!isEnrolled && (
                <button 
                  onClick={() => handleJoinClass(classItem)}
                  disabled={classItem.currentParticipants >= classItem.maxParticipants}
                  className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors duration-200 flex items-center justify-center gap-2 group ${
                    classItem.currentParticipants >= classItem.maxParticipants
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-gray-900 hover:bg-black text-white'
                  }`}
                >
                  <span>{classItem.currentParticipants >= classItem.maxParticipants ? 'Class Full' : 'Join Class'}</span>
                  {classItem.currentParticipants < classItem.maxParticipants && (
                    <motion.span
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      →
                    </motion.span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // Data loads immediately, no loading state needed

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header - Clean style for desktop */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 content-below-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap flex-1">
              {/* Search bar - Now visible on mobile */}
              <div className="flex flex-1 max-w-md">
                <div className="relative w-full">
                  <input
                    type="text"
                    placeholder="Search Classes"
                    className="w-full h-12 pl-10 pr-3 sm:pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  />
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>

              {/* Daily/Weekly Toggle - on same row as header */}
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                <button
                  onClick={() => setActiveView('daily')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                    activeView === 'daily'
                      ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setActiveView('weekly')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                    activeView === 'weekly'
                      ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Weekly
                </button>
              </div>

              {/* Enrolled Classes Filter - Checkmark on same row as header */}
              {user && (
                <div className="relative">
                  <button
                    onClick={() => setShowMyClasses(!showMyClasses)}
                    className={`p-1.5 sm:p-2 rounded-lg transition-all ${
                      showMyClasses
                        ? 'bg-green-500 text-white shadow-lg transform scale-105'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                    title={showMyClasses ? 'Showing enrolled classes only' : 'Show enrolled classes only'}
                  >
                    <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={showMyClasses ? 2.5 : 2} />
                  </button>
                  {showMyClasses && enrolledClasses.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-white text-green-600 px-1.5 py-0.5 rounded-full text-xs font-bold min-w-[20px] text-center border border-green-500">
                      {enrolledClasses.length}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Schedule Class button in header */}
            {isCreator && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowScheduler(true)}
                className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-xs sm:text-sm"
              >
                <PlusIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Schedule Class</span>
                <span className="sm:hidden">Schedule</span>
              </motion.button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">


      {/* Classes Grid */}
      <AnimatePresence mode="wait">
        {filteredClasses.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <motion.div
              animate={{ 
                y: [0, -10, 0],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ 
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <CalendarDaysIcon className="w-20 h-20 text-gray-300 dark:text-gray-600 mb-4" />
            </motion.div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Classes Coming Soon!</h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md text-center">
              Stay tuned for exciting educational content
            </p>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
          >
            {filteredClasses.map((classItem, index) => (
              <motion.div
                key={classItem.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <ClassCard classItem={classItem} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Class Scheduler Modal */}
      <ClassScheduler
        isOpen={showScheduler}
        onClose={() => setShowScheduler(false)}
        onClassScheduled={(newClass) => {
          // Add the new class to the list immediately with proper structure
          const formattedClass = {
            ...newClass,
            creator: {
              ...newClass.creator,
              displayName: newClass.creator.displayName || user.displayName || user.email?.split('@')[0] || 'Creator'
            }
          };
          setClasses(prevClasses => [formattedClass, ...prevClasses]);
          // toast.success('Class scheduled successfully!');
        }}
        user={user}
      />

      {/* Class Review Modal */}
      <ClassReviewModal
        isOpen={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setSelectedClassForReview(null);
        }}
        classData={selectedClassForReview}
        user={user}
        onReviewSubmitted={(review) => {
          // toast.success('Review submitted successfully!');
          // Refresh classes to update review counts
          fetchClasses();
        }}
      />

      {/* Class Reviews View Modal */}
      {showReviews && selectedClassForReviews && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Class Reviews</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedClassForReviews.title}</p>
              </div>
              <button
                onClick={() => {
                  setShowReviews(false);
                  setSelectedClassForReviews(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Reviews Content */}
            <div className="p-6">
              <ClassReviews
                classId={selectedClassForReviews.id}
                user={user}
              />
              
              {/* Leave Review Button */}
              {user && (
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowReviews(false);
                      handleLeaveReview(selectedClassForReviews);
                    }}
                    className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Leave a Review
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Class Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedClassForDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto"
            onClick={() => setShowDetailsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto my-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Class Image Header */}
              <div className="relative h-72">
                <img 
                  src={selectedClassForDetails.coverImage || 
                    {
                      wellness: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=600&fit=crop',
                      fitness: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&h=600&fit=crop',
                      fashion: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&h=600&fit=crop',
                      cooking: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop',
                      business: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=600&fit=crop',
                      creative: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&h=600&fit=crop',
                      tech: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&h=600&fit=crop',
                      music: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop'
                    }[selectedClassForDetails.category] || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop'
                  }
                  alt={selectedClassForDetails.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                
                {/* Close Button */}
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
                >
                  <XMarkIcon className="w-6 h-6 text-white" />
                </button>

                {/* Title Overlay */}
                <div className="absolute bottom-6 left-6 right-6">
                  <h2 className="text-3xl font-bold text-white mb-2">{selectedClassForDetails.title}</h2>
                  <div className="flex items-center gap-4 text-white/90">
                    <span className="flex items-center gap-1">
                      <ClockIcon className="w-5 h-5" />
                      {formatTime(selectedClassForDetails.startTime)}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-5 h-5" />
                      {formatDate(selectedClassForDetails.startTime)}
                    </span>
                    <span className="flex items-center gap-1">
                      <ClockIcon className="w-5 h-5" />
                      {selectedClassForDetails.duration} minutes
                    </span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Creator Info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-lg font-bold">
                      {selectedClassForDetails.creator.displayName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{selectedClassForDetails.creator.displayName}</p>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <StarIconSolid
                            key={i}
                            className={`w-4 h-4 ${i < Math.floor(selectedClassForDetails.creator.rating) ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                          />
                        ))}
                        <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
                          {selectedClassForDetails.creator.rating} ({selectedClassForDetails.creator.reviewCount} reviews)
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-2xl font-bold text-purple-600">{selectedClassForDetails.tokenPrice} tokens</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">per session</p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <InformationCircleIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    About This Class
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {selectedClassForDetails.description}
                  </p>
                </div>

                {/* Requirements */}
                {selectedClassForDetails.requirements && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Requirements</h3>
                    <p className="text-gray-700 dark:text-gray-300">{selectedClassForDetails.requirements}</p>
                  </div>
                )}

                {/* What to Expect */}
                {selectedClassForDetails.whatToExpect && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">What You'll Learn</h3>
                    <p className="text-gray-700 dark:text-gray-300">{selectedClassForDetails.whatToExpect}</p>
                  </div>
                )}

                {/* Tags */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <TagIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedClassForDetails.tags.map((tag, index) => (
                      <span 
                        key={index}
                        className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Participation Stats */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Class Capacity</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {selectedClassForDetails.currentParticipants} / {selectedClassForDetails.maxParticipants} participants
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full transition-all duration-500"
                      style={{ width: `${(selectedClassForDetails.currentParticipants / selectedClassForDetails.maxParticipants) * 100}%` }}
                    />
                  </div>
                  {selectedClassForDetails.currentParticipants >= selectedClassForDetails.maxParticipants * 0.8 && (
                    <p className="text-sm text-orange-600 mt-2 font-medium">
                      🔥 Filling up fast! Only {selectedClassForDetails.maxParticipants - selectedClassForDetails.currentParticipants} spots left
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  {isCreator && selectedClassForDetails.creator.username === user?.username ? (
                    <>
                      <button
                        className="flex-1 py-3 px-4 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                      >
                        Edit Class
                      </button>
                      <button
                        className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                      >
                        Cancel Class
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          // Add to calendar functionality
                          const event = {
                            title: selectedClassForDetails.title,
                            start: new Date(selectedClassForDetails.startTime),
                            duration: selectedClassForDetails.duration
                          };
                          // In production, integrate with calendar API
                          // toast.success('Added to calendar!');
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                      >
                        <CalendarIcon className="w-5 h-5" />
                        Add to Calendar
                      </button>
                      
                      <button
                        onClick={() => {
                          // Set reminder functionality
                          // toast.success('Reminder set! We\'ll notify you 15 minutes before class starts.');
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                      >
                        <BellIcon className="w-5 h-5" />
                        Set Reminder
                      </button>
                      
                      {enrolledClasses.includes(selectedClassForDetails.id) ? (
                        <button
                          disabled
                          className="flex-1 py-3 px-4 bg-green-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                        >
                          <CheckCircleIcon className="w-5 h-5" />
                          Already Enrolled
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            handleJoinClass(selectedClassForDetails);
                            setShowDetailsModal(false);
                          }}
                          disabled={selectedClassForDetails.currentParticipants >= selectedClassForDetails.maxParticipants}
                          className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${
                            selectedClassForDetails.currentParticipants >= selectedClassForDetails.maxParticipants
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg'
                          }`}
                        >
                          {selectedClassForDetails.currentParticipants >= selectedClassForDetails.maxParticipants
                            ? 'Class Full'
                            : `Join for ${selectedClassForDetails.tokenPrice} tokens`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
};

export default ClassesPage;