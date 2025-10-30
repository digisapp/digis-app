import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  CalendarIcon,
  CalendarDaysIcon,
  ClockIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  VideoCameraIcon,
  PhoneIcon,
  MegaphoneIcon,
  UserGroupIcon,
  CheckCircleIcon,
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  SparklesIcon,
  BellIcon,
  Cog6ToothIcon,
  AcademicCapIcon,
  InboxIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import EnhancedScheduleCalendar from '../EnhancedScheduleCalendar';
import Button from '../ui/Button';
import Card from '../ui/Card';
import toast from 'react-hot-toast';
import { getAuthToken } from '../../utils/supabase-auth';

const SchedulePage = ({ user, isCreator = false }) => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('month'); // month, week, day
  const [showAvailability, setShowAvailability] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [stats, setStats] = useState({
    totalEvents: 0,
    upcomingCalls: 0,
    completedCalls: 0,
    revenue: 0
  });

  // Fetch events and stats
  useEffect(() => {
    let isMounted = true;

    const fetchAllData = async () => {
      if (!isMounted || !user?.id) return;

      await fetchScheduleData();
      if (isCreator) {
        await fetchPendingRequestsCount();
      }
    };

    fetchAllData();

    return () => {
      isMounted = false;
    };
  }, [user?.id, isCreator]); // Only depend on stable user ID

  const fetchPendingRequestsCount = async () => {
    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/sessions/requests?status=pending`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPendingRequestsCount(data.requests?.length || 0);
      } else if (response.status === 404) {
        // Endpoint not implemented yet, silently skip
        console.log('ℹ️ Pending requests endpoint not available yet');
        setPendingRequestsCount(0);
      }
    } catch (error) {
      // Silently handle 404 - endpoint not implemented yet
      if (error.message?.includes('404') || error.message?.includes('NOT_FOUND')) {
        console.log('ℹ️ Pending requests endpoint not available yet');
        setPendingRequestsCount(0);
        return;
      }
      console.error('Error fetching pending requests count:', error);
    }
  };

  const fetchScheduleData = async () => {
    if (!user?.id) {
      console.log('User not loaded yet, skipping schedule fetch');
      return;
    }

    try {
      setIsLoading(true);
      const authToken = await getAuthToken();

      let allEvents = [];
      let calendarEvents = [];
      let stats = {
        totalEvents: 0,
        upcomingCalls: 0,
        completedCalls: 0,
        revenue: 0
      };

      // Fetch calendar events from the new endpoint
      try {
        const calendarResponse = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/schedule/calendar-events/${user?.id}`,
          {
            headers: { Authorization: `Bearer ${authToken}` }
          }
        );

        if (calendarResponse.ok) {
          const calendarData = await calendarResponse.json();
          calendarEvents = (calendarData.events || [])
            .filter(event => event.status !== 'cancelled') // Filter out cancelled events
            .map(event => ({
              id: event.id,
              type: event.event_type,
              title: event.title,
              date: event.scheduled_date,
              time: event.scheduled_time,
              duration: event.duration_minutes,
              status: event.status,
              fan_id: event.fan_id,
              creator_id: event.creator_id,
              isFromCalendar: true
            }));
        } else if (calendarResponse.status === 404) {
          console.log('ℹ️ Calendar events endpoint not available yet');
        }
      } catch (error) {
        if (!error.message?.includes('404')) {
          console.error('Error fetching calendar events:', error);
        }
      }

      // Fetch regular events (calls, etc.)
      try {
        const eventsResponse = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/schedule/${user?.id}`,
          {
            headers: { Authorization: `Bearer ${authToken}` }
          }
        );

        if (eventsResponse.ok) {
          const data = await eventsResponse.json();
          const sessionEvents = (data.events || [])
            .filter(event => event.status !== 'cancelled'); // Filter out cancelled events

          allEvents = [...calendarEvents, ...sessionEvents];
          stats = {
            totalEvents: data.stats?.totalEvents || 0,
            upcomingCalls: data.stats?.upcomingCalls || 0,
            completedCalls: data.stats?.completedCalls || 0,
            revenue: data.stats?.revenue || 0
          };
        } else if (eventsResponse.status === 404) {
          console.log('ℹ️ Schedule endpoint not available yet');
          allEvents = [...calendarEvents];
        }
      } catch (error) {
        if (!error.message?.includes('404')) {
          console.error('Error fetching schedule events:', error);
        }
        allEvents = [...calendarEvents];
      }

      // Fetch enrolled classes
      try {
        const classesResponse = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/classes/enrolled/${user?.id}`,
          {
            headers: { Authorization: `Bearer ${authToken}` }
          }
        );

        if (classesResponse.ok) {
          const classData = await classesResponse.json();
          const classEvents = (classData.classes || []).map(cls => ({
            id: `class-${cls.id}`,
            type: 'class',
            title: cls.title,
            date: cls.scheduled_date,
            time: cls.scheduled_time,
            duration: cls.duration || 60,
            instructor: cls.creator_name,
            instructor_id: cls.creator_id,
            price: cls.price,
            enrolled: true,
            category: cls.category
          }));

          allEvents = [...allEvents, ...classEvents];
          stats.totalEvents += classEvents.length;
        } else if (classesResponse.status === 404) {
          console.log('ℹ️ Enrolled classes endpoint not available yet');
        }
      } catch (error) {
        if (!error.message?.includes('404')) {
          console.error('Error fetching enrolled classes:', error);
        }
      }

      // If user is a creator, also fetch classes they're hosting
      if (isCreator) {
        try {
          const hostingResponse = await fetch(
            `${import.meta.env.VITE_BACKEND_URL}/classes/hosting/${user?.id}`,
            {
              headers: { Authorization: `Bearer ${authToken}` }
            }
          );

          if (hostingResponse.ok) {
            const hostingData = await hostingResponse.json();
            const hostingEvents = (hostingData.classes || []).map(cls => ({
              id: `hosting-${cls.id}`,
              type: 'class',
              title: cls.title + ' (Hosting)',
              date: cls.scheduled_date,
              time: cls.scheduled_time,
              duration: cls.duration || 60,
              hosting: true,
              enrolled_count: cls.enrolled_count || 0,
              max_participants: cls.max_participants,
              price: cls.price,
              category: cls.category
            }));

            // Avoid duplicates if creator enrolled in their own class
            const hostingIds = new Set(hostingEvents.map(e => e.id.replace('hosting-', '')));
            allEvents = allEvents.filter(e => !e.id.startsWith('class-') || !hostingIds.has(e.id.replace('class-', '')));
            allEvents = [...allEvents, ...hostingEvents];
            stats.totalEvents = allEvents.length;
          } else if (hostingResponse.status === 404) {
            console.log('ℹ️ Hosting classes endpoint not available yet');
          }
        } catch (error) {
          if (!error.message?.includes('404')) {
            console.error('Error fetching hosting classes:', error);
          }
        }
      }

      // Sort events by date/time
      allEvents.sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time}`);
        const dateB = new Date(`${b.date} ${b.time}`);
        return dateA - dateB;
      });

      setEvents(allEvents);
      setStats(stats);
    } catch (error) {
      console.error('Error fetching schedule:', error);
      // Don't show error toast for 404s - these are expected for unimplemented endpoints
      if (!error.message?.includes('404') && !error.message?.includes('NOT_FOUND')) {
        toast.error('Failed to load schedule');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    // Could open a detail modal or navigate to event details
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to cancel this event?')) return;

    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/schedule/calendar-events/${eventId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      if (response.ok) {
        toast.success('Event cancelled successfully');
        fetchScheduleData();
      } else {
        throw new Error('Failed to cancel event');
      }
    } catch (error) {
      console.error('Error cancelling event:', error);
      toast.error('Failed to cancel event');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Schedule Management
              </h1>
            </div>

          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Upcoming Events */}
          <div className="lg:col-span-1">
            <Card className="p-4 h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Upcoming Events
                </h2>
                <button
                  onClick={() => {
                    // Trigger the add event modal in the calendar component
                    const addEventBtn = document.querySelector('[data-add-event-btn]');
                    if (addEventBtn) addEventBtn.click();
                  }}
                  className="p-1.5 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                  title="Add new event"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {events.filter(e => new Date(e.date) >= new Date()).slice(0, 5).map((event, index) => (
                  <motion.div
                    key={event.id || index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        event.type === 'video' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                        event.type === 'voice' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                        event.type === 'class' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {event.type === 'video' ? <VideoCameraIcon className="w-4 h-4" /> :
                         event.type === 'voice' ? <PhoneIcon className="w-4 h-4" /> :
                         event.type === 'class' ? <AcademicCapIcon className="w-4 h-4" /> :
                         <CalendarIcon className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {event.title || (event.type === 'class' ? 'Class' : event.type + ' Call')}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(event.date).toLocaleDateString()} at {event.time}
                        </p>
                        {event.fan_username && (
                          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                            with @{event.fan_username}
                          </p>
                        )}
                        {event.instructor && !event.hosting && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            Instructor: {event.instructor}
                          </p>
                        )}
                        {event.hosting && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            {event.enrolled_count || 0}/{event.max_participants || '∞'} enrolled
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}

                {events.length === 0 && (
                  <div className="text-center py-8">
                    <CalendarIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No upcoming events
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Main Calendar Area */}
          <div className="lg:col-span-3">
            <Card className="p-6">
              <EnhancedScheduleCalendar
                user={user}
                userId={user?.id}
                userType={isCreator ? 'creator' : 'fan'}
                allowEditing={true}
                showAvailability={showAvailability}
                viewMode={viewMode}
                onScheduleEvent={(event) => {
                  console.log('Schedule event:', event);
                  toast.success('Event scheduled successfully!');
                  fetchScheduleData();
                }}
                onEventClick={handleEventClick}
                onDeleteEvent={handleDeleteEvent}
                events={events}
              />
            </Card>
          </div>
        </div>

      </div>

    </div>
  );
};

export default SchedulePage;