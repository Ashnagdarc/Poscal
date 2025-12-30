import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const VAPID_PUBLIC_KEY = 'BIKdCaWdeDFW1_vulFr0CMSwr3GAGpEB-iz2rMRiN4k5FcbNrpcIP5GgmlN4TLHZhE_izyZVIVYGh07k2qy3Tcw';

interface UsePushNotificationsResult {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission;
  loading: boolean;
  lastError: string | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushNotifications = (): UsePushNotificationsResult => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const checkSupport = async () => {
      const supported = 'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;
      setIsSupported(supported);

      if (supported) {
        setPermission(Notification.permission);

        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          await navigator.serviceWorker.ready;
          console.log('[push] Service Worker registered:', registration);
          setSwRegistration(registration);

          const subscription = await registration.pushManager.getSubscription();
          setIsSubscribed(!!subscription);
        } catch (error) {
          console.error('[push] Service Worker registration failed:', error);
        }
      }
    };

    checkSupport();
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    setLastError(null);

    if (!isSupported) {
      setLastError('Push is not supported on this device/browser.');
      return false;
    }

    setLoading(true);
    try {
      const registration = swRegistration ?? await navigator.serviceWorker.ready;

      // Request notification permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        setLastError('Notification permission was not granted.');
        return false;
      }

      // Reuse existing subscription if present (Android can fail if we try to re-subscribe)
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        });
      }

      console.log('[push] Push subscription:', subscription);

      // Send subscription to server
      const { data, error } = await supabase.functions.invoke('subscribe-push', {
        body: {
          subscription: subscription.toJSON(),
          user_id: user?.id ?? null,
        },
      });

      if (error) {
        console.error('[push] subscribe-push failed:', error);
        throw error;
      }

      console.log('[push] subscribe-push success:', data);
      setIsSubscribed(true);
      return true;
    } catch (error) {
      console.error('[push] Error subscribing to push:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      setLastError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported, swRegistration, user?.id]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!swRegistration) return false;

    setLoading(true);
    try {
      const subscription = await swRegistration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error('[push] Error unsubscribing from push:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [swRegistration]);

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    lastError,
    subscribe,
    unsubscribe,
  };
};