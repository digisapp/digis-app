import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudArrowUpIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

class OfflineQueueManager {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.listeners = new Set();
    this.loadQueue();
  }

  loadQueue() {
    try {
      const stored = localStorage.getItem('offline_queue');
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  }

  saveQueue() {
    try {
      localStorage.setItem('offline_queue', JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  addToQueue(action) {
    const queueItem = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 3,
      status: 'pending',
      ...action
    };

    this.queue.push(queueItem);
    this.saveQueue();
    this.notifyListeners();
    
    // Try to process immediately if online
    if (navigator.onLine && !this.processing) {
      this.processQueue();
    }

    return queueItem.id;
  }

  async processQueue() {
    if (this.processing || !navigator.onLine || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const pendingItems = this.queue.filter(item => item.status === 'pending');

    for (const item of pendingItems) {
      try {
        await this.processItem(item);
        item.status = 'completed';
        this.notifyListeners();
      } catch (error) {
        item.retries++;
        if (item.retries >= item.maxRetries) {
          item.status = 'failed';
          item.error = error.message;
        }
        console.error('Failed to process offline item:', error);
      }
    }

    // Remove completed items after 5 seconds
    setTimeout(() => {
      this.queue = this.queue.filter(item => item.status !== 'completed');
      this.saveQueue();
      this.notifyListeners();
    }, 5000);

    this.processing = false;
    this.saveQueue();
  }

  async processItem(item) {
    const { type, data, endpoint, method = 'POST' } = item;

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners() {
    this.listeners.forEach(listener => listener(this.queue));
  }

  clearQueue() {
    this.queue = [];
    this.saveQueue();
    this.notifyListeners();
  }

  retryFailed() {
    this.queue.forEach(item => {
      if (item.status === 'failed') {
        item.status = 'pending';
        item.retries = 0;
      }
    });
    this.saveQueue();
    this.notifyListeners();
    this.processQueue();
  }
}

// Singleton instance
const queueManager = new OfflineQueueManager();

const MobileOfflineQueue = () => {
  const [queue, setQueue] = useState([]);
  const [showQueue, setShowQueue] = useState(false);

  useEffect(() => {
    // Subscribe to queue updates
    const unsubscribe = queueManager.subscribe(setQueue);

    // Process queue when coming online
    const handleOnline = () => {
      queueManager.processQueue();
    };

    window.addEventListener('online', handleOnline);

    // Initial queue state
    setQueue(queueManager.queue);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const pendingCount = queue.filter(item => item.status === 'pending').length;
  const failedCount = queue.filter(item => item.status === 'failed').length;

  if (queue.length === 0) {
    return null;
  }

  return (
    <>
      {/* Floating indicator */}
      {pendingCount > 0 && (
        <motion.button
          className="mobile-offline-queue-indicator"
          onClick={() => setShowQueue(true)}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          whileTap={{ scale: 0.95 }}
        >
          <CloudArrowUpIcon className="w-5 h-5" />
          <span>{pendingCount}</span>
        </motion.button>
      )}

      {/* Queue modal */}
      <AnimatePresence>
        {showQueue && (
          <>
            <motion.div
              className="mobile-offline-queue-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQueue(false)}
            />
            
            <motion.div
              className="mobile-offline-queue-modal"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <div className="mobile-offline-queue-header">
                <h3>Offline Queue</h3>
                <button onClick={() => setShowQueue(false)}>✕</button>
              </div>

              <div className="mobile-offline-queue-content">
                {queue.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No pending actions</p>
                ) : (
                  <div className="space-y-2">
                    {queue.map((item) => (
                      <motion.div
                        key={item.id}
                        className={`mobile-offline-queue-item ${item.status}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <div className="queue-item-icon">
                          {item.status === 'pending' && (
                            <CloudArrowUpIcon className="w-5 h-5 text-blue-500" />
                          )}
                          {item.status === 'completed' && (
                            <CheckCircleIcon className="w-5 h-5 text-green-500" />
                          )}
                          {item.status === 'failed' && (
                            <XCircleIcon className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                        
                        <div className="queue-item-content">
                          <p className="queue-item-type">{item.type}</p>
                          <p className="queue-item-time">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </p>
                        </div>

                        {item.status === 'pending' && (
                          <div className="queue-item-spinner" />
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {failedCount > 0 && (
                <div className="mobile-offline-queue-footer">
                  <button
                    onClick={() => queueManager.retryFailed()}
                    className="retry-button"
                  >
                    Retry Failed ({failedCount})
                  </button>
                  <button
                    onClick={() => queueManager.clearQueue()}
                    className="clear-button"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style jsx>{`
        .mobile-offline-queue-indicator {
          position: fixed;
          bottom: 90px;
          right: 20px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          border-radius: 25px;
          font-weight: 600;
          font-size: 14px;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
          z-index: 1000;
          border: none;
        }

        .mobile-offline-queue-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 2000;
        }

        .mobile-offline-queue-modal {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: white;
          border-radius: 20px 20px 0 0;
          max-height: 70vh;
          z-index: 2001;
          display: flex;
          flex-direction: column;
        }

        .mobile-offline-queue-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .mobile-offline-queue-header h3 {
          font-size: 18px;
          font-weight: 600;
        }

        .mobile-offline-queue-header button {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #f3f4f6;
          border: none;
          font-size: 20px;
          color: #6b7280;
        }

        .mobile-offline-queue-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .mobile-offline-queue-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f9fafb;
          border-radius: 12px;
          transition: all 0.2s;
        }

        .mobile-offline-queue-item.completed {
          background: #f0fdf4;
        }

        .mobile-offline-queue-item.failed {
          background: #fef2f2;
        }

        .queue-item-content {
          flex: 1;
        }

        .queue-item-type {
          font-weight: 500;
          font-size: 14px;
          color: #1f2937;
          text-transform: capitalize;
        }

        .queue-item-time {
          font-size: 12px;
          color: #6b7280;
          margin-top: 2px;
        }

        .queue-item-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .mobile-offline-queue-footer {
          display: flex;
          gap: 10px;
          padding: 20px;
          border-top: 1px solid #e5e7eb;
        }

        .retry-button,
        .clear-button {
          flex: 1;
          padding: 12px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 14px;
          border: none;
          transition: all 0.2s;
        }

        .retry-button {
          background: #3b82f6;
          color: white;
        }

        .clear-button {
          background: #f3f4f6;
          color: #6b7280;
        }
      `}</style>
    </>
  );
};

// Export queue manager for use in other components
export { queueManager };
export default MobileOfflineQueue;