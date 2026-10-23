import { planOutboxChange, type OfflineOperation, type OfflineOperationStatus } from "@/lib/offlineOutbox";

const OFFLINE_DB_NAME = "poscal-offline";
const OFFLINE_DB_VERSION = 1;
const MAX_CACHED_TRADES_PER_JOURNAL = 500;
const LAST_ACCOUNT_KEY = "lastAccountId";

export const OFFLINE_DATA_CHANGED_EVENT = "poscal:offline-data-changed";
export const OFFLINE_ENTITY_REMAPPED_EVENT = "poscal:offline-entity-remapped";

export type OfflineAuthUser = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  email_verified: boolean;
  role?: string | null;
};

export type OfflineViewerSubscription = {
  paymentStatus: string;
  subscriptionTier: string;
  expiresAtMs: number | null;
  freeJournalId?: string | null;
  lockedJournalIds?: string[];
  usage?: {
    journals: number;
    entries: number;
    screenshots: number;
    storageBytes: number;
  };
};

export type OfflineAccountSnapshot = {
  accountId: string;
  user: OfflineAuthUser;
  viewerSubscription: OfflineViewerSubscription | null;
  lastVerifiedAtMs: number;
  schemaVersion: 1;
};

type MetaRecord = {
  key: string;
  value: string;
};

type JournalCacheRecord = {
  accountId: string;
  journals: unknown[];
  cachedAtMs: number;
};

type TradeCacheRecord = {
  cacheKey: string;
  accountId: string;
  journalId: string;
  trades: unknown[];
  cachedAtMs: number;
};

export type { OfflineOperation, OfflineOperationStatus };

type StoreName = "meta" | "accounts" | "journals" | "trades" | "outbox";

let dbPromise: Promise<IDBDatabase | null> | null = null;

const requestResult = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });

const transactionDone = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });

const openOfflineDb = (): Promise<IDBDatabase | null> => {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("accounts")) {
        db.createObjectStore("accounts", { keyPath: "accountId" });
      }
      if (!db.objectStoreNames.contains("journals")) {
        db.createObjectStore("journals", { keyPath: "accountId" });
      }
      if (!db.objectStoreNames.contains("trades")) {
        const store = db.createObjectStore("trades", { keyPath: "cacheKey" });
        store.createIndex("byAccount", "accountId", { unique: false });
      }
      if (!db.objectStoreNames.contains("outbox")) {
        const store = db.createObjectStore("outbox", { keyPath: "clientOperationId" });
        store.createIndex("byAccount", "accountId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn("[offline] IndexedDB is unavailable", request.error);
      resolve(null);
    };
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
};

const readRecord = async <T>(storeName: StoreName, key: IDBValidKey): Promise<T | null> => {
  const db = await openOfflineDb();
  if (!db) return null;
  const transaction = db.transaction(storeName, "readonly");
  const value = await requestResult(transaction.objectStore(storeName).get(key));
  await transactionDone(transaction);
  return (value as T | undefined) ?? null;
};

const writeRecord = async (storeName: StoreName, value: unknown): Promise<void> => {
  const db = await openOfflineDb();
  if (!db) return;
  const transaction = db.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).put(value);
  await transactionDone(transaction);
};

const deleteRecord = async (storeName: StoreName, key: IDBValidKey): Promise<void> => {
  const db = await openOfflineDb();
  if (!db) return;
  const transaction = db.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).delete(key);
  await transactionDone(transaction);
};

const tradeCacheKey = (accountId: string, journalId: string) => `${accountId}:${journalId}`;

export const saveOfflineAccount = async (snapshot: OfflineAccountSnapshot): Promise<void> => {
  const db = await openOfflineDb();
  if (!db) return;
  const transaction = db.transaction(["accounts", "meta"], "readwrite");
  transaction.objectStore("accounts").put(snapshot);
  transaction.objectStore("meta").put({ key: LAST_ACCOUNT_KEY, value: snapshot.accountId } satisfies MetaRecord);
  await transactionDone(transaction);
};

export const loadLastOfflineAccount = async (): Promise<OfflineAccountSnapshot | null> => {
  const meta = await readRecord<MetaRecord>("meta", LAST_ACCOUNT_KEY);
  if (!meta?.value) return null;
  return await readRecord<OfflineAccountSnapshot>("accounts", meta.value);
};

export const saveOfflineViewerSubscription = async (
  accountId: string,
  viewerSubscription: OfflineViewerSubscription,
): Promise<void> => {
  const current = await readRecord<OfflineAccountSnapshot>("accounts", accountId);
  if (!current) return;
  await writeRecord("accounts", { ...current, viewerSubscription });
};

export const cacheOfflineJournals = async <T>(accountId: string, journals: T[]): Promise<void> => {
  await writeRecord("journals", {
    accountId,
    journals,
    cachedAtMs: Date.now(),
  } satisfies JournalCacheRecord);
};

export const loadOfflineJournals = async <T>(accountId: string): Promise<T[]> => {
  const record = await readRecord<JournalCacheRecord>("journals", accountId);
  return Array.isArray(record?.journals) ? (record.journals as T[]) : [];
};

export const cacheOfflineTrades = async <T>(
  accountId: string,
  journalId: string,
  trades: T[],
): Promise<void> => {
  await writeRecord("trades", {
    cacheKey: tradeCacheKey(accountId, journalId),
    accountId,
    journalId,
    trades: trades.slice(0, MAX_CACHED_TRADES_PER_JOURNAL),
    cachedAtMs: Date.now(),
  } satisfies TradeCacheRecord);
};

export const loadOfflineTrades = async <T>(accountId: string, journalId: string): Promise<T[]> => {
  const record = await readRecord<TradeCacheRecord>("trades", tradeCacheKey(accountId, journalId));
  return Array.isArray(record?.trades) ? (record.trades as T[]) : [];
};

export const findOfflineTrade = async <T extends { id: string }>(
  accountId: string,
  tradeId: string,
): Promise<{ journalId: string; trade: T } | null> => {
  const db = await openOfflineDb();
  if (!db) return null;
  const transaction = db.transaction("trades", "readonly");
  const rows = await requestResult(transaction.objectStore("trades").index("byAccount").getAll(accountId));
  await transactionDone(transaction);
  for (const row of rows as TradeCacheRecord[]) {
    const trade = (row.trades as T[]).find((candidate) => candidate.id === tradeId);
    if (trade) return { journalId: row.journalId, trade };
  }
  return null;
};

export const upsertOfflineTrade = async <T extends { id: string }>(
  accountId: string,
  journalId: string,
  trade: T,
): Promise<void> => {
  const trades = await loadOfflineTrades<T>(accountId, journalId);
  const next = [trade, ...trades.filter((candidate) => candidate.id !== trade.id)];
  await cacheOfflineTrades(accountId, journalId, next);
  notifyOfflineDataChanged(accountId, journalId);
};

export const removeOfflineTrade = async <T extends { id: string }>(
  accountId: string,
  journalId: string,
  tradeId: string,
): Promise<void> => {
  const trades = await loadOfflineTrades<T>(accountId, journalId);
  await cacheOfflineTrades(
    accountId,
    journalId,
    trades.filter((candidate) => candidate.id !== tradeId),
  );
  notifyOfflineDataChanged(accountId, journalId);
};

export const enqueueOfflineOperation = async (operation: OfflineOperation): Promise<void> => {
  const existing = await listOfflineOperations(operation.accountId);
  const plan = planOutboxChange(existing, operation);
  const db = await openOfflineDb();
  if (!db) return;
  const transaction = db.transaction("outbox", "readwrite");
  const store = transaction.objectStore("outbox");
  for (const clientOperationId of plan.deleteIds) store.delete(clientOperationId);
  for (const next of plan.put) store.put(next);
  await transactionDone(transaction);
  notifyOfflineDataChanged(operation.accountId, operation.journalId);
};

export const listOfflineOperations = async (accountId: string): Promise<OfflineOperation[]> => {
  const db = await openOfflineDb();
  if (!db) return [];
  const transaction = db.transaction("outbox", "readonly");
  const rows = await requestResult(transaction.objectStore("outbox").index("byAccount").getAll(accountId));
  await transactionDone(transaction);
  return (rows as OfflineOperation[]).sort((left, right) => left.createdAtMs - right.createdAtMs);
};

export const updateOfflineOperation = async (
  clientOperationId: string,
  patch: Partial<Pick<OfflineOperation, "attemptCount" | "status" | "lastError">>,
): Promise<void> => {
  const current = await readRecord<OfflineOperation>("outbox", clientOperationId);
  if (!current) return;
  await writeRecord("outbox", { ...current, ...patch });
  notifyOfflineDataChanged(current.accountId, current.journalId);
};

export const removeOfflineOperation = async (clientOperationId: string): Promise<void> => {
  const current = await readRecord<OfflineOperation>("outbox", clientOperationId);
  await deleteRecord("outbox", clientOperationId);
  if (current) notifyOfflineDataChanged(current.accountId, current.journalId);
};

export const remapOfflineEntity = async <T extends { id: string; revision?: number }>(
  accountId: string,
  journalId: string,
  temporaryId: string,
  serverId: string,
  serverRevision: number,
): Promise<void> => {
  const db = await openOfflineDb();
  if (!db) return;
  const transaction = db.transaction(["trades", "outbox"], "readwrite");
  const tradeStore = transaction.objectStore("trades");
  const outboxStore = transaction.objectStore("outbox");
  const cacheKey = tradeCacheKey(accountId, journalId);
  const [cache, operations] = await Promise.all([
    requestResult(tradeStore.get(cacheKey)),
    requestResult(outboxStore.index("byAccount").getAll(accountId)),
  ]);

  const record = cache as TradeCacheRecord | undefined;
  if (record) {
    record.trades = (record.trades as T[]).map((trade) =>
      trade.id === temporaryId
        ? {
            ...trade,
            id: serverId,
            revision: Math.max(trade.revision ?? serverRevision, serverRevision),
          }
        : trade,
    );
    record.cachedAtMs = Date.now();
    tradeStore.put(record);
  }

  for (const operation of operations as OfflineOperation[]) {
    if (operation.entityId === temporaryId) {
      outboxStore.put({ ...operation, entityId: serverId });
    }
  }
  await transactionDone(transaction);
  notifyOfflineDataChanged(accountId, journalId);
  const detail = { type: "remap", accountId, journalId, temporaryId, serverId };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OFFLINE_ENTITY_REMAPPED_EVENT, { detail }));
  }
  offlineChannel?.postMessage(detail);
};

export const applyOfflineTradeRevision = async <T extends { id: string; revision?: number }>(
  accountId: string,
  journalId: string,
  tradeId: string,
  serverRevision: number,
): Promise<void> => {
  const trades = await loadOfflineTrades<T>(accountId, journalId);
  const next = trades.map((trade) =>
    trade.id === tradeId
      ? { ...trade, revision: Math.max(trade.revision ?? serverRevision, serverRevision) }
      : trade,
  );
  await cacheOfflineTrades(accountId, journalId, next);
  notifyOfflineDataChanged(accountId, journalId);
};

export const clearOfflineAccount = async (accountId: string): Promise<void> => {
  const db = await openOfflineDb();
  if (!db) return;
  const transaction = db.transaction(["accounts", "meta", "journals", "trades", "outbox"], "readwrite");
  transaction.objectStore("accounts").delete(accountId);
  transaction.objectStore("journals").delete(accountId);

  const metaStore = transaction.objectStore("meta");
  const lastAccount = (await requestResult(metaStore.get(LAST_ACCOUNT_KEY))) as MetaRecord | undefined;
  if (lastAccount?.value === accountId) metaStore.delete(LAST_ACCOUNT_KEY);

  for (const storeName of ["trades", "outbox"] as const) {
    const store = transaction.objectStore(storeName);
    const keys = await requestResult(store.index("byAccount").getAllKeys(accountId));
    for (const key of keys) store.delete(key);
  }

  await transactionDone(transaction);
};

export const createClientOperationId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

export const createOfflineEntityId = () => `offline:${createClientOperationId()}`;

const offlineChannel =
  typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("poscal-offline");

if (offlineChannel && typeof window !== "undefined") {
  offlineChannel.onmessage = (event: MessageEvent<{
    type?: string;
    accountId?: string;
    journalId?: string | null;
    temporaryId?: string;
    serverId?: string;
  }>) => {
    const data = event.data;
    if (!data) return;
    if (data.type === "remap") {
      window.dispatchEvent(new CustomEvent(OFFLINE_ENTITY_REMAPPED_EVENT, { detail: data }));
      return;
    }
    window.dispatchEvent(new CustomEvent(OFFLINE_DATA_CHANGED_EVENT, { detail: data }));
  };
}

export const offlineWritesEnabled = () => {
  const flag = import.meta.env.VITE_OFFLINE_WRITES;
  return flag !== "false" && flag !== "0";
};

export const notifyOfflineDataChanged = (accountId: string, journalId?: string) => {
  const detail = { accountId, journalId: journalId ?? null };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OFFLINE_DATA_CHANGED_EVENT, { detail }));
  }
  offlineChannel?.postMessage(detail);
};

export const isLikelyNetworkError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /network|failed to fetch|offline|load failed|timeout|websocket|connection/i.test(message);
};
