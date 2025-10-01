const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { RtmClient, RtmChannel } = require('agora-rtm-sdk');

class EnhancedDigisWebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ 
      server,
      verifyClient: this.verifyClient.bind(this)
    });
    
    // Connection maps
    this.clients = new Map(); // userId -> { ws, userInfo, rtmClient }
    this.channels = new Map(); // channelId -> Set of userIds
    this.streamingSessions = new Map(); // sessionId -> streaming session data
    this.activePolls = new Map(); // pollId -> poll data
    this.activeQAs = new Map(); // qaId -> Q&A session data
    
    // Agora RTM setup
    this.setupAgoraRTM();
    this.setupEventHandlers();
  }

  setupAgoraRTM() {
    // Initialize Agora RTM for messaging
    this.agoraAppId = process.env.AGORA_APP_ID;
    console.log('🔧 Setting up Agora RTM integration...');
  }

  verifyClient(info) {
    const token = new URL(info.req.url, 'http://localhost').searchParams.get('token');
    if (!token) return false;
    
    try {
      jwt.verify(token, process.env.JWT_SECRET);
      return true;
    } catch (error) {
      return false;
    }
  }

  setupEventHandlers() {
    this.wss.on('connection', (ws, req) => {
      const token = new URL(req.url, 'http://localhost').searchParams.get('token');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.uid;
      const userInfo = {
        userId,
        username: decoded.username || 'User',
        isCreator: decoded.isCreator || false,
        connectedAt: new Date().toISOString()
      };
      
      // Store client info
      this.clients.set(userId, { 
        ws, 
        userInfo,
        channels: new Set(),
        rtmClient: null 
      });
      
      console.log(`✅ Enhanced WebSocket connected: ${userId} (${userInfo.username})`);

      // Setup message handlers
      ws.on('message', (message) => {
        this.handleMessage(userId, message);
      });

      ws.on('close', () => {
        this.handleDisconnection(userId);
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for ${userId}:`, error);
        this.handleDisconnection(userId);
      });

      // Send initial connection confirmation with capabilities
      this.sendToUser(userId, {
        type: 'connection_confirmed',
        capabilities: {
          instantMessaging: true,
          liveStreaming: true,
          interactivePolls: true,
          realTimeQA: true,
          reactions: true,
          screenSharing: true
        },
        userInfo,
        timestamp: new Date().toISOString()
      });
    });
  }

  handleMessage(userId, rawMessage) {
    try {
      const message = JSON.parse(rawMessage);
      console.log(`📨 Message from ${userId}:`, message.type);

      switch (message.type) {
        case 'join_channel':
          this.handleJoinChannel(userId, message);
          break;
        case 'leave_channel':
          this.handleLeaveChannel(userId, message);
          break;
        case 'send_message':
          this.handleSendMessage(userId, message);
          break;
        case 'start_stream':
          this.handleStartStream(userId, message);
          break;
        case 'end_stream':
          this.handleEndStream(userId, message);
          break;
        case 'create_poll':
          this.handleCreatePoll(userId, message);
          break;
        case 'vote_poll':
          this.handleVotePoll(userId, message);
          break;
        case 'send_reaction':
          this.handleSendReaction(userId, message);
          break;
        case 'ask_question':
          this.handleAskQuestion(userId, message);
          break;
        case 'answer_question':
          this.handleAnswerQuestion(userId, message);
          break;
        case 'screen_share_start':
          this.handleScreenShareStart(userId, message);
          break;
        case 'screen_share_end':
          this.handleScreenShareEnd(userId, message);
          break;
        default:
          console.log(`❓ Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
      this.sendToUser(userId, {
        type: 'error',
        message: 'Invalid message format',
        timestamp: new Date().toISOString()
      });
    }
  }

  handleJoinChannel(userId, message) {
    const { channelId, channelType = 'chat' } = message;
    const client = this.clients.get(userId);
    
    if (!client) return;

    // Add user to channel
    if (!this.channels.has(channelId)) {
      this.channels.set(channelId, new Set());
    }
    
    this.channels.get(channelId).add(userId);
    client.channels.add(channelId);

    // Notify channel members
    this.broadcastToChannel(channelId, {
      type: 'user_joined_channel',
      userId,
      username: client.userInfo.username,
      channelId,
      channelType,
      memberCount: this.channels.get(channelId).size,
      timestamp: new Date().toISOString()
    }, userId);

    // Send confirmation to user
    this.sendToUser(userId, {
      type: 'channel_joined',
      channelId,
      channelType,
      memberCount: this.channels.get(channelId).size,
      timestamp: new Date().toISOString()
    });

    console.log(`🔗 User ${userId} joined channel ${channelId}`);
  }

  handleLeaveChannel(userId, message) {
    const { channelId } = message;
    const client = this.clients.get(userId);
    
    if (!client) return;

    // Remove user from channel
    if (this.channels.has(channelId)) {
      this.channels.get(channelId).delete(userId);
      client.channels.delete(channelId);

      // Clean up empty channels
      if (this.channels.get(channelId).size === 0) {
        this.channels.delete(channelId);
      } else {
        // Notify remaining members
        this.broadcastToChannel(channelId, {
          type: 'user_left_channel',
          userId,
          username: client.userInfo.username,
          channelId,
          memberCount: this.channels.get(channelId).size,
          timestamp: new Date().toISOString()
        });
      }
    }

    console.log(`👋 User ${userId} left channel ${channelId}`);
  }

  handleSendMessage(userId, message) {
    const { channelId, content, messageType = 'text', replyTo = null } = message;
    const client = this.clients.get(userId);
    
    if (!client || !client.channels.has(channelId)) {
      this.sendToUser(userId, {
        type: 'error',
        message: 'Not in channel',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const chatMessage = {
      type: 'new_message',
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      channelId,
      senderId: userId,
      senderUsername: client.userInfo.username,
      senderIsCreator: client.userInfo.isCreator,
      content,
      messageType,
      replyTo,
      timestamp: new Date().toISOString()
    };

    // Broadcast to all channel members
    this.broadcastToChannel(channelId, chatMessage);
    
    console.log(`💬 Message sent in channel ${channelId} by ${userId}`);
  }

  handleStartStream(userId, message) {
    const { channelId, streamTitle, streamDescription, categories = [] } = message;
    const client = this.clients.get(userId);
    
    if (!client || !client.userInfo.isCreator) {
      this.sendToUser(userId, {
        type: 'error',
        message: 'Only creators can start streams',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const sessionId = `stream_${Date.now()}_${userId}`;
    const streamSession = {
      sessionId,
      creatorId: userId,
      creatorUsername: client.userInfo.username,
      channelId,
      title: streamTitle,
      description: streamDescription,
      categories,
      startTime: new Date().toISOString(),
      status: 'live',
      viewers: new Set(),
      polls: new Map(),
      questions: new Map(),
      reactions: new Map()
    };

    this.streamingSessions.set(sessionId, streamSession);

    // Notify channel about stream start
    this.broadcastToChannel(channelId, {
      type: 'stream_started',
      sessionId,
      creatorId: userId,
      creatorUsername: client.userInfo.username,
      title: streamTitle,
      description: streamDescription,
      categories,
      timestamp: new Date().toISOString()
    });

    console.log(`🎥 Stream started by ${userId}: ${streamTitle}`);
  }

  handleEndStream(userId, message) {
    const { sessionId } = message;
    const streamSession = this.streamingSessions.get(sessionId);
    
    if (!streamSession || streamSession.creatorId !== userId) {
      this.sendToUser(userId, {
        type: 'error',
        message: 'Stream not found or not authorized',
        timestamp: new Date().toISOString()
      });
      return;
    }

    streamSession.status = 'ended';
    streamSession.endTime = new Date().toISOString();

    // Notify channel about stream end
    this.broadcastToChannel(streamSession.channelId, {
      type: 'stream_ended',
      sessionId,
      creatorId: userId,
      duration: new Date() - new Date(streamSession.startTime),
      timestamp: new Date().toISOString()
    });

    this.streamingSessions.delete(sessionId);
    console.log(`🛑 Stream ended by ${userId}`);
  }

  handleCreatePoll(userId, message) {
    const { channelId, question, options, duration = 60000 } = message;
    const client = this.clients.get(userId);
    
    if (!client || !client.userInfo.isCreator) {
      this.sendToUser(userId, {
        type: 'error',
        message: 'Only creators can create polls',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const pollId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const poll = {
      pollId,
      creatorId: userId,
      channelId,
      question,
      options: options.map((option, index) => ({
        id: index,
        text: option,
        votes: 0,
        voters: new Set()
      })),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + duration).toISOString(),
      status: 'active'
    };

    this.activePolls.set(pollId, poll);

    // Broadcast poll to channel
    this.broadcastToChannel(channelId, {
      type: 'poll_created',
      poll: {
        ...poll,
        options: poll.options.map(opt => ({ id: opt.id, text: opt.text, votes: opt.votes }))
      },
      timestamp: new Date().toISOString()
    });

    // Auto-close poll after duration
    setTimeout(() => {
      this.closePoll(pollId);
    }, duration);

    console.log(`📊 Poll created by ${userId}: ${question}`);
  }

  handleVotePoll(userId, message) {
    const { pollId, optionId } = message;
    const poll = this.activePolls.get(pollId);
    
    if (!poll || poll.status !== 'active') {
      this.sendToUser(userId, {
        type: 'error',
        message: 'Poll not found or closed',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Check if user already voted
    const hasVoted = poll.options.some(option => option.voters.has(userId));
    if (hasVoted) {
      this.sendToUser(userId, {
        type: 'error',
        message: 'Already voted in this poll',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Add vote
    const option = poll.options.find(opt => opt.id === optionId);
    if (option) {
      option.votes++;
      option.voters.add(userId);

      // Broadcast updated poll results
      this.broadcastToChannel(poll.channelId, {
        type: 'poll_updated',
        pollId,
        results: poll.options.map(opt => ({ id: opt.id, text: opt.text, votes: opt.votes })),
        totalVotes: poll.options.reduce((sum, opt) => sum + opt.votes, 0),
        timestamp: new Date().toISOString()
      });

      console.log(`🗳️ Vote cast by ${userId} in poll ${pollId}`);
    }
  }

  handleSendReaction(userId, message) {
    const { channelId, reaction, targetType = 'stream', targetId = null } = message;
    const client = this.clients.get(userId);
    
    if (!client || !client.channels.has(channelId)) return;

    const reactionData = {
      type: 'reaction_sent',
      channelId,
      senderId: userId,
      senderUsername: client.userInfo.username,
      reaction,
      targetType,
      targetId,
      timestamp: new Date().toISOString()
    };

    // Broadcast reaction to channel
    this.broadcastToChannel(channelId, reactionData);

    console.log(`😊 Reaction ${reaction} sent by ${userId} in channel ${channelId}`);
  }

  handleAskQuestion(userId, message) {
    const { channelId, question } = message;
    const client = this.clients.get(userId);
    
    if (!client || !client.channels.has(channelId)) return;

    const questionId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const questionData = {
      questionId,
      channelId,
      askerId: userId,
      askerUsername: client.userInfo.username,
      question,
      status: 'pending',
      createdAt: new Date().toISOString(),
      answer: null,
      answeredAt: null,
      answeredBy: null
    };

    // Store question
    if (!this.activeQAs.has(channelId)) {
      this.activeQAs.set(channelId, new Map());
    }
    this.activeQAs.get(channelId).set(questionId, questionData);

    // Broadcast question to channel
    this.broadcastToChannel(channelId, {
      type: 'question_asked',
      question: questionData,
      timestamp: new Date().toISOString()
    });

    console.log(`❓ Question asked by ${userId} in channel ${channelId}`);
  }

  handleAnswerQuestion(userId, message) {
    const { channelId, questionId, answer } = message;
    const client = this.clients.get(userId);
    
    if (!client || !client.userInfo.isCreator) {
      this.sendToUser(userId, {
        type: 'error',
        message: 'Only creators can answer questions',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const channelQAs = this.activeQAs.get(channelId);
    const question = channelQAs?.get(questionId);
    
    if (!question) {
      this.sendToUser(userId, {
        type: 'error',
        message: 'Question not found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Update question with answer
    question.answer = answer;
    question.answeredAt = new Date().toISOString();
    question.answeredBy = userId;
    question.status = 'answered';

    // Broadcast answer to channel
    this.broadcastToChannel(channelId, {
      type: 'question_answered',
      question,
      timestamp: new Date().toISOString()
    });

    console.log(`✅ Question ${questionId} answered by ${userId}`);
  }

  handleScreenShareStart(userId, message) {
    const { channelId, sessionId } = message;
    const client = this.clients.get(userId);
    
    if (!client) return;

    // Notify channel about screen sharing
    this.broadcastToChannel(channelId, {
      type: 'screen_share_started',
      sessionId,
      userId,
      username: client.userInfo.username,
      timestamp: new Date().toISOString()
    }, userId);

    console.log(`🖥️ Screen sharing started by ${userId} in session ${sessionId}`);
  }

  handleScreenShareEnd(userId, message) {
    const { channelId, sessionId } = message;
    const client = this.clients.get(userId);
    
    if (!client) return;

    // Notify channel about screen sharing end
    this.broadcastToChannel(channelId, {
      type: 'screen_share_ended',
      sessionId,
      userId,
      username: client.userInfo.username,
      timestamp: new Date().toISOString()
    }, userId);

    console.log(`🖥️ Screen sharing ended by ${userId} in session ${sessionId}`);
  }

  handleDisconnection(userId) {
    const client = this.clients.get(userId);
    if (!client) return;

    // Remove from all channels
    client.channels.forEach(channelId => {
      if (this.channels.has(channelId)) {
        this.channels.get(channelId).delete(userId);
        
        // Notify channel members
        this.broadcastToChannel(channelId, {
          type: 'user_disconnected',
          userId,
          username: client.userInfo.username,
          timestamp: new Date().toISOString()
        });

        // Clean up empty channels
        if (this.channels.get(channelId).size === 0) {
          this.channels.delete(channelId);
        }
      }
    });

    this.clients.delete(userId);
    console.log(`👋 Enhanced WebSocket disconnected: ${userId}`);
  }

  closePoll(pollId) {
    const poll = this.activePolls.get(pollId);
    if (!poll) return;

    poll.status = 'closed';

    // Broadcast final results
    this.broadcastToChannel(poll.channelId, {
      type: 'poll_closed',
      pollId,
      finalResults: poll.options.map(opt => ({ id: opt.id, text: opt.text, votes: opt.votes })),
      totalVotes: poll.options.reduce((sum, opt) => sum + opt.votes, 0),
      timestamp: new Date().toISOString()
    });

    console.log(`📊 Poll ${pollId} closed`);
  }

  // Enhanced utility methods
  sendToUser(userId, data) {
    const client = this.clients.get(userId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  broadcastToChannel(channelId, data, excludeUserId = null) {
    const channelMembers = this.channels.get(channelId);
    if (!channelMembers) return;

    channelMembers.forEach(userId => {
      if (userId !== excludeUserId) {
        this.sendToUser(userId, data);
      }
    });
  }

  broadcastToAll(data, excludeUserId = null) {
    this.clients.forEach((client, userId) => {
      if (userId !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(data));
      }
    });
  }

  // Legacy methods for compatibility
  broadcastBalanceUpdate(userId, newBalance, change, reason) {
    this.sendToUser(userId, {
      type: 'balance_update',
      balance: newBalance,
      change,
      reason,
      timestamp: new Date().toISOString()
    });
  }

  broadcastTipNotification(senderId, creatorId, amount, usdValue) {
    this.sendToUser(senderId, {
      type: 'tip_sent',
      amount,
      usdValue,
      creatorId,
      timestamp: new Date().toISOString()
    });

    this.sendToUser(creatorId, {
      type: 'tip_received',
      amount,
      usdValue,
      senderId,
      timestamp: new Date().toISOString()
    });
  }

  broadcastSessionUpdate(userId, sessionData) {
    this.sendToUser(userId, {
      type: 'session_update',
      session: sessionData,
      timestamp: new Date().toISOString()
    });
  }

  // Get statistics
  getStats() {
    return {
      connectedUsers: this.clients.size,
      activeChannels: this.channels.size,
      activeStreams: this.streamingSessions.size,
      activePolls: this.activePolls.size,
      activeQAs: Array.from(this.activeQAs.values()).reduce((sum, channelQAs) => sum + channelQAs.size, 0)
    };
  }
}

module.exports = EnhancedDigisWebSocketServer;