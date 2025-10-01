import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BellIcon,
  UserGroupIcon,
  MegaphoneIcon,
  ArrowRightIcon,
  VideoCameraIcon,
  ClockIcon,
  FireIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const StreamCreatorTools = ({ isCreator, streamId, onStreamAction }) => {
  const [showStreamAlerts, setShowStreamAlerts] = useState(true);
  const [showPreStreamLobby, setShowPreStreamLobby] = useState(false);
  const [raidTarget, setRaidTarget] = useState('');
  const [coStreamInvites, setCoStreamInvites] = useState([]);
  const [instantReplayEnabled, setInstantReplayEnabled] = useState(true);

  // Stream alerts configuration
  const streamAlerts = [
    {
      id: 1,
      type: 'new_follower',
      message: 'JohnDoe123 just followed!',
      icon: UserGroupIcon,
      color: 'purple',
      timestamp: new Date()
    },
    {
      id: 2,
      type: 'donation',
      message: 'Sarah sent 100 tokens!',
      icon: FireIcon,
      color: 'green',
      timestamp: new Date()
    },
    {
      id: 3,
      type: 'milestone',
      message: 'You reached 1000 viewers!',
      icon: TrophyIcon,
      color: 'yellow',
      timestamp: new Date()
    }
  ];

  const handleStartRaid = () => {
    if (!raidTarget) {
      toast.error('Please enter a creator name to raid');
      return;
    }
    
    // toast.success(`Starting raid to ${raidTarget}'s stream!`);
    if (onStreamAction) {
      onStreamAction('raid', { target: raidTarget });
    }
    setRaidTarget('');
  };

  const handleInviteCoStreamer = (creatorName) => {
    if (coStreamInvites.includes(creatorName)) {
      toast.info('Already invited');
      return;
    }
    
    setCoStreamInvites([...coStreamInvites, creatorName]);
    // toast.success(`Co-stream invite sent to ${creatorName}`);
    
    if (onStreamAction) {
      onStreamAction('co-stream-invite', { creator: creatorName });
    }
  };

  const handleInstantReplay = () => {
    // toast.success('Instant replay captured!');
    if (onStreamAction) {
      onStreamAction('instant-replay');
    }
  };

  if (!isCreator) return null;

  return (
    <div className="space-y-6">
      {/* Stream Alerts */}
      <div className="bg-gray-900/90 backdrop-blur rounded-xl border border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <BellIcon className="w-5 h-5 text-purple-600" />
            Stream Alerts
          </h3>
          <button
            onClick={() => setShowStreamAlerts(!showStreamAlerts)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {showStreamAlerts ? 'Hide' : 'Show'}
          </button>
        </div>
        
        {showStreamAlerts && (
          <div className="space-y-2">
            {streamAlerts.map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className={`flex items-center gap-3 p-3 rounded-lg bg-${alert.color}-50`}
              >
                <alert.icon className={`w-5 h-5 text-${alert.color}-600`} />
                <p className="text-sm font-medium text-white">{alert.message}</p>
                <span className="text-xs text-gray-500 ml-auto">Just now</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Pre-Stream Lobby */}
      <div className="bg-gray-900/90 backdrop-blur rounded-xl border border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <ChatBubbleLeftRightIcon className="w-5 h-5 text-purple-600" />
            Pre-Stream Lobby
          </h3>
          <button
            onClick={() => setShowPreStreamLobby(!showPreStreamLobby)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              showPreStreamLobby 
                ? 'bg-purple-100 text-purple-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {showPreStreamLobby ? 'Active' : 'Enable'}
          </button>
        </div>
        
        {showPreStreamLobby && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Chat is open! 45 viewers waiting
            </p>
            <button
              onClick={() => {
                // toast.success('Stream started!');
                setShowPreStreamLobby(false);
              }}
              className="w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Start Stream Now
            </button>
          </div>
        )}
      </div>

      {/* Stream Raid */}
      <div className="bg-gray-900/90 backdrop-blur rounded-xl border border-gray-700 p-4">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <MegaphoneIcon className="w-5 h-5 text-purple-600" />
          Stream Raid
        </h3>
        
        <div className="flex gap-2">
          <input
            type="text"
            value={raidTarget}
            onChange={(e) => setRaidTarget(e.target.value)}
            placeholder="Creator name to raid..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button
            onClick={handleStartRaid}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <ArrowRightIcon className="w-4 h-4" />
            Raid
          </button>
        </div>
      </div>

      {/* Co-Streaming */}
      <div className="bg-gray-900/90 backdrop-blur rounded-xl border border-gray-700 p-4">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <UserGroupIcon className="w-5 h-5 text-purple-600" />
          Co-Streaming
        </h3>
        
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Invite creator to co-stream..."
              onKeyPress={(e) => {
                if (e.key === 'Enter' && e.target.value) {
                  handleInviteCoStreamer(e.target.value);
                  e.target.value = '';
                }
              }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          {coStreamInvites.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Pending invites:</p>
              {coStreamInvites.map((creator) => (
                <div key={creator} className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-300">{creator}</span>
                  <span className="text-xs text-gray-500">Pending</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Instant Replay */}
      <div className="bg-gray-900/90 backdrop-blur rounded-xl border border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              <VideoCameraIcon className="w-5 h-5 text-purple-600" />
              Instant Replay
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Capture the last 30 seconds
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setInstantReplayEnabled(!instantReplayEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                instantReplayEnabled ? 'bg-purple-600' : 'bg-gray-300'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                instantReplayEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
            <button
              onClick={handleInstantReplay}
              disabled={!instantReplayEnabled}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Capture
            </button>
          </div>
        </div>
      </div>

      {/* Stream Stats */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-4 text-white">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5" />
          Live Stats
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-purple-100 text-sm">Viewers</p>
            <p className="text-2xl font-bold">1,234</p>
          </div>
          <div>
            <p className="text-purple-100 text-sm">Duration</p>
            <p className="text-2xl font-bold">2:45:30</p>
          </div>
          <div>
            <p className="text-purple-100 text-sm">Tokens Earned</p>
            <p className="text-2xl font-bold">4,567</p>
          </div>
          <div>
            <p className="text-purple-100 text-sm">New Followers</p>
            <p className="text-2xl font-bold">123</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamCreatorTools;