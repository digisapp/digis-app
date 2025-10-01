/**
 * Agora SDK Dynamic Loader
 * 
 * Provides lazy loading capabilities for Agora RTC SDK to reduce initial bundle size.
 * Loads SDK components only when needed for video calls.
 * 
 * Features:
 * - Retry logic for network resilience
 * - Device permission error handling
 * - Version management through environment variables
 * - Enhanced error propagation
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
   * Retry helper for network resilience
   */
  async _retry(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        
        console.warn(`⚠️ Retry ${i + 1}/${maxRetries} for Agora SDK load: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))); // Exponential backoff
      }
    }
  }

  /**
   * Fallback to load Agora from CDN with retry logic
   */
  async _loadAgoraFromCDN() {
    const version = import.meta.env.VITE_AGORA_RTC_VERSION || '4.20.0';
    console.log(`📡 Loading Agora RTC v${version} from CDN...`);
    
    return this._retry(() => new Promise((resolve, reject) => {
      if (window.AgoraRTC) {
        console.log('✅ Agora RTC already available in window');
        resolve(window.AgoraRTC);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://download.agora.io/sdk/release/AgoraRTC_N-${version}.js`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      
      // SRI (Subresource Integrity) for security
      // NOTE: These hashes need to be updated for each Agora SDK version
      // Generate using: https://www.srihash.org/ or 
      // openssl dgst -sha384 -binary AgoraRTC_N-4.20.0.js | openssl base64 -A
      const integrityHashes = {
        '4.20.0': 'sha384-PLACEHOLDER-UPDATE-WITH-ACTUAL-HASH-FOR-4.20.0',
        '4.19.0': 'sha384-PLACEHOLDER-UPDATE-WITH-ACTUAL-HASH-FOR-4.19.0',
        // Add more versions as needed
      };
      
      if (integrityHashes[version]) {
        script.integrity = integrityHashes[version];
      } else {
        console.warn(`⚠️ No SRI hash available for Agora RTC v${version}. Loading without integrity check.`);
      }
      
      const timeout = setTimeout(() => {
        script.remove();
        reject(new Error('Agora RTC CDN load timeout'));
      }, 30000); // 30 second timeout
      
      script.onload = () => {
        clearTimeout(timeout);
        if (window.AgoraRTC) {
          console.log('✅ Agora RTC loaded from CDN');
          resolve(window.AgoraRTC);
        } else {
          reject(new Error('Agora RTC not available after CDN load'));
        }
      };
      
      script.onerror = (error) => {
        clearTimeout(timeout);
        script.remove();
        reject(new Error(`Failed to load Agora RTC from CDN: ${error.message || 'Network error'}`));
      };
      
      document.head.appendChild(script);
    }), 3, 2000); // 3 retries with 2 second initial delay
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
   * Load RTM from CDN with retry logic
   */
  async _loadRTMFromCDN() {
    const version = import.meta.env.VITE_AGORA_RTM_VERSION || '1.5.1';
    console.log(`📡 Loading Agora RTM v${version} from CDN...`);
    
    return this._retry(() => new Promise((resolve, reject) => {
      if (window.AgoraRTM) {
        resolve(window.AgoraRTM);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://download.agora.io/sdk/release/AgoraRTM-${version}.js`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      
      // SRI (Subresource Integrity) for security
      const rtmIntegrityHashes = {
        '1.5.1': 'sha384-PLACEHOLDER-UPDATE-WITH-ACTUAL-HASH-FOR-RTM-1.5.1',
        '1.5.0': 'sha384-PLACEHOLDER-UPDATE-WITH-ACTUAL-HASH-FOR-RTM-1.5.0',
        // Add more versions as needed
      };
      
      if (rtmIntegrityHashes[version]) {
        script.integrity = rtmIntegrityHashes[version];
      } else {
        console.warn(`⚠️ No SRI hash available for Agora RTM v${version}. Loading without integrity check.`);
      }
      
      const timeout = setTimeout(() => {
        script.remove();
        reject(new Error('Agora RTM CDN load timeout'));
      }, 30000); // 30 second timeout
      
      script.onload = () => {
        clearTimeout(timeout);
        if (window.AgoraRTM) {
          this.features.rtm = true;
          console.log('✅ Agora RTM loaded from CDN');
          resolve(window.AgoraRTM);
        } else {
          reject(new Error('Agora RTM not available after CDN load'));
        }
      };
      
      script.onerror = (error) => {
        clearTimeout(timeout);
        script.remove();
        reject(new Error(`Failed to load Agora RTM from CDN: ${error.message || 'Network error'}`));
      };
      
      document.head.appendChild(script);
    }), 3, 2000); // 3 retries with 2 second initial delay
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
   * Load virtual background extension with retry
   */
  async _loadVirtualBackgroundExtension() {
    const version = import.meta.env.VITE_AGORA_EXTENSIONS_VERSION || '4.20.0';
    
    return this._retry(() => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://download.agora.io/sdk/release/VirtualBackground-${version}.js`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      
      // SRI (Subresource Integrity) for security
      const vbIntegrityHashes = {
        '4.20.0': 'sha384-PLACEHOLDER-UPDATE-WITH-ACTUAL-HASH-FOR-VB-4.20.0',
        '4.19.0': 'sha384-PLACEHOLDER-UPDATE-WITH-ACTUAL-HASH-FOR-VB-4.19.0',
        // Add more versions as needed
      };
      
      if (vbIntegrityHashes[version]) {
        script.integrity = vbIntegrityHashes[version];
      }
      
      const timeout = setTimeout(() => {
        script.remove();
        reject(new Error('Virtual Background extension load timeout'));
      }, 30000);
      
      script.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        reject(new Error('Failed to load Virtual Background extension'));
      };
      
      document.head.appendChild(script);
    }), 2, 2000);
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
   * Load beauty effects extension with retry
   */
  async _loadBeautyEffectsExtension() {
    const version = import.meta.env.VITE_AGORA_EXTENSIONS_VERSION || '4.20.0';
    
    return this._retry(() => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://download.agora.io/sdk/release/BeautyEffect-${version}.js`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      
      // SRI (Subresource Integrity) for security
      const beautyIntegrityHashes = {
        '4.20.0': 'sha384-PLACEHOLDER-UPDATE-WITH-ACTUAL-HASH-FOR-BEAUTY-4.20.0',
        '4.19.0': 'sha384-PLACEHOLDER-UPDATE-WITH-ACTUAL-HASH-FOR-BEAUTY-4.19.0',
        // Add more versions as needed
      };
      
      if (beautyIntegrityHashes[version]) {
        script.integrity = beautyIntegrityHashes[version];
      }
      
      const timeout = setTimeout(() => {
        script.remove();
        reject(new Error('Beauty Effects extension load timeout'));
      }, 30000);
      
      script.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        reject(new Error('Failed to load Beauty Effects extension'));
      };
      
      document.head.appendChild(script);
    }), 2, 2000);
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
   * Create media tracks with enhanced error handling
   */
  async createTracks(audioConfig = {}, videoConfig = {}) {
    if (!this.agoraRTC) {
      throw new Error('Agora RTC SDK not loaded. Call loadRTC() first.');
    }

    console.log('🎙️ Creating media tracks with config:', { audioConfig, videoConfig });
    
    const tracks = {};
    const errors = [];
    
    // Create audio track
    if (audioConfig.enabled !== false) {
      try {
        tracks.audioTrack = await this.agoraRTC.createMicrophoneAudioTrack({
          encoderConfig: audioConfig.encoderConfig || 'music_standard',
          AEC: audioConfig.AEC !== false, // Enable echo cancellation by default
          AGC: audioConfig.AGC !== false, // Enable automatic gain control by default
          ANS: audioConfig.ANS !== false, // Enable noise suppression by default
          ...audioConfig
        });
        console.log('✅ Audio track created');
      } catch (error) {
        const errorMessage = this._parseMediaError(error, 'microphone');
        console.error('❌ Audio track error:', errorMessage);
        errors.push({ type: 'audio', error: errorMessage });
        
        // Continue without audio if it fails
        if (!audioConfig.required) {
          console.warn('⚠️ Continuing without audio track');
        } else {
          throw new Error(errorMessage);
        }
      }
    }

    // Create video track
    if (videoConfig.enabled !== false) {
      try {
        tracks.videoTrack = await this.agoraRTC.createCameraVideoTrack({
          encoderConfig: videoConfig.encoderConfig || { width: 1280, height: 720, frameRate: 60, bitrate: 3500 },
          optimizationMode: videoConfig.optimizationMode || 'motion',
          ...videoConfig
        });
        console.log('✅ Video track created');
      } catch (error) {
        const errorMessage = this._parseMediaError(error, 'camera');
        console.error('❌ Video track error:', errorMessage);
        errors.push({ type: 'video', error: errorMessage });
        
        // Continue without video if it fails
        if (!videoConfig.required) {
          console.warn('⚠️ Continuing without video track');
        } else {
          throw new Error(errorMessage);
        }
      }
    }

    // If we have at least one track, return what we got
    if (Object.keys(tracks).length > 0) {
      console.log('✅ Media tracks created:', Object.keys(tracks));
      return { tracks, errors: errors.length > 0 ? errors : null };
    }
    
    // If no tracks were created and there were errors, throw
    if (errors.length > 0) {
      throw new Error(`Failed to create any media tracks: ${errors.map(e => e.error).join(', ')}`);
    }
    
    return { tracks, errors: null };
  }

  /**
   * Parse media device errors for better user feedback
   */
  _parseMediaError(error, deviceType) {
    const errorString = error.toString();
    const errorCode = error.code || error.name;
    
    // Common error patterns
    if (errorString.includes('Permission denied') || 
        errorString.includes('NotAllowedError') ||
        errorCode === 'PERMISSION_DENIED') {
      return `${deviceType} access denied. Please allow ${deviceType} access in your browser settings.`;
    }
    
    if (errorString.includes('NotFoundError') || 
        errorString.includes('DevicesNotFoundError') ||
        errorCode === 'DEVICE_NOT_FOUND') {
      return `No ${deviceType} found. Please connect a ${deviceType} and try again.`;
    }
    
    if (errorString.includes('NotReadableError') || 
        errorString.includes('TrackStartError') ||
        errorCode === 'DEVICE_BUSY') {
      return `${deviceType} is already in use by another application.`;
    }
    
    if (errorString.includes('OverconstrainedError')) {
      return `${deviceType} doesn't support the requested settings. Try with default settings.`;
    }
    
    if (errorString.includes('SecurityError')) {
      return `Security error accessing ${deviceType}. Make sure you're using HTTPS.`;
    }
    
    // Generic error
    return `Failed to access ${deviceType}: ${error.message || errorString}`;
  }

  /**
   * Create screen sharing track with enhanced error handling
   */
  async createScreenTrack(config = {}) {
    if (!this.agoraRTC) {
      throw new Error('Agora RTC SDK not loaded. Call loadRTC() first.');
    }

    console.log('🖥️ Creating screen sharing track with config:', config);
    
    try {
      const screenTrack = await this.agoraRTC.createScreenVideoTrack({
        encoderConfig: config.encoderConfig || '1080p_1',
        optimizationMode: config.optimizationMode || 'detail',
        ...config
      }, config.withAudio === true ? 'auto' : false);

      console.log('✅ Screen sharing track created');
      return screenTrack;
      
    } catch (error) {
      const errorMessage = this._parseScreenShareError(error);
      console.error('❌ Screen share error:', errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Parse screen share errors for better user feedback
   */
  _parseScreenShareError(error) {
    const errorString = error.toString();
    
    if (errorString.includes('Permission denied') || 
        errorString.includes('NotAllowedError')) {
      return 'Screen sharing permission denied. Please allow screen sharing when prompted.';
    }
    
    if (errorString.includes('NotFoundError')) {
      return 'No screen sources available for sharing.';
    }
    
    if (errorString.includes('NotReadableError')) {
      return 'Screen sharing failed. The selected screen may be restricted.';
    }
    
    if (errorString.includes('AbortError') || 
        errorString.includes('cancelled')) {
      return 'Screen sharing was cancelled.';
    }
    
    return `Screen sharing failed: ${error.message || errorString}`;
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