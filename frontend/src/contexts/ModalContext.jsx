import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { modalLogger } from '../utils/logger';

/**
 * ModalContext - Centralized modal state management
 *
 * Replaces 10+ individual useState flags in App.js with a single,
 * typed modal manager. Supports passing props to modals.
 */

const ModalContext = createContext(null);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
};

export const ModalProvider = ({ children }) => {
  const [modals, setModals] = useState({});

  /**
   * Open a modal with optional props
   * @param {string} modalName - Unique modal identifier
   * @param {object} props - Props to pass to the modal
   */
  const open = useCallback((modalName, props = {}) => {
    modalLogger.modal('open', modalName, props);
    setModals(prev => ({
      ...prev,
      [modalName]: { isOpen: true, props }
    }));
  }, []);

  /**
   * Close a specific modal
   * @param {string} modalName - Modal identifier to close
   */
  const close = useCallback((modalName) => {
    modalLogger.modal('close', modalName);
    setModals(prev => ({
      ...prev,
      [modalName]: { isOpen: false, props: {} }
    }));
  }, []);

  /**
   * Close all modals
   */
  const closeAll = useCallback(() => {
    modalLogger.debug('Closing all modals');
    setModals({});
  }, []);

  /**
   * Check if a specific modal is open
   * @param {string} modalName - Modal identifier
   * @returns {boolean}
   */
  const isOpen = useCallback((modalName) => {
    return modals[modalName]?.isOpen ?? false;
  }, [modals]);

  /**
   * Get props for a specific modal
   * @param {string} modalName - Modal identifier
   * @returns {object}
   */
  const getProps = useCallback((modalName) => {
    return modals[modalName]?.props ?? {};
  }, [modals]);

  // Memoize value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    open,
    close,
    closeAll,
    isOpen,
    getProps,
    modals
  }), [open, close, closeAll, isOpen, getProps, modals]);

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
};

/**
 * Modal identifiers (prevents typos)
 */
export const MODALS = {
  TOKEN_PURCHASE: 'tokenPurchase',
  MOBILE_TOKEN_PURCHASE: 'mobileTokenPurchase',
  CREATOR_DISCOVERY: 'creatorDiscovery',
  PRIVACY_SETTINGS: 'privacySettings',
  CREATOR_APPLICATION: 'creatorApplication',
  GO_LIVE_SETUP: 'goLiveSetup',
  MOBILE_LIVE_STREAM: 'mobileLiveStream',
  TOKEN_TIPPING: 'tokenTipping',
  AVAILABILITY_CALENDAR: 'availabilityCalendar',
  FAN_ENGAGEMENT: 'fanEngagement',
  AUTH: 'auth'
};
