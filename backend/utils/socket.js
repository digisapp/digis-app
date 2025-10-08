const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { verifySupabaseToken } = require('./supabase-admin');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const redis = require('./redis');

let io = null;
const activeStreams = new Map(); // Track active streams
const userSockets = new Map(); // Track user socket connections
const userPresence = new Map(); // Track user online status
const typingUsers = new Map(); // Track typing users per channel

// Create Redis pub/sub clients for Socket.io adapter
let pubClient, subClient;
try {
  // Check if we have Redis configured
  if (redis && redis.duplicate) {
    pubClient = redis.duplicate();
    subClient = redis.duplicate();

    // Handle connection events
    pubClient.on('error', (err) => {
      console.error('Socket.io Redis pub client error:', err);
    });

    subClient.on('error', (err) => {
      console.error('Socket.io Redis sub client error:', err);
    });

    console.log('Redis adapter initialized for Socket.io');
  } else {
    console.log('Redis not available, using in-memory Socket.io adapter');
  }
} catch (error) {
  console.warn('Failed to initialize Redis adapter:', error.message);
  console.log('Falling back to in-memory Socket.io adapter');
}

// Retry utility for network resilience
const retry = async (fn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.warn(`Retry ${i + 1}/${maxRetries} for Supabase token: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
};

// Rate limiters for different socket events
const rateLimiters = {
  typing: new RateLimiterMemory({
    points: 10, // 10 typing events
    duration: 1, // per second
  }),
  stream: new RateLimiterMemory({
    points: 5, // 5 stream join/leave
    duration: 10, // per 10 seconds
  }),
  presence: new RateLimiterMemory({
    points: 20, // 20 presence updates
    duration: 60, // per minute
  }),
  general: new RateLimiterMemory({
    points: 100, // 100 general events
    duration: 60, // per minute
  })
};

// Enhanced error messages for better debugging
const ErrorMessages = {
  NO_TOKEN: 'Authentication required. Please provide a valid token.',
  INVALID_TOKEN: 'Invalid authentication token. Please sign in again.',
  TOKEN_EXPIRED: 'Authentication token expired. Please refresh your session.',
  RATE_LIMIT: 'Too many requests. Please slow down.',
  INVALID_INPUT: 'Invalid input data provided.',
  STREAM_NOT_FOUND: 'Stream not found or has ended.',
  SERVER_ERROR: 'Server error. Please try again later.'
};

// Input validation helpers
const validators = {
  streamId: (id) => {
    return id && typeof id === 'string' && id.length > 0 && id.length < 100;
  },
  userId: (id) => {
    return id && typeof id === 'string' && 
           /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  },
  status: (status) => {
    const validStatuses = ['online', 'away', 'busy', 'offline'];
    return validStatuses.includes(status);
  },
  channel: (channel) => {
    return channel && typeof channel === 'string' && channel.length > 0 && channel.length < 100;
  },
  userIds: (ids) => {
    return Array.isArray(ids) && ids.length <= 100 && 
           ids.every(id => validators.userId(id));
  }
};

// Initialize Socket.io with enhanced configuration and Redis adapter
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
    allowEIO3: true // Support older Socket.io clients
  });

  // Set up Redis adapter for horizontal scaling if Redis is available
  if (pubClient && subClient) {
    Promise.all([pubClient.connect(), subClient.connect()])
      .then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        console.log('Socket.io using Redis adapter for horizontal scaling');
      })
      .catch((err) => {
        console.error('Failed to connect Redis adapter:', err);
        console.log('Socket.io using default in-memory adapter');
      });
  }

  // Enhanced authentication middleware with retry
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      // Allow connection without token but mark as anonymous
      if (!token || token === '') {
        console.log('Socket connection attempt without token - allowing as anonymous');
        socket.userId = 'anonymous';
        socket.userEmail = null;
        socket.userData = { anonymous: true };
        return next();
      }

      // Use retry logic for token verification
      const user = await retry(async () => {
        const mockReq = { 
          headers: { 
            authorization: `Bearer ${token}`,
            'x-forwarded-for': socket.handshake.address 
          } 
        };
        const mockRes = {
          status: (code) => ({
            json: (data) => {
              authError = new Error(data.error || 'Authentication failed');
              authError.statusCode = code;
              return mockRes;
            }
          })
        };
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
        
        if (!mockReq.user || !mockReq.user.id) {
          throw new Error('Invalid user data from token');
        }
        
        // Ensure supabase_id is available
        if (!mockReq.user.supabase_id && mockReq.user.uid) {
          mockReq.user.supabase_id = mockReq.user.uid;
        }
        return mockReq.user;
      });

      // Attach user info to socket (use supabase_id for consistency)
      socket.userId = user.supabase_id || user.id; // Use supabase_id consistently
      socket.userEmail = user.email;
      socket.userData = user;
      
      console.log(`Socket authenticated for user: ${user.supabase_id || user.id}`);
      next();
    } catch (error) {
      // In development, allow connections to fail gracefully without verbose errors
      if (process.env.NODE_ENV !== 'production') {
        console.log('Socket auth failed (dev mode) - allowing anonymous connection');
        socket.userId = 'anonymous';
        socket.userEmail = null;
        socket.userData = { anonymous: true };
        return next();
      }

      console.error('Socket authentication error:', error);

      // Provide specific error messages
      if (error.message?.includes('expired')) {
        next(new Error(ErrorMessages.TOKEN_EXPIRED));
      } else if (error.message?.includes('invalid')) {
        next(new Error(ErrorMessages.INVALID_TOKEN));
      } else {
        next(new Error(ErrorMessages.SERVER_ERROR));
      }
    }
  });

  // Connection handler with enhanced error handling
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId} from ${socket.handshake.address}`);
    
    // Track user socket with additional metadata
    userSockets.set(socket.userId, {
      socketId: socket.id,
      connectedAt: Date.now(),
      ip: socket.handshake.address
    });
    
    // Update user presence with more details
    userPresence.set(socket.userId, {
      status: 'online',
      lastSeen: Date.now(),
      socketId: socket.id,
      device: socket.handshake.headers['user-agent']
    });

    // Join user's personal room for direct messages
    socket.join(`user:${socket.userId}`);
    
    // Notify others about user coming online
    socket.broadcast.emit('user-presence', {
      userId: socket.userId,
      status: 'online',
      lastSeen: Date.now()
    });

    // Send connection success to client
    socket.emit('connection-success', {
      userId: socket.userId,
      serverTime: Date.now()
    });

    // Handle joining a stream with validation and rate limiting
    socket.on('join-stream', async (streamId) => {
      try {
        // Rate limiting
        await rateLimiters.stream.consume(socket.userId);
        
        // Validate input
        if (!validators.streamId(streamId)) {
          socket.emit('error', { 
            event: 'join-stream',
            message: ErrorMessages.INVALID_INPUT,
            details: 'Invalid stream ID format'
          });
          return;
        }
        
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
        
        // Confirm join to client
        socket.emit('stream-joined', {
          streamId,
          viewerCount,
          timestamp: Date.now()
        });
        
        console.log(`User ${socket.userId} joined stream ${streamId}. Viewers: ${viewerCount}`);
      } catch (error) {
        if (error.remainingPoints !== undefined) {
          socket.emit('error', { 
            event: 'join-stream',
            message: ErrorMessages.RATE_LIMIT,
            retryAfter: Math.round(error.msBeforeNext / 1000) || 1
          });
        } else {
          console.error('Join stream error:', error);
          socket.emit('error', { 
            event: 'join-stream',
            message: ErrorMessages.SERVER_ERROR 
          });
        }
      }
    });

    // Handle leaving a stream with validation
    socket.on('leave-stream', async (streamId) => {
      try {
        // Rate limiting
        await rateLimiters.stream.consume(socket.userId);
        
        // Validate input
        if (!validators.streamId(streamId)) {
          socket.emit('error', { 
            event: 'leave-stream',
            message: ErrorMessages.INVALID_INPUT 
          });
          return;
        }
        
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
          
          // Confirm leave to client
          socket.emit('stream-left', {
            streamId,
            timestamp: Date.now()
          });
          
          console.log(`User ${socket.userId} left stream ${streamId}. Viewers: ${viewerCount}`);
        }
      } catch (error) {
        if (error.remainingPoints !== undefined) {
          socket.emit('error', { 
            event: 'leave-stream',
            message: ErrorMessages.RATE_LIMIT,
            retryAfter: Math.round(error.msBeforeNext / 1000) || 1
          });
        } else {
          console.error('Leave stream error:', error);
          socket.emit('error', { 
            event: 'leave-stream',
            message: ErrorMessages.SERVER_ERROR 
          });
        }
      }
    });

    // Handle stream analytics updates with validation
    socket.on('update-stream-analytics', async (data) => {
      try {
        await rateLimiters.general.consume(socket.userId);
        
        if (!data || !validators.streamId(data.streamId)) {
          socket.emit('error', { 
            event: 'update-stream-analytics',
            message: ErrorMessages.INVALID_INPUT 
          });
          return;
        }
        
        // Sanitize analytics data
        const sanitizedData = {
          streamId: data.streamId,
          timestamp: Date.now(),
          viewerCount: activeStreams.get(data.streamId)?.size || 0,
          // Add only allowed analytics fields
          ...(data.analytics && {
            likes: Number(data.analytics.likes) || 0,
            messages: Number(data.analytics.messages) || 0
          })
        };
        
        io.to(`stream:${data.streamId}`).emit('stream-analytics', sanitizedData);
      } catch (error) {
        if (error.remainingPoints !== undefined) {
          socket.emit('error', { 
            event: 'update-stream-analytics',
            message: ErrorMessages.RATE_LIMIT 
          });
        }
      }
    });
    
    // Handle presence updates with validation and rate limiting
    socket.on('update-presence', async (status) => {
      try {
        await rateLimiters.presence.consume(socket.userId);
        
        if (!validators.status(status)) {
          socket.emit('error', { 
            event: 'update-presence',
            message: ErrorMessages.INVALID_INPUT,
            details: 'Invalid status. Use: online, away, busy, or offline'
          });
          return;
        }
        
        userPresence.set(socket.userId, {
          status,
          lastSeen: Date.now(),
          socketId: socket.id,
          device: socket.handshake.headers['user-agent']
        });
        
        // Notify all connected users about presence change
        io.emit('user-presence', {
          userId: socket.userId,
          status,
          lastSeen: Date.now()
        });
        
        console.log(`User ${socket.userId} updated presence to: ${status}`);
      } catch (error) {
        if (error.remainingPoints !== undefined) {
          socket.emit('error', { 
            event: 'update-presence',
            message: ErrorMessages.RATE_LIMIT 
          });
        }
      }
    });
    
    // Handle typing indicators with rate limiting
    socket.on('typing-start', async ({ channel, recipientId }) => {
      try {
        await rateLimiters.typing.consume(socket.userId);
        
        if (!validators.channel(channel)) {
          socket.emit('error', { 
            event: 'typing-start',
            message: ErrorMessages.INVALID_INPUT 
          });
          return;
        }
        
        if (recipientId && !validators.userId(recipientId)) {
          socket.emit('error', { 
            event: 'typing-start',
            message: ErrorMessages.INVALID_INPUT,
            details: 'Invalid recipient ID'
          });
          return;
        }
        
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
      } catch (error) {
        if (error.remainingPoints !== undefined) {
          socket.emit('error', { 
            event: 'typing-start',
            message: ErrorMessages.RATE_LIMIT 
          });
        }
      }
    });
    
    socket.on('typing-stop', async ({ channel, recipientId }) => {
      try {
        await rateLimiters.typing.consume(socket.userId);
        
        if (!validators.channel(channel)) {
          return; // Silently ignore invalid stop typing
        }
        
        // Remove from typing users
        if (typingUsers.has(channel)) {
          typingUsers.get(channel).delete(socket.userId);
          if (typingUsers.get(channel).size === 0) {
            typingUsers.delete(channel);
          }
        }
        
        // Notify recipient or channel members
        if (recipientId && validators.userId(recipientId)) {
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
      } catch (error) {
        // Silently handle rate limit for stop typing
      }
    });
    
    // Handle request for user presence with validation
    socket.on('get-user-presence', async (userIds) => {
      try {
        await rateLimiters.general.consume(socket.userId);
        
        if (!validators.userIds(userIds)) {
          socket.emit('error', { 
            event: 'get-user-presence',
            message: ErrorMessages.INVALID_INPUT,
            details: 'Invalid user IDs. Provide an array of valid UUIDs (max 100)'
          });
          return;
        }
        
        const presenceData = userIds.map(userId => ({
          userId,
          ...(userPresence.get(userId) || { status: 'offline', lastSeen: null })
        }));
        
        socket.emit('user-presence-list', presenceData);
      } catch (error) {
        if (error.remainingPoints !== undefined) {
          socket.emit('error', { 
            event: 'get-user-presence',
            message: ErrorMessages.RATE_LIMIT 
          });
        }
      }
    });

    // Handle stream analytics events
    socket.on('stream-started', async (data) => {
      try {
        const { channel, streamId, creatorId, title, category } = data;
        
        if (!validators.channel(channel)) {
          socket.emit('error', { 
            event: 'stream-started',
            message: ErrorMessages.INVALID_INPUT 
          });
          return;
        }
        
        // Initialize stream analytics
        activeStreams.set(channel, new Set());
        
        console.log(`Stream started: ${channel} by ${creatorId}`);
        
        // Broadcast stream started event
        io.emit('stream-live', {
          channel,
          streamId,
          creatorId,
          title,
          category,
          startedAt: Date.now()
        });
      } catch (error) {
        console.error('Error starting stream:', error);
      }
    });
    
    socket.on('stream-ended', async (data) => {
      try {
        const { channel, streamId, stats } = data;
        
        if (activeStreams.has(channel)) {
          // Get final viewer count
          const finalViewerCount = activeStreams.get(channel).size;
          
          // Clean up stream data
          activeStreams.delete(channel);
          
          // Broadcast stream ended with final stats
          io.to(`stream:${channel}`).emit('stream-offline', {
            channel,
            streamId,
            finalStats: {
              ...stats,
              finalViewerCount
            },
            endedAt: Date.now()
          });
        }
        
        console.log(`Stream ended: ${channel}`);
      } catch (error) {
        console.error('Error ending stream:', error);
      }
    });
    
    socket.on('message-sent', async (data) => {
      try {
        const { channel, userId, messageLength, timestamp } = data;
        
        // Broadcast message event for analytics
        io.to(`stream:${channel}`).emit('message-sent', {
          channel,
          userId,
          messageLength,
          timestamp
        });
        
        // Update engagement metrics
        io.to(`stream:${channel}`).emit('engagement-update', {
          channel,
          messageCount: 1, // Increment by 1
          engagement: 10 // Engagement score
        });
      } catch (error) {
        console.error('Error tracking message:', error);
      }
    });
    
    socket.on('send-gift', async (data) => {
      try {
        const { channel, giftType, value, sender, timestamp } = data;
        
        // Broadcast gift event
        io.to(`stream:${channel}`).emit('gift-received', {
          channel,
          giftType,
          totalValue: value,
          sender,
          timestamp
        });
        
        // Update analytics
        io.to(`stream:${channel}`).emit('analytics-update', {
          channel,
          stats: {
            gifts: 1,
            revenue: value
          }
        });
      } catch (error) {
        console.error('Error sending gift:', error);
      }
    });
    
    socket.on('send-tip', async (data) => {
      try {
        const { channel, amount, message, sender, timestamp } = data;
        
        // Broadcast tip event
        io.to(`stream:${channel}`).emit('tip-received', {
          channel,
          amount,
          message,
          sender,
          timestamp
        });
        
        // Update analytics
        io.to(`stream:${channel}`).emit('analytics-update', {
          channel,
          stats: {
            tips: amount,
            revenue: amount
          }
        });
      } catch (error) {
        console.error('Error sending tip:', error);
      }
    });
    
    socket.on('viewer-joined', async (data) => {
      try {
        const { channel, userId, timestamp } = data;
        
        if (activeStreams.has(channel)) {
          activeStreams.get(channel).add(userId);
          
          const viewerCount = activeStreams.get(channel).size;
          
          // Broadcast updated viewer count
          io.to(`stream:${channel}`).emit('viewer-count', {
            channel,
            count: viewerCount,
            timestamp
          });
          
          io.to(`stream:${channel}`).emit('viewer-count-update', {
            channel,
            count: viewerCount
          });
        }
      } catch (error) {
        console.error('Error tracking viewer join:', error);
      }
    });
    
    // Handle gift sent event (legacy)
    socket.on('gift_sent', async (data) => {
      try {
        await rateLimiters.general.consume(socket.userId);
        
        const { channel, gift, sender, recipient } = data;
        
        // Validate input
        if (!channel || !gift || !sender || !recipient) {
          socket.emit('error', { 
            event: 'gift_sent',
            message: ErrorMessages.INVALID_INPUT 
          });
          return;
        }
        
        // Emit to channel for all participants to see
        io.to(`stream:${channel}`).emit('gift_received', {
          channel,
          gift,
          sender,
          recipient,
          timestamp: Date.now()
        });
        
        // Also emit to specific recipient if online
        if (recipient?.id && userSockets.has(recipient.id)) {
          io.to(`user:${recipient.id}`).emit('gift_received', {
            channel,
            gift,
            sender,
            recipient,
            timestamp: Date.now()
          });
        }
        
        console.log(`Gift sent in ${channel}:`, gift.name, 'from', sender.name);
      } catch (error) {
        if (error.remainingPoints !== undefined) {
          socket.emit('error', { 
            event: 'gift_sent',
            message: ErrorMessages.RATE_LIMIT 
          });
        }
      }
    });

    // Handle tip sent event
    socket.on('tip_sent', async (data) => {
      try {
        await rateLimiters.general.consume(socket.userId);
        
        const { channel, amount, tokenAmount, message, sender, recipient } = data;
        
        // Validate input
        if (!channel || !amount || !sender || !recipient) {
          socket.emit('error', { 
            event: 'tip_sent',
            message: ErrorMessages.INVALID_INPUT 
          });
          return;
        }
        
        // Emit to channel for all participants to see
        io.to(`stream:${channel}`).emit('tip_received', {
          channel,
          amount,
          tokenAmount,
          message,
          sender,
          recipient,
          timestamp: Date.now()
        });
        
        // Also emit to specific recipient if online
        if (recipient?.id && userSockets.has(recipient.id)) {
          io.to(`user:${recipient.id}`).emit('tip_received', {
            channel,
            amount,
            tokenAmount,
            message,
            sender,
            recipient,
            timestamp: Date.now()
          });
        }
        
        console.log(`Tip sent in ${channel}:`, amount, 'tokens from', sender.name);
      } catch (error) {
        if (error.remainingPoints !== undefined) {
          socket.emit('error', { 
            event: 'tip_sent',
            message: ErrorMessages.RATE_LIMIT 
          });
        }
      }
    });

    // Enhanced error handler for socket
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
      socket.emit('error', {
        message: ErrorMessages.SERVER_ERROR,
        timestamp: Date.now()
      });
    });

    // Live Shopping Events
    socket.on('shopping:product:view', async (data) => {
      try {
        const { streamId, productId } = data;
        
        if (!validators.streamId(streamId) || !validators.streamId(productId)) {
          socket.emit('error', {
            event: 'shopping:product:view',
            message: ErrorMessages.INVALID_INPUT
          });
          return;
        }
        
        // Log product view event
        const pool = require('./db');
        await pool.query(`
          INSERT INTO product_showcase_events (stream_id, product_id, event_type, viewer_id)
          VALUES ($1, $2, 'clicked', $3)
        `, [streamId, productId, socket.userId]);
        
        console.log(`Product viewed in stream ${streamId}: ${productId}`);
      } catch (error) {
        console.error('Product view error:', error);
      }
    });

    socket.on('shopping:cart:update', async (data) => {
      try {
        const { streamId, cart } = data;
        
        // Broadcast cart activity to stream (for social proof)
        socket.to(`stream:${streamId}`).emit('shopping:activity', {
          type: 'cart_update',
          user: socket.userData.username || 'Someone',
          itemCount: cart.length,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Cart update error:', error);
      }
    });

    socket.on('shopping:poll:vote', async (data) => {
      try {
        const { interactionId, response, streamId } = data;
        
        // Broadcast poll update to all viewers
        io.to(`stream:${streamId}`).emit('shopping:poll:updated', {
          interactionId,
          response,
          voter: socket.userData.username || 'Anonymous'
        });
      } catch (error) {
        console.error('Poll vote error:', error);
      }
    });

    // Handle disconnection with cleanup
    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${socket.userId}, reason: ${reason}`);
      
      // Update user presence to offline
      userPresence.set(socket.userId, {
        status: 'offline',
        lastSeen: Date.now(),
        socketId: null,
        disconnectReason: reason
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

  // Server-side error handling
  io.on('error', (error) => {
    console.error('Socket.io server error:', error);
  });

  console.log('Socket.io initialized successfully with enhanced features');
  return io;
};

// Emit to specific user with error handling
const emitToUser = (userId, event, data) => {
  try {
    if (io && userId && event) {
      io.to(`user:${userId}`).emit(event, data);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error emitting to user ${userId}:`, error);
    return false;
  }
};

// Emit to stream with error handling
const emitToStream = (streamId, event, data) => {
  try {
    if (io && streamId && event) {
      io.to(`stream:${streamId}`).emit(event, data);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error emitting to stream ${streamId}:`, error);
    return false;
  }
};

// Broadcast to all connected users with error handling
const broadcast = (event, data) => {
  try {
    if (io && event) {
      io.emit(event, data);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error broadcasting:', error);
    return false;
  }
};

// Update user token balance with validation
const updateUserBalance = (userId, newBalance) => {
  if (!validators.userId(userId) || typeof newBalance !== 'number' || newBalance < 0) {
    console.error('Invalid balance update:', { userId, newBalance });
    return false;
  }
  
  return emitToUser(userId, 'balance-updated', {
    balance: newBalance,
    timestamp: Date.now()
  });
};

// Send system notification with validation
const sendNotification = (userId, notification) => {
  if (!validators.userId(userId) || !notification || typeof notification !== 'object') {
    console.error('Invalid notification:', { userId, notification });
    return false;
  }
  
  return emitToUser(userId, 'notification', {
    id: Date.now().toString(),
    ...notification,
    timestamp: Date.now()
  });
};

// Get stream viewer count
const getStreamViewerCount = (streamId) => {
  if (!validators.streamId(streamId)) {
    return 0;
  }
  return activeStreams.has(streamId) ? activeStreams.get(streamId).size : 0;
};

// Stream ended with cleanup
const handleStreamEnd = (streamId) => {
  if (!validators.streamId(streamId)) {
    return false;
  }
  
  if (activeStreams.has(streamId)) {
    io.to(`stream:${streamId}`).emit('stream-ended', { 
      streamId,
      timestamp: Date.now()
    });
    activeStreams.delete(streamId);
    console.log(`Stream ended: ${streamId}`);
    return true;
  }
  return false;
};

// Get user presence
const getUserPresence = (userId) => {
  if (!validators.userId(userId)) {
    return { status: 'offline', lastSeen: null };
  }
  return userPresence.get(userId) || { status: 'offline', lastSeen: null };
};

// Get multiple users' presence
const getUsersPresence = (userIds) => {
  if (!validators.userIds(userIds)) {
    return [];
  }
  
  return userIds.map(userId => ({
    userId,
    ...(userPresence.get(userId) || { status: 'offline', lastSeen: null })
  }));
};

// Update user presence with validation
const updateUserPresence = (userId, status) => {
  if (!validators.userId(userId) || !validators.status(status)) {
    console.error('Invalid presence update:', { userId, status });
    return false;
  }
  
  if (userSockets.has(userId)) {
    userPresence.set(userId, {
      status,
      lastSeen: Date.now(),
      socketId: userSockets.get(userId).socketId
    });
    
    if (io) {
      io.emit('user-presence', {
        userId,
        status,
        lastSeen: Date.now()
      });
    }
    return true;
  }
  return false;
};

// Get socket stats for monitoring
const getSocketStats = () => {
  return {
    connectedUsers: userSockets.size,
    activeStreams: activeStreams.size,
    totalViewers: Array.from(activeStreams.values())
      .reduce((sum, viewers) => sum + viewers.size, 0),
    typingUsers: Array.from(typingUsers.values())
      .reduce((sum, users) => sum + users.size, 0),
    serverTime: Date.now()
  };
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
  getSocketStats,
  getIO: () => io
};