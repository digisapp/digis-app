/**
 * Progressive Web App Utilities
 * Handles service worker registration, updates, and PWA features
 */

class PWAService {
  constructor() {
    this.swRegistration = null;
    this.isUpdateAvailable = false;
    this.updateCallbacks = [];
    this.installPromptEvent = null;
    this.isInstalled = false;
    this.isStandalone = false;
    
    this.init();
  }

  async init() {
    if ('serviceWorker' in navigator) {
      // Temporarily disabled service worker to fix issues
      // await this.registerServiceWorker();
      // this.setupUpdateDetection();
      this.setupInstallPromptListener();
      this.checkInstallStatus();
      this.setupPushNotifications();
      this.setupBackgroundSync();
    }
  }

  /**
   * Register the service worker
   */
  async registerServiceWorker() {
    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('✅ Service Worker registered successfully:', this.swRegistration.scope);

      // Listen for updates
      this.swRegistration.addEventListener('updatefound', () => {
        this.handleServiceWorkerUpdate();
      });

      // Handle controlling change
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 Service Worker controller changed');
        // Optionally reload the page
        if (this.shouldReloadOnUpdate()) {
          window.location.reload();
        }
      });

      return this.swRegistration;
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
      throw error;
    }
  }

  /**
   * Handle service worker updates
   */
  handleServiceWorkerUpdate() {
    const newWorker = this.swRegistration.installing;
    
    if (!newWorker) return;

    console.log('🆕 New service worker found, installing...');

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed') {
        if (navigator.serviceWorker.controller) {
          console.log('🔄 App update available');
          this.isUpdateAvailable = true;
          this.notifyUpdateAvailable();
        } else {
          console.log('✅ App ready for offline use');
        }
      }
    });
  }

  /**
   * Set up update detection
   */
  setupUpdateDetection() {
    // Check for updates periodically
    setInterval(() => {
      if (this.swRegistration) {
        this.swRegistration.update();
      }
    }, 60000); // Check every minute

    // Check for updates when the page becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.swRegistration) {
        this.swRegistration.update();
      }
    });
  }

  /**
   * Set up install prompt listener
   */
  setupInstallPromptListener() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPromptEvent = e;
      console.log('📱 Install prompt available');
    });

    window.addEventListener('appinstalled', () => {
      console.log('🎉 App installed successfully');
      this.isInstalled = true;
      this.installPromptEvent = null;
    });
  }

  /**
   * Check install status
   */
  checkInstallStatus() {
    // Check if running in standalone mode
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                      window.navigator.standalone ||
                      document.referrer.includes('android-app://');

    // Check for installed related apps
    if ('getInstalledRelatedApps' in navigator) {
      navigator.getInstalledRelatedApps().then(apps => {
        this.isInstalled = apps.length > 0;
      });
    }
  }

  /**
   * Set up push notifications
   */
  async setupPushNotifications() {
    // Check if Notification API is available
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.log('❌ Notification API not available');
      return;
    }
    
    if (!('PushManager' in window)) {
      console.log('❌ Push notifications not supported');
      return;
    }

    try {
      // Request permission if not granted
      if (window.Notification && window.Notification.permission === 'default') {
        const permission = await window.Notification.requestPermission();
        console.log('🔔 Notification permission:', permission);
      }
    } catch (error) {
      console.warn('⚠️ Failed to request notification permission:', error);
    }
  }

  /**
   * Set up background sync
   */
  setupBackgroundSync() {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      console.log('✅ Background sync supported');
    } else {
      console.log('❌ Background sync not supported');
    }
  }

  /**
   * Prompt user to install the app
   */
  async promptInstall() {
    if (!this.installPromptEvent) {
      console.log('❌ Install prompt not available');
      return false;
    }

    try {
      // Show the install prompt
      this.installPromptEvent.prompt();
      
      // Wait for user response
      const { outcome } = await this.installPromptEvent.userChoice;
      
      console.log('Install prompt outcome:', outcome);
      
      if (outcome === 'accepted') {
        this.installPromptEvent = null;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Install prompt error:', error);
      return false;
    }
  }

  /**
   * Update the app to the latest version
   */
  async updateApp() {
    if (!this.swRegistration || !this.isUpdateAvailable) {
      console.log('❌ No update available');
      return;
    }

    const newWorker = this.swRegistration.waiting || this.swRegistration.installing;
    
    if (newWorker) {
      // Tell the new service worker to skip waiting
      newWorker.postMessage({ action: 'skipWaiting' });
      
      // Wait for the new service worker to become active
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
      });
      
      console.log('✅ App updated successfully');
      
      // Reload the page to use the new version
      window.location.reload();
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPushNotifications(userVisibleOnly = true) {
    if (!this.swRegistration) {
      throw new Error('Service worker not registered');
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      throw new Error('Notification API not available');
    }
    
    if (window.Notification.permission !== 'granted') {
      throw new Error('Notification permission not granted');
    }

    try {
      // Check if already subscribed
      let subscription = await this.swRegistration.pushManager.getSubscription();
      
      if (!subscription) {
        // Subscribe to push notifications
        subscription = await this.swRegistration.pushManager.subscribe({
          userVisibleOnly,
          applicationServerKey: this.urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY)
        });
      }

      console.log('✅ Push subscription:', subscription);
      
      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
      
      return subscription;
    } catch (error) {
      console.error('❌ Push subscription failed:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPushNotifications() {
    if (!this.swRegistration) {
      return;
    }

    try {
      const subscription = await this.swRegistration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        await this.removeSubscriptionFromServer(subscription);
        console.log('✅ Push notifications unsubscribed');
      }
    } catch (error) {
      console.error('❌ Push unsubscription failed:', error);
    }
  }

  /**
   * Register for background sync
   */
  async registerBackgroundSync(tag) {
    if (!this.swRegistration || !('sync' in window.ServiceWorkerRegistration.prototype)) {
      console.log('❌ Background sync not supported');
      return;
    }

    try {
      await this.swRegistration.sync.register(tag);
      console.log('✅ Background sync registered:', tag);
    } catch (error) {
      console.error('❌ Background sync registration failed:', error);
    }
  }

  /**
   * Cache important data for offline use
   */
  async cacheImportantData(data, cacheName = 'user-data') {
    if (!('caches' in window)) {
      console.log('❌ Cache API not supported');
      return;
    }

    try {
      const cache = await caches.open(cacheName);
      
      // Create a synthetic response with the data
      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
      
      await cache.put('/offline-data', response);
      console.log('✅ Data cached for offline use');
    } catch (error) {
      console.error('❌ Caching failed:', error);
    }
  }

  /**
   * Get cached data for offline use
   */
  async getCachedData(cacheName = 'user-data') {
    if (!('caches' in window)) {
      return null;
    }

    try {
      const cache = await caches.open(cacheName);
      const response = await cache.match('/offline-data');
      
      if (response) {
        const data = await response.json();
        console.log('✅ Retrieved cached data');
        return data;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to retrieve cached data:', error);
      return null;
    }
  }

  /**
   * Check network status
   */
  isOnline() {
    return navigator.onLine;
  }

  /**
   * Set up network status listeners
   */
  setupNetworkListeners(onOnline, onOffline) {
    window.addEventListener('online', () => {
      console.log('🌐 Back online');
      onOnline?.();
    });

    window.addEventListener('offline', () => {
      console.log('📡 Gone offline');
      onOffline?.();
    });
  }

  /**
   * Get PWA capabilities
   */
  getCapabilities() {
    return {
      serviceWorker: 'serviceWorker' in navigator,
      pushNotifications: 'Notification' in window && 'PushManager' in window,
      backgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
      cache: 'caches' in window,
      installPrompt: !!this.installPromptEvent,
      standalone: this.isStandalone,
      installed: this.isInstalled,
      updateAvailable: this.isUpdateAvailable
    };
  }

  /**
   * Utility functions
   */
  
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  }

  async sendSubscriptionToServer(subscription) {
    try {
      // Get user token
      const user = JSON.parse(localStorage.getItem('user'));
      if (!user) return;

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          subscription: subscription.toJSON()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send subscription to server');
      }
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
    }
  }

  async removeSubscriptionFromServer(subscription) {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      if (!user) return;

      await fetch(`${import.meta.env.VITE_BACKEND_URL}/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          subscription: subscription.toJSON()
        })
      });
    } catch (error) {
      console.error('Failed to remove subscription from server:', error);
    }
  }

  shouldReloadOnUpdate() {
    // Don't reload if user is in the middle of important actions
    const criticalPages = ['/checkout', '/video-call', '/voice-call'];
    return !criticalPages.some(page => window.location.pathname.includes(page));
  }

  notifyUpdateAvailable() {
    this.updateCallbacks.forEach(callback => callback());
  }

  onUpdateAvailable(callback) {
    this.updateCallbacks.push(callback);
  }

  removeUpdateCallback(callback) {
    const index = this.updateCallbacks.indexOf(callback);
    if (index > -1) {
      this.updateCallbacks.splice(index, 1);
    }
  }
}

// Create singleton instance
const pwaService = new PWAService();

export default pwaService;

// Export convenience functions
export const {
  promptInstall,
  updateApp,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  registerBackgroundSync,
  cacheImportantData,
  getCachedData,
  isOnline,
  setupNetworkListeners,
  getCapabilities,
  onUpdateAvailable,
  removeUpdateCallback
} = pwaService;