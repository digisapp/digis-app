import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserGroupIcon,
  PlusIcon,
  XMarkIcon,
  VideoCameraIcon,
  MicrophoneIcon,
  SpeakerWaveIcon,
  HandRaisedIcon,
  CheckIcon,
  ClockIcon,
  ShareIcon,
  Cog6ToothIcon,
  UserPlusIcon,
  UserMinusIcon,
  CrownIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import {
  VideoCameraIcon as VideoCameraIconSolid,
  MicrophoneIcon as MicrophoneIconSolid,
  CrownIcon as CrownIconSolid
} from '@heroicons/react/24/solid';

const MultiCreatorCollaboration = ({
  websocket,
  channelId,
  sessionId,
  user,
  isHostCreator = false,
  agoraClient,
  onCollaborationEnd
}) => {
  const [collaborators, setCollaborators] = useState([]);
  const [invitePending, setInvitePending] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [collaborationSettings, setCollaborationSettings] = useState({
    maxCollaborators: 4,
    autoApprove: false,
    allowScreenShare: true,
    allowAudioOnly: true,
    moderationEnabled: true,
    recordingShared: false
  });
  const [permissions, setPermissions] = useState(new Map());
  const [activeStreams, setActiveStreams] = useState(new Map());
  const [speakingUsers, setSpeakingUsers] = useState(new Set());
  const [audienceCount, setAudienceCount] = useState(0);

  useEffect(() => {
    if (websocket) {
      setupWebSocketListeners();
    }
    
    initializeCollaboration();
  }, [websocket, sessionId]);

  useEffect(() => {
    if (agoraClient) {
      setupAgoraListeners();
    }
  }, [agoraClient]);

  const setupWebSocketListeners = () => {
    websocket.addEventListener('message', handleWebSocketMessage);
  };

  const handleWebSocketMessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'collaboration_invite_sent':
          handleInviteSent(data);
          break;
        case 'collaboration_invite_received':
          handleInviteReceived(data);
          break;
        case 'collaboration_join_request':
          if (isHostCreator) {
            handleJoinRequest(data);
          }
          break;
        case 'collaboration_user_joined':
          handleUserJoined(data);
          break;
        case 'collaboration_user_left':
          handleUserLeft(data);
          break;
        case 'collaboration_permissions_updated':
          handlePermissionsUpdated(data);
          break;
        case 'collaboration_host_changed':
          handleHostChanged(data);
          break;
        case 'collaboration_ended':
          handleCollaborationEnded(data);
          break;
        case 'user_speaking_started':
          handleUserSpeakingStarted(data);
          break;
        case 'user_speaking_stopped':
          handleUserSpeakingStopped(data);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error parsing collaboration WebSocket message:', error);
    }
  };

  const setupAgoraListeners = () => {
    // Volume indicator for speaking detection
    agoraClient.on('volume-indicator', (speakers) => {
      const currentlySpeaking = new Set();
      
      speakers.forEach(speaker => {
        if (speaker.level > 10) { // Threshold for speaking detection
          currentlySpeaking.add(speaker.uid);
        }
      });
      
      setSpeakingUsers(currentlySpeaking);
      
      // Broadcast speaking state
      if (websocket) {
        speakers.forEach(speaker => {
          if (speaker.level > 10) {
            websocket.send(JSON.stringify({
              type: 'user_speaking_started',
              sessionId,
              userId: speaker.uid
            }));
          } else {
            websocket.send(JSON.stringify({
              type: 'user_speaking_stopped',
              sessionId,
              userId: speaker.uid
            }));
          }
        });
      }
    });
  };

  const initializeCollaboration = () => {
    // Initialize with host creator
    if (isHostCreator) {
      setCollaborators([{
        userId: user.uid,
        username: user.username || 'Host Creator',
        role: 'host',
        joinedAt: new Date().toISOString(),
        permissions: {
          video: true,
          audio: true,
          screenShare: true,
          moderator: true,
          canInvite: true,
          canKick: true
        },
        status: 'active',
        isHost: true
      }]);
      
      setPermissions(new Map([[user.uid, {
        video: true,
        audio: true,
        screenShare: true,
        moderator: true,
        canInvite: true,
        canKick: true
      }]]));
    }
  };

  const handleInviteSent = (data) => {
    setInvitePending(prev => [...prev, data.invite]);
  };

  const handleInviteReceived = (data) => {
    // Show invite notification (in a real app, this would be a toast/notification)
    const accept = window.confirm(
      `${data.inviterUsername} invited you to collaborate on their stream: "${data.message}". Accept?`
    );
    
    if (accept) {
      acceptCollaborationInvite(data.inviteId);
    } else {
      declineCollaborationInvite(data.inviteId);
    }
  };

  const handleJoinRequest = (data) => {
    setJoinRequests(prev => [...prev, data.request]);
  };

  const handleUserJoined = (data) => {
    setCollaborators(prev => [...prev, data.collaborator]);
    setAudienceCount(prev => prev + 1);
    
    // Remove from pending invites if applicable
    setInvitePending(prev => prev.filter(invite => invite.inviteeId !== data.collaborator.userId));
  };

  const handleUserLeft = (data) => {
    setCollaborators(prev => prev.filter(collab => collab.userId !== data.userId));
    setActiveStreams(prev => {
      const updated = new Map(prev);
      updated.delete(data.userId);
      return updated;
    });
    setAudienceCount(prev => Math.max(0, prev - 1));
  };

  const handlePermissionsUpdated = (data) => {
    setPermissions(prev => {
      const updated = new Map(prev);
      updated.set(data.userId, data.permissions);
      return updated;
    });
    
    setCollaborators(prev => prev.map(collab => 
      collab.userId === data.userId 
        ? { ...collab, permissions: data.permissions }
        : collab
    ));
  };

  const handleHostChanged = (data) => {
    setCollaborators(prev => prev.map(collab => ({
      ...collab,
      isHost: collab.userId === data.newHostId,
      role: collab.userId === data.newHostId ? 'host' : 'collaborator'
    })));
  };

  const handleCollaborationEnded = (data) => {
    onCollaborationEnd?.();
  };

  const handleUserSpeakingStarted = (data) => {
    setSpeakingUsers(prev => new Set([...prev, data.userId]));
  };

  const handleUserSpeakingStopped = (data) => {
    setSpeakingUsers(prev => {
      const updated = new Set(prev);
      updated.delete(data.userId);
      return updated;
    });
  };

  const sendCollaborationInvite = () => {
    if (!inviteUsername.trim()) return;

    const inviteData = {
      type: 'send_collaboration_invite',
      sessionId,
      channelId,
      inviteeUsername: inviteUsername.trim(),
      message: inviteMessage.trim() || 'Join me for a collaboration stream!',
      settings: collaborationSettings
    };

    websocket.send(JSON.stringify(inviteData));
    
    setInviteUsername('');
    setInviteMessage('');
    setShowInviteModal(false);
  };

  const acceptCollaborationInvite = (inviteId) => {
    const acceptData = {
      type: 'accept_collaboration_invite',
      inviteId,
      sessionId
    };

    websocket.send(JSON.stringify(acceptData));
  };

  const declineCollaborationInvite = (inviteId) => {
    const declineData = {
      type: 'decline_collaboration_invite',
      inviteId
    };

    websocket.send(JSON.stringify(declineData));
  };

  const approveJoinRequest = (requestId, requestUserId) => {
    const approveData = {
      type: 'approve_join_request',
      requestId,
      sessionId,
      userId: requestUserId
    };

    websocket.send(JSON.stringify(approveData));
    
    setJoinRequests(prev => prev.filter(req => req.id !== requestId));
  };

  const denyJoinRequest = (requestId) => {
    const denyData = {
      type: 'deny_join_request',
      requestId
    };

    websocket.send(JSON.stringify(denyData));
    
    setJoinRequests(prev => prev.filter(req => req.id !== requestId));
  };

  const updateCollaboratorPermissions = (userId, newPermissions) => {
    const updateData = {
      type: 'update_collaborator_permissions',
      sessionId,
      userId,
      permissions: newPermissions
    };

    websocket.send(JSON.stringify(updateData));
  };

  const removeCollaborator = (userId) => {
    if (window.confirm('Are you sure you want to remove this collaborator?')) {
      const removeData = {
        type: 'remove_collaborator',
        sessionId,
        userId
      };

      websocket.send(JSON.stringify(removeData));
    }
  };

  const transferHost = (newHostId) => {
    if (window.confirm('Are you sure you want to transfer host privileges?')) {
      const transferData = {
        type: 'transfer_host',
        sessionId,
        newHostId
      };

      websocket.send(JSON.stringify(transferData));
    }
  };

  const endCollaboration = () => {
    if (window.confirm('Are you sure you want to end the collaboration for everyone?')) {
      const endData = {
        type: 'end_collaboration',
        sessionId
      };

      websocket.send(JSON.stringify(endData));
    }
  };

  const toggleCollaboratorPermission = (userId, permission) => {
    const currentPermissions = permissions.get(userId) || {};
    const newPermissions = {
      ...currentPermissions,
      [permission]: !currentPermissions[permission]
    };
    
    updateCollaboratorPermissions(userId, newPermissions);
  };

  const getCollaboratorRole = (collaborator) => {
    if (collaborator.isHost) return 'Host';
    if (collaborator.permissions?.moderator) return 'Moderator';
    return 'Collaborator';
  };

  const getCollaboratorRoleColor = (collaborator) => {
    if (collaborator.isHost) return 'text-yellow-600 bg-yellow-100';
    if (collaborator.permissions?.moderator) return 'text-purple-600 bg-purple-100';
    return 'text-blue-600 bg-blue-100';
  };

  const formatDuration = (timestamp) => {
    const start = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - start) / 1000);
    
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <motion.div
      className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserGroupIcon className="w-6 h-6" />
            <div>
              <h3 className="font-bold text-lg">Multi-Creator Stream</h3>
              <p className="text-white/80 text-sm">
                {collaborators.length} collaborator{collaborators.length !== 1 ? 's' : ''} • {audienceCount} viewers
              </p>
            </div>
          </div>
          
          {isHostCreator && (
            <div className="flex items-center gap-2">
              <motion.button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <UserPlusIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Invite</span>
              </motion.button>
              
              <motion.button
                onClick={() => setShowManageModal(true)}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Cog6ToothIcon className="w-5 h-5" />
              </motion.button>
            </div>
          )}
        </div>

        {/* Join Requests Notification */}
        {joinRequests.length > 0 && isHostCreator && (
          <motion.div 
            className="mt-3 bg-white/20 rounded-lg p-3"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {joinRequests.length} pending join request{joinRequests.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setShowManageModal(true)}
                className="text-sm text-white/80 hover:text-white underline"
              >
                Review
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Collaborators Grid */}
      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collaborators.map((collaborator) => (
            <motion.div
              key={collaborator.userId}
              className={`border-2 rounded-xl p-4 transition-all ${
                speakingUsers.has(collaborator.userId)
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-200 bg-white'
              }`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              layout
            >
              {/* Collaborator Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white font-bold">
                    {collaborator.username[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {collaborator.username}
                      </span>
                      {collaborator.isHost && (
                        <CrownIconSolid className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${getCollaboratorRoleColor(collaborator)}`}>
                      {getCollaboratorRole(collaborator)}
                    </span>
                  </div>
                </div>

                {/* Status Indicators */}
                <div className="flex items-center gap-1">
                  {collaborator.permissions?.video ? (
                    <VideoCameraIconSolid className="w-4 h-4 text-blue-500" />
                  ) : (
                    <VideoCameraIcon className="w-4 h-4 text-gray-400" />
                  )}
                  
                  {collaborator.permissions?.audio ? (
                    <MicrophoneIconSolid className={`w-4 h-4 ${
                      speakingUsers.has(collaborator.userId) ? 'text-green-500' : 'text-blue-500'
                    }`} />
                  ) : (
                    <MicrophoneIcon className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Collaborator Stats */}
              <div className="text-sm text-gray-600 mb-3">
                <div className="flex items-center justify-between">
                  <span>Joined: {formatDuration(collaborator.joinedAt)} ago</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    collaborator.status === 'active' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {collaborator.status}
                  </span>
                </div>
              </div>

              {/* Actions (Host Only) */}
              {isHostCreator && !collaborator.isHost && (
                <div className="flex items-center gap-2">
                  <motion.button
                    onClick={() => toggleCollaboratorPermission(collaborator.userId, 'audio')}
                    className={`p-2 rounded-lg transition-all ${
                      collaborator.permissions?.audio
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title="Toggle Audio"
                  >
                    <MicrophoneIcon className="w-4 h-4" />
                  </motion.button>

                  <motion.button
                    onClick={() => toggleCollaboratorPermission(collaborator.userId, 'video')}
                    className={`p-2 rounded-lg transition-all ${
                      collaborator.permissions?.video
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title="Toggle Video"
                  >
                    <VideoCameraIcon className="w-4 h-4" />
                  </motion.button>

                  <motion.button
                    onClick={() => transferHost(collaborator.userId)}
                    className="p-2 bg-yellow-100 text-yellow-600 rounded-lg hover:bg-yellow-200 transition-all"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title="Transfer Host"
                  >
                    <CrownIcon className="w-4 h-4" />
                  </motion.button>

                  <motion.button
                    onClick={() => removeCollaborator(collaborator.userId)}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title="Remove Collaborator"
                  >
                    <UserMinusIcon className="w-4 h-4" />
                  </motion.button>
                </div>
              )}
            </motion.div>
          ))}

          {/* Add Collaborator Card */}
          {isHostCreator && collaborators.length < collaborationSettings.maxCollaborators && (
            <motion.button
              onClick={() => setShowInviteModal(true)}
              className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center gap-3 hover:border-indigo-400 hover:bg-indigo-50 transition-all min-h-32"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <PlusIcon className="w-8 h-8 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Invite Collaborator</span>
            </motion.button>
          )}
        </div>

        {/* Pending Invites */}
        {invitePending.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Pending Invites</h4>
            <div className="space-y-2">
              {invitePending.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <ClockIcon className="w-5 h-5 text-yellow-600" />
                    <div>
                      <span className="font-medium text-gray-900">{invite.inviteeUsername}</span>
                      <p className="text-sm text-gray-600">{invite.message}</p>
                    </div>
                  </div>
                  <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">
                    Pending
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl p-6 w-full max-w-md"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Invite Collaborator</h3>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    placeholder="Enter username to invite"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invitation Message
                  </label>
                  <textarea
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    placeholder="Join me for a collaboration stream!"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    rows="3"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={sendCollaborationInvite}
                  disabled={!inviteUsername.trim()}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Send Invite
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manage Modal */}
      <AnimatePresence>
        {showManageModal && isHostCreator && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-96 overflow-y-auto"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Manage Collaboration</h3>
                <button
                  onClick={() => setShowManageModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Join Requests */}
              {joinRequests.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-3">Join Requests</h4>
                  <div className="space-y-3">
                    {joinRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <HandRaisedIcon className="w-5 h-5 text-blue-600" />
                          <div>
                            <span className="font-medium text-gray-900">{request.username}</span>
                            <p className="text-sm text-gray-600">{request.message}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveJoinRequest(request.id, request.userId)}
                            className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                          >
                            <CheckIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => denyJoinRequest(request.id)}
                            className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Settings */}
              <div className="mb-6">
                <h4 className="text-lg font-medium text-gray-900 mb-3">Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Collaborators
                    </label>
                    <select
                      value={collaborationSettings.maxCollaborators}
                      onChange={(e) => setCollaborationSettings(prev => ({ 
                        ...prev, 
                        maxCollaborators: parseInt(e.target.value) 
                      }))}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value={2}>2 collaborators</option>
                      <option value={3}>3 collaborators</option>
                      <option value={4}>4 collaborators</option>
                      <option value={6}>6 collaborators</option>
                      <option value={8}>8 collaborators</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">
                      Auto-approve join requests
                    </label>
                    <button
                      onClick={() => setCollaborationSettings(prev => ({ 
                        ...prev, 
                        autoApprove: !prev.autoApprove 
                      }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        collaborationSettings.autoApprove ? 'bg-indigo-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          collaborationSettings.autoApprove ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">
                      Allow screen sharing
                    </label>
                    <button
                      onClick={() => setCollaborationSettings(prev => ({ 
                        ...prev, 
                        allowScreenShare: !prev.allowScreenShare 
                      }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        collaborationSettings.allowScreenShare ? 'bg-indigo-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          collaborationSettings.allowScreenShare ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowManageModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
                >
                  Close
                </button>
                <button
                  onClick={endCollaboration}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
                >
                  End Collaboration
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default MultiCreatorCollaboration;