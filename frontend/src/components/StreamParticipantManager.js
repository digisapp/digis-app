import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserGroupIcon,
  UserMinusIcon,
  NoSymbolIcon,
  EllipsisVerticalIcon,
  XMarkIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { Menu } from '@headlessui/react';
import toast from 'react-hot-toast';
import Button from './ui/Button';
import Card from './ui/Card';

const StreamParticipantManager = ({
  user,
  channel,
  participants = [],
  isCreator,
  onKickUser,
  onBlockUser,
  className = ''
}) => {
  const [showManager, setShowManager] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState(new Set());

  // Handle kick user
  const handleKickUser = async (participant) => {
    setSelectedParticipant(participant);
    setConfirmAction('kick');
    setShowConfirmDialog(true);
  };

  // Handle block user
  const handleBlockUser = async (participant) => {
    setSelectedParticipant(participant);
    setConfirmAction('block');
    setShowConfirmDialog(true);
  };

  // Confirm action
  const confirmActionHandler = async () => {
    if (!selectedParticipant || !confirmAction) return;

    try {
      if (confirmAction === 'kick') {
        await onKickUser(selectedParticipant);
        // toast.success(`${selectedParticipant.name} has been removed from the stream`);
      } else if (confirmAction === 'block') {
        await onBlockUser(selectedParticipant);
        setBlockedUsers(prev => new Set([...prev, selectedParticipant.uid]));
        // toast.success(`${selectedParticipant.name} has been blocked`);
      }
    } catch (error) {
      console.error('Error performing action:', error);
      toast.error(`Failed to ${confirmAction} user`);
    } finally {
      setShowConfirmDialog(false);
      setSelectedParticipant(null);
      setConfirmAction(null);
    }
  };

  // Participant item component
  const ParticipantItem = ({ participant }) => {
    const isBlocked = blockedUsers.has(participant.uid);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
              {participant.name?.[0]?.toUpperCase() || 'U'}
            </div>
            {participant.isCoHost && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                <UserGroupIcon className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {participant.name || 'Anonymous'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {participant.role || 'Viewer'} • Joined {participant.joinTime || 'recently'}
            </p>
          </div>
          {isBlocked && (
            <span className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded-full">
              Blocked
            </span>
          )}
        </div>

        {isCreator && !participant.isCreator && (
          <Menu as="div" className="relative">
            <Menu.Button className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              <EllipsisVerticalIcon className="w-5 h-5 text-gray-500" />
            </Menu.Button>

            <Menu.Items className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => handleKickUser(participant)}
                    className={`${
                      active ? 'bg-gray-100 dark:bg-gray-700' : ''
                    } flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300`}
                  >
                    <UserMinusIcon className="w-4 h-4" />
                    Remove from Stream
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => handleBlockUser(participant)}
                    disabled={isBlocked}
                    className={`${
                      active ? 'bg-gray-100 dark:bg-gray-700' : ''
                    } flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 disabled:opacity-50`}
                  >
                    <NoSymbolIcon className="w-4 h-4" />
                    {isBlocked ? 'Already Blocked' : 'Block User'}
                  </button>
                )}
              </Menu.Item>
            </Menu.Items>
          </Menu>
        )}
      </motion.div>
    );
  };

  if (!isCreator) return null;

  return (
    <>
      {/* Toggle Button */}
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setShowManager(!showManager)}
        icon={<UserGroupIcon className="w-4 h-4" />}
        className={className}
      >
        Manage Viewers ({participants.length})
      </Button>

      {/* Manager Panel */}
      <AnimatePresence>
        {showManager && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowManager(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl"
            >
              <Card className="p-0 overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Stream Participants
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Manage viewers in your live stream
                      </p>
                    </div>
                    <button
                      onClick={() => setShowManager(false)}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto">
                  {participants.length === 0 ? (
                    <div className="text-center py-8">
                      <UserGroupIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-gray-400">
                        No viewers in the stream yet
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <AnimatePresence>
                        {participants.map((participant) => (
                          <ParticipantItem
                            key={participant.uid}
                            participant={participant}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                      <span>{participants.length} Active Viewers</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <NoSymbolIcon className="w-4 h-4 text-red-500" />
                      <span>{blockedUsers.size} Blocked</span>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {showConfirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md"
            >
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                    <ExclamationTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {confirmAction === 'kick' ? 'Remove Viewer?' : 'Block User?'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {confirmAction === 'kick' 
                        ? 'This will remove the viewer from your stream'
                        : 'This user will be permanently blocked from your streams'}
                    </p>
                  </div>
                </div>

                {selectedParticipant && (
                  <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
                        {selectedParticipant.name?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedParticipant.name || 'Anonymous'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {selectedParticipant.role || 'Viewer'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => setShowConfirmDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    fullWidth
                    onClick={confirmActionHandler}
                  >
                    {confirmAction === 'kick' ? 'Remove' : 'Block'}
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default StreamParticipantManager;