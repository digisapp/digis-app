import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { BREAKPOINTS } from '../constants/breakpoints';
import { deviceLogger } from '../utils/logger';

/**
 * DeviceContext - Centralized device detection
 *
 * Replaces scattered useMediaQuery calls and duplicate device detection
 * logic throughout the app. Single source of truth for responsive behavior.
 */

const DeviceContext = createContext(null);

export const useDevice = () => {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice must be used within DeviceProvider');
  }
  return context;
};

export const DeviceProvider = ({ children }) => {
  // Media queries
  const isMobilePortrait = useMediaQuery(BREAKPOINTS.MOBILE_PORTRAIT_QUERY);
  const isMobileLandscape = useMediaQuery(BREAKPOINTS.MOBILE_LANDSCAPE_QUERY);
  const isMobile = useMediaQuery(BREAKPOINTS.MOBILE_QUERY) || isMobileLandscape;
  const isTablet = useMediaQuery(BREAKPOINTS.TABLET_QUERY);
  const isDesktop = !isMobile && !isTablet;

  // Touch capability detection
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Orientation
  const [orientation, setOrientation] = useState(
    window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape'
  );

  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(
        window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape'
      );
    };

    const mediaQuery = window.matchMedia('(orientation: portrait)');
    mediaQuery.addEventListener('change', handleOrientationChange);

    return () => {
      mediaQuery.removeEventListener('change', handleOrientationChange);
    };
  }, []);

  // Debug logging (only in development)
  useEffect(() => {
    deviceLogger.device({
      isMobile,
      isMobilePortrait,
      isMobileLandscape,
      isTablet,
      isDesktop,
      isTouchDevice,
      orientation,
      innerWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
      innerHeight: typeof window !== 'undefined' ? window.innerHeight : 0
    });
  }, [isMobile, isMobilePortrait, isMobileLandscape, isTablet, isDesktop, isTouchDevice, orientation]);

  // Memoize value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    // Primary flags
    isMobile,
    isTablet,
    isDesktop,

    // Additional details
    isMobilePortrait,
    isMobileLandscape,
    isTouchDevice,
    orientation,

    // Viewport dimensions
    viewport: {
      width: typeof window !== 'undefined' ? window.innerWidth : 0,
      height: typeof window !== 'undefined' ? window.innerHeight : 0
    }
  }), [isMobile, isTablet, isDesktop, isMobilePortrait, isMobileLandscape, isTouchDevice, orientation]);

  return (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  );
};
