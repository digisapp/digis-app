/**
 * Connection Resilience Manager
 * 
 * Provides connection redundancy, automatic reconnection, and fallback mechanisms
 * for reliable video calling experience even in challenging network conditions.
 */

class ConnectionResilience {
  constructor(agoraClient, options = {}) {
    this.client = agoraClient;
    this.options = {
      maxReconnectAttempts: options.maxReconnectAttempts || 5,
      baseReconnectDelay: options.baseReconnectDelay || 1000, // 1 second
      maxReconnectDelay: options.maxReconnectDelay || 30000, // 30 seconds
      connectionTimeout: options.connectionTimeout || 10000, // 10 seconds
      healthCheckInterval: options.healthCheckInterval || 5000, // 5 seconds
      fallbackEnabled: options.fallbackEnabled !== false, // Default enabled
      enableAudioFallback: options.enableAudioFallback !== false,
      enableChatFallback: options.enableChatFallback !== false,
      tokenRefreshBuffer: options.tokenRefreshBuffer || 300, // 5 minutes before expiry
      ...options
    };

    // Connection state
    this.connectionState = 'DISCONNECTED';
    this.lastKnownGoodConnection = null;
    this.consecutiveFailures = 0;
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    this.connectionHistory = [];
    
    // Fallback state
    this.currentMode = 'FULL'; // FULL, AUDIO_ONLY, CHAT_ONLY
    this.originalTracks = { audio: null, video: null };
    this.fallbackActive = false;
    
    // Timers and intervals
    this.reconnectTimer = null;
    this.healthCheckTimer = null;
    this.connectionTimeoutTimer = null;
    
    // Event listeners
    this.listeners = new Map();
    
    // Connection metrics
    this.connectionMetrics = {
      totalDrops: 0,
      totalReconnects: 0,
      averageReconnectTime: 0,
      longestDowntime: 0,
      currentUptime: 0,
      lastDropTime: null,
      uptimeStart: Date.now()
    };

    console.log('🛡️ Connection Resilience Manager initialized');
  }

  /**
   * Initialize resilience monitoring
   */
  async initialize() {
    try {
      this.setupConnectionEventHandlers();
      this.startHealthMonitoring();
      this.connectionState = 'INITIALIZED';
      
      this.notifyListeners('resilience-initialized', {
        options: this.options,
        timestamp: Date.now()
      });
      
      console.log('🛡️ Connection resilience monitoring started');
    } catch (error) {
      console.error('Failed to initialize connection resilience:', error);
      throw error;
    }
  }

  /**
   * Setup event handlers for connection monitoring
   */
  setupConnectionEventHandlers() {
    // Agora connection events
    this.client.on('connection-state-change', this.handleConnectionStateChange.bind(this));
    this.client.on('token-privilege-will-expire', this.handleTokenWillExpire.bind(this));
    this.client.on('token-privilege-did-expire', this.handleTokenExpired.bind(this));
    this.client.on('network-quality', this.handleNetworkQuality.bind(this));
    this.client.on('user-left', this.handleUserLeft.bind(this));
    this.client.on('exception', this.handleException.bind(this));

    // Browser network events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleNetworkOnline.bind(this));
      window.addEventListener('offline', this.handleNetworkOffline.bind(this));
    }
  }

  /**
   * Start health monitoring loop
   */
  startHealthMonitoring() {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.options.healthCheckInterval);
  }

  /**
   * Perform connection health check
   */
  async performHealthCheck() {
    try {
      if (this.connectionState !== 'CONNECTED') {
        return;
      }

      const stats = await this.client.getStats();
      const localStats = await this.client.getLocalVideoStats();
      
      const healthMetrics = {
        timestamp: Date.now(),
        rtt: stats.RTT || 0,
        uplinkQuality: stats.uplinkNetworkQuality || 0,
        downlinkQuality: stats.downlinkNetworkQuality || 0,
        videoBitrate: localStats?.sendBitrate || 0,
        videoPacketsLost: localStats?.sendPacketsLost || 0
      };

      this.evaluateConnectionHealth(healthMetrics);
      
    } catch (error) {
      console.warn('Health check failed:', error);
      this.handleHealthCheckFailure();
    }
  }

  /**
   * Evaluate connection health and trigger actions if needed
   */
  evaluateConnectionHealth(metrics) {
    const isUnhealthy = 
      metrics.rtt > 1000 || 
      metrics.uplinkQuality < 2 || 
      metrics.downlinkQuality < 2 ||
      (metrics.videoPacketsLost > 0 && metrics.videoBitrate < 100);

    if (isUnhealthy) {
      this.consecutiveFailures++;
      
      if (this.consecutiveFailures >= 3 && !this.fallbackActive) {
        console.warn('🚨 Connection health degraded, considering fallback');
        this.considerFallback(metrics);
      }
    } else {
      this.consecutiveFailures = 0;
      
      // Recovery from fallback mode
      if (this.fallbackActive && this.consecutiveFailures === 0) {
        this.considerRecovery(metrics);
      }
    }

    this.notifyListeners('health-check', {
      metrics,
      isHealthy: !isUnhealthy,
      consecutiveFailures: this.consecutiveFailures
    });
  }

  /**
   * Handle connection state changes
   */
  handleConnectionStateChange(newState, reason) {
    const previousState = this.connectionState;
    this.connectionState = newState;
    
    console.log(`🔄 Connection state: ${previousState} → ${newState} (${reason})`);

    this.connectionHistory.push({
      timestamp: Date.now(),
      fromState: previousState,
      toState: newState,
      reason
    });

    // Keep history manageable
    if (this.connectionHistory.length > 50) {
      this.connectionHistory = this.connectionHistory.slice(-25);
    }

    switch (newState) {
      case 'CONNECTED':
        this.handleConnectionEstablished();
        break;
      case 'RECONNECTING':
        this.handleConnectionReconnecting();
        break;
      case 'DISCONNECTED':
        this.handleConnectionLost(reason);
        break;
      case 'FAILED':
        this.handleConnectionFailed(reason);
        break;
      default:
        console.warn('Unknown connection state:', newState);
        break;
    }

    this.notifyListeners('connection-state-change', {
      previousState,
      currentState: newState,
      reason,
      timestamp: Date.now()
    });
  }

  /**
   * Handle successful connection establishment
   */
  handleConnectionEstablished() {
    this.lastKnownGoodConnection = Date.now();
    this.consecutiveFailures = 0;
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    
    // Calculate uptime
    if (this.connectionMetrics.lastDropTime) {
      const downtime = Date.now() - this.connectionMetrics.lastDropTime;
      if (downtime > this.connectionMetrics.longestDowntime) {
        this.connectionMetrics.longestDowntime = downtime;
      }
    }
    
    this.connectionMetrics.uptimeStart = Date.now();
    this.connectionMetrics.totalReconnects++;

    // Clear any pending reconnect timer
    this.clearReconnectTimer();
    
    // Try to recover from fallback mode
    if (this.fallbackActive) {
      setTimeout(() => this.attemptRecoveryFromFallback(), 5000);
    }

    console.log('✅ Connection established successfully');
    this.notifyListeners('connection-established', {
      timestamp: Date.now(),
      reconnectAttempts: this.reconnectAttempts
    });
  }

  /**
   * Handle connection reconnecting state
   */
  handleConnectionReconnecting() {
    if (!this.isReconnecting) {
      this.isReconnecting = true;
      console.log('🔄 Connection is reconnecting...');
      
      this.notifyListeners('connection-reconnecting', {
        attempt: this.reconnectAttempts + 1,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle connection loss
   */
  handleConnectionLost(reason) {
    this.connectionMetrics.totalDrops++;
    this.connectionMetrics.lastDropTime = Date.now();
    
    if (this.connectionMetrics.uptimeStart) {
      this.connectionMetrics.currentUptime = Date.now() - this.connectionMetrics.uptimeStart;
    }

    console.warn(`💥 Connection lost: ${reason}`);
    
    this.notifyListeners('connection-lost', {
      reason,
      timestamp: Date.now(),
      metrics: { ...this.connectionMetrics }
    });

    // Start reconnection process if not already reconnecting
    if (!this.isReconnecting) {
      this.scheduleReconnection();
    }
  }

  /**
   * Handle connection failure
   */
  handleConnectionFailed(reason) {
    console.error(`❌ Connection failed: ${reason}`);
    
    this.notifyListeners('connection-failed', {
      reason,
      timestamp: Date.now(),
      reconnectAttempts: this.reconnectAttempts
    });

    // Try fallback mode if connection completely failed
    if (this.options.fallbackEnabled && !this.fallbackActive) {
      this.initiateFallback('CONNECTION_FAILED');
    } else {
      this.scheduleReconnection();
    }
  }

  /**
   * Schedule reconnection attempt with exponential backoff
   */
  scheduleReconnection() {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('🚫 Max reconnection attempts reached');
      this.handleReconnectionExhausted();
      return;
    }

    const delay = Math.min(
      this.options.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.options.maxReconnectDelay
    );

    console.log(`⏰ Scheduling reconnection attempt ${this.reconnectAttempts + 1} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.attemptReconnection();
    }, delay);

    this.notifyListeners('reconnection-scheduled', {
      attempt: this.reconnectAttempts + 1,
      delay,
      maxAttempts: this.options.maxReconnectAttempts
    });
  }

  /**
   * Attempt to reconnect
   */
  async attemptReconnection() {
    this.reconnectAttempts++;
    this.isReconnecting = true;

    console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts}`);

    try {
      // Set connection timeout
      const timeoutPromise = new Promise((_, reject) => {
        this.connectionTimeoutTimer = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, this.options.connectionTimeout);
      });

      // Attempt to rejoin with the same parameters
      const reconnectPromise = this.performReconnection();

      await Promise.race([reconnectPromise, timeoutPromise]);

      // Clear timeout if successful
      if (this.connectionTimeoutTimer) {
        clearTimeout(this.connectionTimeoutTimer);
        this.connectionTimeoutTimer = null;
      }

      console.log('✅ Reconnection successful');

    } catch (error) {
      console.error(`❌ Reconnection attempt ${this.reconnectAttempts} failed:`, error);
      
      this.notifyListeners('reconnection-failed', {
        attempt: this.reconnectAttempts,
        error: error.message,
        timestamp: Date.now()
      });

      // Clear timeout timer
      if (this.connectionTimeoutTimer) {
        clearTimeout(this.connectionTimeoutTimer);
        this.connectionTimeoutTimer = null;
      }

      // Try fallback if regular reconnection fails
      if (this.reconnectAttempts >= this.options.maxReconnectAttempts / 2 && 
          !this.fallbackActive && this.options.fallbackEnabled) {
        console.log('🔀 Regular reconnection struggling, trying fallback');
        this.initiateFallback('RECONNECTION_FAILURE');
      } else {
        // Schedule next attempt
        this.scheduleReconnection();
      }
    }
  }

  /**
   * Perform the actual reconnection logic
   */
  async performReconnection() {
    // This method should be implemented by the calling code
    // It contains the specific logic to rejoin the channel
    throw new Error('performReconnection must be implemented by the calling code');
  }

  /**
   * Consider fallback based on connection health
   */
  considerFallback(healthMetrics) {
    if (!this.options.fallbackEnabled || this.fallbackActive) {
      return;
    }

    const shouldFallback = 
      healthMetrics.rtt > 2000 ||
      healthMetrics.uplinkQuality <= 1 ||
      this.consecutiveFailures >= 5;

    if (shouldFallback) {
      console.log('🔀 Initiating fallback due to poor connection health');
      this.initiateFallback('POOR_QUALITY');
    }
  }

  /**
   * Initiate fallback to a more stable mode
   */
  async initiateFallback(reason) {
    if (this.fallbackActive) {
      return;
    }

    this.fallbackActive = true;

    console.log(`🔀 Initiating fallback mode due to: ${reason}`);

    try {
      // Try audio-only first
      if (this.options.enableAudioFallback && this.currentMode === 'FULL') {
        await this.switchToAudioOnly();
        this.currentMode = 'AUDIO_ONLY';
      }
      // If audio-only also fails, try chat-only
      else if (this.options.enableChatFallback && this.currentMode === 'AUDIO_ONLY') {
        await this.switchToChatOnly();
        this.currentMode = 'CHAT_ONLY';
      }

      this.notifyListeners('fallback-activated', {
        reason,
        mode: this.currentMode,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Fallback initiation failed:', error);
      this.fallbackActive = false;
    }
  }

  /**
   * Switch to audio-only mode
   */
  async switchToAudioOnly() {
    console.log('🎙️ Switching to audio-only mode');

    try {
      // Store original video track
      if (this.originalTracks.video) {
        // Stop and unpublish video track
        await this.client.unpublish(this.originalTracks.video);
        this.originalTracks.video.stop();
      }

      // Keep audio track running
      console.log('✅ Switched to audio-only mode successfully');
      
    } catch (error) {
      console.error('Failed to switch to audio-only:', error);
      throw error;
    }
  }

  /**
   * Switch to chat-only mode
   */
  async switchToChatOnly() {
    console.log('💬 Switching to chat-only mode');

    try {
      // Stop all media tracks
      if (this.originalTracks.audio) {
        await this.client.unpublish(this.originalTracks.audio);
        this.originalTracks.audio.stop();
      }

      if (this.originalTracks.video) {
        await this.client.unpublish(this.originalTracks.video);
        this.originalTracks.video.stop();
      }

      // Leave the RTC channel but maintain WebSocket for chat
      await this.client.leave();

      console.log('✅ Switched to chat-only mode successfully');
      
    } catch (error) {
      console.error('Failed to switch to chat-only:', error);
      throw error;
    }
  }

  /**
   * Consider recovery from fallback mode
   */
  considerRecovery(healthMetrics) {
    if (!this.fallbackActive) {
      return;
    }

    const canRecover = 
      healthMetrics.rtt < 500 &&
      healthMetrics.uplinkQuality >= 4 &&
      healthMetrics.downlinkQuality >= 4 &&
      this.consecutiveFailures === 0;

    if (canRecover) {
      console.log('🔄 Network conditions improved, attempting recovery from fallback');
      setTimeout(() => this.attemptRecoveryFromFallback(), 3000);
    }
  }

  /**
   * Attempt recovery from fallback mode
   */
  async attemptRecoveryFromFallback() {
    if (!this.fallbackActive) {
      return;
    }

    console.log('🔄 Attempting recovery from fallback mode');

    try {
      if (this.currentMode === 'CHAT_ONLY') {
        // Try to recover to audio-only first
        await this.recoverFromChatOnly();
        this.currentMode = 'AUDIO_ONLY';
        
        // Wait and then try full recovery
        setTimeout(() => this.attemptRecoveryFromFallback(), 5000);
      } else if (this.currentMode === 'AUDIO_ONLY') {
        // Try to recover to full mode
        await this.recoverFromAudioOnly();
        this.currentMode = 'FULL';
        this.fallbackActive = false;
      }

      this.notifyListeners('fallback-recovery', {
        fromMode: this.currentMode,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Recovery from fallback failed:', error);
      
      // If recovery fails, maintain current fallback mode
      this.notifyListeners('fallback-recovery-failed', {
        mode: this.currentMode,
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Recover from chat-only mode
   */
  async recoverFromChatOnly() {
    console.log('🎙️ Recovering from chat-only to audio-only');
    
    // Rejoin RTC channel and establish audio
    // This should be implemented by the calling code with specific channel details
    throw new Error('recoverFromChatOnly must be implemented by the calling code');
  }

  /**
   * Recover from audio-only mode
   */
  async recoverFromAudioOnly() {
    console.log('🎥 Recovering from audio-only to full video');
    
    // Re-enable video track
    // This should be implemented by the calling code
    throw new Error('recoverFromAudioOnly must be implemented by the calling code');
  }

  /**
   * Handle when all reconnection attempts are exhausted
   */
  handleReconnectionExhausted() {
    console.error('🚫 All reconnection attempts exhausted');
    
    this.isReconnecting = false;
    
    // Try final fallback to chat-only if not already active
    if (!this.fallbackActive && this.options.enableChatFallback) {
      console.log('🔀 Final fallback to chat-only mode');
      this.initiateFallback('RECONNECTION_EXHAUSTED');
    }

    this.notifyListeners('reconnection-exhausted', {
      totalAttempts: this.reconnectAttempts,
      timestamp: Date.now(),
      metrics: { ...this.connectionMetrics }
    });
  }

  /**
   * Handle token expiration
   */
  handleTokenWillExpire() {
    console.log('⚠️ Token will expire, requesting refresh');
    
    this.notifyListeners('token-will-expire', {
      timestamp: Date.now()
    });
  }

  /**
   * Handle token expired
   */
  handleTokenExpired() {
    console.warn('🔐 Token has expired');
    
    this.notifyListeners('token-expired', {
      timestamp: Date.now()
    });
  }

  /**
   * Handle network quality changes
   */
  handleNetworkQuality(stats) {
    // Forward to health evaluation
    this.evaluateConnectionHealth({
      timestamp: Date.now(),
      rtt: 0, // RTT not available in this event
      uplinkQuality: stats.uplinkNetworkQuality,
      downlinkQuality: stats.downlinkNetworkQuality,
      videoBitrate: 0,
      videoPacketsLost: 0
    });
  }

  /**
   * Handle user leaving (might indicate connection issues)
   */
  handleUserLeft(user) {
    console.log(`👋 User left: ${user.uid}`);
    
    this.notifyListeners('user-left', {
      user,
      timestamp: Date.now()
    });
  }

  /**
   * Handle Agora exceptions
   */
  handleException(event) {
    console.error('⚠️ Agora exception:', event);
    
    this.notifyListeners('agora-exception', {
      event,
      timestamp: Date.now()
    });

    // Trigger reconnection for serious exceptions
    if (event.code === 'NETWORK_ERROR' || event.code === 'CONNECTION_ERROR') {
      this.handleConnectionLost('AGORA_EXCEPTION');
    }
  }

  /**
   * Handle network coming online
   */
  handleNetworkOnline() {
    console.log('🌐 Network came online');
    
    this.notifyListeners('network-online', {
      timestamp: Date.now()
    });

    // Attempt immediate reconnection
    if (this.connectionState !== 'CONNECTED' && !this.isReconnecting) {
      console.log('🔄 Network is back, attempting immediate reconnection');
      this.attemptReconnection();
    }
  }

  /**
   * Handle network going offline
   */
  handleNetworkOffline() {
    console.warn('📵 Network went offline');
    
    this.notifyListeners('network-offline', {
      timestamp: Date.now()
    });

    // Activate chat-only fallback if possible
    if (!this.fallbackActive && this.options.enableChatFallback) {
      this.initiateFallback('NETWORK_OFFLINE');
    }
  }

  /**
   * Handle health check failures
   */
  handleHealthCheckFailure() {
    console.warn('🏥 Health check failed');
    
    this.consecutiveFailures++;
    
    if (this.consecutiveFailures >= 5 && this.connectionState === 'CONNECTED') {
      console.warn('🚨 Multiple health check failures, connection may be unstable');
      this.handleConnectionLost('HEALTH_CHECK_FAILURE');
    }
  }

  /**
   * Set original tracks for fallback reference
   */
  setOriginalTracks(audioTrack, videoTrack) {
    this.originalTracks.audio = audioTrack;
    this.originalTracks.video = videoTrack;
  }

  /**
   * Force reconnection
   */
  async forceReconnection() {
    console.log('🔄 Forcing reconnection...');
    
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    this.clearReconnectTimer();
    
    await this.attemptReconnection();
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      state: this.connectionState,
      mode: this.currentMode,
      fallbackActive: this.fallbackActive,
      isReconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts,
      consecutiveFailures: this.consecutiveFailures,
      lastKnownGoodConnection: this.lastKnownGoodConnection,
      metrics: { ...this.connectionMetrics },
      uptime: this.connectionMetrics.uptimeStart ? 
        Date.now() - this.connectionMetrics.uptimeStart : 0
    };
  }

  /**
   * Get connection history
   */
  getConnectionHistory() {
    return [...this.connectionHistory];
  }

  /**
   * Clear reconnect timer
   */
  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Event listener management
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in resilience listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    console.log('🧹 Destroying connection resilience manager');

    // Clear timers
    this.clearReconnectTimer();
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer);
      this.connectionTimeoutTimer = null;
    }

    // Remove event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleNetworkOnline.bind(this));
      window.removeEventListener('offline', this.handleNetworkOffline.bind(this));
    }

    // Clear listeners
    this.listeners.clear();

    // Reset state
    this.connectionState = 'DESTROYED';
    this.isReconnecting = false;
    this.fallbackActive = false;
  }
}

export default ConnectionResilience;