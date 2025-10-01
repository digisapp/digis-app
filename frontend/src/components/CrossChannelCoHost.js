import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LinkIcon,
  UserGroupIcon,
  VideoCameraIcon,
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  SignalIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import Card from './ui/Card';
import Button from './ui/Button';
import toast from 'react-hot-toast';

const CrossChannelCoHost = ({
  currentChannel,
  currentUser,
  agoraClient,
  onCoHostConnected,
  onCoHostDisconnected,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('invite'); // 'invite', 'join', 'active'
  const [targetChannel, setTargetChannel] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [connectedChannels, setConnectedChannels] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [channelStats, setChannelStats] = useState({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [crossChannelClient, setCrossChannelClient] = useState(null);

  // Generate unique invite code
  const generateInviteCode = useCallback(() => {
    const code = `${currentChannel}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`.toUpperCase();
    setInviteCode(code);
    
    // Store invite in backend (placeholder)
    storeCrossChannelInvite(code);
    
    return code;
  }, [currentChannel]);

  // Store invite for other channels to discover
  const storeCrossChannelInvite = async (code) => {
    try {
      // This would call your backend API
      console.log('Storing cross-channel invite:', code);
      
      // Simulate API call
      setTimeout(() => {
        // toast.success('Invite code generated and ready to share!');
      }, 500);
    } catch (error) {
      console.error('Failed to store invite:', error);
    }
  };

  // Connect to another channel
  const connectToChannel = async (channelName, inviteCode) => {
    if (connectedChannels.length >= 3) {
      toast.error('Maximum 4 channels can be connected');
      return;
    }

    setIsConnecting(true);
    
    try {
      // Validate invite code (would check with backend)
      console.log('Validating invite code:', inviteCode);
      
      // Create cross-channel connection using Agora's channel media relay
      const channelMediaRelayConfiguration = {
        srcInfo: {
          channelName: currentChannel,
          uid: currentUser.uid,
          token: null // Would use actual token
        },
        destInfos: [
          {
            channelName: channelName,
            uid: currentUser.uid + 1000, // Different UID for relay
            token: null // Would use actual token
          }
        ]
      };
      
      // Start channel media relay
      await agoraClient.startChannelMediaRelay(channelMediaRelayConfiguration);
      
      // Add to connected channels
      const newChannel = {
        name: channelName,
        connectedAt: Date.now(),
        viewerCount: Math.floor(Math.random() * 500) + 100,
        hostName: `Host_${channelName}`,
        status: 'connected',
        latency: Math.floor(Math.random() * 50) + 10
      };
      
      setConnectedChannels(prev => [...prev, newChannel]);
      setMode('active');
      
      // Track channel stats
      startChannelStatsTracking(channelName);
      
      // toast.success(`Connected to ${channelName}! 🎉`, {
        duration: 4000,
        icon: '🔗'
      });
      
      if (onCoHostConnected) {
        onCoHostConnected(newChannel);
      }
      
    } catch (error) {
      console.error('Failed to connect to channel:', error);
      toast.error('Failed to connect. Please check the invite code.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from a channel
  const disconnectFromChannel = async (channelName) => {
    try {
      // Update channel media relay to remove this destination
      const remainingChannels = connectedChannels.filter(ch => ch.name !== channelName);
      
      if (remainingChannels.length === 0) {
        // Stop all relays if no channels left
        await agoraClient.stopChannelMediaRelay();
      } else {
        // Update relay configuration
        const updatedConfig = {
          srcInfo: {
            channelName: currentChannel,
            uid: currentUser.uid,
            token: null
          },
          destInfos: remainingChannels.map(ch => ({
            channelName: ch.name,
            uid: currentUser.uid + 1000,
            token: null
          }))
        };
        
        await agoraClient.updateChannelMediaRelay(updatedConfig);
      }
      
      setConnectedChannels(remainingChannels);
      
      // toast.success(`Disconnected from ${channelName}`);
      
      if (onCoHostDisconnected) {
        onCoHostDisconnected(channelName);
      }
      
      if (remainingChannels.length === 0) {
        setMode('invite');
      }
      
    } catch (error) {
      console.error('Failed to disconnect from channel:', error);
      toast.error('Failed to disconnect properly');
    }
  };

  // Start tracking channel statistics
  const startChannelStatsTracking = (channelName) => {
    const interval = setInterval(() => {
      // Simulate stats updates
      setChannelStats(prev => ({
        ...prev,
        [channelName]: {
          latency: Math.floor(Math.random() * 50) + 10,
          quality: Math.random() > 0.8 ? 'excellent' : 'good',
          packetLoss: Math.random() * 2,
          bitrate: Math.floor(Math.random() * 2000) + 3000
        }
      }));
    }, 2000);
    
    // Store interval for cleanup
    return interval;
  };

  // Competition mode features
  const startCompetition = () => {
    if (connectedChannels.length < 1) {
      toast.error('Connect at least one channel to start a competition');
      return;
    }
    
    toast.custom((t) => (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-xl shadow-2xl max-w-md"
      >
        <div className="flex items-center gap-3">
          <SparklesIcon className="w-8 h-8" />
          <div>
            <p className="font-bold text-lg">Competition Mode Activated!</p>
            <p className="text-sm opacity-90">
              All {connectedChannels.length + 1} channels are now competing
            </p>
            <div className="flex gap-2 mt-2">
              {[currentChannel, ...connectedChannels.map(ch => ch.name)].map((name, idx) => (
                <span key={idx} className="bg-white/20 px-2 py-1 rounded text-xs">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    ), { duration: 6000 });
  };

  return (
    <>
      {/* Trigger Button */}
      <Button
        variant="secondary"
        size="sm"
        icon={<LinkIcon className="w-4 h-4" />}
        onClick={() => setIsOpen(true)}
        className={className}
      >
        Cross-Channel
      </Button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <ArrowsRightLeftIcon className="w-8 h-8" />
                      Cross-Channel Co-Hosting
                    </h2>
                    <p className="text-purple-100 mt-1">
                      Connect with up to 4 channels simultaneously
                    </p>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {mode === 'invite' && connectedChannels.length === 0 && (
                  <div className="space-y-6">
                    {/* Create Invite */}
                    <Card className="p-6">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                        Invite Other Channels
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Generate an invite code for other channels to join your stream
                      </p>
                      
                      {inviteCode ? (
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            Share this code with other hosts:
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-white dark:bg-gray-900 px-4 py-2 rounded border border-gray-300 dark:border-gray-700 font-mono text-sm">
                              {inviteCode}
                            </code>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                navigator.clipboard.writeText(inviteCode);
                                // toast.success('Copied to clipboard!');
                              }}
                            >
                              Copy
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Valid for 30 minutes
                          </p>
                        </div>
                      ) : (
                        <Button
                          variant="primary"
                          onClick={generateInviteCode}
                          icon={<UserGroupIcon className="w-5 h-5" />}
                        >
                          Generate Invite Code
                        </Button>
                      )}
                    </Card>

                    {/* Join Channel */}
                    <Card className="p-6">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                        Join Another Channel
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Enter an invite code to connect with another channel
                      </p>
                      
                      <div className="space-y-4">
                        <input
                          type="text"
                          placeholder="Enter channel name..."
                          value={targetChannel}
                          onChange={(e) => setTargetChannel(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <input
                          type="text"
                          placeholder="Enter invite code..."
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <Button
                          variant="primary"
                          fullWidth
                          disabled={!targetChannel || isConnecting}
                          onClick={() => connectToChannel(targetChannel, 'dummy-code')}
                          icon={<LinkIcon className="w-5 h-5" />}
                        >
                          {isConnecting ? 'Connecting...' : 'Connect to Channel'}
                        </Button>
                      </div>
                    </Card>
                  </div>
                )}

                {(mode === 'active' || connectedChannels.length > 0) && (
                  <div className="space-y-6">
                    {/* Connected Channels */}
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                        Connected Channels ({connectedChannels.length}/3)
                      </h3>
                      
                      <div className="space-y-3">
                        {/* Current Channel */}
                        <Card className="p-4 border-2 border-purple-500">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                                <VideoCameraIcon className="w-6 h-6 text-white" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {currentChannel} (You)
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  Host Channel
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <SignalIcon className="w-4 h-4 text-green-500" />
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                Live
                              </span>
                            </div>
                          </div>
                        </Card>

                        {/* Connected Channels */}
                        {connectedChannels.map((channel) => (
                          <Card key={channel.name} className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-pink-600 rounded-full flex items-center justify-center">
                                  <UserGroupIcon className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {channel.name}
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {channel.hostName} • {channel.viewerCount} viewers
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-xs text-gray-500">
                                    {channel.latency}ms
                                  </p>
                                  <p className="text-xs text-green-500">
                                    {channelStats[channel.name]?.quality || 'good'}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => disconnectFromChannel(channel.name)}
                                >
                                  Disconnect
                                </Button>
                              </div>
                            </div>
                            
                            {/* Channel Stats */}
                            {channelStats[channel.name] && (
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <p className="text-gray-500">Bitrate</p>
                                  <p className="font-medium">{channelStats[channel.name].bitrate} kbps</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Packet Loss</p>
                                  <p className="font-medium">{channelStats[channel.name].packetLoss.toFixed(1)}%</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Connected</p>
                                  <p className="font-medium">
                                    {Math.floor((Date.now() - channel.connectedAt) / 60000)}m ago
                                  </p>
                                </div>
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      {connectedChannels.length < 3 && (
                        <Button
                          variant="secondary"
                          onClick={() => setMode('invite')}
                          icon={<UserGroupIcon className="w-5 h-5" />}
                        >
                          Add Channel
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        onClick={startCompetition}
                        icon={<SparklesIcon className="w-5 h-5" />}
                      >
                        Start Competition
                      </Button>
                    </div>

                    {/* Features Info */}
                    <Card className="p-4 bg-purple-50 dark:bg-purple-900/20">
                      <h4 className="font-medium text-purple-900 dark:text-purple-300 mb-2">
                        Cross-Channel Features
                      </h4>
                      <ul className="space-y-1 text-sm text-purple-700 dark:text-purple-400">
                        <li>• Viewers can see all connected channels</li>
                        <li>• Shared audio and video between channels</li>
                        <li>• Competition mode with live scoring</li>
                        <li>• Synchronized events and interactions</li>
                      </ul>
                    </Card>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CrossChannelCoHost;