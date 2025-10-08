import { useEffect, useState } from 'react';

/**
 * Hook to detect online/offline status
 * @returns {boolean} true if online, false if offline
 */
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Network: Online');
      setOnline(true);
    };

    const handleOffline = () => {
      console.log('📵 Network: Offline');
      setOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}
