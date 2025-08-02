const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

class DigisWebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ 
      server,
      verifyClient: this.verifyClient.bind(this)
    });
    
    this.clients = new Map(); // userId -> WebSocket connection
    this.setupEventHandlers();
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
      
      this.clients.set(userId, ws);
      console.log(`✅ WebSocket connected: ${userId}`);

      ws.on('close', () => {
        this.clients.delete(userId);
        console.log(`👋 WebSocket disconnected: ${userId}`);
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for ${userId}:`, error);
        this.clients.delete(userId);
      });

      // Send initial connection confirmation
      this.sendToUser(userId, {
        type: 'connection_confirmed',
        timestamp: new Date().toISOString()
      });
    });
  }

  sendToUser(userId, data) {
    const client = this.clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  broadcastToChannel(channel, data) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.channel === channel) {
        client.send(JSON.stringify(data));
      }
    });
  }

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
    // Notify sender
    this.sendToUser(senderId, {
      type: 'tip_sent',
      amount,
      usdValue,
      creatorId,
      timestamp: new Date().toISOString()
    });

    // Notify creator
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
}

module.exports = DigisWebSocketServer;