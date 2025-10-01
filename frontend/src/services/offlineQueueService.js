// Offline queue service for handling actions when offline and syncing on reconnect
// Ensures messages, uploads, and other actions aren't lost due to network issues

import { useState, useEffect } from 'react';
import { devLog, devError } from '../utils/devLog';

const STORAGE_KEY = 'digis_offline_queue';
const MAX_QUEUE_SIZE = 100;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

class OfflineQueueService {
  constructor() {
    this.queue = [];
    this.isOnline = navigator.onLine;
    this.isFlushing = false;
    this.listeners = new Set();
    this.retryTimeouts = new Map();

    // Load persisted queue
    this.loadQueue();

    // Set up network listeners
    this.setupNetworkListeners();
  }

  /**
   * Initialize network event listeners
   */
  setupNetworkListeners() {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    // Also listen to custom network status events
    window.addEventListener('network:status', (event) => {
      if (event.detail?.isOnline) {
        this.handleOnline();
      } else {
        this.handleOffline();
      }
    });

    devLog('Offline queue service initialized');
  }

  /**
   * Handle online event
   */
  async handleOnline() {
    devLog('Network online - flushing offline queue');
    this.isOnline = true;

    // Notify listeners
    this.notifyListeners('online');

    // Flush queue after small delay to ensure network is stable
    setTimeout(() => {
      this.flushQueue();
    }, 500);
  }

  /**
   * Handle offline event
   */
  handleOffline() {
    devLog('Network offline - queuing enabled');
    this.isOnline = false;

    // Notify listeners
    this.notifyListeners('offline');
  }

  /**
   * Add an action to the queue
   * @param {Object} action - Action to queue
   * @returns {string} Queue item ID
   */
  enqueue(action) {
    const queueItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: action.type || 'unknown',
      data: action.data,
      timestamp: Date.now(),
      attempts: 0,
      metadata: action.metadata || {},
      processor: action.processor // Function name to process this item
    };

    // Check queue size limit
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      devError('Offline queue full, removing oldest item');
      this.queue.shift();
    }

    this.queue.push(queueItem);
    this.persistQueue();

    devLog('Action queued:', queueItem);

    // Notify listeners
    this.notifyListeners('queued', queueItem);

    // Try to flush immediately if online
    if (this.isOnline) {
      this.flushQueue();
    }

    return queueItem.id;
  }

  /**
   * Queue a message for sending
   * @param {Object} message - Message data
   * @returns {string} Queue item ID
   */
  queueMessage(message) {
    return this.enqueue({
      type: 'message',
      data: message,
      processor: 'processMessage',
      metadata: {
        conversationId: message.conversationId,
        receiverId: message.receiverId
      }
    });
  }

  /**
   * Queue a file upload
   * @param {Object} upload - Upload data
   * @returns {string} Queue item ID
   */
  queueUpload(upload) {
    return this.enqueue({
      type: 'upload',
      data: upload,
      processor: 'processUpload',
      metadata: {
        fileName: upload.file?.name,
        fileSize: upload.file?.size,
        fileType: upload.file?.type
      }
    });
  }

  /**
   * Queue an API call
   * @param {Object} apiCall - API call data
   * @returns {string} Queue item ID
   */
  queueApiCall(apiCall) {
    return this.enqueue({
      type: 'api',
      data: apiCall,
      processor: 'processApiCall',
      metadata: {
        method: apiCall.method,
        endpoint: apiCall.endpoint
      }
    });
  }

  /**
   * Flush the offline queue
   */
  async flushQueue() {
    if (!this.isOnline || this.isFlushing || this.queue.length === 0) {
      return;
    }

    this.isFlushing = true;
    devLog(`Flushing ${this.queue.length} queued items`);

    const itemsToProcess = [...this.queue];

    for (const item of itemsToProcess) {
      try {
        await this.processQueueItem(item);

        // Remove from queue on success
        this.removeFromQueue(item.id);

        // Notify success
        this.notifyListeners('processed', item);

      } catch (error) {
        devError(`Failed to process queue item ${item.id}:`, error);

        // Increment attempts
        item.attempts++;

        if (item.attempts >= MAX_RETRY_ATTEMPTS) {
          devError(`Max attempts reached for item ${item.id}, removing from queue`);
          this.removeFromQueue(item.id);
          this.notifyListeners('failed', item);
        } else {
          // Schedule retry with exponential backoff
          const delay = RETRY_DELAY * Math.pow(2, item.attempts - 1);
          this.scheduleRetry(item, delay);
        }
      }
    }

    this.isFlushing = false;
    this.persistQueue();

    if (this.queue.length === 0) {
      devLog('Offline queue flushed successfully');
      this.notifyListeners('flushed');
    }
  }

  /**
   * Process a single queue item
   * @param {Object} item - Queue item to process
   */
  async processQueueItem(item) {
    const processor = this.processors[item.processor];

    if (!processor) {
      throw new Error(`No processor found for ${item.processor}`);
    }

    return await processor(item.data);
  }

  /**
   * Schedule a retry for a queue item
   * @param {Object} item - Queue item
   * @param {number} delay - Delay in milliseconds
   */
  scheduleRetry(item, delay) {
    devLog(`Scheduling retry for item ${item.id} in ${delay}ms`);

    // Clear existing timeout
    if (this.retryTimeouts.has(item.id)) {
      clearTimeout(this.retryTimeouts.get(item.id));
    }

    const timeoutId = setTimeout(async () => {
      this.retryTimeouts.delete(item.id);

      if (this.isOnline) {
        try {
          await this.processQueueItem(item);
          this.removeFromQueue(item.id);
          this.notifyListeners('processed', item);
        } catch (error) {
          devError(`Retry failed for item ${item.id}:`, error);
        }
      }
    }, delay);

    this.retryTimeouts.set(item.id, timeoutId);
  }

  /**
   * Remove an item from the queue
   * @param {string} itemId - Item ID
   */
  removeFromQueue(itemId) {
    const index = this.queue.findIndex(item => item.id === itemId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.persistQueue();
    }

    // Clear retry timeout if exists
    if (this.retryTimeouts.has(itemId)) {
      clearTimeout(this.retryTimeouts.get(itemId));
      this.retryTimeouts.delete(itemId);
    }
  }

  /**
   * Clear the entire queue
   */
  clearQueue() {
    // Clear all retry timeouts
    this.retryTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.retryTimeouts.clear();

    this.queue = [];
    this.persistQueue();
    devLog('Offline queue cleared');
    this.notifyListeners('cleared');
  }

  /**
   * Get queue status
   * @returns {Object} Queue status
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      isFlushing: this.isFlushing,
      queueLength: this.queue.length,
      items: this.queue.map(item => ({
        id: item.id,
        type: item.type,
        timestamp: item.timestamp,
        attempts: item.attempts
      }))
    };
  }

  /**
   * Persist queue to localStorage
   */
  persistQueue() {
    try {
      // Don't persist file objects, only metadata
      const queueToPersist = this.queue.map(item => ({
        ...item,
        data: item.type === 'upload' ?
          { ...item.data, file: null } :
          item.data
      }));

      localStorage.setItem(STORAGE_KEY, JSON.stringify(queueToPersist));
    } catch (error) {
      devError('Failed to persist offline queue:', error);
    }
  }

  /**
   * Load queue from localStorage
   */
  loadQueue() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        devLog(`Loaded ${this.queue.length} items from offline queue`);
      }
    } catch (error) {
      devError('Failed to load offline queue:', error);
      this.queue = [];
    }
  }

  /**
   * Register a listener for queue events
   * @param {Function} listener - Listener function
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of an event
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        devError('Listener error:', error);
      }
    });
  }

  /**
   * Register processors for different action types
   * Override these with actual implementations
   */
  processors = {
    processMessage: async (data) => {
      // Import apiClient dynamically to avoid circular dependency
      const { apiClient } = await import('../utils/apiClient');
      return await apiClient.post('/api/messages/send', data);
    },

    processUpload: async (data) => {
      // Import uploadService dynamically
      const { uploadService } = await import('./uploadService');
      return await uploadService.uploadFile(data.file, data.options);
    },

    processApiCall: async (data) => {
      const { apiClient } = await import('../utils/apiClient');
      const method = data.method.toLowerCase();

      if (method === 'get') {
        return await apiClient.get(data.endpoint, data.options);
      } else if (method === 'post') {
        return await apiClient.post(data.endpoint, data.body, data.options);
      } else if (method === 'put') {
        return await apiClient.put(data.endpoint, data.body, data.options);
      } else if (method === 'delete') {
        return await apiClient.delete(data.endpoint, data.options);
      }

      throw new Error(`Unsupported method: ${method}`);
    }
  };

  /**
   * Register custom processor
   * @param {string} name - Processor name
   * @param {Function} processor - Processor function
   */
  registerProcessor(name, processor) {
    this.processors[name] = processor;
  }
}

// Export singleton instance
export const offlineQueue = new OfflineQueueService();

// Export for testing
export { OfflineQueueService };

// Hook for React components
export function useOfflineQueue() {
  const [status, setStatus] = useState(() => offlineQueue.getStatus());

  useEffect(() => {
    const unsubscribe = offlineQueue.subscribe((event, data) => {
      setStatus(offlineQueue.getStatus());
    });

    return unsubscribe;
  }, []);

  return {
    ...status,
    enqueue: offlineQueue.enqueue.bind(offlineQueue),
    queueMessage: offlineQueue.queueMessage.bind(offlineQueue),
    queueUpload: offlineQueue.queueUpload.bind(offlineQueue),
    queueApiCall: offlineQueue.queueApiCall.bind(offlineQueue),
    clearQueue: offlineQueue.clearQueue.bind(offlineQueue)
  };
}