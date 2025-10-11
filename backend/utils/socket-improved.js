const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const { verifySupabaseToken } = require('./supabase-admin-v2');

let io = null;
const activeStreams = new Map(); // Track active streams
const userSockets = new Map(); // Track user socket connections
const userPresence = new Map(); // Track user online status
const typingUsers = new Map(); // Track typing users per channel

// Initialize Socket.io with improved error handling and scaling
const initializeSocket = async (server) => {
  try {
    // Configure CORS options based on environment
    const corsOrigins = process.env.NODE_ENV === 'production' 
      ? [
          process.env.FRONTEND_URL,
          'https://digis.app',
          'https://www.digis.app',
          process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
        ].filter(Boolean)
      : ['http://localhost:3000', 'http://localhost:3001'];

    io = new Server(server, {
      cors: {
        origin: corsOrigins,
        credentials: true,
        methods: ['GET', 'POST']
      },
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      pingTimeout: 20000,
      pingInterval: 25000,
      upgradeTimeout: 10000,
      maxHttpBufferSize: 1e6, // 1MB
      allowEIO3: true // Allow different Socket.io versions
    });

    // Set up Redis adapter for horizontal scaling
    if (process.env.REDIS_URL) {
      try {
        const pubClient = createClient({ 
          url: process.env.REDIS_URL,
          retry_strategy: (options) => {
            if (options.error && options.error.code === 'ECONNREFUSED') {
              // End reconnecting on a specific error and flush all commands with a individual error
              return new Error('Redis connection refused');
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
              // End reconnecting after a specific timeout and flush all commands with a individual error
              return new Error('Redis retry time exhausted');
            }
            if (options.attempt > 10) {
              // End reconnecting with built in error
              return undefined;
            }
            // reconnect after
            return Math.min(options.attempt * 100, 3000);
          }
        });
        const subClient = pubClient.duplicate();

        await Promise.all([
          pubClient.connect(),
          subClient.connect()
        ]);

        io.adapter(createAdapter(pubClient, subClient));
        console.log('✅ Redis adapter connected for Socket.io scaling');
      } catch (redisError) {
        console.error('⚠️ Redis connection failed, falling back to single instance:', redisError.message);
        // Continue without Redis adapter
      }
    }

    // Enhanced authentication middleware with better error handling
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        // Create mock request/response for middleware compatibility
        const mockReq = { 
          headers: { 
            authorization: `Bearer ${token}` 
          }
        };
        const mockRes = {
          status: () => mockRes,
          json: () => mockRes
        };
        
        let authError = null;
        const mockNext = (err) => {
          if (err) authError = err;
        };
        
        // Verify token using existing middleware
        await verifySupabaseToken(mockReq, mockRes, mockNext);
        
        if (authError) {
          throw authError;
        }
        
        if (!mockReq.user) {
          throw new Error('User verification failed');
        }
        
        // Attach user info to socket
        socket.userId = mockReq.user.id;
        socket.userEmail = mockReq.user.email;
        socket.user = mockReq.user;
        
        next();
      } catch (error) {
        console.error('Socket authentication error:', {
          message: error.message,
          timestamp: new Date().toISOString()
        });
        
        // Send specific error messages
        if (error.message?.includes('expired')) {
          next(new Error('Token expired'));
        } else if (error.message?.includes('invalid')) {
          next(new Error('Invalid token'));
        } else {
          next(new Error('Authentication failed'));
        }
      }
    });

    // Connection handler with error boundaries
    io.on('connection', (socket) => {
      try {
        console.log(`User connected: ${socket.userId} (${socket.userEmail})`);
        
        // Track user socket with cleanup
        const existingSocketId = userSockets.get(socket.userId);
        if (existingSocketId && existingSocketId !== socket.id) {
          // Disconnect old socket if user reconnects
          const oldSocket = io.sockets.sockets.get(existingSocketId);
          if (oldSocket) {
            oldSocket.disconnect(true);
          }
        }
        
        userSockets.set(socket.userId, socket.id);
        
        // Update user presence
        userPresence.set(socket.userId, {
          status: 'online',
          lastSeen: Date.now(),
          socketId: socket.id,
          email: socket.userEmail
        });

        // Join user's personal room for direct messages
        socket.join(`user:${socket.userId}`);
        
        // Notify others about user coming online
        socket.broadcast.emit('user-presence', {
          userId: socket.userId,
          status: 'online',
          lastSeen: Date.now()
        });

        // Stream handling with validation
        socket.on('join-stream', (streamId) => {
          try {
            if (!streamId || typeof streamId !== 'string') {
              socket.emit('error', { message: 'Invalid stream ID' });
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
            
            console.log(`User ${socket.userId} joined stream ${streamId}. Viewers: ${viewerCount}`);
          } catch (error) {
            console.error('Error joining stream:', error);
            socket.emit('error', { message: 'Failed to join stream' });
          }
        });

        // Leave stream with cleanup
        socket.on('leave-stream', (streamId) => {
          try {
            if (!streamId || typeof streamId !== 'string') return;

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
          } catch (error) {
            console.error('Error leaving stream:', error);
          }
        });

        // Handle stream analytics with rate limiting
        const analyticsRateLimit = new Map();
        socket.on('update-stream-analytics', (data) => {
          try {
            // Rate limit: 1 update per second per stream
            const key = `${socket.userId}-${data.streamId}`;
            const lastUpdate = analyticsRateLimit.get(key) || 0;
            const now = Date.now();
            
            if (now - lastUpdate < 1000) {
              return; // Skip update if too frequent
            }
            
            analyticsRateLimit.set(key, now);
            
            if (data.streamId && typeof data.streamId === 'string') {
              io.to(`stream:${data.streamId}`).emit('stream-analytics', {
                ...data,
                timestamp: now
              });
            }
          } catch (error) {
            console.error('Error updating stream analytics:', error);
          }
        });
        
        // Handle presence updates with validation
        socket.on('update-presence', (status) => {
          try {
            const validStatuses = ['online', 'away', 'busy', 'offline'];
            if (!validStatuses.includes(status)) {
              socket.emit('error', { message: 'Invalid presence status' });
              return;
            }
            
            userPresence.set(socket.userId, {
              status,
              lastSeen: Date.now(),
              socketId: socket.id,
              email: socket.userEmail
            });
            
            // Notify all connected users about presence change
            io.emit('user-presence', {
              userId: socket.userId,
              status,
              lastSeen: Date.now()
            });
          } catch (error) {
            console.error('Error updating presence:', error);
          }
        });
        
        // Typing indicators with cleanup
        socket.on('typing-start', ({ channel, recipientId }) => {
          try {
            if (!channel || typeof channel !== 'string') return;
            
            // Track typing user
            if (!typingUsers.has(channel)) {
              typingUsers.set(channel, new Set());
            }
            typingUsers.get(channel).add(socket.userId);
            
            // Set automatic cleanup after 5 seconds
            setTimeout(() => {
              if (typingUsers.has(channel)) {
                typingUsers.get(channel).delete(socket.userId);
              }
            }, 5000);
            
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
            console.error('Error handling typing indicator:', error);
          }
        });
        
        socket.on('typing-stop', ({ channel, recipientId }) => {
          try {
            if (!channel || typeof channel !== 'string') return;
            
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
          } catch (error) {
            console.error('Error handling typing stop:', error);
          }
        });
        
        // Handle request for user presence
        socket.on('get-user-presence', (userIds) => {
          try {
            if (!Array.isArray(userIds) || userIds.length > 100) {
              socket.emit('error', { message: 'Invalid user IDs request' });
              return;
            }
            
            const presenceData = userIds.map(userId => ({
              userId,
              ...(userPresence.get(userId) || { status: 'offline', lastSeen: null })
            }));
            
            socket.emit('user-presence-list', presenceData);
          } catch (error) {
            console.error('Error getting user presence:', error);
          }
        });

        // Handle errors
        socket.on('error', (error) => {
          console.error(`Socket error for user ${socket.userId}:`, error);
        });

        // Handle disconnection with comprehensive cleanup
        socket.on('disconnect', (reason) => {
          try {
            console.log(`User disconnected: ${socket.userId} (${reason})`);
            
            // Update user presence to offline
            userPresence.set(socket.userId, {
              status: 'offline',
              lastSeen: Date.now(),
              socketId: null,
              email: socket.userEmail
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
          } catch (error) {
            console.error('Error during disconnect cleanup:', error);
          }
        });
      } catch (error) {
        console.error('Error in connection handler:', error);
        socket.disconnect(true);
      }
    });

    console.log('✅ Socket.io initialized successfully with enhanced features');
    return io;
  } catch (error) {
    console.error('❌ Failed to initialize Socket.io:', error);
    throw error;
  }
};

// Emit to specific user with error handling
const emitToUser = (userId, event, data) => {
  try {
    if (io && userId && event) {
      io.to(`user:${userId}`).emit(event, data);
    }
  } catch (error) {
    console.error('Error emitting to user:', error);
  }
};

// Emit to stream with error handling
const emitToStream = (streamId, event, data) => {
  try {
    if (io && streamId && event) {
      io.to(`stream:${streamId}`).emit(event, data);
    }
  } catch (error) {
    console.error('Error emitting to stream:', error);
  }
};

// Broadcast to all connected users with error handling
const broadcast = (event, data) => {
  try {
    if (io && event) {
      io.emit(event, data);
    }
  } catch (error) {
    console.error('Error broadcasting:', error);
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
    id: Date.now().toString(),
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
  try {
    if (activeStreams.has(streamId)) {
      io.to(`stream:${streamId}`).emit('stream-ended', { 
        streamId,
        timestamp: Date.now()
      });
      activeStreams.delete(streamId);
    }
  } catch (error) {
    console.error('Error handling stream end:', error);
  }
};

// Get user presence
const getUserPresence = (userId) => {
  return userPresence.get(userId) || { status: 'offline', lastSeen: null };
};

// Get multiple users' presence
const getUsersPresence = (userIds) => {
  if (!Array.isArray(userIds)) return [];
  
  return userIds.slice(0, 100).map(userId => ({
    userId,
    ...(userPresence.get(userId) || { status: 'offline', lastSeen: null })
  }));
};

// Update user presence
const updateUserPresence = (userId, status) => {
  try {
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
  } catch (error) {
    console.error('Error updating user presence:', error);
  }
};

// Graceful shutdown
const shutdown = async () => {
  try {
    if (io) {
      // Notify all connected clients
      io.emit('server-shutdown', {
        message: 'Server is shutting down for maintenance',
        timestamp: Date.now()
      });
      
      // Close all connections
      io.disconnectSockets(true);
      
      // Close the server
      await new Promise((resolve) => {
        io.close(() => {
          console.log('Socket.io server closed');
          resolve();
        });
      });
    }
  } catch (error) {
    console.error('Error during socket shutdown:', error);
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
  shutdown,
  getIO: () => io
};