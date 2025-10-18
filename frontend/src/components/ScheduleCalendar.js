import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  VideoCameraIcon,
  PhoneIcon,
  SparklesIcon,
  ClockIcon,
  UserGroupIcon,
  PlusIcon,
  XMarkIcon,
  BellIcon,
  ArrowDownTrayIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { supabase } from '../utils/supabase-auth';

const ScheduleCalendar = ({ userType = 'fan', userId, onScheduleEvent, externalEvents = [] }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [events, setEvents] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // month, week, day
  const [loading, setLoading] = useState(false);

  // New event form state
  const [newEvent, setNewEvent] = useState({
    type: 'video-call',
    title: '',
    creatorId: '',
    date: '',
    time: '',
    duration: 30,
    description: '',
    isRecurring: false,
    recurringPattern: 'weekly'
  });

  const eventTypes = [
    { id: 'video-call', label: 'Video Call', icon: VideoCameraIcon, color: 'purple' },
    { id: 'voice-call', label: 'Voice Call', icon: PhoneIcon, color: 'pink' },
    { id: 'live-stream', label: 'Live Stream', icon: SparklesIcon, color: 'blue' },
    { id: 'class', label: 'Class/Workshop', icon: UserGroupIcon, color: 'green' }
  ];

  useEffect(() => {
    fetchEvents();
  }, [currentDate, userId]);

  // Merge external events with fetched events
  useEffect(() => {
    if (externalEvents.length > 0) {
      setEvents(prevEvents => {
        // Filter out any duplicates based on event ID
        const existingIds = new Set(prevEvents.map(e => e.id));
        const newEvents = externalEvents.filter(e => !existingIds.has(e.id));
        return [...prevEvents, ...newEvents];
      });
    }
  }, [externalEvents]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setEvents([]);
        return;
      }

      // Fetch scheduled sessions/calls
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/sessions/schedule`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Transform API data to match component structure
        const transformedEvents = (data.sessions || []).map(session => ({
          id: session.id,
          type: session.type === 'video' ? 'video-call' : 
                session.type === 'voice' ? 'voice-call' : 
                session.type === 'stream' ? 'live-stream' : 'video-call',
          title: session.title || `${session.type} Session`,
          creator: session.creator_name || session.fan_name || 'User',
          date: new Date(session.scheduled_date + ' ' + session.scheduled_time),
          duration: session.duration_minutes || 30,
          status: session.status || 'pending',
          price: session.total_cost || (session.rate_per_min * session.duration_minutes),
          attendees: session.attendee_count,
          sessionId: session.session_id,
          isCreator: session.is_creator || false
        }));
        
        setEvents(transformedEvents);
      } else {
        // No events or error - show empty calendar
        setEvents([]);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      // Don't show error toast for empty schedules
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const getEventsForDate = (date) => {
    if (!date) return [];
    return events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const formatTime = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleDateClick = (date) => {
    if (!date) return;
    setSelectedDate(date);
    if (userType === 'fan') {
      setNewEvent({
        ...newEvent,
        date: date.toISOString().split('T')[0]
      });
      setShowEventModal(true);
    }
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setShowEventDetails(true);
  };

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.time) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // API call to create event
      // toast.success('Event scheduled successfully!');
      setShowEventModal(false);
      setNewEvent({
        type: 'video-call',
        title: '',
        creatorId: '',
        date: '',
        time: '',
        duration: 30,
        description: '',
        isRecurring: false,
        recurringPattern: 'weekly'
      });
      fetchEvents();
    } catch (error) {
      toast.error('Failed to schedule event');
    }
  };

  const handleCancelEvent = async (eventId) => {
    try {
      // API call to cancel event
      // toast.success('Event cancelled');
      setShowEventDetails(false);
      fetchEvents();
    } catch (error) {
      toast.error('Failed to cancel event');
    }
  };

  const exportToCalendar = (event) => {
    // Generate ICS file for calendar export
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${event.title}
DTSTART:${event.date.toISOString().replace(/[-:]/g, '').replace('.000', '')}
DURATION:PT${event.duration}M
DESCRIPTION:${event.creator ? `With ${event.creator}` : ''}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.title}.ics`;
    link.click();
    URL.revokeObjectURL(url);
    // toast.success('Event exported to calendar');
  };

  const getEventTypeConfig = (type) => {
    return eventTypes.find(t => t.id === type) || eventTypes[0];
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarDaysIcon className="w-8 h-8 text-purple-600" />
          {userType === 'creator' ? 'Your Schedule' : 'My Schedule'}
        </h2>
        
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'month' 
                  ? 'bg-white text-purple-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'week' 
                  ? 'bg-white text-purple-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'day' 
                  ? 'bg-white text-purple-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Day
            </button>
          </div>
          
          {userType === 'fan' && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowEventModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              Schedule
            </motion.button>
          )}
        </div>
      </div>

      {/* Calendar Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handlePreviousMonth}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        
        <h3 className="text-xl font-semibold text-gray-900">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h3>
        
        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronRightIcon className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Calendar Grid */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-7 gap-1">
          {/* Day Headers */}
          {dayNames.map(day => (
            <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
              {day}
            </div>
          ))}
          
          {/* Calendar Days */}
          {getDaysInMonth(currentDate).map((date, index) => {
            const dayEvents = date ? getEventsForDate(date) : [];
            const isToday = date && date.toDateString() === new Date().toDateString();
            const isSelected = date && selectedDate && date.toDateString() === selectedDate.toDateString();
            
            return (
              <motion.div
                key={index}
                whileHover={date ? { scale: 1.05 } : {}}
                onClick={() => handleDateClick(date)}
                className={`
                  min-h-[100px] p-2 rounded-lg border transition-all cursor-pointer
                  ${!date ? 'bg-gray-50 cursor-default' : 'bg-white hover:border-purple-300'}
                  ${isToday ? 'border-purple-500 border-2' : 'border-gray-200'}
                  ${isSelected ? 'bg-purple-50' : ''}
                `}
              >
                {date && (
                  <>
                    <div className={`text-sm font-medium mb-1 ${isToday ? 'text-purple-600' : 'text-gray-900'}`}>
                      {date.getDate()}
                    </div>
                    
                    {/* Event Indicators */}
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event, i) => {
                        const config = getEventTypeConfig(event.type);
                        return (
                          <motion.div
                            key={event.id}
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEventClick(event);
                            }}
                            className={`
                              text-xs p-1 rounded truncate cursor-pointer
                              ${config.color === 'purple' ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : ''}
                              ${config.color === 'pink' ? 'bg-pink-100 text-pink-700 hover:bg-pink-200' : ''}
                              ${config.color === 'blue' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : ''}
                              ${config.color === 'green' ? 'bg-green-100 text-green-700 hover:bg-green-200' : ''}
                            `}
                          >
                            {formatTime(new Date(event.date))} - {event.title}
                          </motion.div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-gray-500 text-center">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Upcoming Events List */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ClockIcon className="w-5 h-5 text-purple-600" />
          Upcoming Events
        </h3>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent mx-auto" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CalendarDaysIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No upcoming events</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events
              .filter(event => new Date(event.date) >= new Date())
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .slice(0, 5)
              .map(event => {
                const config = getEventTypeConfig(event.type);
                const Icon = config.icon;
                
                return (
                  <motion.div
                    key={event.id}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => handleEventClick(event)}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer transition-all"
                  >
                    <div className={`
                      p-3 rounded-lg
                      ${config.color === 'purple' ? 'bg-purple-100 text-purple-600' : ''}
                      ${config.color === 'pink' ? 'bg-pink-100 text-pink-600' : ''}
                      ${config.color === 'blue' ? 'bg-blue-100 text-blue-600' : ''}
                      ${config.color === 'green' ? 'bg-green-100 text-green-600' : ''}
                    `}>
                      <Icon className="w-6 h-6" />
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{event.title}</h4>
                      <p className="text-sm text-gray-600">
                        {event.creator} • {new Date(event.date).toLocaleDateString()} at {formatTime(new Date(event.date))}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <span className={`
                        text-xs px-2 py-1 rounded-full
                        ${event.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}
                      `}>
                        {event.status}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
          </div>
        )}
      </div>

      {/* Schedule Event Modal (for fans) */}
      <AnimatePresence>
        {showEventModal && userType === 'fan' && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Schedule Event</h3>
                <button
                  onClick={() => setShowEventModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Event Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {eventTypes.map(type => {
                      const Icon = type.icon;
                      return (
                        <button
                          key={type.id}
                          onClick={() => setNewEvent({ ...newEvent, type: type.id })}
                          className={`
                            p-3 rounded-lg border-2 flex items-center gap-2 transition-all
                            ${newEvent.type === type.id 
                              ? 'border-purple-500 bg-purple-50 text-purple-700' 
                              : 'border-gray-200 hover:border-gray-300'}
                          `}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-sm font-medium">{type.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="e.g., Fitness Consultation"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                
                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time
                    </label>
                    <input
                      type="time"
                      value={newEvent.time}
                      onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                </div>
                
                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration
                  </label>
                  <select
                    value={newEvent.duration}
                    onChange={(e) => setNewEvent({ ...newEvent, duration: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
                
                {/* Recurring */}
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newEvent.isRecurring}
                      onChange={(e) => setNewEvent({ ...newEvent, isRecurring: e.target.checked })}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Make this a recurring event
                    </span>
                  </label>
                  
                  {newEvent.isRecurring && (
                    <select
                      value={newEvent.recurringPattern}
                      onChange={(e) => setNewEvent({ ...newEvent, recurringPattern: e.target.value })}
                      className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  )}
                </div>
                
                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="Add any notes or special requests..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowEventModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateEvent}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Schedule Event
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Event Details Modal */}
      <AnimatePresence>
        {showEventDetails && selectedEvent && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Event Details</h3>
                <button
                  onClick={() => setShowEventDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Event Type & Title */}
                <div className="flex items-start gap-4">
                  <div className={`
                    p-3 rounded-lg
                    ${getEventTypeConfig(selectedEvent.type).color === 'purple' ? 'bg-purple-100 text-purple-600' : ''}
                    ${getEventTypeConfig(selectedEvent.type).color === 'pink' ? 'bg-pink-100 text-pink-600' : ''}
                    ${getEventTypeConfig(selectedEvent.type).color === 'blue' ? 'bg-blue-100 text-blue-600' : ''}
                    ${getEventTypeConfig(selectedEvent.type).color === 'green' ? 'bg-green-100 text-green-600' : ''}
                  `}>
                    {React.createElement(getEventTypeConfig(selectedEvent.type).icon, { className: 'w-6 h-6' })}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-semibold text-gray-900">{selectedEvent.title}</h4>
                    <p className="text-gray-600">{getEventTypeConfig(selectedEvent.type).label}</p>
                  </div>
                </div>
                
                {/* Details */}
                <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                  {selectedEvent.creator && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Creator</span>
                      <span className="font-medium">{selectedEvent.creator}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Date</span>
                    <span className="font-medium">
                      {new Date(selectedEvent.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Time</span>
                    <span className="font-medium">
                      {formatTime(new Date(selectedEvent.date))} ({selectedEvent.duration} min)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    <span className={`
                      px-2 py-1 rounded-full text-xs font-medium
                      ${selectedEvent.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}
                    `}>
                      {selectedEvent.status}
                    </span>
                  </div>
                  {selectedEvent.price && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Price</span>
                      <span className="font-medium">{selectedEvent.price} tokens</span>
                    </div>
                  )}
                </div>
                
                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowEventDetails(false);
                      // Navigate to video call or event page
                      if (onScheduleEvent) {
                        onScheduleEvent(selectedEvent);
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <EyeIcon className="w-5 h-5" />
                    Join Event
                  </button>
                  <button
                    onClick={() => exportToCalendar(selectedEvent)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    title="Export to Calendar"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5" />
                  </button>
                  {selectedEvent.status !== 'completed' && (
                    <button
                      onClick={() => handleCancelEvent(selectedEvent.id)}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ScheduleCalendar;