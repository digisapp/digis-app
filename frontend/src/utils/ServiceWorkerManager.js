/**
 * Service Worker Manager
 * 
 * Handles service worker registration, updates, and communication
 * for offline capability and background sync.
 */

class ServiceWorkerManager {
  constructor() {
    this.registration = null;
    this.isSupported = 'serviceWorker' in navigator;
    this.isRegistered = false;
    this.updateAvailable = false;
    
    this.listeners = new Map();
    
    console.log('🔧 Service Worker Manager initialized');
  }

  /**
   * Register service worker
   */
  async register() {
    if (!this.isSupported) {
      console.warn('⚠️ Service Worker not supported');
      return false;
    }

    try {
      console.log('📋 Registering Service Worker...');
      
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });

      this.isRegistered = true;
      
      // Set up event listeners
      this.setupEventListeners();
      
      console.log('✅ Service Worker registered successfully');
      this.notifyListeners('registered', { registration: this.registration });
      
      return true;
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
      this.notifyListeners('registration-failed', { error });
      return false;
    }
  }

  /**
   * Setup service worker event listeners
   */
  setupEventListeners() {
    if (!this.registration) return;

    // Handle updates
    this.registration.addEventListener('updatefound', () => {
      console.log('🔄 Service Worker update found');
      
      const newWorker = this.registration.installing;
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // New service worker available
            console.log('📦 New Service Worker available');
            this.updateAvailable = true;
            this.notifyListeners('update-available', { newWorker });
          } else {
            // Service worker cached for first time
            console.log('🎉 Service Worker cached for offline use');
            this.notifyListeners('cached', { newWorker });
          }
        }
      });
    });

    // Handle controller changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('🔄 Service Worker controller changed');
      this.notifyListeners('controller-change');
    });

    // Handle messages from service worker
    navigator.serviceWorker.addEventListener('message', event => {
      console.log('💬 Message from Service Worker:', event.data);
      this.handleServiceWorkerMessage(event.data);
    });
  }

  /**
   * Handle messages from service worker
   */
  handleServiceWorkerMessage(data) {
    const { type, payload } = data;
    
    switch (type) {
      case 'OFFLINE_MODE_ACTIVATED':
        this.notifyListeners('offline-mode', { mode: payload.mode });
        break;
        
      case 'VIDEO_CALL_FALLBACK':
        this.notifyListeners('video-call-fallback', payload);
        break;
        
      case 'CACHE_UPDATED':
        this.notifyListeners('cache-updated', payload);
        break;
        
      default:
        this.notifyListeners('sw-message', { type, payload });
    }
  }

  /**
   * Skip waiting for new service worker
   */
  async skipWaiting() {
    if (!this.registration || !this.registration.waiting) {
      return false;
    }

    console.log('⏩ Skipping waiting for new Service Worker');
    
    // Tell the waiting service worker to skip waiting
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    
    return true;
  }

  /**
   * Get service worker version
   */
  async getVersion() {
    if (!this.registration || !this.registration.active) {
      return null;
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.version);
      };
      
      this.registration.active.postMessage(
        { type: 'GET_VERSION' },
        [messageChannel.port2]
      );
    });
  }

  /**
   * Clear service worker cache
   */
  async clearCache() {
    if (!this.registration || !this.registration.active) {
      return false;
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.success);
      };
      
      this.registration.active.postMessage(
        { type: 'CLEAR_CACHE' },
        [messageChannel.port2]
      );
    });
  }

  /**
   * Get cache status
   */
  async getCacheStatus() {
    if (!this.registration || !this.registration.active) {
      return null;
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };
      
      this.registration.active.postMessage(
        { type: 'CACHE_STATUS' },
        [messageChannel.port2]
      );
    });
  }

  /**
   * Register background sync
   */
  async registerBackgroundSync(tag, data = {}) {
    if (!this.registration || !this.registration.sync) {
      console.warn('⚠️ Background sync not supported');
      return false;
    }

    try {
      await this.registration.sync.register(tag);
      
      // Store data for sync if provided
      if (Object.keys(data).length > 0) {
        await this.storeOfflineAction(tag, data);
      }
      
      console.log(`📡 Background sync registered: ${tag}`);
      return true;
    } catch (error) {
      console.error('❌ Background sync registration failed:', error);
      return false;
    }
  }

  /**
   * Store offline action for later sync
   */
  async storeOfflineAction(type, data) {
    const action = {
      id: Date.now(),
      type,
      data,
      timestamp: Date.now(),
      authHeader: await this.getAuthHeader()
    };

    // Store in IndexedDB via service worker
    this.sendMessage('STORE_OFFLINE_ACTION', action);
  }

  /**
   * Get current auth header
   */
  async getAuthHeader() {
    try {
      // Get Supabase auth token with enhanced error handling
      const { getAuthToken } = await import('./supabase-auth-enhanced');
      const token = await getAuthToken();
      
      if (token) {
        return `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('Could not get auth header:', error);
    }
    
    return null;
  }

  /**
   * Send message to service worker
   */
  sendMessage(type, payload = {}) {
    if (!navigator.serviceWorker.controller) {
      console.warn('⚠️ No active service worker to send message to');
      return;
    }

    navigator.serviceWorker.controller.postMessage({
      type,
      payload,
      timestamp: Date.now()
    });
  }

  /**
   * Handle offline video call scenarios
   */
  async handleOfflineVideoCall(sessionData) {
    console.log('📹 Handling offline video call...');
    
    // Store session end data for later sync
    await this.storeOfflineAction('SESSION_END', {
      sessionId: sessionData.sessionId,
      duration: sessionData.duration,
      endReason: 'offline',
      timestamp: Date.now()
    });

    // Register background sync for when connection returns
    await this.registerBackgroundSync('background-sync-video-calls');
    
    // Notify listeners about offline mode
    this.notifyListeners('video-call-offline', sessionData);
  }

  /**
   * Handle token deduction while offline
   */
  async handleOfflineTokenDeduction(tokenData) {
    console.log('💰 Handling offline token deduction...');
    
    // Store token deduction for later sync
    await this.storeOfflineAction('TOKEN_DEDUCTION', {
      amount: tokenData.amount,
      reason: tokenData.reason,
      sessionId: tokenData.sessionId,
      timestamp: Date.now()
    });

    // Register background sync
    await this.registerBackgroundSync('background-sync-tokens');
  }

  /**
   * Check if app is running offline
   */
  isOffline() {
    return !navigator.onLine;
  }

  /**
   * Get network status
   */
  getNetworkStatus() {
    return {
      online: navigator.onLine,
      connection: navigator.connection || navigator.mozConnection || navigator.webkitConnection,
      serviceWorkerActive: !!navigator.serviceWorker.controller,
      registrationActive: !!this.registration?.active
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
          console.error(`Error in SW manager listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Check for updates manually
   */
  async checkForUpdates() {
    if (!this.registration) {
      return false;
    }

    try {
      const registration = await this.registration.update();
      console.log('🔄 Manual update check completed');
      return !!registration;
    } catch (error) {
      console.error('❌ Manual update check failed:', error);
      return false;
    }
  }

  /**
   * Unregister service worker
   */
  async unregister() {
    if (!this.registration) {
      return false;
    }

    try {
      const success = await this.registration.unregister();
      
      if (success) {
        this.registration = null;
        this.isRegistered = false;
        console.log('✅ Service Worker unregistered');
        this.notifyListeners('unregistered');
      }
      
      return success;
    } catch (error) {
      console.error('❌ Service Worker unregistration failed:', error);
      return false;
    }
  }

  /**
   * Get status summary
   */
  getStatus() {
    return {
      isSupported: this.isSupported,
      isRegistered: this.isRegistered,
      updateAvailable: this.updateAvailable,
      hasController: !!navigator.serviceWorker.controller,
      networkStatus: this.getNetworkStatus(),
      registration: {
        scope: this.registration?.scope,
        active: !!this.registration?.active,
        waiting: !!this.registration?.waiting,
        installing: !!this.registration?.installing
      }
    };
  }
}

// Create singleton instance
const serviceWorkerManager = new ServiceWorkerManager();

export default serviceWorkerManager;