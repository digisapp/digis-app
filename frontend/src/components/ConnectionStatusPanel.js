import React, { useState, useEffect, memo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WifiIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  XCircleIcon,
  ClockIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PhoneIcon,
  VideoCameraIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';

// Simple throttle utility function
const throttle = (func, delay) => {
  let lastCall = 0;
  let timeoutId = null;
  
  const throttled = (...args) => {
    const now = Date.now();
    
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    } else {
      // Clear any existing timeout
      if (timeoutId) clearTimeout(timeoutId);
      
      // Schedule a call for the end of the delay period
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func(...args);
      }, delay - (now - lastCall));
    }
  };
  
  // Add cancel method
  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  return throttled;
};

// Generate unique ID using crypto API or fallback
const generateUniqueId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const ConnectionStatusPanel = memo(({ 
  connectionResilience, 
  fallbackManager,
  isVisible = true, 
  onToggle,
  className = '' 
}) => {
  // Validate props
  if (connectionResilience && (!connectionResilience.getConnectionStatus || !connectionResilience.on || !connectionResilience.off)) {
    console.error('Invalid connectionResilience prop: missing required methods');
    return null;
  }
  
  if (fallbackManager && (!fallbackManager.getStatus || !fallbackManager.on || !fallbackManager.off)) {
    console.error('Invalid fallbackManager prop: missing required methods');
    return null;
  }

  const [connectionStatus, setConnectionStatus] = useState(null);
  const [fallbackStatus, setFallbackStatus] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [recentEvents, setRecentEvents] = useState([]);
  const [showReconnectButton, setShowReconnectButton] = useState(false);
  
  // Store throttled function reference
  const updateStatusRef = useRef(null);

  useEffect(() => {
    if (!connectionResilience && !fallbackManager) return;

    // Create throttled update function (update every 5 seconds instead of 2)
    const updateStatus = () => {
      try {
        if (connectionResilience) {
          const status = connectionResilience.getConnectionStatus();
          setConnectionStatus(status || { state: 'UNKNOWN', metrics: {} });
        }
        if (fallbackManager) {
          const status = fallbackManager.getStatus();
          setFallbackStatus(status || { currentMode: 'UNKNOWN', availableModes: [] });
        }
      } catch (error) {
        console.error('Error updating connection status:', error);
      }
    };

    // Create throttled version
    updateStatusRef.current = throttle(updateStatus, 5000);
    
    // Initial update
    updateStatus();
    
    // Set up periodic updates
    const statusInterval = setInterval(updateStatusRef.current, 5000);

    // Setup event listeners
    const eventHandlers = [];

    if (connectionResilience) {
      const handleConnectionEvent = (type, data) => {
        setRecentEvents(prev => [...prev.slice(-4), {
          type,
          data,
          timestamp: Date.now(),
          id: generateUniqueId()
        }]);
      };

      const connectionEvents = [
        'connection-established',
        'connection-lost',
        'connection-failed',
        'reconnection-scheduled',
        'reconnection-failed',
        'reconnection-exhausted',
        'fallback-activated'
      ];

      connectionEvents.forEach(event => {
        const handler = (data) => handleConnectionEvent(event, data);
        connectionResilience.on(event, handler);
        eventHandlers.push({ obj: connectionResilience, event, handler });
      });

      // Show reconnect button for certain states
      const updateReconnectButton = () => {
        try {
          const status = connectionResilience.getConnectionStatus();
          setShowReconnectButton(
            status && (
              status.state === 'DISCONNECTED' || 
              status.state === 'FAILED' ||
              (status.isReconnecting && status.reconnectAttempts >= 2)
            )
          );
        } catch (error) {
          console.error('Error updating reconnect button:', error);
        }
      };

      const reconnectHandler = () => updateReconnectButton();
      connectionResilience.on('connection-state-change', reconnectHandler);
      eventHandlers.push({ obj: connectionResilience, event: 'connection-state-change', handler: reconnectHandler });
    }

    if (fallbackManager) {
      const handleFallbackEvent = (type, data) => {
        setRecentEvents(prev => [...prev.slice(-4), {
          type: `fallback-${type}`,
          data,
          timestamp: Date.now(),
          id: generateUniqueId()
        }]);
      };

      const fallbackEvents = [
        'fallback-started',
        'fallback-completed',
        'fallback-failed',
        'recovery-started',
        'recovery-completed',
        'recovery-failed'
      ];

      fallbackEvents.forEach(event => {
        const handler = (data) => handleFallbackEvent(event.replace('fallback-', ''), data);
        fallbackManager.on(event, handler);
        eventHandlers.push({ obj: fallbackManager, event, handler });
      });
    }

    return () => {
      clearInterval(statusInterval);
      if (updateStatusRef.current) {
        updateStatusRef.current.cancel();
      }
      eventHandlers.forEach(({ obj, event, handler }) => {
        obj.off(event, handler);
      });
    };
  }, [connectionResilience, fallbackManager]);

  const getConnectionStateIcon = useCallback((state) => {
    const icons = {
      'CONNECTED': <CheckCircleIcon className="w-5 h-5 text-green-500" aria-hidden="true" />,
      'CONNECTING': <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" aria-hidden="true" />,
      'RECONNECTING': <ArrowPathIcon className="w-5 h-5 text-orange-500 animate-spin" aria-hidden="true" />,
      'DISCONNECTED': <XCircleIcon className="w-5 h-5 text-red-500" aria-hidden="true" />,
      'FAILED': <ExclamationTriangleIcon className="w-5 h-5 text-red-600" aria-hidden="true" />,
      'INITIALIZED': <InformationCircleIcon className="w-5 h-5 text-gray-500" aria-hidden="true" />,
      'UNKNOWN': <InformationCircleIcon className="w-5 h-5 text-gray-400" aria-hidden="true" />
    };
    return icons[state] || icons['UNKNOWN'];
  }, []);

  const getConnectionStateColor = useCallback((state) => {
    const colors = {
      'CONNECTED': 'text-green-600 bg-green-50 border-green-200',
      'CONNECTING': 'text-blue-600 bg-blue-50 border-blue-200',
      'RECONNECTING': 'text-orange-600 bg-orange-50 border-orange-200',
      'DISCONNECTED': 'text-red-600 bg-red-50 border-red-200',
      'FAILED': 'text-red-700 bg-red-100 border-red-300',
      'INITIALIZED': 'text-gray-600 bg-gray-50 border-gray-200',
      'UNKNOWN': 'text-gray-500 bg-gray-50 border-gray-200'
    };
    return colors[state] || colors['UNKNOWN'];
  }, []);

  const getModeIcon = useCallback((mode) => {
    const icons = {
      'FULL_VIDEO': <VideoCameraIcon className="w-4 h-4" aria-hidden="true" />,
      'REDUCED_VIDEO': <VideoCameraIcon className="w-4 h-4 opacity-60" aria-hidden="true" />,
      'AUDIO_ONLY': <PhoneIcon className="w-4 h-4" aria-hidden="true" />,
      'CHAT_ONLY': <ChatBubbleLeftRightIcon className="w-4 h-4" aria-hidden="true" />,
      'UNKNOWN': <InformationCircleIcon className="w-4 h-4" aria-hidden="true" />
    };
    return icons[mode] || icons['UNKNOWN'];
  }, []);

  const getModeColor = useCallback((mode) => {
    const colors = {
      'FULL_VIDEO': 'text-green-600 bg-green-50',
      'REDUCED_VIDEO': 'text-yellow-600 bg-yellow-50',
      'AUDIO_ONLY': 'text-blue-600 bg-blue-50',
      'CHAT_ONLY': 'text-orange-600 bg-orange-50',
      'UNKNOWN': 'text-gray-500 bg-gray-50'
    };
    return colors[mode] || colors['UNKNOWN'];
  }, []);

  const formatUptime = useCallback((uptime) => {
    if (!uptime || uptime < 0) return '0s';
    
    const seconds = Math.floor(uptime / 1000) % 60;
    const minutes = Math.floor(uptime / 60000) % 60;
    const hours = Math.floor(uptime / 3600000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }, []);

  const getEventIcon = useCallback((type) => {
    const icons = {
      'connection-established': <CheckCircleIcon className="w-4 h-4 text-green-500" aria-hidden="true" />,
      'connection-lost': <XCircleIcon className="w-4 h-4 text-red-500" aria-hidden="true" />,
      'connection-failed': <ExclamationTriangleIcon className="w-4 h-4 text-red-600" aria-hidden="true" />,
      'reconnection-scheduled': <ClockIcon className="w-4 h-4 text-blue-500" aria-hidden="true" />,
      'reconnection-failed': <XCircleIcon className="w-4 h-4 text-orange-500" aria-hidden="true" />,
      'fallback-activated': <ArrowPathIcon className="w-4 h-4 text-orange-500" aria-hidden="true" />,
      'fallback-started': <ArrowPathIcon className="w-4 h-4 text-orange-500 animate-pulse" aria-hidden="true" />,
      'fallback-completed': <CheckCircleIcon className="w-4 h-4 text-green-500" aria-hidden="true" />,
      'fallback-recovery-completed': <CheckCircleIcon className="w-4 h-4 text-blue-500" aria-hidden="true" />
    };
    return icons[type] || <InformationCircleIcon className="w-4 h-4 text-gray-500" aria-hidden="true" />;
  }, []);

  const handleForceReconnect = useCallback(async () => {
    if (connectionResilience && connectionResilience.forceReconnection) {
      try {
        await connectionResilience.forceReconnection();
      } catch (error) {
        console.error('Manual reconnection failed:', error);
      }
    }
  }, [connectionResilience]);

  if (!isVisible || (!connectionStatus && !fallbackStatus)) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 ${className}`}
      role="region"
      aria-label="Connection status panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-3">
          <WifiIcon className="w-5 h-5 text-neutral-600 dark:text-neutral-400" aria-hidden="true" />
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Connection Status
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {showReconnectButton && (
            <button
              onClick={handleForceReconnect}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Force reconnect to session"
            >
              Reconnect
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label={isExpanded ? 'Collapse connection details' : 'Expand connection details'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronUpIcon className="w-4 h-4" />
            ) : (
              <ChevronDownIcon className="w-4 h-4" />
            )}
          </button>
          {onToggle && (
            <button
              onClick={onToggle}
              className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Close connection status panel"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Connection Status */}
        {connectionStatus && (
          <div 
            className={`p-3 rounded-lg border ${getConnectionStateColor(connectionStatus.state)}`}
            role="status"
            aria-live="polite"
            aria-label={`Connection status: ${connectionStatus.state}`}
          >
            <div className="flex items-center gap-3 mb-2">
              {getConnectionStateIcon(connectionStatus.state)}
              <div>
                <span className="font-medium text-sm">
                  {connectionStatus.state.replace('_', ' ')}
                </span>
                {connectionStatus.isReconnecting && (
                  <span 
                    className="ml-2 text-xs opacity-75"
                    aria-label={`Reconnection attempt ${connectionStatus.reconnectAttempts}`}
                  >
                    (Attempt {connectionStatus.reconnectAttempts})
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-xs opacity-80">
              <span>Uptime: {formatUptime(connectionStatus.uptime)}</span>
              {connectionStatus.consecutiveFailures > 0 && (
                <span>Failures: {connectionStatus.consecutiveFailures}</span>
              )}
            </div>
          </div>
        )}

        {/* Fallback Status */}
        {fallbackStatus && (
          <div 
            className={`p-3 rounded-lg ${getModeColor(fallbackStatus.currentMode)}`}
            role="status"
            aria-live="polite"
            aria-label={`Current mode: ${fallbackStatus.currentModeLabel || fallbackStatus.currentMode}`}
          >
            <div className="flex items-center gap-3 mb-2">
              {getModeIcon(fallbackStatus.currentMode)}
              <div>
                <span className="font-medium text-sm">
                  {fallbackStatus.currentModeLabel || fallbackStatus.currentMode}
                </span>
                {fallbackStatus.isFallbackActive && (
                  <span className="ml-2 text-xs opacity-75">
                    (Fallback Active)
                  </span>
                )}
              </div>
            </div>
            
            {fallbackStatus.fallbackReason && (
              <div className="text-xs opacity-80">
                Reason: {fallbackStatus.fallbackReason.replace(/_/g, ' ').toLowerCase()}
              </div>
            )}
          </div>
        )}

        {/* Transition in Progress */}
        {(connectionStatus?.isReconnecting || fallbackStatus?.transitionInProgress) && (
          <div 
            className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg"
            role="status"
            aria-live="assertive"
          >
            <ArrowPathIcon className="w-4 h-4 text-blue-500 animate-spin" aria-hidden="true" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              {connectionStatus?.isReconnecting && 'Reconnecting...'}
              {fallbackStatus?.transitionInProgress && 'Switching modes...'}
            </span>
          </div>
        )}

        {/* Expanded Details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 border-t border-neutral-200 dark:border-neutral-700 pt-4"
              aria-label="Connection details"
            >
              {/* Connection Metrics */}
              {connectionStatus && (
                <div className="bg-neutral-50 dark:bg-neutral-700 rounded p-3">
                  <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Connection Metrics
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-neutral-500 dark:text-neutral-400">Total Drops:</span>
                      <span className="ml-2 font-medium">{connectionStatus.metrics?.totalDrops || 0}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 dark:text-neutral-400">Reconnects:</span>
                      <span className="ml-2 font-medium">{connectionStatus.metrics?.totalReconnects || 0}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 dark:text-neutral-400">Mode:</span>
                      <span className="ml-2 font-medium">{connectionStatus.mode || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 dark:text-neutral-400">Fallback:</span>
                      <span className="ml-2 font-medium">
                        {connectionStatus.fallbackActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Fallback Details */}
              {fallbackStatus && fallbackStatus.availableModes && (
                <div className="bg-neutral-50 dark:bg-neutral-700 rounded p-3">
                  <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Available Modes
                  </h4>
                  <div className="flex flex-wrap gap-2" role="list">
                    {fallbackStatus.availableModes.map(mode => (
                      <span 
                        key={mode}
                        role="listitem"
                        className={`px-2 py-1 rounded text-xs ${
                          mode === fallbackStatus.currentMode 
                            ? 'bg-blue-100 text-blue-700 font-medium' 
                            : 'bg-neutral-200 text-neutral-600'
                        }`}
                        aria-current={mode === fallbackStatus.currentMode ? 'true' : 'false'}
                      >
                        {mode.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                  
                  {fallbackStatus.chatConnected !== undefined && (
                    <div className="mt-2 text-xs">
                      <span className="text-neutral-500 dark:text-neutral-400">Chat:</span>
                      <span className={`ml-2 font-medium ${
                        fallbackStatus.chatConnected ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {fallbackStatus.chatConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Recent Events */}
              {recentEvents.length > 0 && (
                <div className="bg-neutral-50 dark:bg-neutral-700 rounded p-3">
                  <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Recent Events
                  </h4>
                  <div className="space-y-2" role="list">
                    {recentEvents.slice(-5).reverse().map(event => (
                      <div key={event.id} className="flex items-center gap-2 text-xs" role="listitem">
                        {getEventIcon(event.type)}
                        <span className="text-neutral-600 dark:text-neutral-400">
                          {event.type.replace(/-/g, ' ').replace(/^./, str => str.toUpperCase())}
                        </span>
                        <span className="text-neutral-500 dark:text-neutral-500 ml-auto">
                          {new Date(event.timestamp).toLocaleTimeString().slice(0, 5)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

ConnectionStatusPanel.displayName = 'ConnectionStatusPanel';

export default ConnectionStatusPanel;