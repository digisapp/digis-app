import toast from 'react-hot-toast';

class FastChannelSwitcher {
  constructor(agoraClient, options = {}) {
    this.client = agoraClient;
    this.options = {
      preloadChannels: options.preloadChannels || false,
      enableOptimizedFirstFrame: options.enableOptimizedFirstFrame || true,
      cacheSize: options.cacheSize || 3,
      useSDRTN: options.useSDRTN || true,
      ...options
    };
    
    this.channelCache = new Map();
    this.currentChannel = null;
    this.switchingInProgress = false;
    this.preconnectedClients = new Map();
    
    // Performance metrics
    this.metrics = {
      switchTime: [],
      firstFrameTime: [],
      averageSwitchTime: 0
    };
    
    // Configure client for optimal performance
    this.configureClientOptimizations();
  }

  configureClientOptimizations() {
    if (!this.client) return;
    
    try {
      // Enable Agora Global SD-RTN for optimal routing
      this.client.setParameters({
        // Enable Global SD-RTN
        "rtc.sd_rtn.enabled": true,
        
        // Optimize for fast channel switching
        "rtc.channel_switch.optimization": true,
        
        // Enable fast first frame rendering
        "rtc.video.quick_intra_frame": true,
        "rtc.video.enable_quick_decode": true,
        
        // Network optimization
        "rtc.network.tcp_fast_open": true,
        "rtc.network.dns_prefetch": true,
        
        // Reduce join channel time
        "rtc.join_channel_optimization": true,
        
        // Enable aggressive pre-buffering
        "rtc.video.prebuffer_frame_count": 3,
        
        // Optimize for live streaming
        "rtc.live_streaming.optimization": true
      });
      
      console.log('✅ Fast channel switching optimizations enabled');
      console.log('✅ Agora Global SD-RTN enabled');
    } catch (error) {
      console.error('Failed to configure optimizations:', error);
    }
  }

  async preconnectChannel(channelName, token, uid) {
    if (this.preconnectedClients.has(channelName)) {
      return this.preconnectedClients.get(channelName);
    }
    
    try {
      // Create a shadow client for preconnection
      const shadowClient = this.client.constructor.createClient({ 
        mode: 'rtc', 
        codec: 'vp8' 
      });
      
      // Configure shadow client
      shadowClient.setParameters({
        "rtc.channel_preconnect": true,
        "rtc.video.prebuffer": true
      });
      
      // Pre-establish connection without joining
      await shadowClient.init(this.client.appId);
      
      this.preconnectedClients.set(channelName, {
        client: shadowClient,
        token,
        uid,
        timestamp: Date.now()
      });
      
      // Clean up old preconnections
      this.cleanupOldPreconnections();
      
      return shadowClient;
    } catch (error) {
      console.error('Preconnection failed:', error);
      return null;
    }
  }

  async switchChannel(newChannel, token, uid, options = {}) {
    if (this.switchingInProgress) {
      console.warn('Channel switch already in progress');
      return false;
    }
    
    if (this.currentChannel === newChannel) {
      console.log('Already in channel:', newChannel);
      return true;
    }
    
    this.switchingInProgress = true;
    const startTime = performance.now();
    
    try {
      // Check for preconnected client
      const preconnected = this.preconnectedClients.get(newChannel);
      
      if (preconnected && Date.now() - preconnected.timestamp < 30000) {
        // Use preconnected client for ultra-fast switching
        console.log('🚀 Using preconnected client for instant switch');
        
        // Quick leave current channel
        if (this.currentChannel) {
          await this.quickLeave();
        }
        
        // Switch to preconnected client
        this.client = preconnected.client;
        await this.client.join(null, newChannel, token, uid);
        
        this.preconnectedClients.delete(newChannel);
      } else {
        // Standard optimized channel switch
        if (this.currentChannel) {
          // Use optimized leave strategy
          await this.optimizedLeave();
        }
        
        // Optimized join with first frame acceleration
        await this.optimizedJoin(newChannel, token, uid);
      }
      
      const switchTime = performance.now() - startTime;
      this.recordMetric('switchTime', switchTime);
      
      console.log(`✅ Channel switched in ${switchTime.toFixed(0)}ms`);
      
      if (switchTime < 500) {
        // toast.success('Lightning fast channel switch! ⚡', {
        //   duration: 2000,
        //   icon: '🚀'
        // });
      }
      
      this.currentChannel = newChannel;
      this.switchingInProgress = false;
      
      // Preconnect next likely channels if enabled
      if (this.options.preloadChannels && options.nextChannels) {
        this.preconnectNextChannels(options.nextChannels);
      }
      
      return true;
    } catch (error) {
      console.error('Channel switch failed:', error);
      this.switchingInProgress = false;
      throw error;
    }
  }

  async optimizedLeave() {
    // Don't wait for full cleanup, do it asynchronously
    const leavePromise = this.client.leave();
    
    // Continue with minimal cleanup while leave is processing
    setTimeout(async () => {
      try {
        await leavePromise;
      } catch (error) {
        console.warn('Leave channel error (non-blocking):', error);
      }
    }, 0);
    
    // Return immediately for faster switching
    return Promise.resolve();
  }

  async quickLeave() {
    // Ultra-fast leave without waiting
    this.client.leave().catch(e => console.warn('Quick leave error:', e));
    return Promise.resolve();
  }

  async optimizedJoin(channel, token, uid) {
    // Configure for fast join
    this.client.setParameters({
      "rtc.join_channel_fast": true,
      "rtc.video.quick_start": true
    });
    
    // Join with optimizations
    const joinPromise = this.client.join(null, channel, token, uid);
    
    // Set up first frame optimization
    this.setupFirstFrameOptimization();
    
    await joinPromise;
  }

  setupFirstFrameOptimization() {
    const firstFrameStart = performance.now();
    
    // Listen for first video frame
    const handleFirstFrame = (user) => {
      const renderTime = performance.now() - firstFrameStart;
      this.recordMetric('firstFrameTime', renderTime);
      
      console.log(`🎥 First frame rendered in ${renderTime.toFixed(0)}ms`);
      
      if (renderTime < 300) {
        console.log('⚡ Ultra-fast first frame rendering achieved!');
      }
      
      // Remove listener after first frame
      this.client.off('user-published', handleFirstFrame);
    };
    
    this.client.on('user-published', handleFirstFrame);
  }

  async preconnectNextChannels(channels) {
    // Preconnect up to 3 channels in background
    const channelsToPreconnect = channels.slice(0, this.options.cacheSize);
    
    for (const { channel, token, uid } of channelsToPreconnect) {
      // Stagger preconnections to avoid overload
      setTimeout(() => {
        this.preconnectChannel(channel, token, uid);
      }, Math.random() * 1000);
    }
  }

  cleanupOldPreconnections() {
    const now = Date.now();
    const maxAge = 30000; // 30 seconds
    
    for (const [channel, data] of this.preconnectedClients.entries()) {
      if (now - data.timestamp > maxAge) {
        data.client.leave().catch(() => {});
        this.preconnectedClients.delete(channel);
      }
    }
  }

  recordMetric(type, value) {
    this.metrics[type].push(value);
    
    // Keep only last 10 measurements
    if (this.metrics[type].length > 10) {
      this.metrics[type].shift();
    }
    
    // Calculate average
    const avg = this.metrics[type].reduce((a, b) => a + b, 0) / this.metrics[type].length;
    this.metrics[`average${type.charAt(0).toUpperCase() + type.slice(1)}`] = avg;
  }

  getMetrics() {
    return {
      ...this.metrics,
      preconnectedChannels: this.preconnectedClients.size,
      currentChannel: this.currentChannel
    };
  }

  async destroy() {
    // Clean up all preconnected clients
    for (const [channel, data] of this.preconnectedClients.entries()) {
      try {
        await data.client.leave();
      } catch (error) {
        console.warn('Error cleaning up preconnected client:', error);
      }
    }
    
    this.preconnectedClients.clear();
    this.channelCache.clear();
  }
}

export default FastChannelSwitcher;