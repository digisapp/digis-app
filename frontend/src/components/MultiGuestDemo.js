import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  UserGroupIcon,
  SparklesIcon,
  VideoCameraIcon,
  MicrophoneIcon,
  UserPlusIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import Card from './ui/Card';
import Button from './ui/Button';
import toast from 'react-hot-toast';

const MultiGuestDemo = () => {
  const [showDemo, setShowDemo] = useState(false);
  const [guestCount, setGuestCount] = useState(4);

  const features = [
    {
      icon: UserGroupIcon,
      title: 'Up to 9 Participants',
      description: 'Host live streams with multiple guests simultaneously'
    },
    {
      icon: VideoCameraIcon,
      title: 'Grid & Speaker Views',
      description: 'Multiple layout options for the best viewing experience'
    },
    {
      icon: UserPlusIcon,
      title: 'Join Request Management',
      description: 'Control who joins your stream with easy approve/deny'
    },
    {
      icon: MicrophoneIcon,
      title: 'Host Controls',
      description: 'Mute or remove participants with one click'
    }
  ];

  const demoGuests = [
    { id: 1, name: 'Sarah J.', avatar: '👩‍🎤', role: 'Co-Host' },
    { id: 2, name: 'Mike D.', avatar: '🧑‍💻', role: 'Guest' },
    { id: 3, name: 'Emma L.', avatar: '👩‍🎨', role: 'Guest' },
    { id: 4, name: 'Alex R.', avatar: '🧑‍🚀', role: 'Guest' },
    { id: 5, name: 'Lisa K.', avatar: '👩‍🔬', role: 'Guest' },
    { id: 6, name: 'Tom B.', avatar: '🧑‍🎓', role: 'Guest' },
    { id: 7, name: 'Nina S.', avatar: '👩‍💼', role: 'Guest' },
    { id: 8, name: 'Chris P.', avatar: '🧑‍🍳', role: 'Guest' }
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-12">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full mb-6"
        >
          <UserGroupIcon className="w-10 h-10 text-white" />
        </motion.div>
        
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Multi-Guest Video Streaming
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Collaborate with up to 9 participants in your live streams. Perfect for interviews, panels, and group discussions.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {features.map((feature, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="h-full p-6 hover:shadow-lg transition-shadow">
              <feature.icon className="w-10 h-10 text-purple-600 mb-4" />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {feature.description}
              </p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Demo Section */}
      <Card className="p-8 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-800 dark:to-gray-900">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            See It In Action
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Experience how multi-guest streaming works
          </p>
          
          {/* Guest Count Selector */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Number of Guests:
            </span>
            <div className="flex gap-2">
              {[1, 4, 6, 9].map(count => (
                <button
                  key={count}
                  onClick={() => setGuestCount(count)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    guestCount === count
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Video Grid Preview */}
          <div className="max-w-4xl mx-auto mb-8">
            <div className={`grid gap-4 ${
              guestCount === 1 ? 'grid-cols-1' :
              guestCount <= 4 ? 'grid-cols-2' :
              guestCount <= 6 ? 'grid-cols-3' :
              'grid-cols-3'
            }`}>
              {/* Host */}
              <motion.div
                layout
                className={`bg-gray-900 rounded-lg aspect-video flex items-center justify-center relative overflow-hidden ${
                  guestCount === 1 ? 'col-span-1' : ''
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-pink-600/20" />
                <div className="text-center z-10">
                  <div className="text-4xl mb-2">🎤</div>
                  <p className="text-white font-semibold">You (Host)</p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <VideoCameraIcon className="w-4 h-4 text-green-400" />
                    <MicrophoneIcon className="w-4 h-4 text-green-400" />
                  </div>
                </div>
              </motion.div>

              {/* Guests */}
              {demoGuests.slice(0, guestCount - 1).map((guest, index) => (
                <motion.div
                  key={guest.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-gray-800 rounded-lg aspect-video flex items-center justify-center relative overflow-hidden"
                >
                  <div className="text-center">
                    <div className="text-3xl mb-2">{guest.avatar}</div>
                    <p className="text-white text-sm font-medium">{guest.name}</p>
                    <p className="text-purple-400 text-xs">{guest.role}</p>
                  </div>
                  {index % 3 === 0 && (
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full"
                    />
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <Button
            size="lg"
            variant="primary"
            icon={<SparklesIcon className="w-5 h-5" />}
            onClick={() => {
              setShowDemo(true);
              toast.custom((t) => (
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-xl shadow-2xl"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircleIcon className="w-8 h-8" />
                    <div>
                      <p className="font-bold">Multi-Guest Mode Activated!</p>
                      <p className="text-sm opacity-90">
                        You can now invite up to 9 participants to your stream
                      </p>
                    </div>
                  </div>
                </motion.div>
              ), { duration: 5000 });
            }}
          >
            Enable Multi-Guest Mode
          </Button>
        </div>

        {/* Instructions */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            How to Use Multi-Guest Streaming:
          </h3>
          <ol className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                1
              </span>
              <span>Click the "Multi-Guest" button in your stream controls</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                2
              </span>
              <span>Share your stream link with guests or accept join requests</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                3
              </span>
              <span>Manage participants with host controls (mute/remove)</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                4
              </span>
              <span>Switch between grid, speaker, and sidebar layouts</span>
            </li>
          </ol>
        </div>
      </Card>
    </div>
  );
};

export default MultiGuestDemo;