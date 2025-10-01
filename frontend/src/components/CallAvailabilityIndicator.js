import React from 'react';
import { motion } from 'framer-motion';
import { 
  PhoneIcon, 
  VideoCameraIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

const CallAvailabilityIndicator = ({ 
  creator, 
  compact = false,
  showDetails = true 
}) => {
  // Mock availability data - in production this would come from the backend
  const availability = {
    isAvailable: creator.isOnline || false,
    nextAvailable: creator.nextAvailable || 'Tomorrow at 2:00 PM',
    preferredHours: creator.preferredHours || '2:00 PM - 6:00 PM EST',
    averageResponseTime: creator.avgResponseTime || '2 hours',
    acceptanceRate: creator.acceptanceRate || 85,
    currentlyInCall: creator.inCall || false
  };

  const getStatusColor = () => {
    if (availability.currentlyInCall) return 'orange';
    if (availability.isAvailable) return 'green';
    return 'gray';
  };

  const getStatusText = () => {
    if (availability.currentlyInCall) return 'In a Call';
    if (availability.isAvailable) return 'Available Now';
    return `Next: ${availability.nextAvailable}`;
  };

  const getStatusIcon = () => {
    if (availability.currentlyInCall) {
      return <PhoneIcon className="w-4 h-4" />;
    }
    if (availability.isAvailable) {
      return <CheckCircleIcon className="w-4 h-4" />;
    }
    return <ClockIcon className="w-4 h-4" />;
  };

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
          availability.currentlyInCall 
            ? 'bg-orange-100 text-orange-700' 
            : availability.isAvailable 
            ? 'bg-green-100 text-green-700' 
            : 'bg-gray-100 text-gray-600'
        }`}
      >
        {getStatusIcon()}
        <span>{getStatusText()}</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Call Availability</h3>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
          availability.currentlyInCall 
            ? 'bg-orange-100 text-orange-700' 
            : availability.isAvailable 
            ? 'bg-green-100 text-green-700' 
            : 'bg-gray-100 text-gray-600'
        }`}>
          {getStatusIcon()}
          <span>{getStatusText()}</span>
        </div>
      </div>

      {showDetails && (
        <>
          {/* Availability Details */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Preferred Hours</span>
              <span className="font-medium text-gray-900">{availability.preferredHours}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Avg Response Time</span>
              <span className="font-medium text-gray-900">{availability.averageResponseTime}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Acceptance Rate</span>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2 w-20">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${availability.acceptanceRate}%` }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="bg-green-500 h-2 rounded-full"
                  />
                </div>
                <span className="font-medium text-gray-900">{availability.acceptanceRate}%</span>
              </div>
            </div>
          </div>

          {/* Tips */}
          {!availability.isAvailable && (
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <ExclamationCircleIcon className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium mb-1">Pro tip:</p>
                  <p>Schedule a call request for {availability.preferredHours} for the best chance of acceptance!</p>
                </div>
              </div>
            </div>
          )}

          {availability.currentlyInCall && (
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <PhoneIcon className="w-5 h-5 text-orange-600 mt-0.5" />
                <div className="text-xs text-orange-800">
                  <p>Currently in a call. You can still send a request for later!</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

export default CallAvailabilityIndicator;