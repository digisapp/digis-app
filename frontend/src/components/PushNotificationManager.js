import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ENV } from '../config/env';
import { getAuthToken } from '../utils/supabase-auth-enhanced';

const PushNotificationManager = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [permission, setPermission] = useState('default');

  useEffect(() => {
    // Check if push notifications are supported
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      checkNotificationPermission();
      checkExistingSubscription();
    }
  }, []);

  const checkNotificationPermission = () => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  };

  const checkExistingSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      setSubscription(existingSubscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeToPushNotifications = async () => {
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission !== 'granted') {
        toast.error('Please enable notifications to receive updates');
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Get VAPID public key from backend
      const authToken = await getAuthToken();
      const response = await fetch(`${ENV.BACKEND_URL}/api/notifications/vapid-key`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      let vapidPublicKey;
      if (response.ok) {
        const data = await response.json();
        vapidPublicKey = data.publicKey;
      } else {
        // Use a default key for development
        vapidPublicKey = 'BKQXDJb2M9SIwKwQJOzFB1vhiH0KdVEqe-5H0LPMr7N_6Xb0RmBM94zxZV1rXPKq5cF1h7TdB5qVfHoXn9vqGkY';
      }

      // Subscribe to push notifications
      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      // Send subscription to backend
      const subscribeResponse = await fetch(`${ENV.BACKEND_URL}/api/notifications/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          subscription: newSubscription.toJSON(),
          userAgent: navigator.userAgent
        })
      });

      if (subscribeResponse.ok) {
        setSubscription(newSubscription);
        toast.success('Push notifications enabled! You\'ll receive updates when creators you follow come online.');
      } else {
        throw new Error('Failed to save subscription');
      }

    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      toast.error('Failed to enable push notifications');
    }
  };

  const unsubscribeFromPushNotifications = async () => {
    try {
      if (!subscription) return;

      await subscription.unsubscribe();

      // Notify backend
      const authToken = await getAuthToken();
      await fetch(`${ENV.BACKEND_URL}/api/notifications/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint
        })
      });

      setSubscription(null);
      toast.success('Push notifications disabled');

    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      toast.error('Failed to disable push notifications');
    }
  };

  const testPushNotification = async () => {
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${ENV.BACKEND_URL}/api/notifications/test-push`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        toast.success('Test notification sent! Check your device.');
      } else {
        throw new Error('Failed to send test notification');
      }

    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Failed to send test notification');
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        Push Notifications
      </h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Receive notifications when creators you follow come online
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Permission: {permission === 'granted' ? '✅ Granted' : permission === 'denied' ? '❌ Denied' : '⏳ Not set'}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            {!subscription ? (
              <button
                onClick={subscribeToPushNotifications}
                disabled={permission === 'denied'}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Enable
              </button>
            ) : (
              <>
                <button
                  onClick={unsubscribeFromPushNotifications}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Disable
                </button>
                <button
                  onClick={testPushNotification}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Test
                </button>
              </>
            )}
          </div>
        </div>

        {permission === 'denied' && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
            <p className="text-sm text-red-800 dark:text-red-200">
              Notifications are blocked. Please enable them in your browser settings to receive updates.
            </p>
          </div>
        )}

        {subscription && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
            <p className="text-sm text-green-800 dark:text-green-200">
              ✅ Push notifications are active. You'll receive updates about your favorite creators.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PushNotificationManager;