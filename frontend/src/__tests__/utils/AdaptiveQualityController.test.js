/**
 * Adaptive Quality Controller Tests
 */

import AdaptiveQualityController from '../../utils/AdaptiveQualityController';
import NetworkQualityMonitor from '../../utils/NetworkQualityMonitor';

// Mock NetworkQualityMonitor
jest.mock('../../utils/NetworkQualityMonitor');

// Mock Agora client
const mockAgoraClient = {
  on: jest.fn(),
  off: jest.fn(),
  getStats: jest.fn(),
  getLocalVideoStats: jest.fn(),
  getLocalAudioStats: jest.fn(),
};

// Mock video and audio tracks
const mockVideoTrack = {
  setEncoderConfiguration: jest.fn().mockResolvedValue(),
  setEnabled: jest.fn().mockResolvedValue(),
  stop: jest.fn(),
  close: jest.fn(),
};

const mockAudioTrack = {
  setEnabled: jest.fn().mockResolvedValue(),
  setVolume: jest.fn(),
  stop: jest.fn(),
  close: jest.fn(),
};

// Mock navigator APIs
Object.defineProperty(global.navigator, 'userAgent', {
  writable: true,
  value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
});

Object.defineProperty(global.navigator, 'deviceMemory', {
  writable: true,
  value: 8,
});

Object.defineProperty(global.navigator, 'hardwareConcurrency', {
  writable: true,
  value: 8,
});

describe('AdaptiveQualityController', () => {
  let controller;
  let mockNetworkMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup NetworkQualityMonitor mock
    mockNetworkMonitor = {
      start: jest.fn(),
      stop: jest.fn(),
      on: jest.fn(),
      getQualitySummary: jest.fn().mockReturnValue({
        qualityLevel: 'good',
        trend: 'stable',
        isStable: true,
        recommendation: { profile: 'medium', action: 'maintain' },
        metrics: { rtt: 100, packetLoss: 1 }
      }),
      exportData: jest.fn(),
    };
    
    NetworkQualityMonitor.mockImplementation(() => mockNetworkMonitor);
    
    controller = new AdaptiveQualityController(mockAgoraClient);
  });

  afterEach(() => {
    if (controller) {
      controller.stop();
    }
  });

  describe('Initialization', () => {
    test('creates controller with default options', () => {
      expect(controller.options.enableAdaptation).toBe(true);
      expect(controller.options.userPreference).toBe('auto');
      expect(controller.options.deviceType).toBeDefined();
    });

    test('accepts custom options', () => {
      const customController = new AdaptiveQualityController(mockAgoraClient, {
        enableAdaptation: false,
        userPreference: 'high',
        deviceType: 'mobile',
      });
      
      expect(customController.options.enableAdaptation).toBe(false);
      expect(customController.options.userPreference).toBe('high');
      expect(customController.options.deviceType).toBe('mobile');
    });
  });

  describe('Device Detection', () => {
    test('detects desktop device correctly', () => {
      const deviceType = controller.detectDeviceType();
      expect(deviceType).toBe('high-end-desktop');
    });

    test('detects mobile device correctly', () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      });
      
      const mobileController = new AdaptiveQualityController(mockAgoraClient);
      const deviceType = mobileController.detectDeviceType();
      expect(deviceType).toBe('mobile');
    });

    test('detects low-end desktop correctly', () => {
      Object.defineProperty(global.navigator, 'deviceMemory', { value: 2 });
      Object.defineProperty(global.navigator, 'hardwareConcurrency', { value: 2 });
      
      const lowEndController = new AdaptiveQualityController(mockAgoraClient);
      const deviceType = lowEndController.detectDeviceType();
      expect(deviceType).toBe('low-end-desktop');
    });
  });

  describe('Quality Profiles', () => {
    test('initializes quality profiles correctly', () => {
      expect(controller.qualityProfiles).toHaveProperty('minimal');
      expect(controller.qualityProfiles).toHaveProperty('low');
      expect(controller.qualityProfiles).toHaveProperty('medium');
      expect(controller.qualityProfiles).toHaveProperty('high');
      expect(controller.qualityProfiles).toHaveProperty('ultra');
    });

    test('high profile has correct configuration', () => {
      const highProfile = controller.qualityProfiles.high;
      
      expect(highProfile.video.width).toBe(1280);
      expect(highProfile.video.height).toBe(720);
      expect(highProfile.video.frameRate).toBe(30);
      expect(highProfile.audio.bitrate).toBe(128);
    });

    test('mobile device profiles have reduced specs', () => {
      const mobileController = new AdaptiveQualityController(mockAgoraClient, {
        deviceType: 'mobile',
      });
      
      const highProfile = mobileController.qualityProfiles.high;
      expect(highProfile.video.width).toBeLessThan(1280);
      expect(highProfile.video.bitrate).toBeLessThan(1500);
    });
  });

  describe('Controller Lifecycle', () => {
    test('starts controller successfully', async () => {
      await controller.start(mockVideoTrack, mockAudioTrack);
      
      expect(mockNetworkMonitor.start).toHaveBeenCalled();
      expect(controller.currentTracks.video).toBe(mockVideoTrack);
      expect(controller.currentTracks.audio).toBe(mockAudioTrack);
    });

    test('stops controller successfully', () => {
      controller.start();
      controller.stop();
      
      expect(mockNetworkMonitor.stop).toHaveBeenCalled();
    });

    test('sets initial quality based on device type', async () => {
      await controller.start(mockVideoTrack, mockAudioTrack);
      
      expect(controller.currentProfile).toBeDefined();
      expect(mockVideoTrack.setEncoderConfiguration).toHaveBeenCalled();
    });
  });

  describe('Quality Adaptation', () => {
    beforeEach(async () => {
      await controller.start(mockVideoTrack, mockAudioTrack);
    });

    test('applies quality profile correctly', async () => {
      await controller.applyQualityProfile('medium', 'test');
      
      expect(mockVideoTrack.setEncoderConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({
          width: expect.any(Number),
          height: expect.any(Number),
          frameRate: expect.any(Number),
          bitrate: expect.any(Number),
        })
      );
    });

    test('respects device maximum resolution', async () => {
      controller.options.maxResolution = { width: 640, height: 480 };
      await controller.applyQualityProfile('ultra', 'test');
      
      const configCall = mockVideoTrack.setEncoderConfiguration.mock.calls[0][0];
      expect(configCall.width).toBeLessThanOrEqual(640);
      expect(configCall.height).toBeLessThanOrEqual(480);
    });

    test('handles video track errors gracefully', async () => {
      mockVideoTrack.setEncoderConfiguration.mockRejectedValueOnce(new Error('Config failed'));
      
      await expect(controller.applyQualityProfile('high', 'test')).rejects.toThrow('Config failed');
    });

    test('adapts to network recommendations', async () => {
      const recommendation = { profile: 'low', action: 'reduce' };
      const qualitySummary = {
        qualityLevel: 'poor',
        isStable: true,
        recommendation,
        metrics: { rtt: 300, packetLoss: 5 }
      };
      
      controller.shouldAdapt = jest.fn().mockReturnValue(true);
      await controller.adaptToRecommendation(recommendation, qualitySummary);
      
      expect(controller.currentProfile.label).toContain('Low');
    });
  });

  describe('Adaptation Logic', () => {
    test('should adapt for poor quality downgrades', () => {
      const recommendation = { profile: 'low', action: 'reduce' };
      const qualitySummary = {
        qualityLevel: 'poor',
        isStable: true,
        recommendation
      };
      
      controller.currentProfile = controller.qualityProfiles.medium;
      const shouldAdapt = controller.shouldAdapt(recommendation, qualitySummary);
      
      expect(shouldAdapt).toBe(true);
    });

    test('should not adapt for same profile recommendation', () => {
      const recommendation = { profile: 'medium', action: 'maintain' };
      const qualitySummary = {
        qualityLevel: 'good',
        isStable: true,
        recommendation
      };
      
      controller.currentProfile = controller.qualityProfiles.medium;
      const shouldAdapt = controller.shouldAdapt(recommendation, qualitySummary);
      
      expect(shouldAdapt).toBe(false);
    });

    test('should be conservative with upgrades', () => {
      const recommendation = { profile: 'high', action: 'maintain' };
      const qualitySummary = {
        qualityLevel: 'good', // Not excellent
        isStable: true,
        recommendation
      };
      
      controller.currentProfile = controller.qualityProfiles.medium;
      const shouldAdapt = controller.shouldAdapt(recommendation, qualitySummary);
      
      expect(shouldAdapt).toBe(false);
    });

    test('allows upgrades for excellent stable quality', () => {
      const recommendation = { profile: 'high', action: 'maintain' };
      const qualitySummary = {
        qualityLevel: 'excellent',
        isStable: true,
        recommendation
      };
      
      controller.currentProfile = controller.qualityProfiles.medium;
      const shouldAdapt = controller.shouldAdapt(recommendation, qualitySummary);
      
      expect(shouldAdapt).toBe(true);
    });
  });

  describe('User Preference Handling', () => {
    test('sets manual quality preference', async () => {
      await controller.start(mockVideoTrack, mockAudioTrack);
      await controller.setUserPreference('high');
      
      expect(controller.options.userPreference).toBe('high');
      expect(controller.currentProfile.label).toContain('High');
    });

    test('switches to automatic adaptation', async () => {
      await controller.start(mockVideoTrack, mockAudioTrack);
      await controller.setUserPreference('auto');
      
      expect(controller.options.userPreference).toBe('auto');
      expect(controller.lastAdaptation).toBe(0);
    });

    test('manual preference overrides adaptation', async () => {
      controller.options.userPreference = 'high';
      
      const canAdapt = controller.options.enableAdaptation && controller.options.userPreference === 'auto';
      expect(canAdapt).toBe(false);
    });
  });

  describe('Track Updates', () => {
    test('updates video track reference', () => {
      const newVideoTrack = { ...mockVideoTrack, id: 'new-video' };
      
      controller.updateVideoTrack(newVideoTrack);
      
      expect(controller.currentTracks.video).toBe(newVideoTrack);
    });

    test('updates audio track reference', () => {
      const newAudioTrack = { ...mockAudioTrack, id: 'new-audio' };
      
      controller.updateAudioTrack(newAudioTrack);
      
      expect(controller.currentTracks.audio).toBe(newAudioTrack);
    });

    test('applies current profile to new video track', async () => {
      await controller.start(mockVideoTrack, mockAudioTrack);
      const newVideoTrack = { ...mockVideoTrack, setEncoderConfiguration: jest.fn().mockResolvedValue() };
      
      controller.updateVideoTrack(newVideoTrack);
      
      expect(newVideoTrack.setEncoderConfiguration).toHaveBeenCalled();
    });
  });

  describe('Network Event Handling', () => {
    test('handles quality level changes', () => {
      const data = {
        from: 'good',
        to: 'poor',
        metrics: { rtt: 300, packetLoss: 5 }
      };
      
      controller.handleQualityLevelChange(data);
      
      expect(controller.stabilityBuffer).toContain(
        expect.objectContaining({
          level: 'poor',
          metrics: data.metrics
        })
      );
    });

    test('maintains limited stability buffer size', () => {
      // Fill buffer beyond limit
      for (let i = 0; i < 15; i++) {
        controller.handleQualityLevelChange({
          from: 'good',
          to: 'fair',
          metrics: { rtt: 100 + i }
        });
      }
      
      expect(controller.stabilityBuffer.length).toBeLessThanOrEqual(10);
    });

    test('handles connection state changes', () => {
      const mockListener = jest.fn();
      controller.on('connection-change', mockListener);
      
      controller.handleConnectionChange({ state: 'CONNECTED' });
      
      expect(mockListener).toHaveBeenCalledWith({ state: 'CONNECTED' });
    });
  });

  describe('Status and Statistics', () => {
    test('provides comprehensive quality status', async () => {
      await controller.start(mockVideoTrack, mockAudioTrack);
      
      const status = controller.getQualityStatus();
      
      expect(status).toMatchObject({
        currentProfile: expect.any(String),
        userPreference: expect.any(String),
        deviceType: expect.any(String),
        adaptationEnabled: expect.any(Boolean),
        adaptationCount: expect.any(Number),
        networkQuality: expect.any(String),
        availableProfiles: expect.any(Array),
      });
    });

    test('provides detailed statistics', async () => {
      await controller.start(mockVideoTrack, mockAudioTrack);
      
      const stats = controller.getStatistics();
      
      expect(stats).toMatchObject({
        qualityStatus: expect.any(Object),
        networkData: expect.any(Object),
        adaptationHistory: expect.any(Object),
        deviceInfo: expect.any(Object),
      });
    });
  });

  describe('Event System', () => {
    test('manages event listeners correctly', () => {
      const callback = jest.fn();
      
      controller.on('test-event', callback);
      controller.notifyListeners('test-event', { data: 'test' });
      
      expect(callback).toHaveBeenCalledWith({ data: 'test' });
      
      controller.off('test-event', callback);
      controller.notifyListeners('test-event', { data: 'test2' });
      
      expect(callback).toHaveBeenCalledTimes(1);
    });

    test('handles listener errors gracefully', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Listener error');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      controller.on('error-event', errorCallback);
      controller.notifyListeners('error-event', {});
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in quality controller listener'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    test('emits quality-adapted event on successful adaptation', async () => {
      const mockListener = jest.fn();
      controller.on('quality-adapted', mockListener);
      
      await controller.start(mockVideoTrack, mockAudioTrack);
      await controller.setUserPreference('low');
      
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          toProfile: 'low',
          reason: 'user_preference',
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('handles unknown quality profile gracefully', async () => {
      await expect(controller.applyQualityProfile('unknown', 'test')).rejects.toThrow('Unknown quality profile');
    });

    test('handles network monitor initialization failure', () => {
      NetworkQualityMonitor.mockImplementation(() => {
        throw new Error('Monitor init failed');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      expect(() => new AdaptiveQualityController(mockAgoraClient)).not.toThrow();
      
      consoleSpy.mockRestore();
    });

    test('continues operation when adaptation fails', async () => {
      await controller.start(mockVideoTrack, mockAudioTrack);
      
      const mockListener = jest.fn();
      controller.on('adaptation-failed', mockListener);
      
      mockVideoTrack.setEncoderConfiguration.mockRejectedValueOnce(new Error('Config failed'));
      
      await expect(controller.applyQualityProfile('high', 'test')).rejects.toThrow();
      // Controller should still be operational
      expect(controller.currentTracks.video).toBe(mockVideoTrack);
    });
  });

  describe('Profile Comparison', () => {
    test('correctly identifies upgrades', () => {
      controller.currentProfile = controller.qualityProfiles.low;
      
      expect(controller.isUpgrade('medium')).toBe(true);
      expect(controller.isUpgrade('high')).toBe(true);
      expect(controller.isUpgrade('low')).toBe(false);
    });

    test('correctly identifies downgrades', () => {
      controller.currentProfile = controller.qualityProfiles.high;
      
      expect(controller.isDowngrade('medium')).toBe(true);
      expect(controller.isDowngrade('low')).toBe(true);
      expect(controller.isDowngrade('high')).toBe(false);
    });

    test('handles null current profile', () => {
      controller.currentProfile = null;
      
      expect(controller.isUpgrade('high')).toBe(true);
      expect(controller.isDowngrade('low')).toBe(true);
    });
  });
});