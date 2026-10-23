import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { TRADES_QUERY_KEY } from "@/hooks/queries/use-trades-query";
import {
  applyOfflineTradeRevision,
  isLikelyNetworkError,
  listOfflineOperations,
  OFFLINE_DATA_CHANGED_EVENT,
  remapOfflineEntity,
  removeOfflineOperation,
  updateOfflineOperation,
  type OfflineOperation,
} from "@/lib/offlineStore";
import { withSyncedRevision } from "@/lib/offlineOutbox";
import { replayOfflineOperation } from "@/lib/offlineSync";

const describeSyncError = (error: unknown) =>
  error instanceof Error ? error.message : String(error ?? "Could not sync this change");

const withSyncLock = async (task: () => Promise<void>) => {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!locks?.request) {
    await task();
    return;
  }
  await locks.request("poscal-offline-sync", { ifAvailable: true }, async (lock) => {
    if (!lock) return;
    await task();
  });
};

export const OfflineSyncManager = () => {
  const { user, authMode } = useAuth();
  const queryClient = useQueryClient();
  const running = useRef(false);

  const sync = useCallback(async () => {
    if (running.current || authMode !== "online_authenticated" || !user?.id) return;
    await withSyncLock(async () => {
    if (running.current || !user?.id) return;
    running.current = true;
    let syncedCount = 0;
    const revisionByEntity = new Map<string, number>();

    try {
      // Re-read after every operation. A successful offline create remaps later
      // operations from its temporary ID to the real Convex ID.
      for (let index = 0; index < 256; index += 1) {
        const operations = await listOfflineOperations(user.id);
        if (operations.length === 0) break;
        const operation = operations[0] as OfflineOperation;
        if (operation.status === "conflict" || operation.status === "failed") break;

        await updateOfflineOperation(operation.clientOperationId, {
          status: "syncing",
          attemptCount: operation.attemptCount + 1,
          lastError: null,
        });

        try {
          const result = await replayOfflineOperation(
            withSyncedRevision(operation, revisionByEntity),
          );
          if (result.revision !== null) {
            revisionByEntity.set(result.entityId, result.revision);
          }
          if (operation.operation === "create" && operation.entityId !== result.entityId) {
            await remapOfflineEntity(
              operation.accountId,
              operation.journalId,
              operation.entityId,
              result.entityId,
              result.revision ?? 1,
            );
          } else if (result.revision !== null) {
            await applyOfflineTradeRevision(
              operation.accountId,
              operation.journalId,
              result.entityId,
              result.revision,
            );
          }
          await removeOfflineOperation(operation.clientOperationId);
          syncedCount += 1;
        } catch (error) {
          const message = describeSyncError(error);
          if (isLikelyNetworkError(error)) {
            await updateOfflineOperation(operation.clientOperationId, {
              status: "pending",
              lastError: message,
            });
          } else if (/OFFLINE_SYNC_CONFLICT/.test(message)) {
            await updateOfflineOperation(operation.clientOperationId, {
              status: "conflict",
              lastError: "A newer server edit exists. This device's copy was not applied.",
            });
            toast.error("One offline journal change needs review before it can sync.");
          } else {
            await updateOfflineOperation(operation.clientOperationId, {
              status: "failed",
              lastError: message,
            });
            toast.error("One saved offline change could not be synced.");
          }
          break;
        }
      }
    } finally {
      running.current = false;
      if (syncedCount > 0) {
        void queryClient.invalidateQueries({ queryKey: TRADES_QUERY_KEY });
        toast.success(
          `${syncedCount} offline change${syncedCount === 1 ? "" : "s"} synced.`,
        );
      }
    }
    });
  }, [authMode, queryClient, user?.id]);

  useEffect(() => {
    if (authMode !== "online_authenticated" || !user?.id) return;
    void sync();
    const handleChange = () => void sync();
    const handleFocus = () => void sync();
    window.addEventListener(OFFLINE_DATA_CHANGED_EVENT, handleChange);
    window.addEventListener("online", handleChange);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener(OFFLINE_DATA_CHANGED_EVENT, handleChange);
      window.removeEventListener("online", handleChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [authMode, sync, user?.id]);

  return null;
};
