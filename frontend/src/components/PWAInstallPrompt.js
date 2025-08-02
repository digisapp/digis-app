import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowDownTrayIcon, 
  XMarkIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

const PWAInstallPrompt = ({ 
  onInstall, 
  onDismiss,
  position = 'bottom-center', 
  variant = 'banner' // 'banner', 'modal', 'floating'
}) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installSource, setInstallSource] = useState('browser');
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deviceType, setDeviceType] = useState('desktop');

  useEffect(() => {
    detectInstallation();
    detectDevice();
    setupInstallPromptListener();
    checkStandaloneMode();
    
    return () => {
      // Cleanup listeners
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const detectInstallation = () => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      setIsStandalone(true);
    }
    
    // Check for related applications (if native app exists)
    if ('getInstalledRelatedApps' in navigator) {
      navigator.getInstalledRelatedApps().then(apps => {
        if (apps.length > 0) {
          setIsInstalled(true);
        }
      });
    }
  };

  const detectDevice = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setDeviceType('ios');
      setInstallSource('ios-safari');
    } else if (/android/.test(userAgent)) {
      setDeviceType('android');
      setInstallSource('android-chrome');
    } else if (/macintosh/.test(userAgent)) {
      setDeviceType('mac');
      setInstallSource('browser');
    } else {
      setDeviceType('desktop');
      setInstallSource('browser');
    }
  };

  const setupInstallPromptListener = () => {
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    // Show prompt after user has interacted with the app for a while
    setTimeout(() => {
      if (!isInstalled && !isStandalone && !localStorage.getItem('pwa-dismissed')) {
        setShowPrompt(true);
      }
    }, 30000); // Show after 30 seconds
  };

  const checkStandaloneMode = () => {
    // Check if running in standalone mode
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
                            window.navigator.standalone || 
                            document.referrer.includes('android-app://');
    
    setIsStandalone(isStandaloneMode);
  };

  const handleBeforeInstallPrompt = (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    
    // Store the event so it can be triggered later
    setDeferredPrompt(e);
    setInstallSource('chrome-prompt');
    
    // Show custom install prompt
    if (!localStorage.getItem('pwa-dismissed')) {
      setShowPrompt(true);
    }
  };

  const handleAppInstalled = () => {
    console.log('🎉 PWA was installed');
    setIsInstalled(true);
    setShowPrompt(false);
    setDeferredPrompt(null);
    
    // Track installation
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'pwa_install', {
        method: installSource
      });
    }
    
    onInstall?.();
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Fallback for browsers that don't support beforeinstallprompt
      showManualInstallInstructions();
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('✅ User accepted the install prompt');
    } else {
      console.log('❌ User dismissed the install prompt');
    }
    
    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-dismissed', Date.now());
    
    // Allow showing again after 7 days
    setTimeout(() => {
      localStorage.removeItem('pwa-dismissed');
    }, 7 * 24 * 60 * 60 * 1000);
    
    onDismiss?.();
  };

  const showManualInstallInstructions = () => {
    const instructions = getInstallInstructions();
    
    // Show alert with instructions
    alert(instructions.message);
  };

  const getInstallInstructions = () => {
    switch (installSource) {
      case 'ios-safari':
        return {
          icon: '📱',
          message: 'To install Digis: Tap the Share button → Add to Home Screen'
        };
      case 'android-chrome':
        return {
          icon: '📱',
          message: 'To install Digis: Tap menu (⋮) → Add to Home screen'
        };
      default:
        return {
          icon: '💻',
          message: 'To install Digis: Look for the install button in your browser\'s address bar'
        };
    }
  };

  const getPositionStyles = () => {
    const positions = {
      'bottom-center': { 
        bottom: '20px', 
        left: '50%', 
        transform: 'translateX(-50%)' 
      },
      'bottom-right': { 
        bottom: '20px', 
        right: '20px' 
      },
      'top-center': { 
        top: '20px', 
        left: '50%', 
        transform: 'translateX(-50%)' 
      },
      'center': { 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)' 
      }
    };
    return positions[position] || positions['bottom-center'];
  };

  const getBenefits = () => [
    {
      icon: '⚡',
      title: 'Faster Access',
      description: 'Launch instantly from your home screen'
    },
    {
      icon: '📱',
      title: 'Native Experience',
      description: 'Full-screen app without browser UI'
    },
    {
      icon: '🔔',
      title: 'Push Notifications',
      description: 'Get notified about new messages and calls'
    },
    {
      icon: '📦',
      title: 'Offline Access',
      description: 'Browse cached content without internet'
    }
  ];

  // Don't show if already installed or in standalone mode
  if (isInstalled || isStandalone || !showPrompt) {
    return null;
  }

  const renderBannerVariant = () => (
    <motion.div
      style={{
        position: 'fixed',
        ...getPositionStyles(),
        zIndex: 1000,
        maxWidth: '400px',
        width: '90vw'
      }}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '20px',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '15px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            {deviceType === 'ios' || deviceType === 'android' ? 
              <DevicePhoneMobileIcon style={{ width: '24px', height: '24px' }} /> :
              <ComputerDesktopIcon style={{ width: '24px', height: '24px' }} />
            }
            <div>
              <h3 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 'bold'
              }}>
                Install Digis App
              </h3>
              <p style={{
                margin: 0,
                fontSize: '14px',
                opacity: 0.9
              }}>
                Get the full app experience
              </p>
            </div>
          </div>
          
          <motion.button
            onClick={handleDismiss}
            whileTap={{ scale: 0.9 }}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <XMarkIcon style={{ width: '16px', height: '16px', color: 'white' }} />
          </motion.button>
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '15px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            opacity: 0.9
          }}>
            <SparklesIcon style={{ width: '14px', height: '14px' }} />
            Faster loading
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            opacity: 0.9
          }}>
            <span>🔔</span>
            Push notifications
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            opacity: 0.9
          }}>
            <span>📦</span>
            Offline mode
          </div>
        </div>

        <motion.button
          onClick={handleInstallClick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            width: '100%',
            padding: '12px',
            background: 'rgba(255,255,255,0.2)',
            border: '2px solid rgba(255,255,255,0.3)',
            borderRadius: '12px',
            color: 'white',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <ArrowDownTrayIcon style={{ width: '20px', height: '20px' }} />
          Install App
        </motion.button>
      </div>
    </motion.div>
  );

  const renderModalVariant = () => (
    <motion.div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: '30px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '80vh',
          overflowY: 'auto'
        }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '25px'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            📱 Install Digis
          </h2>
          <motion.button
            onClick={handleDismiss}
            whileTap={{ scale: 0.9 }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: '#f3f4f6'
            }}
          >
            <XMarkIcon style={{ width: '20px', height: '20px' }} />
          </motion.button>
        </div>

        <p style={{
          fontSize: '16px',
          color: '#666',
          lineHeight: '1.5',
          marginBottom: '25px'
        }}>
          Get the best Digis experience by installing our app. Enjoy faster loading, 
          push notifications, and offline access to your favorite creators.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px',
          marginBottom: '30px'
        }}>
          {getBenefits().map((benefit, index) => (
            <div
              key={index}
              style={{
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '12px',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                {benefit.icon}
              </div>
              <h4 style={{
                margin: '0 0 5px 0',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                {benefit.title}
              </h4>
              <p style={{
                margin: 0,
                fontSize: '12px',
                color: '#666'
              }}>
                {benefit.description}
              </p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <motion.button
            onClick={handleInstallClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              flex: 1,
              padding: '16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <ArrowDownTrayIcon style={{ width: '20px', height: '20px' }} />
            Install Now
          </motion.button>
          
          <motion.button
            onClick={handleDismiss}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              padding: '16px 20px',
              backgroundColor: '#f3f4f6',
              color: '#666',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Maybe Later
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );

  const renderFloatingVariant = () => (
    <motion.div
      style={{
        position: 'fixed',
        ...getPositionStyles(),
        zIndex: 1000
      }}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    >
      <motion.button
        onClick={handleInstallClick}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Install Digis App"
      >
        <ArrowDownTrayIcon style={{ width: '24px', height: '24px' }} />
      </motion.button>
    </motion.div>
  );

  return (
    <AnimatePresence>
      {variant === 'modal' && renderModalVariant()}
      {variant === 'floating' && renderFloatingVariant()}
      {variant === 'banner' && renderBannerVariant()}
    </AnimatePresence>
  );
};

export default PWAInstallPrompt;