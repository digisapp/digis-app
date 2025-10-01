/**
 * Adaptive Quality Controller
 * 
 * Automatically adjusts video quality based on network conditions,
 * device capabilities, and user preferences.
 */

import NetworkQualityMonitor from './NetworkQualityMonitor.js';
import { memoize } from 'lodash';

class AdaptiveQualityController {
  constructor(agoraClient, options = {}) {
    // Validate required parameters
    if (!agoraClient) {
      throw new Error('Agora client is required');
    }
    if (typeof options !== 'object') {
      throw new Error('Options must be an object');
    }
    
    this.client = agoraClient;
    this.options = {
      enableAdaptation: options.enableAdaptation !== false, // Default enabled
      adaptationInterval: options.adaptationInterval || 5000, // 5 seconds
      smoothTransitions: options.smoothTransitions !== false,
      userPreference: options.userPreference || '1080p', // Default to 1080p
      deviceType: options.deviceType || this.detectDeviceType(),
      maxResolution: options.maxResolution || this.getMaxResolution(),
      minResolution: options.minResolution || { width: 160, height: 120 },
      ...options
    };

    // Quality profiles for different conditions
    // Memoize profile initialization to avoid recalculation
    this.memoizedInitializeProfiles = memoize(
      this.initializeQualityProfiles.bind(this),
      () => `${this.options.deviceType}_${JSON.stringify(this.getDeviceCapabilityMultiplier())}`
    );
    this.qualityProfiles = this.memoizedInitializeProfiles();
    
    // Current state
    this.currentProfile = null;
    this.currentTracks = {
      video: null,
      audio: null
    };
    
    // Adaptation state
    this.lastAdaptation = 0;
    this.adaptationCount = 0;
    this.stabilityBuffer = [];
    
    // Initialize network monitor
    this.networkMonitor = new NetworkQualityMonitor(agoraClient, {
      monitorInterval: 2000
    });
    
    // Event listeners
    this.listeners = new Map();
    
    this.setupNetworkListeners();
    console.log('🎛️ Adaptive Quality Controller initialized');
  }

  /**
   * Initialize quality profiles for different conditions
   */
  initializeQualityProfiles() {
    const deviceMultiplier = this.getDeviceCapabilityMultiplier();
    
    return {
      minimal: {
        video: {
          width: Math.round(160 * deviceMultiplier.resolution),
          height: Math.round(120 * deviceMultiplier.resolution),
          frameRate: Math.round(10 * deviceMultiplier.frameRate),
          bitrate: Math.round(150 * deviceMultiplier.bitrate) // kbps
        },
        audio: {
          bitrate: 32, // kbps
          sampleRate: 16000
        },
        label: 'Minimal (160p)',
        networkRequirement: 200 // kbps
      },
      
      low: {
        video: {
          width: Math.round(320 * deviceMultiplier.resolution),
          height: Math.round(240 * deviceMultiplier.resolution),
          frameRate: Math.round(15 * deviceMultiplier.frameRate),
          bitrate: Math.round(300 * deviceMultiplier.bitrate)
        },
        audio: {
          bitrate: 48,
          sampleRate: 24000
        },
        label: 'Low (320p)',
        networkRequirement: 400
      },
      
      medium: {
        video: {
          width: Math.round(640 * deviceMultiplier.resolution),
          height: Math.round(480 * deviceMultiplier.resolution),
          frameRate: Math.round(24 * deviceMultiplier.frameRate),
          bitrate: Math.round(800 * deviceMultiplier.bitrate)
        },
        audio: {
          bitrate: 64,
          sampleRate: 44100
        },
        label: 'Medium (480p)',
        networkRequirement: 900
      },
      
      '720p_60': {
        video: {
          width: Math.round(1280 * deviceMultiplier.resolution),
          height: Math.round(720 * deviceMultiplier.resolution),
          frameRate: 60,
          bitrate: Math.round(2500 * deviceMultiplier.bitrate)
        },
        audio: {
          bitrate: 128,
          sampleRate: 48000
        },
        label: 'HD 720p@60fps',
        networkRequirement: 3000
      },

      '1080p': {
        video: {
          width: Math.round(1920 * deviceMultiplier.resolution),
          height: Math.round(1080 * deviceMultiplier.resolution),
          frameRate: Math.round(30 * deviceMultiplier.frameRate),
          bitrate: Math.round(3000 * deviceMultiplier.bitrate)
        },
        audio: {
          bitrate: 128,
          sampleRate: 48000
        },
        label: 'Full HD (1080p@30fps)',
        networkRequirement: 3500
      },

      '1080p_60': {
        video: {
          width: Math.round(1920 * deviceMultiplier.resolution),
          height: Math.round(1080 * deviceMultiplier.resolution),
          frameRate: Math.round(60 * deviceMultiplier.frameRate),
          bitrate: Math.round(4500 * deviceMultiplier.bitrate)
        },
        audio: {
          bitrate: 128,
          sampleRate: 48000
        },
        label: 'Full HD (1080p@60fps)',
        networkRequirement: 5000
      },

      ultra: {
        video: {
          width: Math.round(1920 * deviceMultiplier.resolution),
          height: Math.round(1080 * deviceMultiplier.resolution),
          frameRate: Math.round(60 * deviceMultiplier.frameRate),
          bitrate: Math.round(4500 * deviceMultiplier.bitrate)
        },
        audio: {
          bitrate: 128,
          sampleRate: 48000
        },
        label: 'Full HD (1080p@60fps)',
        networkRequirement: 5000
      },
      
      high: {
        video: {
          width: Math.round(1280 * deviceMultiplier.resolution),
          height: Math.round(720 * deviceMultiplier.resolution),
          frameRate: Math.round(30 * deviceMultiplier.frameRate),
          bitrate: Math.round(1500 * deviceMultiplier.bitrate)
        },
        audio: {
          bitrate: 128,
          sampleRate: 44100
        },
        label: 'HD (720p@30fps)',
        networkRequirement: 1800
      }
    };
  }

  /**
   * Detect device type for optimization
   */
  detectDeviceType() {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /mobile|android|iphone|ipad|tablet/.test(userAgent);
    const isTablet = /tablet|ipad/.test(userAgent);
    
    if (isMobile && !isTablet) return 'mobile';
    if (isTablet) return 'tablet';
    
    // Check for low-end devices
    const memory = navigator.deviceMemory || 4; // Default to 4GB if unknown
    const cores = navigator.hardwareConcurrency || 4;
    
    if (memory <= 2 || cores <= 2) return 'low-end-desktop';
    if (memory >= 8 && cores >= 8) return 'high-end-desktop';
    
    return 'desktop';
  }

  /**
   * Get device capability multiplier for quality adjustment
   */
  getDeviceCapabilityMultiplier() {
    const deviceCapabilities = {
      'mobile': { resolution: 0.6, frameRate: 0.8, bitrate: 0.7 },
      'tablet': { resolution: 0.8, frameRate: 0.9, bitrate: 0.85 },
      'low-end-desktop': { resolution: 0.7, frameRate: 0.8, bitrate: 0.8 },
      'desktop': { resolution: 1.0, frameRate: 1.0, bitrate: 1.0 },
      'high-end-desktop': { resolution: 1.0, frameRate: 1.0, bitrate: 1.2 }
    };
    
    return deviceCapabilities[this.options.deviceType] || deviceCapabilities.desktop;
  }

  /**
   * Get maximum resolution based on device
   */
  getMaxResolution() {
    const maxResolutions = {
      'mobile': { width: 1920, height: 1080 },
      'tablet': { width: 2560, height: 1440 },
      'low-end-desktop': { width: 1920, height: 1080 },
      'desktop': { width: 2560, height: 1440 },
      'high-end-desktop': { width: 3840, height: 2160 }
    };
    
    return maxResolutions[this.options.deviceType] || maxResolutions.desktop;
  }

  /**
   * Setup network quality listeners
   */
  setupNetworkListeners() {
    this.networkMonitor.on('quality-level-change', (data) => {
      this.handleQualityLevelChange(data);
    });

    this.networkMonitor.on('quality-change', (data) => {
      this.handleQualityChange(data);
    });

    this.networkMonitor.on('connection-change', (data) => {
      this.handleConnectionChange(data);
    });
  }

  /**
   * Start adaptive quality control
   */
  async start(videoTrack = null, audioTrack = null) {
    // Validate track parameters
    if (videoTrack && typeof videoTrack !== 'object') {
      throw new Error('Video track must be an object');
    }
    if (audioTrack && typeof audioTrack !== 'object') {
      throw new Error('Audio track must be an object');
    }
    
    if (videoTrack) this.currentTracks.video = videoTrack;
    if (audioTrack) this.currentTracks.audio = audioTrack;

    // Start network monitoring
    this.networkMonitor.start();

    // Set initial quality based on user preference
    await this.setInitialQuality();

    // Start adaptation loop if enabled
    if (this.options.enableAdaptation) {
      this.startAdaptationLoop();
    }

    this.notifyListeners('controller-started', {
      initialProfile: this.currentProfile?.label,
      deviceType: this.options.deviceType
    });

    console.log(`🎛️ Adaptive quality started with ${this.currentProfile?.label} profile`);
  }

  /**
   * Stop adaptive quality control
   */
  stop() {
    this.networkMonitor.stop();
    
    if (this.adaptationInterval) {
      clearInterval(this.adaptationInterval);
      this.adaptationInterval = null;
    }

    this.notifyListeners('controller-stopped', {});
    console.log('🎛️ Adaptive quality controller stopped');
  }

  /**
   * Set initial quality based on user preference and conditions
   */
  async setInitialQuality() {
    let targetProfile = '720p_60'; // Default to 720p@60fps

    if (this.options.userPreference !== 'auto') {
      targetProfile = this.options.userPreference;
    } else {
      // Auto-detect best initial quality - default to 720p@60fps
      const deviceType = this.options.deviceType;
      
      if (deviceType === 'mobile') {
        targetProfile = 'high'; // 720p@30fps for mobile devices
      } else if (deviceType === 'low-end-desktop') {
        targetProfile = 'high'; // 720p@30fps for low-end desktops
      } else {
        targetProfile = '720p_60'; // 720p@60fps for tablets and desktops
      }
    }

    await this.applyQualityProfile(targetProfile, 'initialization');
  }

  /**
   * Start the adaptation monitoring loop
   */
  startAdaptationLoop() {
    // Clear any existing interval
    if (this.adaptationInterval) {
      clearInterval(this.adaptationInterval);
    }
    
    this.adaptationInterval = setInterval(() => {
      this.evaluateAndAdapt();
    }, this.options.adaptationInterval);
  }

  /**
   * Evaluate current conditions and adapt quality if needed
   */
  async evaluateAndAdapt() {
    if (!this.options.enableAdaptation || this.options.userPreference !== 'auto') {
      return;
    }

    const now = Date.now();
    const timeSinceLastAdaptation = now - this.lastAdaptation;
    
    // Don't adapt too frequently
    if (timeSinceLastAdaptation < this.options.adaptationInterval * 0.8) {
      return;
    }

    const qualitySummary = this.networkMonitor.getQualitySummary();
    const recommendation = qualitySummary.recommendation;

    // Only adapt if there's a clear recommendation and quality is stable enough
    if (recommendation && this.shouldAdapt(recommendation, qualitySummary)) {
      await this.adaptToRecommendation(recommendation, qualitySummary);
    }
  }

  /**
   * Determine if we should adapt based on recommendation and stability
   */
  shouldAdapt(recommendation, qualitySummary) {
    // Don't adapt if quality is still stabilizing
    if (!qualitySummary.isStable && qualitySummary.trend === 'stable') {
      return false;
    }

    // Get target profile from recommendation
    const targetProfile = recommendation.profile;
    
    // Don't adapt if we're already at the recommended profile
    if (this.currentProfile && this.getProfileKey(this.currentProfile) === targetProfile) {
      return false;
    }

    // Be more conservative with upgrades than downgrades
    if (this.isUpgrade(targetProfile)) {
      return qualitySummary.qualityLevel === 'excellent' && qualitySummary.isStable;
    }

    // Allow downgrades more readily for poor quality
    if (this.isDowngrade(targetProfile)) {
      return ['poor', 'bad', 'veryBad'].includes(qualitySummary.qualityLevel);
    }

    return true;
  }

  /**
   * Check if target profile is an upgrade from current
   */
  isUpgrade(targetProfile) {
    const profileOrder = ['minimal', 'low', 'medium', 'high', '720p_60', 'ultra'];
    const currentIndex = profileOrder.indexOf(this.getProfileKey(this.currentProfile));
    const targetIndex = profileOrder.indexOf(targetProfile);
    
    return targetIndex > currentIndex;
  }

  /**
   * Check if target profile is a downgrade from current
   */
  isDowngrade(targetProfile) {
    const profileOrder = ['minimal', 'low', 'medium', 'high', '720p_60', 'ultra'];
    const currentIndex = profileOrder.indexOf(this.getProfileKey(this.currentProfile));
    const targetIndex = profileOrder.indexOf(targetProfile);
    
    return targetIndex < currentIndex;
  }

  /**
   * Get profile key from profile object
   */
  getProfileKey(profile) {
    if (!profile) return 'medium';
    
    for (const [key, profileData] of Object.entries(this.qualityProfiles)) {
      if (profileData === profile) return key;
    }
    return 'medium';
  }

  /**
   * Adapt to network quality recommendation
   */
  async adaptToRecommendation(recommendation, qualitySummary) {
    const targetProfile = recommendation.profile;
    
    try {
      await this.applyQualityProfile(targetProfile, 'network_adaptation');
      
      this.lastAdaptation = Date.now();
      this.adaptationCount++;

      console.log(`🔄 Quality adapted to ${this.currentProfile.label} (${recommendation.action})`);
      
      this.notifyListeners('quality-adapted', {
        fromProfile: this.getProfileKey(this.currentProfile),
        toProfile: targetProfile,
        reason: recommendation.action,
        networkQuality: qualitySummary.qualityLevel,
        metrics: qualitySummary.metrics
      });

    } catch (error) {
      console.error('Failed to adapt quality:', error);
      this.notifyListeners('adaptation-failed', { error: error.message, targetProfile });
    }
  }

  /**
   * Apply a specific quality profile
   */
  async applyQualityProfile(profileKey, reason = 'manual') {
    const profile = this.qualityProfiles[profileKey];
    if (!profile) {
      throw new Error(`Unknown quality profile: ${profileKey}`);
    }

    const previousProfile = this.currentProfile;
    this.currentProfile = profile;

    // Apply video quality changes
    if (this.currentTracks.video) {
      await this.applyVideoQuality(profile.video);
    }

    // Apply audio quality changes
    if (this.currentTracks.audio) {
      await this.applyAudioQuality(profile.audio);
    }

    this.notifyListeners('profile-applied', {
      profile: profileKey,
      reason,
      previousProfile: previousProfile?.label,
      currentProfile: profile.label
    });
  }

  /**
   * Apply video quality settings with error handling
   */
  async applyVideoQuality(videoConfig) {
    if (!this.currentTracks.video) return;
    
    // Validate video config
    if (!videoConfig || typeof videoConfig !== 'object') {
      throw new Error('Invalid video configuration');
    }

    try {
      // Ensure resolution doesn't exceed device maximum
      const maxRes = this.options.maxResolution;
      const minRes = this.options.minResolution;

      const finalConfig = {
        width: Math.min(Math.max(videoConfig.width, minRes.width), maxRes.width),
        height: Math.min(Math.max(videoConfig.height, minRes.height), maxRes.height),
        frameRate: Math.min(videoConfig.frameRate, 60),
        bitrate: videoConfig.bitrate
      };

      // Check if setEncoderConfiguration method exists
      if (typeof this.currentTracks.video.setEncoderConfiguration !== 'function') {
        console.warn('Video track does not support setEncoderConfiguration');
        return;
      }

      await this.currentTracks.video.setEncoderConfiguration(finalConfig);
      
      console.log(`📹 Video quality set to ${finalConfig.width}x${finalConfig.height}@${finalConfig.frameRate}fps, ${finalConfig.bitrate}kbps`);
      
      this.notifyListeners('video-quality-applied', { config: finalConfig });
      
    } catch (error) {
      console.error('Failed to apply video quality:', error);
      
      // Emit error event for external handling
      this.notifyListeners('video-quality-error', { 
        error: error.message, 
        config: videoConfig 
      });
      
      // Don't throw - continue operation
      // throw error;
    }
  }

  /**
   * Apply audio quality settings with error handling
   */
  async applyAudioQuality(audioConfig) {
    if (!this.currentTracks.audio) return;
    
    // Validate audio config
    if (!audioConfig || typeof audioConfig !== 'object') {
      throw new Error('Invalid audio configuration');
    }

    try {
      // Note: Agora SDK has limited runtime audio quality changes
      // Most audio settings are set during track creation
      
      if (typeof this.currentTracks.audio.setVolume === 'function') {
        // Ensure volume is appropriate for quality level
        const volume = audioConfig.bitrate >= 64 ? 100 : 80;
        this.currentTracks.audio.setVolume(volume);
      } else {
        console.warn('Audio track does not support setVolume');
      }

      console.log(`🔊 Audio quality set to ${audioConfig.bitrate}kbps, ${audioConfig.sampleRate}Hz`);
      
      this.notifyListeners('audio-quality-applied', { config: audioConfig });
      
    } catch (error) {
      console.error('Failed to apply audio quality:', error);
      
      // Emit error event for external handling
      this.notifyListeners('audio-quality-error', { 
        error: error.message, 
        config: audioConfig 
      });
    }
  }

  /**
   * Handle network quality level changes
   */
  handleQualityLevelChange(data) {
    console.log(`📡 Network quality changed: ${data.from} → ${data.to}`);
    
    // Add to stability buffer for trend analysis
    this.stabilityBuffer.push({
      level: data.to,
      timestamp: Date.now(),
      metrics: data.metrics
    });

    // Keep only recent entries
    if (this.stabilityBuffer.length > 10) {
      this.stabilityBuffer.shift();
    }
  }

  /**
   * Handle general quality changes
   */
  handleQualityChange(data) {
    // Update internal state with latest metrics
    this.latestMetrics = data.metrics;
    
    // Emit for external listeners
    this.notifyListeners('network-quality-change', data);
  }

  /**
   * Handle connection state changes
   */
  handleConnectionChange(data) {
    if (data.state === 'DISCONNECTED') {
      console.log('📡 Connection lost, pausing quality adaptation');
      // Could implement reconnection quality logic here
    } else if (data.state === 'CONNECTED') {
      console.log('📡 Connection restored, resuming quality adaptation');
      // Reset adaptation after reconnection
      this.lastAdaptation = 0;
    }

    this.notifyListeners('connection-change', data);
  }

  /**
   * Manually set user quality preference
   */
  async setUserPreference(preference) {
    // Validate preference
    const validPreferences = ['auto', 'minimal', 'low', 'medium', 'high', '720p_60', 'ultra'];
    if (!validPreferences.includes(preference)) {
      throw new Error(`Invalid preference: ${preference}. Must be one of: ${validPreferences.join(', ')}`);
    }
    
    this.options.userPreference = preference;
    
    if (preference === 'auto') {
      console.log('🎛️ Switched to automatic quality adaptation');
      // Resume automatic adaptation
      this.lastAdaptation = 0;
    } else {
      console.log(`🎛️ Manual quality set to: ${preference}`);
      await this.applyQualityProfile(preference, 'user_preference');
    }

    this.notifyListeners('user-preference-changed', {
      preference,
      currentProfile: this.currentProfile?.label
    });
  }

  /**
   * Update video track reference
   */
  updateVideoTrack(videoTrack) {
    this.currentTracks.video = videoTrack;
    
    // Apply current profile to new track
    if (this.currentProfile && videoTrack) {
      this.applyVideoQuality(this.currentProfile.video);
    }
  }

  /**
   * Update audio track reference
   */
  updateAudioTrack(audioTrack) {
    this.currentTracks.audio = audioTrack;
    
    // Apply current profile to new track
    if (this.currentProfile && audioTrack) {
      this.applyAudioQuality(this.currentProfile.audio);
    }
  }

  /**
   * Get current quality status
   */
  getQualityStatus() {
    const networkSummary = this.networkMonitor.getQualitySummary();
    
    return {
      currentProfile: this.currentProfile?.label,
      userPreference: this.options.userPreference,
      deviceType: this.options.deviceType,
      adaptationEnabled: this.options.enableAdaptation,
      adaptationCount: this.adaptationCount,
      networkQuality: networkSummary.qualityLevel,
      networkMetrics: networkSummary.metrics,
      recommendation: networkSummary.recommendation,
      availableProfiles: Object.keys(this.qualityProfiles)
    };
  }

  /**
   * Get detailed statistics
   */
  getStatistics() {
    return {
      qualityStatus: this.getQualityStatus(),
      networkData: this.networkMonitor.exportData(),
      adaptationHistory: {
        totalAdaptations: this.adaptationCount,
        lastAdaptation: this.lastAdaptation,
        stabilityBuffer: this.stabilityBuffer
      },
      deviceInfo: {
        type: this.options.deviceType,
        capabilities: this.getDeviceCapabilityMultiplier(),
        maxResolution: this.options.maxResolution
      }
    };
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
          console.error(`Error in quality controller listener:`, error);
        }
      });
    }
  }
}

export default AdaptiveQualityController;