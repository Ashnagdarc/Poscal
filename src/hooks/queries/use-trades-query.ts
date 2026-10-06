import { useEffect, useRef } from 'react';
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

export const TRADES_QUERY_KEY = ['trades'] as const;

type Trade = JournalTrade;

export const JOURNAL_TRADE_PAGE_SIZE = 50;

/**
 * Reactive, cursor-paginated trade feed.
 * Phase 1: exposed alongside the legacy bounded query. The Journal UI is not
 * switched until analytics are decoupled from loaded feed rows.
 */
export const usePaginatedTradesQuery = () => {
  const { user } = useAuth();
  const { activeJournalId } = useJournal();
  const enabled = Boolean(user && activeJournalId);

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

  return {
    ...paginated,
    data: paginated.results.map(fromConvexTrade),
    isLoading: paginated.status === 'LoadingFirstPage',
    isLoadingMore: paginated.status === 'LoadingMore',
    canLoadMore: paginated.status === 'CanLoadMore',
    loadMore: () => paginated.loadMore(JOURNAL_TRADE_PAGE_SIZE),
  };
};

export const useTradesQuery = () => {
  const { user } = useAuth();
  const { activeJournalId } = useJournal();
  const warnedTruncationKey = useRef<string | null>(null);

  const query = useQuery({
    queryKey: [...TRADES_QUERY_KEY, user?.id, activeJournalId],
    queryFn: async (): Promise<{ trades: Trade[]; truncated: boolean }> => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      return await listJournalEntriesWithMeta(user.id, undefined, activeJournalId);
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
  const { user } = useAuth();
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

      return await createNotebookDraft(user.id, activeJournalId, entryDate ?? null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRADES_QUERY_KEY });
    },
  });
};

export const useAddTradeMutation = () => {
  const { user } = useAuth();
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

      return await createJournalEntry(user.id, {
        ...newTrade,
        journal_id: activeJournalId,
        entry_date: newTrade.entry_date ?? new Date().toISOString(),
        exit_date: newTrade.status === 'closed' ? (newTrade.exit_date ?? new Date().toISOString()) : null,
      });
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
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTradeInput) => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      return await updateJournalEntry(user.id, id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRADES_QUERY_KEY });
    },
  });
};

export const useCloseTradeMutation = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tradeId, pnl }: { tradeId: string; pnl: number }) => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      return await updateJournalEntry(user.id, tradeId, {
        status: 'closed',
        pnl,
        exit_date: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRADES_QUERY_KEY });
    },
  });
};

export const useDeleteTradeMutation = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tradeId: string) => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      await deleteJournalEntry(user.id, tradeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRADES_QUERY_KEY });
    },
  });
};
