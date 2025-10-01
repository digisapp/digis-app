/**
 * Service Worker Manager Tests
 */

import ServiceWorkerManager from '../../utils/ServiceWorkerManager';

// Mock service worker APIs
const mockRegistration = {
  active: { postMessage: jest.fn() },
  waiting: null,
  installing: null,
  scope: '/',
  addEventListener: jest.fn(),
  update: jest.fn().mockResolvedValue(true),
  unregister: jest.fn().mockResolvedValue(true),
  sync: {
    register: jest.fn().mockResolvedValue(true)
  }
};

const mockServiceWorker = {
  register: jest.fn().mockResolvedValue(mockRegistration),
  controller: { postMessage: jest.fn() },
  addEventListener: jest.fn()
};

Object.defineProperty(global.navigator, 'serviceWorker', {
  writable: true,
  value: mockServiceWorker
});

Object.defineProperty(global.navigator, 'onLine', {
  writable: true,
  value: true
});

describe('ServiceWorkerManager', () => {
  let swManager;

  beforeEach(() => {
    jest.clearAllMocks();
    swManager = new ServiceWorkerManager();
  });

  afterEach(() => {
    // Clean up any listeners
    swManager.listeners.clear();
  });

  describe('Initialization', () => {
    test('initializes with correct default state', () => {
      expect(swManager.isSupported).toBe(true);
      expect(swManager.isRegistered).toBe(false);
      expect(swManager.updateAvailable).toBe(false);
    });

    test('detects unsupported environments', () => {
      delete global.navigator.serviceWorker;
      const unsupportedManager = new ServiceWorkerManager();
      
      expect(unsupportedManager.isSupported).toBe(false);
    });
  });

  describe('Registration', () => {
    test('registers service worker successfully', async () => {
      const result = await swManager.register();
      
      expect(result).toBe(true);
      expect(swManager.isRegistered).toBe(true);
      expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });
    });

    test('handles registration failure', async () => {
      mockServiceWorker.register.mockRejectedValueOnce(new Error('Registration failed'));
      
      const result = await swManager.register();
      
      expect(result).toBe(false);
      expect(swManager.isRegistered).toBe(false);
    });

    test('emits registration event', async () => {
      const registeredCallback = jest.fn();
      swManager.on('registered', registeredCallback);
      
      await swManager.register();
      
      expect(registeredCallback).toHaveBeenCalledWith({
        registration: mockRegistration
      });
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await swManager.register();
    });

    test('handles update found event', () => {
      const updateCallback = jest.fn();
      swManager.on('update-available', updateCallback);

      // Simulate updatefound event
      const updateFoundCallback = mockRegistration.addEventListener.mock.calls
        .find(call => call[0] === 'updatefound')?.[1];
      
      if (updateFoundCallback) {
        const mockNewWorker = {
          state: 'installed',
          addEventListener: jest.fn()
        };
        
        swManager.registration.installing = mockNewWorker;
        updateFoundCallback();

        // Simulate state change to installed
        const stateChangeCallback = mockNewWorker.addEventListener.mock.calls
          .find(call => call[0] === 'statechange')?.[1];
        
        if (stateChangeCallback) {
          stateChangeCallback();
          expect(swManager.updateAvailable).toBe(true);
        }
      }
    });

    test('handles service worker messages', () => {
      const messageCallback = jest.fn();
      swManager.on('offline-mode', messageCallback);

      // Simulate message event
      const messageHandler = mockServiceWorker.addEventListener.mock.calls
        .find(call => call[0] === 'message')?.[1];
      
      if (messageHandler) {
        messageHandler({
          data: {
            type: 'OFFLINE_MODE_ACTIVATED',
            payload: { mode: 'CHAT_ONLY' }
          }
        });
        
        expect(messageCallback).toHaveBeenCalledWith({ mode: 'CHAT_ONLY' });
      }
    });
  });

  describe('Communication', () => {
    beforeEach(async () => {
      await swManager.register();
    });

    test('skips waiting for new service worker', async () => {
      swManager.registration.waiting = { postMessage: jest.fn() };
      
      const result = await swManager.skipWaiting();
      
      expect(result).toBe(true);
      expect(swManager.registration.waiting.postMessage).toHaveBeenCalledWith({
        type: 'SKIP_WAITING'
      });
    });

    test('sends messages to service worker', () => {
      swManager.sendMessage('TEST_MESSAGE', { test: true });
      
      expect(mockServiceWorker.controller.postMessage).toHaveBeenCalledWith({
        type: 'TEST_MESSAGE',
        payload: { test: true },
        timestamp: expect.any(Number)
      });
    });

    test('gets service worker version', async () => {
      // Mock MessageChannel
      global.MessageChannel = jest.fn(() => ({
        port1: { onmessage: null },
        port2: {}
      }));

      const versionPromise = swManager.getVersion();
      
      // Simulate response
      const messageChannel = new MessageChannel();
      setTimeout(() => {
        messageChannel.port1.onmessage({ data: { version: 'digis-v1.2.0' } });
      }, 0);
      
      expect(mockRegistration.active.postMessage).toHaveBeenCalledWith(
        { type: 'GET_VERSION' },
        expect.any(Array)
      );
    });
  });

  describe('Background Sync', () => {
    beforeEach(async () => {
      await swManager.register();
    });

    test('registers background sync', async () => {
      const result = await swManager.registerBackgroundSync('test-sync');
      
      expect(result).toBe(true);
      expect(mockRegistration.sync.register).toHaveBeenCalledWith('test-sync');
    });

    test('handles background sync registration failure', async () => {
      mockRegistration.sync.register.mockRejectedValueOnce(new Error('Sync failed'));
      
      const result = await swManager.registerBackgroundSync('test-sync');
      
      expect(result).toBe(false);
    });
  });

  describe('Offline Handling', () => {
    beforeEach(async () => {
      await swManager.register();
    });

    test('handles offline video call', async () => {
      const offlineCallback = jest.fn();
      swManager.on('video-call-offline', offlineCallback);

      const sessionData = {
        sessionId: 'test-session',
        duration: 300
      };

      await swManager.handleOfflineVideoCall(sessionData);
      
      expect(offlineCallback).toHaveBeenCalledWith(sessionData);
      expect(mockRegistration.sync.register).toHaveBeenCalledWith('background-sync-video-calls');
    });

    test('handles offline token deduction', async () => {
      const tokenData = {
        amount: 100,
        reason: 'session_cost'
      };

      await swManager.handleOfflineTokenDeduction(tokenData);
      
      expect(mockRegistration.sync.register).toHaveBeenCalledWith('background-sync-tokens');
    });
  });

  describe('Network Status', () => {
    test('detects offline status', () => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      
      expect(swManager.isOffline()).toBe(true);
    });

    test('provides network status', () => {
      const status = swManager.getNetworkStatus();
      
      expect(status).toEqual({
        online: true,
        connection: expect.any(Object),
        serviceWorkerActive: true,
        registrationActive: true
      });
    });
  });

  describe('Event Listeners', () => {
    test('adds and removes event listeners', () => {
      const callback = jest.fn();
      
      swManager.on('test-event', callback);
      expect(swManager.listeners.get('test-event').has(callback)).toBe(true);
      
      swManager.off('test-event', callback);
      expect(swManager.listeners.get('test-event')?.has(callback)).toBe(false);
    });

    test('notifies listeners', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      swManager.on('test-event', callback1);
      swManager.on('test-event', callback2);
      
      swManager.notifyListeners('test-event', { test: true });
      
      expect(callback1).toHaveBeenCalledWith({ test: true });
      expect(callback2).toHaveBeenCalledWith({ test: true });
    });

    test('handles listener errors gracefully', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Listener error');
      });
      const goodCallback = jest.fn();
      
      swManager.on('test-event', errorCallback);
      swManager.on('test-event', goodCallback);
      
      // Should not throw
      expect(() => {
        swManager.notifyListeners('test-event', { test: true });
      }).not.toThrow();
      
      expect(goodCallback).toHaveBeenCalled();
    });
  });

  describe('Status', () => {
    test('provides status summary', async () => {
      await swManager.register();
      
      const status = swManager.getStatus();
      
      expect(status).toEqual({
        isSupported: true,
        isRegistered: true,
        updateAvailable: false,
        hasController: true,
        networkStatus: expect.any(Object),
        registration: {
          scope: '/',
          active: true,
          waiting: false,
          installing: false
        }
      });
    });
  });

  describe('Cleanup', () => {
    test('unregisters service worker', async () => {
      await swManager.register();
      
      const result = await swManager.unregister();
      
      expect(result).toBe(true);
      expect(swManager.isRegistered).toBe(false);
      expect(swManager.registration).toBe(null);
    });
  });
});