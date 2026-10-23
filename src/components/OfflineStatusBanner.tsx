import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  listOfflineOperations,
  OFFLINE_DATA_CHANGED_EVENT,
} from "@/lib/offlineStore";

export const OfflineStatusBanner = () => {
  const { user, isOffline, backendAvailability } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [issueCount, setIssueCount] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setPendingCount(0);
      setIssueCount(0);
      return;
    }

    let active = true;
    const refresh = () => {
      void listOfflineOperations(user.id).then((operations) => {
        if (active) {
          setPendingCount(
            operations.filter((operation) => operation.status === "pending" || operation.status === "syncing").length,
          );
          setIssueCount(
            operations.filter((operation) => operation.status === "conflict" || operation.status === "failed").length,
          );
        }
      });
    };
    refresh();
    window.addEventListener(OFFLINE_DATA_CHANGED_EVENT, refresh);
    return () => {
      active = false;
      window.removeEventListener(OFFLINE_DATA_CHANGED_EVENT, refresh);
    };
  }, [user?.id]);

  if (!isOffline && pendingCount === 0 && issueCount === 0) return null;

  return (
    <div
      className="border-b border-amber-500/20 bg-amber-50 px-4 py-2 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-2 text-xs font-medium sm:text-sm">
        {isOffline ? (
          <CloudOff className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <span>
          {issueCount > 0
            ? `${issueCount} offline change${issueCount === 1 ? "" : "s"} need review and were not applied to the server.`
            : isOffline
            ? `The server is down. Poscal is still working with the journals saved on this device${pendingCount > 0 ? `. ${pendingCount} change${pendingCount === 1 ? "" : "s"} will sync when the server returns.` : "."}`
            : backendAvailability === "online"
              ? `${pendingCount} saved change${pendingCount === 1 ? "" : "s"} waiting to sync.`
              : `${pendingCount} change${pendingCount === 1 ? "" : "s"} saved on this device.`}
        </span>
      </div>
    </div>
  );
};
