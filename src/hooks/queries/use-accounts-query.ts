import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

interface TradingAccount {
  id: string;
  account_name: string;
  platform: string;
  is_active: boolean;
}

export const ACCOUNTS_QUERY_KEY = ['trading_accounts'] as const;

export const useAccountsQuery = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...ACCOUNTS_QUERY_KEY, user?.id],
    queryFn: async (): Promise<TradingAccount[]> => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('trading_accounts')
        .select('id, account_name, platform, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching accounts:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // Consider fresh for 2 minutes
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
  });
};
