import { useCallback, useEffect, useState } from "react";
import { useConvexConnectionState } from "convex/react";

export type BackendAvailability = "checking" | "online" | "offline";

// Avoid a false offline state during normal reconnects (sleep/wake, network
// changes, or deploys). Convex continues reconnecting in the background.
const FIRST_CONNECTION_GRACE_MS = 8_000;
const RECONNECT_GRACE_MS = 5_000;

export const useBackendAvailability = () => {
  const connection = useConvexConnectionState();
  const [availability, setAvailability] = useState<BackendAvailability>(() =>
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "checking",
  );

  const check = useCallback(() => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setAvailability("offline");
      return;
    }
    setAvailability(connection.isWebSocketConnected ? "online" : "checking");
  }, [connection.isWebSocketConnected]);

  useEffect(() => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setAvailability("offline");
      return;
    }
    if (connection.isWebSocketConnected) {
      setAvailability("online");
      return;
    }

    setAvailability((current) => current === "offline" ? "checking" : current);
    const timeout = window.setTimeout(
      () => setAvailability("offline"),
      connection.hasEverConnected ? RECONNECT_GRACE_MS : FIRST_CONNECTION_GRACE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [connection.hasEverConnected, connection.isWebSocketConnected]);

  useEffect(() => {
    const handleOffline = () => setAvailability("offline");
    const handleOnline = () => check();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [check]);

  return { availability, check };
};
