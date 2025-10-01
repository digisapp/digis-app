import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarIcon,
  ClockIcon,
  VideoCameraIcon,
  PhoneIcon,
  UserIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';

const MobileSchedule = ({ user, onNavigate }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [activeView, setActiveView] = useState('month');
  const [showDayEvents, setShowDayEvents] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventType, setEventType] = useState('');
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    time: '',
    duration: 30,
    type: 'video'
  });

  // Get calendar data
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty days for alignment
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add actual days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const formatMonth = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setSelectedDate(newDate);
  };

  // Mock scheduled events
  const events = [
    {
      id: 1,
      date: new Date(2024, 11, 28, 14, 0),
      type: 'video',
      fanName: 'Sarah Mitchell',
      fanAvatar: '/api/placeholder/40/40',
      duration: 30,
      tokens: 150,
      status: 'confirmed'
    },
    {
      id: 2,
      date: new Date(2024, 11, 28, 16, 30),
      type: 'voice',
      fanName: 'Mike Johnson',
      fanAvatar: '/api/placeholder/40/40',
      duration: 15,
      tokens: 75,
      status: 'pending'
    },
    {
      id: 3,
      date: new Date(2024, 11, 29, 15, 0),
      type: 'video',
      fanName: 'Emma Wilson',
      fanAvatar: '/api/placeholder/40/40',
      duration: 45,
      tokens: 225,
      status: 'confirmed'
    },
    {
      id: 4,
      date: new Date(2024, 11, 30, 18, 0),
      type: 'stream',
      title: 'Live Q&A Session',
      expectedViewers: 50,
      duration: 60,
      status: 'scheduled'
    }
  ];

  const getEventsForDate = (date) => {
    if (!date) return [];
    return events.filter(event => 
      event.date.getDate() === date.getDate() &&
      event.date.getMonth() === date.getMonth() &&
      event.date.getFullYear() === date.getFullYear()
    );
  };

  const getTodayEvents = () => {
    const today = new Date();
    return events.filter(event => 
      event.date.getDate() === today.getDate() &&
      event.date.getMonth() === today.getMonth() &&
      event.date.getFullYear() === today.getFullYear()
    );
  };

  const getUpcomingEvents = () => {
    const now = new Date();
    return events.filter(event => event.date > now).sort((a, b) => a.date - b.date);
  };

  const isToday = (date) => {
    const today = new Date();
    return date && 
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const calendarDays = getDaysInMonth(selectedDate);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pb-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white pb-4" style={{ paddingTop: 'env(safe-area-inset-top, 20px)' }}>
        <div className="px-4 pt-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Schedule</h1>
            <button
              onClick={() => setShowAddEvent(true)}
              className="bg-white/20 backdrop-blur-sm p-2 rounded-full active:scale-95 transition-transform"
              aria-label="Add event"
            >
              <PlusIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Today's Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{getTodayEvents().length}</p>
              <p className="text-xs text-white/80">Today</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{getUpcomingEvents().length}</p>
              <p className="text-xs text-white/80">Upcoming</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">8</p>
              <p className="text-xs text-white/80">This Week</p>
            </div>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-xl shadow-sm p-1 flex">
          <button
            onClick={() => setActiveView('month')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeView === 'month'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setActiveView('week')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeView === 'week'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setActiveView('list')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeView === 'list'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            List
          </button>
        </div>
      </div>

      {/* Calendar/List View */}
      <div className="px-4 mt-4">
        {activeView === 'month' && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
              </button>
              <h2 className="font-semibold text-gray-900">{formatMonth(selectedDate)}</h2>
              <button
                onClick={() => navigateMonth(1)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRightIcon className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Days of Week */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {daysOfWeek.map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-500">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, index) => {
                const dayEvents = date ? getEventsForDate(date) : [];
                const hasEvents = dayEvents.length > 0;
                
                return (
                  <motion.div
                    key={index}
                    className={`aspect-square relative ${
                      date ? 'hover:bg-gray-50 cursor-pointer active:bg-gray-100' : ''
                    }`}
                    onClick={() => {
                      if (date) {
                        setSelectedDate(date);
                        const eventsForDay = getEventsForDate(date);
                        if (eventsForDay.length > 0) {
                          setSelectedDayEvents(eventsForDay);
                          setShowDayEvents(true);
                        } else {
                          // No events, show option to add
                          setNewEvent(prev => ({
                            ...prev,
                            date: date.toISOString().split('T')[0],
                          }));
                          setShowAddEvent(true);
                        }
                      }
                    }}
                    whileTap={date ? { scale: 0.95 } : {}}
                  >
                    {date && (
                      <>
                        <div className={`text-center pt-1 ${
                          isToday(date) ? 'text-white' : 'text-gray-700'
                        }`}>
                          <span className={`text-sm ${
                            isToday(date)
                              ? 'bg-blue-600 text-white w-6 h-6 rounded-full inline-flex items-center justify-center'
                              : ''
                          }`}>
                            {date.getDate()}
                          </span>
                        </div>
                        {hasEvents && (
                          <div className="absolute bottom-1 left-0 right-0 flex justify-center space-x-1">
                            {dayEvents.slice(0, 3).map((event, i) => (
                              <div
                                key={i}
                                className={`w-1 h-1 rounded-full ${
                                  event.type === 'video' ? 'bg-purple-500' :
                                  event.type === 'voice' ? 'bg-blue-500' :
                                  'bg-red-500'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {activeView === 'week' && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="space-y-3">
              {/* Week view */}
              {(() => {
                const weekStart = new Date(selectedDate);
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                const weekDays = [];
                for (let i = 0; i < 7; i++) {
                  const day = new Date(weekStart);
                  day.setDate(weekStart.getDate() + i);
                  weekDays.push(day);
                }

                return weekDays.map((day, index) => {
                  const dayEvents = getEventsForDate(day);
                  return (
                    <div key={index} className="border-b border-gray-100 pb-2">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${
                            isToday(day) ? 'text-blue-600' : 'text-gray-700'
                          }`}>
                            {daysOfWeek[day.getDay()]}
                          </span>
                          <span className={`text-xs ${
                            isToday(day) ? 'bg-blue-600 text-white px-2 py-0.5 rounded-full' : 'text-gray-500'
                          }`}>
                            {day.getDate()}
                          </span>
                        </div>
                        {dayEvents.length > 0 && (
                          <span className="text-xs text-gray-500">
                            {dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {dayEvents.length > 0 ? (
                        <div className="space-y-1 ml-4">
                          {dayEvents.map((event, eventIndex) => (
                            <div key={eventIndex} className="flex items-center gap-2 text-xs">
                              <span className="text-gray-500">
                                {formatTime(event.date)}
                              </span>
                              <span className="text-gray-700 truncate">
                                {event.fanName || event.title}
                              </span>
                              {event.tokens && (
                                <span className="text-purple-600 font-medium">
                                  {event.tokens}t
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 ml-4">No events</p>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {activeView === 'list' && (
          <div className="space-y-3">
            {getUpcomingEvents().map((event) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-sm p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {event.fanAvatar ? (
                      <img
                        src={event.fanAvatar}
                        alt={event.fanName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        event.type === 'stream' ? 'bg-red-100' : 'bg-purple-100'
                      }`}>
                        {event.type === 'stream' ? (
                          <VideoCameraIcon className="w-6 h-6 text-red-600" />
                        ) : event.type === 'video' ? (
                          <VideoCameraIcon className="w-6 h-6 text-purple-600" />
                        ) : (
                          <PhoneIcon className="w-6 h-6 text-blue-600" />
                        )}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">
                        {event.fanName || event.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {event.type === 'video' ? 'Video Call' :
                         event.type === 'voice' ? 'Voice Call' :
                         'Live Stream'}
                      </p>
                    </div>
                  </div>
                  {event.status === 'confirmed' && (
                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  )}
                  {event.status === 'pending' && (
                    <ExclamationCircleIcon className="w-5 h-5 text-yellow-500" />
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-3 text-gray-600">
                    <div className="flex items-center space-x-1">
                      <CalendarIcon className="w-4 h-4" />
                      <span>{event.date.toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <ClockIcon className="w-4 h-4" />
                      <span>{formatTime(event.date)}</span>
                    </div>
                  </div>
                  {event.tokens && (
                    <span className="font-semibold text-purple-600">{event.tokens} tokens</span>
                  )}
                </div>

                <div className="mt-3 flex space-x-2">
                  <button className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold active:scale-95">
                    View Details
                  </button>
                  {event.status === 'pending' && (
                    <button className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-semibold active:scale-95">
                      Confirm
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Today's Schedule */}
      {activeView !== 'list' && getTodayEvents().length > 0 && (
        <div className="px-4 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Today's Schedule</h2>
          <div className="space-y-2">
            {getTodayEvents().map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-xl shadow-sm p-3 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${
                    event.type === 'video' ? 'bg-purple-100' :
                    event.type === 'voice' ? 'bg-blue-100' :
                    'bg-red-100'
                  }`}>
                    {event.type === 'video' || event.type === 'stream' ? (
                      <VideoCameraIcon className={`w-5 h-5 ${
                        event.type === 'stream' ? 'text-red-600' : 'text-purple-600'
                      }`} />
                    ) : (
                      <PhoneIcon className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {event.fanName || event.title}
                    </p>
                    <p className="text-xs text-gray-500">{formatTime(event.date)}</p>
                  </div>
                </div>
                <button className="text-blue-600 text-sm font-semibold">
                  Join
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      <AnimatePresence>
        {showAddEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end"
            onClick={() => setShowAddEvent(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white rounded-t-3xl w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Schedule Event</h3>
                <button
                  onClick={() => setShowAddEvent(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <XMarkIcon className="w-6 h-6 text-gray-500" />
                </button>
              </div>
              
              <div className="space-y-4">
                <button
                  onClick={() => {
                    setEventType('video');
                    setShowEventForm(true);
                    setShowAddEvent(false);
                  }}
                  className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold active:scale-95">
                  Schedule Video Call
                </button>
                <button
                  onClick={() => {
                    setEventType('voice');
                    setShowEventForm(true);
                    setShowAddEvent(false);
                  }}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold active:scale-95">
                  Schedule Voice Call
                </button>
                <button
                  onClick={() => {
                    setEventType('stream');
                    setShowEventForm(true);
                    setShowAddEvent(false);
                  }}
                  className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold active:scale-95">
                  Schedule Live Stream
                </button>
                <button
                  onClick={() => {
                    setEventType('blocked');
                    setShowEventForm(true);
                    setShowAddEvent(false);
                  }}
                  className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold active:scale-95">
                  Block Time Off
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Day Events Modal */}
      <AnimatePresence>
        {showDayEvents && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDayEvents(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {selectedDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric'
                  })}
                </h3>
                <button
                  onClick={() => setShowDayEvents(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <XMarkIcon className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {selectedDayEvents.map((event) => (
                  <div key={event.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {event.fanName || event.title}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {formatTime(event.date)} • {event.duration} min
                        </p>
                        {event.tokens && (
                          <p className="text-sm text-purple-600 font-medium mt-1">
                            {event.tokens} tokens
                          </p>
                        )}
                      </div>
                      <div className={`p-2 rounded-lg ${
                        event.type === 'video' ? 'bg-purple-100' :
                        event.type === 'voice' ? 'bg-blue-100' :
                        'bg-red-100'
                      }`}>
                        {event.type === 'video' || event.type === 'stream' ? (
                          <VideoCameraIcon className={`w-5 h-5 ${
                            event.type === 'stream' ? 'text-red-600' : 'text-purple-600'
                          }`} />
                        ) : (
                          <PhoneIcon className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  setShowDayEvents(false);
                  setNewEvent(prev => ({
                    ...prev,
                    date: selectedDate.toISOString().split('T')[0],
                  }));
                  setShowAddEvent(true);
                }}
                className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg font-semibold active:scale-95"
              >
                Add Event to This Day
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event Form Modal */}
      <AnimatePresence>
        {showEventForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end"
            onClick={() => setShowEventForm(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white rounded-t-3xl w-full p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {eventType === 'video' ? 'Schedule Video Call' :
                   eventType === 'voice' ? 'Schedule Voice Call' :
                   eventType === 'stream' ? 'Schedule Live Stream' :
                   'Block Time Off'}
                </h3>
                <button
                  onClick={() => setShowEventForm(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <XMarkIcon className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={eventType === 'stream' ? 'Stream title' : 'Event title'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (minutes)
                  </label>
                  <select
                    value={newEvent.duration}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                  </select>
                </div>

                <button
                  onClick={() => {
                    console.log('Creating event:', { ...newEvent, type: eventType });
                    alert(`${eventType === 'video' ? 'Video call' :
                           eventType === 'voice' ? 'Voice call' :
                           eventType === 'stream' ? 'Live stream' :
                           'Time block'} scheduled for ${newEvent.date} at ${newEvent.time}!`);
                    setShowEventForm(false);
                    setNewEvent({
                      title: '',
                      date: '',
                      time: '',
                      duration: 30,
                      type: 'video'
                    });
                  }}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold active:scale-95"
                >
                  Schedule Event
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileSchedule;