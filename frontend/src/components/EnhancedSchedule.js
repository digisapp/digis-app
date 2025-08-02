import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDaysIcon,
  ClockIcon,
  CurrencyDollarIcon,
  VideoCameraIcon,
  PhoneIcon,
  SignalIcon,
  PlusIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  UserGroupIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon,
  StarIcon
} from '@heroicons/react/24/solid';
import Card from './ui/Card';
import Button from './ui/Button';
import toast from 'react-hot-toast';

const EnhancedSchedule = ({ user, onClose }) => {
  const [availability, setAvailability] = useState({});
  const [timezone, setTimezone] = useState('UTC');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeDay, setActiveDay] = useState('Monday');
  const [showQuickSetup, setShowQuickSetup] = useState(false);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayShort = {
    Monday: 'Mon',
    Tuesday: 'Tue',
    Wednesday: 'Wed',
    Thursday: 'Thu',
    Friday: 'Fri',
    Saturday: 'Sat',
    Sunday: 'Sun'
  };

  const sessionTypes = {
    all: { label: 'All Types', icon: SparklesIcon, color: 'purple' },
    video: { label: 'Video Call', icon: VideoCameraIcon, color: 'blue' },
    voice: { label: 'Voice Call', icon: PhoneIcon, color: 'green' },
    stream: { label: 'Private Stream', icon: SignalIcon, color: 'red' }
  };

  const quickSetupTemplates = [
    {
      name: 'Full Time Creator',
      description: 'Monday-Friday, 9 AM - 5 PM',
      schedule: {
        Monday: [{ start: '09:00', end: '17:00', type: 'all', price: 40 }],
        Tuesday: [{ start: '09:00', end: '17:00', type: 'all', price: 40 }],
        Wednesday: [{ start: '09:00', end: '17:00', type: 'all', price: 40 }],
        Thursday: [{ start: '09:00', end: '17:00', type: 'all', price: 40 }],
        Friday: [{ start: '09:00', end: '17:00', type: 'all', price: 40 }]
      }
    },
    {
      name: 'Evening Creator',
      description: 'Weekdays 6-10 PM, Weekends flexible',
      schedule: {
        Monday: [{ start: '18:00', end: '22:00', type: 'all', price: 45 }],
        Tuesday: [{ start: '18:00', end: '22:00', type: 'all', price: 45 }],
        Wednesday: [{ start: '18:00', end: '22:00', type: 'all', price: 45 }],
        Thursday: [{ start: '18:00', end: '22:00', type: 'all', price: 45 }],
        Friday: [{ start: '18:00', end: '22:00', type: 'all', price: 45 }],
        Saturday: [{ start: '14:00', end: '20:00', type: 'all', price: 50 }],
        Sunday: [{ start: '14:00', end: '20:00', type: 'all', price: 50 }]
      }
    },
    {
      name: 'Weekend Warrior',
      description: 'Saturday & Sunday, all day',
      schedule: {
        Saturday: [
          { start: '10:00', end: '14:00', type: 'all', price: 50 },
          { start: '16:00', end: '20:00', type: 'all', price: 55 }
        ],
        Sunday: [
          { start: '10:00', end: '14:00', type: 'all', price: 50 },
          { start: '16:00', end: '20:00', type: 'all', price: 55 }
        ]
      }
    }
  ];

  useEffect(() => {
    // Detect timezone
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(detectedTimezone);

    // Load mock data
    setAvailability({
      Monday: [
        { start: '09:00', end: '12:00', type: 'video', price: 45 },
        { start: '14:00', end: '18:00', type: 'all', price: 40 }
      ],
      Wednesday: [
        { start: '10:00', end: '16:00', type: 'all', price: 40 }
      ],
      Friday: [
        { start: '15:00', end: '20:00', type: 'voice', price: 35 }
      ]
    });
  }, []);

  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(time);
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  const formatTime = (time) => {
    const [hour, minute] = time.split(':');
    const h = parseInt(hour);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}:${minute} ${period}`;
  };

  const calculateDuration = (start, end) => {
    const startTime = new Date(`1970-01-01T${start}:00`);
    const endTime = new Date(`1970-01-01T${end}:00`);
    const hours = (endTime - startTime) / (1000 * 60 * 60);
    return hours;
  };

  const getTotalHours = () => {
    let total = 0;
    Object.values(availability).forEach(daySlots => {
      daySlots.forEach(slot => {
        total += calculateDuration(slot.start, slot.end);
      });
    });
    return total;
  };

  const getEstimatedEarnings = () => {
    let earnings = 0;
    Object.values(availability).forEach(daySlots => {
      daySlots.forEach(slot => {
        const hours = calculateDuration(slot.start, slot.end);
        earnings += hours * 60 * slot.price; // Convert to minutes and multiply by price
      });
    });
    return earnings;
  };

  const addTimeSlot = (day) => {
    const lastSlot = availability[day]?.[availability[day].length - 1];
    const newSlot = {
      start: lastSlot ? lastSlot.end : '09:00',
      end: '10:00',
      type: 'all',
      price: 40,
      minimumDuration: 15
    };

    setAvailability(prev => ({
      ...prev,
      [day]: [...(prev[day] || []), newSlot]
    }));
  };

  const updateTimeSlot = (day, index, field, value) => {
    setAvailability(prev => ({
      ...prev,
      [day]: prev[day].map((slot, i) => 
        i === index ? { ...slot, [field]: value } : slot
      )
    }));
  };

  const removeTimeSlot = (day, index) => {
    setAvailability(prev => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== index)
    }));
  };

  const copyToDay = (fromDay, toDay) => {
    const slots = availability[fromDay] || [];
    setAvailability(prev => ({
      ...prev,
      [toDay]: [...slots]
    }));
    // // toast.success(`Copied ${fromDay}'s schedule to ${toDay}`);
  };

  const applyTemplate = (template) => {
    setAvailability(template.schedule);
    setShowQuickSetup(false);
    // toast.success(`Applied "${template.name}" template`);
  };

  const saveAvailability = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setSaving(false);
    // // toast.success('Schedule saved successfully!');
  };

  const clearAll = () => {
    if (window.confirm('Are you sure you want to clear all availability?')) {
      setAvailability({});
      // // toast.success('All availability cleared');
    }
  };

  const renderTimeSlot = (day, slot, index) => {
    const TypeIcon = sessionTypes[slot.type].icon;
    const duration = calculateDuration(slot.start, slot.end);
    const earnings = duration * 60 * slot.price;

    return (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-${sessionTypes[slot.type].color}-100`}>
              <TypeIcon className={`w-5 h-5 text-${sessionTypes[slot.type].color}-600`} />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {formatTime(slot.start)} - {formatTime(slot.end)}
              </p>
              <p className="text-sm text-gray-500">{duration}h • ${earnings} est.</p>
            </div>
          </div>
          <button
            onClick={() => removeTimeSlot(day, index)}
            className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
            <select
              value={slot.type}
              onChange={(e) => updateTimeSlot(day, index, 'type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {Object.entries(sessionTypes).map(([key, type]) => (
                <option key={key} value={key}>{type.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Rate ($/min)</label>
            <div className="relative">
              <CurrencyDollarIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="number"
                min="1"
                max="500"
                value={slot.price}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (value >= 1) {
                    updateTimeSlot(day, index, 'price', value);
                  }
                }}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Min charge: ${slot.price * (slot.minimumDuration || 15)}
            </p>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Min Duration</label>
            <select
              value={slot.minimumDuration || 15}
              onChange={(e) => updateTimeSlot(day, index, 'minimumDuration', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value={5}>5 min</option>
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
              <option value={20}>20 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start</label>
            <select
              value={slot.start}
              onChange={(e) => updateTimeSlot(day, index, 'start', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {timeOptions.map(time => (
                <option key={time} value={time}>{formatTime(time)}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">End</label>
            <select
              value={slot.end}
              onChange={(e) => updateTimeSlot(day, index, 'end', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {timeOptions.map(time => (
                <option key={time} value={time}>{formatTime(time)}</option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderDaySchedule = (day) => {
    const daySlots = availability[day] || [];
    const dayHours = daySlots.reduce((sum, slot) => sum + calculateDuration(slot.start, slot.end), 0);
    const dayEarnings = daySlots.reduce((sum, slot) => sum + calculateDuration(slot.start, slot.end) * 60 * slot.price, 0);
    const isActive = activeDay === day;

    return (
      <motion.div
        key={day}
        className={`border-2 rounded-2xl p-6 cursor-pointer transition-all ${
          isActive ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
        onClick={() => setActiveDay(day)}
        whileHover={{ y: -2 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{day}</h3>
            <p className="text-sm text-gray-500">
              {daySlots.length > 0 ? (
                <>
                  {daySlots.length} slot{daySlots.length > 1 ? 's' : ''} • {dayHours}h • ${dayEarnings}
                </>
              ) : (
                'No availability'
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {daySlots.length > 0 && (
              <CheckCircleIcon className="w-5 h-5 text-green-500" />
            )}
          </div>
        </div>

        {isActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-3"
          >
            {daySlots.length === 0 ? (
              <div className="text-center py-8">
                <CalendarDaysIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No availability set for {day}</p>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    addTimeSlot(day);
                  }}
                  size="sm"
                  className="mx-auto"
                >
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Add Time Slot
                </Button>
              </div>
            ) : (
              <>
                <AnimatePresence mode="popLayout">
                  {daySlots.map((slot, index) => renderTimeSlot(day, slot, index))}
                </AnimatePresence>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    addTimeSlot(day);
                  }}
                  variant="secondary"
                  size="sm"
                  className="w-full"
                >
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Add Another Slot
                </Button>
              </>
            )}

            {daySlots.length > 0 && (
              <div className="pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2">Copy this schedule to:</p>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.filter(d => d !== day).map(targetDay => (
                    <button
                      key={targetDay}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToDay(day, targetDay);
                      }}
                      className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      {dayShort[targetDay]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-50 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-xl">
                <CalendarDaysIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Schedule Management</h2>
                <p className="text-sm text-gray-600">Set your availability for calls and streams</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-purple-100">Total Hours/Week</p>
              <p className="text-2xl font-bold">{getTotalHours()}h</p>
            </div>
            <div>
              <p className="text-sm text-purple-100">Active Days</p>
              <p className="text-2xl font-bold">
                {Object.keys(availability).filter(day => availability[day]?.length > 0).length}/7
              </p>
            </div>
            <div>
              <p className="text-sm text-purple-100">Est. Weekly Earnings</p>
              <p className="text-2xl font-bold">${getEstimatedEarnings().toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-purple-100">Timezone</p>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 px-3 py-1 bg-white/20 border border-white/30 rounded-lg text-white text-sm w-full"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="America/Phoenix">Arizona Time</option>
                <option value="America/Anchorage">Alaska Time</option>
                <option value="Pacific/Honolulu">Hawaii Time</option>
                <option value="Europe/London">London (GMT)</option>
                <option value="Europe/Paris">Paris (CET)</option>
                <option value="Europe/Berlin">Berlin (CET)</option>
                <option value="Asia/Tokyo">Tokyo (JST)</option>
                <option value="Asia/Shanghai">Shanghai (CST)</option>
                <option value="Asia/Singapore">Singapore (SGT)</option>
                <option value="Australia/Sydney">Sydney (AEDT)</option>
                <option value="Asia/Dubai">Dubai (GST)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowQuickSetup(true)}
              >
                <SparklesIcon className="w-4 h-4 mr-1" />
                Quick Setup
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
              >
                Clear All
              </Button>
            </div>
            <Button
              onClick={saveAvailability}
              disabled={saving}
              className="min-w-[120px]"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4 mr-1" />
                  Save Schedule
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {daysOfWeek.map(day => renderDaySchedule(day))}
          </div>

          {/* Pro Tips - Enhanced UI/UX */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 relative overflow-hidden rounded-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 via-pink-400/10 to-purple-400/10" />
            <Card className="relative bg-white/90 backdrop-blur-sm p-8 border-0 shadow-xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl" />
              <div className="relative">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-6 flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl">
                    <SparklesIcon className="w-8 h-8 text-purple-600" />
                  </div>
                  Pro Tips for Maximizing Earnings
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-5 border border-purple-200 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-200 rounded-lg">
                        <CurrencyDollarIcon className="w-6 h-6 text-purple-700" />
                      </div>
                      <div>
                        <p className="font-semibold text-purple-900 mb-2">Smart Pricing Strategy</p>
                        <p className="text-sm text-purple-700 leading-relaxed">
                          Quick sessions (5-15 min): $4-5/min<br/>
                          Medium sessions (15-30 min): $2-3/min<br/>
                          Long sessions (30-60 min): $1-2/min
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="bg-gradient-to-br from-pink-50 to-pink-100/50 rounded-xl p-5 border border-pink-200 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-pink-200 rounded-lg">
                        <ChartBarIcon className="w-6 h-6 text-pink-700" />
                      </div>
                      <div>
                        <p className="font-semibold text-pink-900 mb-2">Service-Based Pricing</p>
                        <p className="text-sm text-pink-700 leading-relaxed">
                          Video calls command higher rates than voice. Private streams can be premium priced for exclusive content.
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-5 border border-blue-200 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-200 rounded-lg">
                        <ClockIcon className="w-6 h-6 text-blue-700" />
                      </div>
                      <div>
                        <p className="font-semibold text-blue-900 mb-2">Minimum Duration Protection</p>
                        <p className="text-sm text-blue-700 leading-relaxed">
                          At least a 3 minute minimum is recommended. You'll receive the minimum payment even if fans end early.
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-5 border border-green-200 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-green-200 rounded-lg">
                        <StarIcon className="w-6 h-6 text-green-700" />
                      </div>
                      <div>
                        <p className="font-semibold text-green-900 mb-2">Strategic Offers</p>
                        <p className="text-sm text-green-700 leading-relaxed">
                          Accept custom offers for special requests or off-hours at premium rates to maximize your earnings potential.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </div>

                <div className="mt-6 p-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl border border-purple-300">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg">
                      <ExclamationTriangleIcon className="w-5 h-5 text-purple-600" />
                    </div>
                    <p className="text-sm text-purple-800">
                      <span className="font-semibold">Pro Tip:</span> Start with competitive rates and adjust based on demand. Track your most profitable time slots and services to optimize your schedule.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Quick Setup Modal */}
        <AnimatePresence>
          {showQuickSetup && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
              onClick={() => setShowQuickSetup(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-white rounded-xl p-6 max-w-2xl w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Setup Templates</h3>
                <div className="space-y-3">
                  {quickSetupTemplates.map((template, index) => (
                    <button
                      key={index}
                      onClick={() => applyTemplate(template)}
                      className="w-full p-4 bg-gray-50 hover:bg-gray-100 rounded-xl text-left transition-colors"
                    >
                      <p className="font-semibold text-gray-900">{template.name}</p>
                      <p className="text-sm text-gray-600">{template.description}</p>
                    </button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setShowQuickSetup(false)}
                  className="w-full mt-4"
                >
                  Cancel
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

const LightBulbIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
  </svg>
);

export default EnhancedSchedule;