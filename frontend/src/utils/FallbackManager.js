/**
 * Fallback Manager
 * 
 * Manages different communication fallback modes when primary connections fail.
 * Provides graceful degradation from full video to audio-only to chat-only.
 */

class FallbackManager {
  constructor(options = {}) {
    this.options = {
      enableVideoFallback: options.enableVideoFallback !== false,
      enableAudioFallback: options.enableAudioFallback !== false,
      enableChatFallback: options.enableChatFallback !== false,
      fallbackTimeout: options.fallbackTimeout || 10000, // 10 seconds
      recoveryDelay: options.recoveryDelay || 5000, // 5 seconds
      qualityThreshold: options.qualityThreshold || 2, // Network quality threshold
      ...options
    };

    // Fallback modes hierarchy (best to worst)
    this.modes = [
      {
        name: 'FULL_VIDEO',
        label: 'Full Video & Audio',
        description: 'Full video calling with high quality',
        requirements: { video: true, audio: true, rtc: true },
        priority: 1
      },
      {
        name: 'REDUCED_VIDEO',
        label: 'Reduced Video & Audio', 
        description: 'Lower quality video to save bandwidth',
        requirements: { video: true, audio: true, rtc: true },
        priority: 2
      },
      {
        name: 'AUDIO_ONLY',
        label: 'Audio Only',
        description: 'Voice call without video',
        requirements: { video: false, audio: true, rtc: true },
        priority: 3
      },
      {
        name: 'CHAT_ONLY',
        label: 'Chat Only',
        description: 'Text messaging only',
        requirements: { video: false, audio: false, rtc: false },
        priority: 4
      }
    ];

    // Current state
    this.currentMode = this.modes[0]; // Start with full video
    this.targetMode = null;
    this.isFallbackActive = false;
    this.transitionInProgress = false;
    this.fallbackReason = null;
    
    // Track attempts and history
    this.fallbackHistory = [];
    this.modeAttempts = new Map();
    
    // Connection references
    this.agoraClient = null;
    this.tracks = {
      audio: null,
      video: null,
      screen: null
    };
    
    // WebSocket for chat fallback
    this.chatSocket = null;
    this.chatConnected = false;
    
    // Event listeners
    this.listeners = new Map();

    console.log('🔄 Fallback Manager initialized');
  }

  /**
   * Initialize fallback manager with connection references
   */
  initialize(agoraClient, tracks = {}, chatSocket = null) {
    this.agoraClient = agoraClient;
    this.tracks = { ...this.tracks, ...tracks };
    this.chatSocket = chatSocket;
    
    if (this.chatSocket) {
      this.setupChatSocketListeners();
    }

    this.notifyListeners('manager-initialized', {
      currentMode: this.currentMode.name,
      availableModes: this.getAvailableModes(),
      timestamp: Date.now()
    });

    console.log('✅ Fallback Manager initialized with connections');
  }

  /**
   * Setup chat WebSocket event listeners
   */
  setupChatSocketListeners() {
    if (!this.chatSocket) return;

    this.chatSocket.on('connect', () => {
      this.chatConnected = true;
      console.log('💬 Chat WebSocket connected');
    });

    this.chatSocket.on('disconnect', () => {
      this.chatConnected = false;
      console.log('💬 Chat WebSocket disconnected');
      
      // If in chat-only mode and chat disconnects, we're in trouble
      if (this.currentMode.name === 'CHAT_ONLY') {
        this.handleChatFailure();
      }
    });

    this.chatSocket.on('reconnect', () => {
      this.chatConnected = true;
      console.log('💬 Chat WebSocket reconnected');
    });
  }

  /**
   * Trigger fallback to a more stable mode
   */
  async triggerFallback(reason, networkQuality = null, forceMode = null) {
    if (this.transitionInProgress) {
      console.log('⏳ Fallback transition already in progress');
      return false;
    }

    console.log(`🔄 Triggering fallback due to: ${reason}`);
    
    this.fallbackReason = reason;
    this.isFallbackActive = true;
    
    // Determine target mode
    const targetMode = forceMode || this.determineTargetMode(reason, networkQuality);
    
    if (!targetMode) {
      console.error('❌ No suitable fallback mode found');
      return false;
    }

    if (targetMode.name === this.currentMode.name) {
      console.log('ℹ️ Already in target fallback mode');
      return false;
    }

    this.targetMode = targetMode;

    // Record attempt
    const attempts = this.modeAttempts.get(targetMode.name) || 0;
    this.modeAttempts.set(targetMode.name, attempts + 1);

    // Add to history
    this.fallbackHistory.push({
      timestamp: Date.now(),
      reason,
      fromMode: this.currentMode.name,
      toMode: targetMode.name,
      networkQuality
    });

    try {
      this.transitionInProgress = true;
      
      this.notifyListeners('fallback-started', {
        reason,
        fromMode: this.currentMode.name,
        toMode: targetMode.name,
        networkQuality
      });

      await this.transitionToMode(targetMode);
      
      this.currentMode = targetMode;
      this.transitionInProgress = false;
      
      console.log(`✅ Fallback successful: ${this.currentMode.label}`);
      
      this.notifyListeners('fallback-completed', {
        mode: this.currentMode.name,
        reason,
        timestamp: Date.now()
      });

      return true;

    } catch (error) {
      console.error('❌ Fallback transition failed:', error);
      
      this.transitionInProgress = false;
      this.targetMode = null;
      
      this.notifyListeners('fallback-failed', {
        targetMode: targetMode.name,
        error: error.message,
        reason
      });

      // Try next level fallback
      const nextMode = this.getNextFallbackMode(targetMode);
      if (nextMode && nextMode.priority > targetMode.priority) {
        console.log(`🔄 Attempting next level fallback: ${nextMode.name}`);
        return this.triggerFallback(`${reason}_RETRY`, networkQuality, nextMode);
      }

      return false;
    }
  }

  /**
   * Determine the best target fallback mode based on conditions
   */
  determineTargetMode(reason, networkQuality) {
    const currentPriority = this.currentMode.priority;
    
    // Based on reason, determine appropriate fallback
    switch (reason) {
      case 'POOR_VIDEO_QUALITY':
      case 'HIGH_PACKET_LOSS':
        if (currentPriority <= 1) {
          return this.modes.find(m => m.name === 'REDUCED_VIDEO');
        }
        return this.modes.find(m => m.name === 'AUDIO_ONLY');

      case 'VIDEO_TRACK_FAILED':
      case 'CAMERA_ERROR':
        return this.modes.find(m => m.name === 'AUDIO_ONLY');

      case 'AUDIO_TRACK_FAILED':
      case 'MICROPHONE_ERROR':
        if (this.currentMode.name === 'AUDIO_ONLY') {
          return this.modes.find(m => m.name === 'CHAT_ONLY');
        }
        // If in video mode and audio fails, could try video-only (not implemented)
        return this.modes.find(m => m.name === 'CHAT_ONLY');

      case 'RTC_CONNECTION_FAILED':
      case 'SEVERE_NETWORK_ISSUE':
        return this.modes.find(m => m.name === 'CHAT_ONLY');

      case 'LOW_BANDWIDTH':
        if (networkQuality <= 2 && currentPriority <= 2) {
          return this.modes.find(m => m.name === 'AUDIO_ONLY');
        }
        return this.modes.find(m => m.name === 'REDUCED_VIDEO');

      default:
        return this.getNextFallbackMode(this.currentMode);
    }
  }

  /**
   * Get next fallback mode in hierarchy
   */
  getNextFallbackMode(currentMode) {
    const currentIndex = this.modes.findIndex(m => m.name === currentMode.name);
    return currentIndex < this.modes.length - 1 ? this.modes[currentIndex + 1] : null;
  }

  /**
   * Transition to target mode
   */
  async transitionToMode(targetMode) {
    console.log(`🔄 Transitioning to ${targetMode.label}`);

    switch (targetMode.name) {
      case 'REDUCED_VIDEO':
        await this.transitionToReducedVideo();
        break;
      case 'AUDIO_ONLY':
        await this.transitionToAudioOnly();
        break;
      case 'CHAT_ONLY':
        await this.transitionToChatOnly();
        break;
      default:
        throw new Error(`Unknown target mode: ${targetMode.name}`);
    }
  }

  /**
   * Transition to reduced video quality
   */
  async transitionToReducedVideo() {
    console.log('📉 Transitioning to reduced video quality');

    if (!this.tracks.video || !this.agoraClient) {
      throw new Error('Video track or client not available');
    }

    try {
      // Reduce video quality significantly
      await this.tracks.video.setEncoderConfiguration({
        width: 320,
        height: 240,
        frameRate: 15,
        bitrate: 200 // Very low bitrate
      });

      // Also reduce audio quality if possible
      if (this.tracks.audio && this.tracks.audio.setVolume) {
        this.tracks.audio.setVolume(80); // Slightly reduce volume for bandwidth
      }

      console.log('✅ Reduced video quality applied');

    } catch (error) {
      console.error('Failed to apply reduced video settings:', error);
      throw error;
    }
  }

  /**
   * Transition to audio-only mode
   */
  async transitionToAudioOnly() {
    console.log('🎙️ Transitioning to audio-only mode');

    try {
      // Stop and unpublish video track
      if (this.tracks.video && this.agoraClient) {
        await this.agoraClient.unpublish(this.tracks.video);
        this.tracks.video.stop();
        this.tracks.video = null;
        console.log('📹 Video track stopped and unpublished');
      }

      // Stop screen sharing if active
      if (this.tracks.screen && this.agoraClient) {
        await this.agoraClient.unpublish(this.tracks.screen);
        this.tracks.screen.stop();
        this.tracks.screen = null;
        console.log('🖥️ Screen sharing stopped');
      }

      // Ensure audio is still working
      if (!this.tracks.audio) {
        throw new Error('No audio track available for audio-only mode');
      }

      // Optimize audio for better quality
      if (this.tracks.audio.setVolume) {
        this.tracks.audio.setVolume(100);
      }

      console.log('✅ Audio-only mode activated');

    } catch (error) {
      console.error('Failed to transition to audio-only:', error);
      throw error;
    }
  }

  /**
   * Transition to chat-only mode
   */
  async transitionToChatOnly() {
    console.log('💬 Transitioning to chat-only mode');

    try {
      // Stop all media tracks
      if (this.tracks.audio && this.agoraClient) {
        await this.agoraClient.unpublish(this.tracks.audio);
        this.tracks.audio.stop();
        this.tracks.audio = null;
        console.log('🎙️ Audio track stopped');
      }

      if (this.tracks.video && this.agoraClient) {
        await this.agoraClient.unpublish(this.tracks.video);
        this.tracks.video.stop();
        this.tracks.video = null;
        console.log('📹 Video track stopped');
      }

      if (this.tracks.screen && this.agoraClient) {
        await this.agoraClient.unpublish(this.tracks.screen);
        this.tracks.screen.stop();
        this.tracks.screen = null;
        console.log('🖥️ Screen sharing stopped');
      }

      // Leave RTC channel
      if (this.agoraClient) {
        await this.agoraClient.leave();
        console.log('👋 Left RTC channel');
      }

      // Ensure chat connection is available
      if (!this.chatConnected) {
        throw new Error('Chat connection not available for chat-only mode');
      }

      console.log('✅ Chat-only mode activated');

    } catch (error) {
      console.error('Failed to transition to chat-only:', error);
      throw error;
    }
  }

  /**
   * Attempt recovery to a better mode
   */
  async attemptRecovery(networkQuality = null) {
    if (this.transitionInProgress || !this.isFallbackActive) {
      return false;
    }

    console.log('🔄 Attempting recovery to better mode');

    // Determine if we can recover
    const betterMode = this.getBetterMode(networkQuality);
    
    if (!betterMode) {
      console.log('ℹ️ No better mode available for recovery');
      return false;
    }

    // Check if conditions are suitable for recovery
    if (!this.canRecoverTo(betterMode, networkQuality)) {
      console.log(`❌ Conditions not suitable for recovery to ${betterMode.name}`);
      return false;
    }

    try {
      this.transitionInProgress = true;
      
      this.notifyListeners('recovery-started', {
        fromMode: this.currentMode.name,
        toMode: betterMode.name,
        networkQuality
      });

      await this.recoverToMode(betterMode);
      
      const previousMode = this.currentMode;
      this.currentMode = betterMode;
      this.transitionInProgress = false;

      // If fully recovered, clear fallback state
      if (betterMode.name === 'FULL_VIDEO') {
        this.isFallbackActive = false;
        this.fallbackReason = null;
      }

      console.log(`✅ Recovery successful: ${this.currentMode.label}`);
      
      this.notifyListeners('recovery-completed', {
        fromMode: previousMode.name,
        toMode: this.currentMode.name,
        timestamp: Date.now()
      });

      return true;

    } catch (error) {
      console.error('❌ Recovery failed:', error);
      
      this.transitionInProgress = false;
      
      this.notifyListeners('recovery-failed', {
        targetMode: betterMode.name,
        error: error.message
      });

      return false;
    }
  }

  /**
   * Get a better mode for recovery
   */
  getBetterMode(networkQuality) {
    const currentPriority = this.currentMode.priority;
    
    // Find the best mode we can recover to based on network quality
    for (let i = 0; i < this.modes.length; i++) {
      const mode = this.modes[i];
      
      if (mode.priority < currentPriority) {
        // Check if network quality supports this mode
        if (this.modeSupported(mode, networkQuality)) {
          return mode;
        }
      }
    }
    
    return null;
  }

  /**
   * Check if we can recover to a specific mode
   */
  canRecoverTo(mode, networkQuality) {
    // Check network quality requirements
    const minQuality = this.getMinNetworkQuality(mode);
    if (networkQuality && networkQuality < minQuality) {
      return false;
    }

    // Check connection requirements
    if (mode.requirements.rtc && !this.agoraClient) {
      return false;
    }

    if (mode.requirements.video && !this.canCreateVideoTrack()) {
      return false;
    }

    if (mode.requirements.audio && !this.canCreateAudioTrack()) {
      return false;
    }

    return true;
  }

  /**
   * Check if mode is supported given network quality
   */
  modeSupported(mode, networkQuality) {
    const minQuality = this.getMinNetworkQuality(mode);
    return !networkQuality || networkQuality >= minQuality;
  }

  /**
   * Get minimum network quality required for mode
   */
  getMinNetworkQuality(mode) {
    const qualityRequirements = {
      'FULL_VIDEO': 4,
      'REDUCED_VIDEO': 3,
      'AUDIO_ONLY': 2,
      'CHAT_ONLY': 1
    };
    
    return qualityRequirements[mode.name] || 2;
  }

  /**
   * Check if we can create video track
   */
  canCreateVideoTrack() {
    return navigator.mediaDevices && 
           typeof navigator.mediaDevices.getUserMedia === 'function';
  }

  /**
   * Check if we can create audio track
   */
  canCreateAudioTrack() {
    return navigator.mediaDevices && 
           typeof navigator.mediaDevices.getUserMedia === 'function';
  }

  /**
   * Recover to a specific mode
   */
  async recoverToMode(targetMode) {
    console.log(`🔄 Recovering to ${targetMode.label}`);

    // This should be implemented by the calling code with specific recovery logic
    switch (targetMode.name) {
      case 'FULL_VIDEO':
        await this.recoverToFullVideo();
        break;
      case 'REDUCED_VIDEO':
        await this.recoverToReducedVideo();
        break;
      case 'AUDIO_ONLY':
        await this.recoverToAudioOnly();
        break;
      default:
        throw new Error(`Recovery to ${targetMode.name} not implemented`);
    }
  }

  /**
   * Recover to full video mode
   */
  async recoverToFullVideo() {
    console.log('🎥 Recovering to full video mode');
    // Implementation should be provided by calling code
    throw new Error('recoverToFullVideo must be implemented by calling code');
  }

  /**
   * Recover to reduced video mode
   */
  async recoverToReducedVideo() {
    console.log('📹 Recovering to reduced video mode');
    // Implementation should be provided by calling code
    throw new Error('recoverToReducedVideo must be implemented by calling code');
  }

  /**
   * Recover to audio only mode
   */
  async recoverToAudioOnly() {
    console.log('🎙️ Recovering to audio-only mode');
    // Implementation should be provided by calling code
    throw new Error('recoverToAudioOnly must be implemented by calling code');
  }

  /**
   * Handle chat connection failure
   */
  handleChatFailure() {
    console.error('💬 Chat connection failed in chat-only mode');
    
    this.notifyListeners('chat-failure', {
      mode: this.currentMode.name,
      timestamp: Date.now()
    });

    // Could try to reconnect chat or notify user of complete failure
  }

  /**
   * Get available modes based on current conditions
   */
  getAvailableModes() {
    return this.modes.filter(mode => {
      if (mode.requirements.rtc && !this.agoraClient) return false;
      if (mode.requirements.video && !this.canCreateVideoTrack()) return false;
      if (mode.requirements.audio && !this.canCreateAudioTrack()) return false;
      return true;
    });
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      currentMode: this.currentMode.name,
      currentModeLabel: this.currentMode.label,
      isFallbackActive: this.isFallbackActive,
      fallbackReason: this.fallbackReason,
      transitionInProgress: this.transitionInProgress,
      targetMode: this.targetMode?.name,
      availableModes: this.getAvailableModes().map(m => m.name),
      chatConnected: this.chatConnected,
      modeAttempts: Object.fromEntries(this.modeAttempts),
      fallbackHistory: this.fallbackHistory.slice(-10) // Last 10 entries
    };
  }

  /**
   * Update track references
   */
  updateTracks(tracks) {
    this.tracks = { ...this.tracks, ...tracks };
    
    this.notifyListeners('tracks-updated', {
      tracks: Object.keys(tracks),
      timestamp: Date.now()
    });
  }

  /**
   * Force mode change (for testing or manual override)
   */
  async forceMode(modeName, reason = 'MANUAL_OVERRIDE') {
    const targetMode = this.modes.find(m => m.name === modeName);
    if (!targetMode) {
      throw new Error(`Unknown mode: ${modeName}`);
    }

    return this.triggerFallback(reason, null, targetMode);
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
          console.error(`Error in fallback listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    console.log('🧹 Destroying Fallback Manager');

    // Clean up references
    this.agoraClient = null;
    this.tracks = { audio: null, video: null, screen: null };
    this.chatSocket = null;

    // Clear listeners
    this.listeners.clear();

    // Reset state
    this.transitionInProgress = false;
    this.isFallbackActive = false;
  }
}

export default FallbackManager;