import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api as convexApi } from "../../convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";
import { isBrowserSubscriptionRegistered, shouldRotatePushSubscription } from "@/lib/pushRegistration";

const PERMISSION_REQUEST_TIMEOUT_MS = 10_000;
const SW_READY_TIMEOUT_MS = 5_000;
const SERVER_REQUEST_TIMEOUT_MS = 15_000;

const VAPID_PUBLIC_KEY =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ?? "";
const pushConfigured = VAPID_PUBLIC_KEY.length > 0;

export type PushSubscribeAction =
  | "subscribed"
  | "already_subscribed"
  | "rebound"
  | "refreshed"
  | null;

interface UsePushNotificationsResult {
  isSupported: boolean;
  isConfigured: boolean;
  isSubscribed: boolean;
  /** True after browser and server subscription state have both been checked. */
  checked: boolean;
  permission: NotificationPermission;
  loading: boolean;
  lastError: string | null;
  lastAction: PushSubscribeAction;
  subscribe: () => Promise<Exclude<PushSubscribeAction, null> | false>;
  unsubscribe: () => Promise<boolean>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function pushErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (/not authenticated|authentication|unauthorized/i.test(message)) {
    return "Your Poscal session is not ready. Sign in again, then retry.";
  }
  if (/credentials do not match/i.test(message)) {
    return "This browser has a stale push subscription. Disable notifications in your browser, refresh Poscal, then enable them again.";
  }
  if (/timeout/i.test(message)) {
    return "Push setup timed out while contacting Poscal. Please try again.";
  }
  if (/network|fetch|connection|offline/i.test(message)) {
    return "Poscal could not reach the notification service. Check your connection and try again.";
  }

  return "Poscal could not save this device for push notifications. Please try again.";
}

const PushNotificationsContext =
  createContext<UsePushNotificationsResult | null>(null);

function usePushNotificationsState(): UsePushNotificationsResult {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [browserChecked, setBrowserChecked] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);
  const [swRegistration, setSwRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [browserSubscription, setBrowserSubscription] =
    useState<PushSubscription | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<PushSubscribeAction>(null);

  // Use Convex React's authenticated client directly. This avoids the old
  // in-memory JWT mirror race that could make device registration look unauthenticated.
  const serverSubscriptions = useQuery(
    convexApi.admin.listPushSubscriptions,
    user ? {} : "skip",
  );
  const registerPush = useMutation(convexApi.admin.subscribePush);
  const unregisterPush = useMutation(convexApi.admin.unsubscribePush);

  useEffect(() => {
    let cancelled = false;
    setBrowserChecked(false);
    setIsSubscribed(false);
    setLastAction(null);

    const checkBrowser = async () => {
      const supported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (cancelled) return;
      setIsSupported(supported);

      if (!supported) {
        setBrowserChecked(true);
        return;
      }

      setPermission(Notification.permission);

      try {
        // navigator.serviceWorker.ready is the correct readiness signal.
        // A newly installed worker may exist before navigator.serviceWorker.controller does.
        const registration = await withTimeout(
          navigator.serviceWorker.ready,
          SW_READY_TIMEOUT_MS,
          "Service Worker ready timeout",
        );
        if (cancelled) return;

        setSwRegistration(registration);
        const subscription = await registration.pushManager.getSubscription();
        if (cancelled) return;

        setBrowserSubscription(subscription);
      } catch (error) {
        logger.error("[push] Browser subscription check failed:", error);
        if (!cancelled) {
          setSwRegistration(null);
          setBrowserSubscription(null);
        }
      } finally {
        if (!cancelled) setBrowserChecked(true);
      }
    };

    void checkBrowser();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const serverHasBrowserSubscription = useMemo(() => {
    if (!browserSubscription || !serverSubscriptions) return false;
    return isBrowserSubscriptionRegistered(
      browserSubscription.endpoint,
      serverSubscriptions,
    );
  }, [browserSubscription, serverSubscriptions]);

  useEffect(() => {
    if (!user) {
      setIsSubscribed(false);
      return;
    }
    if (!browserChecked || serverSubscriptions === undefined) return;
    setIsSubscribed(Boolean(browserSubscription && serverHasBrowserSubscription));
  }, [
    user,
    browserChecked,
    browserSubscription,
    serverSubscriptions,
    serverHasBrowserSubscription,
  ]);

  const checked =
    !user ||
    !isSupported ||
    (browserChecked && serverSubscriptions !== undefined);

  const subscribe = useCallback(async (): Promise<Exclude<PushSubscribeAction, null> | false> => {
    setLastError(null);
    setLastAction(null);

    if (!user) {
      setLastError("Sign in to enable push notifications.");
      return false;
    }

    if (!pushConfigured) {
      setLastError("Push is unavailable until VITE_VAPID_PUBLIC_KEY is set.");
      return false;
    }

    if (!isSupported) {
      setLastError("Push is not supported on this device/browser.");
      return false;
    }

    setLoading(true);

    try {
      let registration = swRegistration;
      if (!registration) {
        registration = await withTimeout(
          navigator.serviceWorker.ready,
          SW_READY_TIMEOUT_MS,
          "Service Worker ready timeout",
        );
        setSwRegistration(registration);
      }

      let subscription =
        browserSubscription ?? (await registration.pushManager.getSubscription());

      // Idempotent repeat-click path. If browser and server already agree,
      // do not create or persist anything again.
      if (
        subscription &&
        isBrowserSubscriptionRegistered(
          subscription.endpoint,
          serverSubscriptions,
        )
      ) {
        setBrowserSubscription(subscription);
        setIsSubscribed(true);
        setPermission(Notification.permission);
        setLastAction("already_subscribed");
        return "already_subscribed";
      }

      let permissionResult = Notification.permission;
      if (permissionResult !== "granted") {
        permissionResult = await withTimeout(
          Notification.requestPermission(),
          PERMISSION_REQUEST_TIMEOUT_MS,
          "Permission request timeout",
        );
      }

      setPermission(permissionResult);
      if (permissionResult !== "granted") {
        setLastError(
          "Notification permission was not granted. Check your browser settings.",
        );
        return false;
      }

      if (!subscription) {
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        });
      }

      const subJson = subscription.toJSON();
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error("Invalid push subscription data");
      }

      let response;
      try {
        response = await withTimeout(
          registerPush({
            endpoint: subJson.endpoint,
            p256dhKey: subJson.keys.p256dh,
            authKey: subJson.keys.auth,
          }),
          SERVER_REQUEST_TIMEOUT_MS,
          "Server request timeout",
        );
      } catch (registerError) {
        // Backward-compatible recovery for older Convex deployments that reject an
        // endpoint previously owned by another account. Rotate the browser
        // subscription so the new authenticated user receives a fresh endpoint.
        if (shouldRotatePushSubscription(registerError)) {
          await subscription.unsubscribe();
          const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey as BufferSource,
          });

          const rotated = subscription.toJSON();
          if (!rotated.endpoint || !rotated.keys?.p256dh || !rotated.keys?.auth) {
            throw new Error("Invalid rotated push subscription data");
          }

          response = await withTimeout(
            registerPush({
              endpoint: rotated.endpoint,
              p256dhKey: rotated.keys.p256dh,
              authKey: rotated.keys.auth,
            }),
            SERVER_REQUEST_TIMEOUT_MS,
            "Server request timeout",
          );
        } else {
          throw registerError;
        }
      }

      setBrowserSubscription(subscription);
      setIsSubscribed(true);

      const status =
        response && typeof response === "object" && "status" in response
          ? String(response.status)
          : "created";

      if (status === "already_registered") {
        setLastAction("already_subscribed");
        return "already_subscribed";
      }
      if (status === "rebound") {
        setLastAction("rebound");
        return "rebound";
      }
      if (status === "refreshed") {
        setLastAction("refreshed");
        return "refreshed";
      }

      setLastAction("subscribed");
      return "subscribed";
    } catch (error) {
      logger.error("[push] Push registration failed:", error);
      setLastError(pushErrorMessage(error));
      return false;
    } finally {
      setLoading(false);
    }
  }, [
    user,
    isSupported,
    swRegistration,
    browserSubscription,
    serverSubscriptions,
    registerPush,
  ]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setLastError(null);
    setLastAction(null);

    if (!user) return false;

    setLoading(true);
    try {
      const registration =
        swRegistration ??
        (await withTimeout(
          navigator.serviceWorker.ready,
          SW_READY_TIMEOUT_MS,
          "Service Worker ready timeout",
        ));
      const subscription =
        browserSubscription ?? (await registration.pushManager.getSubscription());

      if (subscription) {
        try {
          await unregisterPush({
            endpoint: subscription.endpoint,
            id: undefined,
          });
        } catch (serverError) {
          // Continue with local unsubscribe so a stale server row cannot trap the device.
          logger.warn(
            "[push] Server unsubscribe failed; continuing local unsubscribe:",
            serverError,
          );
        }

        await subscription.unsubscribe();
      }

      setBrowserSubscription(null);
      setIsSubscribed(false);
      return true;
    } catch (error) {
      logger.error("[push] Error unsubscribing from push:", error);
      setLastError(pushErrorMessage(error));
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, swRegistration, browserSubscription, unregisterPush]);

  return {
    isSupported,
    isConfigured: pushConfigured,
    isSubscribed,
    checked,
    permission,
    loading,
    lastError,
    lastAction,
    subscribe,
    unsubscribe,
  };
}

export function PushNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const value = usePushNotificationsState();
  return createElement(
    PushNotificationsContext.Provider,
    { value },
    children,
  );
}

export function usePushNotifications(): UsePushNotificationsResult {
  const value = useContext(PushNotificationsContext);
  if (!value) {
    throw new Error(
      "usePushNotifications must be used within PushNotificationsProvider",
    );
  }
  return value;
}
