import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDefaultAvatarUrl } from '../../utils/avatarHelpers';
import {
  PhoneIcon,
  VideoCameraIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  CalendarIcon,
  UserIcon,
  CurrencyDollarIcon,
  ChevronRightIcon,
  PhoneArrowDownLeftIcon,
  PhoneArrowUpRightIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';

const MobileCalls = ({ user, onNavigate, onStartCall }) => {
  const [activeTab, setActiveTab] = useState('incoming');
  const [selectedCall, setSelectedCall] = useState(null);

  // Mock data
  const incomingCalls = [
    {
      id: 1,
      fanName: 'Sarah Mitchell',
      fanAvatar: getDefaultAvatarUrl('Sarah Mitchell', 50),
      type: 'video',
      status: 'ringing',
      time: 'Now',
      tokens: 100,
      duration: null
    },
    {
      id: 2,
      fanName: 'Mike Johnson',
      fanAvatar: getDefaultAvatarUrl('Mike Johnson', 50),
      type: 'voice',
      status: 'pending',
      time: 'Today, 3:00 PM',
      tokens: 75,
      duration: 15
    }
  ];

  const scheduledCalls = [
    {
      id: 3,
      fanName: 'Emma Wilson',
      fanAvatar: getDefaultAvatarUrl('Emma Wilson', 50),
      type: 'video',
      status: 'scheduled',
      time: 'Tomorrow, 2:00 PM',
      tokens: 150,
      duration: 30
    },
    {
      id: 4,
      fanName: 'James Davis',
      fanAvatar: getDefaultAvatarUrl('James Davis', 50),
      type: 'video',
      status: 'scheduled',
      time: 'Dec 30, 4:00 PM',
      tokens: 200,
      duration: 45
    }
  ];

  const callHistory = [
    {
      id: 5,
      fanName: 'Lisa Brown',
      fanAvatar: getDefaultAvatarUrl('Lisa Brown', 50),
      type: 'video',
      status: 'completed',
      time: 'Yesterday, 5:30 PM',
      tokens: 120,
      duration: 24,
      rating: 5
    },
    {
      id: 6,
      fanName: 'Tom Wilson',
      fanAvatar: getDefaultAvatarUrl('Tom Wilson', 50),
      type: 'voice',
      status: 'missed',
      time: '2 days ago',
      tokens: 80,
      duration: 0
    }
  ];

  const tabs = [
    { id: 'incoming', label: 'Incoming', count: incomingCalls.length },
    { id: 'scheduled', label: 'Scheduled', count: scheduledCalls.length },
    { id: 'history', label: 'History' }
  ];

  const getCallsList = () => {
    switch (activeTab) {
      case 'incoming':
        return incomingCalls;
      case 'scheduled':
        return scheduledCalls;
      case 'history':
        return callHistory;
      default:
        return [];
    }
  };

  const handleAcceptCall = (call) => {
    console.log('Accepting call:', call);
    onStartCall?.(call);
  };

  const handleDeclineCall = (call) => {
    console.log('Declining call:', call);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ringing':
        return (
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold animate-pulse">
            Ringing
          </span>
        );
      case 'pending':
        return (
          <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-semibold">
            Pending
          </span>
        );
      case 'scheduled':
        return (
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-semibold">
            Scheduled
          </span>
        );
      case 'completed':
        return (
          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold">
            Completed
          </span>
        );
      case 'missed':
        return (
          <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-semibold">
            Missed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 ">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white pb-6" style={{ paddingTop: 'env(safe-area-inset-top, 20px)' }}>
        <div className="px-4 pt-4">
          <h1 className="text-2xl font-bold mb-4">Call Management</h1>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center">
              <PhoneArrowDownLeftIcon className="w-6 h-6 mx-auto mb-1" />
              <p className="text-2xl font-bold">12</p>
              <p className="text-xs text-white/80">Today</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center">
              <ClockIcon className="w-6 h-6 mx-auto mb-1" />
              <p className="text-2xl font-bold">5</p>
              <p className="text-xs text-white/80">Scheduled</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center">
              <CurrencyDollarIcon className="w-6 h-6 mx-auto mb-1" />
              <p className="text-2xl font-bold">850</p>
              <p className="text-xs text-white/80">Tokens Today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 -mt-3">
        <div className="bg-white rounded-xl shadow-sm p-1 flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1 text-xs ${
                  activeTab === tab.id ? 'text-white/80' : 'text-gray-400'
                }`}>
                  ({tab.count})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Calls List */}
      <div className="px-4 mt-4">
        <div className="space-y-3">
          {getCallsList().map((call) => (
            <motion.div
              key={call.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-xl shadow-sm overflow-hidden ${
                call.status === 'ringing' ? 'ring-animation' : ''
              }`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <img
                        src={call.fanAvatar}
                        alt={call.fanName}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      {call.status === 'ringing' && (
                        <div className="absolute inset-0 rounded-full border-2 border-green-500 animate-ping" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{call.fanName}</p>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        {call.type === 'video' ? (
                          <VideoCameraIcon className="w-4 h-4" />
                        ) : (
                          <PhoneIcon className="w-4 h-4" />
                        )}
                        <span>{call.type === 'video' ? 'Video Call' : 'Voice Call'}</span>
                        {call.duration && (
                          <>
                            <span>•</span>
                            <span>{call.duration} min</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(call.status)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <ClockIcon className="w-4 h-4" />
                      <span>{call.time}</span>
                    </div>
                    <div className="flex items-center space-x-1 font-semibold text-purple-600">
                      <span>{call.tokens} tokens</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {call.status === 'ringing' && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleAcceptCall(call)}
                        className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold active:scale-95"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDeclineCall(call)}
                        className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold active:scale-95"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {call.status === 'pending' && (
                    <button
                      onClick={() => setSelectedCall(call)}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold active:scale-95"
                    >
                      View Details
                    </button>
                  )}
                  {call.status === 'scheduled' && (
                    <button
                      onClick={() => setSelectedCall(call)}
                      className="text-blue-600 font-semibold text-sm"
                    >
                      Reschedule
                    </button>
                  )}
                  {call.status === 'completed' && call.rating && (
                    <div className="flex items-center space-x-1">
                      {[...Array(5)].map((_, i) => (
                        <StarIcon
                          key={i}
                          className={`w-4 h-4 ${
                            i < call.rating ? 'text-yellow-500' : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Stats for Completed Calls */}
              {call.status === 'completed' && (
                <div className="bg-gray-50 px-4 py-2 border-t border-gray-100">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Duration: {call.duration} minutes</span>
                    <span className="font-semibold text-green-600">+{call.tokens} tokens earned</span>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {getCallsList().length === 0 && (
          <div className="text-center py-12">
            <PhoneIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No calls in this category</p>
            <p className="text-gray-400 text-sm mt-1">Your call requests will appear here</p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes ring {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.02);
          }
        }
        .ring-animation {
          animation: ring 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default MobileCalls;