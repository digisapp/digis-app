import { useEffect, useRef, useState, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import logger from '../utils/logger';
import environment from '../config/environment';

// Initialize Agora client configuration
AgoraRTC.setLogLevel(environment.isDevelopment ? 1 : 4);

// Custom hook for Agora client management
export const useAgoraClient = (config = {}) => {
  const [client, setClient] = useState(null);
  const [connectionState, setConnectionState] = useState('DISCONNECTED');
  const [networkQuality, setNetworkQuality] = useState({ uplinkNetworkQuality: 0, downlinkNetworkQuality: 0 });
  const [error, setError] = useState(null);
  const clientRef = useRef(null);
  const cleanupRef = useRef(false);

  // Initialize client
  useEffect(() => {
    if (cleanupRef.current) return;

    const initClient = async () => {
      try {
        const agoraClient = AgoraRTC.createClient({
          mode: config.mode || environment.AGORA.MODE,
          codec: config.codec || environment.AGORA.CODEC,
          ...config
        });

        // Set up event listeners
        agoraClient.on('connection-state-change', (curState, prevState) => {
          logger.info(`Connection state changed: ${prevState} -> ${curState}`);
          setConnectionState(curState);
        });

        agoraClient.on('network-quality', (stats) => {
          setNetworkQuality({
            uplinkNetworkQuality: stats.uplinkNetworkQuality,
            downlinkNetworkQuality: stats.downlinkNetworkQuality
          });
        });

        agoraClient.on('exception', (event) => {
          logger.error('Agora exception:', event);
          setError(event);
        });

        clientRef.current = agoraClient;
        setClient(agoraClient);
      } catch (err) {
        logger.error('Failed to initialize Agora client:', err);
        setError(err);
      }
    };

    initClient();

    // Cleanup function
    return () => {
      cleanupRef.current = true;
      if (clientRef.current) {
        clientRef.current.removeAllListeners();
        if (clientRef.current.connectionState !== 'DISCONNECTED') {
          clientRef.current.leave().catch(err => {
            logger.error('Error leaving channel:', err);
          });
        }
        clientRef.current = null;
      }
    };
  }, [config.mode, config.codec]);

  // Join channel
  const join = useCallback(async (appId, channel, token, uid) => {
    if (!clientRef.current) {
      throw new Error('Agora client not initialized');
    }

    try {
      logger.info(`Joining channel: ${channel}`);
      await clientRef.current.join(appId, channel, token, uid);
      logger.info('Successfully joined channel');
      return uid;
    } catch (err) {
      logger.error('Failed to join channel:', err);
      setError(err);
      throw err;
    }
  }, []);

  // Leave channel
  const leave = useCallback(async () => {
    if (!clientRef.current) {
      return;
    }

    try {
      logger.info('Leaving channel');
      await clientRef.current.leave();
      logger.info('Successfully left channel');
    } catch (err) {
      logger.error('Failed to leave channel:', err);
      setError(err);
      throw err;
    }
  }, []);

  // Publish local tracks
  const publish = useCallback(async (tracks) => {
    if (!clientRef.current) {
      throw new Error('Agora client not initialized');
    }

    try {
      logger.info('Publishing local tracks');
      await clientRef.current.publish(tracks);
      logger.info('Successfully published tracks');
    } catch (err) {
      logger.error('Failed to publish tracks:', err);
      setError(err);
      throw err;
    }
  }, []);

  // Unpublish local tracks
  const unpublish = useCallback(async (tracks) => {
    if (!clientRef.current) {
      return;
    }

    try {
      logger.info('Unpublishing local tracks');
      await clientRef.current.unpublish(tracks);
      logger.info('Successfully unpublished tracks');
    } catch (err) {
      logger.error('Failed to unpublish tracks:', err);
      setError(err);
      throw err;
    }
  }, []);

  // Subscribe to remote user
  const subscribe = useCallback(async (user, mediaType) => {
    if (!clientRef.current) {
      throw new Error('Agora client not initialized');
    }

    try {
      logger.info(`Subscribing to user ${user.uid} ${mediaType}`);
      await clientRef.current.subscribe(user, mediaType);
      logger.info(`Successfully subscribed to user ${user.uid}`);
    } catch (err) {
      logger.error(`Failed to subscribe to user ${user.uid}:`, err);
      setError(err);
      throw err;
    }
  }, []);

  // Unsubscribe from remote user
  const unsubscribe = useCallback(async (user, mediaType) => {
    if (!clientRef.current) {
      return;
    }

    try {
      logger.info(`Unsubscribing from user ${user.uid} ${mediaType}`);
      await clientRef.current.unsubscribe(user, mediaType);
      logger.info(`Successfully unsubscribed from user ${user.uid}`);
    } catch (err) {
      logger.error(`Failed to unsubscribe from user ${user.uid}:`, err);
      setError(err);
      throw err;
    }
  }, []);

  // Enable dual stream
  const enableDualStream = useCallback(async () => {
    if (!clientRef.current) {
      return;
    }

    try {
      await clientRef.current.enableDualStream();
      logger.info('Dual stream enabled');
    } catch (err) {
      logger.error('Failed to enable dual stream:', err);
    }
  }, []);

  // Set stream fallback option
  const setStreamFallbackOption = useCallback(async (uid, option) => {
    if (!clientRef.current) {
      return;
    }

    try {
      await clientRef.current.setStreamFallbackOption(uid, option);
      logger.info(`Stream fallback option set for user ${uid}`);
    } catch (err) {
      logger.error(`Failed to set stream fallback for user ${uid}:`, err);
    }
  }, []);

  return {
    client,
    connectionState,
    networkQuality,
    error,
    join,
    leave,
    publish,
    unpublish,
    subscribe,
    unsubscribe,
    enableDualStream,
    setStreamFallbackOption,
  };
};