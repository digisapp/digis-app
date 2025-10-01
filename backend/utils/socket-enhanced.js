const { Server } = require('socket.io');
const { verifySupabaseToken } = require('./supabase-admin');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const { 
  withValidation, 
  handleSocketError, 
  handleRateLimit,
  ErrorCodes,
  sanitizeOutput
} = require('./websocket-validator');

let io = null;
const activeStreams = new Map(); // Track active streams
const userSockets = new Map(); // Track user socket connections
const userPresence = new Map(); // Track user online status
const typingUsers = new Map(); // Track typing users per channel

// Retry utility for network resilience
const retry = async (fn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.warn(`Retry ${i + 1}/${maxRetries}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
};

// Enhanced rate limiters with different tiers
const rateLimiters = {
  typing: new RateLimiterMemory({
    points: 10, // 10 typing events
    duration: 1, // per second
    blockDuration: 5, // block for 5 seconds
  }),
  stream: new RateLimiterMemory({
    points: 5, // 5 stream join/leave
    duration: 10, // per 10 seconds
    blockDuration: 30,
  }),
  presence: new RateLimiterMemory({
    points: 20, // 20 presence updates
    duration: 60, // per minute
    blockDuration: 60,
  }),
  chat: new RateLimiterMemory({
    points: 30, // 30 chat messages
    duration: 60, // per minute
    blockDuration: 120,
  }),
  reaction: new RateLimiterMemory({
    points: 60, // 60 reactions
    duration: 60, // per minute
    blockDuration: 60,
  }),
  poll: new RateLimiterMemory({
    points: 3, // 3 polls
    duration: 300, // per 5 minutes
    blockDuration: 300,
  }),
  general: new RateLimiterMemory({
    points: 100, // 100 general events
    duration: 60, // per minute
    blockDuration: 120,
  })
};

// Initialize Socket.io with enhanced configuration
const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST']
    },
    path: '/socket.io/',
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    maxHttpBufferSize: 1e6, // 1MB
    connectTimeout: 10000
  });

  // Enhanced authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        console.error('Socket connection attempt without token');
        return next(new Error('Authentication required'));
      }

      // Use retry logic for token verification
      const user = await retry(async () => {
        const mockReq = { 
          headers: { 
            authorization: `Bearer ${token}`,
            'x-forwarded-for': socket.handshake.address 
          } 
        };
        const mockRes = {};
        let authError = null;
        
        const mockNext = (err) => {
          if (err) {
            authError = err;
          }
        };
        
        await verifySupabaseToken(mockReq, mockRes, mockNext);
        
        if (authError) {
          throw authError;
        }
        
        if (!mockReq.user || !mockReq.user.supabase_id) {
          throw new Error('Invalid user data from token');
        }
        
        return mockReq.user;
      });

      // Attach user info to socket
      socket.userId = user.supabase_id;
      socket.userEmail = user.email;
      socket.userData = user;
      
      console.log(`Socket authenticated for user: ${user.supabase_id}`);
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId} from ${socket.handshake.address}`);
    
    // Track user socket
    userSockets.set(socket.userId, {
      socketId: socket.id,
      connectedAt: Date.now(),
      ip: socket.handshake.address
    });
    
    // Update user presence
    userPresence.set(socket.userId, {
      status: 'online',
      lastSeen: Date.now(),
      socketId: socket.id
    });

    // Join user's personal room
    socket.join(`user:${socket.userId}`);
    
    // Notify others about user coming online
    socket.broadcast.emit('user-presence', sanitizeOutput({
      userId: socket.userId,
      status: 'online',
      lastSeen: Date.now()
    }));

    // Send connection success to client
    socket.emit('connection-success', {
      userId: socket.userId,
      serverTime: Date.now()
    });

    // Stream events with validation
    socket.on('join-stream', withValidation('join-stream', async (data) => {
      try {
        await rateLimiters.stream.consume(socket.userId);
        
        const { streamId } = data;
        
        // Leave previous stream if any
        socket.rooms.forEach(room => {
          if (room.startsWith('stream:') && room !== `stream:${streamId}`) {
            socket.leave(room);
          }
        });
        
        socket.join(`stream:${streamId}`);
        
        // Update active streams
        if (!activeStreams.has(streamId)) {
          activeStreams.set(streamId, new Set());
        }
        activeStreams.get(streamId).add(socket.userId);
        
        // Notify others in stream
        socket.to(`stream:${streamId}`).emit('user-joined-stream', sanitizeOutput({
          userId: socket.userId,
          username: socket.userData.username,
          timestamp: Date.now()
        }));
        
        // Send current viewer count
        const viewerCount = activeStreams.get(streamId).size;
        io.to(`stream:${streamId}`).emit('viewer-count-updated', {
          streamId,
          count: viewerCount
        });
        
        console.log(`User ${socket.userId} joined stream ${streamId}`);
      } catch (error) {
        if (error.name === 'RateLimiterRes') {
          handleRateLimit(socket, 'join-stream');
        } else {
          throw error;
        }
      }
    }));

    socket.on('leave-stream', withValidation('leave-stream', async (data) => {
      const { streamId } = data;
      
      socket.leave(`stream:${streamId}`);
      
      // Update active streams
      if (activeStreams.has(streamId)) {
        activeStreams.get(streamId).delete(socket.userId);
        if (activeStreams.get(streamId).size === 0) {
          activeStreams.delete(streamId);
        }
      }
      
      // Notify others
      socket.to(`stream:${streamId}`).emit('user-left-stream', sanitizeOutput({
        userId: socket.userId,
        timestamp: Date.now()
      }));
      
      // Send updated viewer count
      const viewerCount = activeStreams.get(streamId)?.size || 0;
      io.to(`stream:${streamId}`).emit('viewer-count-updated', {
        streamId,
        count: viewerCount
      });
    }));

    // Chat events with validation
    socket.on('stream-chat', withValidation('stream-chat', async (data) => {
      try {
        await rateLimiters.chat.consume(socket.userId);
        
        const { streamId, message, type = 'chat' } = data;
        
        // Ensure user is in the stream
        if (!socket.rooms.has(`stream:${streamId}`)) {
          throw new Error('You must join the stream first');
        }
        
        const chatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: socket.userId,
          username: socket.userData.username,
          message: message, // Already sanitized by validator
          type,
          timestamp: Date.now()
        };
        
        io.to(`stream:${streamId}`).emit('stream-chat-message', sanitizeOutput(chatMessage));
      } catch (error) {
        if (error.name === 'RateLimiterRes') {
          handleRateLimit(socket, 'stream-chat');
        } else {
          throw error;
        }
      }
    }));

    // Reaction events with validation
    socket.on('send_reaction', withValidation('send_reaction', async (data) => {
      try {
        await rateLimiters.reaction.consume(socket.userId);
        
        const { channelId, reaction, count, targetType } = data;
        
        io.to(`stream:${channelId}`).emit('reaction_sent', sanitizeOutput({
          channelId,
          reaction,
          count,
          targetType,
          senderId: socket.userId,
          senderUsername: socket.userData.username,
          timestamp: Date.now()
        }));
      } catch (error) {
        if (error.name === 'RateLimiterRes') {
          handleRateLimit(socket, 'send_reaction');
        } else {
          throw error;
        }
      }
    }));

    socket.on('send_reaction_burst', withValidation('send_reaction_burst', async (data) => {
      try {
        await rateLimiters.reaction.consume(socket.userId, data.count);
        
        const { channelId, reaction, count, targetType } = data;
        
        io.to(`stream:${channelId}`).emit('reaction_burst', sanitizeOutput({
          channelId,
          reaction,
          count,
          targetType,
          senderId: socket.userId,
          senderUsername: socket.userData.username,
          timestamp: Date.now()
        }));
      } catch (error) {
        if (error.name === 'RateLimiterRes') {
          handleRateLimit(socket, 'send_reaction_burst');
        } else {
          throw error;
        }
      }
    }));

    // Poll events with validation
    socket.on('create_poll', withValidation('create_poll', async (data) => {
      try {
        await rateLimiters.poll.consume(socket.userId);
        
        const { channelId, question, options, duration } = data;
        
        // Verify user is creator
        const { pool } = require('./db');
        const streamQuery = await pool.query(
          'SELECT creator_id FROM streams WHERE stream_id = $1 AND creator_id = $2',
          [channelId, socket.userId]
        );
        
        if (streamQuery.rows.length === 0) {
          throw new Error('Only the stream creator can create polls');
        }
        
        // Create poll in database
        const pollId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = new Date(Date.now() + duration * 1000);
        
        const poll = {
          pollId,
          channelId,
          question,
          options: options.map((opt, index) => ({
            id: index,
            text: opt,
            votes: 0
          })),
          totalVotes: 0,
          duration,
          expiresAt,
          status: 'active',
          createdBy: socket.userId,
          createdAt: Date.now()
        };
        
        // Store poll in database (implement this)
        // await storePoll(poll);
        
        io.to(`stream:${channelId}`).emit('poll_created', sanitizeOutput({ poll }));
      } catch (error) {
        if (error.name === 'RateLimiterRes') {
          handleRateLimit(socket, 'create_poll');
        } else {
          throw error;
        }
      }
    }));

    socket.on('vote_poll', withValidation('vote_poll', async (data) => {
      try {
        await rateLimiters.general.consume(socket.userId);
        
        const { pollId, optionId } = data;
        
        // Implement vote logic here
        // Check if user already voted, update poll results, etc.
        
        // For now, emit the vote update
        const channelId = 'channel_from_poll'; // Get from poll data
        
        io.to(`stream:${channelId}`).emit('poll_updated', sanitizeOutput({
          pollId,
          optionId,
          voterId: socket.userId,
          timestamp: Date.now()
        }));
      } catch (error) {
        if (error.name === 'RateLimiterRes') {
          handleRateLimit(socket, 'vote_poll');
        } else {
          throw error;
        }
      }
    }));

    // Presence events with validation
    socket.on('update-presence', withValidation('update-presence', async (data) => {
      try {
        await rateLimiters.presence.consume(socket.userId);
        
        const { status, customStatus } = data;
        
        userPresence.set(socket.userId, {
          status,
          customStatus,
          lastSeen: Date.now(),
          socketId: socket.id
        });
        
        // Notify relevant users
        socket.broadcast.emit('user-presence-updated', sanitizeOutput({
          userId: socket.userId,
          status,
          customStatus,
          lastSeen: Date.now()
        }));
      } catch (error) {
        if (error.name === 'RateLimiterRes') {
          handleRateLimit(socket, 'update-presence');
        } else {
          throw error;
        }
      }
    }));

    // Typing indicators with validation
    socket.on('typing-start', withValidation('typing-start', async (data) => {
      try {
        await rateLimiters.typing.consume(socket.userId);
        
        const { channel } = data;
        
        if (!typingUsers.has(channel)) {
          typingUsers.set(channel, new Set());
        }
        typingUsers.get(channel).add(socket.userId);
        
        socket.to(`stream:${channel}`).emit('user-typing', sanitizeOutput({
          userId: socket.userId,
          username: socket.userData.username,
          channel,
          isTyping: true
        }));
        
        // Auto-stop typing after 10 seconds
        setTimeout(() => {
          if (typingUsers.has(channel)) {
            typingUsers.get(channel).delete(socket.userId);
            socket.to(`stream:${channel}`).emit('user-typing', sanitizeOutput({
              userId: socket.userId,
              username: socket.userData.username,
              channel,
              isTyping: false
            }));
          }
        }, 10000);
      } catch (error) {
        if (error.name === 'RateLimiterRes') {
          handleRateLimit(socket, 'typing-start');
        } else {
          throw error;
        }
      }
    }));

    socket.on('typing-stop', withValidation('typing-stop', async (data) => {
      const { channel } = data;
      
      if (typingUsers.has(channel)) {
        typingUsers.get(channel).delete(socket.userId);
      }
      
      socket.to(`stream:${channel}`).emit('user-typing', sanitizeOutput({
        userId: socket.userId,
        username: socket.userData.username,
        channel,
        isTyping: false
      }));
    }));

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${socket.userId}, reason: ${reason}`);
      
      // Remove from user sockets
      userSockets.delete(socket.userId);
      
      // Update presence
      userPresence.set(socket.userId, {
        status: 'offline',
        lastSeen: Date.now()
      });
      
      // Remove from all streams
      activeStreams.forEach((users, streamId) => {
        if (users.has(socket.userId)) {
          users.delete(socket.userId);
          
          // Notify others in stream
          socket.to(`stream:${streamId}`).emit('user-left-stream', sanitizeOutput({
            userId: socket.userId,
            timestamp: Date.now()
          }));
          
          // Update viewer count
          io.to(`stream:${streamId}`).emit('viewer-count-updated', {
            streamId,
            count: users.size
          });
        }
      });
      
      // Remove from typing users
      typingUsers.forEach((users, channel) => {
        if (users.has(socket.userId)) {
          users.delete(socket.userId);
          socket.to(`stream:${channel}`).emit('user-typing', sanitizeOutput({
            userId: socket.userId,
            channel,
            isTyping: false
          }));
        }
      });
      
      // Notify about offline status
      socket.broadcast.emit('user-presence', sanitizeOutput({
        userId: socket.userId,
        status: 'offline',
        lastSeen: Date.now()
      }));
    });

    // Error handling
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
      handleSocketError(socket, error);
    });
  });

  // Periodic cleanup
  setInterval(() => {
    // Clean up stale presence data
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    userPresence.forEach((presence, userId) => {
      if (presence.status === 'offline' && now - presence.lastSeen > staleThreshold) {
        userPresence.delete(userId);
      }
    });
    
    // Clean up empty typing channels
    typingUsers.forEach((users, channel) => {
      if (users.size === 0) {
        typingUsers.delete(channel);
      }
    });
  }, 60000); // Every minute

  console.log('Socket.io server initialized with enhanced validation');
  return io;
};

// Helper functions
const emitToUser = (userId, event, data) => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, sanitizeOutput(data));
};

const emitToStream = (streamId, event, data) => {
  if (!io) return;
  io.to(`stream:${streamId}`).emit(event, sanitizeOutput(data));
};

const getActiveStreams = () => {
  const streams = [];
  activeStreams.forEach((users, streamId) => {
    streams.push({
      streamId,
      viewerCount: users.size,
      viewers: Array.from(users)
    });
  });
  return streams;
};

const getUserPresence = (userId) => {
  return userPresence.get(userId) || { status: 'offline', lastSeen: null };
};

const getStreamViewers = (streamId) => {
  return Array.from(activeStreams.get(streamId) || []);
};

const isUserInStream = (userId, streamId) => {
  return activeStreams.get(streamId)?.has(userId) || false;
};

module.exports = {
  initializeSocket,
  emitToUser,
  emitToStream,
  getActiveStreams,
  getUserPresence,
  getStreamViewers,
  isUserInStream,
  io: () => io
};