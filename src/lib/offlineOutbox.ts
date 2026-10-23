export type OfflineOperationStatus = "pending" | "syncing" | "conflict" | "failed";

export type OfflineOperation = {
  clientOperationId: string;
  accountId: string;
  entityType: "trade" | "notebook" | "progress";
  entityId: string;
  journalId: string;
  operation: "create" | "update" | "delete";
  baseRevision: number | null;
  payload: Record<string, unknown>;
  createdAtMs: number;
  attemptCount: number;
  status: OfflineOperationStatus;
  lastError: string | null;
};

export type OutboxPlan = {
  put: OfflineOperation[];
  deleteIds: string[];
};

const isOpen = (operation: OfflineOperation) =>
  operation.status === "pending" || operation.status === "syncing";

const sameEntity = (left: OfflineOperation, right: OfflineOperation) =>
  left.accountId === right.accountId
  && left.entityId === right.entityId
  && left.journalId === right.journalId;

/**
 * Fold a new local write into the existing outbox.
 * Pending creates that never reached the server are dropped on delete.
 * Repeated edits keep the first operation id and the original server revision.
 */
export const planOutboxChange = (
  existing: OfflineOperation[],
  incoming: OfflineOperation,
): OutboxPlan => {
  const related = existing.filter((operation) => sameEntity(operation, incoming) && isOpen(operation));
  const pending = related.filter((operation) => operation.status === "pending");

  if (incoming.operation === "delete") {
    if (pending.some((operation) => operation.operation === "create")) {
      return { put: [], deleteIds: pending.map((operation) => operation.clientOperationId) };
    }
    const earliestUpdate = pending.find((operation) => operation.operation === "update");
    return {
      put: [{
        ...incoming,
        baseRevision: earliestUpdate?.baseRevision ?? incoming.baseRevision,
      }],
      deleteIds: pending
        .filter((operation) => operation.operation !== "delete")
        .map((operation) => operation.clientOperationId),
    };
  }

  if (incoming.operation === "update") {
    const pendingCreate = pending.find((operation) => operation.operation === "create");
    if (
      pendingCreate
      && incoming.entityType === "trade"
      && pendingCreate.payload.kind !== "notebook_draft"
    ) {
      return {
        put: [{
          ...pendingCreate,
          payload: { ...pendingCreate.payload, ...incoming.payload },
        }],
        deleteIds: [],
      };
    }

    const pendingUpdate = pending.find((operation) =>
      operation.operation === "update" && operation.entityType === incoming.entityType,
    );
    if (pendingUpdate) {
      return {
        put: [{
          ...pendingUpdate,
          payload: { ...pendingUpdate.payload, ...incoming.payload },
        }],
        deleteIds: [],
      };
    }
  }

  return { put: [incoming], deleteIds: [] };
};

export const overlayCachedTrades = <T extends { id: string }>(
  cached: T[],
  serverTrades: T[],
  operations: OfflineOperation[],
  replaceUnseen: boolean,
): T[] => {
  const active = operations.filter((operation) => operation.status !== "failed");
  const deleted = new Set(
    active.filter((operation) => operation.operation === "delete").map((operation) => operation.entityId),
  );
  const pending = new Set(active.map((operation) => operation.entityId));
  const next = new Map<string, T>();

  for (const trade of cached) {
    if (!replaceUnseen || trade.id.startsWith("offline:") || pending.has(trade.id)) {
      next.set(trade.id, trade);
    }
  }
  for (const trade of serverTrades) {
    if (deleted.has(trade.id)) continue;
    if (pending.has(trade.id) && next.has(trade.id)) continue;
    next.set(trade.id, trade);
  }
  for (const id of deleted) next.delete(id);

  const values = [...next.values()];
  return [
    ...values.filter((trade) => trade.id.startsWith("offline:")),
    ...values.filter((trade) => !trade.id.startsWith("offline:")),
  ];
};

export const mergeOfflineTrades = <T extends { id: string }>(
  serverTrades: T[],
  localTrades: T[],
  operations: OfflineOperation[],
): T[] => {
  const active = operations.filter((operation) => operation.status !== "failed");
  const deleted = new Set(
    active.filter((operation) => operation.operation === "delete").map((operation) => operation.entityId),
  );
  const touched = new Set(active.map((operation) => operation.entityId));
  const localById = new Map(localTrades.map((trade) => [trade.id, trade]));
  const merged: T[] = [];
  const seen = new Set<string>();

  for (const trade of localTrades) {
    if (!trade.id.startsWith("offline:") || deleted.has(trade.id) || seen.has(trade.id)) continue;
    merged.push(trade);
    seen.add(trade.id);
  }

  for (const trade of serverTrades) {
    if (deleted.has(trade.id) || seen.has(trade.id)) continue;
    const local = localById.get(trade.id);
    merged.push(touched.has(trade.id) && local ? local : trade);
    seen.add(trade.id);
  }

  return merged;
};

/** Later same-device edits must target the revision produced by the earlier replay. */
export const withSyncedRevision = (
  operation: OfflineOperation,
  latestRevisionByEntity: ReadonlyMap<string, number>,
): OfflineOperation => {
  if (operation.operation === "create" || operation.baseRevision === null) return operation;
  const latest = latestRevisionByEntity.get(operation.entityId);
  if (latest === undefined) return operation;
  return { ...operation, baseRevision: latest };
};
