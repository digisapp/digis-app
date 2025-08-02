/**
 * Stream Quality Configuration
 * 
 * Centralized configuration for stream quality settings
 * Ensures 1440p (2K) minimum quality with adaptive fallback
 */

export const StreamQualityConfig = {
  // Default quality settings
  defaultQuality: '2k_1',
  defaultAdaptiveMode: '2k',
  
  // Quality profiles with Agora configurations
  qualityProfiles: {
    '4k': {
      resolution: { width: 3840, height: 2160 },
      frameRate: 30,
      bitrate: 8000,
      agoraProfile: null, // Custom configuration
      minNetworkBandwidth: 10000 // Kbps
    },
    '2k_1': {
      resolution: { width: 2560, height: 1440 },
      frameRate: 30,
      bitrate: 4000,
      agoraProfile: null, // Custom configuration
      minNetworkBandwidth: 5000
    },
    '1080p_1': {
      resolution: { width: 1920, height: 1080 },
      frameRate: 30,
      bitrate: 2000,
      agoraProfile: '1080p_1',
      minNetworkBandwidth: 2500
    },
    '720p_1': {
      resolution: { width: 1280, height: 720 },
      frameRate: 30,
      bitrate: 1200,
      agoraProfile: '720p_1',
      minNetworkBandwidth: 1500
    },
    '480p': {
      resolution: { width: 640, height: 480 },
      frameRate: 30,
      bitrate: 500,
      agoraProfile: '480p_4',
      minNetworkBandwidth: 800
    },
    '360p': {
      resolution: { width: 480, height: 360 },
      frameRate: 30,
      bitrate: 400,
      agoraProfile: '360p_7',
      minNetworkBandwidth: 600
    },
    '180p': {
      resolution: { width: 320, height: 180 },
      frameRate: 15,
      bitrate: 200,
      agoraProfile: '180p_4',
      minNetworkBandwidth: 300
    }
  },
  
  // Get encoder configuration for a quality level
  getEncoderConfig(quality) {
    const profile = this.qualityProfiles[quality];
    if (!profile) {
      console.warn(`Unknown quality profile: ${quality}, falling back to 1080p`);
      return this.getEncoderConfig('1080p_1');
    }
    
    // Return Agora preset or custom configuration
    if (profile.agoraProfile) {
      return profile.agoraProfile;
    }
    
    return {
      width: profile.resolution.width,
      height: profile.resolution.height,
      frameRate: profile.frameRate,
      bitrate: profile.bitrate,
      minBitrate: Math.floor(profile.bitrate * 0.7),
      maxBitrate: Math.floor(profile.bitrate * 1.5)
    };
  },
  
  // Get recommended quality based on network bandwidth
  getRecommendedQuality(bandwidthKbps) {
    // Try to maintain at least 1440p unless network conditions require lower
    if (bandwidthKbps >= 5000) return '2k_1';
    if (bandwidthKbps >= 2500) return '1080p_1';
    if (bandwidthKbps >= 1500) return '720p_1';
    if (bandwidthKbps >= 800) return '480p';
    if (bandwidthKbps >= 600) return '360p';
    return '180p';
  },
  
  // Get quality degradation path for adaptive streaming
  getQualityDegradationPath() {
    return ['2k_1', '1080p_1', '720p_1', '480p', '360p', '180p'];
  },
  
  // Check if device can support a quality level
  canDeviceSupport(quality, deviceType) {
    const profile = this.qualityProfiles[quality];
    if (!profile) return false;
    
    // Device limitations
    const deviceLimits = {
      'mobile': { maxWidth: 1280, maxHeight: 720 },
      'tablet': { maxWidth: 1920, maxHeight: 1080 },
      'desktop': { maxWidth: 3840, maxHeight: 2160 },
      'low-end-desktop': { maxWidth: 1280, maxHeight: 720 },
      'high-end-desktop': { maxWidth: 3840, maxHeight: 2160 }
    };
    
    const limit = deviceLimits[deviceType] || deviceLimits.desktop;
    return profile.resolution.width <= limit.maxWidth && 
           profile.resolution.height <= limit.maxHeight;
  },
  
  // Get best quality for device
  getBestQualityForDevice(deviceType) {
    const qualityOrder = ['4k', '2k_1', '1080p_1', '720p_1', '480p', '360p', '180p'];
    
    for (const quality of qualityOrder) {
      if (this.canDeviceSupport(quality, deviceType)) {
        return quality;
      }
    }
    
    return '480p'; // Fallback
  }
};

export default StreamQualityConfig;