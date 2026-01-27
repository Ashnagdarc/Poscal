import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { notificationsApi } from '@/lib/api';

const VAPID_PUBLIC_KEY = 'BE7EfMew8pPJTxly2cBT7PxInN62M2HWPB0yB-bNGwUniu0b2ouoLbEmfiQjHu5vowBcW0caNzaWpwP9mBZ0CM0';

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
      try {
        const supported = 'serviceWorker' in navigator &&
          'PushManager' in window &&
          'Notification' in window;
        setIsSupported(supported);

        if (supported) {
          setPermission(Notification.permission);

          // If SW is disabled or not yet registered, skip to avoid hangs/reloads
          if (!navigator.serviceWorker.controller) {
            logger.warn('[push] Service Worker controller missing; push setup skipped');
            return;
          }

          // Add a 2-second timeout to prevent app freeze if SW hangs
          const registrationPromise = Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('SW ready timeout')), 2000)
            )
          ]) as Promise<ServiceWorkerRegistration>;

          const registration = await registrationPromise;
          logger.log('[push] Service Worker ready:', registration);
          setSwRegistration(registration);

          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            logger.log('[push] Browser has subscription:', subscription.endpoint);
            // Verify subscription exists in database
            try {
              const subscriptions = await notificationsApi.getSubscriptions();
              const found = subscriptions.some(sub => sub.endpoint === subscription.endpoint);
              
              if (found) {
                logger.log('[push] Subscription verified in database');
                setIsSubscribed(true);
              } else {
                logger.warn('[push] Browser has subscription but not found in database. Will re-subscribe.');
                setIsSubscribed(false);
              }
            } catch (error) {
              logger.error('[push] Error checking subscription in database:', error);
              setIsSubscribed(false);
            }
          } else {
            logger.log('[push] No browser subscription found');
            setIsSubscribed(false);
          }
        }
      } catch (error) {
        logger.error('[push] Setup failed; continuing without push:', error);
        setIsSupported(false);
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
    logger.log('[push] Subscribe button clicked, starting flow...');
    try {
      logger.log('[push] Getting SW registration...');
      const registration = swRegistration ?? await navigator.serviceWorker.ready;
      logger.log('[push] SW registration obtained:', registration);

      // Request notification permission
      logger.log('[push] Requesting notification permission...');
      const permissionResult = await Notification.requestPermission();
      logger.log('[push] Permission result:', permissionResult);
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        setLastError('Notification permission was not granted.');
        return false;
      }

      // Reuse existing subscription if present (Android can fail if we try to re-subscribe)
      logger.log('[push] Getting existing subscription...');
      let subscription = await registration.pushManager.getSubscription();
      logger.log('[push] Existing subscription:', subscription?.endpoint ? 'found' : 'not found');
      if (!subscription) {
        logger.log('[push] Creating new subscription...');
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        });
        logger.log('[push] New subscription created:', subscription.endpoint);
      }

      const subJson = subscription.toJSON();
      logger.log('[push] Subscription serialized, about to send to server...');
      logger.log('[push] Push subscription obtained:', JSON.stringify(subJson));
      logger.log('[push] User ID:', user?.id ?? 'anonymous');
      logger.log('[push] Endpoint:', subJson.endpoint);
      logger.log('[push] Keys present:', { 
        p256dh: !!subJson.keys?.p256dh, 
        auth: !!subJson.keys?.auth,
        p256dhLength: subJson.keys?.p256dh?.length,
        authLength: subJson.keys?.auth?.length
      });

      // Send subscription to server
      logger.log('[push] Saving subscription to server...');
      logger.log('[push] Calling notificationsApi.subscribe with:', {
        endpoint: subJson.endpoint,
        p256dh_key_length: subJson.keys?.p256dh?.length,
        auth_key_length: subJson.keys?.auth?.length,
      });
      const response = await notificationsApi.subscribe({
        endpoint: subJson.endpoint!,
        p256dh_key: subJson.keys!.p256dh!,
        auth_key: subJson.keys!.auth!,
        user_agent: navigator.userAgent,
      });
      logger.log('[push] Subscription saved to server successfully:', response);
      setIsSubscribed(true);
      return true;
    } catch (error) {
      logger.error('[push] Error subscribing to push:', error);
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
      logger.error('[push] Error unsubscribing from push:', error);
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
