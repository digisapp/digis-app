// Digis Service Worker for PWA functionality
// Version 1.0.2 - Fixed navigation handling in development

// Only register on frontend port
if (self.location.port === '3001') {
  console.error('❌ Service worker should not run on backend port 3001');
  self.registration.unregister();
}

const CACHE_NAME = 'digis-v1.2.2';
const OFFLINE_URL = '/offline.html';

// URLs to cache for offline functionality
const STATIC_CACHE_URLS = [
  '/',
  '/static/css/main.css',
  '/static/js/main.js',
  '/static/js/bundle.js',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  OFFLINE_URL
];

// API endpoints that should be cached
const API_CACHE_PATTERNS = [
  /\/api\/users\/profile/,
  /\/api\/tokens\/balance/,
  /\/api\/creators\/featured/,
  /\/api\/agora\/token/
];

// Video calling specific patterns
const VIDEO_CALL_PATTERNS = [
  /\/api\/agora\/token/,
  /\/api\/sessions/,
  /\/api\/users\/profile/
];

// Install event - cache static resources
self.addEventListener('install', event => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching static resources');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip service worker requests during initial page load to prevent issues
  if (request.mode === 'navigate' && !self.clients.matchAll) {
    return;
  }

  // Skip requests to webpack dev server in development
  if (url.pathname.includes('webpack') || url.pathname.includes('hot-update')) {
    return;
  }

  // Skip sockjs requests (used by webpack dev server)
  if (url.pathname.includes('sockjs-node')) {
    return;
  }

  // In development, only handle specific requests to avoid interference
  const isDevelopment = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  
  if (isDevelopment) {
    // In development, only handle API and static assets, not navigation
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(handleApiRequest(request));
    } else if (isStaticAsset(url.pathname)) {
      event.respondWith(handleStaticAsset(request));
    }
    // Let navigation requests pass through in development
    return;
  }
  
  // In production, handle all requests
  if (url.pathname.startsWith('/api/')) {
    // API requests - Network First with Cache Fallback
    event.respondWith(handleApiRequest(request));
  } else if (isStaticAsset(url.pathname)) {
    // Static assets - Cache First
    event.respondWith(handleStaticAsset(request));
  } else {
    // Navigation requests - Network First with Offline Page
    event.respondWith(handleNavigation(request));
  }
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Try network first with longer timeout for local development
    const networkResponse = await fetch(request, {
      timeout: 10000 // 10 second timeout
    });
    
    // Cache successful responses for specific endpoints
    if (networkResponse.ok && shouldCacheApiResponse(url.pathname)) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('🌐 Network failed for API request:', url.pathname, error.message);
    
    // For local development, be less aggressive about offline detection
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      console.log('🔧 Local development detected, allowing request to fail normally');
      throw error;
    }
    
    // Handle video calling specific offline scenarios
    if (isVideoCallRequest(url.pathname)) {
      return handleVideoCallOffline(request, url);
    }
    
    // Fallback to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for critical API endpoints only in production
    if (isCriticalApiEndpoint(url.pathname) && url.hostname !== 'localhost') {
      return new Response(JSON.stringify({
        error: 'Offline',
        message: 'This feature requires internet connection',
        cached: false
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    throw error;
  }
}

// Handle static assets with cache-first strategy
async function handleStaticAsset(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback to network
    const networkResponse = await fetch(request);
    
    // Cache the response
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('📦 Failed to load static asset:', request.url);
    throw error;
  }
}

// Handle navigation requests
async function handleNavigation(request) {
  try {
    // Clone the request because we might need to use it again
    const networkRequest = request.clone();
    
    // Try network first with timeout
    const networkResponse = await Promise.race([
      fetch(networkRequest),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network timeout')), 5000)
      )
    ]);
    
    // Check if response is ok
    if (!networkResponse || !networkResponse.ok) {
      throw new Error('Network response was not ok');
    }
    
    return networkResponse;
  } catch (error) {
    const url = new URL(request.url);
    
    // For local development, be less aggressive about showing offline page
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      console.log('🔧 Local development navigation failed, allowing browser default', error.message);
      // Return a basic error response instead of throwing
      return new Response('Service temporarily unavailable', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({
          'Content-Type': 'text/plain'
        })
      });
    }
    
    console.log('🌐 Network failed for navigation, serving offline page');
    
    // Serve offline page
    const cache = await caches.open(CACHE_NAME);
    const offlineResponse = await cache.match(OFFLINE_URL);
    
    if (offlineResponse) {
      return offlineResponse;
    }
    
    // Fallback offline page if not cached
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Digis - Offline</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: system-ui, sans-serif; 
              text-align: center; 
              padding: 50px; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              max-width: 400px;
              background: rgba(255,255,255,0.1);
              padding: 40px;
              border-radius: 20px;
              backdrop-filter: blur(10px);
            }
            h1 { font-size: 2.5em; margin-bottom: 20px; }
            p { font-size: 1.2em; line-height: 1.6; margin-bottom: 30px; }
            button {
              background: rgba(255,255,255,0.2);
              border: 2px solid white;
              color: white;
              padding: 15px 30px;
              border-radius: 25px;
              font-size: 16px;
              cursor: pointer;
              transition: all 0.3s;
            }
            button:hover {
              background: white;
              color: #667eea;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>📱 You're Offline</h1>
            <p>No internet connection detected. Some features may be limited, but you can still browse cached content.</p>
            <button onclick="window.location.reload()">🔄 Try Again</button>
          </div>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Helper functions
function isStaticAsset(pathname) {
  return pathname.startsWith('/static/') || 
         pathname.includes('.js') || 
         pathname.includes('.css') || 
         pathname.includes('.png') || 
         pathname.includes('.jpg') || 
         pathname.includes('.svg') || 
         pathname.includes('.ico');
}

function shouldCacheApiResponse(pathname) {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(pathname));
}

function isCriticalApiEndpoint(pathname) {
  const criticalEndpoints = [
    '/api/users/profile',
    '/api/tokens/balance',
    '/api/creators/featured'
  ];
  return criticalEndpoints.some(endpoint => pathname.includes(endpoint));
}

function isVideoCallRequest(pathname) {
  return VIDEO_CALL_PATTERNS.some(pattern => pattern.test(pathname));
}

// Handle video calling requests when offline
async function handleVideoCallOffline(request, url) {
  console.log('📹 Handling video call request offline:', url.pathname);
  
  // Try to get cached token for continuity
  const cachedResponse = await caches.match(request);
  
  if (url.pathname.includes('/api/agora/token')) {
    if (cachedResponse) {
      console.log('🎫 Using cached Agora token for offline continuity');
      return cachedResponse;
    }
    
    // Return error indicating offline status
    return new Response(JSON.stringify({
      error: 'offline_mode',
      message: 'Video calling not available offline. Chat-only mode activated.',
      fallbackMode: 'CHAT_ONLY',
      offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (url.pathname.includes('/api/sessions')) {
    // Return cached session data if available
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response(JSON.stringify({
      error: 'offline_mode',
      message: 'Session data not available offline',
      offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Default offline response for video calling
  return new Response(JSON.stringify({
    error: 'offline_mode',
    message: 'Video calling features require internet connection',
    fallbackMode: 'CHAT_ONLY',
    offline: true
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Background sync for offline actions
self.addEventListener('sync', event => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync-tokens') {
    event.waitUntil(syncPendingTokenPurchases());
  }
  
  if (event.tag === 'background-sync-messages') {
    event.waitUntil(syncPendingMessages());
  }
  
  if (event.tag === 'background-sync-video-calls') {
    event.waitUntil(syncOfflineVideoCallActions());
  }
});

// Sync pending token purchases when back online
async function syncPendingTokenPurchases() {
  try {
    const pendingPurchases = await getStoredData('pendingTokenPurchases');
    
    for (const purchase of pendingPurchases) {
      try {
        await fetch('/api/tokens/purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': purchase.authHeader
          },
          body: JSON.stringify(purchase.data)
        });
        
        // Remove from pending list
        await removeStoredData('pendingTokenPurchases', purchase.id);
        
        // Notify user of successful sync
        self.registration.showNotification('💰 Token Purchase Complete', {
          body: `Your purchase of ${purchase.data.tokenAmount} tokens has been processed!`,
          icon: '/logo192.png',
          badge: '/logo192.png',
          tag: 'token-purchase-sync'
        });
      } catch (error) {
        console.error('Failed to sync token purchase:', error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Sync pending messages when back online
async function syncPendingMessages() {
  try {
    const pendingMessages = await getStoredData('pendingMessages');
    
    for (const message of pendingMessages) {
      try {
        await fetch('/api/messages/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': message.authHeader
          },
          body: JSON.stringify(message.data)
        });
        
        // Remove from pending list
        await removeStoredData('pendingMessages', message.id);
      } catch (error) {
        console.error('Failed to sync message:', error);
      }
    }
  } catch (error) {
    console.error('Message sync failed:', error);
  }
}

// Sync offline video call actions when back online
async function syncOfflineVideoCallActions() {
  try {
    console.log('📹 Syncing offline video call actions...');
    
    const pendingActions = await getStoredData('offlineVideoCallActions');
    
    for (const action of pendingActions) {
      try {
        let response;
        
        switch (action.type) {
          case 'SESSION_END':
            response = await fetch('/api/sessions/end', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': action.authHeader
              },
              body: JSON.stringify(action.data)
            });
            break;
            
          case 'TOKEN_DEDUCTION':
            response = await fetch('/api/tokens/deduct', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': action.authHeader
              },
              body: JSON.stringify(action.data)
            });
            break;
            
          case 'CALL_METRICS':
            response = await fetch('/api/sessions/metrics', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': action.authHeader
              },
              body: JSON.stringify(action.data)
            });
            break;
            
          default:
            console.warn('Unknown video call action type:', action.type);
            continue;
        }
        
        if (response && response.ok) {
          // Remove from pending list
          await removeStoredData('offlineVideoCallActions', action.id);
          
          // Notify user if needed
          if (action.type === 'SESSION_END') {
            self.registration.showNotification('📹 Session Synced', {
              body: 'Your offline video session has been processed',
              icon: '/logo192.png',
              badge: '/logo192.png',
              tag: 'video-call-sync'
            });
          }
        }
        
      } catch (error) {
        console.error('Failed to sync video call action:', error);
      }
    }
  } catch (error) {
    console.error('Video call sync failed:', error);
  }
}

// Push notification handling
self.addEventListener('push', event => {
  console.log('📱 Push notification received');
  
  if (!event.data) {
    return;
  }
  
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: data.icon || '/logo192.png',
    badge: '/logo192.png',
    vibrate: [200, 100, 200],
    data: data.data,
    actions: data.actions || [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    requireInteraction: data.requireInteraction || false,
    tag: data.tag
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  console.log('🔔 Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  // Handle different notification actions
  let targetUrl = '/';
  
  if (event.notification.data) {
    targetUrl = event.notification.data.url || '/';
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // Try to focus existing window
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Share target handling
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  if (url.pathname === '/share' && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request));
  }
});

async function handleShareTarget(request) {
  const formData = await request.formData();
  const title = formData.get('title') || '';
  const text = formData.get('text') || '';
  const url = formData.get('url') || '';
  
  // Store shared content
  await storeData('sharedContent', {
    title,
    text,
    url,
    timestamp: Date.now()
  });
  
  // Redirect to share page
  return Response.redirect('/share-received', 302);
}

// IndexedDB helpers for offline data storage
async function storeData(storeName, data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DigisOfflineDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const putRequest = store.put({ ...data, id: data.id || Date.now() });
      putRequest.onsuccess = () => resolve(putRequest.result);
      putRequest.onerror = () => reject(putRequest.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' });
      }
    };
  });
}

async function getStoredData(storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DigisOfflineDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      const getRequest = store.getAll();
      getRequest.onsuccess = () => resolve(getRequest.result || []);
      getRequest.onerror = () => reject(getRequest.error);
    };
  });
}

async function removeStoredData(storeName, id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DigisOfflineDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const deleteRequest = store.delete(id);
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}

console.log('🎉 Digis Service Worker loaded successfully!');// Force update: Sun Jul 27 14:42:59 EDT 2025
