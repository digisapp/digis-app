import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const MobileNetworkStatus = memo(() => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionType, setConnectionType] = useState('unknown');
  const [effectiveType, setEffectiveType] = useState('unknown');
  const [downlink, setDownlink] = useState(null);
  const [rtt, setRtt] = useState(null);
  const [showStatus, setShowStatus] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const updateNetworkStatus = () => {
      setIsOnline(navigator.onLine);
      
      // Get connection information if available
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      
      if (connection) {
        setConnectionType(connection.type || 'unknown');
        setEffectiveType(connection.effectiveType || 'unknown');
        setDownlink(connection.downlink || null);
        setRtt(connection.rtt || null);
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowStatus(true);
        setTimeout(() => setShowStatus(false), 3000);
      }
      setWasOffline(false);
      updateNetworkStatus();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowStatus(true);
      updateNetworkStatus();
    };

    // Initial check
    updateNetworkStatus();

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Monitor connection changes
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      connection.addEventListener('change', updateNetworkStatus);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateNetworkStatus);
      }
    };
  }, [wasOffline]);

  const getConnectionQuality = () => {
    if (!isOnline) return 'offline';
    
    switch (effectiveType) {
      case '4g':
        return 'excellent';
      case '3g':
        return 'good';
      case '2g':
        return 'fair';
      case 'slow-2g':
        return 'poor';
      default:
        return downlink > 1 ? 'good' : 'fair';
    }
  };

  const connectionQuality = getConnectionQuality();

  return (
    <>
      <AnimatePresence>
        {showStatus && (
          <motion.div
            className={`mobile-network-status ${!isOnline ? 'offline' : 'online'}`}
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
          >
            <div className="mobile-network-status-content">
              {isOnline ? (
                <>
                  <WifiIcon className="w-5 h-5" />
                  <span>Back Online</span>
                </>
              ) : (
                <>
                  <ExclamationTriangleIcon className="w-5 h-5" />
                  <span>No Internet Connection</span>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent offline indicator */}
      {!isOnline && (
        <div className="mobile-offline-indicator">
          <ExclamationTriangleIcon className="w-4 h-4" />
          <span>Offline Mode</span>
        </div>
      )}

      {/* Connection quality indicator for development */}
      {process.env.NODE_ENV === 'development' && isOnline && (
        <div className="mobile-connection-debug">
          <div className={`connection-dot ${connectionQuality}`} />
          <span>{effectiveType}</span>
          {downlink && <span>{downlink}Mbps</span>}
        </div>
      )}

      <style jsx>{`
        .mobile-network-status {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          pointer-events: none;
        }

        .mobile-network-status-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          font-size: 14px;
          font-weight: 600;
        }

        .mobile-network-status.offline {
          background: linear-gradient(to bottom, #ef4444, #dc2626);
          color: white;
        }

        .mobile-network-status.online {
          background: linear-gradient(to bottom, #10b981, #059669);
          color: white;
        }

        .mobile-offline-indicator {
          position: fixed;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: rgba(239, 68, 68, 0.9);
          color: white;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          backdrop-filter: blur(10px);
          z-index: 1000;
          pointer-events: none;
        }

        .mobile-connection-debug {
          position: fixed;
          top: 10px;
          right: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          border-radius: 12px;
          font-size: 11px;
          z-index: 10000;
        }

        .connection-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .connection-dot.excellent {
          background: #10b981;
        }

        .connection-dot.good {
          background: #3b82f6;
        }

        .connection-dot.fair {
          background: #f59e0b;
        }

        .connection-dot.poor {
          background: #ef4444;
        }

        .connection-dot.offline {
          background: #6b7280;
          animation: none;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </>
  );
});

MobileNetworkStatus.displayName = 'MobileNetworkStatus';

export default MobileNetworkStatus;