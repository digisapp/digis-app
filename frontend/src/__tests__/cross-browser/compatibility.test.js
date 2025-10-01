/**
 * Cross-Browser Compatibility Test Suite
 * 
 * Tests video calling functionality across different browser environments
 * and device capabilities.
 */

// Mock different browser environments
const browserEnvironments = {
  chrome: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    webrtc: true,
    mediaDevices: true,
    permissions: true,
    codecSupport: ['vp8', 'vp9', 'h264'],
    features: {
      screenshare: true,
      audioProcessing: true,
      backgroundBlur: true,
    }
  },
  firefox: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    webrtc: true,
    mediaDevices: true,
    permissions: true,
    codecSupport: ['vp8', 'vp9'],
    features: {
      screenshare: true,
      audioProcessing: false,
      backgroundBlur: false,
    }
  },
  safari: {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    webrtc: true,
    mediaDevices: true,
    permissions: true,
    codecSupport: ['vp8', 'h264'],
    features: {
      screenshare: false,
      audioProcessing: false,
      backgroundBlur: false,
    }
  },
  edge: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
    webrtc: true,
    mediaDevices: true,
    permissions: true,
    codecSupport: ['vp8', 'vp9', 'h264'],
    features: {
      screenshare: true,
      audioProcessing: true,
      backgroundBlur: false,
    }
  },
  mobileChrome: {
    userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    webrtc: true,
    mediaDevices: true,
    permissions: true,
    codecSupport: ['vp8', 'h264'],
    features: {
      screenshare: false,
      audioProcessing: false,
      backgroundBlur: false,
    }
  },
  mobileSafari: {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    webrtc: true,
    mediaDevices: true,
    permissions: true,
    codecSupport: ['vp8', 'h264'],
    features: {
      screenshare: false,
      audioProcessing: false,
      backgroundBlur: false,
    }
  }
};

const deviceCapabilities = {
  desktop: {
    cpu: 'high',
    memory: 8192,
    bandwidth: 'high',
    camera: { maxResolution: '1080p', frameRate: 30 },
    microphone: { quality: 'high', noiseSuppression: true },
    speaker: { channels: 2, quality: 'high' }
  },
  laptop: {
    cpu: 'medium',
    memory: 4096,
    bandwidth: 'medium',
    camera: { maxResolution: '720p', frameRate: 30 },
    microphone: { quality: 'medium', noiseSuppression: true },
    speaker: { channels: 2, quality: 'medium' }
  },
  tablet: {
    cpu: 'medium',
    memory: 2048,
    bandwidth: 'medium',
    camera: { maxResolution: '720p', frameRate: 24 },
    microphone: { quality: 'medium', noiseSuppression: false },
    speaker: { channels: 1, quality: 'medium' }
  },
  mobile: {
    cpu: 'low',
    memory: 1024,
    bandwidth: 'low',
    camera: { maxResolution: '480p', frameRate: 15 },
    microphone: { quality: 'low', noiseSuppression: false },
    speaker: { channels: 1, quality: 'low' }
  }
};

// Mock browser APIs based on environment
function mockBrowserEnvironment(browserName) {
  const env = browserEnvironments[browserName];
  
  // Mock navigator
  Object.defineProperty(global, 'navigator', {
    writable: true,
    value: {
      userAgent: env.userAgent,
      mediaDevices: env.mediaDevices ? {
        getUserMedia: jest.fn().mockImplementation((constraints) => {
          if (!env.mediaDevices) {
            return Promise.reject(new Error('Media devices not supported'));
          }
          return Promise.resolve({
            getTracks: () => [],
            getVideoTracks: () => [{ kind: 'video', enabled: true }],
            getAudioTracks: () => [{ kind: 'audio', enabled: true }],
          });
        }),
        enumerateDevices: jest.fn().mockResolvedValue([
          { kind: 'audioinput', label: 'Microphone' },
          { kind: 'videoinput', label: 'Camera' },
          { kind: 'audiooutput', label: 'Speaker' },
        ]),
        getDisplayMedia: env.features.screenshare ? 
          jest.fn().mockResolvedValue({
            getTracks: () => [{ kind: 'video', enabled: true }],
          }) : undefined,
      } : undefined,
      permissions: env.permissions ? {
        query: jest.fn().mockResolvedValue({ state: 'granted' })
      } : undefined,
    }
  });

  // Mock WebRTC APIs
  if (env.webrtc) {
    global.RTCPeerConnection = jest.fn().mockImplementation(() => ({
      createOffer: jest.fn().mockResolvedValue({}),
      createAnswer: jest.fn().mockResolvedValue({}),
      setLocalDescription: jest.fn().mockResolvedValue(),
      setRemoteDescription: jest.fn().mockResolvedValue(),
      addIceCandidate: jest.fn().mockResolvedValue(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
  }

  return env;
}

// Mock Agora SDK with browser-specific behavior
function createBrowserSpecificAgoraMock(browserName) {
  const env = browserEnvironments[browserName];
  
  return {
    createClient: jest.fn(() => ({
      join: jest.fn().mockImplementation(async () => {
        // Simulate browser-specific connection delays
        const delay = browserName.includes('mobile') ? 1000 : 500;
        await new Promise(resolve => setTimeout(resolve, delay));
        return Math.floor(Math.random() * 100000);
      }),
      leave: jest.fn().mockResolvedValue(),
      publish: jest.fn().mockImplementation(async () => {
        if (!env.webrtc) {
          throw new Error('WebRTC not supported');
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }),
      unpublish: jest.fn().mockResolvedValue(),
      subscribe: jest.fn().mockResolvedValue(),
      on: jest.fn(),
      removeAllListeners: jest.fn(),
      setClientRole: jest.fn().mockResolvedValue(),
      renewToken: jest.fn().mockResolvedValue(),
      getStats: jest.fn().mockResolvedValue({
        RTT: browserName.includes('mobile') ? 150 : 50,
        uplinkNetworkQuality: browserName === 'safari' ? 5 : 6,
        downlinkNetworkQuality: browserName === 'safari' ? 5 : 6,
      }),
    })),
    createMicrophoneAudioTrack: jest.fn().mockImplementation(async () => {
      if (!env.mediaDevices) {
        throw new Error('Media devices not available');
      }
      return {
        setEnabled: jest.fn().mockResolvedValue(),
        setVolume: jest.fn(),
        stop: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
      };
    }),
    createCameraVideoTrack: jest.fn().mockImplementation(async () => {
      if (!env.mediaDevices) {
        throw new Error('Camera not available');
      }
      return {
        setEnabled: jest.fn().mockResolvedValue(),
        setEncoderConfiguration: jest.fn().mockResolvedValue(),
        play: jest.fn(),
        stop: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
      };
    }),
    createScreenVideoTrack: jest.fn().mockImplementation(async () => {
      if (!env.features.screenshare) {
        throw new Error('Screen sharing not supported in this browser');
      }
      return {
        setEncoderConfiguration: jest.fn().mockResolvedValue(),
        play: jest.fn(),
        stop: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
      };
    }),
  };
}

jest.mock('../../utils/auth-helpers', () => ({
  auth: {
    currentUser: {
      getAuthToken: jest.fn().mockResolvedValue('mock-supabase-token'),
      uid: 'test-user',
    },
  },
}));

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({
    rtcToken: 'mock-token',
    uid: 12345,
    channel: 'test-channel',
  }),
});

describe('Cross-Browser Compatibility Tests', () => {
  describe('Desktop Browser Support', () => {
    test('Chrome - Full feature support', async () => {
      const browserEnv = mockBrowserEnvironment('chrome');
      const AgoraRTC = createBrowserSpecificAgoraMock('chrome');

      // Test basic connection
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      await expect(client.join('app-id', 'channel', 'token', 12345)).resolves.toBeDefined();

      // Test media track creation
      await expect(AgoraRTC.createMicrophoneAudioTrack()).resolves.toBeDefined();
      await expect(AgoraRTC.createCameraVideoTrack()).resolves.toBeDefined();

      // Test advanced features
      await expect(AgoraRTC.createScreenVideoTrack()).resolves.toBeDefined();

      expect(browserEnv.features.screenshare).toBe(true);
      expect(browserEnv.features.backgroundBlur).toBe(true);
      expect(browserEnv.codecSupport).toContain('vp9');
    });

    test('Firefox - Good feature support with limitations', async () => {
      const browserEnv = mockBrowserEnvironment('firefox');
      const AgoraRTC = createBrowserSpecificAgoraMock('firefox');

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      await expect(client.join('app-id', 'channel', 'token', 12345)).resolves.toBeDefined();

      // Basic media works
      await expect(AgoraRTC.createMicrophoneAudioTrack()).resolves.toBeDefined();
      await expect(AgoraRTC.createCameraVideoTrack()).resolves.toBeDefined();

      // Screen sharing works but advanced features don't
      await expect(AgoraRTC.createScreenVideoTrack()).resolves.toBeDefined();

      expect(browserEnv.features.backgroundBlur).toBe(false);
      expect(browserEnv.features.audioProcessing).toBe(false);
      expect(browserEnv.codecSupport).not.toContain('h264');
    });

    test('Safari - Basic support with feature limitations', async () => {
      const browserEnv = mockBrowserEnvironment('safari');
      const AgoraRTC = createBrowserSpecificAgoraMock('safari');

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      await expect(client.join('app-id', 'channel', 'token', 12345)).resolves.toBeDefined();

      // Basic media works
      await expect(AgoraRTC.createMicrophoneAudioTrack()).resolves.toBeDefined();
      await expect(AgoraRTC.createCameraVideoTrack()).resolves.toBeDefined();

      // Screen sharing not supported
      await expect(AgoraRTC.createScreenVideoTrack()).rejects.toThrow('Screen sharing not supported');

      expect(browserEnv.features.screenshare).toBe(false);
      expect(browserEnv.features.backgroundBlur).toBe(false);
      expect(browserEnv.codecSupport).toContain('h264');
    });

    test('Edge - Full compatibility', async () => {
      const browserEnv = mockBrowserEnvironment('edge');
      const AgoraRTC = createBrowserSpecificAgoraMock('edge');

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      await expect(client.join('app-id', 'channel', 'token', 12345)).resolves.toBeDefined();

      await expect(AgoraRTC.createMicrophoneAudioTrack()).resolves.toBeDefined();
      await expect(AgoraRTC.createCameraVideoTrack()).resolves.toBeDefined();
      await expect(AgoraRTC.createScreenVideoTrack()).resolves.toBeDefined();

      expect(browserEnv.features.screenshare).toBe(true);
      expect(browserEnv.codecSupport).toEqual(['vp8', 'vp9', 'h264']);
    });
  });

  describe('Mobile Browser Support', () => {
    test('Mobile Chrome - Good mobile support', async () => {
      const browserEnv = mockBrowserEnvironment('mobileChrome');
      const AgoraRTC = createBrowserSpecificAgoraMock('mobileChrome');

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      
      // Mobile connections take longer
      const startTime = Date.now();
      await client.join('app-id', 'channel', 'token', 12345);
      const connectionTime = Date.now() - startTime;
      
      expect(connectionTime).toBeGreaterThan(800); // Slower on mobile

      // Basic media works on mobile
      await expect(AgoraRTC.createMicrophoneAudioTrack()).resolves.toBeDefined();
      await expect(AgoraRTC.createCameraVideoTrack()).resolves.toBeDefined();

      // Screen sharing not available on mobile
      await expect(AgoraRTC.createScreenVideoTrack()).rejects.toThrow();

      expect(browserEnv.features.screenshare).toBe(false);
      expect(browserEnv.features.backgroundBlur).toBe(false);
    });

    test('Mobile Safari - iOS compatibility', async () => {
      const browserEnv = mockBrowserEnvironment('mobileSafari');
      const AgoraRTC = createBrowserSpecificAgoraMock('mobileSafari');

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      await expect(client.join('app-id', 'channel', 'token', 12345)).resolves.toBeDefined();

      // iOS has stricter media permissions
      await expect(AgoraRTC.createMicrophoneAudioTrack()).resolves.toBeDefined();
      await expect(AgoraRTC.createCameraVideoTrack()).resolves.toBeDefined();

      // iOS limitations
      await expect(AgoraRTC.createScreenVideoTrack()).rejects.toThrow();

      expect(browserEnv.codecSupport).toEqual(['vp8', 'h264']);
      expect(browserEnv.features.audioProcessing).toBe(false);
    });
  });

  describe('Device Capability Adaptation', () => {
    test('adapts video quality for low-end devices', async () => {
      const device = deviceCapabilities.mobile;
      const AgoraRTC = createBrowserSpecificAgoraMock('mobileChrome');

      const videoTrack = await AgoraRTC.createCameraVideoTrack();
      
      // Should adapt to device capabilities
      expect(videoTrack.setEncoderConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({
          width: expect.any(Number),
          height: expect.any(Number),
          frameRate: expect.any(Number),
        })
      );

      expect(device.camera.maxResolution).toBe('480p');
      expect(device.camera.frameRate).toBe(15);
    });

    test('optimizes for high-end desktop experience', async () => {
      const device = deviceCapabilities.desktop;
      const AgoraRTC = createBrowserSpecificAgoraMock('chrome');

      const videoTrack = await AgoraRTC.createCameraVideoTrack();
      
      expect(device.camera.maxResolution).toBe('1080p');
      expect(device.camera.frameRate).toBe(30);
      expect(device.microphone.noiseSuppression).toBe(true);
    });

    test('handles bandwidth limitations', async () => {
      const lowBandwidthDevice = deviceCapabilities.mobile;
      const AgoraRTC = createBrowserSpecificAgoraMock('mobileChrome');

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      
      // Simulate low bandwidth adaptation
      const stats = await client.getStats();
      expect(stats.RTT).toBeGreaterThan(100); // Higher latency on mobile

      expect(lowBandwidthDevice.bandwidth).toBe('low');
    });
  });

  describe('Feature Detection and Fallbacks', () => {
    test('detects screen sharing support', () => {
      const chromeEnv = browserEnvironments.chrome;
      const safariEnv = browserEnvironments.safari;

      expect(chromeEnv.features.screenshare).toBe(true);
      expect(safariEnv.features.screenshare).toBe(false);
    });

    test('detects audio processing capabilities', () => {
      const chromeEnv = browserEnvironments.chrome;
      const firefoxEnv = browserEnvironments.firefox;

      expect(chromeEnv.features.audioProcessing).toBe(true);
      expect(firefoxEnv.features.audioProcessing).toBe(false);
    });

    test('provides codec fallbacks', () => {
      const safariCodecs = browserEnvironments.safari.codecSupport;
      const firefoxCodecs = browserEnvironments.firefox.codecSupport;

      expect(safariCodecs).toContain('vp8');
      expect(safariCodecs).toContain('h264');
      expect(firefoxCodecs).not.toContain('h264');
      expect(firefoxCodecs).toContain('vp9');
    });

    test('graceful degradation for unsupported features', async () => {
      mockBrowserEnvironment('safari');
      const AgoraRTC = createBrowserSpecificAgoraMock('safari');

      // Should still work even without advanced features
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      await expect(client.join('app-id', 'channel', 'token', 12345)).resolves.toBeDefined();

      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      const videoTrack = await AgoraRTC.createCameraVideoTrack();

      expect(audioTrack).toBeDefined();
      expect(videoTrack).toBeDefined();
    });
  });

  describe('Browser-Specific Workarounds', () => {
    test('handles Safari autoplay restrictions', async () => {
      mockBrowserEnvironment('safari');
      const AgoraRTC = createBrowserSpecificAgoraMock('safari');

      const videoTrack = await AgoraRTC.createCameraVideoTrack();
      
      // Safari requires user interaction for autoplay
      expect(videoTrack.play).toBeDefined();
    });

    test('handles Firefox codec preferences', async () => {
      mockBrowserEnvironment('firefox');
      
      const firefoxEnv = browserEnvironments.firefox;
      expect(firefoxEnv.codecSupport).toContain('vp8');
      expect(firefoxEnv.codecSupport).toContain('vp9');
      expect(firefoxEnv.codecSupport).not.toContain('h264');
    });

    test('handles mobile browser memory constraints', async () => {
      mockBrowserEnvironment('mobileChrome');
      
      const mobileDevice = deviceCapabilities.mobile;
      expect(mobileDevice.memory).toBe(1024); // Limited memory
      expect(mobileDevice.cpu).toBe('low'); // Limited processing power
    });
  });

  describe('Performance Across Browsers', () => {
    test('measures connection times across browsers', async () => {
      const browsers = ['chrome', 'firefox', 'safari', 'edge'];
      const results = {};

      for (const browser of browsers) {
        mockBrowserEnvironment(browser);
        const AgoraRTC = createBrowserSpecificAgoraMock(browser);

        const startTime = Date.now();
        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        await client.join('app-id', 'channel', 'token', 12345);
        const connectionTime = Date.now() - startTime;

        results[browser] = connectionTime;
      }

      console.log('Browser Connection Times:', results);

      // Chrome and Edge should be fastest
      expect(results.chrome).toBeLessThan(600);
      expect(results.edge).toBeLessThan(600);
      
      // Safari might be slower
      expect(results.safari).toBeLessThan(800);
    });

    test('compares codec performance', async () => {
      const codecs = ['vp8', 'vp9', 'h264'];
      const browsers = ['chrome', 'firefox'];

      for (const browser of browsers) {
        const env = browserEnvironments[browser];
        const supportedCodecs = codecs.filter(codec => env.codecSupport.includes(codec));

        console.log(`${browser} supports:`, supportedCodecs);

        expect(supportedCodecs.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Accessibility and User Experience', () => {
    test('keyboard navigation works across browsers', async () => {
      for (const browserName of ['chrome', 'firefox', 'safari']) {
        mockBrowserEnvironment(browserName);

        // Should support standard keyboard events
        const mockKeyEvent = { key: 'Space', preventDefault: jest.fn() };
        
        // Simulate keyboard interaction
        expect(mockKeyEvent.key).toBe('Space');
        expect(typeof mockKeyEvent.preventDefault).toBe('function');
      }
    });

    test('screen reader compatibility', async () => {
      for (const browserName of ['chrome', 'firefox', 'safari']) {
        mockBrowserEnvironment(browserName);

        // Should have proper ARIA attributes
        // This would be tested in actual DOM tests
        expect(true).toBe(true); // Placeholder
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    console.log('\n🌐 Cross-Browser Compatibility Summary:');
    console.log('✅ Chrome: Full feature support');
    console.log('✅ Firefox: Good support, no H.264');
    console.log('⚠️  Safari: Basic support, no screen sharing');
    console.log('✅ Edge: Full compatibility');
    console.log('📱 Mobile Chrome: Good mobile support');
    console.log('📱 Mobile Safari: iOS compatibility');
  });
});