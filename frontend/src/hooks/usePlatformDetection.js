import { useState, useEffect } from 'react';

export const usePlatformDetection = () => {
  const [platform, setPlatform] = useState({
    ios: false,
    android: false,
    mobile: false,
    tablet: false,
    desktop: false,
    pwa: false,
    safari: false,
    chrome: false,
    firefox: false
  });

  const [isStandalone, setIsStandalone] = useState(false);
  const [deviceFeatures, setDeviceFeatures] = useState({
    touch: false,
    vibration: false,
    notification: false,
    camera: false,
    microphone: false,
    geolocation: false,
    deviceOrientation: false,
    networkInformation: false
  });

  useEffect(() => {
    const detectPlatform = () => {
      const ua = navigator.userAgent || navigator.vendor || window.opera;
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
      const isAndroid = /Android/.test(ua);
      const isMobile = /Mobile|Android|iPhone|iPad|iPod/.test(ua);
      const isTablet = /(iPad|Android(?!.*Mobile))/i.test(ua);
      const isDesktop = !isMobile && !isTablet;
      
      // Detect browsers
      const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
      const isChrome = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor);
      const isFirefox = /Firefox/.test(ua);
      
      // Detect PWA/Standalone mode
      const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                    window.navigator.standalone ||
                    document.referrer.includes('android-app://');
      
      setPlatform({
        ios: isIOS,
        android: isAndroid,
        mobile: isMobile,
        tablet: isTablet,
        desktop: isDesktop,
        pwa: isPWA,
        safari: isSafari,
        chrome: isChrome,
        firefox: isFirefox
      });
      
      setIsStandalone(isPWA);
    };

    const detectFeatures = () => {
      setDeviceFeatures({
        touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        vibration: 'vibrate' in navigator,
        notification: 'Notification' in window,
        camera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
        microphone: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
        geolocation: 'geolocation' in navigator,
        deviceOrientation: 'DeviceOrientationEvent' in window,
        networkInformation: 'connection' in navigator || 'mozConnection' in navigator || 'webkitConnection' in navigator
      });
    };

    detectPlatform();
    detectFeatures();

    // Listen for display mode changes
    const displayModeQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e) => {
      setPlatform(prev => ({ ...prev, pwa: e.matches }));
      setIsStandalone(e.matches);
    };
    
    displayModeQuery.addListener(handleDisplayModeChange);
    
    return () => {
      displayModeQuery.removeListener(handleDisplayModeChange);
    };
  }, []);

  return {
    platform,
    isStandalone,
    deviceFeatures,
    isMobile: platform.mobile,
    isTablet: platform.tablet,
    isDesktop: platform.desktop,
    isIOS: platform.ios,
    isAndroid: platform.android,
    isPWA: platform.pwa
  };
};