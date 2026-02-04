import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { tradesApi } from '@/lib/api';

interface Trade {
  id: string;
  pair: string;
  direction: 'long' | 'short';
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  position_size: number | null;
  risk_percent: number | null;
  pnl: number | null;
  pnl_percent: number | null;
  status: 'open' | 'closed' | 'cancelled';
  notes: string | null;
  entry_date: string | null;
  exit_date: string | null;
  created_at: string;
  user_id: string;
  screenshot_urls?: string[];
}

export const TRADES_QUERY_KEY = ['trades'] as const;

export const useTradesQuery = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...TRADES_QUERY_KEY, user?.id],
    queryFn: async (): Promise<Trade[]> => {
      if (!user) throw new Error('User not authenticated');

      try {
        const data = await tradesApi.getAll();
        return data || [];
      } catch (error) {
        logger.error('Error fetching trades:', error);
        throw error;
      }
    },
        .select(`
          *,
          trading_accounts!left(account_name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching trades:', error);
        throw error;
      }

      // Map the data to include account_name from the join
      return (data || []).map(trade => ({
        ...trade,
        account_name: trade.trading_accounts?.account_name || 'No Account',
      }));
    },
    enabled: !!user,
    staleTime: 1000 * 30, // Consider data fresh for 30 seconds
    gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes (formerly cacheTime)
  });
};

interface AddTradeData {
  pair: string;
  direction: 'long' | 'short';
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
      if (!user) throw new Error('User not authenticated');

      const tradeData = {
        ...newTrade,
        status: 'open',
        entry_date: new Date().toISOString(),
      };

      const data = await tradesApi.create(tradeData);
      return data;
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate and refetch trades
      queryClient.invalidateQueries({ queryKey: TRADES_QUERY_KEY });
    },
  });
};

interface UpdateTradeData {
  id: string;
  pair: string;
  direction: 'long' | 'short';
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
      if (!user) throw new Error('User not authenticated');

      const data = await tradesApi.update(id, updates);
      return data;
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
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('trading_journal')
        .update({
          status: 'closed',
          pnl,
          exit_date: new Date().toISOString(),
        })
        .eq('id', tradeId)
        .eq('user_id', user.id);

      if (error) throw error;
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
      if (!user) throw new Error('User not authenticated');

      await tradesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRADES_QUERY_KEY });
    },
  });
};
