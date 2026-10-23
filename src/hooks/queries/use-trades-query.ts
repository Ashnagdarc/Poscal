import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePaginatedQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useJournal } from '@/contexts/JournalContext';
import {
  createJournalEntry,
  createNotebookDraft,
  deleteJournalEntry,
  JOURNAL_FETCH_LIMIT,
  listJournalEntriesWithMeta,
  updateJournalEntry,
  fromConvexTrade,
  type JournalTrade,
} from '@/lib/convexJournal';
import { mergeOfflineTrades, overlayCachedTrades, type OfflineOperation } from '@/lib/offlineOutbox';
import {
  cacheOfflineTrades,
  createClientOperationId,
  createOfflineEntityId,
  enqueueOfflineOperation,
  findOfflineTrade,
  isLikelyNetworkError,
  listOfflineOperations,
  loadOfflineTrades,
  OFFLINE_DATA_CHANGED_EVENT,
  offlineWritesEnabled,
  removeOfflineTrade,
  upsertOfflineTrade,
} from '@/lib/offlineStore';

export const TRADES_QUERY_KEY = ['trades'] as const;

type Trade = JournalTrade;

export const JOURNAL_TRADE_PAGE_SIZE = 50;

/**
 * Reactive, cursor-paginated trade feed.
 * Phase 1: exposed alongside the legacy bounded query. The Journal UI is not
 * switched until analytics are decoupled from loaded feed rows.
 */
const journalOperations = async (accountId: string, journalId: string) =>
  (await listOfflineOperations(accountId)).filter((operation) => operation.journalId === journalId);

const rememberServerTrades = async (
  accountId: string,
  journalId: string,
  serverTrades: Trade[],
  replaceUnseen: boolean,
) => {
  const [cached, operations] = await Promise.all([
    loadOfflineTrades<Trade>(accountId, journalId),
    journalOperations(accountId, journalId),
  ]);
  const merged = overlayCachedTrades(cached, serverTrades, operations, replaceUnseen);
  await cacheOfflineTrades(accountId, journalId, merged);
  return merged;
};

const runOnlineOrQueue = async <T>(
  authMode: string,
  online: () => Promise<T>,
  queue: () => Promise<T>,
) => {
  if (authMode !== "online_authenticated") {
    if (!offlineWritesEnabled()) {
      throw new Error("Reconnect before editing. Journals already saved on this device can still be viewed.");
    }
    return await queue();
  }
  try {
    return await online();
  } catch (error) {
    if (!isLikelyNetworkError(error) || !offlineWritesEnabled()) throw error;
    toast.message("Saved on this device. It will sync when Poscal reconnects.");
    return await queue();
  }
};

export const usePaginatedTradesQuery = () => {
  const { user, authMode } = useAuth();
  const { activeJournalId } = useJournal();
  const enabled = Boolean(user && activeJournalId && authMode === "online_authenticated");
  const [cachedTrades, setCachedTrades] = useState<Trade[]>([]);
  const [pendingOperations, setPendingOperations] = useState<OfflineOperation[]>([]);
  const [cacheLoading, setCacheLoading] = useState(false);

  const paginated = usePaginatedQuery(
    api.tradingJournal.listForUserPaginated,
    enabled
      ? {
          journalId: activeJournalId as any,
          status: null,
        }
      : 'skip',
    { initialNumItems: JOURNAL_TRADE_PAGE_SIZE },
  );

  const refreshCachedTrades = useCallback(() => {
    if (!user?.id || !activeJournalId) {
      setCachedTrades([]);
      return;
    }
    setCacheLoading(true);
    void Promise.all([
      loadOfflineTrades<Trade>(user.id, activeJournalId),
      journalOperations(user.id, activeJournalId),
    ])
      .then(([trades, operations]) => {
        setCachedTrades(trades);
        setPendingOperations(operations);
      })
      .finally(() => setCacheLoading(false));
  }, [activeJournalId, user?.id]);

  useEffect(() => {
    refreshCachedTrades();
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<{ accountId?: string; journalId?: string | null }>).detail;
      if (detail?.accountId === user?.id && (!detail.journalId || detail.journalId === activeJournalId)) {
        refreshCachedTrades();
      }
    };
    window.addEventListener(OFFLINE_DATA_CHANGED_EVENT, handleChange);
    return () => window.removeEventListener(OFFLINE_DATA_CHANGED_EVENT, handleChange);
  }, [activeJournalId, refreshCachedTrades, user?.id]);

  useEffect(() => {
    if (!enabled || !user?.id || !activeJournalId || paginated.status === "LoadingFirstPage") return;
    const serverTrades = paginated.results.map(fromConvexTrade);
    void rememberServerTrades(user.id, activeJournalId, serverTrades, false)
      .then(setCachedTrades)
      .catch((error) => {
        console.warn("[journal] Could not cache trades for offline use", error);
      });
  }, [activeJournalId, enabled, paginated.results, paginated.status, user?.id]);

  const onlineData = mergeOfflineTrades(
    paginated.results.map(fromConvexTrade),
    cachedTrades,
    pendingOperations,
  );
  const useOfflineData = authMode !== "online_authenticated";

  return {
    ...paginated,
    data: useOfflineData ? cachedTrades : onlineData,
    isLoading: useOfflineData ? cacheLoading : paginated.status === 'LoadingFirstPage',
    isLoadingMore: useOfflineData ? false : paginated.status === 'LoadingMore',
    canLoadMore: useOfflineData ? false : paginated.status === 'CanLoadMore',
    loadMore: () => {
      if (!useOfflineData) paginated.loadMore(JOURNAL_TRADE_PAGE_SIZE);
    },
  };
};

export const useTradesQuery = () => {
  const { user, authMode } = useAuth();
  const { activeJournalId } = useJournal();
  const queryClient = useQueryClient();
  const warnedTruncationKey = useRef<string | null>(null);

  const query = useQuery({
    queryKey: [...TRADES_QUERY_KEY, user?.id, activeJournalId],
    queryFn: async (): Promise<{ trades: Trade[]; truncated: boolean }> => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      if (!activeJournalId) return { trades: [], truncated: false };
      if (authMode === "offline_verified_device") {
        return {
          trades: await loadOfflineTrades<Trade>(user.id, activeJournalId),
          truncated: false,
        };
      }

      try {
        const result = await listJournalEntriesWithMeta(user.id, undefined, activeJournalId);
        const trades = await rememberServerTrades(user.id, activeJournalId, result.trades, true);
        return { trades, truncated: result.truncated };
      } catch (error) {
        if (!isLikelyNetworkError(error)) throw error;
        return {
          trades: await loadOfflineTrades<Trade>(user.id, activeJournalId),
          truncated: false,
        };
      }
    },
    enabled: !!user && !!activeJournalId,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!query.isSuccess || !query.data || !user || !activeJournalId) return;
    const metaKey = `${user.id}:${activeJournalId}`;
    if (query.data.truncated && warnedTruncationKey.current !== metaKey) {
      warnedTruncationKey.current = metaKey;
      toast.warning(
        `Showing the ${JOURNAL_FETCH_LIMIT} most recent trades. Older trades are hidden from analytics until pagination ships.`,
      );
    }
    if (!query.data.truncated) {
      warnedTruncationKey.current = null;
    }
  }, [query.isSuccess, query.data, user, activeJournalId]);

  useEffect(() => {
    if (!user?.id || !activeJournalId) return;
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<{ accountId?: string; journalId?: string | null }>).detail;
      if (detail?.accountId !== user.id || (detail.journalId && detail.journalId !== activeJournalId)) return;
      if (authMode === "online_authenticated") {
        void queryClient.invalidateQueries({ queryKey: TRADES_QUERY_KEY });
        return;
      }
      void loadOfflineTrades<Trade>(user.id, activeJournalId).then((trades) => {
        queryClient.setQueryData([...TRADES_QUERY_KEY, user.id, activeJournalId], {
          trades,
          truncated: false,
        });
      });
    };
    window.addEventListener(OFFLINE_DATA_CHANGED_EVENT, handleChange);
    return () => window.removeEventListener(OFFLINE_DATA_CHANGED_EVENT, handleChange);
  }, [activeJournalId, authMode, queryClient, user?.id]);

  return {
    ...query,
    data: query.data?.trades,
  };
};

export interface ManualTradeInput {
  pair: string;
  direction: 'buy' | 'sell' | 'long' | 'short';
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  position_size: number | null;
  risk_percent: number | null;
  pnl: number | null;
  status: 'open' | 'closed' | 'cancelled';
  notes: string | null;
  entry_date?: string | null;
  exit_date?: string | null;
  tags?: string | null;
  market_condition?: string | null;
}

export const useCreateNotebookDraftMutation = () => {
  const { user, authMode } = useAuth();
  const { activeJournalId } = useJournal();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryDate?: string | null) => {
      if (!user) {
        throw new Error('User not authenticated');
      }
      if (!activeJournalId) {
        throw new Error('No active journal');
      }

      return await runOnlineOrQueue(
        authMode,
        () => createNotebookDraft(user.id, activeJournalId, entryDate ?? null),
        async () => {
      const now = Date.now();
      const id = createOfflineEntityId();
      const created: Trade = {
        id,
        journal_id: activeJournalId,
        pair: "JOURNAL",
        direction: "long",
        entry_price: null,
        exit_price: null,
        stop_loss: null,
        take_profit: null,
        position_size: null,
        risk_percent: null,
        pnl: null,
        status: "open",
        notes: null,
        entry_date: entryDate ?? new Date(now).toISOString(),
        exit_date: null,
        created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
        revision: 1,
        journal_type: "notebook_draft",
        journal_status: "empty",
      };
      await upsertOfflineTrade(user.id, activeJournalId, created);
      await enqueueOfflineOperation({
        clientOperationId: createClientOperationId(),
        accountId: user.id,
        entityType: "trade",
        entityId: id,
        journalId: activeJournalId,
        operation: "create",
        baseRevision: null,
        payload: { kind: "notebook_draft", entryDateMs: new Date(created.entry_date!).getTime() },
        createdAtMs: now,
        attemptCount: 0,
        status: "pending",
        lastError: null,
      });
      return created;
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRADES_QUERY_KEY });
    },
  });
};

export const useAddTradeMutation = () => {
  const { user, authMode } = useAuth();
  const { activeJournalId } = useJournal();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newTrade: ManualTradeInput) => {
      if (!user) {
        throw new Error('User not authenticated');
      }
      if (!activeJournalId) {
        throw new Error('No active journal');
      }

      const payload = {
        ...newTrade,
        journal_id: activeJournalId,
        entry_date: newTrade.entry_date ?? new Date().toISOString(),
        exit_date: newTrade.status === 'closed' ? (newTrade.exit_date ?? new Date().toISOString()) : null,
      };
      return await runOnlineOrQueue(
        authMode,
        () => createJournalEntry(user.id, payload),
        async () => {
      const now = Date.now();
      const id = createOfflineEntityId();
      const created: Trade = {
        id,
        journal_id: activeJournalId,
        pair: payload.pair,
        direction: payload.direction,
        entry_price: payload.entry_price,
        exit_price: payload.exit_price,
        stop_loss: payload.stop_loss,
        take_profit: payload.take_profit,
        position_size: payload.position_size,
        risk_percent: payload.risk_percent,
        pnl: payload.pnl,
        status: payload.status,
        notes: payload.notes,
        entry_date: payload.entry_date,
        exit_date: payload.exit_date,
        created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
        revision: 1,
        journal_type: "structured",
        journal_status: payload.notes ? "draft" : "empty",
        tags: payload.tags ?? null,
        market_condition: payload.market_condition ?? null,
      };
      await upsertOfflineTrade(user.id, activeJournalId, created);
      await enqueueOfflineOperation({
        clientOperationId: createClientOperationId(),
        accountId: user.id,
        entityType: "trade",
        entityId: id,
        journalId: activeJournalId,
        operation: "create",
        baseRevision: null,
        payload,
        createdAtMs: now,
        attemptCount: 0,
        status: "pending",
        lastError: null,
      });
      return created;
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRADES_QUERY_KEY });
    },
  });
};

export interface UpdateTradeInput extends ManualTradeInput {
  id: string;
}

export const useUpdateTradeMutation = () => {
  const { user, authMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTradeInput) => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      return await runOnlineOrQueue(
        authMode,
        () => updateJournalEntry(user.id, id, updates),
        async () => {
      const cached = await findOfflineTrade<Trade>(user.id, id);
      if (!cached) throw new Error("This trade is not available on this device.");
      const now = Date.now();
      const currentRevision = cached.trade.revision ?? 0;
      const updated: Trade = {
        ...cached.trade,
        ...updates,
        updated_at: new Date(now).toISOString(),
        revision: currentRevision + 1,
      };
      await upsertOfflineTrade(user.id, cached.journalId, updated);
      await enqueueOfflineOperation({
        clientOperationId: createClientOperationId(),
        accountId: user.id,
        entityType: "trade",
        entityId: id,
        journalId: cached.journalId,
        operation: "update",
        baseRevision: currentRevision,
        payload: updates,
        createdAtMs: now,
        attemptCount: 0,
        status: "pending",
        lastError: null,
      });
      return updated;
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRADES_QUERY_KEY });
    },
  });
};

export const useCloseTradeMutation = () => {
  const { user, authMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tradeId, pnl }: { tradeId: string; pnl: number }) => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      const updates = {
        status: 'closed',
        pnl,
        exit_date: new Date().toISOString(),
      } as const;
      return await runOnlineOrQueue(
        authMode,
        () => updateJournalEntry(user.id, tradeId, updates),
        async () => {
      const cached = await findOfflineTrade<Trade>(user.id, tradeId);
      if (!cached) throw new Error("This trade is not available on this device.");
      const now = Date.now();
      const currentRevision = cached.trade.revision ?? 0;
      const updated: Trade = {
        ...cached.trade,
        ...updates,
        updated_at: new Date(now).toISOString(),
        revision: currentRevision + 1,
      };
      await upsertOfflineTrade(user.id, cached.journalId, updated);
      await enqueueOfflineOperation({
        clientOperationId: createClientOperationId(),
        accountId: user.id,
        entityType: "trade",
        entityId: tradeId,
        journalId: cached.journalId,
        operation: "update",
        baseRevision: currentRevision,
        payload: updates,
        createdAtMs: now,
        attemptCount: 0,
        status: "pending",
        lastError: null,
      });
      return updated;
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRADES_QUERY_KEY });
    },
  });
};

export const useDeleteTradeMutation = () => {
  const { user, authMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tradeId: string) => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      await runOnlineOrQueue(
        authMode,
        async () => {
          await deleteJournalEntry(user.id, tradeId);
        },
        async () => {
      const cached = await findOfflineTrade<Trade>(user.id, tradeId);
      if (!cached) throw new Error("This trade is not available on this device.");
      const currentRevision = cached.trade.revision ?? 0;
      await removeOfflineTrade<Trade>(user.id, cached.journalId, tradeId);
      await enqueueOfflineOperation({
        clientOperationId: createClientOperationId(),
        accountId: user.id,
        entityType: "trade",
        entityId: tradeId,
        journalId: cached.journalId,
        operation: "delete",
        baseRevision: currentRevision,
        payload: {},
        createdAtMs: Date.now(),
        attemptCount: 0,
        status: "pending",
        lastError: null,
      });
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRADES_QUERY_KEY });
    },
  });
};
