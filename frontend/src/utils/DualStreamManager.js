import toast from 'react-hot-toast';

class DualStreamManager {
  constructor(agoraClient, options = {}) {
    this.client = agoraClient;
    this.options = {
      autoSwitch: options.autoSwitch !== false, // Auto-switch based on network
      highStreamBitrate: options.highStreamBitrate || 1500, // kbps
      lowStreamBitrate: options.lowStreamBitrate || 300, // kbps
      highStreamResolution: options.highStreamResolution || { width: 1280, height: 720 },
      lowStreamResolution: options.lowStreamResolution || { width: 320, height: 180 },
      highStreamFramerate: options.highStreamFramerate || 30,
      lowStreamFramerate: options.lowStreamFramerate || 15,
      networkThreshold: options.networkThreshold || 3, // Network quality threshold for switching
      ...options
    };
    
    this.isDualStreamEnabled = false;
    this.streamSubscriptions = new Map(); // Track which stream each user is subscribed to
    this.networkQualityMap = new Map(); // Track network quality for each user
    this.autoSwitchEnabled = this.options.autoSwitch;
    
    // Metrics
    this.metrics = {
      switchCount: 0,
      currentHighStreamUsers: 0,
      currentLowStreamUsers: 0,
      bandwidthSaved: 0
    };
  }

  async enableDualStream(videoTrack) {
    try {
      // Enable dual stream mode
      await this.client.enableDualStream();
      
      // Configure low stream parameters
      await this.client.setLowStreamParameter({
        width: this.options.lowStreamResolution.width,
        height: this.options.lowStreamResolution.height,
        framerate: this.options.lowStreamFramerate,
        bitrate: this.options.lowStreamBitrate
      });
      
      // If video track provided, configure its encoding
      if (videoTrack) {
        await this.configureVideoEncoding(videoTrack);
      }
      
      this.isDualStreamEnabled = true;
      
      // Set up network quality monitoring
      this.setupNetworkQualityMonitoring();
      
      console.log('✅ Dual stream enabled with configurations:', {
        high: {
          resolution: this.options.highStreamResolution,
          bitrate: this.options.highStreamBitrate,
          framerate: this.options.highStreamFramerate
        },
        low: {
          resolution: this.options.lowStreamResolution,
          bitrate: this.options.lowStreamBitrate,
          framerate: this.options.lowStreamFramerate
        }
      });
      
      // toast.success('Dual stream mode enabled for optimal performance', {
      //   duration: 3000,
      //   icon: '📡'
      // });
      
      return true;
    } catch (error) {
      console.error('Failed to enable dual stream:', error);
      toast.error('Failed to enable dual stream mode');
      return false;
    }
  }

  async disableDualStream() {
    try {
      await this.client.disableDualStream();
      this.isDualStreamEnabled = false;
      this.streamSubscriptions.clear();
      this.networkQualityMap.clear();
      
      console.log('Dual stream disabled');
      return true;
    } catch (error) {
      console.error('Failed to disable dual stream:', error);
      return false;
    }
  }

  async configureVideoEncoding(videoTrack) {
    try {
      // Set video encoder configuration for high quality stream
      await videoTrack.setVideoEncoderConfiguration({
        width: this.options.highStreamResolution.width,
        height: this.options.highStreamResolution.height,
        frameRate: this.options.highStreamFramerate,
        bitrateMin: this.options.highStreamBitrate * 0.7,
        bitrateMax: this.options.highStreamBitrate,
        orientationMode: 'adaptative'
      });
      
      console.log('Video encoding configured for dual stream');
    } catch (error) {
      console.error('Failed to configure video encoding:', error);
    }
  }

  setupNetworkQualityMonitoring() {
    // Monitor network quality for all users
    this.client.on('network-quality', (stats) => {
      // Update network quality map
      this.networkQualityMap.set(stats.uid, {
        uplinkNetworkQuality: stats.uplinkNetworkQuality,
        downlinkNetworkQuality: stats.downlinkNetworkQuality,
        timestamp: Date.now()
      });
      
      // Auto-switch streams based on network quality if enabled
      if (this.autoSwitchEnabled) {
        this.evaluateStreamSwitch(stats.uid, stats.downlinkNetworkQuality);
      }
    });
    
    // Monitor user published events
    this.client.on('user-published', async (user, mediaType) => {
      if (mediaType === 'video' && this.isDualStreamEnabled) {
        // Determine initial stream quality based on network
        const networkQuality = this.networkQualityMap.get(user.uid);
        const shouldUseLowStream = this.shouldUseLowStream(networkQuality);
        
        if (shouldUseLowStream) {
          await this.subscribeToLowStream(user.uid);
        } else {
          await this.subscribeToHighStream(user.uid);
        }
      }
    });
  }

  shouldUseLowStream(networkQuality) {
    if (!networkQuality) return false;
    
    // Use low stream if network quality is below threshold
    return networkQuality.downlinkNetworkQuality >= this.options.networkThreshold;
  }

  async evaluateStreamSwitch(uid, networkQuality) {
    const currentStream = this.streamSubscriptions.get(uid);
    const shouldBeLow = networkQuality >= this.options.networkThreshold;
    
    // Check if we need to switch
    if (currentStream === 'high' && shouldBeLow) {
      await this.switchToLowStream(uid);
    } else if (currentStream === 'low' && !shouldBeLow) {
      await this.switchToHighStream(uid);
    }
  }

  async subscribeToHighStream(uid) {
    try {
      await this.client.setRemoteVideoStreamType(uid, 0); // 0 = high stream
      this.streamSubscriptions.set(uid, 'high');
      this.updateMetrics();
      
      console.log(`Subscribed to high stream for user ${uid}`);
    } catch (error) {
      console.error(`Failed to subscribe to high stream for user ${uid}:`, error);
    }
  }

  async subscribeToLowStream(uid) {
    try {
      await this.client.setRemoteVideoStreamType(uid, 1); // 1 = low stream
      this.streamSubscriptions.set(uid, 'low');
      this.updateMetrics();
      
      // Calculate bandwidth saved
      const savedBandwidth = this.options.highStreamBitrate - this.options.lowStreamBitrate;
      this.metrics.bandwidthSaved += savedBandwidth;
      
      console.log(`Subscribed to low stream for user ${uid} (saving ${savedBandwidth} kbps)`);
    } catch (error) {
      console.error(`Failed to subscribe to low stream for user ${uid}:`, error);
    }
  }

  async switchToHighStream(uid) {
    const currentStream = this.streamSubscriptions.get(uid);
    if (currentStream === 'high') return;
    
    await this.subscribeToHighStream(uid);
    this.metrics.switchCount++;
    
    console.log(`Switched user ${uid} from low to high stream`);
  }

  async switchToLowStream(uid) {
    const currentStream = this.streamSubscriptions.get(uid);
    if (currentStream === 'low') return;
    
    await this.subscribeToLowStream(uid);
    this.metrics.switchCount++;
    
    console.log(`Switched user ${uid} from high to low stream`);
  }

  async setStreamTypeForUser(uid, streamType) {
    if (streamType === 'high') {
      await this.subscribeToHighStream(uid);
    } else {
      await this.subscribeToLowStream(uid);
    }
  }

  async setAutoSwitch(enabled) {
    this.autoSwitchEnabled = enabled;
    console.log(`Auto-switch ${enabled ? 'enabled' : 'disabled'}`);
    
    if (!enabled) {
      // Switch all users to high stream when auto-switch is disabled
      for (const [uid, stream] of this.streamSubscriptions.entries()) {
        if (stream === 'low') {
          await this.switchToHighStream(uid);
        }
      }
    }
  }

  updateMetrics() {
    let highCount = 0;
    let lowCount = 0;
    
    for (const stream of this.streamSubscriptions.values()) {
      if (stream === 'high') highCount++;
      else lowCount++;
    }
    
    this.metrics.currentHighStreamUsers = highCount;
    this.metrics.currentLowStreamUsers = lowCount;
  }

  getMetrics() {
    return {
      ...this.metrics,
      totalUsers: this.streamSubscriptions.size,
      averageBandwidthSaved: this.metrics.currentLowStreamUsers * (this.options.highStreamBitrate - this.options.lowStreamBitrate),
      dualStreamEnabled: this.isDualStreamEnabled,
      autoSwitchEnabled: this.autoSwitchEnabled
    };
  }

  getStreamStatus(uid) {
    return {
      currentStream: this.streamSubscriptions.get(uid) || 'unknown',
      networkQuality: this.networkQualityMap.get(uid),
      lastUpdate: this.networkQualityMap.get(uid)?.timestamp
    };
  }

  async optimizeForLargeAudience(threshold = 10) {
    // Enable more aggressive low stream usage for large audiences
    if (this.streamSubscriptions.size >= threshold) {
      console.log('Optimizing for large audience...');
      
      // Lower the network threshold to use low stream more often
      this.options.networkThreshold = 2;
      
      // Re-evaluate all current subscriptions
      for (const [uid, quality] of this.networkQualityMap.entries()) {
        await this.evaluateStreamSwitch(uid, quality.downlinkNetworkQuality);
      }
      
      // toast.success('Optimized for large audience streaming', {
      //   duration: 3000,
      //   icon: '🎯'
      // });
    }
  }

  destroy() {
    this.streamSubscriptions.clear();
    this.networkQualityMap.clear();
    this.isDualStreamEnabled = false;
  }
}

export default DualStreamManager;