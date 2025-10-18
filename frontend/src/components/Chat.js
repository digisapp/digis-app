import React, { useEffect, useState, useRef, useCallback } from 'react';
import AgoraChat from 'agora-chat';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';
import { getAuthToken } from '../utils/auth-helpers';

const Chat = ({ user, channel, isCreator, token, onLogin, onLogout }) => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [logs, setLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typing, setTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const chatClient = useRef(null);
  const messagesEndRef = useRef(null);
  const connectionRetries = useRef(0);
  const typingTimeout = useRef(null);
  const maxRetries = 3;
  const groupId = `channel_${channel}`;

  // Fetch message history from backend API
  const fetchMessageHistory = useCallback(async () => {
    if (!user || !channel) return;
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/agora/chat/messages/${channel}?limit=50`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch message history');
      }

      const data = await response.json();
      setMessages(data.messages.map(msg => ({
        id: msg.id,
        senderId: msg.sender_id,
        text: msg.message,
        timestamp: msg.created_at,
        isOwn: msg.sender_id === user.id,
        type: msg.type,
        imageUrl: msg.file_url,
        fileUrl: msg.file_url,
        fileName: msg.file_name,
        ext: { isCreator: msg.sender_id === user.id && isCreator },
      })));
      addLog('Message history loaded', 'success');
    } catch (error) {
      console.error('❌ Message history fetch error:', error);
      addLog(`Failed to load message history: ${error.message}`, 'error');
    }
  }, [user, channel, isCreator]);

  // Add log entry with enhanced formatting
  const addLog = (log, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      id: Date.now(),
      message: log,
      type,
      timestamp,
    };
    setLogs((prev) => [...prev.slice(-99), logEntry]);
    console.log(`🗨️ Chat ${type.toUpperCase()}:`, log);

    switch (type) {
      case 'success':
        // toast.success(log);
        break;
      case 'error':
        toast.error(log);
        break;
      case 'warning':
        toast(log, { icon: '⚠️' });
        break;
      default:
        toast(log);
    }
  };

  // Scroll to bottom with smooth animation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Initialize Agora Chat
  const initializeAgoraChat = useCallback(async () => {
    if (!user || !channel || !token) {
      addLog('Cannot connect: missing user, channel, or token', 'error');
      setConnectionError('Missing required parameters. Please ensure user, channel, and token are provided.');
      return;
    }

    if (!import.meta.env.VITE_AGORA_APP_ID) {
      addLog('Agora App ID is missing. Please set REACT_APP_AGORA_APP_ID in .env', 'error');
      setConnectionError('Agora configuration error. Please contact support.');
      return;
    }

    if (isConnecting) {
      addLog('Already connecting...', 'warning');
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);
    addLog('Initializing Agora Chat...', 'info');

    try {
      chatClient.current = new AgoraChat.connection({
        appKey: import.meta.env.VITE_AGORA_APP_ID,
        delivery: true,
        apiUrl: 'https://a41.chat.agora.io',
        url: 'https://msync-api-41.chat.agora.io',
        enableReportLogs: true,
        logLevel: 'INFO',
      });

      setupEventHandlers();

      addLog('Connecting to Agora Chat...', 'info');
      await chatClient.current.open({
        user: user.id,
        agoraToken: token,
      });

      await fetchMessageHistory();
    } catch (error) {
      console.error('❌ Agora Chat initialization error:', error);
      handleConnectionError(error);
    }
  }, [user, channel, token, isConnecting, fetchMessageHistory]);

  // Setup comprehensive event handlers
  const setupEventHandlers = () => {
    chatClient.current.addEventHandler('connection&message', {
      onConnected: () => {
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError(null);
        connectionRetries.current = 0;
        addLog('🎉 Connected to Agora Chat successfully', 'success');

        joinOrCreateChatChannel();

        if (onLogin) onLogin();
      },

      onDisconnected: () => {
        setIsConnected(false);
        setIsConnecting(false);
        setOnlineUsers(new Set());
        addLog('❌ Disconnected from Agora Chat', 'warning');
        if (onLogout) onLogout();
      },

      onTokenWillExpire: () => {
        addLog('⚠️ Chat token will expire in 30 minutes', 'warning');
      },

      onTokenExpired: () => {
        addLog('🔴 Chat token expired', 'error');
        setConnectionError('Token expired. Please refresh the page.');
        setIsConnected(false);
      },

      onTextMessage: (message) => {
        addLog(`📩 Message from ${message.from}: ${message.msg.substring(0, 50)}...`, 'info');

        const newMessage = {
          id: message.id,
          senderId: message.from,
          text: message.msg,
          timestamp: new Date(message.time).toISOString(),
          isOwn: message.from === user.id,
          type: 'text',
          ext: message.ext || {},
        };

        setMessages((prev) => [...prev, newMessage]);

        if (!isVisible && !newMessage.isOwn) {
          setUnreadCount((prev) => prev + 1);
        }
      },

      onImageMessage: (message) => {
        addLog(`🖼️ Image from ${message.from}`, 'info');

        const newMessage = {
          id: message.id,
          senderId: message.from,
          text: '[Image]',
          imageUrl: message.url,
          timestamp: new Date(message.time).toISOString(),
          isOwn: message.from === user.id,
          type: 'image',
          ext: message.ext || {},
        };

        setMessages((prev) => [...prev, newMessage]);

        if (!isVisible && !newMessage.isOwn) {
          setUnreadCount((prev) => prev + 1);
        }
      },

      onFileMessage: (message) => {
        addLog(`📁 File from ${message.from}: ${message.filename}`, 'info');

        const newMessage = {
          id: message.id,
          senderId: message.from,
          text: `[File: ${message.filename}]`,
          fileUrl: message.url,
          fileName: message.filename,
          timestamp: new Date(message.time).toISOString(),
          isOwn: message.from === user.id,
          type: 'file',
          ext: message.ext || {},
        };

        setMessages((prev) => [...prev, newMessage]);

        if (!isVisible && !newMessage.isOwn) {
          setUnreadCount((prev) => prev + 1);
        }
      },

      onGroupEvent: (event) => {
        handleGroupEvent(event);
      },

      onPresenceStatusChange: (presence) => {
        updateUserPresence(presence);
      },

      onCmdMessage: (message) => {
        if (message.action === 'typing_start') {
          setTypingUsers((prev) => new Set([...prev, message.from]));
        } else if (message.action === 'typing_stop') {
          setTypingUsers((prev) => {
            const newSet = new Set(prev);
            newSet.delete(message.from);
            return newSet;
          });
        }
      },

      onError: (error) => {
        console.error('❌ Agora Chat error:', error);
        addLog(`🚨 Chat error: ${error.message || error}`, 'error');
        handleConnectionError(error);
      },
    });
  };

  // Join or create chat channel
  const joinOrCreateChatChannel = async () => {
    try {
      addLog(`🚪 Joining channel group: ${groupId}`, 'info');

      await chatClient.current.joinGroup({
        groupId: groupId,
        message: `${user.id} joined the channel`,
      });

      addLog(`✅ Successfully joined channel group`, 'success');

      const groupInfo = await chatClient.current.getGroupInfo({
        groupId: groupId,
      });

      setOnlineUsers(new Set(groupInfo.affiliations || []));
    } catch (error) {
      if (error.type === 'GROUP_NOT_EXIST' || error.message.includes('does not exist')) {
        await createChatChannel();
      } else {
        addLog(`❌ Failed to join channel: ${error.message}`, 'error');
      }
    }
  };

  // Create chat channel
  const createChatChannel = async () => {
    try {
      addLog(`🏗️ Creating channel group: ${groupId}`, 'info');

      await chatClient.current.createGroup({
        groupId: groupId,
        groupName: `Channel ${channel}`,
        desc: `Chat room for channel ${channel}`,
        members: [user.id],
        allowInvitesByAdmin: true,
        allowInvitesByMembers: true,
        maxUsers: 500,
        approval: false,
        public: true,
      });

      addLog(`✅ Successfully created channel group`, 'success');
    } catch (error) {
      addLog(`❌ Failed to create channel: ${error.message}`, 'error');
    }
  };

  // Handle group events
  const handleGroupEvent = (event) => {
    switch (event.operation) {
      case 'memberJoined':
        addLog(`👋 ${event.from} joined the channel`, 'info');
        setOnlineUsers((prev) => new Set([...prev, event.from]));
        break;
      case 'memberLeft':
        addLog(`👋 ${event.from} left the channel`, 'info');
        setOnlineUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(event.from);
          return newSet;
        });
        break;
      case 'memberRemoved':
        addLog(`❌ ${event.from} was removed from the channel`, 'warning');
        setOnlineUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(event.from);
          return newSet;
        });
        break;
      default:
        console.log(`Unhandled group event: ${event.operation}`);
        break;
    }
  };

  // Update user presence
  const updateUserPresence = (presence) => {
    setOnlineUsers((prev) => {
      const newSet = new Set(prev);
      if (presence.status === 'online') {
        newSet.add(presence.userId);
      } else {
        newSet.delete(presence.userId);
      }
      return newSet;
    });
  };

  // Handle connection errors with retry logic
  const handleConnectionError = (error) => {
    setIsConnecting(false);
    setConnectionError(error.message || 'Failed to connect. Please try refreshing the page or check your internet connection.');

    if (connectionRetries.current < maxRetries) {
      connectionRetries.current++;
      const retryDelay = 2000 * Math.pow(2, connectionRetries.current - 1);
      addLog(`🔄 Retrying connection in ${retryDelay / 1000}s... (${connectionRetries.current}/${maxRetries})`, 'info');

      setTimeout(() => {
        initializeAgoraChat();
      }, retryDelay);
    } else {
      addLog('❌ Max connection retries reached', 'error');
      setConnectionError('Unable to connect after multiple attempts. Please try the Retry button or refresh the page.');
    }
  };

  // Send typing indicator
  const sendTypingIndicator = (isTyping) => {
    if (!isConnected) return;

    try {
      const cmdMessage = AgoraChat.message.create({
        type: 'cmd',
        to: groupId,
        chatType: 'groupChat',
        action: isTyping ? 'typing_start' : 'typing_stop',
        ext: {
          sender: user.id,
          timestamp: new Date().toISOString(),
        },
      });

      chatClient.current.send(cmdMessage);
    } catch (error) {
      console.error('❌ Failed to send typing indicator:', error);
    }
  };

  // Handle typing
  const handleTyping = () => {
    if (!typing) {
      setTyping(true);
      sendTypingIndicator(true);
    }

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    typingTimeout.current = setTimeout(() => {
      setTyping(false);
      sendTypingIndicator(false);
    }, 1000);
  };

  // Send text message
  const handleSendMessage = async () => {
    if (!message.trim()) {
      addLog('⚠️ Cannot send empty message', 'warning');
      return;
    }

    if (!isConnected) {
      addLog('❌ Not connected to chat', 'error');
      return;
    }

    try {
      const msgObj = AgoraChat.message.create({
        type: 'txt',
        to: groupId,
        chatType: 'groupChat',
        msg: message.trim(),
        ext: {
          sender: user.id,
          channel: channel,
          timestamp: new Date().toISOString(),
          isCreator: isCreator,
        },
      });

      await chatClient.current.send(msgObj);

      // Save message to backend
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/agora/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          channel,
          message: message.trim(),
          type: 'text',
          senderId: user.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save message');
      }

      setMessage('');
      addLog(`✅ Message sent: "${message.trim().substring(0, 50)}..."`, 'success');

      if (typing) {
        setTyping(false);
        sendTypingIndicator(false);
      }
    } catch (error) {
      console.error('❌ Send message error:', error);
      addLog(`❌ Failed to send message: ${error.message}`, 'error');
    }
  };

  // Send image
  const handleSendImage = async (file) => {
    if (!isConnected) {
      addLog('❌ Not connected to chat', 'error');
      return;
    }

    if (file.size > import.meta.env.VITE_MAX_FILE_SIZE) {
      addLog(`❌ Image too large. Maximum size is ${import.meta.env.VITE_MAX_FILE_SIZE / 1024 / 1024}MB`, 'error');
      return;
    }

    const supportedFormats = import.meta.env.VITE_SUPPORTED_IMAGE_FORMATS.split(',');
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!supportedFormats.includes(fileExtension)) {
      addLog(`❌ Unsupported image format. Supported formats: ${supportedFormats.join(', ')}`, 'error');
      return;
    }

    try {
      addLog('📤 Uploading image...', 'info');

      const msgObj = AgoraChat.message.create({
        type: 'img',
        to: groupId,
        chatType: 'groupChat',
        file: file,
        ext: {
          sender: user.id,
          channel: channel,
          timestamp: new Date().toISOString(),
          isCreator: isCreator,
        },
      });

      await chatClient.current.send(msgObj);

      // Save message to backend
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/agora/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          channel,
          message: '[Image]',
          type: 'image',
          senderId: user.id,
          fileUrl: msgObj.url,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save image message');
      }

      addLog('✅ Image sent successfully', 'success');
    } catch (error) {
      console.error('❌ Send image error:', error);
      addLog(`❌ Failed to send image: ${error.message}`, 'error');
    }
  };

  // Send file
  const handleSendFile = async (file) => {
    if (!isConnected) {
      addLog('❌ Not connected to chat', 'error');
      return;
    }

    if (file.size > import.meta.env.VITE_MAX_FILE_SIZE) {
      addLog(`❌ File too large. Maximum size is ${import.meta.env.VITE_MAX_FILE_SIZE / 1024 / 1024}MB`, 'error');
      return;
    }

    try {
      addLog(`📤 Uploading file: ${file.name}`, 'info');

      const msgObj = AgoraChat.message.create({
        type: 'file',
        to: groupId,
        chatType: 'groupChat',
        file: file,
        filename: file.name,
        ext: {
          sender: user.id,
          channel: channel,
          timestamp: new Date().toISOString(),
          isCreator: isCreator,
        },
      });

      await chatClient.current.send(msgObj);

      // Save message to backend
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/agora/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          channel,
          message: `[File: ${file.name}]`,
          type: 'file',
          senderId: user.id,
          fileUrl: msgObj.url,
          fileName: file.name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save file message');
      }

      addLog('✅ File sent successfully', 'success');
    } catch (error) {
      console.error('❌ Send file error:', error);
      addLog(`❌ Failed to send file: ${error.message}`, 'error');
    }
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key !== 'Enter') {
      handleTyping();
    }
  };

  // Clear unread count when component becomes visible
  const handleVisibilityChange = () => {
    const visible = !document.hidden;
    setIsVisible(visible);
    if (visible) {
      setUnreadCount(0);
    }
  };

  // Manual reconnect
  const handleReconnect = () => {
    cleanup();
    connectionRetries.current = 0;
    setTimeout(initializeAgoraChat, 1000);
  };

  // Get typing indicator text
  const getTypingText = () => {
    const users = Array.from(typingUsers).filter((u) => u !== user.id);
    if (users.length === 0) return '';
    if (users.length === 1) return `${users[0]} is typing...`;
    if (users.length === 2) return `${users[0]} and ${users[1]} are typing...`;
    return `${users.slice(0, -1).join(', ')} and ${users[users.length - 1]} are typing...`;
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString();
    } else {
      return date.toLocaleDateString();
    }
  };

  // Cleanup function
  const cleanup = useCallback(() => {
    if (chatClient.current) {
      try {
        chatClient.current.leaveGroup({
          groupId: groupId,
        });

        chatClient.current.close();
        chatClient.current = null;
      } catch (error) {
        console.error('❌ Cleanup error:', error);
      }
    }

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [groupId]);

  // Initialize on mount
  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const handleOnline = () => {
      if (!isConnected && !isConnecting) {
        addLog('Network restored, attempting to reconnect...', 'info');
        connectionRetries.current = 0;
        initializeAgoraChat();
      }
    };
    window.addEventListener('online', handleOnline);
    initializeAgoraChat();
    return () => {
      cleanup();
      window.removeEventListener('online', handleOnline);
    };
  }, [initializeAgoraChat, cleanup, isConnected, isConnecting]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '500px',
        height: '650px',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #dee2e6',
        borderRadius: '12px',
        backgroundColor: '#fff',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #dee2e6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h3 style={{ margin: '0', color: '#333', fontSize: '16px', fontWeight: '600' }}>
            💬 Chat {unreadCount > 0 && <span style={{ color: '#dc3545' }}>({unreadCount})</span>}
          </h3>
          <div
            style={{
              fontSize: '12px',
              color: '#666',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '4px',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isConnected ? '#28a745' : isConnecting ? '#ffc107' : '#dc3545',
              }}
            ></div>
            <span>{isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}</span>
            {onlineUsers.size > 0 && (
              <span style={{ marginLeft: '8px' }}>👥 {onlineUsers.size} online</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isConnected && (
            <button
              onClick={handleReconnect}
              disabled={isConnecting}
              style={{
                padding: '6px 12px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: isConnecting ? 'not-allowed' : 'pointer',
                opacity: isConnecting ? 0.6 : 1,
              }}
            >
              {isConnecting ? '⏳' : '🔄'}
            </button>
          )}
        </div>
      </div>

      {/* Connection Error */}
      {connectionError && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            fontSize: '12px',
            borderBottom: '1px solid #f5c6cb',
          }}
        >
          ⚠️ {connectionError}
        </div>
      )}

      {/* Messages Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: '#666',
              fontStyle: 'italic',
              marginTop: '40px',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
            <div>No messages yet.</div>
            <div style={{ fontSize: '14px', marginTop: '8px' }}>Start the conversation!</div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.isOwn ? 'flex-end' : 'flex-start',
                marginBottom: '8px',
              }}
            >
              <div
                style={{
                  maxWidth: '75%',
                  padding: '10px 14px',
                  borderRadius: msg.isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  backgroundColor: msg.isOwn ? '#007bff' : '#f1f3f4',
                  color: msg.isOwn ? 'white' : '#333',
                  fontSize: '14px',
                  lineHeight: '1.4',
                  wordBreak: 'break-word',
                }}
              >
                {!msg.isOwn && (
                  <div
                    style={{
                      fontSize: '12px',
                      opacity: 0.8,
                      marginBottom: '4px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {msg.ext?.isCreator && <span>👑</span>}
                    {msg.senderId}
                  </div>
                )}

                {msg.type === 'text' && (
                  <div dangerouslySetInnerHTML={{ 
                    __html: DOMPurify.sanitize(msg.text, { 
                      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'], 
                      ALLOWED_ATTR: [] 
                    }) 
                  }} />
                )}

                {msg.type === 'image' && (
                  <div>
                    <img
                      src={msg.imageUrl}
                      alt="Shared media"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '200px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                      onClick={() => window.open(msg.imageUrl, '_blank')}
                    />
                  </div>
                )}

                {msg.type === 'file' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                    }}
                  >
                    <span>📁</span>
                    <a
                      href={msg.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: msg.isOwn ? 'white' : '#007bff',
                        textDecoration: 'none',
                      }}
                    >
                      {msg.fileName}
                    </a>
                  </div>
                )}

                <div
                  style={{
                    fontSize: '10px',
                    opacity: 0.7,
                    marginTop: '4px',
                    textAlign: 'right',
                  }}
                >
                  {formatTimestamp(msg.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}

        {typingUsers.size > 0 && (
          <div
            style={{
              fontSize: '12px',
              color: '#666',
              fontStyle: 'italic',
              padding: '8px 12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '12px',
              alignSelf: 'flex-start',
            }}
          >
            {getTypingText()}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div
        style={{
          padding: '16px',
          backgroundColor: '#f8f9fa',
          borderTop: '1px solid #dee2e6',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '8px' }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files[0] && handleSendImage(e.target.files[0])}
            style={{ display: 'none' }}
            id="image-input"
          />
          <label
            htmlFor="image-input"
            style={{
              padding: '8px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isConnected ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              opacity: isConnected ? 1 : 0.6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '36px',
            }}
          >
            📷
          </label>

          <input
            type="file"
            onChange={(e) => e.target.files[0] && handleSendFile(e.target.files[0])}
            style={{ display: 'none' }}
            id="file-input"
          />
          <label
            htmlFor="file-input"
            style={{
              padding: '8px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isConnected ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              opacity: isConnected ? 1 : 0.6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '36px',
            }}
          >
            📁
          </label>

          <textarea
            value={message}
            onChange={(e) => {
              // Sanitize input to prevent XSS
              const sanitizedValue = DOMPurify.sanitize(e.target.value, { 
                ALLOWED_TAGS: [], 
                ALLOWED_ATTR: [] 
              });
              setMessage(sanitizedValue);
            }}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? 'Type a message...' : 'Connecting to chat...'}
            disabled={!isConnected}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: '1px solid #ddd',
              borderRadius: '20px',
              fontSize: '14px',
              resize: 'none',
              minHeight: '20px',
              maxHeight: '80px',
              backgroundColor: !isConnected ? '#f8f9fa' : '#fff',
              outline: 'none',
              fontFamily: 'inherit',
            }}
            rows={1}
          />

          <button
            onClick={handleSendMessage}
            disabled={!isConnected || !message.trim()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              cursor: (!isConnected || !message.trim()) ? 'not-allowed' : 'pointer',
              opacity: (!isConnected || !message.trim()) ? 0.6 : 1,
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Send
          </button>
        </div>
      </div>

      {/* Expandable Logs */}
      <details
        style={{
          backgroundColor: '#f8f9fa',
          borderTop: '1px solid #dee2e6',
        }}
      >
        <summary
          style={{
            padding: '10px 16px',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#666',
            fontWeight: '500',
          }}
        >
          📋 Chat Logs ({logs.length})
        </summary>
        <div
          style={{
            maxHeight: '150px',
            overflowY: 'auto',
            padding: '12px 16px',
            backgroundColor: '#fff',
            fontSize: '11px',
            borderTop: '1px solid #dee2e6',
          }}
        >
          {logs.map((log) => (
            <div
              key={log.id}
              style={{
                marginBottom: '4px',
                padding: '2px 0',
                color:
                  log.type === 'error'
                    ? '#dc3545'
                    : log.type === 'success'
                    ? '#28a745'
                    : log.type === 'warning'
                    ? '#ffc107'
                    : '#666',
              }}
            >
              <span style={{ color: '#999' }}>[{log.timestamp}]</span> {log.message}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
};

export default Chat;