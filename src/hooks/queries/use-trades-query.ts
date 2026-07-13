import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  createJournalEntry,
  deleteJournalEntry,
  listJournalEntries,
  updateJournalEntry,
  type JournalTrade,
} from '@/lib/convexJournal';

export const TRADES_QUERY_KEY = ['trades'] as const;

type Trade = JournalTrade;

export const useTradesQuery = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...TRADES_QUERY_KEY, user?.id],
    queryFn: async (): Promise<Trade[]> => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      return await listJournalEntries(user.id);
    },
    enabled: !!user,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
  });
};

interface AddTradeData {
  pair: string;
  direction: 'buy' | 'sell' | 'long' | 'short';
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  position_size: number | null;
  risk_percent: number | null;
  notes: string | null;
}

export const useAddTradeMutation = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newTrade: AddTradeData) => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      return await createJournalEntry(user.id, {
        ...newTrade,
        status: 'open',
        entry_date: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRADES_QUERY_KEY });
    },
  });
};

interface UpdateTradeData {
  id: string;
  pair: string;
  direction: 'buy' | 'sell' | 'long' | 'short';
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  position_size: number | null;
  risk_percent: number | null;
  notes: string | null;
}

export const useUpdateTradeMutation = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTradeData) => {
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
