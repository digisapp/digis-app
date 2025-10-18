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
  EyeIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  CalendarIcon,
  CogIcon,
  MapPinIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/supabase-auth';
import { fetchWithRetry } from '../utils/fetchWithRetry';

const EnhancedScheduleCalendar = ({ 
  userType = 'fan', 
  userId, 
  onScheduleEvent,
  allowEditing = true,
  showAvailability = false,
  externalEvents = []
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [events, setEvents] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [viewMode, setViewMode] = useState('month');
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // New event form state
  const [newEvent, setNewEvent] = useState({
    type: 'video-call',
    title: '',
    creatorId: '',
    date: '',
    time: '',
    duration: 30,
    price: '',
    description: '',
    isRecurring: false,
    recurringPattern: 'weekly',
    maxParticipants: 1
  });

  // Availability settings
  const [availability, setAvailability] = useState({
    monday: { enabled: true, start: '09:00', end: '17:00' },
    tuesday: { enabled: true, start: '09:00', end: '17:00' },
    wednesday: { enabled: true, start: '09:00', end: '17:00' },
    thursday: { enabled: true, start: '09:00', end: '17:00' },
    friday: { enabled: true, start: '09:00', end: '17:00' },
    saturday: { enabled: false, start: '10:00', end: '14:00' },
    sunday: { enabled: false, start: '10:00', end: '14:00' }
  });

  const eventTypes = [
    { id: 'video-call', label: 'Video Call', icon: VideoCameraIcon, color: 'purple', defaultPrice: 50 },
    { id: 'voice-call', label: 'Voice Call', icon: PhoneIcon, color: 'pink', defaultPrice: 30 },
    { id: 'live-stream', label: 'Live Stream', icon: SparklesIcon, color: 'blue', defaultPrice: 20 },
    { id: 'class', label: 'Class/Workshop', icon: UserGroupIcon, color: 'green', defaultPrice: 100 },
    { id: 'meeting', label: 'Meeting', icon: UserIcon, color: 'yellow', defaultPrice: 0 },
    { id: 'personal', label: 'Personal Time', icon: ClockIcon, color: 'gray', defaultPrice: 0 }
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
    try {
      // Try to fetch from API first
      if (userId) {
        const token = await getAuthToken();
        const response = await fetchWithRetry(
          `${import.meta.env.VITE_BACKEND_URL}/sessions/scheduled`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();

          // Ensure data is an array
          const sessions = Array.isArray(data) ? data : (data.sessions || data.events || []);

          // Transform API data to calendar format
          const apiEvents = sessions.map(session => ({
            id: session.id,
            type: session.type || 'video-call',
            title: session.title || `Session with ${session.fan_name || session.creator_name || 'User'}`,
            creator: session.creator_name || 'Creator',
            date: new Date(session.scheduled_time),
            duration: session.duration || 30,
            status: session.status || 'scheduled',
            tokens: session.tokens || 0,
            participants: session.participants || 1
          }));
          
          setEvents(apiEvents);
          return;
        }
      }
      
      // Fallback to mock data if API fails or no userId
      const mockEvents = [
        {
          id: 1,
          type: 'video-call',
          title: 'Fitness Consultation',
          creator: 'You',
          date: new Date(2025, 7, 15, 14, 0),
          duration: 30,
          status: 'confirmed',
          price: 240,
          participants: ['John Doe']
        },
        {
          id: 2,
          type: 'live-stream',
          title: 'Morning Yoga Session',
          creator: 'You',
          date: new Date(2025, 7, 16, 9, 0),
          duration: 60,
          status: 'scheduled',
          attendees: 45,
          price: 20
        },
        {
          id: 3,
          type: 'voice-call',
          title: 'Business Strategy Call',
          creator: 'You',
          date: new Date(2025, 7, 18, 16, 0),
          duration: 45,
          status: 'pending',
          price: 150
        }
      ];
      setEvents(mockEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load schedule');
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
    if (userType === 'creator' && allowEditing) {
      setNewEvent({
        ...newEvent,
        date: date.toISOString().split('T')[0]
      });
      setShowEventModal(true);
    }
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    if (userType === 'creator' && allowEditing) {
      setEditingEvent(event);
    }
    setShowEventDetails(true);
  };

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.time) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // Create event data with proper date formatting
      const eventDateTime = new Date(`${newEvent.date}T${newEvent.time}`);
      const eventData = {
        id: Date.now().toString(), // Generate temporary ID
        ...newEvent,
        date: eventDateTime,
        creatorId: userId,
        status: 'scheduled',
        price: parseFloat(newEvent.price) || 0
      };
      
      // In production, make API call to create event
      // const response = await fetch('/api/events', { 
      //   method: 'POST', 
      //   body: JSON.stringify(eventData) 
      // });
      
      // Add event to local state
      setEvents(prevEvents => [...prevEvents, eventData]);
      
      // // toast.success('Event scheduled successfully!');
      setShowEventModal(false);
      
      // Reset form
      setNewEvent({
        type: 'video-call',
        title: '',
        creatorId: '',
        date: '',
        time: '',
        duration: 30,
        price: '',
        description: '',
        isRecurring: false,
        recurringPattern: 'weekly',
        maxParticipants: 1
      });
    } catch (error) {
      toast.error('Failed to schedule event');
    }
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent) return;
    
    try {
      // In production, make API call to update event
      // const response = await fetch(`/api/events/${editingEvent.id}`, { 
      //   method: 'PUT', 
      //   body: JSON.stringify(editingEvent) 
      // });
      
      // Update event in local state
      setEvents(prevEvents => 
        prevEvents.map(event => 
          event.id === editingEvent.id ? editingEvent : event
        )
      );
      
      // Update selected event if it's the one being edited
      if (selectedEvent?.id === editingEvent.id) {
        setSelectedEvent(editingEvent);
      }
      
      // // toast.success('Event updated successfully!');
      setShowEventDetails(false);
      setEditingEvent(null);
    } catch (error) {
      toast.error('Failed to update event');
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    
    try {
      // In production, make API call to delete event
      // const response = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
      
      // Remove event from local state
      setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));
      
      // Close the details modal
      setShowEventDetails(false);
      setSelectedEvent(null);
      
      // // toast.success('Event deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete event');
    }
  };

  const handleCancelEvent = async (eventId) => {
    try {
      // In production, make API call to cancel event
      // const response = await fetch(`/api/events/${eventId}/cancel`, { method: 'POST' });
      
      // Update event status in local state
      setEvents(prevEvents => 
        prevEvents.map(event => 
          event.id === eventId 
            ? { ...event, status: 'cancelled' } 
            : event
        )
      );
      
      // // toast.success('Event cancelled');
      setShowEventDetails(false);
      setSelectedEvent(null);
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
    // // toast.success('Event exported to calendar');
  };

  const updateAvailability = (day, field, value) => {
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const saveAvailability = async () => {
    try {
      // API call to save availability
      // // toast.success('Availability updated successfully!');
      setShowAvailabilityModal(false);
    } catch (error) {
      toast.error('Failed to update availability');
    }
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
          {userType === 'creator' ? 'Your Schedule' : 'Book a Session'}
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
          
          {userType === 'creator' && allowEditing && (
            <>
              {showAvailability && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowAvailabilityModal(true)}
                  className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  title="Set Availability"
                >
                  <CogIcon className="w-5 h-5" />
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowEventModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                data-add-event-btn
              >
                <PlusIcon className="w-5 h-5" />
                Add Event
              </motion.button>
            </>
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
                  min-h-[100px] p-2 rounded-lg border transition-all
                  ${!date ? 'bg-gray-50 cursor-default' : 'bg-white hover:border-purple-300 cursor-pointer'}
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
                              ${event.status === 'cancelled' ? 'opacity-50 line-through' : ''}
                              ${config.color === 'purple' && event.status !== 'cancelled' ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : ''}
                              ${config.color === 'pink' && event.status !== 'cancelled' ? 'bg-pink-100 text-pink-700 hover:bg-pink-200' : ''}
                              ${config.color === 'blue' && event.status !== 'cancelled' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : ''}
                              ${config.color === 'green' && event.status !== 'cancelled' ? 'bg-green-100 text-green-700 hover:bg-green-200' : ''}
                              ${config.color === 'yellow' && event.status !== 'cancelled' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : ''}
                              ${config.color === 'gray' && event.status !== 'cancelled' ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : ''}
                              ${event.status === 'cancelled' ? 'bg-red-50 text-red-600' : ''}
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

      {/* Create/Edit Event Modal */}
      <AnimatePresence>
        {showEventModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  {editingEvent ? 'Edit Event' : 'Schedule Event'}
                </h3>
                <button
                  onClick={() => {
                    setShowEventModal(false);
                    setEditingEvent(null);
                  }}
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
                    {eventTypes.filter(type => type.id !== 'personal' || userType === 'creator').map(type => {
                      const Icon = type.icon;
                      return (
                        <button
                          key={type.id}
                          onClick={() => {
                            setNewEvent({ 
                              ...newEvent, 
                              type: type.id,
                              price: type.defaultPrice.toString()
                            });
                          }}
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
                
                {/* Duration & Price */}
                <div className="grid grid-cols-2 gap-3">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price (Tokens)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newEvent.price}
                      onChange={(e) => setNewEvent({ ...newEvent, price: e.target.value })}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                </div>
                
                {/* Max Participants (for group events) */}
                {(newEvent.type === 'class' || newEvent.type === 'live-stream') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Participants
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newEvent.maxParticipants}
                      onChange={(e) => setNewEvent({ ...newEvent, maxParticipants: parseInt(e.target.value) })}
                      placeholder="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                )}
                
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
                    placeholder="Add any notes or special requirements..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowEventModal(false);
                    setEditingEvent(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingEvent ? handleUpdateEvent : handleCreateEvent}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  {editingEvent ? 'Update Event' : 'Schedule Event'}
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
                  onClick={() => {
                    setShowEventDetails(false);
                    setEditingEvent(null);
                  }}
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
                    ${getEventTypeConfig(selectedEvent.type).color === 'yellow' ? 'bg-yellow-100 text-yellow-600' : ''}
                    ${getEventTypeConfig(selectedEvent.type).color === 'gray' ? 'bg-gray-100 text-gray-600' : ''}
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
                      ${selectedEvent.status === 'confirmed' ? 'bg-green-100 text-green-700' : ''}
                      ${selectedEvent.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : ''}
                      ${selectedEvent.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
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
                  {selectedEvent.participants && selectedEvent.participants.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Participants</span>
                      <span className="font-medium">{selectedEvent.participants.join(', ')}</span>
                    </div>
                  )}
                </div>
                
                {/* Actions */}
                <div className="flex gap-3">
                  {userType === 'creator' && allowEditing ? (
                    <>
                      {selectedEvent.status !== 'cancelled' && (
                        <>
                          <button
                            onClick={() => {
                              setEditingEvent(selectedEvent);
                              setNewEvent({
                                ...selectedEvent,
                                date: new Date(selectedEvent.date).toISOString().split('T')[0],
                                time: formatTime(new Date(selectedEvent.date)),
                                price: selectedEvent.price?.toString() || ''
                              });
                              setShowEventDetails(false);
                              setShowEventModal(true);
                            }}
                            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                          >
                            <PencilIcon className="w-5 h-5" />
                            Edit Event
                          </button>
                          <button
                            onClick={() => handleCancelEvent(selectedEvent.id)}
                            className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
                            title="Cancel Event"
                          >
                            <XMarkIcon className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => exportToCalendar(selectedEvent)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        title="Export to Calendar"
                      >
                        <ArrowDownTrayIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(selectedEvent.id)}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                        title="Delete Event"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setShowEventDetails(false);
                          if (onScheduleEvent) {
                            onScheduleEvent(selectedEvent);
                          }
                        }}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckIcon className="w-5 h-5" />
                        Book This Session
                      </button>
                      <button
                        onClick={() => exportToCalendar(selectedEvent)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        title="Export to Calendar"
                      >
                        <ArrowDownTrayIcon className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Availability Settings Modal */}
      <AnimatePresence>
        {showAvailabilityModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Set Your Availability</h3>
                <button
                  onClick={() => setShowAvailabilityModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-gray-600">Define when you're available for bookings. Fans will only be able to schedule sessions during these times.</p>
                
                {Object.entries(availability).map(([day, settings]) => (
                  <div key={day} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <label className="flex items-center gap-2 min-w-[120px]">
                      <input
                        type="checkbox"
                        checked={settings.enabled}
                        onChange={(e) => updateAvailability(day, 'enabled', e.target.checked)}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="font-medium capitalize">{day}</span>
                    </label>
                    
                    {settings.enabled && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">From</span>
                          <input
                            type="time"
                            value={settings.start}
                            onChange={(e) => updateAvailability(day, 'start', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">To</span>
                          <input
                            type="time"
                            value={settings.end}
                            onChange={(e) => updateAvailability(day, 'end', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAvailabilityModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAvailability}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Save Availability
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EnhancedScheduleCalendar;