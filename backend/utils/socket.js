const { Server } = require('socket.io');
const { verifySupabaseToken } = require('./supabase-admin');

let io = null;
const activeStreams = new Map(); // Track active streams
const userSockets = new Map(); // Track user socket connections
const userPresence = new Map(); // Track user online status
const typingUsers = new Map(); // Track typing users per channel

// Initialize Socket.io
const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    },
    path: '/socket.io/'
  });

  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      // Verify Supabase token
      const mockReq = { headers: { authorization: `Bearer ${token}` } };
      const mockRes = {};
      const mockNext = (err) => {
        if (err) throw err;
      };
      
      await verifySupabaseToken(mockReq, mockRes, mockNext);
      socket.userId = mockReq.user.id;
      socket.userEmail = mockReq.user.email;
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);
    
    // Track user socket
    userSockets.set(socket.userId, socket.id);
    
    // Update user presence
    userPresence.set(socket.userId, {
      status: 'online',
      lastSeen: Date.now(),
      socketId: socket.id
    });

    // Join user's personal room for direct messages
    socket.join(`user:${socket.userId}`);
    
    // Notify others about user coming online
    socket.broadcast.emit('user-presence', {
      userId: socket.userId,
      status: 'online',
      lastSeen: Date.now()
    });

    // Handle joining a stream
    socket.on('join-stream', (streamId) => {
      socket.join(`stream:${streamId}`);
      
      // Update viewer count
      if (!activeStreams.has(streamId)) {
        activeStreams.set(streamId, new Set());
      }
      activeStreams.get(streamId).add(socket.userId);
      
      // Emit updated viewer count
      const viewerCount = activeStreams.get(streamId).size;
      io.to(`stream:${streamId}`).emit('viewer-count', {
        streamId,
        count: viewerCount
      });
      
      console.log(`User ${socket.userId} joined stream ${streamId}. Viewers: ${viewerCount}`);
    });

    // Handle leaving a stream
    socket.on('leave-stream', (streamId) => {
      socket.leave(`stream:${streamId}`);
      
      if (activeStreams.has(streamId)) {
        activeStreams.get(streamId).delete(socket.userId);
        const viewerCount = activeStreams.get(streamId).size;
        
        // Clean up if no viewers
        if (viewerCount === 0) {
          activeStreams.delete(streamId);
        } else {
          io.to(`stream:${streamId}`).emit('viewer-count', {
            streamId,
            count: viewerCount
          });
        }
        
        console.log(`User ${socket.userId} left stream ${streamId}. Viewers: ${viewerCount}`);
      }
    });

    // Handle stream analytics updates
    socket.on('update-stream-analytics', (data) => {
      if (data.streamId) {
        io.to(`stream:${data.streamId}`).emit('stream-analytics', data);
      }
    });
    
    // Handle presence updates
    socket.on('update-presence', (status) => {
      const validStatuses = ['online', 'away', 'busy', 'offline'];
      if (!validStatuses.includes(status)) return;
      
      userPresence.set(socket.userId, {
        status,
        lastSeen: Date.now(),
        socketId: socket.id
      });
      
      // Notify all connected users about presence change
      io.emit('user-presence', {
        userId: socket.userId,
        status,
        lastSeen: Date.now()
      });
    });
    
    // Handle typing indicators
    socket.on('typing-start', ({ channel, recipientId }) => {
      if (!channel) return;
      
      // Track typing user
      if (!typingUsers.has(channel)) {
        typingUsers.set(channel, new Set());
      }
      typingUsers.get(channel).add(socket.userId);
      
      // Notify recipient or channel members
      if (recipientId) {
        // Direct message typing
        io.to(`user:${recipientId}`).emit('user-typing', {
          channel,
          userId: socket.userId,
          isTyping: true
        });
      } else {
        // Stream/group chat typing
        socket.to(`stream:${channel}`).emit('user-typing', {
          channel,
          userId: socket.userId,
          isTyping: true
        });
      }
    });
    
    socket.on('typing-stop', ({ channel, recipientId }) => {
      if (!channel) return;
      
      // Remove from typing users
      if (typingUsers.has(channel)) {
        typingUsers.get(channel).delete(socket.userId);
        if (typingUsers.get(channel).size === 0) {
          typingUsers.delete(channel);
        }
      }
      
      // Notify recipient or channel members
      if (recipientId) {
        io.to(`user:${recipientId}`).emit('user-typing', {
          channel,
          userId: socket.userId,
          isTyping: false
        });
      } else {
        socket.to(`stream:${channel}`).emit('user-typing', {
          channel,
          userId: socket.userId,
          isTyping: false
        });
      }
    });
    
    // Handle request for user presence
    socket.on('get-user-presence', (userIds) => {
      if (!Array.isArray(userIds)) return;
      
      const presenceData = userIds.map(userId => ({
        userId,
        ...(userPresence.get(userId) || { status: 'offline', lastSeen: null })
      }));
      
      socket.emit('user-presence-list', presenceData);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
      
      // Update user presence to offline
      userPresence.set(socket.userId, {
        status: 'offline',
        lastSeen: Date.now(),
        socketId: null
      });
      
      // Notify others about user going offline
      socket.broadcast.emit('user-presence', {
        userId: socket.userId,
        status: 'offline',
        lastSeen: Date.now()
      });
      
      // Clear typing indicators for this user
      typingUsers.forEach((users, channel) => {
        if (users.has(socket.userId)) {
          users.delete(socket.userId);
          io.to(`stream:${channel}`).emit('user-typing', {
            channel,
            userId: socket.userId,
            isTyping: false
          });
        }
      });
      
      // Remove from all streams
      activeStreams.forEach((viewers, streamId) => {
        if (viewers.has(socket.userId)) {
          viewers.delete(socket.userId);
          const viewerCount = viewers.size;
          
          if (viewerCount === 0) {
            activeStreams.delete(streamId);
          } else {
            io.to(`stream:${streamId}`).emit('viewer-count', {
              streamId,
              count: viewerCount
            });
          }
        }
      });
      
      // Remove from user sockets
      userSockets.delete(socket.userId);
    });
  });

  console.log('Socket.io initialized successfully');
  return io;
};

// Emit to specific user
const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

// Emit to stream
const emitToStream = (streamId, event, data) => {
  if (io) {
    io.to(`stream:${streamId}`).emit(event, data);
  }
};

// Broadcast to all connected users
const broadcast = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

// Update user token balance
const updateUserBalance = (userId, newBalance) => {
  emitToUser(userId, 'balance-updated', {
    balance: newBalance,
    timestamp: Date.now()
  });
};

// Send system notification
const sendNotification = (userId, notification) => {
  emitToUser(userId, 'notification', {
    id: Date.now(),
    ...notification,
    timestamp: Date.now()
  });
};

// Get stream viewer count
const getStreamViewerCount = (streamId) => {
  return activeStreams.has(streamId) ? activeStreams.get(streamId).size : 0;
};

// Stream ended
const handleStreamEnd = (streamId) => {
  if (activeStreams.has(streamId)) {
    io.to(`stream:${streamId}`).emit('stream-ended', { streamId });
    activeStreams.delete(streamId);
  }
};

// Get user presence
const getUserPresence = (userId) => {
  return userPresence.get(userId) || { status: 'offline', lastSeen: null };
};

// Get multiple users' presence
const getUsersPresence = (userIds) => {
  return userIds.map(userId => ({
    userId,
    ...(userPresence.get(userId) || { status: 'offline', lastSeen: null })
  }));
};

// Update user presence
const updateUserPresence = (userId, status) => {
  if (userSockets.has(userId)) {
    userPresence.set(userId, {
      status,
      lastSeen: Date.now(),
      socketId: userSockets.get(userId)
    });
    
    if (io) {
      io.emit('user-presence', {
        userId,
        status,
        lastSeen: Date.now()
      });
    }
  }
};

module.exports = {
  initializeSocket,
  emitToUser,
  emitToStream,
  broadcast,
  updateUserBalance,
  sendNotification,
  getStreamViewerCount,
  handleStreamEnd,
  getUserPresence,
  getUsersPresence,
  updateUserPresence,
  getIO: () => io
};