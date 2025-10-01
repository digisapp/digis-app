import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase-auth.js';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const CreatorAvailabilityCalendar = ({ user, onClose }) => {
  const [availability, setAvailability] = useState({});
  const [timezone, setTimezone] = useState('UTC');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return [`${hour}:00`, `${hour}:30`];
  }).flat();

  const detectTimezone = useCallback(() => {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(detectedTimezone);
  }, []);

  const fetchAvailability = useCallback(async () => {
    try {
      setLoading(true);
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/creators/availability`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAvailability(data.availability || {});
        setTimezone(data.timezone || timezone);
      } else {
        // Mock data for development
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
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
      toast.error('Failed to load availability');
    } finally {
      setLoading(false);
    }
  }, [timezone]);

  useEffect(() => {
    fetchAvailability();
    detectTimezone();
  }, [fetchAvailability, detectTimezone]);

  const saveAvailability = async () => {
    try {
      setSaving(true);
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/creators/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          availability,
          timezone
        })
      });

      if (response.ok) {
        // toast.success('Availability updated successfully!');
      } else {
        // Mock success for development
        // toast.success('Availability updated successfully!');
      }
    } catch (error) {
      console.error('Error saving availability:', error);
      toast.error('Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  const addTimeSlot = (day) => {
    const newSlot = {
      start: '09:00',
      end: '10:00',
      type: 'all',
      price: 40
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

  const copyToAllDays = (day) => {
    const dayAvailability = availability[day] || [];
    const newAvailability = {};
    
    daysOfWeek.forEach(d => {
      newAvailability[d] = [...dayAvailability];
    });
    
    setAvailability(newAvailability);
    // toast.success('Copied availability to all days');
  };

  const clearDay = (day) => {
    setAvailability(prev => ({
      ...prev,
      [day]: []
    }));
  };

  const getTotalHours = () => {
    let total = 0;
    Object.values(availability).forEach(daySlots => {
      daySlots.forEach(slot => {
        const start = new Date(`1970-01-01T${slot.start}:00`);
        const end = new Date(`1970-01-01T${slot.end}:00`);
        const hours = (end - start) / (1000 * 60 * 60);
        total += hours;
      });
    });
    return total;
  };

  const renderTimeSlot = (day, slot, index) => (
    <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
          <select
            value={slot.start}
            onChange={(e) => updateTimeSlot(day, index, 'start', e.target.value)}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          >
            {timeOptions.map(time => (
              <option key={time} value={time}>{time}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
          <select
            value={slot.end}
            onChange={(e) => updateTimeSlot(day, index, 'end', e.target.value)}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          >
            {timeOptions.map(time => (
              <option key={time} value={time}>{time}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Session Type</label>
          <select
            value={slot.type}
            onChange={(e) => updateTimeSlot(day, index, 'type', e.target.value)}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="all">All Types</option>
            <option value="video">Video Only</option>
            <option value="voice">Voice Only</option>
            <option value="stream">Streaming</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Price (tokens/min)</label>
          <input
            type="number"
            min="1"
            max="500"
            value={slot.price}
            onChange={(e) => updateTimeSlot(day, index, 'price', parseInt(e.target.value))}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => removeTimeSlot(day, index)}
          className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
        >
          🗑️ Remove
        </button>
      </div>
    </div>
  );

  const renderDayColumn = (day) => {
    const daySlots = availability[day] || [];
    const totalHours = daySlots.reduce((sum, slot) => {
      const start = new Date(`1970-01-01T${slot.start}:00`);
      const end = new Date(`1970-01-01T${slot.end}:00`);
      return sum + (end - start) / (1000 * 60 * 60);
    }, 0);

    return (
      <div key={day} className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">{day}</h3>
            <p className="text-xs text-gray-500">
              {daySlots.length} slots • {totalHours.toFixed(1)}h total
            </p>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => addTimeSlot(day)}
              className="p-1 text-blue-600 hover:bg-blue-50 rounded text-sm"
              title="Add time slot"
            >
              ➕
            </button>
            {daySlots.length > 0 && (
              <>
                <button
                  onClick={() => copyToAllDays(day)}
                  className="p-1 text-green-600 hover:bg-green-50 rounded text-sm"
                  title="Copy to all days"
                >
                  📋
                </button>
                <button
                  onClick={() => clearDay(day)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded text-sm"
                  title="Clear day"
                >
                  🗑️
                </button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {daySlots.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-2xl mb-2">📅</div>
              <p className="text-sm">No availability set</p>
              <button
                onClick={() => addTimeSlot(day)}
                className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                Add Time Slot
              </button>
            </div>
          ) : (
            daySlots.map((slot, index) => renderTimeSlot(day, slot, index))
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <span>Loading availability...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Availability Calendar</h2>
              <p className="text-gray-600 mt-1">Set your available hours for calls and streams</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ×
            </button>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                </select>
              </div>

              <div className="text-sm text-gray-600">
                <div>Total weekly hours: <strong>{getTotalHours().toFixed(1)}h</strong></div>
                <div>Available days: <strong>{Object.keys(availability).filter(day => availability[day]?.length > 0).length}/7</strong></div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setAvailability({})}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Clear All
              </button>
              <button
                onClick={saveAvailability}
                disabled={saving}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 flex items-center"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {daysOfWeek.map(day => renderDayColumn(day))}
          </div>

          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">💡 Tips for Setting Availability</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Set consistent weekly hours to build a regular audience</li>
              <li>• Consider your most productive times for different session types</li>
              <li>• Leave buffer time between sessions for breaks</li>
              <li>• Higher prices during peak hours can maximize earnings</li>
              <li>• Use "Copy to all days" to quickly set a regular schedule</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatorAvailabilityCalendar;