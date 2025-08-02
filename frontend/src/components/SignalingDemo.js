import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChatBubbleLeftRightIcon,
  BoltIcon,
  UserGroupIcon,
  CloudArrowUpIcon,
  LockClosedIcon,
  GlobeAltIcon,
  SignalIcon,
  CheckCircleIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/solid';
import Card from './ui/Card';
import Button from './ui/Button';
import { useAgoraSignaling } from '../hooks/useAgoraSignaling';
import toast from 'react-hot-toast';

const SignalingDemo = ({ user, channel }) => {
  const {
    isConnected,
    presence,
    messages,
    channels,
    streamChannels,
    joinChannel,
    leaveChannel,
    sendMessage,
    joinStreamChannel,
    subscribeTopic,
    publishToTopic,
    updatePresence,
    setMetadata,
    getMetadata,
    acquireLock,
    releaseLock,
    sendStreamEvent,
    broadcastToViewers
  } = useAgoraSignaling();

  const [activeTab, setActiveTab] = useState('overview');
  const [testMessage, setTestMessage] = useState('');
  const [presenceStatus, setPresenceStatus] = useState('online');
  const [storageKey, setStorageKey] = useState('');
  const [storageValue, setStorageValue] = useState('');
  const [currentLock, setCurrentLock] = useState(null);

  useEffect(() => {
    // Auto-join channel if provided
    if (channel && isConnected) {
      joinChannel(channel);
      joinStreamChannel(channel);
    }
  }, [channel, isConnected]);

  const features = [
    {
      icon: ChatBubbleLeftRightIcon,
      title: 'Message Channels',
      description: 'Real-time pub/sub messaging with string or binary payloads',
      example: 'Chat messages, notifications, control signals'
    },
    {
      icon: BoltIcon,
      title: 'Stream Channels',
      description: 'Uninterrupted data flow with topics for organized communication',
      example: 'Live data feeds, continuous updates, event streams'
    },
    {
      icon: UserGroupIcon,
      title: 'Presence',
      description: 'Track user availability and custom status in real-time',
      example: 'Online/offline status, typing indicators, user states'
    },
    {
      icon: CloudArrowUpIcon,
      title: 'Storage',
      description: 'Persist and sync data across clients with metadata',
      example: 'Stream settings, user preferences, shared state'
    },
    {
      icon: LockClosedIcon,
      title: 'Locks',
      description: 'Manage critical resources to prevent conflicts',
      example: 'Exclusive actions, resource protection, turn-based control'
    },
    {
      icon: DocumentTextIcon,
      title: 'Topics',
      description: 'Organize stream channel messages by subject',
      example: 'Chat rooms, event categories, data channels'
    }
  ];

  const sendTestMessage = async () => {
    if (!testMessage.trim()) return;
    
    const success = await sendMessage(channel, testMessage);
    if (success) {
      setTestMessage('');
      // toast.success('Message sent!');
    }
  };

  const sendTestStreamEvent = async (eventType) => {
    const events = {
      tip: { type: 'tip', amount: 100, sender: user?.displayName || 'User' },
      gift: { type: 'gift', giftName: 'Diamond', sender: user?.displayName || 'User' },
      follow: { type: 'follow', sender: user?.displayName || 'User' }
    };

    await sendStreamEvent(channel, events[eventType]);
  };

  const updateTestPresence = async () => {
    await updatePresence(channel, {
      status: presenceStatus,
      activity: presenceStatus === 'streaming' ? 'Live streaming' : 'Available',
      customData: {
        mood: '😊',
        lastActive: Date.now()
      }
    });
    // toast.success(`Presence updated to: ${presenceStatus}`);
  };

  const saveTestMetadata = async () => {
    if (!storageKey || !storageValue) return;
    
    const success = await setMetadata(channel, storageKey, storageValue);
    if (success) {
      // toast.success('Metadata saved!');
      setStorageKey('');
      setStorageValue('');
    }
  };

  const acquireTestLock = async () => {
    const lockName = 'test_resource';
    const success = await acquireLock(channel, lockName, 30);
    
    if (success) {
      setCurrentLock(lockName);
      // toast.success('Lock acquired! You have exclusive access for 30 seconds');
      
      // Auto-release after 25 seconds
      setTimeout(() => {
        releaseLock(channel, lockName);
        setCurrentLock(null);
      }, 25000);
    } else {
      toast.error('Failed to acquire lock - resource is busy');
    }
  };

  const releaseTestLock = async () => {
    if (!currentLock) return;
    
    await releaseLock(channel, currentLock);
    setCurrentLock(null);
    // toast.success('Lock released');
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-12">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full mb-6"
        >
          <SignalIcon className="w-10 h-10 text-white" />
        </motion.div>
        
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Agora Signaling (RTM)
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Low-latency metadata synchronization and real-time event notifications
        </p>
        
        {/* Connection Status */}
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          {isConnected && channels.length > 0 && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              • Channel: {channels[0]}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {['overview', 'demo', 'integration'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-white dark:bg-gray-900 text-purple-600 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature, idx) => (
              <Card key={idx} className="p-6 hover:shadow-lg transition-shadow">
                <feature.icon className="w-10 h-10 text-purple-600 mb-4" />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {feature.description}
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  Example: {feature.example}
                </p>
              </Card>
            ))}
          </motion.div>
        )}

        {activeTab === 'demo' && (
          <motion.div
            key="demo"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Message Channels */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="w-5 h-5 text-purple-600" />
                Message Channels
              </h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendTestMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
                <Button onClick={sendTestMessage} disabled={!isConnected}>
                  Send
                </Button>
              </div>
              
              {/* Recent Messages */}
              {messages.length > 0 && (
                <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                  {messages.slice(-5).map((msg, idx) => (
                    <div key={idx} className="text-sm bg-gray-100 dark:bg-gray-800 rounded px-3 py-2">
                      <span className="font-medium">{msg.senderId}:</span> {msg.message}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Stream Events */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BoltIcon className="w-5 h-5 text-purple-600" />
                Stream Events
              </h3>
              <div className="flex gap-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => sendTestStreamEvent('tip')}
                  disabled={!isConnected}
                >
                  Send Tip Event
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => sendTestStreamEvent('gift')}
                  disabled={!isConnected}
                >
                  Send Gift Event
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => sendTestStreamEvent('follow')}
                  disabled={!isConnected}
                >
                  Send Follow Event
                </Button>
              </div>
            </Card>

            {/* Presence */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <UserGroupIcon className="w-5 h-5 text-purple-600" />
                Presence Management
              </h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  {['online', 'away', 'busy', 'streaming'].map(status => (
                    <button
                      key={status}
                      onClick={() => setPresenceStatus(status)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        presenceStatus === status
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
                <Button onClick={updateTestPresence} disabled={!isConnected}>
                  Update Presence
                </Button>
              </div>
              
              {/* Online Users */}
              {presence.size > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Online Users ({presence.size})
                  </p>
                  <div className="flex gap-2">
                    {Array.from(presence.entries()).map(([userId, data]) => (
                      <div key={userId} className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className="text-xs font-medium text-green-700 dark:text-green-400">
                          {userId}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Storage */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <CloudArrowUpIcon className="w-5 h-5 text-purple-600" />
                Metadata Storage
              </h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={storageKey}
                  onChange={(e) => setStorageKey(e.target.value)}
                  placeholder="Key..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                />
                <input
                  type="text"
                  value={storageValue}
                  onChange={(e) => setStorageValue(e.target.value)}
                  placeholder="Value..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                />
                <Button onClick={saveTestMetadata} disabled={!isConnected || !storageKey || !storageValue}>
                  Save Metadata
                </Button>
              </div>
            </Card>

            {/* Locks */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <LockClosedIcon className="w-5 h-5 text-purple-600" />
                Resource Locks
              </h3>
              <div className="space-y-3">
                {currentLock ? (
                  <>
                    <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
                      <p className="text-sm text-green-700 dark:text-green-400">
                        Lock acquired: {currentLock}
                      </p>
                    </div>
                    <Button onClick={releaseTestLock} variant="secondary">
                      Release Lock
                    </Button>
                  </>
                ) : (
                  <Button onClick={acquireTestLock} disabled={!isConnected}>
                    Acquire Test Lock
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {activeTab === 'integration' && (
          <motion.div
            key="integration"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <Card className="p-8">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                Integration Benefits
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                    Enhanced Features
                  </h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Real-time presence indicators for all users
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Synchronized stream metadata across viewers
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Low-latency event notifications
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Persistent storage for stream settings
                      </span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                    Performance Metrics
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Message Latency</span>
                      <span className="text-sm font-medium text-purple-600">&lt; 100ms</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Concurrent Users</span>
                      <span className="text-sm font-medium text-purple-600">1M+</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Global Coverage</span>
                      <span className="text-sm font-medium text-purple-600">200+ regions</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Uptime SLA</span>
                      <span className="text-sm font-medium text-purple-600">99.95%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <p className="text-sm text-purple-700 dark:text-purple-400">
                  <strong>Note:</strong> Agora Signaling is now integrated into your Digis platform. 
                  It works alongside Socket.io to provide enhanced real-time capabilities with 
                  ultra-low latency and global scalability.
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SignalingDemo;