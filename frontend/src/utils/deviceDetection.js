/**
 * Device Detection Utility
 * Detects mobile vs desktop and provides device-specific optimizations
 */

export const isMobileDevice = () => {
  // Check user agent for mobile devices
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;

  // Mobile device patterns
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

  // Also check touch support and screen size
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hasSmallScreen = window.innerWidth <= 768;

  return mobileRegex.test(userAgent) || (hasTouchScreen && hasSmallScreen);
};

export const isTablet = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const tabletRegex = /iPad|Android(?!.*Mobile)/i;

  return tabletRegex.test(userAgent) || (window.innerWidth >= 768 && window.innerWidth <= 1024);
};

export const isIOS = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  return /iPhone|iPad|iPod/.test(userAgent);
};

export const getIOSVersion = () => {
  if (!isIOS()) return null;

  const match = navigator.userAgent.match(/OS (\d+)_/);
  return match ? parseInt(match[1], 10) : null;
};

export const isSafari = () => {
  const userAgent = navigator.userAgent;
  return /^((?!chrome|android).)*safari/i.test(userAgent);
};

export const supportsScreenShare = () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    return false;
  }

  // iOS 17+ supports screen sharing
  if (isIOS()) {
    const version = getIOSVersion();
    return version ? version >= 17 : false;
  }

  return true;
};

export const getDeviceType = () => {
  if (isMobileDevice() && !isTablet()) return 'mobile';
  if (isTablet()) return 'tablet';
  return 'desktop';
};

export const getOptimalLayout = () => {
  const deviceType = getDeviceType();

  // Mobile: Use immersive fullscreen layout
  if (deviceType === 'mobile') return 'immersive';

  // Tablet: Use immersive but allow side panel option
  if (deviceType === 'tablet') return 'immersive';

  // Desktop: Use classic side-by-side layout
  return 'classic';
};

export default {
  isMobileDevice,
  isTablet,
  isIOS,
  getIOSVersion,
  isSafari,
  supportsScreenShare,
  getDeviceType,
  getOptimalLayout
};
