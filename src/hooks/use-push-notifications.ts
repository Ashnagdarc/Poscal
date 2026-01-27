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
      // Step 1: Request permission with timeout
      logger.log('[push] Step 1: Requesting notification permission...');
      let permissionResult: NotificationPermission;
      
      try {
        const permPromise = Notification.requestPermission();
        // Timeout after 10 seconds if permission dialog doesn't respond
        permissionResult = await Promise.race([
          permPromise,
          new Promise<NotificationPermission>((_, reject) => 
            setTimeout(() => reject(new Error('Permission request timeout - took too long')), 10000)
          )
        ]);
      } catch (error) {
        logger.error('[push] Permission request timed out or failed:', error);
        setLastError('Permission request timeout. Please try again.');
        setLoading(false);
        return false;
      }

      logger.log('[push] Step 1 complete: Permission result =', permissionResult);
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        setLastError(`Notification permission was not granted (${permissionResult}). Check browser settings.`);
        setLoading(false);
        return false;
      }

      // Step 2: Get or create browser subscription
      logger.log('[push] Step 2: Getting service worker registration...');
      let registration: ServiceWorkerRegistration;
      
      try {
        // Try to get cached registration first
        if (swRegistration) {
          registration = swRegistration;
          logger.log('[push] Using cached SW registration');
        } else {
          // Timeout after 5 seconds for SW ready
          registration = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<ServiceWorkerRegistration>((_, reject) => 
              setTimeout(() => reject(new Error('Service Worker ready timeout')), 5000)
            )
          ]);
          logger.log('[push] Got SW registration');
          setSwRegistration(registration);
        }
      } catch (error) {
        logger.error('[push] Failed to get SW registration:', error);
        setLastError('Service Worker not ready. Please refresh the page.');
        setLoading(false);
        return false;
      }

      // Step 3: Get or create push subscription
      logger.log('[push] Step 3: Creating push subscription...');
      let subscription: PushSubscription;
      
      try {
        // Check if already subscribed
        subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
          logger.log('[push] No existing subscription, creating new one...');
          const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey as BufferSource,
          });
          logger.log('[push] New subscription created');
        } else {
          logger.log('[push] Using existing browser subscription');
        }
      } catch (error) {
        logger.error('[push] Failed to create/get subscription:', error);
        setLastError('Failed to create push subscription. Check browser support.');
        setLoading(false);
        return false;
      }

      // Step 4: Send to backend
      logger.log('[push] Step 4: Sending subscription to backend...');
      const subJson = subscription.toJSON();
      
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error('Invalid subscription data: missing endpoint or keys');
      }

      try {
        // Timeout after 15 seconds for server response
        const response = await Promise.race([
          notificationsApi.subscribe({
            endpoint: subJson.endpoint,
            p256dh_key: subJson.keys.p256dh,
            auth_key: subJson.keys.auth,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Server request timeout')), 15000)
          )
        ]);
        
        logger.log('[push] Subscription saved to server:', response);
        setIsSubscribed(true);
        setLoading(false);
        return true;
      } catch (error) {
        logger.error('[push] Failed to send subscription to server:', error);
        setLastError('Failed to save subscription to server. Check your connection.');
        setLoading(false);
        return false;
      }
    } catch (error) {
      logger.error('[push] Unexpected error during subscription:', error);
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      setLastError(message);
      setLoading(false);
      return false;
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
