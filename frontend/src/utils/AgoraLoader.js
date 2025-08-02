/**
 * Agora SDK Dynamic Loader
 * 
 * Provides lazy loading capabilities for Agora RTC SDK to reduce initial bundle size.
 * Loads SDK components only when needed for video calls.
 */

class AgoraLoader {
  constructor() {
    this.agoraRTC = null;
    this.loadingPromise = null;
    this.isLoaded = false;
    this.loadStartTime = null;
    
    // Feature flags for different Agora components
    this.features = {
      rtc: false,
      rtm: false,
      recording: false,
      virtualBackground: false,
      beautyEffects: false
    };

    console.log('🔧 Agora Loader initialized');
  }

  /**
   * Load core Agora RTC SDK
   */
  async loadRTC() {
    if (this.isLoaded && this.agoraRTC) {
      return this.agoraRTC;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadStartTime = Date.now();
    console.log('📦 Loading Agora RTC SDK...');

    this.loadingPromise = this._loadAgoraRTC();
    
    try {
      this.agoraRTC = await this.loadingPromise;
      this.isLoaded = true;
      this.features.rtc = true;
      
      const loadTime = Date.now() - this.loadStartTime;
      console.log(`✅ Agora RTC SDK loaded successfully in ${loadTime}ms`);
      
      return this.agoraRTC;
    } catch (error) {
      console.error('❌ Failed to load Agora RTC SDK:', error);
      this.loadingPromise = null;
      throw error;
    }
  }

  /**
   * Internal method to load Agora RTC SDK
   */
  async _loadAgoraRTC() {
    try {
      // Dynamic import of Agora RTC SDK
      const AgoraRTC = await import('agora-rtc-sdk-ng');
      
      // Return the default export
      return AgoraRTC.default || AgoraRTC;
    } catch (error) {
      // Fallback to CDN if npm module fails
      console.warn('📡 NPM module failed, trying CDN fallback...');
      return this._loadAgoraFromCDN();
    }
  }

  /**
   * Fallback to load Agora from CDN
   */
  async _loadAgoraFromCDN() {
    return new Promise((resolve, reject) => {
      if (window.AgoraRTC) {
        resolve(window.AgoraRTC);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://download.agora.io/sdk/release/AgoraRTC_N-4.20.0.js';
      script.async = true;
      
      script.onload = () => {
        if (window.AgoraRTC) {
          console.log('✅ Agora RTC loaded from CDN');
          resolve(window.AgoraRTC);
        } else {
          reject(new Error('Agora RTC not available after CDN load'));
        }
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load Agora RTC from CDN'));
      };
      
      document.head.appendChild(script);
    });
  }

  /**
   * Load RTM (Real-Time Messaging) SDK
   */
  async loadRTM() {
    if (this.features.rtm) {
      return window.AgoraRTM;
    }

    console.log('📦 Loading Agora RTM SDK...');
    
    try {
      const AgoraRTM = await import('agora-rtm-sdk');
      this.features.rtm = true;
      console.log('✅ Agora RTM SDK loaded');
      return AgoraRTM.default || AgoraRTM;
    } catch (error) {
      console.warn('📡 Loading RTM from CDN fallback...');
      return this._loadRTMFromCDN();
    }
  }

  /**
   * Load RTM from CDN
   */
  async _loadRTMFromCDN() {
    return new Promise((resolve, reject) => {
      if (window.AgoraRTM) {
        resolve(window.AgoraRTM);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://download.agora.io/sdk/release/AgoraRTM-1.5.1.js';
      script.async = true;
      
      script.onload = () => {
        if (window.AgoraRTM) {
          this.features.rtm = true;
          console.log('✅ Agora RTM loaded from CDN');
          resolve(window.AgoraRTM);
        } else {
          reject(new Error('Agora RTM not available after CDN load'));
        }
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load Agora RTM from CDN'));
      };
      
      document.head.appendChild(script);
    });
  }

  /**
   * Load virtual background extension
   */
  async loadVirtualBackground() {
    if (this.features.virtualBackground) {
      return true;
    }

    console.log('📦 Loading Virtual Background extension...');
    
    try {
      // Load virtual background extension
      await this._loadVirtualBackgroundExtension();
      this.features.virtualBackground = true;
      console.log('✅ Virtual Background extension loaded');
      return true;
    } catch (error) {
      console.error('❌ Failed to load Virtual Background extension:', error);
      return false;
    }
  }

  /**
   * Load virtual background extension
   */
  async _loadVirtualBackgroundExtension() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://download.agora.io/sdk/release/VirtualBackground-4.20.0.js';
      script.async = true;
      
      script.onload = () => {
        resolve();
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load Virtual Background extension'));
      };
      
      document.head.appendChild(script);
    });
  }

  /**
   * Load beauty effects extension
   */
  async loadBeautyEffects() {
    if (this.features.beautyEffects) {
      return true;
    }

    console.log('📦 Loading Beauty Effects extension...');
    
    try {
      await this._loadBeautyEffectsExtension();
      this.features.beautyEffects = true;
      console.log('✅ Beauty Effects extension loaded');
      return true;
    } catch (error) {
      console.error('❌ Failed to load Beauty Effects extension:', error);
      return false;
    }
  }

  /**
   * Load beauty effects extension
   */
  async _loadBeautyEffectsExtension() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://download.agora.io/sdk/release/BeautyEffect-4.20.0.js';
      script.async = true;
      
      script.onload = () => {
        resolve();
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load Beauty Effects extension'));
      };
      
      document.head.appendChild(script);
    });
  }

  /**
   * Preload commonly used features
   */
  async preloadEssentials() {
    console.log('🚀 Preloading essential Agora components...');
    
    const startTime = Date.now();
    
    try {
      // Load RTC SDK (essential)
      await this.loadRTC();
      
      // Preload RTM in background (for chat fallback)
      this.loadRTM().catch(error => {
        console.warn('RTM preload failed:', error);
      });
      
      const loadTime = Date.now() - startTime;
      console.log(`✅ Essential components preloaded in ${loadTime}ms`);
      
    } catch (error) {
      console.error('❌ Failed to preload essential components:', error);
      throw error;
    }
  }

  /**
   * Load feature on demand
   */
  async loadFeature(featureName) {
    switch (featureName) {
      case 'rtc':
        return this.loadRTC();
      case 'rtm':
        return this.loadRTM();
      case 'virtualBackground':
        return this.loadVirtualBackground();
      case 'beautyEffects':
        return this.loadBeautyEffects();
      default:
        throw new Error(`Unknown feature: ${featureName}`);
    }
  }

  /**
   * Check if feature is loaded
   */
  isFeatureLoaded(featureName) {
    return this.features[featureName] || false;
  }

  /**
   * Get loading status
   */
  getLoadingStatus() {
    return {
      isLoaded: this.isLoaded,
      loadingInProgress: !!this.loadingPromise,
      features: { ...this.features },
      loadTime: this.loadStartTime ? Date.now() - this.loadStartTime : 0
    };
  }

  /**
   * Create client with loaded SDK
   */
  createClient(config = {}) {
    if (!this.agoraRTC) {
      throw new Error('Agora RTC SDK not loaded. Call loadRTC() first.');
    }

    console.log('🎥 Creating Agora client with config:', config);
    
    const client = this.agoraRTC.createClient({
      mode: config.mode || 'rtc',
      codec: config.codec || 'vp8',
      ...config
    });

    return client;
  }

  /**
   * Create media tracks with loaded SDK
   */
  async createTracks(audioConfig = {}, videoConfig = {}) {
    if (!this.agoraRTC) {
      throw new Error('Agora RTC SDK not loaded. Call loadRTC() first.');
    }

    console.log('🎙️ Creating media tracks...');
    
    const tracks = {};
    
    try {
      if (audioConfig.enabled !== false) {
        tracks.audioTrack = await this.agoraRTC.createMicrophoneAudioTrack({
          encoderConfig: audioConfig.encoderConfig || 'music_standard',
          ...audioConfig
        });
      }

      if (videoConfig.enabled !== false) {
        tracks.videoTrack = await this.agoraRTC.createCameraVideoTrack({
          encoderConfig: videoConfig.encoderConfig || '720p_1',
          optimizationMode: videoConfig.optimizationMode || 'motion',
          ...videoConfig
        });
      }

      console.log('✅ Media tracks created successfully');
      return tracks;
      
    } catch (error) {
      console.error('❌ Failed to create media tracks:', error);
      throw error;
    }
  }

  /**
   * Create screen sharing track
   */
  async createScreenTrack(config = {}) {
    if (!this.agoraRTC) {
      throw new Error('Agora RTC SDK not loaded. Call loadRTC() first.');
    }

    console.log('🖥️ Creating screen sharing track...');
    
    try {
      const screenTrack = await this.agoraRTC.createScreenVideoTrack({
        encoderConfig: config.encoderConfig || '1080p_1',
        optimizationMode: config.optimizationMode || 'detail',
        ...config
      });

      console.log('✅ Screen sharing track created');
      return screenTrack;
      
    } catch (error) {
      console.error('❌ Failed to create screen sharing track:', error);
      throw error;
    }
  }

  /**
   * Get SDK version info
   */
  getSDKInfo() {
    if (!this.agoraRTC) {
      return { loaded: false };
    }

    return {
      loaded: true,
      version: this.agoraRTC.VERSION || 'Unknown',
      features: { ...this.features },
      loadTime: this.loadStartTime ? Date.now() - this.loadStartTime : 0
    };
  }

  /**
   * Cleanup and reset
   */
  cleanup() {
    console.log('🧹 Cleaning up Agora Loader...');
    
    this.agoraRTC = null;
    this.loadingPromise = null;
    this.isLoaded = false;
    this.loadStartTime = null;
    
    this.features = {
      rtc: false,
      rtm: false,
      recording: false,
      virtualBackground: false,
      beautyEffects: false
    };
  }
}

// Create singleton instance
const agoraLoader = new AgoraLoader();

export default agoraLoader;