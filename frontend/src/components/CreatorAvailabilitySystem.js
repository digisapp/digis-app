import React, { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  MinusCircleIcon,
  SignalIcon,
  CogIcon,
  BellIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon as CheckCircleIconSolid,
  XCircleIcon as XCircleIconSolid,
  ClockIcon as ClockIconSolid,
  MinusCircleIcon as MinusCircleIconSolid
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';
import PropTypes from 'prop-types';

// Availability status constants
export const AVAILABILITY_STATES = {
  ONLINE: { 
    key: 'online', 
    label: 'Online', 
    color: 'green', 
    icon: CheckCircleIcon, 
    solidIcon: CheckCircleIconSolid,
    description: 'Available for calls'
  },
  BUSY: { 
    key: 'busy', 
    label: 'Busy', 
    color: 'red', 
    icon: XCircleIcon, 
    solidIcon: XCircleIconSolid,
    description: 'Currently in a call'
  },
  AWAY: { 
    key: 'away', 
    label: 'Away', 
    color: 'yellow', 
    icon: ClockIcon, 
    solidIcon: ClockIconSolid,
    description: 'Temporarily unavailable'
  },
  DO_NOT_DISTURB: { 
    key: 'dnd', 
    label: 'Do Not Disturb', 
    color: 'purple', 
    icon: MinusCircleIcon, 
    solidIcon: MinusCircleIconSolid,
    description: 'Not accepting calls'
  },
  OFFLINE: { 
    key: 'offline', 
    label: 'Offline', 
    color: 'gray', 
    icon: SignalIcon, 
    solidIcon: SignalIcon,
    description: 'Not available'
  }
};

const CreatorAvailabilitySystem = memo(({ 
  user, 
  currentStatus = 'offline',
  onStatusChange,
  showStats = true,
  compact = false 
}) => {
  const [status, setStatus] = useState(currentStatus);
  const [showSettings, setShowSettings] = useState(false);
  const [autoAwayEnabled, setAutoAwayEnabled] = useState(true);
  const [autoAwayTime, setAutoAwayTime] = useState(15); // minutes
  const [stats, setStats] = useState({
    queueCount: 0,
    todayEarnings: 0,
    activeTime: 0,
    callsToday: 0
  });
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Auto-away functionality
  useEffect(() => {
    if (!autoAwayEnabled || status === 'offline') return;

    const interval = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivity;
      const awayThreshold = autoAwayTime * 60 * 1000;

      if (timeSinceActivity > awayThreshold && status === 'online') {
        handleStatusChange('away');
        toast.info(`Set to Away after ${autoAwayTime} minutes of inactivity`);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [autoAwayEnabled, autoAwayTime, lastActivity, status]);

  // Track user activity
  useEffect(() => {
    const handleActivity = () => {
      setLastActivity(Date.now());
      if (status === 'away') {
        handleStatusChange('online');
        // toast.success('Welcome back! Status set to Online');
      }
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [status]);

  // Handle status change
  const handleStatusChange = useCallback(async (newStatus) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          status: newStatus,
          lastSeenAt: new Date().toISOString()
        })
      });

      if (response.ok) {
        setStatus(newStatus);
        onStatusChange?.(newStatus);
        
        const statusConfig = Object.values(AVAILABILITY_STATES).find(s => s.key === newStatus);
        // toast.success(`Status changed to ${statusConfig?.label || newStatus}`);
      } else {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating availability status:', error);
      toast.error('Failed to update status');
    }
  }, [user, onStatusChange]);

  // Fetch creator stats
  const fetchStats = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/creator-stats`, {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching creator stats:', error);
    }
  }, [user]);

  // Fetch stats on mount
  useEffect(() => {
    if (showStats) {
      fetchStats();
      // Refresh stats every 30 seconds
      const interval = setInterval(fetchStats, 30000);
      return () => clearInterval(interval);
    }
  }, [showStats, fetchStats]);

  const currentStatusConfig = Object.values(AVAILABILITY_STATES).find(s => s.key === status) || AVAILABILITY_STATES.OFFLINE;
  const StatusIcon = currentStatusConfig.icon;
  const StatusIconSolid = currentStatusConfig.solidIcon;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`relative flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-${currentStatusConfig.color}-100 text-${currentStatusConfig.color}-800`}>
          <StatusIconSolid className={`w-4 h-4 text-${currentStatusConfig.color}-600`} />
          <span>{currentStatusConfig.label}</span>
          {stats.queueCount > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
              {stats.queueCount} waiting
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Availability Status</h3>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label={showSettings ? 'Hide settings' : 'Show settings'}
          aria-expanded={showSettings}
          onKeyDown={(e) => e.key === 'Enter' && setShowSettings(!showSettings)}
        >
          <CogIcon className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Current Status Display */}
      <div 
        className={`flex items-center gap-3 p-4 rounded-lg bg-${currentStatusConfig.color}-50 border-2 border-${currentStatusConfig.color}-200 mb-6`}
        role="status"
        aria-live="polite"
        aria-label={`Current status: ${currentStatusConfig.label}`}
      >
        <StatusIconSolid className={`w-8 h-8 text-${currentStatusConfig.color}-600`} />
        <div>
          <h4 className={`text-lg font-semibold text-${currentStatusConfig.color}-900`}>
            {currentStatusConfig.label}
          </h4>
          <p className={`text-sm text-${currentStatusConfig.color}-700`}>
            {currentStatusConfig.description}
          </p>
        </div>
      </div>

      {/* Status Options */}
      <div className="grid grid-cols-2 gap-3 mb-6" role="group" aria-label="Availability status options">
        {Object.values(AVAILABILITY_STATES).map((statusOption) => {
          const Icon = statusOption.icon;
          const isActive = status === statusOption.key;
          
          return (
            <motion.button
              key={statusOption.key}
              onClick={() => handleStatusChange(statusOption.key)}
              className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                isActive
                  ? `border-${statusOption.color}-500 bg-${statusOption.color}-50`
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              aria-label={`Set status to ${statusOption.label}`}
              aria-pressed={isActive}
              onKeyDown={(e) => e.key === 'Enter' && handleStatusChange(statusOption.key)}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-5 h-5 ${
                  isActive ? `text-${statusOption.color}-600` : 'text-gray-500'
                }`} />
                <span className={`text-sm font-medium ${
                  isActive ? `text-${statusOption.color}-900` : 'text-gray-700'
                }`}>
                  {statusOption.label}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Stats Display */}
      {showStats && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <UserGroupIcon className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-blue-600 font-medium">Queue</p>
                <p className="text-lg font-bold text-blue-900">{stats.queueCount}</p>
              </div>
            </div>
          </div>
          
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-bold text-lg">$</span>
              <div>
                <p className="text-sm text-green-600 font-medium">Today</p>
                <p className="text-lg font-bold text-green-900">${stats.todayEarnings}</p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-purple-600 font-medium">Online</p>
                <p className="text-lg font-bold text-purple-900">{Math.floor(stats.activeTime / 60)}h</p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-orange-50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-orange-600 font-bold text-lg">#</span>
              <div>
                <p className="text-sm text-orange-600 font-medium">Calls</p>
                <p className="text-lg font-bold text-orange-900">{stats.callsToday}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t pt-4"
          >
            <h4 className="font-semibold text-gray-900 mb-3">Auto-Away Settings</h4>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Enable Auto-Away</label>
                <button
                  onClick={() => setAutoAwayEnabled(!autoAwayEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    autoAwayEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  role="switch"
                  aria-checked={autoAwayEnabled}
                  aria-label="Enable auto-away"
                  onKeyDown={(e) => e.key === 'Enter' && setAutoAwayEnabled(!autoAwayEnabled)}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoAwayEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {autoAwayEnabled && (
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Auto-away after (minutes)
                  </label>
                  <select
                    value={autoAwayTime}
                    onChange={(e) => setAutoAwayTime(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                  </select>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Actions */}
      <div className="flex gap-2 mt-4">
        {status === 'offline' && (
          <button
            onClick={() => handleStatusChange('online')}
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors"
            aria-label="Go online and start accepting calls"
            onKeyDown={(e) => e.key === 'Enter' && handleStatusChange('online')}
          >
            Go Online
          </button>
        )}
        
        {status === 'online' && stats.queueCount > 0 && (
          <button
            onClick={() => handleStatusChange('busy')}
            className="flex-1 bg-yellow-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-yellow-700 transition-colors"
            aria-label="Mark status as busy"
            onKeyDown={(e) => e.key === 'Enter' && handleStatusChange('busy')}
          >
            Mark as Busy
          </button>
        )}

        {status !== 'offline' && (
          <button
            onClick={() => handleStatusChange('offline')}
            className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-700 transition-colors"
            aria-label="Go offline and stop accepting calls"
            onKeyDown={(e) => e.key === 'Enter' && handleStatusChange('offline')}
          >
            Go Offline
          </button>
        )}
      </div>
    </div>
  );
});

CreatorAvailabilitySystem.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string,
    uid: PropTypes.string
  }),
  currentStatus: PropTypes.oneOf(['online', 'busy', 'away', 'dnd', 'offline']),
  onStatusChange: PropTypes.func,
  showStats: PropTypes.bool,
  compact: PropTypes.bool
};

CreatorAvailabilitySystem.defaultProps = {
  currentStatus: 'offline',
  showStats: true,
  compact: false
};

// Status indicator component for use in other parts of the app
export const StatusIndicator = memo(({ status, size = 'sm', showLabel = false }) => {
  const statusConfig = Object.values(AVAILABILITY_STATES).find(s => s.key === status) || AVAILABILITY_STATES.OFFLINE;
  const StatusIcon = statusConfig.solidIcon;

  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <div className="flex items-center gap-2">
      <StatusIcon className={`${sizeClasses[size]} text-${statusConfig.color}-600`} />
      {showLabel && (
        <span className={`text-sm font-medium text-${statusConfig.color}-800`}>
          {statusConfig.label}
        </span>
      )}
    </div>
  );
});

StatusIndicator.propTypes = {
  status: PropTypes.oneOf(['online', 'busy', 'away', 'dnd', 'offline']),
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg']),
  showLabel: PropTypes.bool
};

StatusIndicator.defaultProps = {
  size: 'sm',
  showLabel: false
};

export default CreatorAvailabilitySystem;