import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChartBarIcon,
  BoltIcon,
  SparklesIcon,
  MegaphoneIcon,
  HandRaisedIcon,
  QuestionMarkCircleIcon,
  XMarkIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { FireIcon } from '@heroicons/react/24/solid';
import Button from './ui/Button';

const QuickActionsPanel = ({
  onPollCreate,
  onHypeTrain,
  onSpotlight,
  className = ''
}) => {
  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState('poll');
  const [pollData, setPollData] = useState({
    question: '',
    options: ['', ''],
    duration: 60
  });
  const [hypeTrainData, setHypeTrainData] = useState({
    goal: 100,
    duration: 300,
    rewards: ''
  });
  const [spotlightUser, setSpotlightUser] = useState('');
  const [announcement, setAnnouncement] = useState('');

  const handleCreatePoll = () => {
    if (pollData.question && pollData.options.filter(o => o).length >= 2) {
      onPollCreate({
        id: Date.now(),
        question: pollData.question,
        options: pollData.options.filter(o => o),
        duration: pollData.duration,
        votes: {},
        startTime: Date.now()
      });
      setPollData({ question: '', options: ['', ''], duration: 60 });
      setShowPanel(false);
    }
  };

  const handleStartHypeTrain = () => {
    if (hypeTrainData.goal > 0) {
      onHypeTrain({
        id: Date.now(),
        goal: hypeTrainData.goal,
        current: 0,
        duration: hypeTrainData.duration,
        rewards: hypeTrainData.rewards,
        contributors: [],
        startTime: Date.now()
      });
      setHypeTrainData({ goal: 100, duration: 300, rewards: '' });
      setShowPanel(false);
    }
  };

  const handleSpotlight = () => {
    if (spotlightUser) {
      onSpotlight(spotlightUser);
      setSpotlightUser('');
      setShowPanel(false);
    }
  };

  const quickActions = [
    { id: 'poll', label: 'Poll', icon: ChartBarIcon, color: 'bg-blue-600' },
    { id: 'hype', label: 'Hype Train', icon: BoltIcon, color: 'bg-purple-600' },
    { id: 'spotlight', label: 'Spotlight', icon: SparklesIcon, color: 'bg-yellow-600' },
    { id: 'announce', label: 'Announce', icon: MegaphoneIcon, color: 'bg-green-600' }
  ];

  return (
    <>
      {/* Quick Actions Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowPanel(!showPanel)}
        className={`p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-lg flex items-center gap-2 ${className}`}
      >
        <FireIcon className="w-5 h-5" />
        <span className="hidden lg:inline font-medium">Quick Actions</span>
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-full mb-2 left-0 bg-gray-800 rounded-lg shadow-2xl p-4 w-96 border border-gray-700"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
              <button
                onClick={() => setShowPanel(false)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              {quickActions.map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => setActiveTab(action.id)}
                    className={`flex-1 p-2 rounded-lg flex flex-col items-center gap-1 transition-all ${
                      activeTab === action.id
                        ? `${action.color} text-white`
                        : 'bg-gray-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{action.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="space-y-3">
              {/* Poll Creator */}
              {activeTab === 'poll' && (
                <>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Question</label>
                    <input
                      type="text"
                      value={pollData.question}
                      onChange={(e) => setPollData({ ...pollData, question: e.target.value })}
                      placeholder="What should we play next?"
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Options</label>
                    {pollData.options.map((option, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...pollData.options];
                            newOptions[index] = e.target.value;
                            setPollData({ ...pollData, options: newOptions });
                          }}
                          placeholder={`Option ${index + 1}`}
                          className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {index > 1 && (
                          <button
                            onClick={() => {
                              const newOptions = pollData.options.filter((_, i) => i !== index);
                              setPollData({ ...pollData, options: newOptions });
                            }}
                            className="p-2 text-red-400 hover:bg-gray-700 rounded-lg"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {pollData.options.length < 5 && (
                      <button
                        onClick={() => setPollData({ ...pollData, options: [...pollData.options, ''] })}
                        className="text-sm text-blue-400 hover:text-blue-300"
                      >
                        + Add Option
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Duration</label>
                    <select
                      value={pollData.duration}
                      onChange={(e) => setPollData({ ...pollData, duration: parseInt(e.target.value) })}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={30}>30 seconds</option>
                      <option value={60}>1 minute</option>
                      <option value={120}>2 minutes</option>
                      <option value={300}>5 minutes</option>
                    </select>
                  </div>

                  <Button
                    onClick={handleCreatePoll}
                    variant="primary"
                    fullWidth
                    disabled={!pollData.question || pollData.options.filter(o => o).length < 2}
                  >
                    Create Poll
                  </Button>
                </>
              )}

              {/* Hype Train */}
              {activeTab === 'hype' && (
                <>
                  <div className="bg-purple-600/20 rounded-lg p-3 mb-3">
                    <p className="text-sm text-purple-300">
                      Start a hype train to encourage viewers to contribute with tips, gifts, and subscriptions!
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Goal (tokens)</label>
                    <input
                      type="number"
                      value={hypeTrainData.goal}
                      onChange={(e) => setHypeTrainData({ ...hypeTrainData, goal: parseInt(e.target.value) })}
                      min={10}
                      max={10000}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Duration</label>
                    <select
                      value={hypeTrainData.duration}
                      onChange={(e) => setHypeTrainData({ ...hypeTrainData, duration: parseInt(e.target.value) })}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value={180}>3 minutes</option>
                      <option value={300}>5 minutes</option>
                      <option value={600}>10 minutes</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Rewards (optional)</label>
                    <input
                      type="text"
                      value={hypeTrainData.rewards}
                      onChange={(e) => setHypeTrainData({ ...hypeTrainData, rewards: e.target.value })}
                      placeholder="Special emote, shoutout, etc."
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <Button
                    onClick={handleStartHypeTrain}
                    variant="primary"
                    fullWidth
                    disabled={hypeTrainData.goal <= 0}
                  >
                    Start Hype Train
                  </Button>
                </>
              )}

              {/* Spotlight Viewer */}
              {activeTab === 'spotlight' && (
                <>
                  <div className="bg-yellow-600/20 rounded-lg p-3 mb-3">
                    <p className="text-sm text-yellow-300">
                      Highlight a viewer on stream to recognize their support!
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Username</label>
                    <input
                      type="text"
                      value={spotlightUser}
                      onChange={(e) => setSpotlightUser(e.target.value)}
                      placeholder="Enter viewer username"
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">Quick spotlight:</p>
                    {['Top Donor', 'New Subscriber', 'Active Chatter'].map(type => (
                      <button
                        key={type}
                        className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 transition-colors"
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  <Button
                    onClick={handleSpotlight}
                    variant="primary"
                    fullWidth
                    disabled={!spotlightUser}
                  >
                    Spotlight Viewer
                  </Button>
                </>
              )}

              {/* Announcement */}
              {activeTab === 'announce' && (
                <>
                  <div className="bg-green-600/20 rounded-lg p-3 mb-3">
                    <p className="text-sm text-green-300">
                      Make an important announcement that stands out in chat!
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Message</label>
                    <textarea
                      value={announcement}
                      onChange={(e) => setAnnouncement(e.target.value)}
                      placeholder="Type your announcement..."
                      rows={3}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">Templates:</p>
                    {[
                      'Starting soon! Get ready for an amazing stream!',
                      'Going on a short break, be right back!',
                      'Thank you all for the support! You\'re amazing!'
                    ].map((template, i) => (
                      <button
                        key={i}
                        onClick={() => setAnnouncement(template)}
                        className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 transition-colors"
                      >
                        {template}
                      </button>
                    ))}
                  </div>

                  <Button
                    onClick={() => {
                      // Implement announcement
                      setAnnouncement('');
                      setShowPanel(false);
                    }}
                    variant="primary"
                    fullWidth
                    disabled={!announcement}
                  >
                    Send Announcement
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default QuickActionsPanel;