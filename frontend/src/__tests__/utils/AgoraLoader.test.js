/**
 * Agora Loader Tests
 */

import agoraLoader from '../../utils/AgoraLoader';

// Mock Agora SDK
const mockAgoraRTC = {
  createClient: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn()
  })),
  createMicrophoneAudioTrack: jest.fn(),
  createCameraVideoTrack: jest.fn(),
  createScreenVideoTrack: jest.fn(),
  VERSION: '4.20.0'
};

// Mock dynamic import
jest.mock('agora-rtc-sdk-ng', () => mockAgoraRTC, { virtual: true });

// Mock navigator API
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn(),
    getDisplayMedia: jest.fn()
  }
});

describe('AgoraLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    agoraLoader.cleanup();
  });

  describe('SDK Loading', () => {
    test('loads RTC SDK successfully', async () => {
      const sdk = await agoraLoader.loadRTC();
      
      expect(sdk).toBe(mockAgoraRTC);
      expect(agoraLoader.isFeatureLoaded('rtc')).toBe(true);
    });

    test('returns cached SDK on subsequent calls', async () => {
      const sdk1 = await agoraLoader.loadRTC();
      const sdk2 = await agoraLoader.loadRTC();
      
      expect(sdk1).toBe(sdk2);
      expect(sdk1).toBe(mockAgoraRTC);
    });

    test('provides loading status', async () => {
      const statusBefore = agoraLoader.getLoadingStatus();
      expect(statusBefore.isLoaded).toBe(false);
      
      await agoraLoader.loadRTC();
      
      const statusAfter = agoraLoader.getLoadingStatus();
      expect(statusAfter.isLoaded).toBe(true);
      expect(statusAfter.features.rtc).toBe(true);
    });
  });

  describe('Client Creation', () => {
    test('creates client with default config', async () => {
      await agoraLoader.loadRTC();
      
      const client = agoraLoader.createClient();
      
      expect(mockAgoraRTC.createClient).toHaveBeenCalledWith({
        mode: 'rtc',
        codec: 'vp8'
      });
    });

    test('creates client with custom config', async () => {
      await agoraLoader.loadRTC();
      
      const config = { mode: 'live', codec: 'h264' };
      agoraLoader.createClient(config);
      
      expect(mockAgoraRTC.createClient).toHaveBeenCalledWith({
        mode: 'live',
        codec: 'h264'
      });
    });

    test('throws error when SDK not loaded', () => {
      expect(() => {
        agoraLoader.createClient();
      }).toThrow('Agora RTC SDK not loaded');
    });
  });

  describe('Track Creation', () => {
    beforeEach(async () => {
      await agoraLoader.loadRTC();
      
      mockAgoraRTC.createMicrophoneAudioTrack.mockResolvedValue({
        trackMediaType: 'audio',
        play: jest.fn(),
        stop: jest.fn()
      });
      
      mockAgoraRTC.createCameraVideoTrack.mockResolvedValue({
        trackMediaType: 'video',
        play: jest.fn(),
        stop: jest.fn()
      });
    });

    test('creates audio and video tracks', async () => {
      const tracks = await agoraLoader.createTracks();
      
      expect(tracks.audioTrack).toBeDefined();
      expect(tracks.videoTrack).toBeDefined();
      expect(mockAgoraRTC.createMicrophoneAudioTrack).toHaveBeenCalled();
      expect(mockAgoraRTC.createCameraVideoTrack).toHaveBeenCalled();
    });

    test('creates only audio track when video disabled', async () => {
      const tracks = await agoraLoader.createTracks({}, { enabled: false });
      
      expect(tracks.audioTrack).toBeDefined();
      expect(tracks.videoTrack).toBeUndefined();
      expect(mockAgoraRTC.createMicrophoneAudioTrack).toHaveBeenCalled();
      expect(mockAgoraRTC.createCameraVideoTrack).not.toHaveBeenCalled();
    });

    test('creates only video track when audio disabled', async () => {
      const tracks = await agoraLoader.createTracks({ enabled: false });
      
      expect(tracks.audioTrack).toBeUndefined();
      expect(tracks.videoTrack).toBeDefined();
      expect(mockAgoraRTC.createMicrophoneAudioTrack).not.toHaveBeenCalled();
      expect(mockAgoraRTC.createCameraVideoTrack).toHaveBeenCalled();
    });
  });

  describe('Screen Sharing', () => {
    beforeEach(async () => {
      await agoraLoader.loadRTC();
      
      mockAgoraRTC.createScreenVideoTrack.mockResolvedValue({
        trackMediaType: 'video',
        on: jest.fn(),
        play: jest.fn(),
        stop: jest.fn()
      });
    });

    test('creates screen sharing track', async () => {
      const screenTrack = await agoraLoader.createScreenTrack();
      
      expect(screenTrack).toBeDefined();
      expect(mockAgoraRTC.createScreenVideoTrack).toHaveBeenCalledWith({
        encoderConfig: '1080p_1',
        optimizationMode: 'detail'
      });
    });

    test('creates screen track with custom config', async () => {
      const config = { encoderConfig: '720p_1', optimizationMode: 'motion' };
      await agoraLoader.createScreenTrack(config);
      
      expect(mockAgoraRTC.createScreenVideoTrack).toHaveBeenCalledWith({
        encoderConfig: '720p_1',
        optimizationMode: 'motion'
      });
    });
  });

  describe('Feature Loading', () => {
    test('loads features on demand', async () => {
      const rtc = await agoraLoader.loadFeature('rtc');
      expect(rtc).toBe(mockAgoraRTC);
      expect(agoraLoader.isFeatureLoaded('rtc')).toBe(true);
    });

    test('throws error for unknown features', async () => {
      await expect(agoraLoader.loadFeature('unknown')).rejects.toThrow('Unknown feature: unknown');
    });
  });

  describe('SDK Info', () => {
    test('returns not loaded info when SDK not loaded', () => {
      const info = agoraLoader.getSDKInfo();
      
      expect(info.loaded).toBe(false);
    });

    test('returns SDK info when loaded', async () => {
      await agoraLoader.loadRTC();
      
      const info = agoraLoader.getSDKInfo();
      
      expect(info.loaded).toBe(true);
      expect(info.version).toBe('4.20.0');
      expect(info.features.rtc).toBe(true);
    });
  });

  describe('Cleanup', () => {
    test('resets state on cleanup', async () => {
      await agoraLoader.loadRTC();
      expect(agoraLoader.isFeatureLoaded('rtc')).toBe(true);
      
      agoraLoader.cleanup();
      
      expect(agoraLoader.isFeatureLoaded('rtc')).toBe(false);
      expect(agoraLoader.getLoadingStatus().isLoaded).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('throws error when creating tracks without SDK', async () => {
      await expect(agoraLoader.createTracks()).rejects.toThrow('Agora RTC SDK not loaded');
    });

    test('throws error when creating screen track without SDK', async () => {
      await expect(agoraLoader.createScreenTrack()).rejects.toThrow('Agora RTC SDK not loaded');
    });
  });
});